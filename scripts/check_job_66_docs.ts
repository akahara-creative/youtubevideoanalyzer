import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs, ragDocuments } from '../drizzle/schema.ts';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const docs = await db.select().from(ragDocuments).where(eq(ragDocuments.pickedUp, 1));
  console.log('--- Job 66 RAG Docs ---');
  let total = 0;
  docs.forEach(d => {
    console.log(`ID: ${d.id} | Length: ${d.content.length}`);
    total += d.content.length;
  });
  console.log(`Total Length: ${total}`);
}

main();
