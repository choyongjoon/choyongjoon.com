import { v } from 'convex/values';
import { query } from './_generated/server';

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('cafes').collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query('cafes')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .first();
  },
});
