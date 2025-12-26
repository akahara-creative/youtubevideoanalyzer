
import 'dotenv/config';
import { getDb } from './server/db';
import { seoArticleJobs } from './drizzle/schema';
import { eq } from 'drizzle-orm';

async function inspectJob27() {
  const db = await getDb();
  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 28)).limit(1);
  const job = jobs[0];

  if (!job) {
    console.error('Job 28 not found');
    return;
  }

  console.log('=== Job 28 Details ===');
  console.log(`Status: ${job.status}`);
  console.log(`Article Length: ${job.article?.length}`);
  
  if (job.qualityCheck) {
    const qc = typeof job.qualityCheck === 'string' ? JSON.parse(job.qualityCheck) : job.qualityCheck;
    console.log('\n=== Quality Check ===');
    console.log(`Passed: ${qc.passed}`);
    console.log(`Word Count: ${qc.wordCount}`);
    console.log('Keyword Counts:');
    qc.keywordCounts.forEach((k: any) => {
      console.log(`- ${k.keyword}: ${k.count} (Target: ${k.target})`);
    });
    console.log('Issues:', qc.issues);
  } else {
    console.log('\nNo Quality Check result found yet.');
  }
}

inspectJob27();
