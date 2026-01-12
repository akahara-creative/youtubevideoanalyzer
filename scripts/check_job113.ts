
import 'dotenv/config';
import { getSeoArticleJobById } from "../server/db";

async function checkJob113() {
  const job = await getSeoArticleJobById(126);
  if (!job) {
    console.log("Job 126 not found");
    return;
  }
  console.log(`Job 113 Status: ${job.status}`);
  console.log(`Error Message: ${job.errorMessage}`);
  console.log(`Article Length: ${job.article?.length || 0}`);
  
  if (job.generatedPersonas) {
    const personas = typeof job.generatedPersonas === 'string' 
      ? JSON.parse(job.generatedPersonas) 
      : job.generatedPersonas;
      
    console.log("\n--- Writer Persona (Compressed?) ---");
    console.log(`Length: ${personas.writer?.description?.length || 0}`);
    console.log("Preview:");
    console.log(personas.writer?.description?.substring(0, 500) + "...");
  }
}

checkJob113();
