import { getDb } from "../server/db";
import { ragDocuments } from "../server/db/schema";
import { eq, inArray } from "drizzle-orm";

async function checkRagTone() {
  const db = await getDb();
  if (!db) return;

  const ids = [4, 7, 8];
  const docs = await db.select().from(ragDocuments).where(inArray(ragDocuments.id, ids));

  for (const doc of docs) {
    console.log(`\n--- RAG #${doc.id} (${doc.title}) ---`);
    console.log(doc.content.substring(0, 500));
  }
}

checkRagTone();
