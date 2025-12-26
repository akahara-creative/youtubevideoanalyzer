import 'dotenv/config';
import { getDb } from './server/db';
import { seoArticleJobs } from './drizzle/schema';
import { eq } from 'drizzle-orm';

async function checkPersonas() {
  const db = await getDb();
  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 30)).limit(1);
  
  if (job.length > 0) {
    console.log('Generated Personas:', job[0].generatedPersonas);
  } else {
    console.log('Job 30 not found');
  }
  process.exit(0);
}

checkPersonas();
