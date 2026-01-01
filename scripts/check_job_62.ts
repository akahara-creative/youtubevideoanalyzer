import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 62)).limit(1);
  
  if (job.length > 0) {
    const j = job[0];
    console.log(`Job ID: ${j.id}`);
    console.log(`Status: ${j.status}`);
    console.log(`Current Step: ${j.currentStep}`);
    console.log(`Progress: ${j.progress}%`);
    console.log(`Updated At: ${j.updatedAt}`);
    if (j.errorMessage) {
      console.log(`Error: ${j.errorMessage}`);
    }
    
    // Check extra inputs again
    const pp = JSON.parse(j.painPoints || '[]');
    const sk = JSON.parse(j.storyKeywords || '[]');
    const ob = JSON.parse(j.offerBridge || '[]');
    console.log(`Pain Points Length: ${JSON.stringify(pp).length}`);
    console.log(`Story Keywords Length: ${JSON.stringify(sk).length}`);
    console.log(`Offer Bridge Length: ${JSON.stringify(ob).length}`);
  } else {
    console.log('Job 62 not found');
  }
}

main();
