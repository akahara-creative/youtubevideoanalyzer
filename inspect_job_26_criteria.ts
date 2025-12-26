
import 'dotenv/config';
import { getDb } from './server/db';
import { seoArticleJobs } from './drizzle/schema';
import { eq } from 'drizzle-orm';

async function inspectJob26Criteria() {
  const db = await getDb();
  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 26)).limit(1);
  const job = jobs[0];

  if (!job) {
    console.error('Job 26 not found');
    return;
  }

  console.log('=== Job 26 SEO Criteria ===');
  if (job.seoCriteria) {
    const criteria = typeof job.seoCriteria === 'string' ? JSON.parse(job.seoCriteria) : job.seoCriteria;
    console.log(JSON.stringify(criteria, null, 2));
  } else {
    console.log('No SEO Criteria found');
  }
}

inspectJob26Criteria();
