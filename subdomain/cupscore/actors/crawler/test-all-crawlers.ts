import type { PlaywrightCrawler } from 'crawlee';
import { logger } from '../../shared/logger';
import { createComposeCrawler } from './compose-crawler';
import type { Product } from './crawlerUtils';
import { createMegaCrawler } from './mega-crawler';
import { createPaikCrawler } from './paik-crawler';
import { createStarbucksCrawler } from './starbucks-crawler';

// ================================================
// TEST CONFIGURATION
// ================================================

const TEST_CONFIG = {
  maxProductsPerCrawler: 3,
  timeoutPerCrawler: 120_000, // 2 minutes per crawler
} as const;

// ================================================
// CRAWLER DEFINITIONS
// ================================================

interface CrawlerDefinition {
  name: string;
  brandName: string;
  startUrl: string;
  createCrawler: () => PlaywrightCrawler;
}

const CRAWLERS: CrawlerDefinition[] = [
  {
    name: 'starbucks',
    brandName: 'Starbucks',
    startUrl: 'https://www.starbucks.co.kr/menu/drink_list.do',
    createCrawler: createStarbucksCrawler,
  },
  {
    name: 'compose',
    brandName: 'Compose Coffee',
    startUrl: 'https://composecoffee.com/menu',
    createCrawler: createComposeCrawler,
  },
  {
    name: 'paik',
    brandName: "Paik's Coffee",
    startUrl: 'https://paikdabang.com/menu/menu_new/',
    createCrawler: createPaikCrawler,
  },
  {
    name: 'mega',
    brandName: 'Mega Coffee',
    startUrl: 'https://www.mega-mgccoffee.com/menu/',
    createCrawler: createMegaCrawler,
  },
];

// ================================================
// TEST UTILITIES
// ================================================

interface TestResult {
  crawlerName: string;
  brandName: string;
  success: boolean;
  productsExtracted: number;
  duration: number;
  error?: string;
  sampleProducts?: Product[];
}

function createLimitedCrawler(
  baseCrawler: PlaywrightCrawler,
  maxProducts: number
): PlaywrightCrawler {
  let productCount = 0;
  const originalPushData = baseCrawler.pushData;

  // Override pushData to limit products
  baseCrawler.pushData = async function (data: any) {
    if (productCount >= maxProducts) {
      logger.info(`📊 Product limit (${maxProducts}) reached for crawler`);
      return;
    }
    productCount++;
    return originalPushData.call(this, data);
  };

  return baseCrawler;
}

async function testCrawler(crawlerDef: CrawlerDefinition): Promise<TestResult> {
  const startTime = Date.now();
  logger.info(`🚀 Testing ${crawlerDef.brandName} crawler...`);

  try {
    // Create crawler with product limit
    const baseCrawler = crawlerDef.createCrawler();
    const limitedCrawler = createLimitedCrawler(
      baseCrawler,
      TEST_CONFIG.maxProductsPerCrawler
    );

    // Set up timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout after ${TEST_CONFIG.timeoutPerCrawler}ms`));
      }, TEST_CONFIG.timeoutPerCrawler);
    });

    // Run crawler with timeout
    await Promise.race([
      limitedCrawler.run([crawlerDef.startUrl]),
      timeoutPromise,
    ]);

    // Get results
    const dataset = await limitedCrawler.getData();
    const products = dataset.items as Product[];
    const duration = Date.now() - startTime;

    logger.info(
      `✅ ${crawlerDef.brandName} crawler completed: ${products.length} products in ${duration}ms`
    );

    return {
      crawlerName: crawlerDef.name,
      brandName: crawlerDef.brandName,
      success: true,
      productsExtracted: products.length,
      duration,
      sampleProducts: products.slice(0, 3), // First 3 products as samples
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`❌ ${crawlerDef.brandName} crawler failed: ${errorMessage}`);

    return {
      crawlerName: crawlerDef.name,
      brandName: crawlerDef.brandName,
      success: false,
      productsExtracted: 0,
      duration,
      error: errorMessage,
    };
  }
}

// ================================================
// TEST EXECUTION
// ================================================

async function runAllCrawlerTests(): Promise<TestResult[]> {
  logger.info('🧪 Starting crawler test suite...');
  logger.info(
    `📊 Limiting each crawler to ${TEST_CONFIG.maxProductsPerCrawler} products`
  );
  logger.info(
    `⏱️ Timeout per crawler: ${TEST_CONFIG.timeoutPerCrawler / 1000}s`
  );
  logger.info('='.repeat(60));

  const results: TestResult[] = [];

  // Run crawlers sequentially to avoid conflicts
  for (const crawlerDef of CRAWLERS) {
    try {
      const result = await testCrawler(crawlerDef);
      results.push(result);

      // Small delay between crawlers
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      logger.error(`💥 Fatal error testing ${crawlerDef.brandName}:`, error);
      results.push({
        crawlerName: crawlerDef.name,
        brandName: crawlerDef.brandName,
        success: false,
        productsExtracted: 0,
        duration: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

function printTestSummary(results: TestResult[]): void {
  logger.info('='.repeat(60));
  logger.info('📋 CRAWLER TEST SUMMARY');
  logger.info('='.repeat(60));

  let totalSuccess = 0;
  let totalProducts = 0;
  let totalDuration = 0;

  for (const result of results) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const duration = `${result.duration}ms`;
    const products = `${result.productsExtracted} products`;

    logger.info(
      `${status} ${result.brandName.padEnd(20)} ${duration.padEnd(10)} ${products}`
    );

    if (result.success) {
      totalSuccess++;
      totalProducts += result.productsExtracted;

      // Show sample products
      if (result.sampleProducts && result.sampleProducts.length > 0) {
        logger.info('     Sample products:');
        for (const product of result.sampleProducts.slice(0, 2)) {
          logger.info(`       - ${product.name} (${product.category})`);
        }
      }
    } else {
      logger.error(`     Error: ${result.error}`);
    }

    totalDuration += result.duration;
  }

  logger.info('='.repeat(60));
  logger.info(`📊 RESULTS: ${totalSuccess}/${results.length} crawlers passed`);
  logger.info(`🎯 Total products extracted: ${totalProducts}`);
  logger.info(`⏱️ Total duration: ${totalDuration}ms`);

  if (totalSuccess === results.length) {
    logger.info('🎉 All crawlers are working correctly!');
  } else {
    logger.warn(`⚠️ ${results.length - totalSuccess} crawlers need attention`);
  }
}

// ================================================
// MAIN EXECUTION
// ================================================

async function main(): Promise<void> {
  try {
    const results = await runAllCrawlerTests();
    printTestSummary(results);

    // Exit with error code if any crawler failed
    const hasFailures = results.some((r) => !r.success);
    if (hasFailures) {
      process.exit(1);
    }
  } catch (error) {
    logger.error('💥 Fatal error in test suite:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down test suite...');
  process.exit(0);
});

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('💥 Unhandled error in test suite:', error);
    process.exit(1);
  });
}

export { runAllCrawlerTests, type TestResult };
