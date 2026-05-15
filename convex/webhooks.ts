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

// Atomically claim an event for processing (prevents race conditions)
// Returns true if claim succeeded, false if already processing/processed
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
      // Event not recorded yet - should not happen in normal flow
      return false;
    }

    // Only claim if status is 'received'
    if (existing.status !== 'received') {
      // Already processing or processed
      return false;
    }

    // Atomically transition to 'processing'
    await ctx.db.patch(existing._id, {
      status: 'processing',
      attempts: existing.attempts + 1,
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
