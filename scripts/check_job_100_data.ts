
import { getDb } from '../server/db';
import { seoArticleJobs } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function checkJob() {
  const db = await getDb();
  if (!db) return;

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 100)).limit(1);
  if (job.length === 0) {
    console.log('Job 100 not found');
    return;
  }

  const j = job[0];
  console.log('Status:', j.status);
  console.log('Current Step:', j.currentStep);
  console.log('Analyses length:', j.analyses ? j.analyses.length : 'null');
  console.log('Structure length:', j.structure ? j.structure.length : 'null');
  console.log('Article length:', j.article ? j.article.length : 'null');
}

checkJob().catch(console.error);
