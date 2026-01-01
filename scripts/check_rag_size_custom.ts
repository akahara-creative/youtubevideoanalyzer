import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { inArray } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const targetIds = [5, 1841, 1843, 1844];
  const docs = await db.select().from(ragDocuments).where(inArray(ragDocuments.id, targetIds));

  let totalLength = 0;
  console.log('--- Custom RAG Set Check ---');
  for (const doc of docs) {
    console.log(`ID: ${doc.id} | Length: ${doc.content.length}`);
    totalLength += doc.content.length;
  }
  
  console.log('----------------------------');
  console.log(`Total Documents: ${docs.length}`);
  console.log(`Total Length: ${totalLength}`);
  
  if (docs.length !== targetIds.length) {
    const foundIds = docs.map(d => d.id);
    const missingIds = targetIds.filter(id => !foundIds.includes(id));
    console.log(`WARNING: Missing IDs: ${missingIds.join(', ')}`);
  }
}

main();
