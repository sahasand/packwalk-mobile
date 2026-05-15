import { internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireOwner, requireUser, requireWalker } from './lib/guards';
import { packwalkError } from './lib/errors';
import { encodeGeohash } from './lib/geohash';
import { rateLimit } from './lib/rateLimit';
import type { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';

const locationArgs = v.object({
  lat: v.number(),
  lng: v.number(),
  addressLine1: v.optional(v.string()),
  notes: v.optional(v.string()),
});

function addStatusHistory<T extends { statusHistory: Array<any> }>(
  doc: T,
  status: string,
  actor: string,
  timestamp: number,
) {
  return [...doc.statusHistory, { status, actor, timestamp }];
}

async function acceptCore(
  ctx: any,
  request: Doc<'walkRequests'>,
  walker: Doc<'users'>,
  now: number,
) {
  const totalPrice = request.quotedPrice;
  const platformFee = Math.round(totalPrice * request.platformFeePercent);
  const walkerShare = totalPrice - platformFee;

  const walkId: Id<'walks'> = await ctx.db.insert('walks', {
    ownerId: request.ownerId,
    walkerId: request.walkerId,
    dogIds: request.dogIds,
    requestId: request._id,
    status: 'scheduled',
    scheduledTime: request.scheduledTime,
    startedAt: undefined,
    completedAt: undefined,
    pickupLocationSnapshot: request.pickupLocation,
    lastLocation: undefined,
    distanceMeters: undefined,
    totalPrice,
    walkerShare,
    platformFee,
    currency: request.currency,
    stripePaymentIntentId: request.stripePaymentIntentId,
    stripeChargeId: undefined,
    stripeRefundId: undefined,
    refundStatus: 'none',
    donationAggregated: false,
    disputeHoldUntil: undefined,
    statusHistory: [
      {
        status: 'scheduled',
        actor: walker._id.toString(),
        timestamp: now,
      },
    ],
    sensitiveNotes: undefined,
    sensitiveNotesIv: undefined,
    sensitiveNotesKeyVersion: undefined,
    sensitiveNotesExpiresAt: undefined,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.patch(request._id, {
    status: 'accepted',
    statusHistory: addStatusHistory(request, 'accepted', walker._id.toString(), now),
    updatedAt: now,
  });

  await ctx.runMutation(internal.notifications.createNotification, {
    userId: request.ownerId,
    type: 'walk_update',
    data: { subtype: 'accepted', requestId: request._id, walkId },
    options: { push: true, email: true, emailSubject: 'Your walk request was accepted!', emailHtml: '<h1>Walk Confirmed!</h1><p>Your walker has accepted your walk request. Get ready!</p>' },
  });

  return walkId;
}

export const create = mutation({
  args: {
    walkerId: v.id('users'),
    dogIds: v.array(v.id('dogs')),
    scheduledTime: v.number(),
    durationMinutes: v.number(),
    pickupLocation: locationArgs,
    message: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    requireOwner(owner);
    if (args.dogIds.length === 0) {
      packwalkError('validation/error', 'At least one dog is required');
    }

    await rateLimit(ctx, owner._id.toString(), 'walkRequests:create', 10, 60 * 60);

    const walker = await ctx.db.get(args.walkerId);
    if (
      !walker ||
      walker.isDeleted ||
      walker.userType !== 'walker' ||
      walker.walkerVerificationStatus !== 'approved'
    ) {
      packwalkError('validation/error', 'Walker not available');
    }

    const walkerProfile = await ctx.db
      .query('walkerProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', walker._id))
      .first();
    if (!walkerProfile || !walkerProfile.isVisible) {
      packwalkError('validation/error', 'Walker not available');
    }

    for (const dogId of args.dogIds) {
      const dog = await ctx.db.get(dogId);
      if (!dog || dog.isDeleted || dog.ownerId !== owner._id || !dog.isActive) {
        packwalkError('validation/error', 'Invalid dog selection');
      }
    }

    const now = Date.now();
    if (args.scheduledTime < now) {
      packwalkError('validation/error', 'Scheduled time must be in the future');
    }
    if (args.durationMinutes <= 0) {
      packwalkError('validation/error', 'Duration must be positive');
    }
    const geohash = encodeGeohash(args.pickupLocation.lat, args.pickupLocation.lng, 6);

    // hourlyRate is stored in cents (e.g., 2500 = $25/hour)
    // Calculate price in cents: (hourlyRateCents * minutes) / 60
    const quotedPrice = Math.round(
      (walkerProfile.hourlyRate * args.durationMinutes) / 60,
    );
    const platformFeePercent = 0.2;

    const requestId: Id<'walkRequests'> = await ctx.db.insert('walkRequests', {
      ownerId: owner._id,
      walkerId: walker._id,
      dogIds: args.dogIds,
      scheduledTime: args.scheduledTime,
      durationMinutes: args.durationMinutes,
      pickupLocation: {
        ...args.pickupLocation,
        geohash,
      },
      status: 'pending',
      expiresAt: now + 24 * 60 * 60 * 1000,
      quotedPrice,
      currency: args.currency ?? 'cad',
      platformFeePercent,
      stripePaymentIntentId: undefined,
      stripeIdempotencyKey: undefined,
      message: args.message,
      statusHistory: [
        {
          status: 'pending',
          actor: owner._id.toString(),
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.notifications.createNotification, {
      userId: walker._id,
      type: 'walk_request',
      data: { subtype: 'new', requestId },
      options: { push: true, email: false },
    });

    return requestId;
  },
});

export const listMine = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('accepted'),
        v.literal('declined'),
        v.literal('expired'),
        v.literal('cancelled'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    requireOwner(owner);

    if (args.status) {
      return ctx.db
        .query('walkRequests')
        .withIndex('by_ownerId_status', (q) =>
          q.eq('ownerId', owner._id).eq('status', args.status!),
        )
        .collect();
    }

    return ctx.db
      .query('walkRequests')
      .withIndex('by_ownerId', (q) => q.eq('ownerId', owner._id))
      .collect();
  },
});

export const listForWalker = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('accepted'),
        v.literal('declined'),
        v.literal('expired'),
        v.literal('cancelled'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const walker = await requireUser(ctx);
    requireWalker(walker);

    if (args.status) {
      return ctx.db
        .query('walkRequests')
        .withIndex('by_walkerId_status', (q) =>
          q.eq('walkerId', walker._id).eq('status', args.status!),
        )
        .collect();
    }

    return ctx.db
      .query('walkRequests')
      .withIndex('by_walkerId_status', (q) =>
        q.eq('walkerId', walker._id).eq('status', 'pending'),
      )
      .collect();
  },
});

export const listForWalkerEnriched = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('accepted'),
        v.literal('declined'),
        v.literal('expired'),
        v.literal('cancelled'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const walker = await requireUser(ctx);
    requireWalker(walker);

    let requests: Doc<'walkRequests'>[];
    if (args.status) {
      requests = await ctx.db
        .query('walkRequests')
        .withIndex('by_walkerId_status', (q) =>
          q.eq('walkerId', walker._id).eq('status', args.status!),
        )
        .collect();
    } else {
      requests = await ctx.db
        .query('walkRequests')
        .withIndex('by_walkerId_status', (q) =>
          q.eq('walkerId', walker._id).eq('status', 'pending'),
        )
        .collect();
    }

    // Enrich with owner info and dog names
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const owner = await ctx.db.get(request.ownerId);
        const dogs = await Promise.all(
          request.dogIds.map((dogId) => ctx.db.get(dogId)),
        );
        const dogNames = dogs
          .filter((d): d is Doc<'dogs'> => d !== null && !d.isDeleted)
          .map((d) => d.name);

        return {
          ...request,
          owner: owner
            ? { name: owner.name, avatarUrl: owner.avatarUrl }
            : { name: 'Unknown', avatarUrl: undefined },
          dogNames,
        };
      }),
    );

    return enrichedRequests;
  },
});

export const getById = query({
  args: {
    requestId: v.id('walkRequests'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      packwalkError('validation/error', 'Request not found');
    }
    if (request.ownerId !== user._id && request.walkerId !== user._id) {
      packwalkError('auth/forbidden', 'Not allowed');
    }
    return request;
  },
});

export const cancel = mutation({
  args: { requestId: v.id('walkRequests') },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    requireOwner(owner);
    const request = await ctx.db.get(args.requestId);
    if (!request || request.ownerId !== owner._id) {
      packwalkError('validation/error', 'Request not found');
    }
    if (request.status !== 'pending') {
      packwalkError('state/invalid_transition', 'Only pending requests can be cancelled');
    }

    const now = Date.now();
    await ctx.db.patch(request._id, {
      status: 'cancelled',
      statusHistory: addStatusHistory(request, 'cancelled', owner._id.toString(), now),
      updatedAt: now,
    });

    // Cancel associated PaymentIntent to release authorization hold
    if (request.stripePaymentIntentId) {
      await ctx.scheduler.runAfter(0, internal.payments.cancelPaymentIntent, {
        paymentIntentId: request.stripePaymentIntentId,
      });
    }

    await ctx.runMutation(internal.notifications.createNotification, {
      userId: request.walkerId,
      type: 'walk_update',
      data: { subtype: 'cancelled', requestId: request._id },
      options: { push: true, email: false },
    });

    return request._id;
  },
});

export const decline = mutation({
  args: {
    requestId: v.id('walkRequests'),
  },
  handler: async (ctx, args) => {
    const walker = await requireUser(ctx);
    requireWalker(walker);
    if (walker.walkerVerificationStatus !== 'approved') {
      packwalkError('auth/forbidden', 'Walker not approved');
    }

    const request = await ctx.db.get(args.requestId);
    if (!request || request.walkerId !== walker._id) {
      packwalkError('validation/error', 'Request not found');
    }
    if (request.status !== 'pending') {
      packwalkError('state/invalid_transition', 'Only pending requests can be declined');
    }

    const now = Date.now();
    await ctx.db.patch(request._id, {
      status: 'declined',
      statusHistory: addStatusHistory(request, 'declined', walker._id.toString(), now),
      updatedAt: now,
    });

    // Cancel associated PaymentIntent to release authorization hold
    if (request.stripePaymentIntentId) {
      await ctx.scheduler.runAfter(0, internal.payments.cancelPaymentIntent, {
        paymentIntentId: request.stripePaymentIntentId,
      });
    }

    return request._id;
  },
});

export const accept = internalMutation({
  args: { requestId: v.id('walkRequests') },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      packwalkError('validation/error', 'Request not found');
    }
    if (request.status !== 'pending') {
      packwalkError('state/invalid_transition', 'Only pending requests can be accepted');
    }
    if (request.expiresAt < Date.now()) {
      packwalkError('state/invalid_transition', 'Request expired');
    }
    const walker = await ctx.db.get(request.walkerId);
    if (!walker || walker.userType !== 'walker') {
      packwalkError('validation/error', 'Walker not found');
    }
    if (walker.walkerVerificationStatus !== 'approved') {
      packwalkError('auth/forbidden', 'Walker not approved');
    }
    const now = Date.now();
    return acceptCore(ctx, request, walker, now);
  },
});

export const expireStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query('walkRequests')
      .withIndex('by_expiresAt', (q) => q.lt('expiresAt', now))
      .filter((f) => f.eq(f.field('status'), 'pending'))
      .take(100);

    for (const req of stale) {
      await ctx.db.patch(req._id, {
        status: 'expired',
        statusHistory: addStatusHistory(req, 'expired', 'system', now),
        updatedAt: now,
      });

      // Cancel associated PaymentIntent to release authorization hold
      if (req.stripePaymentIntentId) {
        await ctx.scheduler.runAfter(0, internal.payments.cancelPaymentIntent, {
          paymentIntentId: req.stripePaymentIntentId,
        });
      }
    }

    return stale.length;
  },
});
