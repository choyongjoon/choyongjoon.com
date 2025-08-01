import { PlaywrightCrawler, type Request } from 'crawlee';
import type { Locator, Page } from 'playwright';
import { logger } from '../../shared/logger';
import { type Product, waitForLoad, writeProductsToJson } from './crawlerUtils';

// Extract category URLs from the main menu page
async function extractCategoryUrls(
  page: Page
): Promise<Array<{ url: string; name: string }>> {
  try {
    logger.info('📄 Extracting category URLs from tabs');

    await waitForLoad(page);

    // Get all category tab links
    await page.waitForSelector('ul.page_tab a', { timeout: 10_000 });
    const categoryTabs = await page.locator('ul.page_tab a').all();

    logger.info(`🏷️  Found ${categoryTabs.length} category tabs`);

    const categories: Array<{ url: string; name: string }> = [];

    for (const tab of categoryTabs) {
      // biome-ignore lint/nursery/noAwaitInLoop: Sequential processing needed for category extraction
      const [href, text] = await Promise.all([
        tab.getAttribute('href'),
        tab.textContent(),
      ]);

      if (href && text) {
        const categoryName = text.trim();

        // Skip 신메뉴 (New Menu) to avoid duplicates as requested
        if (categoryName === '신메뉴') {
          logger.info(`⏭️  Skipping category: ${categoryName} (duplicates)`);
          continue;
        }

        const fullUrl = href.startsWith('http')
          ? href
          : `https://paikdabang.com${href}`;
        categories.push({ url: fullUrl, name: categoryName });
        logger.info(`📋 Found category: ${categoryName} -> ${fullUrl}`);
      }
    }

    return categories;
  } catch (error) {
    logger.error(`❌ Failed to extract category URLs: ${error}`);
    return [];
  }
}

// Find menu items using user-specified selector
async function findMenuItems(
  page: Page
): Promise<{ items: Locator[]; selector: string }> {
  const selector = '.menu_list > ul > li';

  try {
    await page.waitForSelector(selector, { timeout: 10_000 });
    const items = await page.locator(selector).all();
    logger.info(`✅ Found ${items.length} items using selector: ${selector}`);
    return { items, selector };
  } catch {
    logger.warn(`⚠️  Selector ${selector} not found`);
    return { items: [], selector: '' };
  }
}

// Extract product name using user-specified selector
async function extractProductName(menuItem: Locator): Promise<string> {
  try {
    const name = await menuItem
      .locator('p.menu_tit')
      .textContent({ timeout: 1000 })
      .then((text: string | null) => text?.trim() || '')
      .catch(() => '');
    return name;
  } catch {
    return '';
  }
}

// Extract product image URL
function extractProductImage(menuItem: Locator): Promise<string> {
  return menuItem
    .locator('img')
    .first()
    .getAttribute('src')
    .then((src: string | null) => {
      if (!src) {
        return '';
      }
      return src.startsWith('http') ? src : `https://paikdabang.com${src}`;
    })
    .catch(() => '');
}

// Extract product description with hover fallback
async function extractProductDescription(
  menuItem: Locator,
  page: Page
): Promise<string> {
  try {
    // Try to get description without hover first
    let description = await menuItem
      .locator('p.txt')
      .textContent({ timeout: 500 })
      .then((text: string | null) => text?.trim() || '')
      .catch(() => '');

    // If no description found, try hover
    if (!description) {
      await menuItem.hover({ timeout: 500 });
      await page.waitForTimeout(200);
      description = await menuItem
        .locator('p.txt')
        .textContent({ timeout: 500 })
        .then((text: string | null) => text?.trim() || '')
        .catch(() => '');
    }

    return description;
  } catch {
    return '';
  }
}

// Create product from extracted data
function createProduct(
  name: string,
  imageUrl: string,
  description: string,
  category: string,
  pageUrl: string
): Product {
  const externalId = `paik_${category}_${name}`;

  return {
    name,
    nameEn: null,
    description: description || null,
    price: null,
    externalImageUrl: imageUrl,
    category,
    externalCategory: category,
    externalId,
    externalUrl: pageUrl,
  };
}

// Check if product name is valid
function isValidProductName(name: string): boolean {
  return !!(
    name &&
    name.length > 2 &&
    !name.includes('undefined') &&
    !name.includes('null')
  );
}

// Extract products from a category page
async function extractProductsFromPage(
  page: Page,
  categoryName: string
): Promise<Product[]> {
  const products: Product[] = [];

  try {
    logger.info(`📄 Extracting products from category: ${categoryName}`);

    await waitForLoad(page);

    // Find menu items using multiple selectors
    const { items: menuItems, selector: usedSelector } =
      await findMenuItems(page);

    if (menuItems.length === 0) {
      logger.warn(
        `⚠️  No menu items found for category: ${categoryName} with any selector`
      );
      return [];
    }

    logger.info(
      `🔍 Found ${menuItems.length} menu items in ${categoryName} using ${usedSelector}`
    );

    // Process each menu item with reduced limits for performance
    const maxItemsToProcess = Math.min(menuItems.length, 20);
    logger.info(
      `📝 Processing ${maxItemsToProcess} items out of ${menuItems.length} found`
    );

    for (let i = 0; i < maxItemsToProcess; i++) {
      try {
        const menuItem = menuItems[i];

        // biome-ignore lint/nursery/noAwaitInLoop: Sequential product processing needed for data extraction
        const [name, imageUrl, description] = await Promise.all([
          extractProductName(menuItem),
          extractProductImage(menuItem),
          extractProductDescription(menuItem, page),
        ]);

        if (isValidProductName(name)) {
          const product = createProduct(
            name,
            imageUrl,
            description,
            categoryName,
            page.url()
          );

          // Check for duplicates
          if (!products.some((p) => p.externalId === product.externalId)) {
            products.push(product);
            logger.info(`✅ Extracted: ${name} (${product.category})`);
          }
        }
      } catch (productError) {
        logger.debug(
          `⚠️  Failed to extract menu item ${i + 1}: ${productError}`
        );
      }
    }

    logger.info(
      `📦 Successfully extracted ${products.length} products from ${categoryName}`
    );
    return products;
  } catch (extractionError) {
    logger.error(
      `❌ Failed to extract products from ${categoryName}: ${extractionError}`
    );
    return [];
  }
}

// Handle main menu page - discover category URLs
async function handleMainMenuPage(
  page: Page,
  crawlerInstance: PlaywrightCrawler
) {
  logger.info('Processing main menu page to discover categories');

  const categories = await extractCategoryUrls(page);

  if (categories.length === 0) {
    logger.error('❌ No categories found');
    return;
  }

  // Enqueue all category pages
  const categoryRequests = categories.map((category) => ({
    url: category.url,
    userData: {
      categoryName: category.name,
      isCategoryPage: true,
    },
  }));

  await crawlerInstance.addRequests(categoryRequests);
  logger.info(`📋 Enqueued ${categories.length} category pages for processing`);
}

// Handle category page - extract products
async function handleCategoryPage(
  page: Page,
  request: Request,
  crawlerInstance: PlaywrightCrawler
) {
  const categoryName = request.userData.categoryName;
  logger.info(`🔖 Processing category page: ${categoryName}`);

  const products = await extractProductsFromPage(page, categoryName);

  // Push all products to crawler dataset
  await Promise.all(
    products.map((product) => crawlerInstance.pushData(product))
  );

  logger.info(`📊 Added ${products.length} products from ${categoryName}`);
}

async function crawlPaikMenu(): Promise<Product[]> {
  const crawler = new PlaywrightCrawler({
    launchContext: {
      launchOptions: {
        headless: true,
        slowMo: 50, // Reduced from 100
      },
    },
    maxRequestsPerCrawl: 10, // 1 main page + up to 4 category pages (excluding menu_new)
    maxConcurrency: 1, // Process one page at a time to avoid overload
    requestHandlerTimeoutSecs: 30, // Reduced from 60 to 30 seconds
    maxRequestRetries: 1, // Reduce retries to speed up failures

    async requestHandler({ page, request, log, crawler: crawlerInstance }) {
      try {
        const url = request.loadedUrl || request.url;
        log.info(`🌐 Processing: ${url}`);

        // Set shorter page timeout
        page.setDefaultTimeout(15_000); // 15 seconds instead of default 30

        // Route to appropriate handler
        if (request.userData?.isCategoryPage) {
          await handleCategoryPage(page, request, crawlerInstance);
        } else {
          // Main menu page - discover categories
          await handleMainMenuPage(page, crawlerInstance);
        }
      } catch (error) {
        log.error(`❌ Error processing ${request.url}: ${error}`);
        // Continue processing other pages even if one fails
      }
    },

    failedRequestHandler({ request, log }) {
      log.error(`💥 Request failed: ${request.url}`);
    },
  });

  logger.info(`🎯 Starting Paik's Coffee crawler`);
  logger.info('📋 Will discover category URLs from main menu page');

  // Start with main menu page to discover categories
  await crawler.run(['https://paikdabang.com/menu/menu_new/']);

  // Extract products from crawler results
  const dataset = await crawler.getData();
  return dataset.items as Product[];
}

async function main() {
  try {
    logger.info("🚀 Starting Paik's Coffee (빽다방) Menu Crawler");
    logger.info('='.repeat(50));

    // Run the crawler
    const products = await crawlPaikMenu();

    await writeProductsToJson(products, 'paik');
  } catch (error) {
    logger.error("💥 Fatal error in Paik's Coffee crawler:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down...');
  process.exit(0);
});

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { crawlPaikMenu };
