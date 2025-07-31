import type { GenericDataModel, GenericMutationCtx } from 'convex/server';
import { v } from 'convex/values';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { mutation } from './_generated/server';

interface CrawlerProduct {
  name: string;
  nameEn: string;
  description: string;
  externalCategory: string;
  externalId: string;
  externalImageUrl: string;
  externalUrl: string;
  price: number | null;
  category: string;
}
interface UploadResults {
  processed: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: string[];
  processingTime: number;
}

// Helper function to upload products to database
async function uploadProductsToDatabase(
  ctx: GenericMutationCtx<GenericDataModel>,
  products: CrawlerProduct[],
  cafeId: Id<'cafes'>,
  results: UploadResults
) {
  for (const product of products) {
    try {
      // biome-ignore lint/nursery/noAwaitInLoop: Sequential processing required for database consistency
      const result = await ctx.runMutation(api.products.upsertProduct, {
        ...product,
        cafeId,
        price: product.price ?? undefined,
      });
      if (result.action === 'created') {
        results.created++;
      } else if (result.action === 'updated') {
        results.updated++;
      } else if (result.action === 'unchanged') {
        results.unchanged++;
      }
    } catch (error) {
      results.errors.push(`Failed to upsert ${product.name}: ${error}`);
    }
  }
}

export const uploadProductsFromJson = mutation({
  args: {
    products: v.array(v.any()),
    cafeName: v.string(),
    cafeSlug: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { products, cafeName, cafeSlug, dryRun = false }) => {
    const startTime = Date.now();

    // Find or create cafe
    const cafeId = await ctx.runMutation(api.products.findOrCreateCafe, {
      name: cafeName,
      slug: cafeSlug,
      logoUrl: undefined,
    });

    const results: UploadResults = {
      processed: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: [],
      skipped: 0,
      processingTime: 0,
    };

    if (dryRun) {
      results.processingTime = Date.now() - startTime;
      return {
        ...results,
        message: `Dry run completed. Would process ${products.length} products.`,
        samples: products.slice(0, 3), // Show first 3 as samples
      };
    }

    // Upload processed products
    await uploadProductsToDatabase(ctx, products, cafeId, results);

    results.processingTime = Date.now() - startTime;

    return {
      ...results,
      message: `Upload completed in ${results.processingTime}ms. Created: ${results.created}, Updated: ${results.updated}, Unchanged: ${results.unchanged}`,
    };
  },
});

export const getUploadStats = mutation({
  args: {
    cafeSlug: v.string(),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, { cafeSlug, daysBack = 7 }) => {
    const cafe = await ctx.db
      .query('cafes')
      .withIndex('by_slug', (q) => q.eq('slug', cafeSlug))
      .first();

    if (!cafe) {
      throw new Error(`Cafe not found: ${cafeSlug}`);
    }

    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    const products = await ctx.db
      .query('products')
      .withIndex('by_cafe', (q) => q.eq('cafeId', cafe._id))
      .collect();

    const recentlyAdded = products.filter((p) => p.addedAt > cutoffTime);
    const recentlyUpdated = products.filter(
      (p) => p.updatedAt > cutoffTime && p.addedAt <= cutoffTime
    );

    return {
      total: products.length,
      recentlyAdded: recentlyAdded.length,
      recentlyUpdated: recentlyUpdated.length,
      categories: [...new Set(products.map((p) => p.category))].length,
      withImages: products.filter((p) => p.externalImageUrl).length,
      withPrices: products.filter((p) => p.price).length,
    };
  },
});
