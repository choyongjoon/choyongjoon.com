import fs from 'node:fs';
import path from 'node:path';
import { PlaywrightCrawler } from 'crawlee';

interface Product {
  name: string;
  name_en: string;
  description: string;
  price: string | null;
  image: string;
  category: string;
  category_origin: string;
  id_origin: string;
  url: string;
}

function extractProductData(page: {
  evaluate: (fn: () => unknown) => Promise<unknown>;
}) {
  return page.evaluate(() => {
    // Extract Korean name
    const nameElement = document.querySelector('.myAssignZone > h4');
    let name = nameElement?.textContent?.trim() || '';

    // Extract English name
    const nameEnElement = document.querySelector('.myAssignZone > h4 > span');
    const name_en = nameEnElement?.textContent?.trim() || '';

    // Clean Korean name by removing English part
    if (name_en && name.includes(name_en)) {
      name = name.replace(name_en, '').trim();
    }

    // Extract description
    const descElement = document.querySelector('p.t1');
    const description = descElement?.textContent?.trim() || '';

    // Extract category
    const categoryElement = document.querySelector('.cate');
    const category_origin = categoryElement?.textContent?.trim() || '';

    // Extract image
    let image = '';
    const imgElement = document.querySelector('.elevatezoom-gallery > img:nth-child(1)');
    if (imgElement) {
      image = (imgElement as HTMLImageElement).src;
    }

    // Extract ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const id_origin = urlParams.get('product_cd') || '';

    return {
      name,
      name_en,
      description,
      category_origin,
      id_origin,
      image,
      url: window.location.href,
    };
  });
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

    // Process products (limit to 10 for initial run)
    const maxProducts = Math.min(10, productCount);
    const products: Product[] = [];

    // biome-ignore lint/nursery/noAwaitInLoop: Sequential processing is required for web crawling
    for (let i = 0; i < maxProducts; i++) {
      try {
        log.info(`Processing product ${i + 1}/${maxProducts}`);

        // Click the product at index i
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
              `✅ Extracted: ${finalProduct.name} (${finalProduct.name_en})`
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
      const outputPath = path.join(process.cwd(), 'crawler-outputs');
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const filename = `starbucks-products-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(outputPath, filename);

      fs.writeFileSync(filepath, JSON.stringify(products, null, 2));
      log.info(`💾 Saved ${products.length} products to ${filename}`);
      // Log summary
      log.info('\n=== CRAWL SUMMARY ===');
      log.info(`Total products extracted: ${products.length}`);
      for (const [i, p] of products.entries()) {
        log.info(`${i + 1}. ${p.name} (${p.name_en}) - ID: ${p.id_origin}`);
      }
    }
  },
  maxRequestsPerCrawl: 1,
  maxConcurrency: 1,
});

(async () => {
  await crawler.run(['https://www.starbucks.co.kr/menu/drink_list.do']);
})();
