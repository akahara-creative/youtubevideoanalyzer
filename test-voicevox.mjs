import { testConnection } from './server/voicevoxClient.ts';

console.log('[Test] VoiceVox API接続テストを開始...');

try {
  const result = await testConnection();
  console.log('[Test] 接続テスト結果:', result ? '成功' : '失敗');
  process.exit(result ? 0 : 1);
} catch (err) {
  console.error('[Test] 接続テストエラー:', err.message);
  process.exit(1);
}
