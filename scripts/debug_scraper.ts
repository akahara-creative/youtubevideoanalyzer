import { searchGoogle, scrapeArticle } from '../server/scraper';

async function main() {
  console.log('--- Debugging Scraper ---');
  
  const keyword = '動画編集 稼げない';
  console.log(`Searching for: ${keyword}`);
  
  const links = await searchGoogle(keyword, 3);
  console.log(`Found ${links.length} links:`, links);
  
  const testUrl = 'https://stock-sun.com/column/video-editing-kasegenai/';
  console.log(`Scraping test link: ${testUrl}`);
  
  // Add console listener to scraper? No, I need to modify scraper.ts to expose page or add listener.
  // Instead, I'll modify scraper.ts to log inside evaluate.
  const data = await scrapeArticle(testUrl);
    console.log('Scraped Data:', {
      title: data.title,
      wordCount: data.wordCount,
      h2Count: data.h2.length,
      contentPreview: data.content.substring(0, 100)
    });
  // } else {
  //   console.log('No links found. Google Search likely blocked.');
  // }
}

main().catch(console.error).finally(() => process.exit());
