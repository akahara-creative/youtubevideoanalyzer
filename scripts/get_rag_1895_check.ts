import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const doc = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 1895));
  
  if (doc.length > 0) {
    console.log(`\n--- Document ID 1895 (Length: ${doc[0].content.length}) ---`);
    console.log(doc[0].content);
  } else {
    console.log('Document 1895 not found');
  }
}

main();
