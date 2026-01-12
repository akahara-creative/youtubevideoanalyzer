import 'dotenv/config';
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";
import { desc } from "drizzle-orm";

async function inspectLatestJob() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to DB");
    return;
  }

  const jobs = await db.select().from(seoArticleJobs).orderBy(desc(seoArticleJobs.createdAt)).limit(1);
  
  if (jobs.length === 0) {
    console.log("No jobs found.");
    return;
  }

  const job = jobs[0];
  console.log(`Job ID: ${job.id}`);
  console.log(`Theme: ${job.theme}`);
  console.log(`Status: ${job.status}`);
  console.log(`Created At: ${job.createdAt}`);
  
  if (job.structure) {
    console.log("\n--- Structure (First 500 chars) ---");
    console.log(job.structure.substring(0, 500));
    
    try {
      const parsed = JSON.parse(job.structure);
      console.log("\n--- Structure JSON Analysis ---");
      if (parsed.structure) {
        console.log("Found 'structure' property in JSON.");
        // Check for A-H logic in structure content?
        // Usually structure is Markdown.
        // Let's print the first few lines of the markdown structure
        console.log("Markdown Structure Preview:");
        console.log(parsed.structure.substring(0, 500));
      } else {
        console.log("No 'structure' property found in JSON.");
      }
    } catch (e) {
      console.log("Structure is not valid JSON.");
    }
  }

  if (job.generatedPersonas) {
    console.log("\n--- Generated Personas ---");
    const personas = JSON.parse(job.generatedPersonas);
    console.log("Target Persona Name:", personas.target?.name);
    console.log("Target Persona Description:", personas.target?.description?.substring(0, 200));
    console.log("Writer Persona Name:", personas.writer?.name);
  }

  if (job.article) {
    console.log("\n--- Article End (Last 1000 chars) ---");
    console.log(job.article.slice(-1000));
  }
}

inspectLatestJob();
