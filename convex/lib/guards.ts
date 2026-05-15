import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';
import { packwalkError } from './errors';

type Ctx = MutationCtx | QueryCtx;

export async function requireIdentity(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    packwalkError('auth/not_authenticated', 'Not authenticated');
  }
  return identity;
}

export async function requireUser(ctx: Ctx): Promise<Doc<'users'>> {
  const identity = await requireIdentity(ctx);
  const user = await ctx.db
    .query('users')
    .withIndex('by_authId', (q) => q.eq('authId', identity.tokenIdentifier))
    .first();
  if (!user || user.isDeleted) {
    packwalkError('auth/user_not_found', 'User not found');
  }
  return user;
}

export function requireOwner(user: Doc<'users'>) {
  if (user.userType !== 'owner') {
    packwalkError('auth/forbidden', 'Owner access required');
  }
}

export function requireWalker(user: Doc<'users'>) {
  if (user.userType !== 'walker') {
    packwalkError('auth/forbidden', 'Walker access required');
  }
}

export function requireAdmin(user: Doc<'users'>) {
  if (user.userType !== 'admin') {
    packwalkError('auth/forbidden', 'Admin access required');
  }
}
