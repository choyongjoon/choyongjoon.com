import { v } from 'convex/values';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
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
    cafeId: v.id('cafes'),
    name: v.string(),
    nameEn: v.optional(v.string()),
    category: v.string(),
    externalCategory: v.optional(v.string()),
    description: v.optional(v.string()),
    externalImageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    externalId: v.string(),
    externalUrl: v.string(),
    price: v.optional(v.number()),
    downloadImages: v.optional(v.boolean()),
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
        existing.externalImageUrl !== args.externalImageUrl ||
        existing.imageStorageId !== args.imageStorageId;

      if (hasChanges) {
        const updateData = { ...args, updatedAt: now };
        updateData.downloadImages = undefined; // Remove the flag from stored data

        await ctx.db.patch(existing._id, updateData);

        // Download image if requested and not already stored
        if (
          args.downloadImages &&
          args.externalImageUrl &&
          !existing.imageStorageId
        ) {
          // Schedule image download as a separate action (async)
          ctx.scheduler.runAfter(
            0,
            api.imageDownloader.downloadAndStoreImageAction,
            {
              imageUrl: args.externalImageUrl,
              productId: existing._id,
            }
          );
        }

        return { action: 'updated', id: existing._id };
      }

      return { action: 'unchanged', id: existing._id };
    }

    // Create new product
    const insertData = { ...args, addedAt: now, updatedAt: now };
    insertData.downloadImages = undefined; // Remove the flag from stored data

    const id = await ctx.db.insert('products', insertData);

    // Download image if requested
    if (args.downloadImages && args.externalImageUrl) {
      // Schedule image download as a separate action (async)
      ctx.scheduler.runAfter(
        0,
        api.imageDownloader.downloadAndStoreImageAction,
        {
          imageUrl: args.externalImageUrl,
          productId: id,
        }
      );
    }

    return { action: 'created', id };
  },
});

export const bulkUpsertProducts = mutation({
  args: {
    products: v.array(
      v.object({
        cafeId: v.id('cafes'),
        name: v.string(),
        nameEn: v.optional(v.string()),
        category: v.string(),
        externalCategory: v.optional(v.string()),
        description: v.optional(v.string()),
        externalImageUrl: v.optional(v.string()),
        imageStorageId: v.optional(v.id('_storage')),
        externalId: v.string(),
        externalUrl: v.string(),
        price: v.optional(v.number()),
        downloadImages: v.optional(v.boolean()),
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
        // biome-ignore lint/nursery/noAwaitInLoop: Sequential processing required for database consistency
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

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const uploadImage = mutation({
  args: {
    productId: v.id('products'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, { productId, storageId }) => {
    const now = Date.now();

    await ctx.db.patch(productId, {
      imageStorageId: storageId,
      updatedAt: now,
    });

    return { success: true, storageId };
  },
});

export const getImageUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

export const getProductWithImage = query({
  args: { productId: v.id('products') },
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get(productId);
    if (!product) {
      return null;
    }

    let imageUrl: string | null = null;
    if (product.imageStorageId) {
      imageUrl = await ctx.storage.getUrl(product.imageStorageId);
    }

    return {
      ...product,
      imageUrl,
    };
  },
});

export const updateProductImage = mutation({
  args: {
    productId: v.id('products'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, { productId, storageId }) => {
    const now = Date.now();

    await ctx.db.patch(productId, {
      imageStorageId: storageId,
      updatedAt: now,
    });

    return { success: true };
  },
});

export const listWithImageStatus = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 10 }) => {
    const products = await ctx.db.query('products').order('desc').take(limit);

    return products.map((product) => ({
      _id: product._id,
      name: product.name,
      externalImageUrl: product.externalImageUrl,
      imageStorageId: product.imageStorageId,
      hasStorageId: !!product.imageStorageId,
      hasExternalUrl: !!product.externalImageUrl,
    }));
  },
});

export const updateCategory = mutation({
  args: {
    productId: v.string(),
    category: v.string(),
  },
  handler: async (ctx, { productId, category }) => {
    const now = Date.now();

    await ctx.db.patch(productId as Id<'products'>, {
      category,
      updatedAt: now,
    });

    return { success: true, productId, category };
  },
});
