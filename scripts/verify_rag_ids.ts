import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { inArray, desc } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  // 1. Check Target IDs
  const targetIds = [1856, 4, 1845, 1841];
  const docs = await db.select().from(ragDocuments).where(inArray(ragDocuments.id, targetIds));
  
  console.log('\n--- Target RAG Documents ---');
  for (const doc of docs) {
    console.log(`ID: ${doc.id}`);
    console.log(`Tags: ${JSON.stringify(doc.tags)}`);
    console.log(`Content Preview (First 100 chars): ${doc.content.substring(0, 100).replace(/\n/g, ' ')}`);
    console.log('---');
  }

  // 2. Check Recent RAG Documents
  const recentDocs = await db.select().from(ragDocuments).orderBy(desc(ragDocuments.createdAt)).limit(5);
  console.log('\n--- Most Recent RAG Documents ---');
  for (const doc of recentDocs) {
    console.log(`ID: ${doc.id} (Created: ${doc.createdAt})`);
    console.log(`Tags: ${JSON.stringify(doc.tags)}`);
    console.log(`Content Preview (First 100 chars): ${doc.content.substring(0, 100).replace(/\n/g, ' ')}`);
    console.log('---');
  }
}

main();
