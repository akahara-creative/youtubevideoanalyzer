import { getDb } from './server/db.js';
import { seoArticleEnhancements } from './drizzle/schema.js';
import { isNotNull, desc } from 'drizzle-orm';
import fs from 'fs';

const db = await getDb();
const result = await db.select({ faqSection: seoArticleEnhancements.faqSection })
  .from(seoArticleEnhancements)
  .where(isNotNull(seoArticleEnhancements.faqSection))
  .orderBy(desc(seoArticleEnhancements.createdAt))
  .limit(1);

if (result.length > 0) {
  const faqData = result[0].faqSection;
  console.log('=== FAQ Data ===');
  console.log(faqData);
  console.log('\n=== Length:', faqData?.length);
  console.log('=== Type:', typeof faqData);
  
  // Show first 500 characters with escape sequences visible
  console.log('\n=== First 500 chars (JSON stringified) ===');
  console.log(JSON.stringify(faqData?.substring(0, 500)));
  
  fs.writeFileSync('/tmp/faq-data.txt', faqData || 'null');
  console.log('\n✅ Saved to /tmp/faq-data.txt');
} else {
  console.log('❌ No FAQ data found');
}
