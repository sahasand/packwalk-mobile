import { internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

export const record = internalMutation({
  args: {
    provider: v.union(v.literal('stripe'), v.literal('certn'), v.literal('resend')),
    eventType: v.string(),
    eventId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('webhookEvents')
      .withIndex('by_provider_eventId', (q) =>
        q.eq('provider', args.provider).eq('eventId', args.eventId),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return ctx.db.insert('webhookEvents', {
      provider: args.provider,
      eventType: args.eventType,
      eventId: args.eventId,
      payload: args.payload,
      status: 'received',
      attempts: 0,
      createdAt: now,
    });
  },
});

export const getByEventId = internalQuery({
  args: {
    provider: v.union(v.literal('stripe'), v.literal('certn'), v.literal('resend')),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('webhookEvents')
      .withIndex('by_provider_eventId', (q) =>
        q.eq('provider', args.provider).eq('eventId', args.eventId),
      )
      .first();
  },
});

// Soft cap on retry attempts. Stripe retries deliveries for ~3 days on its
// own schedule; if we've failed this many times the handler is deterministically
// broken, not transiently. Stop reprocessing so an operator can investigate
// instead of hot-looping.
const MAX_WEBHOOK_ATTEMPTS = 10;

// Atomically claim an event for processing.
//
// Claimable states:
//   - 'received': first delivery
//   - 'failed':   Stripe retried after a previous handler error
//
// Refused states:
//   - 'processing': another worker holds the claim
//   - 'processed':  already completed
//
// Without 'failed' being claimable here, a single transient processing error
// would mark the row failed and then every Stripe retry would see status !==
// 'received' and silently return ok, abandoning the event forever. That broke
// tip-success, account.updated, charge.refunded, and payment_intent.* events
// after one bad attempt.
export const claimForProcessing = internalMutation({
  args: {
    provider: v.union(v.literal('stripe'), v.literal('certn'), v.literal('resend')),
    eventId: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await ctx.db
      .query('webhookEvents')
      .withIndex('by_provider_eventId', (q) =>
        q.eq('provider', args.provider).eq('eventId', args.eventId),
      )
      .first();

    if (!existing) {
      // Event not recorded yet — should not happen since record() runs first
      return false;
    }

    if (existing.status !== 'received' && existing.status !== 'failed') {
      return false;
    }

    if (existing.attempts >= MAX_WEBHOOK_ATTEMPTS) {
      return false;
    }

    // Atomically transition to 'processing'. Clear errorMessage so a stale
    // failure summary doesn't outlive a successful retry.
    await ctx.db.patch(existing._id, {
      status: 'processing',
      attempts: existing.attempts + 1,
      errorMessage: undefined,
    });

    return true;
  },
});

export const markProcessed = internalMutation({
  args: {
    provider: v.union(v.literal('stripe'), v.literal('certn'), v.literal('resend')),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('webhookEvents')
      .withIndex('by_provider_eventId', (q) =>
        q.eq('provider', args.provider).eq('eventId', args.eventId),
      )
      .first();
    if (!existing) return;

    await ctx.db.patch(existing._id, {
      status: 'processed',
      processedAt: Date.now(),
    });
  },
});

export const markFailed = internalMutation({
  args: {
    provider: v.union(v.literal('stripe'), v.literal('certn'), v.literal('resend')),
    eventId: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('webhookEvents')
      .withIndex('by_provider_eventId', (q) =>
        q.eq('provider', args.provider).eq('eventId', args.eventId),
      )
      .first();
    if (!existing) return;

    await ctx.db.patch(existing._id, {
      status: 'failed',
      errorMessage: args.errorMessage,
    });
  },
});
