import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs } from '../drizzle/schema.ts';
import { desc } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).orderBy(desc(seoArticleJobs.id)).limit(1);
  
  if (jobs.length > 0) {
    const j = jobs[0];
    console.log(`Latest Job ID: ${j.id}`);
    console.log(`Status: ${j.status}`);
    console.log(`Current Step: ${j.currentStep}`);
    console.log(`Progress: ${j.progress}%`);
    console.log(`Updated At: ${j.updatedAt}`);
  } else {
    console.log('No jobs found');
  }
}

main();
