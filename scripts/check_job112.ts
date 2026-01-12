
import 'dotenv/config';
import { getSeoArticleJobById } from "../server/db";

async function checkJob112() {
  console.log("Checking Job 112...");
  const job = await getSeoArticleJobById(112);
  if (!job) {
    console.log("Job 112 NOT FOUND.");
    return;
  }
  
  console.log(`Status: ${job.status}`);
  console.log(`Article Length: ${job.article?.length || 0} chars`);
  
  if (job.article) {
    console.log("--- Article Preview (Start) ---");
    console.log(job.article.substring(0, 500));
    console.log("--- Article Preview (End) ---");
    console.log(job.article.substring(job.article.length - 500));
    
    // Check for repetition
    const lines = job.article.split('\n');
    const uniqueLines = new Set(lines);
    console.log(`Unique Lines Ratio: ${uniqueLines.size / lines.length}`);
  }
  
  if (job.generatedPersonas) {
      const personas = JSON.parse(job.generatedPersonas);
      console.log(`Writer Persona Size: ${JSON.stringify(personas.writer).length}`);
  }
  
  if (job.structure) {
      console.log(`Structure Length: ${job.structure.length} chars`);
      try {
        const parsed = JSON.parse(job.structure);
        console.log("Structure JSON: Valid");
        if (parsed.structure) {
             console.log(`Inner Structure Length: ${parsed.structure.length} chars`);
             console.log(`Inner Structure Preview: ${parsed.structure.substring(0, 100)}...`);
        }
        
        if (parsed.akaharaLogic) {
             console.log(`Akahara Logic Size: ${JSON.stringify(parsed.akaharaLogic).length}`);
        } else {
             console.log("Akahara Logic: Not found in structure");
        }
      } catch (e) {
        console.log("Structure JSON: INVALID");
      }
  } else {
      console.log("Structure: NOT FOUND");
  }
  
  process.exit(0);
}

checkJob112();
