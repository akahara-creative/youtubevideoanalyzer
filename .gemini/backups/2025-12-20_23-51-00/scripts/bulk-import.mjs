import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import server functions
const projectRoot = path.join(__dirname, '..');
process.chdir(projectRoot);

// Dynamically import server modules
const { extractTextFromFile } = await import('../server/textExtractor.js');
const { createContentImport } = await import('../server/db.js');
const { storagePut } = await import('../server/storage.js');
const { addToRAG } = await import('../server/rag.js');

const IMPORT_DIR = path.join(projectRoot, 'test-imports');
const USER_ID = 1; // Assuming owner user ID is 1

async function importFile(filePath) {
  try {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    console.log(`\n📄 Processing: ${fileName}`);
    
    // Read file
    const fileBuffer = await fs.readFile(filePath);
    const fileSize = fileBuffer.length;
    
    // Check file size (16MB limit)
    if (fileSize > 16 * 1024 * 1024) {
      console.log(`  ❌ File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB (max 16MB)`);
      return { success: false, fileName, error: 'File too large' };
    }
    
    // Extract text
    console.log(`  📝 Extracting text...`);
    const extractedText = await extractTextFromFile(fileBuffer, fileName);
    
    if (!extractedText || extractedText.trim().length === 0) {
      console.log(`  ❌ No text extracted`);
      return { success: false, fileName, error: 'No text extracted' };
    }
    
    const wordCount = extractedText.split(/\s+/).length;
    console.log(`  ✅ Extracted ${wordCount} words`);
    
    // Upload to S3
    console.log(`  ☁️  Uploading to S3...`);
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    const fileKey = `user-${USER_ID}/imports/${fileName}-${randomSuffix}${ext}`;
    const { url: fileUrl } = await storagePut(fileKey, fileBuffer, getMimeType(ext));
    console.log(`  ✅ Uploaded to S3`);
    
    // Save to database
    console.log(`  💾 Saving to database...`);
    const importId = await createContentImport({
      userId: USER_ID,
      fileName,
      fileUrl,
      fileKey,
      fileSize,
      mimeType: getMimeType(ext),
      extractedText,
      wordCount,
      status: 'completed',
    });
    console.log(`  ✅ Saved to database (ID: ${importId})`);
    
    // Add to RAG
    console.log(`  🔍 Adding to RAG...`);
    const ragId = `import_${importId}`;
    await addToRAG({
      id: ragId,
      text: extractedText,
      metadata: {
        type: 'mailmag',
        title: fileName,
        createdAt: new Date().toISOString(),
        importId,
      },
    });
    console.log(`  ✅ Added to RAG (ID: ${ragId})`);
    
    return { success: true, fileName, importId, ragId, wordCount };
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { success: false, fileName: path.basename(filePath), error: error.message };
  }
}

function getMimeType(ext) {
  const mimeTypes = {
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

async function main() {
  console.log('🚀 Starting bulk import...\n');
  
  // Get all files
  const files = await fs.readdir(IMPORT_DIR);
  const supportedExts = ['.txt', '.pdf', '.docx'];
  const filesToImport = files.filter(f => 
    supportedExts.includes(path.extname(f).toLowerCase())
  );
  
  console.log(`Found ${filesToImport.length} files to import:\n`);
  filesToImport.forEach(f => console.log(`  - ${f}`));
  
  // Import each file
  const results = [];
  for (const file of filesToImport) {
    const filePath = path.join(IMPORT_DIR, file);
    const result = await importFile(filePath);
    results.push(result);
  }
  
  // Summary
  console.log('\n\n📊 Import Summary:');
  console.log('='.repeat(50));
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ Successful: ${successful.length}`);
  successful.forEach(r => {
    console.log(`  - ${r.fileName} (${r.wordCount} words, RAG ID: ${r.ragId})`);
  });
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`);
    failed.forEach(r => {
      console.log(`  - ${r.fileName}: ${r.error}`);
    });
  }
  
  console.log('\n✨ Import complete!');
}

main().catch(console.error);
