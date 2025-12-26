import 'dotenv/config';
import { getDb } from './server/db';
import { ragDocuments, seoArticleJobs } from './drizzle/schema';
import { eq, desc } from 'drizzle-orm';

async function checkData() {
  const db = await getDb();
  if (!db) {
    console.error('Failed to connect to DB');
    return;
  }

  // Check RAG documents
  const ragCount = await db.select().from(ragDocuments);
  console.log(`RAG Documents count: ${ragCount.length}`);
  if (ragCount.length > 0) {
    console.log('Sample RAG Doc:', ragCount[0].content.substring(0, 50) + '...');
  }

  // Check Job 1
  const jobs = await db.select().from(seoArticleJobs).orderBy(desc(seoArticleJobs.id)).limit(1);
  if (jobs.length > 0) {
    const job = jobs[0];
    console.log('Latest Job ID:', job.id);
    console.log('Theme:', job.theme);
    console.log('Remarks:', job.remarks);
    console.log('Offer:', job.offer);
    console.log('Keywords (Raw):', job.keywords);
    console.log('Generated Article Length:', job.article?.length);
    console.log('Article Start:', job.article?.substring(0, 100));
  } else {
    console.log('No jobs found.');
  }
}

checkData();
