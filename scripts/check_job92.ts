
import 'dotenv/config';
import { getSeoArticleJobById } from "../server/db";

async function checkJob92() {
  console.log("Checking Job 92...");
  const job = await getSeoArticleJobById(92);
  if (!job) {
    console.log("Job 92 NOT FOUND in DB.");
  } else {
    console.log("Job 92 Found:");
    console.log(`- Theme: ${job.theme}`);
    console.log(`- Status: ${job.status}`);
    console.log(`- Created At: ${job.createdAt}`);
    console.log(`- Article Length: ${job.article?.length || 0} chars`);
    
    if (job.generatedPersonas) {
      try {
        const personas = JSON.parse(job.generatedPersonas);
        const writerDesc = personas.writer?.description || "";
        console.log(`- Writer Persona Description Length: ${writerDesc.length} chars`);
        console.log(`- Writer Persona Preview: ${writerDesc.substring(0, 100)}...`);
      } catch (e) {
        console.log("- Failed to parse generatedPersonas");
      }
    } else {
      console.log("- No generatedPersonas found");
    }
  }
  process.exit(0);
}

checkJob92();
