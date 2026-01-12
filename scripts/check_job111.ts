
import 'dotenv/config';
import { getSeoArticleJobById } from "../server/db";

async function checkJob111() {
  console.log("Checking Job 111...");
  const job = await getSeoArticleJobById(111);
  if (!job) {
    console.log("Job 111 NOT FOUND in DB.");
  } else {
    console.log("Job 111 Found:");
    console.log(`- Theme: ${job.theme}`);
    console.log(`- Status: ${job.status}`);
    
    if (job.structure) {
      console.log(`- Structure Length: ${job.structure.length} chars`);
      try {
        const parsed = JSON.parse(job.structure);
        console.log("- Structure JSON: Valid");
        if (parsed.structure) {
           console.log(`- Inner Structure Length: ${parsed.structure.length} chars`);
           console.log(`- Inner Structure Preview: ${parsed.structure.substring(0, 100)}...`);
        }
      } catch (e) {
        console.log("- Structure JSON: INVALID");
      }
    }
    
    if (job.generatedPersonas) {
      try {
        const personas = JSON.parse(job.generatedPersonas);
        
        const targetSize = JSON.stringify(personas.target || {}).length;
        const writerSize = JSON.stringify(personas.writer || {}).length;
        const editorSize = JSON.stringify(personas.editor || {}).length;
        
        console.log(`- Target Persona Size: ${targetSize} chars`);
        console.log(`- Writer Persona Size: ${writerSize} chars`);
        console.log(`- Editor Persona Size: ${editorSize} chars`);
        
        if (personas.writer?.description) {
             console.log(`  > Writer Description: ${personas.writer.description.length} chars`);
        }
      } catch (e) {
        console.log("- Failed to parse generatedPersonas");
      }
    } else {
      console.log("- No generatedPersonas found");
    }
  }
  process.exit(0);
}

checkJob111();
