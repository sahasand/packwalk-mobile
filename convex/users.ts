import { internalQuery, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireIdentity } from './lib/guards';

export const bootstrap = mutation({
  args: {
    userType: v.optional(v.union(v.literal('owner'), v.literal('walker'))),
    name: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query('users')
      .withIndex('by_authId', (q) => q.eq('authId', identity.tokenIdentifier))
      .first();

    if (existing) {
      const updates: Partial<typeof existing> = { updatedAt: now };
      if (identity.email && identity.email !== existing.email) {
        updates.email = identity.email;
      }
      // Only set name for users who don't have one yet (preserve custom names from Edit Profile)
      if (!existing.name || existing.name.trim() === '') {
        if (args.name) {
          updates.name = args.name;
        } else {
          // User has no name - use email prefix as fallback
          const email = identity.email || existing.email;
          if (email) {
            const emailPrefix = email.split('@')[0];
            // Capitalize first letter
            updates.name = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
          }
        }
      }
      if (args.timezone) {
        updates.timezone = args.timezone;
      }
      // Note: userType cannot be changed after account creation
      // User must create a new account if they want a different role
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    const userId = await ctx.db.insert('users', {
      authId: identity.tokenIdentifier,
      userType: args.userType ?? 'owner',
      walkerVerificationStatus: 'approved',
      email: identity.email ?? '',
      name: args.name ?? identity.name ?? '',
      stripeConnectStatus: 'not_started',
      pushTokens: [],
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      ...(args.timezone ? { timezone: args.timezone } : {}),
    });

    return userId;
  },
});

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return ctx.db
      .query('users')
      .withIndex('by_authId', (q) => q.eq('authId', identity.tokenIdentifier))
      .first();
  },
});

export const getById = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return ctx.db.get(args.userId);
  },
});

export const getPublicProfile = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.isDeleted) {
      return null;
    }
    // Return only public fields
    return {
      _id: user._id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      userType: user.userType,
    };
  },
});

// Reset Stripe Connect status for all walkers (for switching test -> live mode)
export const resetAllWalkersConnectStatus = mutation({
  args: {},
  handler: async (ctx) => {
    const walkers = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('userType'), 'walker'))
      .collect();

    let count = 0;
    for (const walker of walkers) {
      if (walker.stripeConnectAccountId) {
        await ctx.db.patch(walker._id, {
          stripeConnectAccountId: undefined,
          stripeConnectStatus: 'not_started',
          stripeConnectStatusReason: undefined,
          updatedAt: Date.now(),
        });
        count++;
      }
    }
    return { reset: count, total: walkers.length };
  },
});

// Batch fetch public profiles for multiple users
export const getPublicProfiles = query({
  args: { userIds: v.array(v.id('users')) },
  handler: async (ctx, args) => {
    const profiles = await Promise.all(
      args.userIds.map(async (userId) => {
        const user = await ctx.db.get(userId);
        if (!user || user.isDeleted) {
          return null;
        }
        return {
          _id: user._id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          userType: user.userType,
          walkerVerificationStatus: user.walkerVerificationStatus,
        };
      })
    );
    return profiles;
  },
});
