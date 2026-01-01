import 'dotenv/config';
import { getDb } from '../server/db';
import { seoArticleJobs } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 78));
  const job = jobs[0];

  if (job) {
    console.log(`Job 78 Status: ${job.status}`);
    console.log(`Job 78 Progress: ${job.progress}%`);
    
    console.log('\n--- STRUCTURE ---');
    try {
      const structure = JSON.parse(job.structure || '{}');
      console.log(JSON.stringify(structure, null, 2).substring(0, 2000)); // Print first 2000 chars
    } catch (e) {
      console.log('Structure is not valid JSON:', job.structure);
    }

    console.log('\n--- CONTENT PREVIEW ---');
    if (job.content) {
      console.log(job.content.substring(0, 1000));
    } else {
      console.log('No content generated.');
    }

    console.log('\n--- LOGS (Last 1000 chars) ---');
    console.log(job.log ? job.log.slice(-1000) : 'No log');
  } else {
    console.log('Job 78 not found');
  }
}

main();
