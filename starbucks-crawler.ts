import { PlaywrightCrawler } from 'crawlee';
import fs from 'fs';
import path from 'path';

interface Product {
    name: string;
    price: string;
    image: string;
    category: string;
}

const crawler = new PlaywrightCrawler({
    launchContext: {
        launchOptions: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    },
    async requestHandler({ page, request, log }) {
        log.info(`Processing ${request.url}`);
        
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);
        
        await page.evaluate(() => {
            window.scrollBy(0, 1000);
        });
        await page.waitForTimeout(2000);
        
        const pageContent = await page.content();
        log.info(`Page content length: ${pageContent.length}`);
        
        const products: Product[] = await page.evaluate(() => {
            const items: Product[] = [];
            
            console.log('Searching for product elements...');
            
            const possibleSelectors = [
                'dl.product_list dd',
                '.product_list dd',
                '.product_list li',
                '.menu_list li',
                'li[data-name]',
                '.product-item',
                '.menu-item',
                'a[href*="product"]',
                'div[class*="product"]',
                'div[class*="menu"]'
            ];
            
            let foundProducts = false;
            
            for (const selector of possibleSelectors) {
                const elements = document.querySelectorAll(selector);
                console.log(`Trying selector '${selector}': found ${elements.length} elements`);
                
                if (elements.length > 0) {
                    elements.forEach((element, index) => {
                        let name = '';
                        let image = '';
                        
                        if (element.hasAttribute('data-name')) {
                            name = element.getAttribute('data-name') || '';
                        } else {
                            const nameElement = element.querySelector('span, a, h3, h4, .name, .title') || element;
                            name = nameElement.textContent?.trim() || '';
                        }
                        
                        const imageElement = element.querySelector('img') as HTMLImageElement;
                        image = imageElement?.src || '';
                        
                        if (name && 
                            name.length > 2 && 
                            name.length < 100 &&
                            !name.includes('카테고리') && 
                            !name.includes('분류') &&
                            !name.includes('보기') &&
                            !name.includes('테마') &&
                            !name.includes('전체')) {
                            
                            items.push({
                                name: name,
                                price: 'Price not available on listing page',
                                image: image,
                                category: 'Drinks'
                            });
                            foundProducts = true;
                        }
                    });
                    
                    if (foundProducts) {
                        console.log(`Successfully found products using selector: ${selector}`);
                        break;
                    }
                }
            }
            
            if (!foundProducts) {
                console.log('No products found with any selector. Trying to find any links or text...');
                const allLinks = document.querySelectorAll('a');
                console.log(`Found ${allLinks.length} links on page`);
                
                allLinks.forEach((link, index) => {
                    const href = link.href;
                    const text = link.textContent?.trim() || '';
                    
                    if (href && href.includes('product') && text && text.length > 2 && text.length < 50) {
                        items.push({
                            name: text,
                            price: 'Price not available',
                            image: '',
                            category: 'Drinks'
                        });
                    }
                    
                    if (index < 5) {
                        console.log(`Link ${index}: "${text}" -> ${href}`);
                    }
                });
            }
            
            return items.slice(0, 50);
        });
        
        log.info(`Found ${products.length} products`);
        
        if (products.length > 0) {
            const filename = `starbucks-menu-${new Date().toISOString().split('T')[0]}.json`;
            const filepath = path.join(process.cwd(), 'crawler-outputs', filename);
            
            fs.writeFileSync(filepath, JSON.stringify(products, null, 2));
            log.info(`Saved ${products.length} products to ${filename}`);
        } else {
            log.info('No products found. Taking screenshot for debugging...');
            await page.screenshot({ path: path.join(process.cwd(), 'crawler-outputs', 'starbucks-debug.png'), fullPage: true });
            log.info('Screenshot saved as starbucks-debug.png');
        }
    },
    maxRequestsPerCrawl: 1,
    maxConcurrency: 1,
});

(async () => {
    await crawler.run(['https://www.starbucks.co.kr/menu/drink_list.do']);
})();