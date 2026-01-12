
import 'dotenv/config';
import { getDb } from "../server/db";
import { ragDocuments } from "../drizzle/schema";
import { inArray } from "drizzle-orm";

async function checkRagDates() {
  console.log("Checking RAG Creation Dates...");
  const db = await getDb();
  if (!db) return;

  const ids = [4, 7, 8, 1856, 1896, 1841];
  const docs = await db.select().from(ragDocuments).where(inArray(ragDocuments.id, ids));

  console.log("Job 92 Date: Sun Jan 04 2026");
  console.log("--------------------------------");
  
  for (const doc of docs) {
    console.log(`ID ${doc.id}: Created At ${doc.createdAt}`);
  }
  process.exit(0);
}

checkRagDates();
