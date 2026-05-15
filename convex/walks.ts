import { internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireOwner, requireUser, requireWalker } from './lib/guards';
import { packwalkError } from './lib/errors';
import { rateLimit } from './lib/rateLimit';
import { haversineDistanceKm } from './lib/geo';
import { signWalkToken } from './lib/walkToken';
import type { Doc } from './_generated/dataModel';
import { internal } from './_generated/api';

const locationPointArgs = v.object({
  lat: v.number(),
  lng: v.number(),
  timestamp: v.number(),
  accuracy: v.optional(v.number()),
});

type LastLocation = {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
};

function addStatusHistory(
  doc: Doc<'walks'>,
  status: string,
  actor: string,
  timestamp: number,
) {
  return [...doc.statusHistory, { status, actor, timestamp }];
}

export const listMineOwner = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('scheduled'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('cancelled'),
        v.literal('no_show'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    requireOwner(owner);

    const status = args.status ?? 'scheduled';

    // Use new index with scheduledTime for sorting, limit to 20
    return ctx.db
      .query('walks')
      .withIndex('by_ownerId_status_scheduledTime', (q) =>
        q.eq('ownerId', owner._id).eq('status', status),
      )
      .order('desc')
      .take(20);
  },
});

export const listMineOwnerEnriched = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('scheduled'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('cancelled'),
        v.literal('no_show'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    requireOwner(owner);

    const status = args.status ?? 'scheduled';

    // Use new index with scheduledTime for sorting, limit to 20
    const walks = await ctx.db
      .query('walks')
      .withIndex('by_ownerId_status_scheduledTime', (q) =>
        q.eq('ownerId', owner._id).eq('status', status),
      )
      .order('desc')
      .take(20);

    // Batch fetch all unique walker IDs
    const walkerIds = [...new Set(walks.map((w) => w.walkerId))];
    const walkers = await Promise.all(walkerIds.map((id) => ctx.db.get(id)));
    const walkerMap = new Map(
      walkers.filter(Boolean).map((w) => [w!._id, w!]),
    );

    // Batch fetch reviews for all walks to check if reviewed
    const reviews = await Promise.all(
      walks.map((walk) =>
        ctx.db
          .query('reviews')
          .withIndex('by_walkId', (q) => q.eq('walkId', walk._id))
          .first(),
      ),
    );
    const reviewMap = new Map(
      walks.map((walk, i) => [walk._id, reviews[i] !== null]),
    );

    // Enrich walks with walker data and review status
    return walks.map((walk) => {
      const walker = walkerMap.get(walk.walkerId);
      return {
        ...walk,
        walkerName: walker?.name ?? 'Walker',
        walkerAvatar: walker?.avatarUrl,
        hasReview: reviewMap.get(walk._id) ?? false,
      };
    });
  },
});

export const listMineWalker = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('scheduled'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('cancelled'),
        v.literal('no_show'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const walker = await requireUser(ctx);
    requireWalker(walker);

    if (args.status) {
      return ctx.db
        .query('walks')
        .withIndex('by_walkerId_status', (q) =>
          q.eq('walkerId', walker._id).eq('status', args.status!),
        )
        .collect();
    }

    return ctx.db
      .query('walks')
      .withIndex('by_walkerId_status', (q) =>
        q.eq('walkerId', walker._id).eq('status', 'scheduled'),
      )
      .collect();
  },
});

export const listMineWalkerEnriched = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('scheduled'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('cancelled'),
        v.literal('no_show'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const walker = await requireUser(ctx);
    requireWalker(walker);

    const walks = args.status
      ? await ctx.db
          .query('walks')
          .withIndex('by_walkerId_status', (q) =>
            q.eq('walkerId', walker._id).eq('status', args.status!),
          )
          .collect()
      : await ctx.db
          .query('walks')
          .withIndex('by_walkerId_status', (q) =>
            q.eq('walkerId', walker._id).eq('status', 'scheduled'),
          )
          .collect();

    // Enrich with owner and dog data
    const enriched = await Promise.all(
      walks.map(async (walk) => {
        const owner = await ctx.db.get(walk.ownerId);
        const dogs = await Promise.all(walk.dogIds.map((id) => ctx.db.get(id)));

        return {
          ...walk,
          ownerName: owner?.name ?? 'Owner',
          ownerAvatar: owner?.avatarFileId,
          dogNames: dogs.filter(Boolean).map((d) => d!.name),
        };
      }),
    );

    return enriched;
  },
});

export const listByDateRange = query({
  args: {
    startTimestamp: v.number(),
    endTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const walker = await requireUser(ctx);
    requireWalker(walker);

    // Get all walks for this walker in the date range
    const walks = await ctx.db
      .query('walks')
      .withIndex('by_walkerId_status', (q) => q.eq('walkerId', walker._id))
      .filter((f) =>
        f.and(
          f.gte(f.field('scheduledTime'), args.startTimestamp),
          f.lte(f.field('scheduledTime'), args.endTimestamp),
          f.or(
            f.eq(f.field('status'), 'scheduled'),
            f.eq(f.field('status'), 'in_progress'),
            f.eq(f.field('status'), 'completed'),
          ),
        ),
      )
      .collect();

    // Enrich with owner and dog data
    const enriched = await Promise.all(
      walks.map(async (walk) => {
        const owner = await ctx.db.get(walk.ownerId);
        const dogs = await Promise.all(walk.dogIds.map((id) => ctx.db.get(id)));

        return {
          ...walk,
          ownerName: owner?.name ?? 'Owner',
          ownerAvatar: owner?.avatarUrl,
          dogNames: dogs.filter(Boolean).map((d) => d!.name),
        };
      }),
    );

    return enriched;
  },
});

export const getById = query({
  args: {
    walkId: v.id('walks'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const walk = await ctx.db.get(args.walkId);
    if (!walk) {
      packwalkError('validation/error', 'Walk not found');
    }
    if (walk.ownerId !== user._id && walk.walkerId !== user._id) {
      packwalkError('auth/forbidden', 'Not allowed');
    }
    return walk;
  },
});

export const start = mutation({
  args: {
    walkId: v.id('walks'),
  },
  handler: async (ctx, args) => {
    const walker = await requireUser(ctx);
    requireWalker(walker);

    const walk = await ctx.db.get(args.walkId);
    if (!walk || walk.walkerId !== walker._id) {
      packwalkError('validation/error', 'Walk not found');
    }
    if (walk.status !== 'scheduled') {
      packwalkError('state/invalid_transition', 'Walk not scheduled');
    }

    const now = Date.now();
    await ctx.db.patch(walk._id, {
      status: 'in_progress',
      startedAt: now,
      statusHistory: addStatusHistory(walk, 'in_progress', walker._id.toString(), now),
      updatedAt: now,
    });

    await ctx.runMutation(internal.notifications.createNotification, {
      userId: walk.ownerId,
      type: 'walk_update',
      data: { subtype: 'starting', walkId: walk._id },
      options: { push: true, email: false },
    });

    // Walk-scoped token for the background /location/batch endpoint. Decouples
    // GPS uploads from the walker's ID-token lifetime so long walks don't lose
    // location data when the ~1h OAuth token expires.
    const locationToken = await signWalkToken({
      walkId: walk._id,
      walkerId: walker._id,
    });

    return { walkId: walk._id, locationToken };
  },
});

export const complete = mutation({
  args: {
    walkId: v.id('walks'),
  },
  handler: async (ctx, args) => {
    const walker = await requireUser(ctx);
    requireWalker(walker);

    const walk = await ctx.db.get(args.walkId);
    if (!walk || walk.walkerId !== walker._id) {
      packwalkError('validation/error', 'Walk not found');
    }
    if (walk.status !== 'in_progress') {
      packwalkError('state/invalid_transition', 'Walk not in progress');
    }

    const now = Date.now();
    await ctx.db.patch(walk._id, {
      status: 'completed',
      completedAt: now,
      disputeHoldUntil: now + 7 * 24 * 60 * 60 * 1000,
      statusHistory: addStatusHistory(walk, 'completed', walker._id.toString(), now),
      updatedAt: now,
    });

    const existingEarning = await ctx.db
      .query('earnings')
      .withIndex('by_walkerId_type', (q) =>
        q.eq('walkerId', walk.walkerId).eq('type', 'walk'),
      )
      .filter((f) => f.eq(f.field('sourceId'), walk._id))
      .first();

    if (!existingEarning) {
      await ctx.db.insert('earnings', {
        walkerId: walk.walkerId,
        type: 'walk',
        sourceId: walk._id,
        amount: walk.walkerShare,
        currency: walk.currency,
        status: 'ready_for_payout',
        stripeTransferId: undefined,
        stripeIdempotencyKey: `earnings:${walk._id}:walk`,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.runMutation(internal.notifications.createNotification, {
      userId: walk.ownerId,
      type: 'walk_update',
      data: { subtype: 'completed', walkId: walk._id },
      options: { push: true, email: false },
    });

    await ctx.runMutation(internal.notifications.createNotification, {
      userId: walk.walkerId,
      type: 'payout_update',
      data: { subtype: 'ready', walkId: walk._id },
      options: { push: true, email: false },
    });

    return walk._id;
  },
});

export const cancel = internalMutation({
  args: {
    walkId: v.id('walks'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const walk = await ctx.db.get(args.walkId);
    if (!walk) {
      packwalkError('validation/error', 'Walk not found');
    }

    const isOwner = user._id === walk.ownerId;
    const isWalker = user._id === walk.walkerId;
    if (!isOwner && !isWalker) {
      packwalkError('auth/forbidden', 'Not allowed');
    }
    if (walk.status !== 'scheduled' && walk.status !== 'in_progress') {
      packwalkError('state/invalid_transition', 'Walk cannot be cancelled');
    }

    const now = Date.now();
    await ctx.db.patch(walk._id, {
      status: 'cancelled',
      statusHistory: addStatusHistory(walk, 'cancelled', user._id.toString(), now),
      updatedAt: now,
    });

    const otherId = isOwner ? walk.walkerId : walk.ownerId;
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: otherId,
      type: 'walk_update',
      data: { subtype: 'cancelled', walkId: walk._id },
      options: { push: true, email: false },
    });
    return walk._id;
  },
});

function validatePoint(
  point: { lat: number; lng: number; timestamp: number; accuracy?: number },
  previous?: { lat: number; lng: number; timestamp: number },
) {
  const now = Date.now();

  // Check accuracy - reject approximate/low accuracy locations
  if (point.accuracy !== undefined && point.accuracy > 100) {
    packwalkError(
      'validation/error',
      `Location accuracy too low (${Math.round(point.accuracy)}m). GPS signal may be weak or approximate location is enabled.`,
    );
  }

  // Check for future timestamps (device clock ahead)
  if (point.timestamp > now + 60 * 1000) {
    const aheadSeconds = Math.round((point.timestamp - now) / 1000);
    packwalkError(
      'validation/error',
      `Location timestamp is ${aheadSeconds}s in the future. Check device clock settings.`,
    );
  }

  // Check for stale timestamps (device clock behind or delayed location)
  if (now - point.timestamp > 5 * 60 * 1000) {
    const staleSeconds = Math.round((now - point.timestamp) / 1000);
    packwalkError(
      'validation/error',
      `Location timestamp is ${staleSeconds}s too old. Location data may be stale.`,
    );
  }

  // Check for impossible jumps (GPS glitch or spoofing)
  if (previous) {
    const distanceKm = haversineDistanceKm(
      previous.lat,
      previous.lng,
      point.lat,
      point.lng,
    );
    if (distanceKm > 50) {
      packwalkError(
        'validation/error',
        `Location jump too large (${Math.round(distanceKm)}km). GPS may have glitched.`,
      );
    }
  }
}

export const appendLocation = mutation({
  args: {
    walkId: v.id('walks'),
    point: locationPointArgs,
  },
  handler: async (ctx, args) => {
    const walker = await requireUser(ctx);
    requireWalker(walker);

    const walk = await ctx.db.get(args.walkId);
    if (!walk || walk.walkerId !== walker._id) {
      packwalkError('validation/error', 'Walk not found');
    }
    if (walk.status !== 'in_progress') {
      packwalkError('state/invalid_transition', 'Walk not in progress');
    }

    await rateLimit(
      ctx,
      walker._id.toString(),
      `walks:appendLocation:${walk._id}`,
      1,
      10,
    );

    validatePoint(args.point, walk.lastLocation ?? undefined);

    const now = Date.now();
    await ctx.db.insert('walkLocations', {
      walkId: walk._id,
      lat: args.point.lat,
      lng: args.point.lng,
      timestamp: args.point.timestamp,
      accuracy: args.point.accuracy,
      createdAt: now,
    });

    let distanceMeters = walk.distanceMeters ?? 0;
    if (walk.lastLocation) {
      const deltaKm = haversineDistanceKm(
        walk.lastLocation.lat,
        walk.lastLocation.lng,
        args.point.lat,
        args.point.lng,
      );
      distanceMeters += Math.round(deltaKm * 1000);
    }

    await ctx.db.patch(walk._id, {
      lastLocation: {
        lat: args.point.lat,
        lng: args.point.lng,
        timestamp: args.point.timestamp,
        accuracy: args.point.accuracy,
      },
      distanceMeters,
      updatedAt: now,
    });

    return args.point.timestamp;
  },
});

// Identity-auth wrapper for foreground callers. The HTTP /location/batch
// endpoint authenticates via a walk-scoped HMAC token instead and calls
// appendLocationsBatchInternal directly.
export const appendLocationsBatch = mutation({
  args: {
    walkId: v.id('walks'),
    points: v.array(locationPointArgs),
  },
  handler: async (ctx, args) => {
    const walker = await requireUser(ctx);
    requireWalker(walker);
    return await appendLocationsBatchImpl(ctx, {
      walkId: args.walkId,
      walkerId: walker._id,
      points: args.points,
    });
  },
});

// Token-authenticated batch insert. Caller (the HTTP endpoint) has already
// verified the walk-scoped HMAC token and extracted walkerId from it. This
// mutation re-checks walk ownership and status as defense-in-depth in case
// the token was issued for a walk that has since been cancelled.
export const appendLocationsBatchFromToken = internalMutation({
  args: {
    walkId: v.id('walks'),
    walkerId: v.id('users'),
    points: v.array(locationPointArgs),
  },
  handler: async (ctx, args) => {
    return await appendLocationsBatchImpl(ctx, args);
  },
});

async function appendLocationsBatchImpl(
  ctx: { db: any },
  args: {
    walkId: Doc<'walks'>['_id'];
    walkerId: Doc<'users'>['_id'];
    points: Array<{ lat: number; lng: number; timestamp: number; accuracy?: number }>;
  },
) {
  const walk = await ctx.db.get(args.walkId);
  if (!walk || walk.walkerId !== args.walkerId) {
    packwalkError('validation/error', 'Walk not found');
  }
  if (walk.status !== 'in_progress') {
    packwalkError('state/invalid_transition', 'Walk not in progress');
  }

  // Defense-in-depth: HTTP endpoint enforces 50-point limit, but truncate here too
  const points = args.points.slice(0, 50);
  if (points.length === 0) return 0;

  const last = await ctx.db
    .query('walkLocations')
    .withIndex('by_walkId_timestamp', (q: any) => q.eq('walkId', walk._id))
    .order('desc')
    .first();

  let lastLocation: LastLocation | undefined =
    walk.lastLocation ??
    (last
      ? {
          lat: last.lat,
          lng: last.lng,
          timestamp: last.timestamp,
          accuracy: last.accuracy ?? undefined,
        }
      : undefined);
  let distanceMeters = walk.distanceMeters ?? 0;
  const now = Date.now();

  for (const point of points) {
    validatePoint(point, lastLocation ?? undefined);

    await ctx.db.insert('walkLocations', {
      walkId: walk._id,
      lat: point.lat,
      lng: point.lng,
      timestamp: point.timestamp,
      accuracy: point.accuracy,
      createdAt: now,
    });

    if (lastLocation) {
      const deltaKm = haversineDistanceKm(
        lastLocation.lat,
        lastLocation.lng,
        point.lat,
        point.lng,
      );
      distanceMeters += Math.round(deltaKm * 1000);
    }

    lastLocation = {
      lat: point.lat,
      lng: point.lng,
      timestamp: point.timestamp,
      accuracy: point.accuracy,
    };
  }

  if (lastLocation) {
    await ctx.db.patch(walk._id, {
      lastLocation,
      distanceMeters,
      updatedAt: now,
    });
  }

  return points.length;
}

export const updateStripeChargeId = internalMutation({
  args: {
    walkId: v.id('walks'),
    stripeChargeId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.walkId, {
      stripeChargeId: args.stripeChargeId,
      updatedAt: Date.now(),
    });
  },
});

export const markNoShows = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - 30 * 60 * 1000;
    const overdue = await ctx.db
      .query('walks')
      .withIndex('by_scheduledTime', (q) => q.lt('scheduledTime', cutoff))
      .filter((f) => f.eq(f.field('status'), 'scheduled'))
      .take(100);

    for (const walk of overdue) {
      await ctx.db.patch(walk._id, {
        status: 'no_show',
        statusHistory: addStatusHistory(walk, 'no_show', 'system', now),
        updatedAt: now,
      });

      // Cancel associated PaymentIntent to release authorization hold
      if (walk.stripePaymentIntentId) {
        await ctx.scheduler.runAfter(0, internal.payments.cancelPaymentIntent, {
          paymentIntentId: walk.stripePaymentIntentId,
        });
      }

      await ctx.runMutation(internal.notifications.createNotification, {
        userId: walk.ownerId,
        type: 'walk_update',
        data: { subtype: 'no_show', walkId: walk._id },
        options: { push: true, email: false },
      });
    }

    return overdue.length;
  },
});
