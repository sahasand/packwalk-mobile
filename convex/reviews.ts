import { internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireOwner, requireUser } from './lib/guards';
import { packwalkError } from './lib/errors';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

// Helper to recalculate and update walker's avgRating and reviewCount
async function updateWalkerStats(ctx: MutationCtx, walkerId: Id<'users'>) {
  // Get all reviews for this walker
  const reviews = await ctx.db
    .query('reviews')
    .withIndex('by_walkerId', (q) => q.eq('walkerId', walkerId))
    .collect();

  const reviewCount = reviews.length;
  const avgRating = reviewCount > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
    : 0;

  // Find walker's profile
  const profile = await ctx.db
    .query('walkerProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', walkerId))
    .first();

  if (profile) {
    await ctx.db.patch(profile._id, {
      avgRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
      reviewCount,
      updatedAt: Date.now(),
    });
  }
}

// Rating must be 1-5 stars
const ratingValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
  v.literal(5),
);

export const create = mutation({
  args: {
    walkId: v.id('walks'),
    rating: ratingValidator,
    comment: v.optional(v.string()),
    tipAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    requireOwner(owner);

    const walk = await ctx.db.get(args.walkId);
    if (!walk || walk.ownerId !== owner._id || walk.status !== 'completed') {
      packwalkError('validation/error', 'Walk not eligible for review');
    }

    const existing = await ctx.db
      .query('reviews')
      .withIndex('by_walkId', (q) => q.eq('walkId', walk._id))
      .first();
    if (existing) {
      packwalkError('state/invalid_transition', 'Review already exists');
    }

    const now = Date.now();
    const reviewId = await ctx.db.insert('reviews', {
      walkId: walk._id,
      ownerId: owner._id,
      walkerId: walk.walkerId,
      rating: args.rating,
      comment: args.comment,
      tipAmount: args.tipAmount,
      currency: walk.currency,
      tipPaymentIntentId: undefined,
      tipStatus: 'none',
      createdAt: now,
    });

    // Update walker's avgRating and reviewCount
    await updateWalkerStats(ctx, walk.walkerId);

    return reviewId;
  },
});

export const getByWalkId = query({
  args: { walkId: v.id('walks') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const walk = await ctx.db.get(args.walkId);
    if (!walk || (walk.ownerId !== user._id && walk.walkerId !== user._id)) {
      packwalkError('auth/forbidden', 'Not allowed');
    }
    return ctx.db
      .query('reviews')
      .withIndex('by_walkId', (q) => q.eq('walkId', args.walkId))
      .first();
  },
});

export const listByWalker = query({
  args: {
    walkerId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Public query - anyone can view a walker's reviews
    const reviews = await ctx.db
      .query('reviews')
      .withIndex('by_walkerId', (q) => q.eq('walkerId', args.walkerId))
      .order('desc')
      .take(args.limit ?? 10);

    // Enrich with owner first name for display
    const enriched = await Promise.all(
      reviews.map(async (review) => {
        const owner = await ctx.db.get(review.ownerId);
        // Get first name only for privacy
        const ownerFirstName = owner?.name
          ? owner.name.split(' ')[0]
          : 'Anonymous';
        return {
          ...review,
          ownerFirstName,
        };
      }),
    );

    return enriched;
  },
});

export const createPendingTip = internalMutation({
  args: {
    walkId: v.id('walks'),
    ownerId: v.id('users'),
    walkerId: v.id('users'),
    rating: ratingValidator,
    comment: v.optional(v.string()),
    tipAmount: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('reviews')
      .withIndex('by_walkId', (q) => q.eq('walkId', args.walkId))
      .first();
    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return ctx.db.insert('reviews', {
      walkId: args.walkId,
      ownerId: args.ownerId,
      walkerId: args.walkerId,
      rating: args.rating,
      comment: args.comment,
      tipAmount: args.tipAmount,
      currency: args.currency,
      tipPaymentIntentId: undefined,
      tipStatus: 'pending',
      createdAt: now,
    });
  },
});

export const attachTipIntent = internalMutation({
  args: {
    reviewId: v.id('reviews'),
    tipPaymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reviewId, {
      tipPaymentIntentId: args.tipPaymentIntentId,
      tipStatus: 'pending',
    });
  },
});

// Create review with tip intent already attached (used after PaymentIntent succeeds)
// This prevents orphaned reviews if payment creation fails
export const createWithTipIntent = internalMutation({
  args: {
    walkId: v.id('walks'),
    ownerId: v.id('users'),
    walkerId: v.id('users'),
    rating: ratingValidator,
    comment: v.optional(v.string()),
    tipAmount: v.number(),
    tipPlatformFee: v.number(),
    currency: v.string(),
    tipPaymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    // Double-check no existing review (idempotency)
    const existing = await ctx.db
      .query('reviews')
      .withIndex('by_walkId', (q) => q.eq('walkId', args.walkId))
      .first();
    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const reviewId = await ctx.db.insert('reviews', {
      walkId: args.walkId,
      ownerId: args.ownerId,
      walkerId: args.walkerId,
      rating: args.rating,
      comment: args.comment,
      tipAmount: args.tipAmount,
      tipPlatformFee: args.tipPlatformFee,
      currency: args.currency,
      tipPaymentIntentId: args.tipPaymentIntentId,
      tipStatus: 'pending',
      createdAt: now,
    });

    // Update walker's avgRating and reviewCount
    await updateWalkerStats(ctx, args.walkerId);

    return reviewId;
  },
});

