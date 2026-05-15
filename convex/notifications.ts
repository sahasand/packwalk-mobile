import { internalAction, internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireUser } from './lib/guards';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';

const notificationType = v.union(
  v.literal('walk_request'),
  v.literal('walk_update'),
  v.literal('message'),
  v.literal('payout_update'),
  v.literal('review'),
  v.literal('system'),
);

function getPushContent(type: Doc<'notifications'>['type'], data: any) {
  const subtype = data?.subtype as string | undefined;
  switch (type) {
    case 'walk_request':
      return {
        title: 'New walk request',
        body: 'You have a new walk request.',
      };
    case 'walk_update':
      switch (subtype) {
        case 'accepted':
          return { title: 'Walk accepted', body: 'Your walk request was accepted.' };
        case 'starting':
          return { title: 'Walk starting', body: 'Your walker has started the walk.' };
        case 'completed':
          return { title: 'Walk completed', body: 'Your walk is complete.' };
        case 'cancelled':
          return { title: 'Walk cancelled', body: 'A walk was cancelled.' };
        case 'no_show':
          return { title: 'No‑show', body: 'A walk was marked no‑show.' };
        default:
          return { title: 'Walk update', body: 'Your walk status updated.' };
      }
    case 'message':
      return { title: 'New message', body: 'You received a new message.' };
    case 'payout_update':
      switch (subtype) {
        case 'ready':
          return { title: 'Payout ready', body: 'New earnings are ready for payout.' };
        case 'paid':
          return { title: 'Payout sent', body: 'Your payout was sent.' };
        default:
          return { title: 'Payout update', body: 'Your payout status updated.' };
      }
    case 'review':
      return { title: 'New review', body: 'You received a new review.' };
    default:
      return { title: 'Update', body: 'You have a new notification.' };
  }
}

export const listMine = query({
  args: {
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = Math.min(args.limit ?? 50, 200);

    if (args.unreadOnly) {
      return ctx.db
        .query('notifications')
        .withIndex('by_userId_isRead_createdAt', (q) =>
          q.eq('userId', user._id).eq('isRead', false),
        )
        .order('desc')
        .take(limit);
    }

    const all = await ctx.db
      .query('notifications')
      .filter((f) => f.eq(f.field('userId'), user._id))
      .order('desc')
      .take(limit);
    return all;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id('notifications') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const notif = await ctx.db.get(args.notificationId);
    if (!notif || notif.userId !== user._id) return;
    if (notif.isRead) return;
    await ctx.db.patch(notif._id, { isRead: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_userId_isRead_createdAt', (q) =>
        q.eq('userId', user._id).eq('isRead', false),
      )
      .take(200);
    for (const n of unread) {
      await ctx.db.patch(n._id, { isRead: true });
    }
  },
});

export const createNotification = internalMutation({
  args: {
    userId: v.id('users'),
    type: notificationType,
    data: v.any(),
    options: v.optional(
      v.object({
        push: v.optional(v.boolean()),
        email: v.optional(v.boolean()),
        emailTemplate: v.optional(v.string()),
        emailSubject: v.optional(v.string()),
        emailHtml: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const notificationId: Id<'notifications'> = await ctx.db.insert('notifications', {
      userId: args.userId,
      type: args.type,
      data: args.data,
      isRead: false,
      createdAt: now,
    });

    const opts = args.options ?? {};

    if (opts.push) {
      const pushContent = getPushContent(args.type as any, args.data);
      await ctx.scheduler.runAfter(0, internal.notifications.sendPush, {
        userId: args.userId,
        title: pushContent.title,
        body: pushContent.body,
        data: { ...args.data, notificationId },
      });
    }

    if (opts.email) {
      await ctx.scheduler.runAfter(0, internal.emails.send, {
        userId: args.userId,
        template: opts.emailTemplate ?? `${args.type}`,
        subject: opts.emailSubject ?? getPushContent(args.type as any, args.data).title,
        html:
          opts.emailHtml ??
          `<p>${getPushContent(args.type as any, args.data).body}</p>`,
        metadata: { type: args.type, data: args.data, notificationId },
      });
    }

    return notificationId;
  },
});

export const sendPush = internalAction({
  args: {
    userId: v.id('users'),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getById, { userId: args.userId });
    if (!user || user.isDeleted) return;
    const tokens = (user.pushTokens ?? []).filter(Boolean);
    if (tokens.length === 0) return;

    const messages = tokens.map((to: string) => ({
      to,
      title: args.title,
      body: args.body,
      data: args.data ?? {},
      sound: 'default' as const,
    }));

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
    } catch {
      // Swallow push errors; not critical for core flows.
    }
  },
});

