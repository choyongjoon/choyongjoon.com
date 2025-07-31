import { v } from 'convex/values';
import { api } from './_generated/api';
import { mutation, query } from './_generated/server';

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

export const findOrCreateCafe = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, { name, slug, logoUrl }) => {
    const existing = await ctx.db
      .query('cafes')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert('cafes', {
      name,
      slug,
      logoUrl,
    });
  },
});

export const upsertProduct = mutation({
  args: {
    name: v.string(),
    cafeId: v.id('cafes'),
    category: v.string(),
    price: v.optional(v.number()),
    description: v.optional(v.string()),
    calories: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    isDiscontinued: v.boolean(),
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query('products')
      .withIndex('by_external_id', (q) => q.eq('externalId', args.externalId))
      .first();

    if (existing) {
      // Check if any fields have changed
      const hasChanges =
        existing.name !== args.name ||
        existing.category !== args.category ||
        existing.price !== args.price ||
        existing.description !== args.description ||
        existing.calories !== args.calories ||
        existing.imageUrl !== args.imageUrl ||
        existing.isDiscontinued !== args.isDiscontinued;

      if (hasChanges) {
        await ctx.db.patch(existing._id, {
          ...args,
          updatedAt: now,
        });
        return { action: 'updated', id: existing._id };
      }

      return { action: 'unchanged', id: existing._id };
    }

    const id = await ctx.db.insert('products', {
      ...args,
      addedAt: now,
      updatedAt: now,
    });

    return { action: 'created', id };
  },
});

export const bulkUpsertProducts = mutation({
  args: {
    products: v.array(
      v.object({
        name: v.string(),
        cafeId: v.id('cafes'),
        category: v.string(),
        price: v.optional(v.number()),
        description: v.optional(v.string()),
        calories: v.optional(v.number()),
        imageUrl: v.optional(v.string()),
        isDiscontinued: v.boolean(),
        externalId: v.string(),
      })
    ),
  },
  handler: async (ctx, { products }) => {
    const results = {
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: [] as string[],
    };

    for (const product of products) {
      try {
        const result = await ctx.runMutation(
          api.products.upsertProduct,
          product
        );
        if (result.action === 'created') {
          results.created++;
        } else if (result.action === 'updated') {
          results.updated++;
        } else if (result.action === 'unchanged') {
          results.unchanged++;
        }
      } catch (error) {
        results.errors.push(`Failed to process ${product.name}: ${error}`);
      }
    }

    return results;
  },
});
