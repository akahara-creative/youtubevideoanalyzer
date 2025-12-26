
import 'dotenv/config';
import { getDb } from './server/db';
import { seoArticleJobs } from './drizzle/schema';
import { eq } from 'drizzle-orm';

async function inspectJob26() {
  const db = await getDb();
  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 26)).limit(1);
  const job = jobs[0];

  if (!job) {
    console.error('Job 26 not found');
    return;
  }

  console.log('=== Job 26 Inspection ===');
  console.log('Status:', job.status);
  
  // 1. Check Structure (Last Section)
  const structure = typeof job.structure === 'string' ? JSON.parse(job.structure) : job.structure;
  if (structure && structure.structure) {
    const lines = structure.structure.split('\n');
    const lastH2Index = lines.findLastIndex(l => l.startsWith('## '));
    console.log('\n[Planned Last Section]');
    console.log(lines.slice(lastH2Index).join('\n'));
  }

  // 2. Check Article Ending
  if (job.article) {
    console.log('\n[Actual Article Ending (last 500 chars)]');
    console.log(job.article.slice(-500));
  }

  // 3. Check Quality/Keywords
  if (job.qualityCheck) {
    const quality = typeof job.qualityCheck === 'string' ? JSON.parse(job.qualityCheck) : job.qualityCheck;
    console.log('\n[Quality Check Result]');
    console.log(JSON.stringify(quality, null, 2));
  } else {
    console.log('\n[Quality Check] None');
  }
}

inspectJob26();
