import { generateSpeech } from './server/voicevoxClient.ts';
import { promises as fs } from 'fs';

async function testAudioGeneration() {
  console.log('=== Audio Generation Test ===\n');

  const testText = `
こんにちは、これはテストです。
音声トラックが正しく生成されるか確認しています。
VoiceVox APIを使用して、日本語の音声を生成します。
  `.trim();

  console.log('Test text:');
  console.log(testText);
  console.log('\nText length:', testText.length, 'characters');
  console.log('Speaker ID: 3 (ずんだもん・ノーマル)\n');

  try {
    console.log('[1] Calling VoiceVox API...');
    const result = await generateSpeech({
      text: testText,
      speaker: 3,
      speed: 1.0,
      pitch: 0.0,
      intonationScale: 1.0,
    });

    console.log('[2] API call successful!');
    console.log('Audio buffer size:', result.audioBuffer.length, 'bytes');
    console.log('Estimated duration:', result.duration.toFixed(2), 'seconds');

    if (result.audioBuffer.length === 0) {
      console.error('\n❌ ERROR: Audio buffer is empty!');
      process.exit(1);
    }

    // Save audio to file
    const outputPath = '/tmp/test-audio.wav';
    await fs.writeFile(outputPath, result.audioBuffer);
    console.log('\n✅ Audio saved to:', outputPath);

    // Verify file size
    const stats = await fs.stat(outputPath);
    console.log('File size:', stats.size, 'bytes');

    if (stats.size === 0) {
      console.error('\n❌ ERROR: Saved file is empty!');
      process.exit(1);
    }

    console.log('\n✅ Test passed!');
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAudioGeneration();
