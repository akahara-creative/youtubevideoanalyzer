import 'dotenv/config';
import { getDb } from '../server/db';
import { seoArticleJobs } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 78));
  const job = jobs[0];

  if (job) {
    console.log(`Job 78 Status: ${job.status}`);
    console.log(`Job 78 Progress: ${job.progress}%`);
    
    if (job.structure) {
      fs.writeFileSync('debug_structure_78.txt', job.structure);
      console.log('Structure saved to debug_structure_78.txt');
    } else {
      console.log('No structure found.');
    }
  } else {
    console.log('Job 78 not found');
  }
}

main();
