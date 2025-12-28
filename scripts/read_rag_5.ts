import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { ragDocuments } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  // Assuming ID 5 is RAG Doc 5? Or filename contains "5"?
  // The user said "Document 5".
  // I'll search for filename containing "5" or just ID 5.
  // Let's check ID 5 first.
  const doc = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 5)).limit(1);
  
  if (doc.length > 0) {
    console.log('--- Content of ID 5 ---');
    console.log(doc[0].content);
  } else {
    console.log('Document ID 5 not found. Searching by filename...');
    // Search logic if needed
  }
}

main();
