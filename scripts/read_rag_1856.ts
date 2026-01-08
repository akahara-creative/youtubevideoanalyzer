
import * as dotenv from 'dotenv';
dotenv.config();
import { getDb } from "../server/db.ts";
import { ragDocuments } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to DB");
    return;
  }

  const result = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 1856));
  
  if (result.length > 0) {
    console.log("RAG #1856 Content:");
    console.log(result[0].content);
  } else {
    console.log("RAG #1856 not found");
  }
  process.exit(0);
}

main().catch(console.error);
