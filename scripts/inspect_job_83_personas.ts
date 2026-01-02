import 'dotenv/config';
import { getDb } from '../server/db';
import { seoArticleJobs } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 83)).limit(1);
  if (job.length === 0) {
    console.log('Job 83 not found');
    return;
  }

  const personas = job[0].generatedPersonas;
  if (personas) {
    const parsed = JSON.parse(personas);
    console.log('--- Writer Persona ---');
    console.log(`Length: ${parsed.writer.description.length} chars`);
    console.log('Snippet Start:', parsed.writer.description.substring(0, 200));
    console.log('Snippet End:', parsed.writer.description.substring(parsed.writer.description.length - 200));
    console.log('----------------------');
  } else {
    console.log('No generatedPersonas found');
  }
}

main().catch(console.error).finally(() => process.exit());
