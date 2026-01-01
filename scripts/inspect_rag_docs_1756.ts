import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const docs = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 1756));
  const doc = docs[0];

  if (doc) {
    console.log(`\n--- ID: ${doc.id} (Length: ${doc.content.length}) ---`);
    console.log(doc.content.substring(0, 300));
  } else {
    console.log('ID 1756 not found');
  }
}

main();
