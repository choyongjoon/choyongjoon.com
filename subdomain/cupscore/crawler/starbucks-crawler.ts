import fs from 'node:fs';
import path from 'node:path';
import { PlaywrightCrawler } from 'crawlee';
import type { Page } from 'playwright';
import { logger } from '../shared/logger';

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
  const result = (await page.evaluate(() => {
    // Extract Korean name
    const nameElement = document.querySelector('.myAssignZone > h4');
    let name = nameElement?.textContent?.trim() || '';

    // Extract English name
    const nameEnElement = document.querySelector('.myAssignZone > h4 > span');
    const nameEn = nameEnElement?.textContent?.trim() || '';

    // Clean Korean name by removing English part
    if (nameEn && name.includes(nameEn)) {
      name = name.replace(nameEn, '').trim();
    }

    // Extract description
    const descElement = document.querySelector('p.t1');
    const description = descElement?.textContent?.trim() || '';

    // Extract category
    const categoryElement = document.querySelector('.cate');
    const externalCategory = categoryElement?.textContent?.trim() || '';

    // Extract image
    let externalImageUrl = '';
    const imgElement = document.querySelector(
      '.elevatezoom-gallery > img:nth-child(1)'
    );
    if (imgElement) {
      externalImageUrl = (imgElement as HTMLImageElement).src;
    }

    // Extract ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const externalId = urlParams.get('product_cd') || '';

    return {
      name,
      nameEn,
      description,
      externalCategory,
      externalId,
      externalImageUrl,
      externalUrl: window.location.href,
    };
  })) as Product;

  return result;
}

// Regex pattern for extracting product codes (defined at top level for performance)
const PRODUCT_CD_REGEX = /product_cd=([^&]+)/;

const crawler = new PlaywrightCrawler({
  launchContext: {
    launchOptions: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
  async requestHandler({ page, request, crawler: crawlerInstance }) {
    const url = request.url;

    // Handle list page - extract product IDs and enqueue product pages
    if (url.includes('drink_list.do')) {
      logger.info('Processing drink list page');

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);

      // Take a screenshot for debugging
      const screenshotPath = path.join(
        process.cwd(),
        'crawler',
        'crawler-outputs',
        'debug-screenshot.png'
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.info(`Screenshot saved to: ${screenshotPath}`);

      // Debug: Check what's available on the page
      const pageInfo = await page.evaluate(() => {
        const links = document.querySelectorAll('a.goDrinkView');
        const allLinks = document.querySelectorAll('a');
        const bodyText = document.body.innerText.substring(0, 500);

        return {
          goDrinkViewCount: links.length,
          totalLinksCount: allLinks.length,
          bodyText,
          firstGoDrinkViewLinks: Array.from(links)
            .slice(0, 5)
            .map((link) => ({
              href: (link as HTMLAnchorElement).href || 'NO_HREF',
              onclick:
                (link as HTMLElement).getAttribute('onclick') || 'NO_ONCLICK',
              text: link.textContent?.trim() || 'NO_TEXT',
              className: link.className || 'NO_CLASS',
              innerHTML: link.innerHTML.substring(0, 200),
            })),
          pageUrl: window.location.href,
          pageTitle: document.title,
        };
      });

      logger.info('Page title:', pageInfo.pageTitle);
      logger.info('Body text sample:', pageInfo.bodyText.substring(0, 200));
      logger.info(
        'First few product links:',
        JSON.stringify(pageInfo.firstGoDrinkViewLinks, null, 2)
      );

      // Try different selectors to find product links
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Web scraper needs complex DOM extraction logic
      const productIds = await page.evaluate((regex) => {
        const selectors = [
          'a.goDrinkView',
          'a[href*="drink_view.do"]',
          'a[href*="product_cd"]',
          '.product-item a',
          '.drink-item a',
          'a[onclick*="goDrinkView"]',
        ];

        let links: NodeListOf<Element> | null = null;
        let usedSelector = '';

        // Try each selector until we find one that works
        for (const selector of selectors) {
          const foundLinks = document.querySelectorAll(selector);
          if (foundLinks.length > 0) {
            links = foundLinks;
            usedSelector = selector;
            break;
          }
        }

        const ids: string[] = [];

        if (links) {
          const sampleHrefs: string[] = [];
          const sampleOnclicks: string[] = [];

          for (const link of links) {
            const href = (link as HTMLAnchorElement).href;
            const onclick =
              (link as HTMLAnchorElement).onclick?.toString() ||
              (link as HTMLElement).getAttribute('onclick') ||
              '';

            // Collect first 5 hrefs and onclicks for debugging
            if (sampleHrefs.length < 5) {
              sampleHrefs.push(href || 'NO_HREF');
              sampleOnclicks.push(onclick || 'NO_ONCLICK');
            }

            // Try to extract product ID from href
            if (href?.includes('drink_view.do')) {
              const match = href.match(new RegExp(regex));
              if (match) {
                ids.push(match[1]);
              }
            }

            // Try to extract product ID from onclick
            if (onclick?.includes('product_cd')) {
              const match = onclick.match(new RegExp(regex));
              if (match) {
                ids.push(match[1]);
              }
            }

            // Extract product ID from image src in innerHTML (new approach)
            const innerHTML = (link as HTMLElement).innerHTML;
            if (innerHTML) {
              // Look for pattern like [9200000006301] in image URLs
              const imgMatch = innerHTML.match(PRODUCT_CD_REGEX);
              if (imgMatch) {
                ids.push(imgMatch[1]);
              }
            }
          }

          return {
            ids,
            usedSelector,
            linksFound: links?.length || 0,
            sampleHrefs,
            sampleOnclicks,
          };
        }

        return {
          ids,
          usedSelector,
          linksFound: 0,
          sampleHrefs: [],
          sampleOnclicks: [],
        };
      }, PRODUCT_CD_REGEX.source);

      logger.info(
        `Selector used: ${productIds.usedSelector}, Links found: ${productIds.linksFound}`
      );
      logger.info(
        'Sample hrefs:',
        JSON.stringify(productIds.sampleHrefs, null, 2)
      );
      logger.info(
        'Sample onclicks:',
        JSON.stringify(productIds.sampleOnclicks, null, 2)
      );
      const ids = productIds.ids;

      logger.info(`Found ${ids.length} products to crawl`);

      // Prepare all product URLs
      const productRequests = ids.map((productId) => ({
        url: `https://www.starbucks.co.kr/menu/drink_view.do?product_cd=${productId}`,
        userData: { productId, isProductPage: true },
      }));

      // Enqueue all product pages at once
      await crawlerInstance.addRequests(productRequests);

      logger.info(`Enqueued ${ids.length} product pages for processing`);
      return;
    }

    // Handle individual product pages
    if (request.userData?.isProductPage) {
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
  },

  // Allow multiple concurrent requests for efficiency
  maxConcurrency: 5,
  maxRequestsPerCrawl: 200, // Limited for testing - increase for full crawl

  // Handle failures gracefully
  maxRequestRetries: 2,
  requestHandlerTimeoutSecs: 60,
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
