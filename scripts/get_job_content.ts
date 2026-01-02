import 'dotenv/config';
import { getDb } from '../server/db';
import { seoArticleJobs, longContents } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const jobId = parseInt(process.argv[2]);
  if (!jobId) {
    console.error('Please provide a job ID');
    process.exit(1);
  }

  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, jobId));
  const job = jobs[0];

  if (!job) {
    console.log(`Job ${jobId} not found`);
    return;
  }

  console.log(`Job ${jobId} Status: ${job.status}`);
  
  if (job.generatedContentId) {
    const contents = await db.select().from(longContents).where(eq(longContents.id, job.generatedContentId));
    const content = contents[0];
    if (content) {
      console.log('\n--- Generated Content Preview (First 3000 chars) ---');
      console.log(content.content.substring(0, 3000));
      console.log('\n--- End Preview ---');
    } else {
      console.log('Content not found');
    }
  } else if (job.article) {
    console.log('\n--- Generated Content Preview (First 3000 chars from job.article) ---');
    console.log(job.article.substring(0, 3000));
    console.log('\n--- End Preview ---');
  } else {
    console.log('No generated content ID or article content');
  }
}

main();
