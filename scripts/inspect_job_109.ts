import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function inspectJob109() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'youtube_analyzer',
  });

  try {
    const [rows] = await connection.execute(
      'SELECT id, theme, status, progress, currentStep, errorMessage, article, structure, analyses FROM seoArticleJobs WHERE id = 109'
    );

    const jobs = rows as any[];
    if (jobs.length > 0) {
      const job = jobs[0];
      console.log('Job ID:', job.id);
      console.log('Status:', job.status);
      console.log('Progress:', job.progress);
      console.log('Current Step:', job.currentStep);
      console.log('Error Message:', job.errorMessage);
      
      console.log('--- Structure ---');
      console.log('Length:', job.structure ? job.structure.length : 0);
      if (job.structure) console.log(job.structure.substring(0, 500) + '...');

      console.log('--- Article ---');
      console.log('Length:', job.article ? job.article.length : 0);
      
      console.log('--- Analyses ---');
      if (job.analyses) {
        const analyses = JSON.parse(job.analyses);
        console.log('Count:', analyses.length);
        if (analyses.length > 0) {
             console.log('First Analysis Summary Length:', analyses[0].summary ? analyses[0].summary.length : 0);
        }
      }
    } else {
      console.log('Job 109 not found.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

inspectJob109();
