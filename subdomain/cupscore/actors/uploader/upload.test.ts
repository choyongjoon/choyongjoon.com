#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../../shared/logger';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Available cafes configuration for testing
const AVAILABLE_CAFES = {
  starbucks: {
    name: '스타벅스',
    slug: 'starbucks',
    brand: 'Starbucks',
  },
  compose: {
    name: '컴포즈커피',
    slug: 'compose',
    brand: 'Compose Coffee',
  },
  mega: {
    name: '메가커피',
    slug: 'mega',
    brand: 'Mega Coffee',
  },
  paik: {
    name: '빽다방',
    slug: 'paik',
    brand: "Paik's Coffee",
  },
  ediya: {
    name: '이디야',
    slug: 'ediya',
    brand: 'Ediya Coffee',
  },
  twosome: {
    name: '투썸플레이스',
    slug: 'twosome',
    brand: 'A Twosome Place',
  },
} as const;

type CafeSlug = keyof typeof AVAILABLE_CAFES;

// Test configuration
const TEST_CONFIG = {
  timeout: 60_000, // 1 minute timeout per upload test
} as const;

// Test result interface
interface TestResult {
  cafeSlug: CafeSlug;
  brandName: string;
  success: boolean;
  duration: number;
  error?: string;
  output?: string;
  productsFound?: number;
}

// Create environment variables for test mode
function createTestEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // Ensure we're using dry-run mode for tests
    UPLOAD_TEST_MODE: 'true',
  };
}

// Generate test data for a cafe if no recent file exists
function generateTestData(cafeSlug: string): string {
  const outputDir = path.join(
    process.cwd(),
    'actors',
    'crawler',
    'crawler-outputs'
  );

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const testData = [
    {
      name: `Test ${cafeSlug} Product 1`,
      nameEn: `Test ${cafeSlug} Product 1 EN`,
      description: `Test description for ${cafeSlug} product 1`,
      price: null,
      externalImageUrl: `https://example.com/${cafeSlug}-1.jpg`,
      category: 'Test Category',
      externalCategory: 'Test Category',
      externalId: `test_${cafeSlug}_1`,
      externalUrl: `https://example.com/${cafeSlug}/1`,
    },
    {
      name: `Test ${cafeSlug} Product 2`,
      nameEn: `Test ${cafeSlug} Product 2 EN`,
      description: `Test description for ${cafeSlug} product 2`,
      price: null,
      externalImageUrl: `https://example.com/${cafeSlug}-2.jpg`,
      category: 'Test Category',
      externalCategory: 'Test Category',
      externalId: `test_${cafeSlug}_2`,
      externalUrl: `https://example.com/${cafeSlug}/2`,
    },
    {
      name: `Test ${cafeSlug} Product 3`,
      nameEn: `Test ${cafeSlug} Product 3 EN`,
      description: `Test description for ${cafeSlug} product 3`,
      price: null,
      externalImageUrl: `https://example.com/${cafeSlug}-3.jpg`,
      category: 'Test Category',
      externalCategory: 'Test Category',
      externalId: `test_${cafeSlug}_3`,
      externalUrl: `https://example.com/${cafeSlug}/3`,
    },
  ];

  const today = new Date().toISOString().split('T')[0];
  const testFileName = `${cafeSlug}-products-${today}-test.json`;
  const testFilePath = path.join(outputDir, testFileName);

  fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2));
  logger.info(`📄 Generated test data file: ${testFileName}`);

  return testFilePath;
}

// Find the latest file for a specific cafe or generate test data
function findOrCreateTestFile(cafeSlug: string): string {
  const outputDir = path.join(
    process.cwd(),
    'actors',
    'crawler',
    'crawler-outputs'
  );

  if (!fs.existsSync(outputDir)) {
    return generateTestData(cafeSlug);
  }

  const cafePattern = `${cafeSlug}-products-`;
  const files = fs
    .readdirSync(outputDir)
    .filter((file) => file.startsWith(cafePattern) && file.endsWith('.json'))
    .map((file) => ({
      name: file,
      path: path.join(outputDir, file),
      mtime: fs.statSync(path.join(outputDir, file)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (files.length > 0) {
    logger.info(`📁 Using existing file: ${files[0].name}`);
    return files[0].path;
  }

  return generateTestData(cafeSlug);
}

// Run a single upload test with dry-run mode
function runUploadTest(cafeSlug: CafeSlug): Promise<TestResult> {
  return new Promise((resolve) => {
    const cafe = AVAILABLE_CAFES[cafeSlug];
    const uploaderPath = path.join(__dirname, 'uploader.ts');
    const startTime = Date.now();

    logger.info(`🧪 Testing ${cafe.brand} upload (dry-run mode)...`);

    // Find or create test file
    const testFilePath = findOrCreateTestFile(cafe.slug);

    let output = '';
    let hasError = false;

    const child = spawn(
      'tsx',
      [
        uploaderPath,
        '--cafe-slug',
        cafe.slug,
        '--file',
        testFilePath,
        '--dry-run', // Always use dry-run for tests
        '--verbose',
      ],
      {
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: createTestEnv(),
      }
    );

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
        `⏰ ${cafe.brand} upload test timed out after ${TEST_CONFIG.timeout}ms`
      );
      child.kill('SIGKILL');
    }, TEST_CONFIG.timeout);

    child.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      // Try to extract product count from output
      const productMatches = output.match(/processed:\s*(\d+)/i);
      const productsFound = productMatches
        ? Number.parseInt(productMatches[1], 10)
        : 0;

      if (code === 0 && !hasError) {
        logger.info(
          `✅ ${cafe.brand} upload test completed successfully in ${duration}ms`
        );
        resolve({
          cafeSlug,
          brandName: cafe.brand,
          success: true,
          duration,
          output,
          productsFound,
        });
      } else {
        logger.error(
          `❌ ${cafe.brand} upload test failed with exit code ${code}`
        );
        resolve({
          cafeSlug,
          brandName: cafe.brand,
          success: false,
          duration,
          error: `Exit code ${code}`,
          output,
          productsFound,
        });
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      logger.error(
        `❌ Failed to start ${cafe.brand} upload test: ${error.message}`
      );
      resolve({
        cafeSlug,
        brandName: cafe.brand,
        success: false,
        duration,
        error: error.message,
        output,
      });
    });
  });
}

// Parse command line arguments
function parseArgs(): CafeSlug[] {
  const args = process.argv.slice(2);

  // Check for help flags
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args.length === 0) {
    // No arguments - test all cafes
    return Object.keys(AVAILABLE_CAFES) as CafeSlug[];
  }

  // Validate cafe names
  const validCafes: CafeSlug[] = [];
  const invalidCafes: string[] = [];

  for (const arg of args) {
    if (arg in AVAILABLE_CAFES) {
      validCafes.push(arg as CafeSlug);
    } else {
      invalidCafes.push(arg);
    }
  }

  if (invalidCafes.length > 0) {
    logger.error(`Invalid cafe names: ${invalidCafes.join(', ')}`);
    logger.info(`Available cafes: ${Object.keys(AVAILABLE_CAFES).join(', ')}`);
    process.exit(1);
  }

  return validCafes;
}

// Print help information
function printHelp(): void {
  logger.info(`
🧪 Upload Test Suite

This test runs upload operations in dry-run mode to verify they work without errors.
All tests use dry-run mode and will not upload data to the database.

Usage:
  pnpm test:upload                   # Test all cafes
  pnpm test:upload starbucks         # Test only Starbucks upload
  pnpm test:upload starbucks compose # Test Starbucks and Compose uploads

Available Cafes:
${Object.entries(AVAILABLE_CAFES)
  .map(([key, cafe]) => `  ${key.padEnd(10)} - ${cafe.brand}`)
  .join('\n')}

Options:
  --help, -h         Show this help message

Note: All tests run in dry-run mode and use test data if no recent crawler output is found.
`);
}

// Print test summary
function printTestSummary(results: TestResult[]): void {
  logger.info('='.repeat(60));
  logger.info('🧪 UPLOAD TEST RESULTS');
  logger.info('='.repeat(60));

  let totalSuccess = 0;
  let totalDuration = 0;
  let totalProducts = 0;

  for (const result of results) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const duration = `${result.duration}ms`;
    const products =
      result.productsFound !== undefined
        ? `${result.productsFound} products`
        : 'unknown';

    logger.info(
      `${status} ${result.brandName.padEnd(20)} ${duration.padEnd(10)} ${products}`
    );

    if (result.success) {
      totalSuccess++;
      if (result.productsFound !== undefined) {
        totalProducts += result.productsFound;
      }
    } else {
      logger.error(`     Error: ${result.error}`);
    }

    totalDuration += result.duration;
  }

  logger.info('='.repeat(60));
  logger.info(`📊 RESULTS: ${totalSuccess}/${results.length} uploads passed`);
  logger.info(`📦 Total products processed: ${totalProducts}`);
  logger.info(`⏱️ Total duration: ${totalDuration}ms`);

  if (totalSuccess === results.length) {
    logger.info('🎉 All upload tests are working correctly!');
  } else {
    logger.warn(`⚠️ ${results.length - totalSuccess} uploads need attention`);
  }
}

// Main execution function
async function main(): Promise<void> {
  try {
    const cafesToTest = parseArgs();

    logger.info('🧪 Upload Test Suite Starting');
    logger.info('🔍 All tests run in dry-run mode (no data uploaded)');
    logger.info(`⏱️ Timeout per test: ${TEST_CONFIG.timeout / 1000}s`);
    logger.info(`📋 Cafes to test: ${cafesToTest.join(', ')}`);
    logger.info('='.repeat(60));

    const results: TestResult[] = [];

    // Run upload tests sequentially to avoid conflicts
    for (const cafeSlug of cafesToTest) {
      try {
        // biome-ignore lint/nursery/noAwaitInLoop: Sequential testing required
        const result = await runUploadTest(cafeSlug);
        results.push(result);
      } catch (error) {
        logger.error(`Unexpected error testing ${cafeSlug}: ${error}`);
        results.push({
          cafeSlug,
          brandName: AVAILABLE_CAFES[cafeSlug].brand,
          success: false,
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Add a small delay between tests
      if (cafesToTest.indexOf(cafeSlug) < cafesToTest.length - 1) {
        logger.info('⏳ Waiting 2 seconds before next test...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    printTestSummary(results);

    // Exit with error code if any upload failed
    const hasFailures = results.some((r) => !r.success);
    if (hasFailures) {
      process.exit(1);
    }
  } catch (error) {
    logger.error('💥 Fatal error in upload test suite:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down upload test suite...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 Received SIGTERM, shutting down upload test suite...');
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  logger.error('💥 Unhandled error in upload test suite:', error);
  process.exit(1);
});
