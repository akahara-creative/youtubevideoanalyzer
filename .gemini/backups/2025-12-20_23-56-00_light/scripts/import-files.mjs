import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { storagePut } from '../server/storage.js';
import { extractText } from '../server/textExtractor.js';
import { getDb } from '../server/db.js';
import { contentImports } from '../drizzle/schema.js';
import { addToRAG } from '../server/rag.js';

const FILES_DIR = '/home/ubuntu/youtube-video-analyzer/test-imports';
const USER_ID = 1; // Owner user ID

async function importFile(filePath, fileName) {
  try {
    console.log(`\n📄 Processing: ${fileName}`);
    
    // Read file
    const fileBuffer = readFileSync(filePath);
    const fileSize = statSync(filePath).size;
    const fileType = fileName.endsWith('.pdf') ? 'pdf' : fileName.endsWith('.docx') ? 'docx' : 'txt';
    
    // Extract text
    console.log('  ⏳ Extracting text...');
    const extractedText = await extractText(fileBuffer, fileType);
    console.log(`  ✅ Extracted ${extractedText.length} characters`);
    
    // Upload to S3
    console.log('  ⏳ Uploading to S3...');
    const fileKey = `content-imports/${USER_ID}/${Date.now()}-${fileName}`;
    const { url: fileUrl } = await storagePut(fileKey, fileBuffer, 
      fileType === 'pdf' ? 'application/pdf' : fileType === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain'
    );
    console.log(`  ✅ Uploaded to S3`);
    
    // Save to database
    console.log('  ⏳ Saving to database...');
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const insertData = {
      userId: USER_ID,
      fileName,
      fileType,
      fileUrl,
      fileKey,
      fileSize,
      extractedText,
    };
    
    const result = await db.insert(contentImports).values(insertData);
    const importId = Number(result[0].insertId);
    console.log(`  ✅ Saved to database (ID: ${importId})`);
    
    // Add to RAG
    console.log('  ⏳ Adding to RAG...');
    const ragId = `import_${Date.now()}_${importId}`;
    await addToRAG(
      ragId,
      extractedText,
      {
        type: 'content_import',
        fileName,
        fileType,
        importId,
        userId: USER_ID,
      }
    );
    
    // Update ragId in database
    await db.update(contentImports)
      .set({ ragId })
      .where(eq(contentImports.id, importId));
    
    console.log(`  ✅ Added to RAG (ID: ${ragId})`);
    console.log(`✅ Successfully imported: ${fileName}`);
    
    return { success: true, fileName, importId, ragId };
  } catch (error) {
    console.error(`❌ Failed to import ${fileName}:`, error.message);
    return { success: false, fileName, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting bulk import...\n');
  
  const files = readdirSync(FILES_DIR);
  console.log(`Found ${files.length} files to import\n`);
  
  const results = [];
  
  for (const fileName of files) {
    const filePath = join(FILES_DIR, fileName);
    const result = await importFile(filePath, fileName);
    results.push(result);
  }
  
  console.log('\n\n📊 Import Summary:');
  console.log(`Total files: ${results.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  
  if (results.some(r => !r.success)) {
    console.log('\n❌ Failed files:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.fileName}: ${r.error}`);
    });
  }
  
  console.log('\n✅ Bulk import completed!');
}

main().catch(console.error);
