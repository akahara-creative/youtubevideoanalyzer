import 'dotenv/config';
import { getDb } from '../server/db';
import { seoArticleJobs, longContents } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 71));
  const job = jobs[0];

  if (!job) {
    console.log('Job 71 not found');
    return;
  }

  console.log(`Job 71 Status: ${job.status}`);
  
  if (job.generatedContentId) {
    const contents = await db.select().from(longContents).where(eq(longContents.id, job.generatedContentId));
    const content = contents[0];
    if (content) {
      console.log('\n--- Generated Content Preview (First 2000 chars) ---');
      console.log(content.content.substring(0, 2000));
      console.log('\n--- End Preview ---');
    } else {
      console.log('Content not found');
    }
  } else {
    console.log('No generated content ID');
  }
}

main();
