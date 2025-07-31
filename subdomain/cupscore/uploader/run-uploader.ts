#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../shared/logger';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Available cafes configuration
const AVAILABLE_CAFES = {
  starbucks: {
    name: 'Starbucks Korea',
    slug: 'starbucks',
    filePattern: 'starbucks-products-',
    description: 'Uploads Starbucks Korea products to database',
  },
  compose: {
    name: 'Compose Coffee',
    slug: 'compose',
    filePattern: 'compose-products-',
    description: 'Uploads Compose Coffee products to database',
  },
  mega: {
    name: 'Mega MGC Coffee',
    slug: 'mega',
    filePattern: 'mega-products-',
    description: 'Uploads Mega MGC Coffee products to database',
  },
} as const;

type CafeName = keyof typeof AVAILABLE_CAFES;

interface UploadOptions {
  dryRun?: boolean;
  verbose?: boolean;
  file?: string;
}

// Helper function to handle cafe name validation and addition
function handleCafeName(arg: string, cafes: CafeName[]): void {
  if (arg in AVAILABLE_CAFES) {
    cafes.push(arg as CafeName);
  } else {
    logger.error(`Invalid cafe name: ${arg}`);
    logger.info(`Available cafes: ${Object.keys(AVAILABLE_CAFES).join(', ')}`);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): { cafes: CafeName[]; options: UploadOptions } {
  const args = process.argv.slice(2);
  const options: UploadOptions = {};
  const cafes: CafeName[] = [];

  // Parse flags
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--file') {
      options.file = args[i + 1];
      i++; // Skip next argument as it's the file path
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith('--')) {
      logger.error(`Unknown option: ${arg}`);
      printHelp();
      process.exit(1);
    } else {
      // This should be a cafe name
      handleCafeName(arg, cafes);
    }
  }

  // If no cafes specified, upload all available cafes
  if (cafes.length === 0) {
    cafes.push(...(Object.keys(AVAILABLE_CAFES) as CafeName[]));
  }

  return { cafes, options };
}

// Find the latest file for a specific cafe
function findLatestFile(cafePattern: string): string | null {
  const outputDir = path.join(process.cwd(), 'crawler', 'crawler-outputs');

  if (!fs.existsSync(outputDir)) {
    return null;
  }

  const files = fs
    .readdirSync(outputDir)
    .filter((file) => file.startsWith(cafePattern) && file.endsWith('.json'))
    .map((file) => ({
      name: file,
      path: path.join(outputDir, file),
      mtime: fs.statSync(path.join(outputDir, file)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files.length > 0 ? files[0].path : null;
}

// Upload products for a single cafe
function uploadCafe(cafeName: CafeName, options: UploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const cafe = AVAILABLE_CAFES[cafeName];
    const uploaderPath = path.join(__dirname, 'upload-products.ts');

    // Find the appropriate file
    let filePath = options.file;
    if (!filePath) {
      const foundPath = findLatestFile(cafe.filePattern);
      if (!foundPath) {
        logger.error(`No ${cafe.name} products file found in crawler-outputs/`);
        reject(new Error(`No products file found for ${cafeName}`));
        return;
      }
      filePath = foundPath;
    }

    logger.info(`🚀 Starting ${cafe.name} upload...`);
    logger.info(`📄 Description: ${cafe.description}`);
    logger.info(`📁 File: ${path.basename(filePath)}`);

    // Build command arguments
    const args = [
      uploaderPath,
      'upload',
      '--cafe-name',
      cafe.name,
      '--cafe-slug',
      cafe.slug,
      '--file',
      filePath,
    ];

    if (options.dryRun) {
      args.push('--dry-run');
    }

    if (options.verbose) {
      args.push('--verbose');
    }

    const child = spawn('tsx', args, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    child.on('close', (code) => {
      if (code === 0) {
        logger.info(`✅ ${cafe.name} upload completed successfully`);
        resolve();
      } else {
        logger.error(`❌ ${cafe.name} upload failed with exit code ${code}`);
        reject(new Error(`Upload ${cafeName} failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      logger.error(`❌ Failed to start ${cafe.name} upload: ${error.message}`);
      reject(error);
    });
  });
}

// Print help information
function printHelp(): void {
  logger.info(`
🚀 Multi-Cafe Uploader Runner

Usage:
  pnpm upload                           # Upload all cafes
  pnpm upload starbucks                 # Upload only Starbucks
  pnpm upload starbucks compose         # Upload Starbucks and Compose
  pnpm upload --dry-run                 # Preview all uploads without uploading
  pnpm upload starbucks --verbose       # Upload Starbucks with detailed output

Available Cafes:
${Object.entries(AVAILABLE_CAFES)
  .map(
    ([key, cafe]) => `  ${key.padEnd(10)} - ${cafe.name} (${cafe.description})`
  )
  .join('\n')}

Options:
  --dry-run          Preview changes without uploading to database
  --verbose, -v      Show detailed output during upload
  --file <path>      Use specific file instead of latest from crawler-outputs/
  --help, -h         Show this help message

Examples:
  pnpm upload                                    # Upload all cafes
  pnpm upload starbucks                          # Upload only Starbucks  
  pnpm upload compose --dry-run                  # Preview Compose upload
  pnpm upload --file ./custom-products.json     # Upload specific file to all cafes
  pnpm upload starbucks --verbose               # Upload Starbucks with detailed logs
`);
}

// Main execution function
async function main() {
  try {
    const { cafes, options } = parseArgs();

    logger.info('🎯 Multi-Cafe Uploader Starting');
    logger.info(`📋 Cafes to upload: ${cafes.join(', ')}`);
    if (options.dryRun) {
      logger.info('🔍 DRY RUN MODE - No data will be uploaded');
    }
    logger.info('='.repeat(50));

    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    // Upload cafes sequentially to avoid database conflicts
    for (const cafeName of cafes) {
      try {
        // biome-ignore lint/nursery/noAwaitInLoop: Sequential processing is intentional for database uploads
        await uploadCafe(cafeName, options);
        successCount++;
      } catch (error) {
        logger.error(`Failed to upload ${cafeName}: ${error}`);
        failCount++;
      }

      // Add a small delay between uploads
      if (cafes.indexOf(cafeName) < cafes.length - 1) {
        logger.info('⏳ Waiting 2 seconds before next upload...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    const endTime = Date.now();
    const totalTime = Math.round((endTime - startTime) / 1000);

    // Final summary
    logger.info('='.repeat(50));
    logger.info('📊 UPLOAD RUN SUMMARY');
    logger.info(`✅ Successful: ${successCount}/${cafes.length} cafes`);
    logger.info(`❌ Failed: ${failCount}/${cafes.length} cafes`);
    logger.info(`⏱️  Total time: ${totalTime} seconds`);

    if (failCount > 0) {
      logger.error('Some uploads failed. Check logs above for details.');
      process.exit(1);
    } else if (options.dryRun) {
      logger.info('🔍 Dry run completed - no data was uploaded');
    } else {
      logger.info('🎉 All uploads completed successfully!');
    }
  } catch (error) {
    logger.error('Fatal error in uploader runner:', error);
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
