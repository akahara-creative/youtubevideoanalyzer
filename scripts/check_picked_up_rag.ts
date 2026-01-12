import 'dotenv/config';
import { getDb } from "../server/db";
import { ragDocuments } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function checkPickedUpDocs() {
  const db = await getDb();
  if (!db) return;

  const docs = await db.select().from(ragDocuments).where(eq(ragDocuments.pickedUp, 1));
  
  console.log(`Found ${docs.length} picked up documents.`);
  let totalChars = 0;
  for (const doc of docs) {
    console.log(`- ID: ${doc.id}, Length: ${doc.content.length}`);
    totalChars += doc.content.length;
  }
  console.log(`Total RAG Content Length: ${totalChars} chars`);
}

checkPickedUpDocs();
