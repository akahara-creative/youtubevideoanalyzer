
import { getDb } from '../server/db';
import { seoArticleJobs } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import 'dotenv/config';
import fs from 'fs';

async function saveRawArticle() {
  const db = await getDb();
  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 27));
  const job = jobs[0];
  
  if (!job) {
    console.error('Job 27 not found');
    return;
  }
  
  fs.writeFileSync('raw_article_27.txt', job.article || '');
  console.log('Saved to raw_article_27.txt');
}

saveRawArticle().catch(console.error);
