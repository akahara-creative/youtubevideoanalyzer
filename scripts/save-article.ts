
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import 'dotenv/config';
import fs from 'fs';

async function saveArticle() {
  const db = await getDb();
  const docs = await db.select().from(ragDocuments).where(eq(ragDocuments.sourceId, 'seo_job_27'));
  const doc = docs[0];
  
  if (!doc) {
    console.error('Document for Job 27 not found');
    return;
  }
  
  fs.writeFileSync('temp_article_27.txt', doc.content);
  console.log('Saved to temp_article_27.txt');
}

saveArticle().catch(console.error);
