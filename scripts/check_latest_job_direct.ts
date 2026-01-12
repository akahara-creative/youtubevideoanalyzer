import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkLatestJob() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'youtube_analyzer',
  });

  try {
    const [rows] = await connection.execute(
      'SELECT id, theme, status, progress, currentStep, errorMessage, createdAt, updatedAt FROM seoArticleJobs ORDER BY id DESC LIMIT 1'
    );

    const jobs = rows as any[];
    if (jobs.length === 0) {
      console.log('No jobs found.');
    } else {
      const job = jobs[0];
      console.log('Latest Job Details:');
      console.log('ID:', job.id);
      console.log('Theme:', job.theme);
      console.log('Status:', job.status);
      console.log('Progress:', job.progress + '%');
      console.log('Current Step:', job.currentStep);
      console.log('Error Message:', job.errorMessage);
      console.log('Created At:', job.createdAt);
      console.log('Updated At:', job.updatedAt);
    }
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await connection.end();
  }
}

checkLatestJob();
