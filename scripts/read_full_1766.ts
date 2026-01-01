import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const doc = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 1766));
  
  if (doc.length > 0) {
    console.log(doc[0].content);
  } else {
    console.log('Document not found');
  }
}

main();
