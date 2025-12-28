import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';

async function main() {
  const db = await getDb();
  if (!db) return;

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 44)).limit(1);
  
  if (job.length > 0 && job[0].article) {
    await fs.writeFile('sample_output_72b_job44.txt', job[0].article);
    console.log('Saved Job 44 article to sample_output_72b_job44.txt');
  } else {
    console.log('Job 44 not found or has no article');
  }
}

main();
