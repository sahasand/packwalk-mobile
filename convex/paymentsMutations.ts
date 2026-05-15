import { internalAction, internalMutation, mutation } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { packwalkError, getErrorInfo } from './lib/errors';
import type { Doc, Id } from './_generated/dataModel';

// Internal-only — invoke from the Convex dashboard. Public exposure would leak payment + walker data.
export const debugStripeErrors = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('stripeErrors').order('desc').take(5);
  },
});

export const debugListWalkers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    return users
      .filter((u) => u.userType === 'walker')
      .map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        stripeConnectStatus: u.stripeConnectStatus,
        stripeConnectAccountId: u.stripeConnectAccountId,
      }));
  },
});

export const debugListWalks = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const walks = await ctx.db.query('walks').order('desc').take(limit);

    const enriched = await Promise.all(walks.map(async (walk) => {
      const owner = await ctx.db.get(walk.ownerId);
      const walker = await ctx.db.get(walk.walkerId);
      const request = await ctx.db.get(walk.requestId);
      const earnings = await ctx.db
        .query('earnings')
        .filter((f) => f.eq(f.field('sourceId'), walk._id))
        .collect();
      const locations = await ctx.db
        .query('walkLocations')
        .withIndex('by_walkId', (q) => q.eq('walkId', walk._id))
        .collect();

      return {
        id: walk._id,
        status: walk.status,
        statusHistory: walk.statusHistory,
        scheduledTime: new Date(walk.scheduledTime).toISOString(),
        startedAt: walk.startedAt ? new Date(walk.startedAt).toISOString() : null,
        completedAt: walk.completedAt ? new Date(walk.completedAt).toISOString() : null,
        createdAt: new Date(walk.createdAt).toISOString(),
        owner: owner ? { id: owner._id, name: owner.name, email: owner.email } : null,
        walker: walker ? {
          id: walker._id,
          name: walker.name,
          email: walker.email,
          stripeConnectStatus: walker.stripeConnectStatus,
        } : null,
        payment: {
          totalPrice: walk.totalPrice,
          walkerShare: walk.walkerShare,
          platformFee: walk.platformFee,
          currency: walk.currency,
          stripePaymentIntentId: walk.stripePaymentIntentId,
          stripeChargeId: walk.stripeChargeId,
          refundStatus: walk.refundStatus,
        },
        request: request ? {
          id: request._id,
          status: request.status,
          quotedPrice: request.quotedPrice,
        } : null,
        earnings: earnings.map(e => ({
          id: e._id,
          type: e.type,
          amount: e.amount,
          status: e.status,
        })),
        locationCount: locations.length,
        distanceMeters: walk.distanceMeters,
      };
    }));

    return enriched;
  },
});

export const debugListRequests = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const requests = await ctx.db.query('walkRequests').order('desc').take(limit);

    const enriched = await Promise.all(requests.map(async (req) => {
      const owner = await ctx.db.get(req.ownerId);
      const walker = await ctx.db.get(req.walkerId);

      return {
        id: req._id,
        status: req.status,
        statusHistory: req.statusHistory,
        scheduledTime: new Date(req.scheduledTime).toISOString(),
        createdAt: new Date(req.createdAt).toISOString(),
        expiresAt: new Date(req.expiresAt).toISOString(),
        owner: owner ? { id: owner._id, name: owner.name } : null,
        walker: walker ? { id: walker._id, name: walker.name } : null,
        payment: {
          quotedPrice: req.quotedPrice,
          stripePaymentIntentId: req.stripePaymentIntentId,
        },
      };
    }));

    return enriched;
  },
});

export const debugListWebhooks = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    return await ctx.db.query('webhookEvents').order('desc').take(limit);
  },
});

export const logStripeError = internalMutation({
  args: {
    context: v.string(),
    relatedRequestId: v.optional(v.id('walkRequests')),
    relatedWalkId: v.optional(v.id('walks')),
    idempotencyKey: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.string(),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert('stripeErrors', {
      context: args.context,
      relatedRequestId: args.relatedRequestId,
      relatedWalkId: args.relatedWalkId,
      idempotencyKey: args.idempotencyKey,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      attempt: args.attempt,
      createdAt: now,
    });
  },
});

export const setStripeCustomerId = internalMutation({
  args: {
    userId: v.id('users'),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      stripeCustomerId: args.stripeCustomerId,
      updatedAt: Date.now(),
    });
  },
});

// Internal-only — clears stripeCustomerId for a single user. Use when a
// user's stored customer ID belongs to a different Stripe mode (test vs live)
// than the current STRIPE_SECRET_KEY, which causes "No such customer" errors
// on charge. ensureStripeCustomer will regenerate a fresh ID on next charge.
//
// Why scoped to one user, not all: tests change Stripe modes; production
// generally doesn't. A mass wipe would be the wrong default — it'd churn
// every user's payment-method storage on Stripe for one stale row.
export const clearStripeCustomerId = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return { cleared: false, reason: 'user_not_found' };
    if (!user.stripeCustomerId) return { cleared: false, reason: 'no_customer_id' };
    await ctx.db.patch(args.userId, {
      stripeCustomerId: undefined,
      updatedAt: Date.now(),
    });
    return { cleared: true, previousCustomerId: user.stripeCustomerId };
  },
});

// Internal-only — fetch reviews and tip earnings for a walker, used during
// end-to-end tip-flow validation.
export const debugTipState = internalMutation({
  args: { walkerId: v.id('users') },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query('reviews')
      .withIndex('by_walkerId', (q) => q.eq('walkerId', args.walkerId))
      .order('desc')
      .take(5);
    const tipEarnings = await Promise.all(
      reviews.map((r) =>
        ctx.db
          .query('earnings')
          .withIndex('by_sourceId', (q) => q.eq('sourceId', r._id))
          .first(),
      ),
    );
    const profile = await ctx.db
      .query('walkerProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.walkerId))
      .first();
    return {
      walkerStats: profile
        ? { avgRating: profile.avgRating, reviewCount: profile.reviewCount }
        : null,
      reviews: reviews.map((r, i) => ({
        id: r._id,
        rating: r.rating,
        tipAmount: r.tipAmount,
        tipStatus: r.tipStatus,
        tipPaymentIntentId: r.tipPaymentIntentId,
        createdAt: new Date(r.createdAt).toISOString(),
        relatedEarning: tipEarnings[i]
          ? {
              id: tipEarnings[i]!._id,
              amount: tipEarnings[i]!.amount,
              type: tipEarnings[i]!.type,
              status: tipEarnings[i]!.status,
            }
          : null,
      })),
    };
  },
});

// Internal-only — list owners with their stripeCustomerId so we can identify
// who owns a given Stripe customer ID (e.g., from an error message).
export const debugListOwners = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    return users
      .filter((u) => u.userType === 'owner')
      .map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        stripeCustomerId: u.stripeCustomerId,
      }));
  },
});

export const setStripeConnectAccountId = internalMutation({
  args: {
    userId: v.id('users'),
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      stripeConnectAccountId: args.accountId,
      stripeConnectStatus: 'onboarding',
      updatedAt: Date.now(),
    });
  },
});

export const updateStripeConnectStatus = internalMutation({
  args: {
    userId: v.id('users'),
    status: v.union(
      v.literal('not_started'),
      v.literal('onboarding'),
      v.literal('pending_verification'),
      v.literal('active'),
      v.literal('restricted'),
      v.literal('disabled'),
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      stripeConnectStatus: args.status,
      stripeConnectStatusReason: args.reason,
      updatedAt: Date.now(),
    });
  },
});

export const attachPaymentIntentToRequest = internalMutation({
  args: {
    requestId: v.id('walkRequests'),
    paymentIntentId: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      stripePaymentIntentId: args.paymentIntentId,
      stripeIdempotencyKey: args.idempotencyKey,
      updatedAt: Date.now(),
    });
  },
});

export const markWalkRefunded = internalMutation({
  args: {
    walkId: v.id('walks'),
    refundStatus: v.union(v.literal('partial'), v.literal('full')),
    stripeRefundId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.walkId, {
      refundStatus: args.refundStatus,
      stripeRefundId: args.stripeRefundId,
      updatedAt: Date.now(),
    });
  },
});

export const handleStripeEvent = internalAction({
  args: {
    eventType: v.string(),
    eventId: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Atomically claim event for processing (prevents race conditions)
    // If claim fails, event is already being processed or was already processed
    const claimed = await ctx.runMutation(internal.webhooks.claimForProcessing, {
      provider: 'stripe',
      eventId: args.eventId,
    });

    if (!claimed) {
      // Already processing or processed by another worker
      return;
    }

    try {
      // V2 Connect events (v2.core.account[requirements].updated,
      // v2.core.account[identity].updated, v2.core.account_link.returned,
      // etc.) emit just an account_id and a diff — not the full account.
      // We can't decide a status from the diff alone, so on any v2 account
      // event we fetch fresh state from Stripe via refreshConnectAccount.
      // Use startsWith to cover the whole family without enumerating every
      // bracketed variant Stripe may add.
      if (
        args.eventType.startsWith('v2.core.account') &&
        args.eventType !== 'v2.core.account.updated'
      ) {
        const accountId =
          (args.data?.account_id as string | undefined) ??
          (args.data?.id as string | undefined);
        if (accountId) {
          await ctx.runAction(internal.payments.refreshConnectAccount, {
            accountId,
          });
        }
        await ctx.runMutation(internal.webhooks.markProcessed, {
          provider: 'stripe',
          eventId: args.eventId,
        });
        return;
      }

      switch (args.eventType) {
        case 'account.updated':
        case 'v2.core.account.updated':
          await ctx.runMutation(internal.paymentsMutations.processAccountUpdated, {
            account: args.data,
          });
          break;
        case 'payment_intent.succeeded':
          await ctx.runMutation(internal.paymentsMutations.processPaymentIntentSucceeded, {
            paymentIntent: args.data,
          });
          break;
        case 'payment_intent.payment_failed':
          await ctx.runMutation(internal.paymentsMutations.processPaymentIntentFailed, {
            paymentIntent: args.data,
          });
          break;
        case 'charge.refunded':
          await ctx.runMutation(internal.paymentsMutations.processChargeRefunded, {
            charge: args.data,
          });
          break;
        default:
          break;
      }

      await ctx.runMutation(internal.webhooks.markProcessed, {
        provider: 'stripe',
        eventId: args.eventId,
      });
    } catch (error: unknown) {
      const errInfo = getErrorInfo(error);
      // Mark as failed so it can be retried or investigated
      await ctx.runMutation(internal.webhooks.markFailed, {
        provider: 'stripe',
        eventId: args.eventId,
        errorMessage: errInfo.message,
      });
      throw error; // Re-throw to let caller know processing failed
    }
  },
});

export const processAccountUpdated = internalMutation({
  args: { account: v.any() },
  handler: async (ctx, args) => {
    const account = args.account as any;
    const accountId = account.id as string | undefined;
    if (!accountId) return;

    const fallbackUser = await ctx.db
      .query('users')
      .filter((f) => f.eq(f.field('stripeConnectAccountId'), accountId))
      .first();
    if (!fallbackUser) return;

    const disabledReason = account.disabled_reason as string | null | undefined;
    const payoutsEnabled = account.payouts_enabled as boolean | undefined;
    const transfersCap = account.capabilities?.transfers as string | undefined;
    const requirements = account.requirements ?? {};
    const currentlyDue: string[] = requirements.currently_due ?? [];
    const pastDue: string[] = requirements.past_due ?? [];

    let status: Doc<'users'>['stripeConnectStatus'] = 'onboarding';
    let reason: string | undefined;

    if (disabledReason) {
      status = 'disabled';
      reason = disabledReason;
    } else if (!payoutsEnabled || transfersCap !== 'active') {
      if (currentlyDue.length > 0) {
        status = 'pending_verification';
        reason = currentlyDue.join(', ');
      } else {
        status = 'onboarding';
      }
    } else {
      status = 'active';
    }

    if (status === 'active' && (pastDue.length > 0 || transfersCap === 'inactive')) {
      status = 'restricted';
      reason = pastDue.join(', ');
    }

    await ctx.db.patch(fallbackUser._id, {
      stripeConnectStatus: status,
      stripeConnectStatusReason: reason,
      updatedAt: Date.now(),
    });
  },
});

// Locate a tip review for an incoming PaymentIntent webhook.
// Primary path: metadata.reviewId (set by payments.ts after review creation).
// Fallback: lookup by tipPaymentIntentId, for the rare race where the webhook
// arrives before the metadata backfill completes.
async function findTipReview(
  ctx: { db: { get: any; query: any } },
  pi: any,
): Promise<Doc<'reviews'> | null> {
  const metadata = pi.metadata ?? {};
  if (metadata.reviewId) {
    const review = await ctx.db.get(metadata.reviewId as Id<'reviews'>);
    if (review) return review;
  }
  if (metadata.kind === 'tip') {
    return await ctx.db
      .query('reviews')
      .filter((f: any) => f.eq(f.field('tipPaymentIntentId'), pi.id))
      .first();
  }
  return null;
}

export const processPaymentIntentSucceeded = internalMutation({
  args: { paymentIntent: v.any() },
  handler: async (ctx, args) => {
    const pi = args.paymentIntent as any;
    const metadata = pi.metadata ?? {};
    const requestId = metadata.requestId as string | undefined;

    const tipReview = await findTipReview(ctx, pi);
    if (tipReview) {
      const reviewDocId = tipReview._id;
      const review = tipReview;

      await ctx.db.patch(reviewDocId, {
        tipStatus: 'succeeded',
        tipPaymentIntentId: pi.id,
      });

      // The review was inserted with tipStatus='pending', which
      // updateWalkerStats deliberately filters out. Now that the tip
      // succeeded, bump rating/count so the walker sees it.
      await ctx.runMutation(internal.reviews.recalcStats, {
        walkerId: review.walkerId,
      });

      // Check if earnings already exist to prevent duplicate entries from webhook replay
      const existingEarning = await ctx.db
        .query('earnings')
        .withIndex('by_sourceId', (q) => q.eq('sourceId', reviewDocId))
        .first();

      if (!existingEarning) {
        // Calculate walker's share: total tip minus 20% platform fee
        // Platform fee is stored in metadata or we recalculate as 20%
        const tipPlatformFee = metadata.tipPlatformFee
          ? parseInt(metadata.tipPlatformFee, 10)
          : Math.round(pi.amount * 0.20);
        const walkerShare = pi.amount - tipPlatformFee;

        await ctx.db.insert('earnings', {
          walkerId: review.walkerId,
          type: 'tip',
          sourceId: reviewDocId,
          amount: walkerShare, // 80% goes to walker
          currency: pi.currency,
          status: 'ready_for_payout',
          stripeTransferId: undefined,
          stripeIdempotencyKey: reviewDocId.toString(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      await ctx.runMutation(internal.notifications.createNotification, {
        userId: review.walkerId,
        type: 'payout_update',
        data: { subtype: 'ready', reviewId: reviewDocId },
        options: { push: true, email: false },
      });
    } else if (requestId) {
      const walk = await ctx.db
        .query('walks')
        .filter((f) => f.eq(f.field('stripePaymentIntentId'), pi.id as string))
        .first();
      if (walk) {
        await ctx.db.patch(walk._id, {
          stripeChargeId: pi.latest_charge as string | undefined,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

export const processPaymentIntentFailed = internalMutation({
  args: { paymentIntent: v.any() },
  handler: async (ctx, args) => {
    const pi = args.paymentIntent as any;
    const tipReview = await findTipReview(ctx, pi);
    if (!tipReview) return;
    // A tip-review whose payment was declined has no business sticking
    // around: no money moved, no audit trail is needed (the Stripe event
    // is preserved in webhookEvents), and leaving it with tipStatus='failed'
    // would block the owner from submitting a retry (createReviewWithTip
    // errors on existing reviews). Delete and recalc the walker's stats.
    await ctx.runMutation(internal.reviews.deleteAndRecalcStats, {
      reviewId: tipReview._id,
    });
  },
});

export const processChargeRefunded = internalMutation({
  args: { charge: v.any() },
  handler: async (ctx, args) => {
    const charge = args.charge as any;
    const paymentIntentId = charge.payment_intent as string | undefined;
    if (!paymentIntentId) return;

    const walk = await ctx.db
      .query('walks')
      .filter((f) => f.eq(f.field('stripePaymentIntentId'), paymentIntentId))
      .first();
    if (!walk) return;

    const amountRefunded = charge.amount_refunded as number | undefined;
    const amount = charge.amount as number | undefined;
    let refundStatus: 'partial' | 'full' = 'partial';
    if (amountRefunded && amount && amountRefunded >= amount) {
      refundStatus = 'full';
    }

    await ctx.db.patch(walk._id, {
      refundStatus,
      updatedAt: Date.now(),
    });
  },
});

