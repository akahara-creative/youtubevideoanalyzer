import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const doc = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 1916));
  
  if (doc.length > 0) {
    console.log(`\n--- Document ID 1916 (Job 80 Output) ---`);
    console.log(doc[0].content);
  } else {
    console.log('Document 1916 not found');
  }
}

main();
