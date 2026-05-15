import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("waitlist").collect();
    const owners = all.filter((e) => e.type === "owner");
    const walkers = all.filter((e) => e.type === "walker");
    return {
      total: all.length,
      owners: owners.length,
      walkers: walkers.length,
      entries: all
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((e) => ({
          email: e.email,
          type: e.type,
          name: e.name,
          createdAt: new Date(e.createdAt).toISOString(),
        })),
    };
  },
});

export const add = mutation({
  args: {
    email: v.string(),
    type: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if email already exists for this type
    const existing = await ctx.db
      .query("waitlist")
      .filter((q) =>
        q.and(
          q.eq(q.field("email"), args.email),
          q.eq(q.field("type"), args.type)
        )
      )
      .first();

    if (existing) {
      // Already on waitlist - get their position
      const allOfType = await ctx.db
        .query("waitlist")
        .filter((q) => q.eq(q.field("type"), args.type))
        .collect();

      const position = allOfType
        .sort((a, b) => a.createdAt - b.createdAt)
        .findIndex((entry) => entry.email === args.email) + 1;

      return { success: true, alreadyExists: true, position };
    }

    await ctx.db.insert("waitlist", {
      email: args.email,
      type: args.type,
      name: args.name,
      createdAt: Date.now(),
    });

    // Get total count for this type (new user is last)
    const count = await ctx.db
      .query("waitlist")
      .filter((q) => q.eq(q.field("type"), args.type))
      .collect();

    return { success: true, alreadyExists: false, position: count.length };
  },
});
