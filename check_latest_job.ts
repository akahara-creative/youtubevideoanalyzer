import 'dotenv/config';
import { getDb } from './server/db';
import { seoArticleJobs } from './drizzle/schema';
import { desc, eq } from 'drizzle-orm';

async function checkLatestJob() {
  const db = await getDb();
  if (!db) {
    console.error('Failed to connect to DB');
    return;
  }

  // const job21 = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 21));
  const jobs = await db.select().from(seoArticleJobs).orderBy(desc(seoArticleJobs.id)).limit(1);

  if (jobs.length > 0) {
    const job = jobs[0];
    console.log('Latest Job ID:', job.id);
    console.log('Status:', job.status);
    console.log('Current Step:', job.currentStep);
    console.log('Progress:', job.progress);
    console.log('Theme:', job.theme);
    console.log('Remarks:', job.remarks);
    console.log('Offer:', job.offer);
    console.log('Target Word Count:', job.targetWordCount);
    
    // Check Criteria
    const criteria = typeof job.criteria === 'string' ? JSON.parse(job.criteria) : job.criteria;
    // console.log('Criteria Target H2:', criteria?.targetH2Count);

    // Check Structure (Plan)
    const structure = typeof job.structure === 'string' ? JSON.parse(job.structure) : job.structure;
    console.log('Structure Estimates:', structure?.estimates);
    console.log('Structure Content Length:', structure?.structure?.length);
    console.log('Structure Markdown Start:', structure?.structure?.substring(0, 500));
  
    if (job.structure) {
      const fs = await import('fs');
      fs.writeFileSync('job20_structure.txt', job.structure);
      console.log('Dumped structure to job20_structure.txt');
    }
    if (job.article) {
      const fs = await import('fs');
      fs.writeFileSync('job20_article.txt', job.article);
      console.log('Dumped article to job20_article.txt');
    }

    // Check Article (Result)
    console.log('Article Length:', job.article?.length);
    console.log('Article Start:', job.article?.substring(0, 200));
    console.log('Article End:', job.article?.substring(job.article.length - 200));
  } else {
    console.log('No jobs found.');
  }
}

checkLatestJob();
