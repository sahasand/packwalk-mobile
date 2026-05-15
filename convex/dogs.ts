import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireUser, requireOwner } from './lib/guards';
import { packwalkError } from './lib/errors';

export const listMine = query({
  args: {
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireOwner(user);

    let q = ctx.db
      .query('dogs')
      .withIndex('by_ownerId_isDeleted', (idx) =>
        idx.eq('ownerId', user._id).eq('isDeleted', false),
      );

    if (args.isActive !== undefined) {
      q = q.filter((f) => f.eq(f.field('isActive'), args.isActive));
    }

    return q.collect();
  },
});

export const getMine = query({
  args: { dogId: v.id('dogs') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireOwner(user);

    const dog = await ctx.db.get(args.dogId);
    if (!dog || dog.isDeleted || dog.ownerId !== user._id) {
      packwalkError('auth/forbidden', 'Dog not found');
    }
    return dog;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    breed: v.optional(v.string()),
    age: v.optional(v.number()),
    size: v.optional(v.string()),
    specialNotes: v.optional(v.string()),
    photoFileId: v.optional(v.id('_storage')),
    photoUrl: v.optional(v.string()),
    accessNotes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireOwner(user);
    const now = Date.now();

    return ctx.db.insert('dogs', {
      ownerId: user._id,
      name: args.name,
      breed: args.breed,
      age: args.age,
      size: args.size,
      specialNotes: args.specialNotes,
      photoFileId: args.photoFileId,
      photoUrl: args.photoUrl,
      isActive: args.isActive ?? true,
      accessNotes: args.accessNotes,
      isDeleted: false,
      deletedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    dogId: v.id('dogs'),
    name: v.optional(v.string()),
    breed: v.optional(v.string()),
    age: v.optional(v.number()),
    size: v.optional(v.string()),
    specialNotes: v.optional(v.string()),
    photoFileId: v.optional(v.id('_storage')),
    photoUrl: v.optional(v.string()),
    accessNotes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireOwner(user);
    const dog = await ctx.db.get(args.dogId);
    if (!dog || dog.isDeleted || dog.ownerId !== user._id) {
      packwalkError('auth/forbidden', 'Dog not found');
    }

    const now = Date.now();
    const updates: Partial<typeof dog> = { updatedAt: now };

    if (args.name) updates.name = args.name;
    if (args.breed !== undefined) updates.breed = args.breed;
    if (args.age !== undefined) updates.age = args.age;
    if (args.size !== undefined) updates.size = args.size;
    if (args.specialNotes !== undefined) updates.specialNotes = args.specialNotes;
    if (args.photoFileId !== undefined) updates.photoFileId = args.photoFileId;
    if (args.photoUrl !== undefined) updates.photoUrl = args.photoUrl;
    if (args.accessNotes !== undefined) updates.accessNotes = args.accessNotes;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.dogId, updates);
    return args.dogId;
  },
});

export const remove = mutation({
  args: { dogId: v.id('dogs') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireOwner(user);
    const dog = await ctx.db.get(args.dogId);
    if (!dog || dog.isDeleted || dog.ownerId !== user._id) {
      packwalkError('auth/forbidden', 'Dog not found');
    }

    const now = Date.now();
    await ctx.db.patch(args.dogId, {
      isDeleted: true,
      deletedAt: now,
      updatedAt: now,
      isActive: false,
    });
    return args.dogId;
  },
});

