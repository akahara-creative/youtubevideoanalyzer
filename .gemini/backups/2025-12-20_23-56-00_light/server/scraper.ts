import puppeteer from 'puppeteer';

/**
 * Google検索を実行して上位記事のURLを取得する
 */
export async function searchGoogle(keyword: string, limit: number = 5): Promise<string[]> {
  console.log(`[Scraper] Searching Google for: ${keyword}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ja-JP']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    // 日本語設定のユーザーエージェント
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Google検索（日本語）
    await page.goto(`https://www.google.co.jp/search?q=${encodeURIComponent(keyword)}&hl=ja&gl=jp`, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // 検索結果のリンクを取得
    const links = await page.evaluate(() => {
      const results = Array.from(document.querySelectorAll('div.g'));
      return results.map(div => {
        const anchor = div.querySelector('a');
        return anchor ? anchor.href : null;
      }).filter(href => {
        return href && 
               href.startsWith('http') && 
               !href.includes('google.com') && 
               !href.includes('google.co.jp') &&
               !href.includes('youtube.com'); // 動画は除外
      });
    });

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
    
    // タイムアウト設定（30秒）
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const data = await page.evaluate(() => {
      // タイトル取得
      const title = document.title || '';
      
      // ディスクリプション取得
      const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || 
                          document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      
      // 見出し取得
      const getHeadings = (tagName: string) => {
        return Array.from(document.querySelectorAll(tagName))
          .map(el => (el as HTMLElement).innerText.trim())
          .filter(text => text.length > 0);
      };
      
      const h1 = getHeadings('h1');
      const h2 = getHeadings('h2');
      const h3 = getHeadings('h3');
      
      // 本文取得（メインコンテンツの推定）
      // articleタグがあればそれ、なければmain、なければbody
      let contentEl = document.querySelector('article');
      if (!contentEl) contentEl = document.querySelector('main');
      if (!contentEl) contentEl = document.body as any;
      
      if (!contentEl) return { title, description, h1, h2, h3, content: '', wordCount: 0 };

      // 不要な要素を削除（クローンしてから操作）
      const clone = contentEl.cloneNode(true) as HTMLElement;
      const removeSelectors = [
        'nav', 'header', 'footer', 'script', 'style', 'iframe', 
        '.sidebar', '.menu', '.ad', '.advertisement', '#comments'
      ];
      removeSelectors.forEach(sel => {
        const els = clone.querySelectorAll(sel);
        els.forEach(el => el.remove());
      });
      
      const content = clone.innerText.trim();
      const wordCount = content.replace(/\s/g, '').length;
      
      return { title, description, h1, h2, h3, content, wordCount };
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
