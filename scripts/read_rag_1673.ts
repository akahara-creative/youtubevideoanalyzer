import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { ragDocuments } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const doc = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 1673)).limit(1);
  
  if (doc.length > 0) {
    console.log('--- Content of ID 1673 ---');
    console.log(doc[0].content);
  } else {
    console.log('Document not found');
  }
}

main();
