#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../../shared/logger';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Available crawlers configuration for testing
const AVAILABLE_CRAWLERS = {
  starbucks: {
    file: 'starbucks-crawler.ts',
    name: '스타벅스',
    brand: 'Starbucks',
  },
  compose: {
    file: 'compose-crawler.ts',
    name: '컴포즈커피',
    brand: 'Compose Coffee',
  },
  mega: {
    file: 'mega-crawler.ts',
    name: '메가커피',
    brand: 'Mega Coffee',
  },
  paik: {
    file: 'paik-crawler.ts',
    name: '빽다방',
    brand: "Paik's Coffee",
  },
  ediya: {
    file: 'ediya-crawler.ts',
    name: '이디야',
    brand: 'Ediya Coffee',
  },
  twosome: {
    file: 'twosome-crawler.ts',
    name: '투썸플레이스',
    brand: 'A Twosome Place',
  },
  coffeebean: {
    file: 'coffeebean-crawler.ts',
    name: '커피빈',
    brand: 'The Coffee Bean & Tea Leaf',
  },
  hollys: {
    file: 'hollys-crawler.ts',
    name: '할리스',
    brand: 'Hollys Coffee',
  },
} as const;

type CrawlerName = keyof typeof AVAILABLE_CRAWLERS;

// Test configuration
const TEST_CONFIG = {
  maxProductsPerCrawler: 3,
  timeoutPerCrawler: 180_000, // 3 minutes per crawler
} as const;

// Test result interface
interface TestResult {
  crawlerName: CrawlerName;
  brandName: string;
  success: boolean;
  duration: number;
  error?: string;
  output?: string;
}

// Create environment variables to limit crawler behavior
function createTestEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // Set environment variables that crawlers can read to limit their behavior
    CRAWLER_TEST_MODE: 'true',
    CRAWLER_MAX_PRODUCTS: TEST_CONFIG.maxProductsPerCrawler.toString(),
    CRAWLER_MAX_REQUESTS: '10', // Limit total requests
    CRAWLER_TIMEOUT: '60000', // 1 minute timeout
  };
}

// Run a single crawler with test limitations
function runCrawlerTest(crawlerName: CrawlerName): Promise<TestResult> {
  return new Promise((resolve) => {
    const crawler = AVAILABLE_CRAWLERS[crawlerName];
    const crawlerPath = path.join(__dirname, crawler.file);
    const startTime = Date.now();

    logger.info(
      `🧪 Testing ${crawler.brand} crawler (max ${TEST_CONFIG.maxProductsPerCrawler} products)...`
    );

    let output = '';
    let hasError = false;

    const child = spawn('tsx', [crawlerPath], {
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: createTestEnv(),
    });

    // Capture stdout and stderr
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text); // Also show in real-time
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text); // Also show in real-time
      hasError = true;
    });

    // Set up timeout
    const timeout = setTimeout(() => {
      logger.warn(
        `⏰ ${crawler.brand} crawler timed out after ${TEST_CONFIG.timeoutPerCrawler}ms`
      );
      child.kill('SIGKILL');
    }, TEST_CONFIG.timeoutPerCrawler);

    child.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      if (code === 0 && !hasError) {
        logger.info(
          `✅ ${crawler.brand} crawler test completed successfully in ${duration}ms`
        );
        resolve({
          crawlerName,
          brandName: crawler.brand,
          success: true,
          duration,
          output,
        });
      } else {
        logger.error(
          `❌ ${crawler.brand} crawler test failed with exit code ${code}`
        );
        resolve({
          crawlerName,
          brandName: crawler.brand,
          success: false,
          duration,
          error: `Exit code ${code}`,
          output,
        });
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      logger.error(
        `❌ Failed to start ${crawler.brand} crawler: ${error.message}`
      );
      resolve({
        crawlerName,
        brandName: crawler.brand,
        success: false,
        duration,
        error: error.message,
        output,
      });
    });
  });
}

// Parse command line arguments
function parseArgs(): CrawlerName[] {
  const args = process.argv.slice(2);

  // Check for help flags
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args.length === 0) {
    // No arguments - test all crawlers
    return Object.keys(AVAILABLE_CRAWLERS) as CrawlerName[];
  }

  // Validate crawler names
  const validCrawlers: CrawlerName[] = [];
  const invalidCrawlers: string[] = [];

  for (const arg of args) {
    if (arg in AVAILABLE_CRAWLERS) {
      validCrawlers.push(arg as CrawlerName);
    } else {
      invalidCrawlers.push(arg);
    }
  }

  if (invalidCrawlers.length > 0) {
    logger.error(`Invalid crawler names: ${invalidCrawlers.join(', ')}`);
    logger.info(
      `Available crawlers: ${Object.keys(AVAILABLE_CRAWLERS).join(', ')}`
    );
    process.exit(1);
  }

  return validCrawlers;
}

// Print help information
function printHelp(): void {
  logger.info(`
🧪 Crawler Test Suite

This test runs crawlers with limitations to verify they work without errors.
Each crawler is limited to ${TEST_CONFIG.maxProductsPerCrawler} products and has a ${TEST_CONFIG.timeoutPerCrawler / 1000}s timeout.

Usage:
  pnpm test-crawlers                   # Test all crawlers
  pnpm test-crawlers starbucks         # Test only Starbucks crawler
  pnpm test-crawlers starbucks compose # Test Starbucks and Compose crawlers

Available Crawlers:
${Object.entries(AVAILABLE_CRAWLERS)
  .map(([key, crawler]) => `  ${key.padEnd(10)} - ${crawler.brand}`)
  .join('\n')}

Options:
  --help, -h         Show this help message
`);
}

// Print test summary
function printTestSummary(results: TestResult[]): void {
  logger.info('='.repeat(60));
  logger.info('🧪 CRAWLER TEST RESULTS');
  logger.info('='.repeat(60));

  let totalSuccess = 0;
  let totalDuration = 0;

  for (const result of results) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const duration = `${result.duration}ms`;

    logger.info(
      `${status} ${result.brandName.padEnd(20)} ${duration.padEnd(10)}`
    );

    if (result.success) {
      totalSuccess++;

      // Try to extract product count from output
      const productMatches = result.output?.match(
        /✅ Extracted:|Added \d+ products/g
      );
      if (productMatches) {
        logger.info(
          `     Products extracted: ~${Math.min(productMatches.length, TEST_CONFIG.maxProductsPerCrawler)}`
        );
      }
    } else {
      logger.error(`     Error: ${result.error}`);
    }

    totalDuration += result.duration;
  }

  logger.info('='.repeat(60));
  logger.info(`📊 RESULTS: ${totalSuccess}/${results.length} crawlers passed`);
  logger.info(`⏱️ Total duration: ${totalDuration}ms`);

  if (totalSuccess === results.length) {
    logger.info('🎉 All crawlers are working correctly!');
  } else {
    logger.warn(`⚠️ ${results.length - totalSuccess} crawlers need attention`);
  }
}

// Main execution function
async function main(): Promise<void> {
  try {
    const crawlersToTest = parseArgs();

    logger.info('🧪 Crawler Test Suite Starting');
    logger.info(
      `📊 Testing with max ${TEST_CONFIG.maxProductsPerCrawler} products per crawler`
    );
    logger.info(
      `⏱️ Timeout per crawler: ${TEST_CONFIG.timeoutPerCrawler / 1000}s`
    );
    logger.info(`📋 Crawlers to test: ${crawlersToTest.join(', ')}`);
    logger.info('='.repeat(60));

    const results: TestResult[] = [];

    // Run crawler tests sequentially to avoid resource conflicts
    for (const crawlerName of crawlersToTest) {
      try {
        // biome-ignore lint/nursery/noAwaitInLoop: Sequential testing required
        const result = await runCrawlerTest(crawlerName);
        results.push(result);
      } catch (error) {
        logger.error(`Unexpected error testing ${crawlerName}: ${error}`);
        results.push({
          crawlerName,
          brandName: AVAILABLE_CRAWLERS[crawlerName].brand,
          success: false,
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Add a small delay between tests
      if (crawlersToTest.indexOf(crawlerName) < crawlersToTest.length - 1) {
        logger.info('⏳ Waiting 3 seconds before next test...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

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

process.on('SIGTERM', () => {
  logger.info('🛑 Received SIGTERM, shutting down test suite...');
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  logger.error('💥 Unhandled error in test suite:', error);
  process.exit(1);
});
