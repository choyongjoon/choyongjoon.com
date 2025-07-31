import { v } from 'convex/values';
import { api } from './_generated/api';
import { mutation } from './_generated/server';

interface CrawlerProduct {
  name: string;
  name_en: string;
  description: string;
  category_origin: string;
  id_origin: string;
  image: string;
  url: string;
  price: string;
  category: string;
}

interface ProcessedProduct {
  name: string;
  category: string;
  price: number | undefined;
  description: string;
  calories: number | undefined;
  imageUrl: string;
  isDiscontinued: boolean;
  externalId: string;
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

// Helper function to transform raw product data
function transformProductData(
  rawProduct: unknown,
  results: UploadResults
): ProcessedProduct | null {
  try {
    const crawlerProduct = rawProduct as CrawlerProduct;

    // Skip if missing required fields
    if (!(crawlerProduct.name && crawlerProduct.id_origin)) {
      results.skipped++;
      return null;
    }

    const processed: ProcessedProduct = {
      name: crawlerProduct.name.trim(),
      category: mapCategory(
        crawlerProduct.category_origin || crawlerProduct.category || 'Other'
      ),
      price: parsePrice(crawlerProduct.price),
      description: crawlerProduct.description?.trim() || '',
      calories: undefined, // Not available in crawler data
      imageUrl: crawlerProduct.image || '',
      isDiscontinued: false, // Default to false, can be updated later
      externalId: crawlerProduct.id_origin,
    };

    results.processed++;
    return processed;
  } catch (error) {
    results.errors.push(`Failed to process product: ${error}`);
    return null;
  }
}

// Helper function to upload products to database
async function uploadProductsToDatabase(
  ctx: {
    runMutation: (mutation: any, args: any) => Promise<{ action: string }>;
  },
  processedProducts: ProcessedProduct[],
  cafeId: string,
  results: UploadResults
) {
  for (const product of processedProducts) {
    try {
      const result = await ctx.runMutation(api.products.upsertProduct, {
        ...product,
        cafeId,
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

    const processedProducts: ProcessedProduct[] = [];

    // Transform crawler data to our format
    for (const rawProduct of products) {
      const processed = transformProductData(rawProduct, results);
      if (processed) {
        processedProducts.push(processed);
      }
    }

    if (dryRun) {
      results.processingTime = Date.now() - startTime;
      return {
        ...results,
        message: `Dry run completed. Would process ${processedProducts.length} products.`,
        samples: processedProducts.slice(0, 3), // Show first 3 as samples
      };
    }

    // Upload processed products
    await uploadProductsToDatabase(ctx, processedProducts, cafeId, results);

    results.processingTime = Date.now() - startTime;

    return {
      ...results,
      message: `Upload completed in ${results.processingTime}ms. Created: ${results.created}, Updated: ${results.updated}, Unchanged: ${results.unchanged}`,
    };
  },
});

function mapCategory(originalCategory: string): string {
  const categoryMap: Record<string, string> = {
    '콜드 브루': 'Cold Brew',
    에스프레소: 'Espresso',
    '블론드 에스프레소': 'Blonde Espresso',
    '브루드 커피': 'Brewed Coffee',
    디카페인: 'Decaf',
    프라푸치노: 'Frappuccino',
    블렌디드: 'Blended',
    티: 'Tea',
    기타: 'Other',
    Drinks: 'Beverages',
    Food: 'Food',
    '웹사이트 비노출 메뉴(사이렌오더 영양정보 연동)': 'Limited Menu',
  };

  return categoryMap[originalCategory] || originalCategory;
}

function parsePrice(priceString: string): number | undefined {
  if (!priceString) {
    return;
  }

  // Handle "Price varies by size" or similar
  if (
    priceString.toLowerCase().includes('varies') ||
    priceString.toLowerCase().includes('사이즈')
  ) {
    return;
  }

  // Extract numbers from price string
  const numbers = priceString.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    return Number.parseInt(numbers[0], 10);
  }

  return;
}

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
      withImages: products.filter((p) => p.imageUrl).length,
      withPrices: products.filter((p) => p.price).length,
    };
  },
});
