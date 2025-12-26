import { addToRAG, searchRAG, getRAGContext } from './server/rag.ts';

console.log('=== RAG Direct Test ===\n');

// Test 1: Add document to RAG
console.log('Test 1: Adding test document to RAG...');
try {
  await addToRAG({
    id: 'test_video_1',
    text: `
タイトル: テスト動画
URL: https://www.youtube.com/watch?v=test123

要約:
これはテスト用の動画です。プログラミングの基礎について説明しています。

学習ポイント:
- 変数の使い方
- 関数の定義方法
- ループ処理の基本

文字起こし:
こんにちは。今日はプログラミングの基礎について学びます。まず変数について説明します。
    `.trim(),
    metadata: {
      type: 'video_analysis',
      title: 'テスト動画',
      url: 'https://www.youtube.com/watch?v=test123',
      createdAt: new Date().toISOString(),
      analysisId: 999,
    },
  });
  console.log('✅ Document added successfully\n');
} catch (error) {
  console.error('❌ Error adding document:', error.message);
}

// Test 2: Search RAG
console.log('Test 2: Searching for "プログラミング"...');
try {
  const results = await searchRAG({
    query: 'プログラミングの基礎を学びたい',
    limit: 3,
  });
  console.log(`✅ Found ${results.length} results:`);
  results.forEach((result, i) => {
    console.log(`\nResult ${i + 1}:`);
    console.log(`  Score: ${result.score.toFixed(4)}`);
    console.log(`  Title: ${result.metadata.title}`);
    console.log(`  Text preview: ${result.document.substring(0, 100)}...`);
  });
  console.log();
} catch (error) {
  console.error('❌ Error searching:', error.message);
}

// Test 3: Get RAG context
console.log('Test 3: Getting RAG context...');
try {
  const context = await getRAGContext('変数の使い方', 2);
  console.log('✅ Context generated:');
  console.log(context.substring(0, 300) + '...\n');
} catch (error) {
  console.error('❌ Error getting context:', error.message);
}

console.log('=== Test Complete ===');
