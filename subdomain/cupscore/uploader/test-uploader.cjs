'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Simple test to verify the uploader data processing
console.log('🧪 Testing Product Uploader Data Processing...\n');

// Read the sample crawler data
const crawlerFile = path.join(
  __dirname,
  '../crawler/crawler-outputs',
  'starbucks-products-2025-07-30.json'
);

if (!fs.existsSync(crawlerFile)) {
  console.error('❌ Crawler output file not found:', crawlerFile);
  process.exit(1);
}

console.log('📁 Reading crawler data...');
const rawData = fs.readFileSync(crawlerFile, 'utf-8');
const products = JSON.parse(rawData);

console.log(`📦 Found ${products.length} products in crawler output\n`);

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
console.log('🔄 Processing product data...\n');

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
console.log('📈 Test Results:');
console.log(`  Processed: ${results.processed}/10 (sample)`);
console.log(`  Skipped: ${results.skipped}`);
console.log(`  Errors: ${results.errors.length}`);

if (results.errors.length > 0) {
  console.log('\n❌ Errors:');
  for (const error of results.errors) {
    console.log(`  - ${error}`);
  }
}

console.log('\n🔍 Sample processed products:');
for (const [index, product] of results.samples.entries()) {
  console.log(`  ${index + 1}. ${product.name}`);
  console.log(`     Category: ${product.category}`);
  console.log(`     Price: ${product.price || 'varies by size'}`);
  console.log(`     External ID: ${product.externalId}`);
  console.log(`     Image: ${product.imageUrl ? '✅' : '❌'}`);
  console.log('');
}

// Test full dataset processing
console.log('📊 Full Dataset Analysis:');
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

console.log(`  Total products: ${products.length}`);
console.log(`  Valid products: ${validProducts}`);
console.log(
  `  Categories: ${categories.size} (${Array.from(categories).join(', ')})`
);
console.log(`  With images: ${withImages}/${validProducts}`);
console.log(`  With prices: ${withPrices}/${validProducts}`);

console.log('\n✅ Data processing test completed successfully!');
console.log('\n💡 Next steps:');
console.log('  1. Start Convex development server: npx convex dev');
console.log(
  '  2. Test actual upload: CONVEX_URL=https://accomplished-hippopotamus-189.convex.cloud npm run upload-products -- --dry-run'
);
console.log(
  '  3. Perform real upload: CONVEX_URL=https://accomplished-hippopotamus-189.convex.cloud npm run upload-products'
);
