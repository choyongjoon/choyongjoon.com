import { v } from 'convex/values';
import { query } from './_generated/server';

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('products').collect();
  },
});

export const getByCafe = query({
  args: { cafeId: v.id('cafes') },
  handler: async (ctx, { cafeId }) => {
    return await ctx.db
      .query('products')
      .withIndex('by_cafe', (q) => q.eq('cafeId', cafeId))
      .collect();
  },
});

export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, { searchTerm }) => {
    const products = await ctx.db.query('products').collect();
    return products.filter((product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  },
});
