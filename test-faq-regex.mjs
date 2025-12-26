import fs from 'fs';

// 実際のFAQデータを読み込む
const faqText = fs.readFileSync('/tmp/faq-data.txt', 'utf-8');

console.log('=== Testing FAQ Regex ===\n');
console.log('FAQ Text length:', faqText.length);
console.log('First 300 chars:');
console.log(faqText.substring(0, 300));
console.log('\n');

// 新しい正規表現でテスト
const qaRegex = /###\s*Q\d+:\s*(.+?)\n+A:\s*(.+?)(?=\n###|$)/gs;
const matches = [...faqText.matchAll(qaRegex)];

console.log('✅ Found QA matches:', matches.length);
console.log('\n');

// 各マッチを表示
matches.forEach((match, index) => {
  console.log(`--- Match ${index + 1} ---`);
  console.log('Question:', match[1].trim().substring(0, 100));
  console.log('Answer:', match[2].trim().substring(0, 100));
  console.log('');
});

// 結果を確認
if (matches.length > 0) {
  console.log('✅ SUCCESS: FAQ parsing works!');
} else {
  console.log('❌ FAILED: No matches found');
}
