import fs from 'node:fs';
import path from 'node:path';
import { PlaywrightCrawler, type Request } from 'crawlee';
import type { Locator, Page } from 'playwright';
import { logger } from '../../shared/logger';

// Regex patterns for extracting data
const CATEGORY_ID_REGEX = /\/menu\/category\/(\d+)/;
const PAGE_REGEX = /page=(\d+)/;

const extractProductData = async (container: Locator) => {
  try {
    // Extract all data in parallel
    const [productId, name, imageUrl] = await Promise.all([
      container
        .locator('> div[id]')
        .getAttribute('id')
        .then((id) => id || ''),
      container
        .locator('h3.undertitle')
        .textContent()
        .then((text) => text?.trim() || ''),
      container
        .locator('.rthumbnailimg')
        .getAttribute('src')
        .then((src) => {
          let url = src || '';
          if (url.startsWith('/')) {
            url = `https://composecoffee.com${url}`;
          }
          return url;
        }),
    ]);

    // Only return if we have a valid name
    if (name && name.length > 0) {
      return {
        name,
        nameEn: null,
        description: null,
        price: null,
        imageUrl,
        id: productId,
      };
    }
  } catch {
    // Skip products that fail to extract
  }
  return null;
};

// Helper function to extract products from a page
async function extractPageProducts(page: Page) {
  const products: Array<{
    name: string;
    nameEn: string | null;
    description: string | null;
    price: number | null;
    imageUrl: string;
    id: string;
  }> = [];

  // Get all product containers
  const productContainers = page.locator('.itemBox');
  const containerCount = await productContainers.count();

  // Process all containers in parallel
  const productPromises = Array.from({ length: containerCount }, async (_, i) =>
    extractProductData(productContainers.nth(i))
  );

  const productResults = await Promise.all(productPromises);
  products.push(...productResults.filter((p) => p !== null));

  // Check for pagination
  const paginationElements = page.locator(
    'a[href*="page="], .pagination a, .page-link'
  );
  const paginationCount = await paginationElements.count();
  let maxPage = 1;

  if (paginationCount > 0) {
    // Process pagination links in parallel
    const hrefPromises = Array.from({ length: paginationCount }, (_, i) =>
      paginationElements.nth(i).getAttribute('href')
    );
    const hrefs = await Promise.all(hrefPromises);

    for (const href of hrefs) {
      const match = href?.match(PAGE_REGEX);
      if (match) {
        const pageNum = Number.parseInt(match[1], 10);
        if (pageNum > maxPage) {
          maxPage = pageNum;
        }
      }
    }
  }

  // Get current page from URL
  const url = page.url();
  const urlParams = new URLSearchParams(new URL(url).search);
  const currentPage = urlParams.get('page') || '1';

  return {
    products,
    usedSelector: 'itemBox-selectors',
    maxPage,
    currentPage,
    pageUrl: url,
  };
}

// Helper function to extract category data from main menu page
async function extractCategoryData(page: Page) {
  const categoryLinks = page.locator(
    '.dropdown-menu a[href*="/menu/category/"]'
  );
  const linkCount = await categoryLinks.count();
  const categories: Array<{ url: string; name: string; id: string }> = [];

  // Process category links in parallel
  if (linkCount > 0) {
    const linkPromises = Array.from({ length: linkCount }, async (_, i) => {
      const link = categoryLinks.nth(i);
      const [href, text] = await Promise.all([
        link.getAttribute('href'),
        link.textContent().then((t) => t?.trim() || ''),
      ]);

      if (href && text) {
        const match = href.match(CATEGORY_ID_REGEX);
        if (match) {
          return {
            url: href.startsWith('/')
              ? `https://composecoffee.com${href}`
              : href,
            name: text,
            id: match[1],
          };
        }
      }
      return null;
    });

    const linkResults = await Promise.all(linkPromises);
    categories.push(...linkResults.filter((c) => c !== null));
  }

  return {
    categories,
    pageTitle: await page.title(),
    pageUrl: page.url(),
  };
}

// Helper function to handle main menu page processing
async function handleMainMenuPage(
  page: Page,
  crawlerInstance: PlaywrightCrawler
) {
  logger.info('Processing main menu page to discover categories');

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Take a screenshot for debugging
  const screenshotPath = path.join(
    process.cwd(),
    'actors',
    'crawler',
    'crawler-outputs',
    'compose-debug-screenshot.png'
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  logger.info(`Screenshot saved to: ${screenshotPath}`);

  // Extract category URLs
  const categoryData = await extractCategoryData(page);

  logger.info(`Found ${categoryData.categories.length} categories`);
  logger.info('Categories:', JSON.stringify(categoryData.categories, null, 2));

  // Enqueue all category pages
  const categoryRequests = categoryData.categories.map((category) => ({
    url: category.url,
    userData: {
      categoryId: category.id,
      categoryName: category.name,
      isCategoryPage: true,
      page: 1,
    },
  }));
  await crawlerInstance.addRequests(categoryRequests);

  logger.info(
    `Enqueued ${categoryData.categories.length} category pages for processing`
  );
}

// Helper function to handle category page processing
async function handleCategoryPage(
  page: Page,
  request: Request,
  crawlerInstance: PlaywrightCrawler
) {
  const categoryId = request.userData.categoryId;
  const categoryName = request.userData.categoryName;
  const currentPage = request.userData.page || 1;
  const url = request.url;

  logger.info(
    `Processing category: ${categoryName} (ID: ${categoryId}, Page: ${currentPage})`
  );

  // Take a screenshot for debugging (only for first category)
  if (categoryId === '207002' && currentPage === 1) {
    const screenshotPath = path.join(
      process.cwd(),
      'crawler',
      'crawler-outputs',
      `compose-category-${categoryId}-screenshot.png`
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.info(`Category screenshot saved to: ${screenshotPath}`);
  }

  try {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Extract products from current category page
    const pageData = await extractPageProducts(page);

    logger.info(
      `Found ${pageData.products.length} products on page ${currentPage} using selector: ${pageData.usedSelector}`
    );

    // Save products from this page
    const products = pageData.products.map((productData) => ({
      name: productData.name,
      nameEn: productData.nameEn,
      description: productData.description,
      price: productData.price,
      externalImageUrl: productData.imageUrl,
      category: 'Drinks' as const,
      externalCategory: categoryName,
      externalId: `compose_${categoryId}_${productData.name}`,
      externalUrl: url,
    }));

    await Promise.all(
      products.map(async (product) => {
        await crawlerInstance.pushData(product);
        logger.info(
          `✅ Extracted: ${product.name} - Category: ${categoryName}`
        );
      })
    );

    // Handle pagination - enqueue next pages
    if (currentPage === 1 && pageData.maxPage > 1) {
      const paginationRequests: Array<{
        url: string;
        userData: {
          categoryId: string;
          categoryName: string;
          isCategoryPage: boolean;
          page: number;
        };
      }> = [];
      for (let pageNum = 2; pageNum <= pageData.maxPage; pageNum++) {
        const nextPageUrl = `${url.split('?')[0]}?page=${pageNum}`;
        paginationRequests.push({
          url: nextPageUrl,
          userData: {
            categoryId,
            categoryName,
            isCategoryPage: true,
            page: pageNum,
          },
        });
      }
      await crawlerInstance.addRequests(paginationRequests);
      logger.info(
        `Enqueued pages 2-${pageData.maxPage} for category: ${categoryName}`
      );
    }
  } catch (error) {
    logger.error(`❌ Error processing category ${categoryName}: ${error}`);
  }
}

const crawler = new PlaywrightCrawler({
  launchContext: {
    launchOptions: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
  async requestHandler({ page, request, crawler: crawlerInstance }) {
    const url = request.url;

    // Handle main menu page - discover categories
    if (url.includes('/menu') && !url.includes('category')) {
      await handleMainMenuPage(page, crawlerInstance);
      return;
    }

    // Handle category pages - extract products and pagination
    if (request.userData?.isCategoryPage) {
      await handleCategoryPage(page, request, crawlerInstance);
    }
  },

  // Allow multiple concurrent requests for efficiency
  maxConcurrency: 3,
  maxRequestsPerCrawl: 100, // Adjust based on expected categories and pages

  // Handle failures gracefully
  maxRequestRetries: 2,
  requestHandlerTimeoutSecs: 60,
});

(async () => {
  try {
    // Start with the main menu page
    await crawler.run(['https://composecoffee.com/menu']);

    // Export collected data to JSON file
    const dataset = await crawler.getData();
    if (dataset.items.length > 0) {
      const outputPath = path.join(process.cwd(), 'crawler', 'crawler-outputs');
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const filename = `compose-products-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(outputPath, filename);

      fs.writeFileSync(filepath, JSON.stringify(dataset.items, null, 2));
      logger.info(`Saved ${dataset.items.length} products to ${filename}`);

      // Log summary by category
      logger.info('=== CRAWL SUMMARY ===');
      logger.info(`Total products extracted: ${dataset.items.length}`);

      const categories = new Map<string, number>();
      for (const item of dataset.items) {
        const count = categories.get(item.externalCategory) || 0;
        categories.set(item.externalCategory, count + 1);
      }

      for (const [category, count] of categories) {
        logger.info(`${category}: ${count} products`);
      }
    } else {
      logger.warn('No products were extracted');
    }
  } catch (error) {
    logger.error('Crawler failed:', error);
    process.exit(1);
  }
})();
