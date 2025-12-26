import { ChromaClient } from 'chromadb';

const client = new ChromaClient({ path: 'http://localhost:8000' });

try {
  console.log('Connecting to ChromaDB...');
  
  // Get collection
  const collection = await client.getCollection({ name: 'youtube_analysis_rag' });
  console.log('✅ Collection found:', collection.name);
  
  // Count documents
  const count = await collection.count();
  console.log(`📊 Total documents in collection: ${count}`);
  
  if (count > 0) {
    // Get all documents
    const results = await collection.get({
      limit: 10,
    });
    
    console.log('\n📄 Sample documents:');
    results.ids.forEach((id, index) => {
      console.log(`\n--- Document ${index + 1} ---`);
      console.log(`ID: ${id}`);
      console.log(`Metadata:`, results.metadatas[index]);
      console.log(`Text preview: ${results.documents[index]?.substring(0, 200)}...`);
    });
  } else {
    console.log('⚠️  No documents found in collection');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
