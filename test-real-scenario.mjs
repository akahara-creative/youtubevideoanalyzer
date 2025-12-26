import { generateSpeech } from './server/voicevoxClient.ts';
import { promises as fs } from 'fs';
import mysql from 'mysql2/promise';

async function testRealScenario() {
  console.log('=== Real Scenario Audio Generation Test ===\n');

  // Get scenario text from database
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query('SELECT hookContent, problemContent, solutionContent, ctaContent FROM videoScenario WHERE jobId = 90006');
  await conn.end();

  if (rows.length === 0) {
    console.error('No scenario found for jobId 90006');
    process.exit(1);
  }

  const scenario = rows[0];
  const fullText = [
    scenario.hookContent,
    scenario.problemContent,
    scenario.solutionContent,
    scenario.ctaContent,
  ].filter(t => t && t.trim()).join('\n\n');

  console.log('Text length:', fullText.length, 'characters');
  console.log('Speaker ID: 3 (ずんだもん・ノーマル)\n');

  try {
    console.log('[1] Calling VoiceVox API...');
    const startTime = Date.now();
    
    const result = await generateSpeech({
      text: fullText,
      speaker: 3,
      speed: 1.0,
      pitch: 0.0,
      intonationScale: 1.0,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[2] API call successful! (${elapsed}s)`);
    console.log('Audio buffer size:', result.audioBuffer.length, 'bytes');
    console.log('Estimated duration:', result.duration.toFixed(2), 'seconds');

    if (result.audioBuffer.length === 0) {
      console.error('\n❌ ERROR: Audio buffer is empty!');
      process.exit(1);
    }

    // Save audio to file
    const outputPath = '/tmp/test-real-scenario.wav';
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

testRealScenario();
