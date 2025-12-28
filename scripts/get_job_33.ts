import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 33)).limit(1);
  
  if (job.length === 0) {
    console.error('Job 33 not found');
    return;
  }

  const j = job[0];
  console.log('THEME:', j.theme);
  console.log('TARGET_WORD_COUNT:', j.targetWordCount);
  console.log('AUTHOR_NAME:', j.authorName);
  console.log('TARGET_PERSONA:', j.targetPersona);
  console.log('KEYWORDS:', j.keywords);
}

main();
