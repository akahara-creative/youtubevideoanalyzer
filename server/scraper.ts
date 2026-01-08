import puppeteer from 'puppeteer';

/**
 * Google検索を実行して上位記事のURLを取得する
 */
export async function searchGoogle(keyword: string, limit: number = 5): Promise<string[]> {
  console.log(`[Scraper] Searching Google for: ${keyword}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--lang=ja-JP',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Stealth: Override navigator properties
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      // @ts-ignore
      window.chrome = {
        runtime: {},
      };
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    // 日本語設定のユーザーエージェント (より一般的なものに更新)
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    // Google検索（日本語）
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(`https://www.google.co.jp/search?q=${encodeURIComponent(keyword)}&hl=ja&gl=jp`, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // 検索結果のリンクを取得
    try {
      await page.waitForSelector('div#search', { timeout: 5000 });
    } catch (e) {
      console.log("[Scraper] Timeout waiting for div#search, trying to parse anyway");
    }

    const links = await page.evaluate(() => {
      // 複数のセレクタを試す
      const selectors = [
        'div.g a', // 標準的な検索結果
        'div.tF2Cxc a', // 別のパターン
        'div.yuRUbf a', // タイトルリンクのコンテナ
        'a[jsname="UWckNb"]' // モバイル/特定のビュー
      ];
      
      let foundLinks: string[] = [];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const href = (el as HTMLAnchorElement).href;
          if (href) foundLinks.push(href);
        });
      }

      return foundLinks.filter(href => {
        return href && 
               href.startsWith('http') && 
               !href.includes('google.com') && 
               !href.includes('google.co.jp') &&
               !href.includes('youtube.com') &&
               !href.includes('search?') &&
               !href.includes('aclk?'); // 広告を除外
      });
    });

    if (links.length === 0) {
      console.log("[Scraper] No links found. Taking screenshot...");
      await page.screenshot({ path: 'scraper_debug.png' });
      const html = await page.content();
      console.log("[Scraper] Page HTML length:", html.length);
      console.log("[Scraper] Page HTML:", html.substring(0, 2000)); // Log first 2000 chars
    }

    // 重複を除去して制限数まで返す
    const uniqueLinks = Array.from(new Set(links)).slice(0, limit);
    console.log(`[Scraper] Found ${uniqueLinks.length} links for "${keyword}"`);
    return uniqueLinks as string[];
    
  } catch (error) {
    console.error('[Scraper] Google search failed:', error);
    return [];
  } finally {
    await browser.close();
  }
}

/**
 * 指定されたURLの記事をスクレイピングする
 */
export async function scrapeArticle(url: string): Promise<{
  title: string;
  content: string;
  h1: string[];
  h2: string[];
  h3: string[];
  description: string;
  wordCount: number;
}> {
  console.log(`[Scraper] Scraping: ${url}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // タイムアウト設定（60秒）と待機条件の変更
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // JSのレンダリング待ち
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Page URL:', page.url());
    const data = await page.evaluate(() => {
      const title = document.title || '';
      
      // Get headings
      const h1 = Array.from(document.querySelectorAll('h1')).map(el => (el as HTMLElement).innerText.trim());
      const h2 = Array.from(document.querySelectorAll('h2')).map(el => (el as HTMLElement).innerText.trim());
      const h3 = Array.from(document.querySelectorAll('h3')).map(el => (el as HTMLElement).innerText.trim());
      
      // Get description
      const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

      // Get content
      let contentEl = document.querySelector('article');
      if (!contentEl) contentEl = document.querySelector('main');
      if (!contentEl) contentEl = document.body;

      if (!contentEl) {
        return { title, description, h1, h2, h3, content: '', wordCount: 0 };
      }

      // Clone and clean
      try {
        const clone = contentEl.cloneNode(true) as HTMLElement;
        const removeSelectors = [
          'nav', 'header', 'footer', 'script', 'style', 'iframe', 'noscript',
          '.sidebar', '.menu', '.ad', '.advertisement', '#comments'
        ];
        removeSelectors.forEach(sel => {
          const els = clone.querySelectorAll(sel);
          els.forEach(el => el.remove());
        });
        
        const content = clone.innerText.trim();
        const wordCount = content.replace(/\s/g, '').length;
        
        return { title, description, h1, h2, h3, content, wordCount };
      } catch (e) {
        // Fallback if cloning fails
        return { title, description, h1, h2, h3, content: (contentEl as HTMLElement).innerText, wordCount: 0 };
      }
    });

    return data;
    
  } catch (error) {
    console.error(`[Scraper] Failed to scrape ${url}:`, error);
    return { 
      title: '', 
      content: '', 
      h1: [], 
      h2: [], 
      h3: [], 
      description: '',
      wordCount: 0
    };
  } finally {
    await browser.close();
  }
}
