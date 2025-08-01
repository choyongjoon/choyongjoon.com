import fs from 'node:fs';
import path from 'node:path';
import { PlaywrightCrawler, type Request } from 'crawlee';
import type { Page } from 'playwright';
import { logger } from '../../shared/logger';

interface Product {
  name: string;
  nameEn: string;
  description: string;
  price: string | null;
  externalImageUrl: string;
  category: string;
  externalCategory: string;
  externalId: string;
  externalUrl: string;
}

async function extractProductData(page: Page): Promise<Product> {
  // Extract all data using Playwright locators instead of page.evaluate
  const [
    name,
    nameEn,
    description,
    externalCategory,
    externalImageUrl,
    externalId,
    externalUrl,
  ] = await Promise.all([
    // Extract Korean name
    page
      .locator('.myAssignZone > h4')
      .textContent()
      .then((text) => text?.trim() || ''),

    // Extract English name
    page
      .locator('.myAssignZone > h4 > span')
      .textContent()
      .then((text) => text?.trim() || ''),

    // Extract description (first p.t1 in product details)
    page
      .locator('.myAssignZone p.t1')
      .first()
      .textContent()
      .then((text) => text?.trim() || ''),

    // Extract category
    page
      .locator('.cate')
      .textContent()
      .then((text) => text?.trim() || ''),

    // Extract image
    page
      .locator('.elevatezoom-gallery > img:nth-child(1)')
      .getAttribute('src')
      .then((src) => src || ''),

    // Extract ID from URL
    Promise.resolve(page.url()).then((url) => {
      const urlParams = new URLSearchParams(new URL(url).search);
      return urlParams.get('product_cd') || '';
    }),

    // Get current URL
    Promise.resolve(page.url()),
  ]);

  // Clean Korean name by removing English part
  let cleanName = name;
  if (nameEn && name.includes(nameEn)) {
    cleanName = name.replace(nameEn, '').trim();
  }

  return {
    name: cleanName,
    nameEn,
    description,
    externalCategory,
    externalId,
    externalImageUrl,
    externalUrl,
    price: null,
    category: 'Drinks',
  };
}

// Regex pattern for extracting product codes from image URLs (defined at top level for performance)
const PRODUCT_CD_REGEX = /\[(\d+)\]/;

// Helper function to extract product ID from link data
function extractProductIdFromLink(
  href: string,
  onclick: string,
  innerHTML: string
): string[] {
  const extractedIds: string[] = [];

  // Try to extract product ID from href
  if (href?.includes('drink_view.do')) {
    const match = href.match(PRODUCT_CD_REGEX);
    if (match) {
      extractedIds.push(match[1]);
    }
  }

  // Try to extract product ID from onclick
  if (onclick?.includes('product_cd')) {
    const match = onclick.match(PRODUCT_CD_REGEX);
    if (match) {
      extractedIds.push(match[1]);
    }
  }

  // Extract product ID from image src in innerHTML
  if (innerHTML) {
    const imgMatch = innerHTML.match(PRODUCT_CD_REGEX);
    if (imgMatch) {
      extractedIds.push(imgMatch[1]);
    }
  }

  return extractedIds;
}

// Helper function to get debug information about page links
async function getPageDebugInfo(page: Page) {
  const goDrinkViewLinks = page.locator('a.goDrinkView');
  const allLinks = page.locator('a');
  const goDrinkViewCount = await goDrinkViewLinks.count();
  const totalLinksCount = await allLinks.count();
  const bodyText = await page
    .locator('body')
    .textContent()
    .then((text) => text?.substring(0, 500) || '');
  const pageUrl = page.url();
  const pageTitle = await page.title();

  // Get first few goDrinkView links for debugging
  const firstGoDrinkViewLinks: Array<{
    href: string;
    onclick: string;
    text: string;
    className: string;
    innerHTML: string;
  }> = [];

  const linkCount = Math.min(5, goDrinkViewCount);
  if (linkCount > 0) {
    const linkPromises = Array.from({ length: linkCount }, async (_, i) => {
      const link = goDrinkViewLinks.nth(i);
      const [href, onclick, text, className, innerHTML] = await Promise.all([
        link.getAttribute('href').then((h) => h || 'NO_HREF'),
        link.getAttribute('onclick').then((o) => o || 'NO_ONCLICK'),
        link.textContent().then((t) => t?.trim() || 'NO_TEXT'),
        link.getAttribute('class').then((c) => c || 'NO_CLASS'),
        link.innerHTML().then((h) => h?.substring(0, 200) || ''),
      ]);

      return {
        href,
        onclick,
        text,
        className,
        innerHTML,
      };
    });

    const linkResults = await Promise.all(linkPromises);
    firstGoDrinkViewLinks.push(...linkResults);
  }

  return {
    goDrinkViewCount,
    totalLinksCount,
    bodyText,
    firstGoDrinkViewLinks,
    pageUrl,
    pageTitle,
  };
}

// Helper function to find and extract product IDs from page
async function extractProductIds(page: Page) {
  const selectors = [
    'a.goDrinkView',
    'a[href*="drink_view.do"]',
    'a[href*="product_cd"]',
    '.product-item a',
    '.drink-item a',
    'a[onclick*="goDrinkView"]',
  ];

  let links: ReturnType<typeof page.locator> | null = null;
  let usedSelector = '';

  // Try each selector until we find one that works
  const selectorPromises = selectors.map(async (selector) => {
    const foundLinks = page.locator(selector);
    const count = await foundLinks.count();
    return { selector, foundLinks, count };
  });

  const selectorResults = await Promise.all(selectorPromises);
  for (const result of selectorResults) {
    if (result.count > 0) {
      links = result.foundLinks;
      usedSelector = result.selector;
      break;
    }
  }

  const ids: string[] = [];
  let linksFound = 0;
  const sampleHrefs: string[] = [];
  const sampleOnclicks: string[] = [];

  if (links) {
    linksFound = await links.count();

    // Process all links to extract product IDs in parallel
    const linkProcessPromises = Array.from(
      { length: linksFound },
      async (_, i) => {
        const link = links?.nth(i);
        if (!link) {
          return { href: 'NO_HREF', onclick: 'NO_ONCLICK', ids: [] };
        }
        const [href, onclick, innerHTML] = await Promise.all([
          link.getAttribute('href').then((h) => h || ''),
          link.getAttribute('onclick').then((o) => o || ''),
          link.innerHTML().then((h) => h || ''),
        ]);

        const extractedIds = extractProductIdFromLink(href, onclick, innerHTML);

        return {
          href: href || 'NO_HREF',
          onclick: onclick || 'NO_ONCLICK',
          ids: extractedIds,
        };
      }
    );

    const linkResults = await Promise.all(linkProcessPromises);

    // Collect debug info and IDs
    for (const result of linkResults) {
      if (sampleHrefs.length < 5) {
        sampleHrefs.push(result.href);
        sampleOnclicks.push(result.onclick);
      }
      ids.push(...result.ids);
    }
  }

  return {
    ids,
    usedSelector,
    linksFound,
    sampleHrefs,
    sampleOnclicks,
  };
}

// Handle main menu page - discover and enqueue product pages
async function handleMainMenuPage(
  page: Page,
  crawlerInstance: PlaywrightCrawler
) {
  logger.info('Processing drink list page');

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  // Take a screenshot for debugging
  const screenshotPath = path.join(
    process.cwd(),
    'actors',
    'crawler',
    'crawler-outputs',
    'debug-screenshot.png'
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  logger.info(`Screenshot saved to: ${screenshotPath}`);

  // Get page debug information
  const pageInfo = await getPageDebugInfo(page);

  logger.info(`Page title: "${pageInfo.pageTitle}"`);
  logger.info(`Body text sample: "${pageInfo.bodyText.substring(0, 200)}"`);
  logger.info(`Found ${pageInfo.goDrinkViewCount} goDrinkView links`);
  logger.info(
    `Sample innerHTML: ${pageInfo.firstGoDrinkViewLinks[0]?.innerHTML?.substring(0, 200) || 'none'}`
  );

  // Extract product IDs from the page
  const productIds = await extractProductIds(page);

  logger.info(
    `Selector used: ${productIds.usedSelector}, Links found: ${productIds.linksFound}`
  );
  logger.info(`Extracted IDs: ${productIds.ids.join(', ')}`);
  logger.info(`Found ${productIds.ids.length} products to crawl`);

  // Prepare all product URLs
  const productRequests = productIds.ids.map((productId) => ({
    url: `https://www.starbucks.co.kr/menu/drink_view.do?product_cd=${productId}`,
    userData: { productId, isProductPage: true },
  }));

  // Enqueue all product pages at once
  await crawlerInstance.addRequests(productRequests);

  logger.info(`Enqueued ${productIds.ids.length} product pages for processing`);
}

// Handle individual product page - extract product data
async function handleProductPage(
  page: Page,
  request: Request,
  crawlerInstance: PlaywrightCrawler
) {
  const productId = request.userData.productId;
  logger.info(`Processing product page: ${productId}`);

  try {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const product = await extractProductData(page);
    if (product.name && product.externalId) {
      const finalProduct: Product = {
        ...product,
        price: null,
        category: 'Drinks',
      };

      // Save individual product to shared dataset
      await crawlerInstance.pushData(finalProduct);

      logger.info(
        `✅ Extracted: ${finalProduct.name} (${finalProduct.nameEn}) - ID: ${finalProduct.externalId}`
      );
    } else {
      logger.warn(
        `⚠️ Failed to extract complete product data for ID: ${productId}`
      );
    }
  } catch (error) {
    logger.error(`❌ Error processing product ${productId}: ${error}`);
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

    // Route to appropriate handler based on URL and request data
    if (url.includes('drink_list.do')) {
      await handleMainMenuPage(page, crawlerInstance);
    } else if (request.userData?.isProductPage) {
      await handleProductPage(page, request, crawlerInstance);
    }
  },

  // Allow multiple concurrent requests for efficiency
  maxConcurrency: 3,
  maxRequestsPerCrawl: 200, // Full crawl - all products

  // Handle failures gracefully
  maxRequestRetries: 2,
  requestHandlerTimeoutSecs: 45,
});

(async () => {
  try {
    // Start with the list page
    await crawler.run(['https://www.starbucks.co.kr/menu/drink_list.do']);

    // Export collected data to JSON file
    const dataset = await crawler.getData();
    if (dataset.items.length > 0) {
      const outputPath = path.join(process.cwd(), 'crawler', 'crawler-outputs');
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const filename = `starbucks-products-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(outputPath, filename);

      fs.writeFileSync(filepath, JSON.stringify(dataset.items, null, 2));
      logger.info(`Saved ${dataset.items.length} products to ${filename}`);

      // Log summary
      logger.info('=== CRAWL SUMMARY ===');
      logger.info(`Total products extracted: ${dataset.items.length}`);
      for (const [i, p] of dataset.items.entries()) {
        logger.info(`${i + 1}. ${p.name} (${p.nameEn}) - ID: ${p.externalId}`);
      }
    } else {
      logger.warn('No products were extracted');
    }
  } catch (error) {
    logger.error('Crawler failed:', error);
    process.exit(1);
  }
})();
