#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import path from 'node:path';
import { logger } from '../shared/logger';

// Available crawlers configuration
const AVAILABLE_CRAWLERS = {
  starbucks: {
    file: 'starbucks-crawler.ts',
    name: 'Starbucks Korea',
    description: 'Crawls Starbucks Korea menu items',
  },
  compose: {
    file: 'compose-crawler.ts',
    name: 'Compose Coffee',
    description: 'Crawls Compose Coffee menu items',
  },
} as const;

type CrawlerName = keyof typeof AVAILABLE_CRAWLERS;

// Parse command line arguments
function parseArgs(): CrawlerName[] {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // No arguments - run all crawlers
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

// Run a single crawler
function runCrawler(crawlerName: CrawlerName): Promise<void> {
  return new Promise((resolve, reject) => {
    const crawler = AVAILABLE_CRAWLERS[crawlerName];
    const crawlerPath = path.join(__dirname, crawler.file);

    logger.info(`🚀 Starting ${crawler.name} crawler...`);
    logger.info(`📄 Description: ${crawler.description}`);

    const child = spawn('tsx', [crawlerPath], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    child.on('close', (code) => {
      if (code === 0) {
        logger.info(`✅ ${crawler.name} crawler completed successfully`);
        resolve();
      } else {
        logger.error(
          `❌ ${crawler.name} crawler failed with exit code ${code}`
        );
        reject(
          new Error(`Crawler ${crawlerName} failed with exit code ${code}`)
        );
      }
    });

    child.on('error', (error) => {
      logger.error(
        `❌ Failed to start ${crawler.name} crawler: ${error.message}`
      );
      reject(error);
    });
  });
}

// Main execution function
async function main() {
  try {
    const crawlersToRun = parseArgs();

    logger.info('🎯 Crawler Runner Starting');
    logger.info(`📋 Crawlers to run: ${crawlersToRun.join(', ')}`);
    logger.info('='.repeat(50));

    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    // Run crawlers sequentially to avoid resource conflicts
    for (const crawlerName of crawlersToRun) {
      try {
        // biome-ignore lint/nursery/noAwaitInLoop: run crawler sequentially
        await runCrawler(crawlerName);
        successCount++;
      } catch (error) {
        logger.error(`Failed to run ${crawlerName}: ${error}`);
        failCount++;
      }

      // Add a small delay between crawlers
      if (crawlersToRun.indexOf(crawlerName) < crawlersToRun.length - 1) {
        logger.info('⏳ Waiting 3 seconds before next crawler...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    const endTime = Date.now();
    const totalTime = Math.round((endTime - startTime) / 1000);

    // Final summary
    logger.info('='.repeat(50));
    logger.info('📊 CRAWLER RUN SUMMARY');
    logger.info(
      `✅ Successful: ${successCount}/${crawlersToRun.length} crawlers`
    );
    logger.info(`❌ Failed: ${failCount}/${crawlersToRun.length} crawlers`);
    logger.info(`⏱️  Total time: ${totalTime} seconds`);

    if (failCount > 0) {
      logger.error('Some crawlers failed. Check logs above for details.');
      process.exit(1);
    } else {
      logger.info('🎉 All crawlers completed successfully!');
    }
  } catch (error) {
    logger.error('Fatal error in crawler runner:', error);
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
