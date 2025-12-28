import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 38)).limit(1);
  
  if (job.length === 0) {
    console.log('Job 38 NOT found');
  } else {
    console.log('Job 38 FOUND');
    console.log('Status:', job[0].status);
  }
}

main();
