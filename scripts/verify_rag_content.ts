import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { inArray } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const targetIds = [1856, 4, 1845, 1841];
  const docs = await db.select().from(ragDocuments).where(inArray(ragDocuments.id, targetIds));

  console.log('--- RAG Document Verification ---');
  for (const doc of docs) {
    console.log(`\n[ID: ${doc.id}] Length: ${doc.content.length}`);
    console.log('Preview (First 300 chars):');
    console.log(doc.content.substring(0, 300));
    console.log('---');
  }
  
  const foundIds = docs.map(d => d.id);
  const missingIds = targetIds.filter(id => !foundIds.includes(id));
  if (missingIds.length > 0) {
    console.log(`\nWARNING: Missing IDs: ${missingIds.join(', ')}`);
  }
}

main();
