import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const doc = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 1855));
  
  if (doc.length > 0) {
    console.log('\n--- Generated Content (ID 1855) Preview ---');
    console.log(doc[0].content.substring(0, 2000));
    console.log('\n--- End Preview ---');
  } else {
    console.log('Document 1855 not found');
  }
}

main();
