import 'dotenv/config';
import { separateKeywords } from '../server/seoArticleGenerator.ts';

// Force Local LLM settings
process.env.USE_OLLAMA = 'true';
process.env.OLLAMA_MODEL = 'qwen2.5:72b';
process.env.OLLAMA_NUM_CTX = '32768';
process.env.OLLAMA_TIMEOUT = '1200000';

async function main() {
  console.log('Testing separateKeywords with Qwen2.5:72b...');
  const theme = "動画編集で稼げない人が、SNS集客を始めても地獄を見る理由";
  
  try {
    const result = await separateKeywords(theme);
    console.log('Result:', result);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

main();
