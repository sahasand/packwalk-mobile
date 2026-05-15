import type { MutationCtx } from '../_generated/server';
import { packwalkError } from './errors';

export async function rateLimit(
  ctx: MutationCtx,
  subject: string,
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const now = Date.now();
  const existing = await ctx.db
    .query('rateLimits')
    .withIndex('by_subject_key', (q) => q.eq('subject', subject).eq('key', key))
    .first();

  if (existing && existing.expiresAt > now) {
    if (existing.count >= limit) {
      packwalkError('rate/limit_exceeded', 'Too many requests');
    }
    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return;
  }

  if (existing) {
    await ctx.db.delete(existing._id);
  }

  await ctx.db.insert('rateLimits', {
    subject,
    key,
    count: 1,
    windowStart: now,
    expiresAt: now + windowSeconds * 1000,
  });
}

