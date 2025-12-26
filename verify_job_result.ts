import 'dotenv/config';
import { getDb } from './server/db';
import { seoArticleJobs } from './drizzle/schema';
import { eq } from 'drizzle-orm';

async function verifyJobResult() {
  const db = await getDb();
  if (!db) {
    console.error('Database connection failed');
    process.exit(1);
  }

  const jobId = 31; // The job ID from the test script
  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, jobId)).limit(1);
  
  if (job.length === 0) {
    console.log(`Job ${jobId} not found`);
    process.exit(1);
  }

  const result = job[0];
  console.log('=== Job Verification ===');
  console.log(`Job ID: ${result.id}`);
  console.log(`Status: ${result.status}`);
  console.log(`Current Step: ${result.currentStep}`);
  console.log(`Progress: ${result.progress}%`);

  // 1. Verify Personas
  console.log('\n--- 1. Generated Personas ---');
  if (result.generatedPersonas) {
    const personas = JSON.parse(result.generatedPersonas);
    console.log('Target Persona:', personas.target ? 'Present' : 'Missing');
    if (personas.target) {
      console.log('  - Characteristics:', personas.target.characteristics.substring(0, 50) + '...');
      console.log('  - Episodes:', Object.keys(personas.target.episodes).join(', '));
      console.log('  - Latent Aptitude:', personas.target.latentAptitude ? 'Present' : 'Missing');
    }
    console.log('Writer Persona:', personas.writer ? 'Present' : 'Missing');
    if (personas.writer) {
      console.log('  - Name:', personas.writer.name);
      console.log('  - Style:', personas.writer.style);
    }
    console.log('Editor Persona:', personas.editor ? 'Present' : 'Missing');
    if (personas.editor) {
      console.log('  - Role:', personas.editor.role);
    }
  } else {
    console.log('Generated Personas: MISSING');
  }

  // 2. Verify Article
  console.log('\n--- 2. Article Content ---');
  if (result.article) {
    console.log(`Article Length: ${result.article.length} characters`);
    console.log('Sample (first 200 chars):');
    console.log(result.article.substring(0, 200));
    
    // Check for Akahara style indicators
    const hasBoku = result.article.includes('僕');
    const hasDesuMasu = result.article.includes('です') || result.article.includes('ます');
    console.log(`Contains "僕": ${hasBoku}`);
    console.log(`Contains "です/ます": ${hasDesuMasu}`);
  } else {
    console.log('Article: MISSING');
  }

  // 3. Verify Quality Check
  console.log('\n--- 3. Quality Check ---');
  if (result.qualityCheck) {
    const qc = JSON.parse(result.qualityCheck);
    console.log(`Passed: ${qc.passed}`);
    console.log(`Issues: ${qc.issues ? qc.issues.length : 0}`);
    if (qc.issues && qc.issues.length > 0) {
      console.log('Issues List:', qc.issues);
    }
  } else {
    console.log('Quality Check: MISSING (or not reached yet)');
  }

  process.exit(0);
}

verifyJobResult();
