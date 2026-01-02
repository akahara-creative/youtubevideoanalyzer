import 'dotenv/config';
import { getDb } from '../server/db';
import { seoArticleJobs } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) {
    console.error('DB connection failed');
    return;
  }

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 83)).limit(1);
  if (job.length === 0) {
    console.log('Job 83 not found');
    return;
  }

  const analysis = job[0].analyses;
  console.log('Competitor Analysis Length:', analysis ? analysis.length : 0);
  
  if (analysis) {
    try {
      const parsed = JSON.parse(analysis);
      console.log('Parsed Analysis Count:', parsed.length);
      if (parsed.length > 0) {
        console.log('First Article Title:', parsed[0].title);
        console.log('First Article URL:', parsed[0].url);
        console.log('First Article Content Preview:', parsed[0].content ? parsed[0].content.substring(0, 100) : 'NO CONTENT');
        console.log('First Article IsSimulated:', parsed[0].isSimulated);
      }
      
      // Check how many are simulated
      const simulatedCount = parsed.filter((a: any) => a.isSimulated).length;
      console.log(`Simulated Articles: ${simulatedCount} / ${parsed.length}`);
      
    } catch (e) {
      console.error('Failed to parse analysis JSON', e);
      console.log('Raw Analysis:', analysis.substring(0, 200));
    }
  }
}

main().catch(console.error).finally(() => process.exit());
