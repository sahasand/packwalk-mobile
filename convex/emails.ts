import { action, internalAction, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { getErrorInfo } from './lib/errors';
import type { Id } from './_generated/dataModel';

// Test function to verify email sending works (remove in production)
export const testSend = action({
  args: {
    toEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@packwalk.ca';
    const fromName = process.env.RESEND_FROM_NAME ?? 'Packwalk';

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [args.toEmail],
          subject: 'Packwalk Test Email',
          html: '<h1>Email Test Successful!</h1><p>Your Packwalk email integration is working correctly.</p><p>🐕 Every walk saves a rescue!</p>',
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json?.message ?? 'Resend error', response: json };
      }

      return { success: true, messageId: json.id };
    } catch (err: unknown) {
      const errInfo = getErrorInfo(err);
      return { success: false, error: errInfo.message };
    }
  },
});

const emailStatus = v.union(
  v.literal('queued'),
  v.literal('sent'),
  v.literal('delivered'),
  v.literal('bounced'),
  v.literal('failed'),
);

export const createEmailLog = internalMutation({
  args: {
    userId: v.optional(v.id('users')),
    template: v.string(),
    status: emailStatus,
    providerMessageId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id: Id<'emailLogs'> = await ctx.db.insert('emailLogs', {
      userId: args.userId,
      template: args.template,
      providerMessageId: args.providerMessageId,
      status: args.status as any,
      errorMessage: args.errorMessage,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const updateEmailLog = internalMutation({
  args: {
    logId: v.id('emailLogs'),
    status: emailStatus,
    providerMessageId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.logId, {
      status: args.status as any,
      providerMessageId: args.providerMessageId,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
  },
});

export const send = internalAction({
  args: {
    userId: v.id('users'),
    template: v.string(),
    subject: v.string(),
    html: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const user = await ctx.runQuery(internal.users.getById, { userId: args.userId });
    if (!user || user.isDeleted || !user.email) return;

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'from@packwalk.ca';
    const fromName = process.env.RESEND_FROM_NAME ?? 'Packwalk';

    const logId = await ctx.runMutation(internal.emails.createEmailLog, {
      userId: args.userId,
      template: args.template,
      status: 'queued',
      metadata: args.metadata,
    });

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [user.email],
          subject: args.subject,
          html: args.html,
          tags: [{ name: 'template', value: args.template }],
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message ?? 'Resend error');
      }

      await ctx.runMutation(internal.emails.updateEmailLog, {
        logId,
        status: 'sent',
        providerMessageId: json.id,
      });
    } catch (err: unknown) {
      const errInfo = getErrorInfo(err);
      await ctx.runMutation(internal.emails.updateEmailLog, {
        logId,
        status: 'failed',
        errorMessage: errInfo.message,
      });
    }
  },
});
