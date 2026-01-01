import 'dotenv/config';
import { getDb } from '../server/db';
import { seoArticleJobs } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 74));
  const job = jobs[0];

  if (job && job.structure) {
    fs.writeFileSync('debug_structure_74.txt', job.structure);
    console.log('Saved structure to debug_structure_74.txt');
  } else {
    console.log('Job 74 structure is empty or null');
  }
}

main();
