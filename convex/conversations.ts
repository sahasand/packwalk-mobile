import { internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireUser } from './lib/guards';
import { packwalkError } from './lib/errors';
import type { Id } from './_generated/dataModel';

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const convs =
      user.userType === 'owner'
        ? await ctx.db
            .query('conversations')
            .withIndex('by_ownerId', (q) => q.eq('ownerId', user._id))
            .collect()
        : await ctx.db
            .query('conversations')
            .withIndex('by_walkerId', (q) => q.eq('walkerId', user._id))
            .collect();

    convs.sort(
      (a, b) => (b.lastMessageAt ?? b._creationTime) - (a.lastMessageAt ?? a._creationTime),
    );
    return convs;
  },
});

export const getById = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) {
      packwalkError('validation/error', 'Conversation not found');
    }
    if (conv.ownerId !== user._id && conv.walkerId !== user._id) {
      packwalkError('auth/forbidden', 'Not allowed');
    }
    return conv;
  },
});

export const getOrCreateInternal = internalMutation({
  args: {
    ownerId: v.id('users'),
    walkerId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('conversations')
      .filter((f) =>
        f.and(
          f.eq(f.field('ownerId'), args.ownerId),
          f.eq(f.field('walkerId'), args.walkerId),
        ),
      )
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    const id: Id<'conversations'> = await ctx.db.insert('conversations', {
      ownerId: args.ownerId,
      walkerId: args.walkerId,
      lastMessageAt: undefined,
      lastMessagePreview: undefined,
      unreadCountOwner: 0,
      unreadCountWalker: 0,
      createdAt: now,
    });
    return id;
  },
});

// Get or create conversation with another user
// Returns conversationId for a given otherUserId
export const getOrCreate = mutation({
  args: { otherUserId: v.id('users') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const other = await ctx.db.get(args.otherUserId);
    if (!other || other.isDeleted) {
      packwalkError('validation/error', 'User not found');
    }

    // Ensure one is owner and one is walker
    if (user.userType === other.userType) {
      packwalkError('validation/error', 'Conversation must be between owner and walker');
    }

    const ownerId = user.userType === 'owner' ? user._id : other._id;
    const walkerId = user.userType === 'walker' ? user._id : other._id;

    // Check for existing conversation
    const existing = await ctx.db
      .query('conversations')
      .filter((f) =>
        f.and(
          f.eq(f.field('ownerId'), ownerId),
          f.eq(f.field('walkerId'), walkerId),
        ),
      )
      .first();
    if (existing) return existing._id;

    // Create new conversation
    const now = Date.now();
    const id: Id<'conversations'> = await ctx.db.insert('conversations', {
      ownerId,
      walkerId,
      lastMessageAt: undefined,
      lastMessagePreview: undefined,
      unreadCountOwner: 0,
      unreadCountWalker: 0,
      createdAt: now,
    });
    return id;
  },
});

