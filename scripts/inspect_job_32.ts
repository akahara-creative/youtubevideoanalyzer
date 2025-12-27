import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Starting script...');
  const db = await getDb();
  console.log('DB connected:', !!db);
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).orderBy(seoArticleJobs.id);
  console.log('Total jobs:', jobs.length);
  jobs.forEach(j => console.log(`Job ${j.id}: ${j.status}`));

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 32)).limit(1);
  
  if (job.length === 0) {
    console.error('Job 32 not found');
    return;
  }

  const j = job[0];
  console.log('Job 32 Status:', j.status);
  console.log('Theme:', j.theme);
  console.log('Article Length:', j.article?.length);
  
  if (j.article) {
    console.log('\n--- Article Start ---');
    console.log(j.article.substring(0, 500));
    console.log('--- Article End ---');
    
    // Check H2s
    const h2Matches = j.article.match(/^##\s+.+$/gm);
    console.log('\nH2 Count:', h2Matches ? h2Matches.length : 0);
    if (h2Matches) {
      console.log('H2s:', h2Matches);
    }

    // Check Keywords
    console.log('\n--- Keyword Check ---');
    const keywords = ["動画編集 稼げない", "動画編集 副業 稼げない"];
    for (const k of keywords) {
      const terms = k.split(' ');
      const regex = new RegExp(terms.join('.{0,10}'), 'gi');
      const count = (j.article.match(regex) || []).length;
      console.log(`${k}: ${count}`);
    }
  }
}

main();
