import { PlaywrightCrawler, type Request } from 'crawlee';
import type { Locator, Page } from 'playwright';
import { logger } from '../../shared/logger';
import {
  type Product,
  takeDebugScreenshot,
  waitForLoad,
  writeProductsToJson,
} from './crawlerUtils';

// Helper function to extract product data from a product container
async function extractProductData(
  container: Locator,
  categoryName: string
): Promise<Product | null> {
  try {
    // Extract all product data in parallel using the correct selectors
    const [name, nameEn, description, imageUrl] = await Promise.all([
      // Korean product name
      container
        .locator('.cont_text_title')
        .first()
        .textContent()
        .then((text) => text?.trim() || ''),

      // English product name
      container
        .locator('.cont_text_info div.text1')
        .first()
        .textContent()
        .then((text) => text?.trim() || null)
        .catch(() => null),

      // Product description
      container
        .locator('.cont_text_info div.text2')
        .first()
        .textContent()
        .then((text) => text?.trim() || null)
        .catch(() => null),

      // Product image
      container
        .locator('img')
        .first()
        .getAttribute('src')
        .then((src) => {
          if (!src) {
            return '';
          }
          return src.startsWith('/')
            ? `https://www.mega-mgccoffee.com${src}`
            : src;
        })
        .catch(() => ''),
    ]);

    // Generate a product if we have any name
    if (name && name.length > 0) {
      const product = {
        name,
        nameEn,
        description,
        price: null,
        externalImageUrl: imageUrl,
        category: 'Drinks',
        externalCategory: categoryName,
        externalId: `mega_${name}`,
        externalUrl: '', // Will be filled by caller
      };

      logger.info(`✅ Successfully created product: ${name}`);
      return product;
    }
    logger.warn('❌ No valid product name found in container');
  } catch (error) {
    logger.error('Error extracting product data:', error);
  }
  return null;
}

// Helper function to extract products from the current page
async function extractPageProducts(page: Page, categoryName = 'Default') {
  const products: Product[] = [];

  // Multiple selector strategies for finding product containers
  // Based on debugging, we found that the actual product containers have the class 'inner_modal_open'
  const containerSelectors = [
    '.cont_gallery_list .inner_modal_open', // This should be the actual product containers
    '.cont_gallery_list ul li',
    '.product-item',
    '.menu-item',
    '.item-box',
    'li[data-id]',
    '.gallery-item',
  ];

  let productContainers: Locator | null = null;
  let usedSelector = '';

  // Try each selector until we find products
  for (const selector of containerSelectors) {
    const containers = page.locator(selector);
    // biome-ignore lint/nursery/noAwaitInLoop: Sequential selector checking is intentional
    const count = await containers.count();
    if (count > 0) {
      productContainers = containers;
      usedSelector = selector;
      logger.info(`Found ${count} products using selector: ${selector}`);
      break;
    }
  }

  if (!productContainers) {
    logger.warn('No product containers found with any selector');
    return { products, usedSelector: 'none' };
  }

  const containerCount = await productContainers.count();

  // Process all products now that we have working selectors
  const limitedCount = containerCount; // Process all products
  logger.info(`Processing all ${limitedCount} products`);

  // Process first few containers for debugging
  const productPromises = Array.from({ length: limitedCount }, async (_, i) =>
    extractProductData(productContainers?.nth(i), categoryName)
  );

  const productResults = await Promise.all(productPromises);
  const validProducts = productResults.filter((p): p is Product => p !== null);

  // Set the external URL for all products
  const currentUrl = page.url();
  for (const product of validProducts) {
    product.externalUrl = currentUrl;
  }

  products.push(...validProducts);

  return { products, usedSelector };
}

// Helper function to discover menu categories
async function extractMenuCategories(page: Page) {
  await waitForLoad(page);

  const categories: Array<{ name: string; value: string; url: string }> = [];

  // Look for category checkboxes or filters
  const categorySelectors = [
    'input[name="list_checkbox"]',
    '.category-filter input',
    '.menu-category input',
    'input[type="checkbox"][data-category]',
  ];

  for (const selector of categorySelectors) {
    const checkboxes = page.locator(selector);
    // biome-ignore lint/nursery/noAwaitInLoop: Sequential selector checking is intentional
    const count = await checkboxes.count();

    if (count > 0) {
      logger.info(
        `Found ${count} category checkboxes with selector: ${selector}`
      );

      const checkboxPromises = Array.from({ length: count }, async (_, i) => {
        const checkbox = checkboxes.nth(i);
        const [value, name] = await Promise.all([
          checkbox.getAttribute('value').then((v) => v || ''),
          checkbox
            .locator('+ label, ~ label')
            .textContent()
            .then((t) => t?.trim() || `Category ${i + 1}`),
        ]);

        if (value) {
          return {
            name,
            value,
            url: `https://www.mega-mgccoffee.com/menu/?menu_category1=${value}`,
          };
        }
        return null;
      });

      const checkboxResults = await Promise.all(checkboxPromises);
      categories.push(
        ...checkboxResults.filter(
          (c): c is { name: string; value: string; url: string } => c !== null
        )
      );
      break;
    }
  }

  // If no categories found, use the main menu page
  if (categories.length === 0) {
    categories.push({
      name: 'All Menu',
      value: 'all',
      url: 'https://www.mega-mgccoffee.com/menu/',
    });
  }

  return categories;
}

// Handle main menu page with pagination - discover categories and all products
async function handleMainMenuPage(
  page: Page,
  crawlerInstance: PlaywrightCrawler
) {
  logger.info('Processing Mega MGC Coffee main menu page with pagination');

  await waitForLoad(page);

  await takeDebugScreenshot(page, 'mega-main-menu');

  // Try to discover categories
  const categories = await extractMenuCategories(page);
  logger.info(
    `Found ${categories.length} categories:`,
    categories.map((c) => c.name)
  );

  let currentPage = 1;
  let totalProductsExtracted = 0;

  // Handle pagination by clicking through all pages
  while (true) {
    logger.info(`Processing page ${currentPage}...`);

    // Wait for content to load
    // biome-ignore lint/nursery/noAwaitInLoop: Pagination requires sequential page processing
    await waitForLoad(page);

    // Extract products from the current page
    const pageProducts = await extractPageProducts(page, 'All Menu');
    logger.info(
      `Found ${pageProducts.products.length} products on page ${currentPage}`
    );

    // Save products from current page
    await Promise.all(
      pageProducts.products.map(async (product) => {
        await crawlerInstance.pushData(product);
        logger.info(
          `✅ Extracted: ${product.name} - Category: ${product.externalCategory}`
        );
      })
    );
    totalProductsExtracted += pageProducts.products.length;

    // Check if there's a next page button
    const nextButton = page.locator('.board_page_next');
    const nextButtonCount = await nextButton.count();

    if (nextButtonCount === 0) {
      logger.info('No next page button found, pagination complete');
      break;
    }

    // Check if the next button is disabled or not clickable
    const isDisabled = await nextButton
      .evaluate((el) => {
        return (
          el.hasAttribute('disabled') ||
          el.classList.contains('disabled') ||
          el.style.display === 'none' ||
          !(el as HTMLElement).offsetParent
        ); // Check if element is visible
      })
      .catch(() => true);

    if (isDisabled) {
      logger.info('Next page button is disabled, reached end of pagination');
      break;
    }

    // Click the next page button
    try {
      logger.info(
        `Clicking next page button to go to page ${currentPage + 1}...`
      );
      await nextButton.click();

      // Wait for the new page content to load
      await waitForLoad(page);

      currentPage++;

      // Safety check to prevent infinite loops
      if (currentPage > 50) {
        logger.warn('Reached maximum page limit (50), stopping pagination');
        break;
      }
    } catch (error) {
      logger.info(`Failed to click next button or no more pages: ${error}`);
      break;
    }
  }

  logger.info(
    `Pagination complete. Total products extracted: ${totalProductsExtracted} across ${currentPage} pages`
  );

  // If we found categories, enqueue them for processing (though pagination might cover all products)
  if (categories.length > 1) {
    // More than just "All Menu"
    const categoryRequests = categories
      .filter((cat) => cat.value !== 'all') // Skip "All Menu" as we already processed it
      .map((category) => ({
        url: category.url,
        userData: {
          categoryName: category.name,
          categoryValue: category.value,
          isCategoryPage: true,
        },
      }));

    await crawlerInstance.addRequests(categoryRequests);
    logger.info(
      `Enqueued ${categoryRequests.length} category pages for processing`
    );
  }
}

// Handle category-specific pages
async function handleCategoryPage(
  page: Page,
  request: Request,
  crawlerInstance: PlaywrightCrawler
) {
  const categoryName = request.userData.categoryName;
  const categoryValue = request.userData.categoryValue;

  logger.info(`Processing category: ${categoryName} (value: ${categoryValue})`);

  await waitForLoad(page);

  try {
    // Extract products from this category page
    const categoryProducts = await extractPageProducts(page, categoryName);

    logger.info(
      `Found ${categoryProducts.products.length} products in category: ${categoryName}`
    );

    // Save all products from this category
    await Promise.all(
      categoryProducts.products.map(async (product) => {
        await crawlerInstance.pushData(product);
        logger.info(
          `✅ Extracted: ${product.name} - Category: ${categoryName}`
        );
      })
    );

    // Check for pagination or "Load More" functionality
    const loadMoreButton = page.locator(
      'button:has-text("더보기"), .load-more, button:has-text("Load More")'
    );
    const loadMoreCount = await loadMoreButton.count();

    if (loadMoreCount > 0) {
      logger.info('Found "Load More" button, attempting to click');
      try {
        await loadMoreButton.first().click();
        await waitForLoad(page);

        // Extract additional products after loading more
        const additionalProducts = await extractPageProducts(
          page,
          categoryName
        );
        await Promise.all(
          additionalProducts.products.map(async (product) => {
            await crawlerInstance.pushData(product);
            logger.info(
              `✅ Additional: ${product.name} - Category: ${categoryName}`
            );
          })
        );
      } catch (error) {
        logger.warn('Could not click "Load More" button:', error);
      }
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

    // Handle main menu page
    if (url.includes('/menu/') && !request.userData?.isCategoryPage) {
      await handleMainMenuPage(page, crawlerInstance);
      return;
    }

    // Handle category pages
    if (request.userData?.isCategoryPage) {
      await handleCategoryPage(page, request, crawlerInstance);
    }
  },

  // Configuration for Mega MGC Coffee crawling
  maxConcurrency: 1, // Single concurrency for pagination
  maxRequestsPerCrawl: 10, // Fewer requests since we handle pagination internally
  maxRequestRetries: 2,
  requestHandlerTimeoutSecs: 300, // Much longer timeout for pagination (5 minutes)
});

(async () => {
  try {
    // Start with the main menu page
    await crawler.run(['https://www.mega-mgccoffee.com/menu/']);

    // Export collected data to JSON file
    const dataset = await crawler.getData();

    await writeProductsToJson(dataset.items as Product[], 'mega');
  } catch (error) {
    logger.error('Mega crawler failed:', error);
    process.exit(1);
  }
})();
