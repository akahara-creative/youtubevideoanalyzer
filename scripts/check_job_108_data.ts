import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkJob108Data() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'youtube_analyzer',
  });

  try {
    const [rows] = await connection.execute(
      'SELECT analyses, generatedPersonas, errorMessage FROM seoArticleJobs WHERE id = 108'
    );

    const jobs = rows as any[];
    if (jobs.length > 0) {
      const job = jobs[0];
      
      // Check Analyses
      if (job.analyses) {
        const analyses = JSON.parse(job.analyses);
        console.log(`Analyses count: ${analyses.length}`);
        if (analyses.length > 0) {
          console.log('First Analysis Keys:', Object.keys(analyses[0]));
          console.log('Has Summary:', !!analyses[0].summary);
          console.log('Has Content:', !!analyses[0].content);
          console.log('Summary Length:', analyses[0].summary ? analyses[0].summary.length : 0);
        }
      } else {
        console.log('Analyses: NULL');
      }

      // Check Personas (Akahara Logic might be here or in a separate column? No, usually in structure or separate)
      // Wait, where is akaharaLogic stored? 
      // In `seoArticleJobProcessor.ts`, it says:
      // const akaharaLogic = await generateAkaharaLogic(...)
      // But is it saved to DB?
      // Let's check the updateSeoArticleJob call in the processor.
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkJob108Data();
