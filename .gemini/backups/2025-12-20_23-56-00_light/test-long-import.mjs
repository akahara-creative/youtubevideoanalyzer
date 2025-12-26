import fs from 'fs';
import { createContentImport } from './server/db';
import { extractTextFromFile } from './server/textExtractor';
import { storagePut } from './server/storage';

async function testLongImport() {
  try {
    const filePath = '/home/ubuntu/youtube-video-analyzer/test-imports/long_sales_letter_test.txt';
    const fileName = 'long_sales_letter_test.txt';
    
    console.log('Testing long file import (85,000 characters)...');
    
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);
    
    // Extract text
    console.log('Extracting text...');
    const extractedText = await extractTextFromFile(fileBuffer, 'txt');
    console.log(`Extracted ${extractedText.length} characters`);
    
    // Upload to S3
    console.log('Uploading to S3...');
    const fileKey = `content-imports/1/${Date.now()}-${fileName}`;
    const { url: fileUrl } = await storagePut(fileKey, fileBuffer, 'text/plain');
    console.log('Uploaded to S3');
    
    // Save to database
    console.log('Saving to database...');
    const importId = await createContentImport({
      userId: 1,
      fileName,
      fileType: 'txt',
      fileUrl,
      fileKey,
      fileSize: stats.size,
      extractedText,
      category: 'テスト',
      tags: '長文,テスト',
      notes: '85,000文字の長文テストファイル',
    });
    
    console.log(`✅ Successfully imported long file! ID: ${importId}`);
    console.log(`File size: ${stats.size} bytes`);
    console.log(`Text length: ${extractedText.length} characters`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    console.error('Error message:', error.message);
  }
  
  process.exit(0);
}

testLongImport();
