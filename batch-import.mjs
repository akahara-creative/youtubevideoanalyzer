import fs from 'fs';
import path from 'path';
import { createContentImport } from './server/db';
import { extractTextFromFile } from './server/textExtractor';
import { storagePut } from './server/storage';

async function batchImport() {
  const testDir = '/home/ubuntu/youtube-video-analyzer/test-imports';
  const files = fs.readdirSync(testDir);
  
  console.log(`Found ${files.length} files in test-imports directory`);
  console.log('Starting batch import...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const fileName of files) {
    const filePath = path.join(testDir, fileName);
    const stats = fs.statSync(filePath);
    
    if (!stats.isFile()) {
      console.log(`⏭️  Skipping ${fileName} (not a file)`);
      continue;
    }
    
    const ext = path.extname(fileName).toLowerCase().slice(1);
    if (!['txt', 'docx', 'pdf'].includes(ext)) {
      console.log(`⏭️  Skipping ${fileName} (unsupported format: ${ext})`);
      continue;
    }
    
    try {
      console.log(`📄 Processing: ${fileName}`);
      
      // Read file
      const fileBuffer = fs.readFileSync(filePath);
      
      // Extract text
      console.log(`   Extracting text...`);
      const extractedText = await extractTextFromFile(fileBuffer, ext);
      console.log(`   Extracted ${extractedText.length} characters`);
      
      // Upload to S3
      console.log(`   Uploading to S3...`);
      const fileKey = `content-imports/1/${Date.now()}-${fileName}`;
      const { url: fileUrl } = await storagePut(
        fileKey,
        fileBuffer,
        ext === 'pdf' ? 'application/pdf' : 
        ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
        'text/plain'
      );
      console.log(`   Uploaded to S3`);
      
      // Save to database
      console.log(`   Saving to database...`);
      const importId = await createContentImport({
        userId: 1,
        fileName,
        fileType: ext,
        fileUrl,
        fileKey,
        fileSize: stats.size,
        extractedText,
        category: 'メルマガ',
        tags: 'テスト,インポート',
        notes: `バッチインポートでアップロードされました`,
      });
      
      console.log(`✅ Successfully imported: ${fileName} (ID: ${importId})`);
      console.log(`   File size: ${stats.size} bytes`);
      console.log(`   Text length: ${extractedText.length} characters\n`);
      
      successCount++;
      
    } catch (error) {
      console.error(`❌ Failed to import ${fileName}:`, error.message);
      failCount++;
    }
  }
  
  console.log('\n=== Batch Import Summary ===');
  console.log(`Total files: ${files.length}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⏭️  Skipped: ${files.length - successCount - failCount}`);
  
  process.exit(0);
}

batchImport();
