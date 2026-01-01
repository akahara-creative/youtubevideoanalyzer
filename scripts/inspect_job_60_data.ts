import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 60)).limit(1);
  
  if (job.length > 0) {
    const j = job[0];
    console.log(`Job ID: ${j.id}`);
    console.log(`Competitor URLs: ${j.competitorUrls}`);
    // console.log(`Pain Points: ${j.painPoints}`); // Might be long
    // console.log(`Story Keywords: ${j.storyKeywords}`);
    // console.log(`Offer Bridge: ${j.offerBridge}`);
    
    const pp = JSON.parse(j.painPoints || '[]');
    const sk = JSON.parse(j.storyKeywords || '[]');
    const ob = JSON.parse(j.offerBridge || '[]');
    
    console.log(`Pain Points Count: ${pp.length}`);
    console.log(`Story Keywords Count: ${sk.length}`);
    console.log(`Offer Bridge Count: ${ob.length}`);
    
    console.log(`Pain Points Length: ${JSON.stringify(pp).length}`);
    console.log(`Story Keywords Length: ${JSON.stringify(sk).length}`);
    console.log(`Offer Bridge Length: ${JSON.stringify(ob).length}`);
  }
}

main();
