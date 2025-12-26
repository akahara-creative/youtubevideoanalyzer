import { getDb } from './server/db.js';
import { seoArticleEnhancements } from './drizzle/schema.js';
import { isNotNull, desc } from 'drizzle-orm';
import { generateWordPressHTML } from './server/wordpressExporter.js';
import fs from 'fs';

console.log('=== Testing WordPress Export ===\n');

const db = await getDb();
const result = await db.select()
  .from(seoArticleEnhancements)
  .where(isNotNull(seoArticleEnhancements.faqSection))
  .orderBy(desc(seoArticleEnhancements.createdAt))
  .limit(1);

if (result.length === 0) {
  console.log('❌ No enhanced article found');
  process.exit(1);
}

const enhancement = result[0];
console.log('✅ Found enhanced article:', enhancement.id);
console.log('   Theme:', enhancement.theme);
console.log('   FAQ length:', enhancement.faqSection?.length);
console.log('');

// FAQをパース
let faq = [];
if (enhancement.faqSection) {
  try {
    faq = JSON.parse(enhancement.faqSection);
    console.log('✅ FAQ parsed as JSON, count:', faq.length);
  } catch (e) {
    console.log('⚠️  FAQ is not JSON, parsing as Markdown');
    const faqText = enhancement.faqSection;
    const qaRegex = /###\s*Q\d+:\s*(.+?)\n+A:\s*(.+?)(?=\n###|$)/gs;
    const matches = [...faqText.matchAll(qaRegex)];
    console.log('✅ Found QA matches:', matches.length);
    
    for (const match of matches) {
      if (match[1] && match[2]) {
        faq.push({
          question: match[1].trim(),
          answer: match[2].trim(),
        });
      }
    }
    console.log('✅ Parsed FAQ count:', faq.length);
  }
}

console.log('');

// WordPressエクスポート生成
const metaInfo = enhancement.metaInfo ? JSON.parse(enhancement.metaInfo) : null;

const html = await generateWordPressHTML({
  body: enhancement.enhancedBody || '',
  aioSection: enhancement.aioSection || '',
  faq: faq.length > 0 ? faq : undefined,
  metaInfo,
});

console.log('=== Generated HTML ===');
console.log('HTML length:', html.length);
console.log('');

// FAQセクションが含まれているか確認
if (html.includes('<h2>よくある質問（FAQ）</h2>')) {
  console.log('✅ SUCCESS: FAQ section is included in HTML!');
  
  // FAQ部分を抽出して表示
  const faqStart = html.indexOf('<h2>よくある質問（FAQ）</h2>');
  const faqEnd = html.indexOf('<!-- JSON-LD', faqStart);
  const faqSection = html.substring(faqStart, faqEnd > 0 ? faqEnd : faqStart + 1000);
  
  console.log('');
  console.log('=== FAQ Section Preview ===');
  console.log(faqSection.substring(0, 500));
  console.log('...');
} else {
  console.log('❌ FAILED: FAQ section is NOT included in HTML!');
}

// ファイルに保存
fs.writeFileSync('/tmp/wordpress-export-test.txt', html);
console.log('');
console.log('✅ Saved to /tmp/wordpress-export-test.txt');
