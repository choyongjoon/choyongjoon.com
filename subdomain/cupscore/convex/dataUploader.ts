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
  category: string | null;
  imageStorageId?: Id<'_storage'>;
}
interface UploadResults {
  processed: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  removed: number;
  reactivated: number;
  errors: string[];
  processingTime: number;
  removedProducts?: string[];
  reactivatedProducts?: string[];
}

// Helper function to upload products to database
async function uploadProductsToDatabase(
  ctx: GenericMutationCtx<GenericDataModel>,
  products: CrawlerProduct[],
  cafeId: Id<'cafes'>,
  results: UploadResults,
  downloadImages = false
) {
  for (const product of products) {
    try {
      const result = await ctx.runMutation(api.products.upsertProduct, {
        ...product,
        cafeId,
        category: product.category ?? undefined,
        nameEn: product.nameEn ?? undefined,
        description: product.description ?? undefined,
        externalCategory: product.externalCategory ?? undefined,
        externalImageUrl: product.externalImageUrl ?? undefined,
        price: product.price ?? undefined,
        downloadImages,
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
    cafeSlug: v.string(),
    dryRun: v.optional(v.boolean()),
    downloadImages: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { products, cafeSlug, dryRun = false, downloadImages = false }
  ) => {
    const startTime = Date.now();

    // Find or create cafe
    const cafe = await ctx.runQuery(api.cafes.getBySlug, {
      slug: cafeSlug,
    });

    if (!cafe) {
      throw new Error(`Cafe not found: ${cafeSlug}`);
    }

    const results: UploadResults = {
      processed: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: [],
      skipped: 0,
      removed: 0,
      reactivated: 0,
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
    await uploadProductsToDatabase(
      ctx,
      products,
      cafe._id,
      results,
      downloadImages
    );

    // After uploading, check for removed products
    const currentExternalIds = products.map((p) => p.externalId);
    const removalResults = await ctx.runMutation(
      api.products.markProductsAsRemoved,
      {
        cafeId: cafe._id,
        currentExternalIds,
      }
    );

    // Update results with removal information
    results.removed = removalResults.removed;
    results.reactivated = removalResults.reactivated;
    results.removedProducts = removalResults.removedProducts;
    results.reactivatedProducts = removalResults.reactivatedProducts;

    results.processingTime = Date.now() - startTime;

    let message = `Upload completed in ${results.processingTime}ms. Created: ${results.created}, Updated: ${results.updated}, Unchanged: ${results.unchanged}`;

    if (results.removed > 0) {
      message += `, Removed: ${results.removed}`;
    }

    if (results.reactivated > 0) {
      message += `, Reactivated: ${results.reactivated}`;
    }

    return {
      ...results,
      message,
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

export const downloadAndStoreImage = mutation({
  args: {
    imageUrl: v.string(),
    productId: v.id('products'),
  },
  handler: async (ctx, { imageUrl, productId }) => {
    try {
      // Fetch the image from the external URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      // Get the image data
      const imageBuffer = await response.arrayBuffer();
      const imageBlob = new Blob([imageBuffer]);

      // Generate upload URL and store the image
      const uploadUrl = await ctx.storage.generateUploadUrl();

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        },
        body: imageBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
      }

      const { storageId } = await uploadResponse.json();

      // Update the product with the storage ID
      const now = Date.now();
      await ctx.db.patch(productId, {
        imageStorageId: storageId,
        updatedAt: now,
      });

      return { success: true, storageId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

export const bulkDownloadImages = mutation({
  args: {
    cafeSlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cafeSlug, limit = 10 }) => {
    const cafe = await ctx.db
      .query('cafes')
      .withIndex('by_slug', (q) => q.eq('slug', cafeSlug))
      .first();

    if (!cafe) {
      throw new Error(`Cafe not found: ${cafeSlug}`);
    }

    // Find products with external image URLs but no storage ID
    const products = await ctx.db
      .query('products')
      .withIndex('by_cafe', (q) => q.eq('cafeId', cafe._id))
      .collect();

    const productsToProcess = products
      .filter((p) => p.externalImageUrl && !p.imageStorageId)
      .slice(0, limit);

    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const product of productsToProcess) {
      results.processed++;

      try {
        const result = await ctx.runMutation(
          api.dataUploader.downloadAndStoreImage,
          {
            imageUrl: product.externalImageUrl || '',
            productId: product._id,
          }
        );

        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`${product.name}: ${result.error}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${product.name}: ${error}`);
      }
    }

    return results;
  },
});
