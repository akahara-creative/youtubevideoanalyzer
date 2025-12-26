
import { getDb } from './server/db';
import { ragDocuments } from './drizzle/schema';
import { desc } from 'drizzle-orm';
import 'dotenv/config';

async function checkRagDocs() {
  const db = await getDb();
  const docs = await db.select().from(ragDocuments).orderBy(desc(ragDocuments.createdAt)).limit(5);
  
  console.log("Latest RAG Documents:");
  docs.forEach(doc => {
    console.log(`ID: ${doc.id}, Type: ${doc.type}, Content Length: ${doc.content.length}`);
    console.log(`Content Preview: ${doc.content.substring(0, 100)}...`);
    console.log("---------------------------------------------------");
  });
  process.exit(0);
}

checkRagDocs();
