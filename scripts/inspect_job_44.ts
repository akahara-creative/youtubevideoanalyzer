import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 44)).limit(1);
  
  if (job.length > 0) {
    const j = job[0];
    console.log(`Job ID: ${j.id}`);
    console.log(`Status: ${j.status}`);
    console.log(`Created At: ${j.createdAt}`);
    console.log(`Completed At: ${j.completedAt}`);
    console.log(`Theme: ${j.theme}`);
    
    // Check for clues in the article content
    if (j.article) {
      console.log(`Article Length: ${j.article.length}`);
      console.log(`Start of Article: ${j.article.substring(0, 200)}`);
      // Check for "desu/masu" vs "da/dearu"
      const desuCount = (j.article.match(/です/g) || []).length;
      const masuCount = (j.article.match(/ます/g) || []).length;
      const daCount = (j.article.match(/だ。/g) || []).length;
      const dearuCount = (j.article.match(/である。/g) || []).length;
      
      console.log(`Style Check:`);
      console.log(`- です: ${desuCount}`);
      console.log(`- ます: ${masuCount}`);
      console.log(`- だ。: ${daCount}`);
      console.log(`- である。: ${dearuCount}`);
    }
  } else {
    console.log('Job 44 not found');
  }
}

main();
