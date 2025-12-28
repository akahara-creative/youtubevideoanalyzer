import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 37)).limit(1);
  
  if (job.length === 0) {
    console.error('Job 37 not found');
    return;
  }

  const j = job[0];
  console.log('Job ID:', j.id);
  console.log('Status:', j.status);
  console.log('Current Step:', j.currentStep);
  console.log('Structure:', j.structure);
}

main();
