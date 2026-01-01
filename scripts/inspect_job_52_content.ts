import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 52)).limit(1);
  
  if (job.length > 0) {
    const j = job[0];
    console.log(`Job ID: ${j.id}`);
    console.log(`Status: ${j.status}`);
    console.log(`Article Length: ${j.article?.length}`);
    console.log('--- Last 500 chars ---');
    console.log(j.article?.slice(-500));
    console.log('--- End ---');
    
    // Check structure
    console.log('Structure:', j.structure);
  } else {
    console.log('Job 52 not found');
  }
}

main();
