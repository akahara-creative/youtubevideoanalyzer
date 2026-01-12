
import 'dotenv/config';
import { getDb } from "../server/db";
import { ragDocuments } from "../drizzle/schema";
import { inArray } from "drizzle-orm";

async function simulateContext() {
  console.log("Simulating Context Size...");
  const db = await getDb();
  if (!db) return;

  // New Priority IDs (assuming #2622 is pickedUp=1 and #1896 is pickedUp=0)
  // I need to fetch ALL pickedUp=1 docs to be sure.
  const priorityDocs = await db.select().from(ragDocuments).where(eq(ragDocuments.pickedUp, 1));
  
  let totalRagLength = 0;
  console.log("--- Priority Docs ---");
  for (const doc of priorityDocs) {
    console.log(`ID ${doc.id}: ${doc.content.length} chars`);
    totalRagLength += doc.content.length;
  }
  
  console.log("---------------------");
  console.log(`Total RAG Content Length: ${totalRagLength} chars`);
  
  // Persona Generation Logic (approximate)
  // It takes the first 12000 chars of the concatenated content.
  const estimatedPersonaSize = Math.min(totalRagLength, 12000);
  console.log(`Estimated Writer Persona Size: ${estimatedPersonaSize} chars (Capped at 12000)`);
  
  // Step 6 Input Simulation
  const structureSize = 3500; // Approx
  const promptSize = 2000; // Approx
  const historySize = 3000; // Max
  
  const totalInput = estimatedPersonaSize + structureSize + promptSize + historySize;
  console.log(`Estimated Step 6 Input: ~${totalInput} chars`);
  
  process.exit(0);
}

// Helper for eq import
import { eq } from "drizzle-orm";

simulateContext();
