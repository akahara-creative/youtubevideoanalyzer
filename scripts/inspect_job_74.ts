import 'dotenv/config';
import { getDb } from '../server/db';
import { seoArticleJobs, ragDocuments } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 74));
  const job = jobs[0];

  if (!job) {
    console.log('Job 74 not found');
    return;
  }

  console.log(`Job 74 Status: ${job.status}`);
  console.log(`Job 74 Generated Content ID: ${job.generatedContentId}`);
  
  // Try to find the RAG document created (usually the last step saves it)
  // We can search ragDocuments by source_job_id if that column exists, or just look for recent ones.
  // Actually, the job log usually says "Saved to RAG with tags...".
  console.log(`Job 74 Log (Last 500 chars):`);
  console.log(job.log ? job.log.slice(-500) : 'No log');

  if (job.generatedContentId) {
    // If it's in longContents (not ragDocuments yet? or both?)
    // The schema might be different. Let's check ragDocuments for the content if we can find the ID from logs.
    // Or just fetch the latest RAG document.
    const latestRag = await db.select().from(ragDocuments).orderBy(ragDocuments.createdAt, 'desc' as any).limit(1); // Fix sort order syntax if needed
    if (latestRag.length > 0) {
        console.log(`\nLatest RAG Document ID: ${latestRag[0].id}`);
        console.log(`Content Preview (First 500 chars):`);
        console.log(latestRag[0].content.substring(0, 500));
        console.log(`\nContent Preview (Last 500 chars):`);
        console.log(latestRag[0].content.slice(-500));
        
        // Check for "Double Article" signs (e.g. multiple H1s or CTAs in middle)
        const h1Count = (latestRag[0].content.match(/^# /gm) || []).length;
        console.log(`\nH1 Count: ${h1Count}`);
        
        // Check for middle CTA
        const middleCTA = latestRag[0].content.indexOf('まとめ');
        if (middleCTA > 0 && middleCTA < latestRag[0].content.length - 2000) {
            console.log(`Potential Middle CTA found at index ${middleCTA}`);
        }
    }
  }
}

main();
