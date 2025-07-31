import fs from 'node:fs';
import path from 'node:path';
import { PlaywrightCrawler } from 'crawlee';
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

async function extractProductData(page: {
  evaluate: (fn: () => unknown) => Promise<unknown>;
}): Promise<Product> {
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

const crawler = new PlaywrightCrawler({
  launchContext: {
    launchOptions: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
  async requestHandler({ page, request, log }) {
    log.info(`Processing ${request.url}`);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Get number of products available
    const productCount = await page.evaluate(() => {
      return document.querySelectorAll('a.goDrinkView').length;
    });

    log.info(`Found ${productCount} products to crawl`);

    const maxProducts = productCount;
    const products: Product[] = [];

    for (let i = 0; i < maxProducts; i++) {
      try {
        log.info(`Processing product ${i + 1}/${maxProducts}`);

        // Click the product at index i
        // biome-ignore lint/nursery/noAwaitInLoop: Sequential processing required for web scraping
        await page.evaluate((index) => {
          const links = document.querySelectorAll('a.goDrinkView');
          if (links[index]) {
            (links[index] as HTMLElement).click();
          }
        }, i);

        await page.waitForTimeout(2000);

        // Check if we navigated to product page
        const currentUrl = page.url();
        if (currentUrl.includes('drink_view.do')) {
          const product = await extractProductData(page);
          if (product.name) {
            const finalProduct: Product = {
              ...product,
              price: null,
              category: 'Drinks',
            };

            products.push(finalProduct);
            log.info(
              `✅ Extracted: ${finalProduct.name} (${finalProduct.nameEn})`
            );
          }
        }

        // Go back to listing page
        await page.goBack();
        await page.waitForTimeout(1000);
      } catch (error) {
        log.info(`❌ Error processing product ${i + 1}: ${error}`);
      }
    }

    // Save all extracted products
    if (products.length > 0) {
      const outputPath = path.join(process.cwd(), 'crawler', 'crawler-outputs');
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const filename = `starbucks-products-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(outputPath, filename);

      fs.writeFileSync(filepath, JSON.stringify(products, null, 2));
      logger.info(`Saved ${products.length} products to ${filename}`);
      // Log summary
      logger.info('=== CRAWL SUMMARY ===');
      logger.info(`Total products extracted: ${products.length}`);
      for (const [i, p] of products.entries()) {
        logger.info(`${i + 1}. ${p.name} (${p.nameEn}) - ID: ${p.externalId}`);
      }
    }
  },
  maxRequestsPerCrawl: 1,
  maxConcurrency: 1,
});

(async () => {
  await crawler.run(['https://www.starbucks.co.kr/menu/drink_list.do']);
})();
