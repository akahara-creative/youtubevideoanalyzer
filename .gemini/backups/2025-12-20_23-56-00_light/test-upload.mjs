import fs from 'fs';
import { createContentImport } from './server/db';

async function testUpload() {
  try {
    console.log('Testing content import...');
    
    // Read test file
    const fileContent = fs.readFileSync('/home/ubuntu/youtube-video-analyzer/test-imports/test_newsletter.txt', 'utf-8');
    
    // Create import record
    const importId = await createContentImport({
      userId: 1, // Test user ID
      fileName: 'test_newsletter.txt',
      fileType: 'txt',
      fileUrl: 'https://test.example.com/test_newsletter.txt',
      fileKey: 'test-imports/test_newsletter.txt',
      fileSize: fileContent.length,
      extractedText: fileContent,
      category: 'テスト',
      tags: 'SEO,テスト',
      notes: 'これはテスト用のインポートです',
      ragId: 'test-rag-id-123'
    });
    
    console.log('✅ Import successful! ID:', importId);
    console.log('File size:', fileContent.length, 'bytes');
    console.log('Extracted text length:', fileContent.length, 'characters');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
  
  process.exit(0);
}

testUpload();
