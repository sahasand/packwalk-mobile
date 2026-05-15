import { internalMutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireUser, requireWalker } from './lib/guards';

export const listMine = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('ready_for_payout'),
        v.literal('paid_out'),
      ),
    ),
    type: v.optional(
      v.union(v.literal('walk'), v.literal('tip'), v.literal('adjustment')),
    ),
  },
  handler: async (ctx, args) => {
    const walker = await requireUser(ctx);
    requireWalker(walker);

    let q = ctx.db
      .query('earnings')
      .filter((f) => f.eq(f.field('walkerId'), walker._id));

    if (args.status) {
      q = q.filter((f) => f.eq(f.field('status'), args.status!));
    }
    if (args.type) {
      q = q.filter((f) => f.eq(f.field('type'), args.type!));
    }

    return q.collect();
  },
});

export const createInternal = internalMutation({
  args: {
    walkerId: v.id('users'),
    type: v.union(v.literal('walk'), v.literal('tip'), v.literal('adjustment')),
    sourceId: v.string(),
    amount: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert('earnings', {
      walkerId: args.walkerId,
      type: args.type,
      sourceId: args.sourceId,
      amount: args.amount,
      currency: args.currency,
      status: 'ready_for_payout',
      stripeTransferId: undefined,
      stripeIdempotencyKey: `earnings:${args.sourceId}:${args.type}`,
      createdAt: now,
      updatedAt: now,
    });
  },
});

