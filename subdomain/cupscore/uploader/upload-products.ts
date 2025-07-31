#!/usr/bin/env ts-node
import fs from 'node:fs';
import path from 'node:path';
import { ConvexClient } from 'convex/browser';
import { api } from '../convex/_generated/api';

const CONVEX_URL =
  process.env.CONVEX_URL || 'https://your-convex-deployment.convex.cloud';

interface UploadOptions {
  file?: string;
  cafeName: string;
  cafeSlug: string;
  dryRun?: boolean;
  verbose?: boolean;
}

interface UploadResult {
  processed: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: string[];
  processingTime: number;
  message?: string;
  samples?: Array<{ name: string; category: string }>;
}

class ProductUploader {
  private client: ConvexClient;

  constructor() {
    this.client = new ConvexClient(CONVEX_URL);
  }

  async uploadFromFile(options: UploadOptions): Promise<UploadResult> {
    const {
      file,
      cafeName,
      cafeSlug,
      dryRun = false,
      verbose = false,
    } = options;

    const filePath = this.resolveFilePath(file);
    const products = this.readAndValidateFile(filePath, verbose);

    if (verbose) {
      this.logUploadInfo(filePath, cafeName, cafeSlug, dryRun);
    }

    console.log(`📦 Found ${products.length} products in file`);

    try {
      const result = await this.performUpload(
        products,
        cafeName,
        cafeSlug,
        dryRun
      );
      this.handleUploadResult(result, verbose, dryRun);
      return result;
    } catch (error) {
      console.error('❌ Upload failed:', error);
      throw error;
    }
  }

  private resolveFilePath(file?: string): string {
    let filePath: string;

    if (file) {
      filePath = path.resolve(file);
    } else {
      filePath = this.findLatestCrawlerOutput();
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return filePath;
  }

  private readAndValidateFile(filePath: string, verbose: boolean): unknown[] {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    let products: unknown[];

    try {
      products = JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Invalid JSON in file ${filePath}: ${error}`);
    }

    if (!Array.isArray(products)) {
      throw new Error('JSON file must contain an array of products');
    }

    return products;
  }

  private logUploadInfo(
    filePath: string,
    cafeName: string,
    cafeSlug: string,
    dryRun: boolean
  ): void {
    console.log(`📁 Reading file: ${filePath}`);
    console.log(`🏪 Cafe: ${cafeName} (${cafeSlug})`);
    console.log(`🧪 Dry run: ${dryRun ? 'Yes' : 'No'}`);
  }

  private async performUpload(
    products: unknown[],
    cafeName: string,
    cafeSlug: string,
    dryRun: boolean
  ): Promise<UploadResult> {
    return await this.client.mutation(api.dataUploader.uploadProductsFromJson, {
      products,
      cafeName,
      cafeSlug,
      dryRun,
    });
  }

  private handleUploadResult(
    result: UploadResult,
    verbose: boolean,
    dryRun: boolean
  ): void {
    this.printResults(result, verbose);

    if (!dryRun && result.errors.length === 0) {
      console.log('✅ Upload completed successfully!');
    } else if (result.errors.length > 0) {
      console.log(`⚠️  Upload completed with ${result.errors.length} errors`);
      if (verbose) {
        for (const error of result.errors) {
          console.log(`  ❌ ${error}`);
        }
      }
    }
  }

  async getStats(cafeSlug: string, daysBack = 7): Promise<void> {
    try {
      const stats = await this.client.mutation(
        api.dataUploader.getUploadStats,
        {
          cafeSlug,
          daysBack,
        }
      );

      console.log(`📊 Statistics for ${cafeSlug} (last ${daysBack} days):`);
      console.log(`  Total products: ${stats.total}`);
      console.log(`  Recently added: ${stats.recentlyAdded}`);
      console.log(`  Recently updated: ${stats.recentlyUpdated}`);
      console.log(`  Categories: ${stats.categories}`);
      console.log(`  With images: ${stats.withImages}/${stats.total}`);
      console.log(`  With prices: ${stats.withPrices}/${stats.total}`);
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      throw error;
    }
  }

  private findLatestCrawlerOutput(): string {
    const outputDir = path.join(__dirname, '../crawler/crawler-outputs');

    if (!fs.existsSync(outputDir)) {
      throw new Error('Crawler outputs directory not found');
    }

    const files = fs
      .readdirSync(outputDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => ({
        name: file,
        path: path.join(outputDir, file),
        mtime: fs.statSync(path.join(outputDir, file)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (files.length === 0) {
      throw new Error('No JSON files found in crawler-outputs directory');
    }

    console.log(`📄 Using latest file: ${files[0].name}`);
    return files[0].path;
  }

  private printResults(result: UploadResult, verbose: boolean): void {
    console.log('\n📈 Results:');
    console.log(`  Processed: ${result.processed}`);
    console.log(`  Created: ${result.created}`);
    console.log(`  Updated: ${result.updated}`);
    console.log(`  Unchanged: ${result.unchanged}`);
    console.log(`  Skipped: ${result.skipped}`);
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Processing time: ${result.processingTime}ms`);

    if (result.message) {
      console.log(`\n💬 ${result.message}`);
    }

    if (verbose && result.samples) {
      console.log('\n🔍 Sample processed products:');
      for (const [index, product] of result.samples.entries()) {
        console.log(`  ${index + 1}. ${product.name} (${product.category})`);
      }
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const uploader = new ProductUploader();

  // Parse command line arguments
  const command = args[0];

  if (command === 'stats') {
    const cafeSlug = args[1] || 'starbucks';
    const daysBack = Number.parseInt(args[2], 10) || 7;
    await uploader.getStats(cafeSlug, daysBack);
    return;
  }

  // Default upload command
  const options: UploadOptions = {
    cafeName: 'Starbucks Korea',
    cafeSlug: 'starbucks',
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  // Parse file option
  const fileIndex = args.indexOf('--file');
  if (fileIndex !== -1 && args[fileIndex + 1]) {
    options.file = args[fileIndex + 1];
  }

  // Parse cafe options
  const cafeNameIndex = args.indexOf('--cafe-name');
  if (cafeNameIndex !== -1 && args[cafeNameIndex + 1]) {
    options.cafeName = args[cafeNameIndex + 1];
  }

  const cafeSlugIndex = args.indexOf('--cafe-slug');
  if (cafeSlugIndex !== -1 && args[cafeSlugIndex + 1]) {
    options.cafeSlug = args[cafeSlugIndex + 1];
  }

  try {
    await uploader.uploadFromFile(options);
  } catch (error) {
    console.error('💥 Upload failed:', error);
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
📦 Product Uploader CLI

Usage:
  ts-node upload-products.ts [command] [options]

Commands:
  upload (default)  Upload products from JSON file
  stats            Show upload statistics

Upload Options:
  --file <path>        Specific JSON file to upload (default: latest in crawler-outputs/)
  --cafe-name <name>   Cafe name (default: "Starbucks Korea")
  --cafe-slug <slug>   Cafe slug (default: "starbucks")
  --dry-run           Preview changes without uploading
  --verbose, -v       Show detailed output

Stats Options:
  stats <cafe-slug> [days]  Show statistics for cafe (default: starbucks, 7 days)

Examples:
  ts-node upload-products.ts --dry-run --verbose
  ts-node upload-products.ts --file ./data/products.json
  ts-node upload-products.ts stats starbucks 30
  ts-node upload-products.ts --cafe-name "Custom Cafe" --cafe-slug "custom"

Environment:
  CONVEX_URL          Convex deployment URL
`);
}

if (require.main === module) {
  main().catch(console.error);
}

export { ProductUploader };
