#!/usr/bin/env tsx

import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { logger } from '../../shared/logger';
import { ProductCategorizer } from './categorizer';
import type {
  CategorizeOptions,
  CategorizerResult,
  CategorizeStats,
  Category,
  Product,
} from './types';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Available cafes configuration (matching upload.ts)
const AVAILABLE_CAFES = {
  starbucks: {
    name: '스타벅스',
    slug: 'starbucks',
  },
  compose: {
    name: '컴포즈커피',
    slug: 'compose',
  },
  mega: {
    name: '메가커피',
    slug: 'mega',
  },
  paik: {
    name: '빽다방',
    slug: 'paik',
  },
  ediya: {
    name: '이디야',
    slug: 'ediya',
  },
  twosome: {
    name: '투썸플레이스',
    slug: 'twosome',
  },
  coffeebean: {
    name: '커피빈',
    slug: 'coffeebean',
  },
} as const;

type CafeSlug = keyof typeof AVAILABLE_CAFES;

// Initialize Convex client
const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl) {
  logger.error('CONVEX_URL environment variable is required');
  process.exit(1);
}

const convex = new ConvexHttpClient(convexUrl);

// Initialize categorizer
const categorizer = new ProductCategorizer();

// Helper function to handle cafe name validation and addition
function handleCafeSlug(arg: string, cafeSlugs: CafeSlug[]): void {
  if (arg in AVAILABLE_CAFES) {
    cafeSlugs.push(arg as CafeSlug);
  } else {
    logger.error(`Invalid cafe name: ${arg}`);
    logger.info(`Available cafes: ${Object.keys(AVAILABLE_CAFES).join(', ')}`);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): { cafeSlugs: CafeSlug[]; options: CategorizeOptions } {
  const args = process.argv.slice(2);
  const options: CategorizeOptions = {};
  const cafeSlugs: CafeSlug[] = [];

  // Parse flags
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--interactive':
        options.interactive = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--confidence':
        options.confidence = args[i + 1] as 'all' | 'low' | 'medium';
        i++; // Skip next argument
        break;
      case '--limit':
        options.limit = Number.parseInt(args[i + 1], 10);
        i++; // Skip next argument
        break;
      case '--force':
        options.force = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        // This should be a cafe name
        handleCafeSlug(arg, cafeSlugs);
        break;
    }
  }

  return { cafeSlugs, options };
}

// Print help information
function printHelp(): void {
  logger.info(`
🏷️  Product Categorizer

Usage:
  pnpm categorize                           # Categorize all products
  pnpm categorize starbucks                 # Categorize only Starbucks products
  pnpm categorize starbucks compose         # Categorize Starbucks and Compose products

Available Cafes:
${Object.entries(AVAILABLE_CAFES)
  .map(([key, cafe]) => `  ${key.padEnd(10)} - ${cafe.name}`)
  .join('\n')}

Options:
  --dry-run              Preview changes without updating database
  --interactive          Ask for human input on uncertain categorizations
  --verbose              Show detailed output during categorization
  --confidence <level>   Process only specific confidence levels (all|low|medium)
  --limit <number>       Limit number of products to process
  --force                Override all categories, even if they match current rules
  --help                 Show this help message

Examples:
  pnpm categorize --dry-run --verbose       # Preview with detailed output
  pnpm categorize --interactive             # Interactive mode for learning
  pnpm categorize --confidence low          # Only process low confidence items
  pnpm categorize --force                   # Force recategorization of all products
`);
}

// Get products from Convex database
async function getProducts(cafeSlug?: CafeSlug, limit?: number) {
  try {
    if (cafeSlug) {
      // Get cafe ID first
      const cafes = await convex.query(api.cafes.list);
      const cafe = cafes.find((c) => c.slug === cafeSlug);

      if (!cafe) {
        throw new Error(`Cafe not found: ${cafeSlug}`);
      }

      const products = await convex.query(api.products.getByCafe, {
        cafeId: cafe._id,
      });
      return limit ? products.slice(0, limit) : products;
    }

    const products = await convex.query(api.products.list);
    return limit ? products.slice(0, limit) : products;
  } catch (error) {
    logger.error('Failed to fetch products from database:', error);
    throw error;
  }
}

// Update product category in database
async function updateProductCategory(
  productId: string,
  category: Category,
  dryRun = false
) {
  if (dryRun) {
    logger.info(
      `[DRY RUN] Would update product ${productId} to category: ${category}`
    );
    return true;
  }

  try {
    await convex.mutation(api.products.updateCategory, {
      productId,
      category,
    });
    return true;
  } catch (error) {
    logger.error(`Failed to update product ${productId}:`, error);
    if (error instanceof Error) {
      logger.error(`Error message: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
    }
    return false;
  }
}

// Interactive mode for getting human input
function getHumanCategoryChoice(
  productName: string,
  externalCategory?: string
): Promise<Category> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const categories: Category[] = [
    '커피',
    '차',
    '블렌디드',
    '스무디',
    '주스',
    '에이드',
    '그 외',
  ];

  logger.info(`\n📦 Product: ${productName}`);
  if (externalCategory) {
    logger.info(`🏷️  External Category: ${externalCategory}`);
  }
  logger.info('\nAvailable categories:');
  categories.forEach((cat, index) => {
    logger.info(`  ${index + 1}. ${cat}`);
  });

  return new Promise((resolve) => {
    rl.question('\nSelect category (1-7): ', (answer) => {
      const choice = Number.parseInt(answer, 10);
      if (choice >= 1 && choice <= 7) {
        resolve(categories[choice - 1]);
      } else {
        logger.info('Invalid choice, defaulting to "그 외"');
        resolve('그 외');
      }
      rl.close();
    });
  });
}

// Process a single product
async function processProduct(
  product: Product,
  options: CategorizeOptions,
  stats: CategorizeStats
): Promise<void> {
  try {
    stats.processed++;

    const result = categorizer.categorize({
      externalCategory: product.externalCategory,
      name: product.name,
    });

    if (shouldSkipProduct(result, options)) {
      return;
    }

    const finalCategory = await getFinalCategory(
      product,
      result,
      options,
      stats
    );
    updateCategoryStats(result, stats);
    await handleCategoryUpdate(product, finalCategory, result, options, stats);
  } catch (error) {
    stats.errors++;
    logger.error(`Error processing product "${product.name}":`, error);
  }
}

// Check if product should be skipped based on confidence filter
function shouldSkipProduct(
  result: CategorizerResult,
  options: CategorizeOptions
): boolean {
  if (
    options.confidence &&
    options.confidence !== 'all' &&
    result.confidence !== options.confidence
  ) {
    if (options.verbose) {
      logger.info(`⏭️  Skipping product (confidence: ${result.confidence})`);
    }
    return true;
  }
  return false;
}

// Get final category, handling interactive mode
async function getFinalCategory(
  product: Product,
  result: CategorizerResult,
  options: CategorizeOptions,
  stats: CategorizeStats
): Promise<Category> {
  let finalCategory = result.category;

  if (
    options.interactive &&
    (result.confidence === 'low' || result.source === 'fallback')
  ) {
    finalCategory = await getHumanCategoryChoice(
      product.name,
      product.externalCategory
    );

    if (finalCategory !== result.category) {
      categorizer.learnFromHumanInput(
        {
          externalCategory: product.externalCategory,
          name: product.name,
        },
        finalCategory
      );
      stats.sourceBreakdown.human++;
    }
  }

  return finalCategory;
}

// Update category statistics
function updateCategoryStats(
  result: CategorizerResult,
  stats: CategorizeStats
): void {
  stats.confidenceBreakdown[result.confidence]++;
  if (result.source !== 'human') {
    stats.sourceBreakdown[result.source]++;
  }
}

// Handle category update and logging
async function handleCategoryUpdate(
  product: Product,
  finalCategory: Category,
  result: CategorizerResult,
  options: CategorizeOptions,
  stats: CategorizeStats
): Promise<void> {
  const shouldUpdate = options.force || product.category !== finalCategory;

  if (shouldUpdate) {
    const success = await updateProductCategory(
      product._id,
      finalCategory,
      options.dryRun
    );
    if (success) {
      stats.updated++;
      if (options.verbose) {
        const action =
          options.force && product.category === finalCategory
            ? 'Forced'
            : 'Updated';
        logger.info(
          `✅ ${action} "${product.name}": ${product.category} → ${finalCategory} (${result.source}, ${result.confidence})`
        );
      }
    } else {
      stats.errors++;
      logger.error(`❌ Failed to update "${product.name}"`);
    }
  } else {
    stats.unchanged++;
    if (options.verbose) {
      logger.info(
        `➡️  Unchanged "${product.name}": ${finalCategory} (${result.source}, ${result.confidence})`
      );
    }
  }
}

// Process products for a single cafe
async function processCafeProducts(
  cafeSlug: CafeSlug,
  options: CategorizeOptions,
  stats: CategorizeStats
): Promise<void> {
  const cafe = AVAILABLE_CAFES[cafeSlug];
  logger.info(`🏪 Processing ${cafe.name} products...`);

  const products = await getProducts(cafeSlug, options.limit);
  logger.info(`📦 Found ${products.length} products`);

  for (const product of products) {
    // biome-ignore lint/nursery/noAwaitInLoop: Sequential processing required for interactive mode
    await processProduct(product, options, stats);
  }
}

// Print categorization summary
function printSummary(
  stats: CategorizeStats,
  startTime: number,
  options: CategorizeOptions
): void {
  const endTime = Date.now();
  const totalTime = Math.round((endTime - startTime) / 1000);

  logger.info('='.repeat(50));
  logger.info('📊 CATEGORIZATION SUMMARY');
  logger.info(`📦 Processed: ${stats.processed} products`);
  logger.info(`✅ Updated: ${stats.updated} products`);
  logger.info(`➡️  Unchanged: ${stats.unchanged} products`);
  logger.info(`❌ Errors: ${stats.errors} products`);
  logger.info(`⏱️  Total time: ${totalTime} seconds`);

  logger.info('\n🎯 Confidence Breakdown:');
  logger.info(`  High: ${stats.confidenceBreakdown.high}`);
  logger.info(`  Medium: ${stats.confidenceBreakdown.medium}`);
  logger.info(`  Low: ${stats.confidenceBreakdown.low}`);

  logger.info('\n🔧 Source Breakdown:');
  logger.info(`  Direct: ${stats.sourceBreakdown.direct}`);
  logger.info(`  Pattern: ${stats.sourceBreakdown.pattern}`);
  logger.info(`  Fallback: ${stats.sourceBreakdown.fallback}`);
  logger.info(`  Human: ${stats.sourceBreakdown.human}`);

  if (options.dryRun) {
    logger.info('\n🔍 DRY RUN MODE - No data was actually updated');
  }

  if (options.force) {
    logger.info(
      '\n⚡ FORCE MODE - All products were processed regardless of current category'
    );
  }

  // Show categorizer statistics
  const categorizerStats = categorizer.getStats();
  logger.info('\n📈 Categorizer Statistics:');
  logger.info(
    `  Total categorizations: ${categorizerStats.totalCategorizations}`
  );
  logger.info(`  Human learnings: ${categorizerStats.humanLearnings}`);
  logger.info(
    `  Average confidence: ${categorizerStats.averageConfidence.toFixed(2)}`
  );
}

// Main categorization function
async function categorizeProducts(
  cafeSlugs: CafeSlug[],
  options: CategorizeOptions
): Promise<void> {
  const stats: CategorizeStats = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    confidenceBreakdown: { high: 0, medium: 0, low: 0 },
    sourceBreakdown: { direct: 0, pattern: 0, fallback: 0, human: 0 },
  };

  const startTime = Date.now();

  try {
    // Process each cafe or all if no specific cafes
    const cafesToProcess =
      cafeSlugs.length > 0
        ? cafeSlugs
        : (Object.keys(AVAILABLE_CAFES) as CafeSlug[]);

    for (const cafeSlug of cafesToProcess) {
      // biome-ignore lint/nursery/noAwaitInLoop: Sequential processing required for database consistency
      await processCafeProducts(cafeSlug, options, stats);
    }
  } catch (error) {
    logger.error('Error during categorization:', error);
    throw error;
  }

  printSummary(stats, startTime, options);
}

// Main execution function
async function main() {
  try {
    const { cafeSlugs, options } = parseArgs();

    logger.info('🏷️  Product Categorizer Starting');
    if (cafeSlugs.length > 0) {
      logger.info(`🏪 Cafes to process: ${cafeSlugs.join(', ')}`);
    } else {
      logger.info('🏪 Processing all cafes');
    }

    if (options.dryRun) {
      logger.info('🔍 DRY RUN MODE - No data will be updated');
    }

    if (options.interactive) {
      logger.info('🤝 INTERACTIVE MODE - Will ask for human input');
    }

    if (options.force) {
      logger.info('⚡ FORCE MODE - Will override all categories');
    }

    logger.info('='.repeat(50));

    await categorizeProducts(cafeSlugs, options);

    logger.info('🎉 Categorization completed successfully!');
  } catch (error) {
    logger.error('Fatal error in categorizer:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
