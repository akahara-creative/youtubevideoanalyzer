#!/usr/bin/env node
/**
 * Check uploaded files in the database
 */
import { getDb } from './server/db.ts';
import { contentImports } from './drizzle/schema.ts';
import { desc } from 'drizzle-orm';

async function checkUploadedFiles() {
  try {
    const db = await getDb();
    if (!db) {
      console.error('Database not available');
      process.exit(1);
    }

    // Get all content imports, ordered by creation date (newest first)
    const imports = await db
      .select()
      .from(contentImports)
      .orderBy(desc(contentImports.createdAt))
      .limit(20);

    console.log(`\n📁 Found ${imports.length} uploaded files:\n`);

    if (imports.length === 0) {
      console.log('No files found in database.');
      return;
    }

    // Check for contest.m4a specifically
    const contestFiles = imports.filter(imp => 
      imp.fileName.toLowerCase().includes('contest') || 
      imp.fileType === 'm4a'
    );

    if (contestFiles.length > 0) {
      console.log('🎵 Files matching "contest" or m4a files:\n');
      contestFiles.forEach(imp => {
        console.log(`  ✅ ID: ${imp.id}`);
        console.log(`     File: ${imp.fileName}`);
        console.log(`     Type: ${imp.fileType}`);
        console.log(`     Size: ${imp.fileSize ? (imp.fileSize / 1024).toFixed(2) + ' KB' : 'N/A'}`);
        console.log(`     URL: ${imp.fileUrl}`);
        console.log(`     Key: ${imp.fileKey}`);
        console.log(`     Text length: ${imp.extractedText ? imp.extractedText.length : 0} chars`);
        console.log(`     Created: ${imp.createdAt}`);
        console.log('');
      });
    }

    // Show all recent files
    console.log('\n📋 All recent uploads:\n');
    imports.forEach(imp => {
      console.log(`  ${imp.id}. ${imp.fileName} (${imp.fileType}) - ${imp.createdAt}`);
    });

  } catch (error) {
    console.error('Error checking uploaded files:', error);
    process.exit(1);
  }
}

checkUploadedFiles();

