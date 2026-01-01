import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const docs = await db
    .select()
    .from(ragDocuments)
    .where(inArray(ragDocuments.id, [1756, 1766]));

  for (const doc of docs) {
    console.log(`\n--- ID: ${doc.id} (Length: ${doc.content.length}) ---`);
    console.log(doc.content.substring(0, 300));
    console.log('...');
  }
}

main();
