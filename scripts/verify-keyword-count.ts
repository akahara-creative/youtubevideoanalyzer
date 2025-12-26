
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

async function verifyKeywordCount() {
  const db = await getDb();
  
  // Fetch the article from Job 26 (ID 408)
  const docs = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 408));
  const doc = docs[0];
  
  if (!doc) {
    console.error('Document 408 not found');
    return;
  }
  
  const article = doc.content;
  console.log(`Article length: ${article.length}`);
  
  // Target keywords
  const targetKeywords = [
    "動画編集 副業 始め方",
    "動画編集 副業 稼げない",
    "動画編集 案件 取れない",
    "動画編集 未経験 難しい",
    "動画編集 副業 初心者"
  ];
  
  // New Logic (Fuzzy Regex)
  console.log('\n--- New Logic (Fuzzy Regex) ---');
  
  targetKeywords.forEach(keyword => {
    const terms = keyword.split(/\s+/).filter(t => t.length > 0);
    const regexPattern = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.{0,10}');
    const regex = new RegExp(regexPattern, 'gi');
    const matches = article.match(regex);
    console.log(`"${keyword}" (fuzzy): ${matches ? matches.length : 0}`);
    if (matches && matches.length > 0) {
      console.log(`  Sample match: "${matches[0]}"`);
    }
  });
}

verifyKeywordCount().catch(console.error);
