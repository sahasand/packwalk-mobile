'use node';

import Stripe from 'stripe';
import { action, internalAction } from './_generated/server';
import { v } from 'convex/values';
import { api, internal } from './_generated/api';
import { packwalkError, getErrorInfo } from './lib/errors';
import type { Doc, Id } from './_generated/dataModel';

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2024-06-20';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    packwalkError('stripe/error', 'Missing STRIPE_SECRET_KEY');
  }
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}

function getEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    packwalkError('validation/error', `Missing env ${name}`);
  }
  return value;
}

async function ensureStripeCustomer(ctx: any, owner: Doc<'users'>) {
  if (owner.stripeCustomerId) return owner.stripeCustomerId;
  const stripe = getStripe();
  const customer = await stripe.customers.create(
    {
      email: owner.email,
      name: owner.name,
      metadata: { userId: owner._id },
    },
    { idempotencyKey: `customer:${owner._id}` },
  );
  await ctx.runMutation(internal.paymentsMutations.setStripeCustomerId, {
    userId: owner._id,
    stripeCustomerId: customer.id,
  });
  return customer.id;
}

// Create login link for walker to access their Stripe Express Dashboard
// Used for "Manage Payouts" - view balance, payout history, update bank, etc.
export const createExpressDashboardLink = action({
  args: {},
  handler: async (ctx): Promise<{ url: string }> => {
    const user = await ctx.runQuery(api.users.getCurrent, {});
    if (!user) {
      packwalkError('auth/not_authenticated', 'Not authenticated');
    }
    if (user.userType !== 'walker') {
      packwalkError('auth/forbidden', 'Walker access required');
    }
    if (!user.stripeConnectAccountId || user.stripeConnectStatus !== 'active') {
      packwalkError('payments/connect_required', 'Stripe Connect not active');
    }

    const stripe = getStripe();
    const loginLink = await stripe.accounts.createLoginLink(
      user.stripeConnectAccountId!
    );

    return { url: loginLink.url };
  },
});

export const createConnectOnboardingLink = action({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.users.getCurrent, {});
    if (!user) {
      packwalkError('auth/not_authenticated', 'Not authenticated');
    }
    if (user.userType !== 'walker') {
      packwalkError('auth/forbidden', 'Walker access required');
    }

    const stripe = getStripe();
    let accountId = user.stripeConnectAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          type: 'express',
          country: 'CA',
          email: user.email,
          capabilities: {
            transfers: { requested: true },
          },
          metadata: { userId: user._id },
        },
        { idempotencyKey: `connect:${user._id}` },
      );
      accountId = account.id;
      await ctx.runMutation(internal.paymentsMutations.setStripeConnectAccountId, {
        userId: user._id,
        accountId,
      });
    }

    // Use HTTPS URLs (Stripe requires valid URLs, not deep links)
    // These Convex HTTP endpoints will redirect to app deep links
    const returnUrl = getEnv('STRIPE_CONNECT_RETURN_URL', 'https://earnest-minnow-363.convex.site/stripe/connect-return');
    const refreshUrl = getEnv('STRIPE_CONNECT_REFRESH_URL', 'https://earnest-minnow-363.convex.site/stripe/connect-refresh');

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return { url: link.url };
  },
});

export const createWalkRequestWithPayment = action({
  args: {
    walkerId: v.id('users'),
    dogIds: v.array(v.id('dogs')),
    scheduledTime: v.number(),
    durationMinutes: v.number(),
    pickupLocation: v.object({
      lat: v.number(),
      lng: v.number(),
      addressLine1: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
    message: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requestId: Id<'walkRequests'> = await ctx.runMutation(
      api.walkRequests.create,
      args,
    );

    const request = await ctx.runQuery(api.walkRequests.getById, { requestId });
    const owner = await ctx.runQuery(api.users.getCurrent, {});
    if (!owner || owner._id !== request.ownerId) {
      packwalkError('auth/forbidden', 'Not allowed');
    }

    const walker = await ctx.runQuery(internal.users.getById, {
      userId: request.walkerId,
    });
    if (!walker || !walker.stripeConnectAccountId) {
      packwalkError('validation/error', 'Walker not payout-ready');
    }

    const customerId = await ensureStripeCustomer(ctx, owner);

    const totalPrice = request.quotedPrice;
    const platformFee = Math.round(totalPrice * request.platformFeePercent);
    const walkerShare = totalPrice - platformFee;

    const stripe = getStripe();
    // Note: application_fee_amount and transfer_data[amount] are mutually exclusive
    // Using application_fee_amount only - walker receives (totalPrice - platformFee) automatically
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalPrice,
        currency: request.currency,
        customer: customerId,
        capture_method: 'manual',
        transfer_data: {
          destination: walker.stripeConnectAccountId,
        },
        application_fee_amount: platformFee,
        setup_future_usage: 'off_session',
        metadata: {
          requestId,
          walkerId: request.walkerId,
          ownerId: request.ownerId,
        },
      },
      { idempotencyKey: `pi:${requestId}` },
    );

    await ctx.runMutation(internal.paymentsMutations.attachPaymentIntentToRequest, {
      requestId,
      paymentIntentId: paymentIntent.id,
      idempotencyKey: requestId,
    });

    return { requestId, clientSecret: paymentIntent.client_secret };
  },
});

export const acceptWalkRequestWithCapture = action({
  args: {
    requestId: v.id('walkRequests'),
  },
  handler: async (ctx, args) => {
    const walker = await ctx.runQuery(api.users.getCurrent, {});
    if (!walker) {
      packwalkError('auth/not_authenticated', 'Not authenticated');
    }
    if (walker.userType !== 'walker' || walker.walkerVerificationStatus !== 'approved') {
      packwalkError('auth/forbidden', 'Walker not approved');
    }

    // Re-check Connect status at capture time — Stripe can disable an account between
    // booking and accept (failed KYC follow-up, restricted region, etc). Capturing
    // against a non-active destination would silently fail and the walker wouldn't be paid.
    if (walker.stripeConnectStatus !== 'active') {
      packwalkError(
        'payments/connect_required',
        'Walker payout account is not active. Re-complete payout setup before accepting walks.',
      );
    }

    const request = await ctx.runQuery(api.walkRequests.getById, {
      requestId: args.requestId,
    });
    if (request.walkerId !== walker._id) {
      packwalkError('auth/forbidden', 'Not allowed');
    }

    // SECURITY: Validate request status and expiry before capture
    if (request.status !== 'pending') {
      packwalkError('state/invalid_transition', 'Request is no longer pending');
    }
    if (request.expiresAt && request.expiresAt < Date.now()) {
      packwalkError('state/invalid_transition', 'Request has expired');
    }

    // Payment intent is required
    if (!request.stripePaymentIntentId) {
      packwalkError('stripe/error', 'Missing payment intent');
    }

    // Capture the authorized payment
    const stripe = getStripe();
    let capturedIntent: any = null;
    try {
      capturedIntent = await stripe.paymentIntents.capture(
        request.stripePaymentIntentId,
        {},
        {
          idempotencyKey: `capture:${request.stripeIdempotencyKey ?? args.requestId}`,
        },
      );
    } catch (err: unknown) {
      const errInfo = getErrorInfo(err);
      await ctx.runMutation(internal.paymentsMutations.logStripeError, {
        context: 'payment_intent_capture',
        relatedRequestId: args.requestId,
        idempotencyKey: request.stripeIdempotencyKey ?? args.requestId,
        errorCode: errInfo.code,
        errorMessage: errInfo.message,
        attempt: 1,
      });
      packwalkError('stripe/error', 'Payment capture failed');
    }

    const walkId: Id<'walks'> = await ctx.runMutation(
      internal.walkRequests.accept,
      { requestId: args.requestId },
    );

    // BUGFIX: Store chargeId at capture time (not just in webhook)
    if (capturedIntent?.latest_charge) {
      await ctx.runMutation(internal.walks.updateStripeChargeId, {
        walkId,
        stripeChargeId: capturedIntent.latest_charge as string,
      });
    }

    return { walkId };
  },
});

export const cancelWalkRequestWithPayment = action({
  args: { requestId: v.id('walkRequests') },
  handler: async (ctx, args) => {
    const owner = await ctx.runQuery(api.users.getCurrent, {});
    if (!owner) packwalkError('auth/not_authenticated', 'Not authenticated');

    const request = await ctx.runQuery(api.walkRequests.getById, {
      requestId: args.requestId,
    });
    if (request.ownerId !== owner._id) {
      packwalkError('auth/forbidden', 'Not allowed');
    }
    if (request.status !== 'pending') {
      packwalkError('state/invalid_transition', 'Only pending requests can be cancelled');
    }

    if (request.stripePaymentIntentId) {
      const stripe = getStripe();
      try {
        await stripe.paymentIntents.cancel(request.stripePaymentIntentId, undefined, {
          idempotencyKey: `pi_cancel:${args.requestId}`,
        });
      } catch (err: unknown) {
        const errInfo = getErrorInfo(err);
        await ctx.runMutation(internal.paymentsMutations.logStripeError, {
          context: 'payment_intent_cancel',
          relatedRequestId: args.requestId,
          idempotencyKey: `pi_cancel:${args.requestId}`,
          errorCode: errInfo.code,
          errorMessage: errInfo.message,
          attempt: 1,
        });
        packwalkError('stripe/error', 'Payment cancellation failed');
      }
    }

    await ctx.runMutation(api.walkRequests.cancel, { requestId: args.requestId });
    return { requestId: args.requestId };
  },
});

export const cancelWalkWithRefund = action({
  args: { walkId: v.id('walks') },
  handler: async (ctx, args): Promise<{ walkId: Id<'walks'>; refundId: string }> => {
    const user = await ctx.runQuery(api.users.getCurrent, {});
    if (!user) {
      packwalkError('auth/not_authenticated', 'Not authenticated');
    }

    const walk = await ctx.runQuery(api.walks.getById, { walkId: args.walkId });
    if (walk.status !== 'scheduled' && walk.status !== 'in_progress') {
      packwalkError('state/invalid_transition', 'Walk cannot be cancelled');
    }
    if (!walk.stripePaymentIntentId) {
      packwalkError('stripe/error', 'No payment to refund');
    }

    const now = Date.now();
    const isOwnerCancel = user._id === walk.ownerId;
    const isWalkerCancel = user._id === walk.walkerId;
    if (!isOwnerCancel && !isWalkerCancel) {
      packwalkError('auth/forbidden', 'Not allowed');
    }

    const hoursToStart = (walk.scheduledTime - now) / (60 * 60 * 1000);
    let refundPercent = 1;
    if (isOwnerCancel) {
      refundPercent = hoursToStart > 2 ? 1 : 0.5;
    }

    const refundAmount = Math.round(walk.totalPrice * refundPercent);
    const refundStatus = refundPercent === 1 ? 'full' : 'partial';

    const stripe = getStripe();
    let refund: Stripe.Response<Stripe.Refund>;
    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: walk.stripePaymentIntentId,
          amount: refundAmount,
          reverse_transfer: true,
          refund_application_fee: true,
          metadata: { walkId: walk._id },
        },
        { idempotencyKey: `refund:${walk._id}:${refundAmount}` },
      );
    } catch (err: unknown) {
      const errInfo = getErrorInfo(err);
      await ctx.runMutation(internal.paymentsMutations.logStripeError, {
        context: 'refund_create',
        relatedWalkId: args.walkId,
        idempotencyKey: `refund:${walk._id}:${refundAmount}`,
        errorCode: errInfo.code,
        errorMessage: errInfo.message,
        attempt: 1,
      });
      packwalkError('stripe/error', 'Refund failed');
    }

    await ctx.runMutation(internal.paymentsMutations.markWalkRefunded, {
      walkId: walk._id,
      refundStatus: refundStatus as any,
      stripeRefundId: refund!.id,
    });

    if (refundPercent < 1 && isOwnerCancel) {
      const lateCancelAmount = Math.round(walk.walkerShare * (1 - refundPercent));
      if (lateCancelAmount > 0) {
        await ctx.runMutation(internal.earnings.createInternal, {
          walkerId: walk.walkerId,
          type: 'adjustment',
          sourceId: walk._id,
          amount: lateCancelAmount,
          currency: walk.currency,
        });
      }
    }

    await ctx.runMutation(internal.walks.cancel, { walkId: walk._id });
    return { walkId: walk._id, refundId: refund!.id };
  },
});

export const createReviewWithTip = action({
  args: {
    walkId: v.id('walks'),
    rating: v.number(),
    comment: v.optional(v.string()),
    tipAmount: v.number(),
  },
  handler: async (ctx, args) => {
    // ===== PHASE 1: ALL VALIDATION BEFORE ANY MUTATIONS =====

    // 1. Auth validation
    const owner = await ctx.runQuery(api.users.getCurrent, {});
    if (!owner) packwalkError('auth/not_authenticated', 'Not authenticated');
    if (owner.userType !== 'owner') packwalkError('auth/forbidden', 'Owner required');

    // 2. Walk validation
    const walk = await ctx.runQuery(api.walks.getById, { walkId: args.walkId });
    if (walk.ownerId !== owner._id || walk.status !== 'completed') {
      packwalkError('validation/error', 'Walk not eligible for review');
    }

    // 3. Tip window validation (7 days)
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (now - (walk.completedAt ?? 0) > SEVEN_DAYS_MS) {
      packwalkError('validation/error', 'Tip window expired');
    }

    // 4. Rating validation
    if (args.rating < 1 || args.rating > 5 || !Number.isInteger(args.rating)) {
      packwalkError('validation/error', 'Rating must be 1-5');
    }
    const validRating = args.rating as 1 | 2 | 3 | 4 | 5;

    // 5. Tip amount validation
    // Upper bound prevents UI bugs or malicious clients from submitting absurd amounts.
    // 50000 cents = $500 CAD, a generous ceiling for a single dog walk tip.
    const MAX_TIP_CENTS = 50_000;
    if (
      !Number.isInteger(args.tipAmount) ||
      args.tipAmount <= 0 ||
      args.tipAmount > MAX_TIP_CENTS
    ) {
      packwalkError('validation/error', 'Tip amount must be a positive integer up to $500');
    }

    // 6. Check if review already exists
    const existingReview = await ctx.runQuery(api.reviews.getByWalkId, { walkId: args.walkId });
    if (existingReview) {
      packwalkError('state/invalid_transition', 'Review already exists');
    }

    // 7. Walker payout status validation (BEFORE any payment operations)
    const walker = await ctx.runQuery(internal.users.getById, {
      userId: walk.walkerId,
    });
    if (!walker || !walker.stripeConnectAccountId) {
      packwalkError('payments/connect_required', 'Walker not payout-ready');
    }

    // ===== PHASE 2: CREATE PAYMENT INTENT (before review) =====

    // Calculate 20% platform fee for shelter donations (same split as walks)
    const tipPlatformFee = Math.round(args.tipAmount * 0.20);

    const customerId = await ensureStripeCustomer(ctx, owner);
    const stripe = getStripe();

    // Create unique idempotency key for this tip attempt
    const idempotencyKey = `tip:${walk._id}:${owner._id}:${now}`;

    const tipIntent = await stripe.paymentIntents.create(
      {
        amount: args.tipAmount,
        currency: walk.currency,
        customer: customerId,
        capture_method: 'automatic',
        transfer_data: {
          destination: walker.stripeConnectAccountId,
        },
        application_fee_amount: tipPlatformFee, // 20% to platform for shelters
        metadata: {
          walkId: walk._id,
          ownerId: owner._id,
          walkerId: walk.walkerId,
          kind: 'tip',
          tipPlatformFee: tipPlatformFee.toString(),
        },
      },
      { idempotencyKey },
    );

    // ===== PHASE 3: CREATE REVIEW ONLY AFTER PAYMENT INTENT SUCCEEDS =====

    const reviewId: Id<'reviews'> = await ctx.runMutation(
      internal.reviews.createWithTipIntent,
      {
        walkId: walk._id,
        ownerId: owner._id,
        walkerId: walk.walkerId,
        rating: validRating,
        comment: args.comment,
        tipAmount: args.tipAmount,
        tipPlatformFee,
        currency: walk.currency,
        tipPaymentIntentId: tipIntent.id,
      },
    );

    // Backfill reviewId onto the PaymentIntent metadata so the success/failure
    // webhook handlers can locate the review. We can't include reviewId in the
    // initial create() above because the review doesn't exist until after the
    // PaymentIntent — Stripe needs the PI client_secret to confirm payment.
    // The webhook also has a defensive fallback (lookup by tipPaymentIntentId)
    // in case this update is racing the webhook delivery.
    await stripe.paymentIntents.update(tipIntent.id, {
      metadata: {
        ...(tipIntent.metadata ?? {}),
        reviewId,
      },
    });

    return { reviewId, clientSecret: tipIntent.client_secret };
  },
});

// Cancel a pending tip payment and remove the corresponding review.
//
// Called by the review screen when the owner cancels or fails to confirm the
// PaymentSheet for a tip. createReviewWithTip inserts the review with
// tipStatus='pending' before the user confirms payment — without this cancel
// path, an abandoned tip leaves an orphaned review that blocks retry (the
// "Review already exists" guard at line 433).
//
// Race: if the user confirms payment at the same moment they tap cancel, the
// PI may already be 'succeeded' by the time we call stripe.paymentIntents.cancel.
// In that case we leave the review in place — the webhook will flip tipStatus
// to 'succeeded' and create the earnings row.
export const cancelReviewTipPayment = action({
  args: { reviewId: v.id('reviews') },
  handler: async (ctx, args) => {
    const owner = await ctx.runQuery(api.users.getCurrent, {});
    if (!owner) packwalkError('auth/not_authenticated', 'Not authenticated');

    const review = await ctx.runQuery(internal.reviews.getById, {
      reviewId: args.reviewId,
    });
    if (!review) packwalkError('validation/error', 'Review not found');
    if (review.ownerId !== owner._id) {
      packwalkError('auth/forbidden', 'Not allowed');
    }
    // Only pending tips can be cancelled. Succeeded/failed tips are terminal
    // and handled by webhooks; 'none' means there was never a payment.
    if (review.tipStatus !== 'pending') {
      return { reviewId: args.reviewId, cancelled: false, reason: 'not_pending' };
    }
    if (!review.tipPaymentIntentId) {
      // Defensive: a pending tip without a PI id shouldn't happen, but if it
      // does we can safely delete the orphan.
      await ctx.runMutation(internal.reviews.deleteAndRecalcStats, {
        reviewId: args.reviewId,
      });
      return { reviewId: args.reviewId, cancelled: true, reason: 'orphan' };
    }

    const stripe = getStripe();
    try {
      await stripe.paymentIntents.cancel(review.tipPaymentIntentId, undefined, {
        idempotencyKey: `tip_cancel:${review._id}`,
      });
    } catch (err: unknown) {
      const errInfo = getErrorInfo(err);
      // payment_intent_unexpected_state means the PI moved past a cancellable
      // state (succeeded, already cancelled, etc) between our state-check and
      // this call. Trust the webhook to reconcile — don't delete the review.
      if (errInfo.code === 'payment_intent_unexpected_state') {
        return { reviewId: args.reviewId, cancelled: false, reason: 'pi_terminal' };
      }
      await ctx.runMutation(internal.paymentsMutations.logStripeError, {
        context: 'tip_payment_cancel',
        idempotencyKey: `tip_cancel:${review._id}`,
        errorCode: errInfo.code,
        errorMessage: errInfo.message,
        attempt: 1,
      });
      packwalkError('stripe/error', 'Failed to cancel tip payment');
    }

    await ctx.runMutation(internal.reviews.deleteAndRecalcStats, {
      reviewId: args.reviewId,
    });
    return { reviewId: args.reviewId, cancelled: true, reason: 'pi_cancelled' };
  },
});

// Test function to verify Stripe API key works
// SECURITY: Internal-only to prevent abuse
export const testStripe = internalAction({
  args: {},
  handler: async () => {
    try {
      const stripe = getStripe();

      // Create a simple PaymentIntent to test the API key
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 100, // $1.00
        currency: 'cad',
        metadata: { test: 'true' },
      });

      // Cancel it immediately since this is just a test
      await stripe.paymentIntents.cancel(paymentIntent.id);

      return {
        success: true,
        message: 'Stripe API key is working!',
        paymentIntentId: paymentIntent.id,
      };
    } catch (err: unknown) {
      const errInfo = getErrorInfo(err);
      return {
        success: false,
        error: errInfo.message,
        code: errInfo.code,
      };
    }
  },
});

// Create booking with payment - requires walker to have active Stripe Connect account
export const createBookingWithPayment = action({
  args: {
    walkerId: v.id('users'),
    dogIds: v.array(v.id('dogs')),
    scheduledTime: v.number(),
    durationMinutes: v.number(),
    pickupLocation: v.object({
      lat: v.number(),
      lng: v.number(),
      addressLine1: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
    message: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ requestId: Id<'walkRequests'>; clientSecret: string | null }> => {
    // Check walker's Connect status
    const walker = await ctx.runQuery(internal.users.getById, { userId: args.walkerId });
    if (!walker) {
      packwalkError('validation/error', 'Walker not found');
    }
    if (walker.userType !== 'walker' || walker.walkerVerificationStatus !== 'approved') {
      packwalkError('validation/error', 'Walker not available');
    }

    // Require walker to have active Stripe Connect account for payments
    const hasConnect = walker.stripeConnectAccountId && walker.stripeConnectStatus === 'active';
    if (!hasConnect) {
      packwalkError('payments/connect_required', 'This walker is not set up to receive payments yet');
    }

    // Create walk request first
    const requestId: Id<'walkRequests'> = await ctx.runMutation(
      api.walkRequests.create,
      args,
    );

    const request = await ctx.runQuery(api.walkRequests.getById, { requestId });

    const owner = await ctx.runQuery(api.users.getCurrent, {});
    if (!owner || owner._id !== request.ownerId) {
      packwalkError('auth/forbidden', 'Not allowed');
    }

    const customerId = await ensureStripeCustomer(ctx, owner);

    const totalPrice = request.quotedPrice;
    const platformFee = Math.round(totalPrice * request.platformFeePercent);
    const walkerShare = totalPrice - platformFee;

    const stripe = getStripe();
    let paymentIntent;
    try {
      // Note: application_fee_amount and transfer_data[amount] are mutually exclusive
      // Using application_fee_amount only - walker receives (totalPrice - platformFee) automatically
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: totalPrice,
          currency: request.currency,
          customer: customerId,
          capture_method: 'manual',
          transfer_data: {
            destination: walker.stripeConnectAccountId!,
          },
          application_fee_amount: platformFee,
          setup_future_usage: 'off_session',
          metadata: {
            requestId,
            walkerId: request.walkerId,
            ownerId: request.ownerId,
          },
        },
        { idempotencyKey: `pi:${requestId}` }, // Prefix to avoid conflicts with old keys
      );
    } catch (err: unknown) {
      const errInfo = getErrorInfo(err);
      await ctx.runMutation(internal.paymentsMutations.logStripeError, {
        context: 'payment_intent_create',
        relatedRequestId: requestId,
        idempotencyKey: requestId,
        errorCode: errInfo.code,
        errorMessage: errInfo.message,
        attempt: 1,
      });
      // Tear down the orphan walk request before throwing. The client's
      // try/catch cannot do this — it never receives requestId when the
      // action throws — so we must clean up here or the walker sees a
      // pending request that can never be accepted (no PaymentIntent).
      try {
        await ctx.runMutation(api.walkRequests.cancel, { requestId });
      } catch (cleanupErr) {
        // Best-effort cleanup; the original Stripe error is what the user
        // needs to see.
        console.error('Failed to cancel orphan walk request after PI create failure:', cleanupErr);
      }
      packwalkError('stripe/error', errInfo.message || 'Payment setup failed');
    }

    await ctx.runMutation(internal.paymentsMutations.attachPaymentIntentToRequest, {
      requestId,
      paymentIntentId: paymentIntent.id,
      idempotencyKey: requestId,
    });

    return { requestId, clientSecret: paymentIntent.client_secret };
  },
});

// Cancel a PaymentIntent (used when declining/expiring requests)
export const cancelPaymentIntent = internalAction({
  args: { paymentIntentId: v.string() },
  handler: async (_ctx, args) => {
    const stripe = getStripe();
    try {
      await stripe.paymentIntents.cancel(args.paymentIntentId, undefined, {
        idempotencyKey: `cancel:${args.paymentIntentId}`,
      });
      return { success: true };
    } catch (err: unknown) {
      const errInfo = getErrorInfo(err);
      // If already cancelled or in a final state, that's fine
      if (errInfo.code === 'payment_intent_unexpected_state') {
        return { success: true, alreadyCancelled: true };
      }
      return { success: false, error: errInfo.message };
    }
  },
});

export const verifyAndParseStripeWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (_ctx, args) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !args.signature) {
      return { valid: false, error: 'Missing signature or webhook secret' };
    }

    try {
      const stripe = getStripe();
      const event = stripe.webhooks.constructEvent(args.payload, args.signature, secret);
      return {
        valid: true,
        eventType: event.type,
        eventId: event.id,
        data: event.data.object as unknown as Record<string, unknown>,
      };
    } catch (err: unknown) {
      const errInfo = getErrorInfo(err);
      return { valid: false, error: errInfo.message };
    }
  },
});
