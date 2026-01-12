import 'dotenv/config';
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function fetchArticles() {
  const db = await getDb();
  if (!db) return;

  // Fetch Job 92
  const job92 = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 92)).limit(1);
  if (job92.length > 0) {
    console.log("\n=== JOB 92 (Takashi) ===");
    
    if (job92[0].generatedPersonas) {
      console.log("Generated Personas JSON:", job92[0].generatedPersonas);
    } else {
      console.log("Generated Personas: NULL/UNDEFINED");
    }

    if (job92[0].structure) {
      const s = JSON.parse(job92[0].structure);
      console.log("\n--- Structure Preview ---");
      console.log(s.structure?.substring(0, 500));
    }
  } else {
    console.log("Job 92 not found.");
  }

  // Fetch Job 1114
  const job1114 = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 1114)).limit(1);
  if (job1114.length > 0) {
    console.log("\n=== JOB 1114 (Ichiro) ===");

    if (job1114[0].generatedPersonas) {
      console.log("Generated Personas JSON:", job1114[0].generatedPersonas);
    } else {
      console.log("Generated Personas: NULL/UNDEFINED");
    }

    if (job1114[0].structure) {
      const s = JSON.parse(job1114[0].structure);
      console.log("\n--- Structure Preview ---");
      console.log(s.structure?.substring(0, 500));
    }
  } else {
    console.log("Job 1114 not found.");
  }
}

fetchArticles();
