import { execSync } from 'child_process';

function findChromeExecutable() {
  try {
    // 環境変数で指定されている場合
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      console.log('Found in env:', process.env.PUPPETEER_EXECUTABLE_PATH);
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // ユーザーキャッシュを検索
    const userCachePaths = [
      `/home/${process.env.USER}/.cache/puppeteer`,
      '/home/ubuntu/.cache/puppeteer',
      '/root/.cache/puppeteer',
    ];

    for (const cachePath of userCachePaths) {
      try {
        console.log('Searching in:', cachePath);
        const result = execSync(`find ${cachePath} -name "chrome" -type f 2>/dev/null | head -1`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();
        if (result) {
          console.log(`Found Chrome at: ${result}`);
          return result;
        }
      } catch (err) {
        console.log('Error searching:', err.message);
      }
    }

    console.warn('Chrome executable not found, using default');
    return undefined;
  } catch (error) {
    console.error('Error finding Chrome executable:', error);
    return undefined;
  }
}

const chromePath = findChromeExecutable();
console.log('\nFinal result:', chromePath);
