import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireUser } from './lib/guards';
import { packwalkError } from './lib/errors';
import { rateLimit } from './lib/rateLimit';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

export const list = query({
  args: {
    conversationId: v.id('conversations'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || (conv.ownerId !== user._id && conv.walkerId !== user._id)) {
      packwalkError('auth/forbidden', 'Not allowed');
    }

    const limit = Math.min(args.limit ?? 50, 200);
    const msgs = await ctx.db
      .query('messages')
      .withIndex('by_conversationId_createdAt', (q) =>
        q.eq('conversationId', args.conversationId),
      )
      .order('desc')
      .take(limit);

    return msgs.reverse();
  },
});

export const send = mutation({
  args: {
    conversationId: v.optional(v.id('conversations')),
    otherUserId: v.optional(v.id('users')),
    body: v.string(),
  },
  handler: async (ctx, args): Promise<{ conversationId: Id<'conversations'>; messageId: Id<'messages'> }> => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, user._id.toString(), 'messages:send', 30, 60);

    let conversationId: Id<'conversations'> | undefined = args.conversationId;
    if (!conversationId && args.otherUserId) {
      const other = await ctx.db.get(args.otherUserId);
      if (!other || other.isDeleted) {
        packwalkError('validation/error', 'User not found');
      }
      if (user.userType !== 'owner' && user.userType !== 'walker') {
        packwalkError('auth/forbidden', 'Messaging not allowed');
      }
      if (other.userType !== 'owner' && other.userType !== 'walker') {
        packwalkError('validation/error', 'User not found');
      }
      if (user.userType === other.userType) {
        packwalkError('validation/error', 'Conversation must be owner and walker');
      }
      const ownerId = user.userType === 'owner' ? user._id : other._id;
      const walkerId = user.userType === 'walker' ? user._id : other._id;
      conversationId = await ctx.runMutation(internal.conversations.getOrCreateInternal, {
        ownerId,
        walkerId,
      });
    }

    if (!conversationId) {
      packwalkError('validation/error', 'Conversation required');
    }

    const conv = await ctx.db.get(conversationId);
    if (!conv || (conv.ownerId !== user._id && conv.walkerId !== user._id)) {
      packwalkError('auth/forbidden', 'Not allowed');
    }

    const now = Date.now();
    const messageId: Id<'messages'> = await ctx.db.insert('messages', {
      conversationId,
      senderId: user._id,
      body: args.body,
      isRead: false,
      createdAt: now,
    });

    const preview = args.body.length > 80 ? `${args.body.slice(0, 77)}...` : args.body;
    const updates: any = {
      lastMessageAt: now,
      lastMessagePreview: preview,
      lastMessageSenderId: user._id,
    };
    if (user._id === conv.ownerId) {
      updates.unreadCountWalker = (conv.unreadCountWalker ?? 0) + 1;
      updates.unreadCountOwner = 0;
    } else {
      updates.unreadCountOwner = (conv.unreadCountOwner ?? 0) + 1;
      updates.unreadCountWalker = 0;
    }
    await ctx.db.patch(conv._id, updates);

    const recipientId = user._id === conv.ownerId ? conv.walkerId : conv.ownerId;
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: recipientId,
      type: 'message',
      data: {
        subtype: 'new',
        conversationId,
        messageId,
        senderId: user._id,
      },
      options: { push: true, email: false },
    });

    return { conversationId, messageId };
  },
});

export const markConversationRead = mutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || (conv.ownerId !== user._id && conv.walkerId !== user._id)) {
      packwalkError('auth/forbidden', 'Not allowed');
    }

    // Loop until all unread messages are marked (handles >200 messages)
    let totalMarked = 0;
    let batchSize = 0;
    do {
      const unread = await ctx.db
        .query('messages')
        .withIndex('by_conversationId_createdAt', (q) =>
          q.eq('conversationId', args.conversationId),
        )
        .filter((f) =>
          f.and(f.eq(f.field('isRead'), false), f.neq(f.field('senderId'), user._id)),
        )
        .take(200);

      batchSize = unread.length;
      for (const m of unread) {
        await ctx.db.patch(m._id, { isRead: true });
      }
      totalMarked += batchSize;
    } while (batchSize === 200);

    // Only reset counter after ALL messages are marked
    if (user._id === conv.ownerId) {
      await ctx.db.patch(conv._id, { unreadCountOwner: 0 });
    } else {
      await ctx.db.patch(conv._id, { unreadCountWalker: 0 });
    }
  },
});
