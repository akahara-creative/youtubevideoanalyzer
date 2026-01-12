
import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function inspectJob110() {
  const connection = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'youtube_analyzer',
  });

  try {
    const [rows] = await connection.execute(
      'SELECT id, status, theme, structure, article, analyses FROM seoArticleJobs WHERE id = 110'
    );

    const job = (rows as any[])[0];

    if (!job) {
      console.log('Job 110 not found.');
      return;
    }

    console.log('Job ID:', job.id);
    console.log('Status:', job.status);
    console.log('Theme:', job.theme);
    
    console.log('--- Structure ---');
    if (job.structure) {
        const structureObj = JSON.parse(job.structure);
        console.log('Structure Object Keys:', Object.keys(structureObj));
        if (structureObj.structure) {
            console.log('Structure Length:', structureObj.structure.length);
            console.log('Structure Preview:\n', structureObj.structure.substring(0, 500));
        } else {
             console.log('Structure field missing in JSON');
        }
        if (structureObj.estimates) {
            console.log('Estimates:', structureObj.estimates);
        }
    } else {
        console.log('Structure is NULL');
    }

    console.log('--- Article ---');
    if (job.article) {
      console.log('Article Length:', job.article.length);
      console.log('Article Preview:\n', job.article.substring(0, 500));
    } else {
      console.log('Article is NULL');
    }

    console.log('--- Analyses ---');
    if (job.analyses) {
        const analyses = JSON.parse(job.analyses);
        console.log('Number of analyses:', analyses.length);
        if (analyses.length > 0) {
            console.log('First Analysis URL:', analyses[0].url);
            console.log('First Analysis Content Length:', analyses[0].content ? analyses[0].content.length : 'UNDEFINED');
            console.log('First Analysis Content Preview:', analyses[0].content ? analyses[0].content.substring(0, 100) : 'N/A');
        }
    } else {
        console.log('Analyses is NULL');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

inspectJob110();
