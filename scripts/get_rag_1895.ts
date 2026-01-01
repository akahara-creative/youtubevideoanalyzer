import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const doc = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 1895));
  
  if (doc.length > 0) {
    console.log('\n--- Generated Content (ID 1895) ---');
    // Print the whole content to see the "Double Article" structure
    console.log(doc[0].content);
    console.log('\n--- End Content ---');
  } else {
    console.log('Document 1895 not found');
  }
}

main();
