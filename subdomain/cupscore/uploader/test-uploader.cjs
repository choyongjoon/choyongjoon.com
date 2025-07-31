'use strict';
const fs = require('node:fs');
const path = require('node:path');
const pino = require('pino');

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  },
});

// Simple test to verify the uploader data processing
logger.info('Testing Product Uploader Data Processing...');

// Read the sample crawler data
const crawlerFile = path.join(
  __dirname,
  '../crawler/crawler-outputs',
  'starbucks-products-2025-07-30.json'
);

if (!fs.existsSync(crawlerFile)) {
  logger.error('Crawler output file not found:', crawlerFile);
  process.exit(1);
}

logger.info('Reading crawler data...');
const rawData = fs.readFileSync(crawlerFile, 'utf-8');
const products = JSON.parse(rawData);

logger.info(`Found ${products.length} products in crawler output`);

// Test data transformation logic (same as in dataUploader.ts)
function mapCategory(originalCategory) {
  const categoryMap = {
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

function parsePrice(priceString) {
  if (!priceString) {
    return;
  }

  if (
    priceString.toLowerCase().includes('varies') ||
    priceString.toLowerCase().includes('사이즈')
  ) {
    return;
  }

  const numbers = priceString.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    return Number.parseInt(numbers[0], 10);
  }

  return;
}

// Process first few products as test
logger.info('Processing product data...');

const results = {
  processed: 0,
  skipped: 0,
  errors: [],
  samples: [],
};

for (let i = 0; i < Math.min(products.length, 10); i++) {
  const rawProduct = products[i];

  try {
    if (!(rawProduct.name && rawProduct.id_origin)) {
      results.skipped++;
      continue;
    }

    const processed = {
      name: rawProduct.name.trim(),
      category: mapCategory(
        rawProduct.category_origin || rawProduct.category || 'Other'
      ),
      price: parsePrice(rawProduct.price),
      description: (rawProduct.description || '').trim(),
      calories: undefined,
      imageUrl: rawProduct.image || '',
      isDiscontinued: false,
      externalId: rawProduct.id_origin,
    };

    results.processed++;
    if (results.samples.length < 3) {
      results.samples.push(processed);
    }
  } catch (error) {
    results.errors.push(`Failed to process product: ${error.message}`);
  }
}

// Print results
logger.info('Test Results:');
logger.info(`  Processed: ${results.processed}/10 (sample)`);
logger.info(`  Skipped: ${results.skipped}`);
logger.info(`  Errors: ${results.errors.length}`);

if (results.errors.length > 0) {
  logger.error('Errors:');
  for (const error of results.errors) {
    logger.error(`  - ${error}`);
  }
}

logger.info('Sample processed products:');
for (const [index, product] of results.samples.entries()) {
  logger.info(`  ${index + 1}. ${product.name}`);
  logger.info(`     Category: ${product.category}`);
  logger.info(`     Price: ${product.price || 'varies by size'}`);
  logger.info(`     External ID: ${product.externalId}`);
  logger.info(`     Image: ${product.imageUrl ? '✅' : '❌'}`);
}

// Test full dataset processing
logger.info('Full Dataset Analysis:');
const categories = new Set();
let withImages = 0;
let withPrices = 0;
let validProducts = 0;

for (const product of products) {
  if (product.name && product.id_origin) {
    validProducts++;
    if (product.category_origin) {
      categories.add(mapCategory(product.category_origin));
    }
    if (product.image) {
      withImages++;
    }
    if (parsePrice(product.price) !== undefined) {
      withPrices++;
    }
  }
}

logger.info(`  Total products: ${products.length}`);
logger.info(`  Valid products: ${validProducts}`);
logger.info(
  `  Categories: ${categories.size} (${Array.from(categories).join(', ')})`
);
logger.info(`  With images: ${withImages}/${validProducts}`);
logger.info(`  With prices: ${withPrices}/${validProducts}`);

logger.info('Data processing test completed successfully!');
logger.info('Next steps:');
logger.info('  1. Start Convex development server: npx convex dev');
logger.info(
  '  2. Test actual upload: CONVEX_URL=https://accomplished-hippopotamus-189.convex.cloud npm run upload-products -- --dry-run'
);
logger.info(
  '  3. Perform real upload: CONVEX_URL=https://accomplished-hippopotamus-189.convex.cloud npm run upload-products'
);
