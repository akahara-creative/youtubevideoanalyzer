
import 'dotenv/config';
import { getDb } from "../server/db";
import { ragDocuments } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function updateRagPriority() {
  console.log("Updating RAG Priority...");
  const db = await getDb();
  if (!db) return;

  // Disable #1896
  await db.update(ragDocuments)
    .set({ pickedUp: 0 })
    .where(eq(ragDocuments.id, 1896));
  console.log("Disabled #1896");

  // Enable #2622
  await db.update(ragDocuments)
    .set({ pickedUp: 1 })
    .where(eq(ragDocuments.id, 2622));
  console.log("Enabled #2622");

  process.exit(0);
}

updateRagPriority();
