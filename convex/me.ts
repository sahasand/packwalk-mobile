import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireUser } from './lib/guards';
import { encodeGeohash } from './lib/geohash';

export const getImpact = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Get all completed walks for this owner
    const completedWalks = await ctx.db
      .query('walks')
      .withIndex('by_ownerId_status', (q) =>
        q.eq('ownerId', user._id).eq('status', 'completed'),
      )
      .collect();

    // Sum platform fees from walks (the 20% donation)
    const walkDonations = completedWalks.reduce(
      (sum, walk) => sum + (walk.platformFee || 0),
      0,
    );

    // Get all reviews with succeeded tips from this owner
    const reviews = await ctx.db
      .query('reviews')
      .withIndex('by_ownerId', (q) => q.eq('ownerId', user._id))
      .collect();

    // Sum tip platform fees (20% of tips that succeeded)
    const tipDonations = reviews.reduce((sum, review) => {
      if (review.tipStatus === 'succeeded' && review.tipPlatformFee) {
        return sum + review.tipPlatformFee;
      }
      return sum;
    }, 0);

    // Total donated = walk fees + tip fees
    const totalDonated = walkDonations + tipDonations;

    // Count walks that contributed
    const walksCount = completedWalks.length;

    // Calculate total hours walked (assuming durationMinutes or calculating from times)
    const totalMinutes = completedWalks.reduce((sum, walk) => {
      if (walk.startedAt && walk.completedAt) {
        return sum + (walk.completedAt - walk.startedAt) / 60000;
      }
      return sum;
    }, 0);

    return {
      totalDonated, // in cents (walk fees + tip fees)
      walksCount,
      totalMinutes: Math.round(totalMinutes),
      currency: 'CAD',
    };
  },
});

const locationArgs = v.object({
  lat: v.number(),
  lng: v.number(),
  addressLine1: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const dogs =
      user.userType === 'owner'
        ? await ctx.db
            .query('dogs')
            .withIndex('by_ownerId_isDeleted', (q) =>
              q.eq('ownerId', user._id).eq('isDeleted', false),
            )
            .collect()
        : [];

    const walkerProfile =
      user.userType === 'walker'
        ? await ctx.db
            .query('walkerProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', user._id))
            .first()
        : null;

    return { user, dogs, walkerProfile };
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatarFileId: v.optional(v.id('_storage')),
    avatarUrl: v.optional(v.string()),
    timezone: v.optional(v.string()),
    defaultLocation: v.optional(locationArgs),
    addPushToken: v.optional(v.string()),
    removePushToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const updates: Partial<typeof user> = { updatedAt: now };

    if (args.name) updates.name = args.name;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.avatarFileId !== undefined) updates.avatarFileId = args.avatarFileId;
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;
    if (args.timezone) updates.timezone = args.timezone;

    if (args.defaultLocation) {
      const geohash = encodeGeohash(args.defaultLocation.lat, args.defaultLocation.lng, 6);
      updates.defaultLocation = {
        ...args.defaultLocation,
        geohash,
      };
    }

    let pushTokens = user.pushTokens ?? [];
    if (args.addPushToken) {
      if (!pushTokens.includes(args.addPushToken)) {
        pushTokens = [...pushTokens, args.addPushToken];
      }
    }
    if (args.removePushToken) {
      pushTokens = pushTokens.filter((t) => t !== args.removePushToken);
    }
    if (pushTokens !== user.pushTokens) {
      updates.pushTokens = pushTokens;
    }

    await ctx.db.patch(user._id, updates);

    return user._id;
  },
});

