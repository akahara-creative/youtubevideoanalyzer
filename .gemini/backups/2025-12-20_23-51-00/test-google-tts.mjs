import axios from 'axios';
import { writeFileSync } from 'fs';

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

console.log('[Test] Testing OpenAI TTS API via Manus Forge API...');
console.log('[Test] API URL:', FORGE_API_URL);

async function testGoogleTTS() {
  try {
    // Try OpenAI-compatible TTS endpoint
    const response = await axios.post(
      `https://forge.manus.ai/v1/audio/speech`,
      {
        model: 'tts-1',
        voice: 'alloy',
        input: 'こんにちは、これはGoogle TTSのテストです。',
      },
      {
        headers: {
          'Authorization': `Bearer ${FORGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    console.log('[Test] ✅ TTS API call successful');
    console.log('[Test] Response status:', response.status);
    console.log('[Test] Audio buffer size:', response.data.length, 'bytes');

    // 音声ファイルを保存
    writeFileSync('/tmp/test-tts.mp3', response.data);
    console.log('[Test] ✅ Audio saved to /tmp/test-tts.mp3');

    return true;
  } catch (error) {
    console.error('[Test] ❌ TTS API call failed:', error.message);
    if (error.response) {
      console.error('[Test] Response status:', error.response.status);
      console.error('[Test] Response data:', error.response.data?.toString());
    }
    return false;
  }
}

testGoogleTTS();
