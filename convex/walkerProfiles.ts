import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireUser, requireWalker, requireOwner } from './lib/guards';
import { packwalkError } from './lib/errors';
import { encodeGeohash, neighborGeohashes } from './lib/geohash';
import { haversineDistanceKm } from './lib/geo';
import { getFirstMatchingCoordinates } from './lib/torontoNeighborhoods';
import type { Doc, Id } from './_generated/dataModel';

// Hourly rate bounds (in cents)
const MIN_HOURLY_RATE_CENTS = 1000; // $10/hour
const MAX_HOURLY_RATE_CENTS = 10000; // $100/hour

function validateHourlyRate(rate: number): void {
  if (!Number.isInteger(rate)) {
    packwalkError('validation/error', 'Hourly rate must be a whole number (in cents)');
  }
  if (rate < MIN_HOURLY_RATE_CENTS) {
    packwalkError('validation/error', `Hourly rate must be at least $${MIN_HOURLY_RATE_CENTS / 100}/hour`);
  }
  if (rate > MAX_HOURLY_RATE_CENTS) {
    packwalkError('validation/error', `Hourly rate cannot exceed $${MAX_HOURLY_RATE_CENTS / 100}/hour`);
  }
}

const dayAvailability = v.object({
  enabled: v.boolean(),
  startTime: v.string(),
  endTime: v.string(),
});

const availabilityArgs = v.optional(
  v.object({
    monday: v.optional(dayAvailability),
    tuesday: v.optional(dayAvailability),
    wednesday: v.optional(dayAvailability),
    thursday: v.optional(dayAvailability),
    friday: v.optional(dayAvailability),
    saturday: v.optional(dayAvailability),
    sunday: v.optional(dayAvailability),
  })
);

const locationArgs = v.object({
  lat: v.number(),
  lng: v.number(),
});

// Helper function to sanitize user for public display
const sanitizeUserForPublic = (user: Doc<'users'>) => ({
  _id: user._id,
  name: user.name,
  avatarUrl: user.avatarUrl,
  walkerVerificationStatus: user.walkerVerificationStatus,
});

export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    requireWalker(user);

    return ctx.db
      .query('walkerProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first();
  },
});

export const upsertMine = mutation({
  args: {
    hourlyRate: v.number(),
    bio: v.optional(v.string()),
    yearsExperience: v.optional(v.number()),
    serviceAreas: v.array(v.string()),
    maxDistanceKm: v.number(),
    availability: availabilityArgs,
    isVisible: v.boolean(),
    location: v.optional(locationArgs),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireWalker(user);
    validateHourlyRate(args.hourlyRate);
    const now = Date.now();

    const existing = await ctx.db
      .query('walkerProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first();

    const baseData = {
      userId: user._id,
      hourlyRate: args.hourlyRate,
      bio: args.bio,
      yearsExperience: args.yearsExperience,
      serviceAreas: args.serviceAreas,
      maxDistanceKm: args.maxDistanceKm,
      availability: args.availability,
      isVisible: args.isVisible,
      updatedAt: now,
    } satisfies Omit<
      Doc<'walkerProfiles'>,
      '_id' | '_creationTime' | 'avgRating' | 'reviewCount' | 'createdAt'
    >;

    // Determine location: use provided location, or auto-set from first serviceArea
    let locationToUse = args.location;
    if (!locationToUse && args.serviceAreas.length > 0) {
      const autoLocation = getFirstMatchingCoordinates(args.serviceAreas);
      if (autoLocation) {
        locationToUse = autoLocation;
      }
    }

    let profileData: Partial<Doc<'walkerProfiles'>> = baseData;
    if (locationToUse) {
      const geohash = encodeGeohash(locationToUse.lat, locationToUse.lng, 6);
      profileData = {
        ...baseData,
        location: { ...locationToUse, geohash },
        geohash,
      };
    }

    if (existing) {
      await ctx.db.patch(existing._id, profileData);
      return existing._id;
    }

    const insertData = {
      ...baseData,
      ...(locationToUse
        ? {
            location: (profileData as Doc<'walkerProfiles'>).location,
            geohash: (profileData as Doc<'walkerProfiles'>).geohash,
          }
        : {}),
      avgRating: 0,
      reviewCount: 0,
      createdAt: now,
    } satisfies Omit<Doc<'walkerProfiles'>, '_id' | '_creationTime'>;

    return ctx.db.insert('walkerProfiles', insertData);
  },
});

export const getPublicByUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const requester = await requireUser(ctx);
    requireOwner(requester);

    const user = await ctx.db.get(args.userId);
    if (!user || user.isDeleted || user.userType !== 'walker') {
      // Return null instead of throwing - walker may have been deleted
      return null;
    }

    const profile = await ctx.db
      .query('walkerProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    if (!profile || !profile.isVisible || user.walkerVerificationStatus !== 'approved') {
      // Return null instead of throwing - walker may not be available
      return null;
    }

    // Walker must have active Stripe Connect to receive payouts
    if (user.stripeConnectStatus !== 'active') {
      return null;
    }

    // Get completed walk count for this walker
    const completedWalks = await ctx.db
      .query('walks')
      .withIndex('by_walkerId_status', (q) =>
        q.eq('walkerId', args.userId).eq('status', 'completed')
      )
      .collect();

    return {
      user: sanitizeUserForPublic(user),
      profile,
      completedWalkCount: completedWalks.length,
    };
  },
});

// Get walker info for review screen - returns info even if walker can't currently receive tips
// Used after a walk is completed to show walker details and determine if tips are possible
export const getWalkerForReview = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const requester = await requireUser(ctx);
    requireOwner(requester);

    const user = await ctx.db.get(args.userId);
    if (!user || user.isDeleted || user.userType !== 'walker') {
      return null;
    }

    const profile = await ctx.db
      .query('walkerProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    // Return walker info regardless of current status, but include canReceiveTips
    return {
      user: sanitizeUserForPublic(user),
      profile,
      canReceiveTips: user.stripeConnectStatus === 'active',
    };
  },
});

// Toggle walker's online/offline status
export const toggleVisibility = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    requireWalker(user);

    const profile = await ctx.db
      .query('walkerProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first();

    if (!profile) {
      packwalkError('validation/error', 'Walker profile not found. Please complete your profile setup.');
    }

    const newVisibility = !profile.isVisible;
    await ctx.db.patch(profile._id, {
      isVisible: newVisibility,
      updatedAt: Date.now(),
    });

    return { isVisible: newVisibility };
  },
});

export const searchNearby = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusKm: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const requester = await requireUser(ctx);
    requireOwner(requester);

    const radiusKm = args.radiusKm ?? 10;
    const limit = Math.min(args.limit ?? 25, 50);

    const centerHash = encodeGeohash(args.lat, args.lng, 6);
    const cells = neighborGeohashes(centerHash);

    const candidates: Array<{
      userId: Id<'users'>;
      profileId: Id<'walkerProfiles'>;
      distanceKm: number;
    }> = [];

    for (const cell of cells) {
      const profiles = await ctx.db
        .query('walkerProfiles')
        .withIndex('by_geohash', (q) => q.eq('geohash', cell))
        .filter((f) => f.eq(f.field('isVisible'), true))
        .take(50);

      for (const profile of profiles) {
        if (!profile.location) continue;
        const d = haversineDistanceKm(
          args.lat,
          args.lng,
          profile.location.lat,
          profile.location.lng,
        );
        if (d > radiusKm) continue;
        candidates.push({
          userId: profile.userId,
          profileId: profile._id,
          distanceKm: d,
        });
      }
    }

    const byUserId = new Map<Id<'users'>, { profileId: Id<'walkerProfiles'>; distanceKm: number }>();
    for (const c of candidates) {
      const existing = byUserId.get(c.userId);
      if (!existing || c.distanceKm < existing.distanceKm) {
        byUserId.set(c.userId, { profileId: c.profileId, distanceKm: c.distanceKm });
      }
    }

    const enriched: Array<{
      user: ReturnType<typeof sanitizeUserForPublic>;
      profile: Doc<'walkerProfiles'>;
      distanceKm: number;
    }> = [];

    // PERFORMANCE: Batch fetch users and profiles to avoid N+1 queries
    const entries = Array.from(byUserId.entries());
    const userIds = entries.map(([userId]) => userId);
    const profileIds = entries.map(([, entry]) => entry.profileId);

    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const profiles = await Promise.all(profileIds.map((id) => ctx.db.get(id)));

    for (let i = 0; i < entries.length; i++) {
      const [userId, entry] = entries[i];
      const user = users[i];
      const profile = profiles[i];

      if (
        !user ||
        user.isDeleted ||
        user.userType !== 'walker' ||
        user.walkerVerificationStatus !== 'approved'
      ) {
        continue;
      }
      // Only show walkers with active Stripe Connect
      if (user.stripeConnectStatus !== 'active') {
        continue;
      }
      if (!profile || !profile.isVisible) continue;
      enriched.push({ user: sanitizeUserForPublic(user), profile, distanceKm: entry.distanceKm });
    }

    enriched.sort((a, b) => a.distanceKm - b.distanceKm);
    return enriched.slice(0, limit);
  },
});

// One-time migration: Fix walker profiles missing location by deriving from serviceAreas
export const fixMissingLocations = mutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query('walkerProfiles').collect();
    let fixed = 0;

    for (const profile of profiles) {
      // Skip if already has location
      if (profile.location && profile.geohash) continue;

      // Try to derive location from serviceAreas
      if (profile.serviceAreas.length > 0) {
        const coords = getFirstMatchingCoordinates(profile.serviceAreas);
        if (coords) {
          const geohash = encodeGeohash(coords.lat, coords.lng, 6);
          await ctx.db.patch(profile._id, {
            location: { ...coords, geohash },
            geohash,
            updatedAt: Date.now(),
          });
          fixed++;
        }
      }
    }

    return { fixed, total: profiles.length };
  },
});
