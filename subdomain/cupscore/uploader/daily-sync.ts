#!/usr/bin/env ts-node
import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import { logger } from '../shared/logger';
import { ProductUploader } from './upload-products';

interface SyncConfig {
  schedule: string; // Cron expression
  cafeName: string;
  cafeSlug: string;
  logFile?: string;
  enabled: boolean;
}

class DailySyncService {
  private config: SyncConfig;
  private uploader: ProductUploader;
  private logFile: string;

  constructor(config: SyncConfig) {
    this.config = config;
    this.uploader = new ProductUploader();
    this.logFile = config.logFile || path.join(__dirname, 'sync.log');
  }

  start(): void {
    if (!this.config.enabled) {
      this.log('Daily sync is disabled');
      return;
    }

    this.log(
      `Starting daily sync service with schedule: ${this.config.schedule}`
    );

    cron.schedule(
      this.config.schedule,
      async () => {
        await this.runSync();
      },
      {
        scheduled: true,
        timezone: 'Asia/Seoul', // Adjust for your timezone
      }
    );

    this.log('Daily sync service started');
  }

  async runSync(): Promise<void> {
    const startTime = new Date();
    this.log(`Starting sync at ${startTime.toISOString()}`);

    try {
      // Proceed with actual upload
      const result = await this.uploader.uploadFromFile({
        cafeName: this.config.cafeName,
        cafeSlug: this.config.cafeSlug,
        dryRun: false,
        verbose: true,
      });

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.log(`Sync completed in ${duration}ms`);
      if (result) {
        this.log(
          `Results: Created: ${result.created}, Updated: ${result.updated}, Unchanged: ${result.unchanged}, Errors: ${result.errors.length}`
        );

        if (result.errors.length > 0) {
          this.log('Errors encountered:');
          for (const error of result.errors) {
            this.log(`  - ${error}`);
          }
        }
      }

      this.sendNotification(result, duration);
    } catch (error) {
      this.log(`Sync failed: ${error}`);
      this.sendErrorNotification(error);
    }
  }

  async runOnce(): Promise<void> {
    this.log('Running one-time sync...');
    await this.runSync();
  }

  private log(message: string): void {
    logger.info(message);

    // Also write to log file
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    fs.appendFileSync(this.logFile, `${logMessage}\n`);
  }

  private sendNotification(
    result: {
      processed: number;
      created: number;
      updated: number;
      errors: string[];
    } | null,
    duration: number
  ): void {
    // This is where you could integrate with notification services
    // like Slack, Discord, email, etc.

    const summary = `Daily product sync completed:
📊 Processed: ${result?.processed || 0}
✅ Created: ${result?.created || 0}
🔄 Updated: ${result?.updated || 0}
⏱️ Duration: ${duration}ms
${result && result.errors.length > 0 ? `⚠️ Errors: ${result.errors.length}` : ''}`;

    this.log(`Notification: ${summary}`);

    // Example: Send to webhook (uncomment and configure as needed)
    // this.sendWebhookNotification(summary);
  }

  private sendErrorNotification(error: unknown): void {
    const errorMessage = `❌ Daily sync failed: ${error}`;
    this.log(`Error notification: ${errorMessage}`);

    // Example: Send error to monitoring service
    // this.sendWebhookNotification(errorMessage, 'error');
  }
}

// Configuration
const syncConfig: SyncConfig = {
  schedule: '0 6 * * *', // Daily at 6 AM
  cafeName: 'Starbucks Korea',
  cafeSlug: 'starbucks',
  logFile: path.join(__dirname, '../logs', 'daily-sync.log'),
  enabled: true,
};

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const service = new DailySyncService(syncConfig);

  if (args.includes('--once')) {
    // Run once and exit
    await service.runOnce();
    return;
  }

  if (args.includes('--daemon')) {
    // Run as daemon service
    service.start();

    // Keep the process running
    process.on('SIGINT', () => {
      logger.info('Shutting down daily sync service...');
      process.exit(0);
    });

    // Keep alive
    setInterval(() => {
      // Keep alive
    }, 1000);
    return;
  }

  // Default: show help
  printHelp();
}

function printHelp(): void {
  logger.info(`Daily Product Sync Service

Usage:
  ts-node daily-sync.ts [options]

Options:
  --once         Run sync once and exit
  --daemon       Run as background service with scheduled sync
  --help, -h     Show this help message

Configuration:
  Edit the syncConfig object in this file to customize:
  - schedule: Cron expression (default: "0 6 * * *" - daily at 6 AM)
  - cafeName: Name of the cafe
  - cafeSlug: URL slug for the cafe
  - logFile: Path to log file
  - enabled: Enable/disable the service

Examples:
  ts-node daily-sync.ts --once      # Run sync immediately
  ts-node daily-sync.ts --daemon    # Start scheduled service

Logs:
  Check ${syncConfig.logFile || './logs/daily-sync.log'} for detailed logs

Environment Variables:
  CONVEX_URL            Convex deployment URL
  SLACK_WEBHOOK_URL     Optional Slack webhook for notifications
  DISCORD_WEBHOOK_URL   Optional Discord webhook for notifications
`);
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Application error:', error);
    process.exit(1);
  });
}

export { DailySyncService };
