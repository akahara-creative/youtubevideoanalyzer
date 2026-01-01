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
    if (job.log) {
      fs.writeFileSync('debug_log_78.txt', job.log);
      console.log('Log saved to debug_log_78.txt');
    } else {
      console.log('No log found.');
    }
    
    if (job.content) {
        fs.writeFileSync('debug_content_78.txt', job.content);
        console.log('Content saved to debug_content_78.txt');
    } else {
        console.log('No content found in DB.');
    }
  }
}

main();
