/**
 * VoiceVox TTS クライアント
 * 
 * ⚠️ WARNING: This code is currently disabled (ENABLE_VOICE=false in videoComposer.ts)
 * DO NOT remove this file or VoiceVox-related code
 * This will be implemented in Cursor with direct VoiceVox API access
 * 
 * 本番環境: WEB版VOICEVOX API（https://deprecatedapis.tts.quest）
 * ローカル環境: VoiceVoxエンジン（http://localhost:50021）
 * 
 * 環境変数VOICEVOX_API_URLで切り替え可能
 */

import axios from 'axios';
import { Buffer } from 'buffer';

export interface VoiceVoxOptions {
  text: string;
  speaker?: number; // 話者ID（デフォルト: 1 = ずんだもん）
  speed?: number; // 話速（0.5 ~ 2.0、デフォルト: 1.0）
  pitch?: number; // ピッチ（-0.15 ~ 0.15、デフォルト: 0.0）
  intonationScale?: number; // イントネーション（0.0 ~ 2.0、デフォルト: 1.0）
}

export interface VoiceVoxResult {
  audioBuffer: Buffer;
  duration: number; // 秒（推定）
}

/**
 * VoiceVox APIのベースURL
 * 環境変数で切り替え可能
 */
function getVoiceVoxBaseURL(): string {
  // 環境変数で指定されている場合はそれを使用
  if (process.env.VOICEVOX_API_URL) {
    return process.env.VOICEVOX_API_URL;
  }

  // デフォルトは低速API（API Key不要）
  return 'https://api.tts.quest/v3/voicevox';
}

/**
 * VoiceVox API Keyを取得
 */
function getVoiceVoxAPIKey(): string | undefined {
  return process.env.VOICEVOX_API_KEY;
}

/**
 * ローカルVoiceVoxエンジンを使用するかどうか
 */
function isLocalVoiceVox(): boolean {
  const baseURL = getVoiceVoxBaseURL();
  return baseURL.includes('localhost') || baseURL.includes('127.0.0.1');
}

/**
 * WEB版VOICEVOX APIを使用して音声を生成
 * 低速API（API Key不要）またはAPI Key付き高速APIに対応
 */
async function generateSpeechWithWebAPI(options: VoiceVoxOptions): Promise<VoiceVoxResult> {
  const {
    text,
    speaker = 1, // デフォルト: ずんだもん
    speed = 1.0,
    pitch = 0.0,
    intonationScale = 1.0,
  } = options;

  const baseURL = getVoiceVoxBaseURL();
  const apiKey = getVoiceVoxAPIKey();

  // 低速API（API Key不要）の場合
  const isSlowAPI = baseURL.includes('api.tts.quest/v3');

  let url: string;
  let params: any;

  if (isSlowAPI) {
    // 低速API（v3）
    url = `${baseURL}/synthesis`;
    params = {
      text,
      speaker: speaker.toString(),
      // 低速APIはspeed, pitch, intonationScaleをサポートしていない可能性あり
    };
    console.log('[VoiceVox] 低速API呼び出し（API Key不要）:', { url, text: text.substring(0, 50) });
  } else {
    // 高速API（v2、API Key必要）
    if (!apiKey) {
      throw new Error('VOICEVOX_API_KEY環境変数が設定されていません');
    }
    url = `${baseURL}/audio/`;
    params = {
      text,
      key: apiKey,
      speaker: speaker.toString(),
      speed: speed.toString(),
      pitch: pitch.toString(),
      intonationScale: intonationScale.toString(),
    };
    console.log('[VoiceVox] 高速API呼び出し:', { url, text: text.substring(0, 50) });
  }

  let retries = 0;
  const maxRetries = 3;
  let response: any;
  let audioBuffer: Buffer | undefined;

  while (retries <= maxRetries) {
    try {
      // 低速APIはJSONレスポンスを返す
      response = await axios.get(url, {
        params,
        responseType: isSlowAPI ? 'json' : 'arraybuffer',
        timeout: 60000, // 60秒タイムアウト（低速APIは時間がかかる）
      });

      console.log('[VoiceVox] Response headers:', {
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length'],
        status: response.status,
      });

      // ステータスコードが200でない場合はエラー
      if (response.status !== 200) {
        throw new Error(`VoiceVox API returned status ${response.status}`);
      }

      break; // 成功したらループを抜ける
    } catch (error: any) {
      if (error.response?.status === 429) {
        // 429 Too Many Requests
        const retryAfter = parseInt(error.response.headers['retry-after'] || '20', 10);
        console.warn(`[VoiceVox] Rate limited (429). Retrying after ${retryAfter} seconds... (attempt ${retries + 1}/${maxRetries})`);
        
        if (retries >= maxRetries) {
          throw new Error(`VoiceVox API rate limit exceeded after ${maxRetries} retries`);
        }
        
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        retries++;
      } else {
        throw error; // 他のエラーはそのままスロー
      }
    }
  }

  try {
    let audioBuffer: Buffer | null = null;

    if (isSlowAPI) {
      // 低速APIの場合、JSONレスポンスから音声URLを取得してダウンロード
      const jsonResponse = response.data;
      console.log('[VoiceVox] JSON response:', jsonResponse);

      if (!jsonResponse.success) {
        throw new Error('VoiceVox API returned success=false');
      }

      const audioUrl = jsonResponse.wavDownloadUrl;
      if (!audioUrl) {
        throw new Error('VoiceVox API did not return wavDownloadUrl');
      }

      console.log('[VoiceVox] Downloading audio from:', audioUrl);

      // 音声ファイルをダウンロード（リトライロジック付き）
      let downloadRetries = 0;
      const maxDownloadRetries = 20; // 10回から20回に増やす
      
      while (downloadRetries <= maxDownloadRetries) {
        try {
          const audioResponse = await axios.get(audioUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
          });
          audioBuffer = Buffer.from(audioResponse.data);
          console.log('[VoiceVox] Audio downloaded successfully:', audioBuffer.length, 'bytes');
          break;
        } catch (downloadError: any) {
          if (downloadError.response?.status === 404 && downloadRetries < maxDownloadRetries) {
            // 404の場合、音声生成が完了していない可能性があるので待機
            // Retry-Afterヘッダーを確認
            const retryAfterHeader = downloadError.response?.headers?.['retry-after'];
            let waitTime: number;
            
            if (retryAfterHeader) {
              // Retry-Afterヘッダーが存在する場合、その値を使用
              waitTime = parseInt(retryAfterHeader, 10);
              if (isNaN(waitTime)) {
                // パース失敗時はデフォルト値
                waitTime = Math.min(3 + downloadRetries * 3, 60);
              }
              console.warn(`[VoiceVox] Audio not ready (404). Retry-After: ${waitTime}s (attempt ${downloadRetries + 1}/${maxDownloadRetries})`);
            } else {
              // Retry-Afterヘッダーがない場合、固定の待機時間
              waitTime = Math.min(3 + downloadRetries * 3, 60);
              console.warn(`[VoiceVox] Audio not ready (404). Waiting ${waitTime}s... (attempt ${downloadRetries + 1}/${maxDownloadRetries})`);
            }
            
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            downloadRetries++;
          } else {
            throw downloadError;
          }
        }
      }

      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('Failed to download audio after multiple retries');
      }
    } else {
      // 高速APIの場合、直接音声データが返される
      audioBuffer = Buffer.from(response.data);
    }

    // 音声の長さを推定（文字数から概算）
    // 日本語の平均読み上げ速度: 約300文字/分 = 5文字/秒
    const estimatedDuration = (text.length / 5) / speed;

    if (!audioBuffer) {
      throw new Error('Audio buffer is null after processing');
    }

    console.log('[VoiceVox] 音声生成成功:', {
      bufferSize: audioBuffer.length,
      estimatedDuration: `${estimatedDuration.toFixed(2)}秒`,
    });

    return {
      audioBuffer,
      duration: estimatedDuration,
    };
  } catch (error: any) {
    console.error('[VoiceVox] WEB版API呼び出しエラー:', error.message);

    // エラーレスポンスを確認
    if (error.response?.data) {
      if (typeof error.response?.data === 'string') {
        const errorText = error.response.data;
        console.error('[VoiceVox] エラーレスポンス:', errorText);
        if (errorText.includes('invalidApiKey')) {
          throw new Error('VoiceVox API Keyが無効です');
        } else if (errorText.includes('notEnoughPoints')) {
          throw new Error('VoiceVox APIのポイントが不足しています');
        } else if (errorText.includes('failed')) {
          throw new Error('VoiceVox APIで音声合成に失敗しました');
        }
      }
    }

    throw new Error(`VoiceVox API呼び出しエラー: ${error.message}`);
  }
}

/**
 * ローカルVoiceVoxエンジンを使用して音声を生成
 */
async function generateSpeechWithLocalEngine(options: VoiceVoxOptions): Promise<VoiceVoxResult> {
  const {
    text,
    speaker = 1,
    speed = 1.0,
    pitch = 0.0,
    intonationScale = 1.0,
  } = options;

  const baseURL = getVoiceVoxBaseURL();

  console.log('[VoiceVox] ローカルエンジン呼び出し:', { baseURL, text: text.substring(0, 50) });

  try {
    // Step 1: クエリ作成
    const queryResponse = await axios.post(
      `${baseURL}/audio_query`,
      {},
      {
        params: {
          text,
          speaker,
        },
        timeout: 10000,
      }
    );

    const query = queryResponse.data;

    // パラメータを調整
    query.speedScale = speed;
    query.pitchScale = pitch;
    query.intonationScale = intonationScale;

    // Step 2: 音声合成
    const synthesisResponse = await axios.post(
      `${baseURL}/synthesis`,
      query,
      {
        params: {
          speaker,
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    const audioBuffer = Buffer.from(synthesisResponse.data);

    // 音声の長さを推定
    const estimatedDuration = (text.length / 5) / speed;

    if (!audioBuffer) {
      throw new Error('Audio buffer is null after processing');
    }

    console.log('[VoiceVox] 音声生成成功:', {
      bufferSize: audioBuffer.length,
      estimatedDuration: `${estimatedDuration.toFixed(2)}秒`,
    });

    return {
      audioBuffer,
      duration: estimatedDuration,
    };
  } catch (error: any) {
    console.error('[VoiceVox] ローカルエンジン呼び出しエラー:', error.message);

    if (error.code === 'ECONNREFUSED') {
      throw new Error('VoiceVoxエンジンに接続できません。ローカルでVoiceVoxエンジンを起動してください。');
    }

    throw new Error(`VoiceVoxエンジン呼び出しエラー: ${error.message}`);
  }
}

/**
 * VoiceVoxを使用して音声を生成
 * 
 * @param options 音声生成オプション
 * @returns 音声バッファと再生時間
 */
export async function generateSpeech(options: VoiceVoxOptions): Promise<VoiceVoxResult> {
  if (isLocalVoiceVox()) {
    return generateSpeechWithLocalEngine(options);
  } else {
    return generateSpeechWithWebAPI(options);
  }
}

export interface VoiceVoxSpeaker {
  speaker_uuid: string;
  name: string;
  styles: Array<{
    name: string;
    id: number;
  }>;
}

/**
 * デフォルトの話者リスト（WEB版API用）
 */
const DEFAULT_SPEAKERS: VoiceVoxSpeaker[] = [
  { speaker_uuid: '7ffcb7ce-00ec-4bdc-82cd-45a8889e43ff', name: 'ずんだもん', styles: [{ name: 'ノーマル', id: 3 }, { name: '元気', id: 1 }] },
  { speaker_uuid: '388f246b-8c41-4ac1-8e2d-5d79f3ff56d9', name: '四国めたん', styles: [{ name: 'ノーマル', id: 2 }, { name: 'あまあま', id: 0 }] },
  { speaker_uuid: '35b2c544-660e-401e-b503-0e14c635303a', name: '春日部つむぎ', styles: [{ name: 'ノーマル', id: 8 }] },
  { speaker_uuid: '3c37646f-3881-5374-2a83-149267990abc', name: '雨晴はう', styles: [{ name: 'ノーマル', id: 10 }] },
  { speaker_uuid: 'c30dc15a-0992-4f8d-8bb8-ad3b314e6a6f', name: '波音リツ', styles: [{ name: 'ノーマル', id: 9 }] },
  { speaker_uuid: '388f246b-8c41-4ac1-8e2d-5d79f3ff56d9', name: '玄野武宏', styles: [{ name: 'ノーマル', id: 11 }] },
  { speaker_uuid: '0f56c2f2-644c-49c9-8989-94e11f7129d0', name: '白上虎太郎', styles: [{ name: 'ノーマル', id: 12 }] },
  { speaker_uuid: 'b1a81618-b27b-40d2-b0ea-27a9ad408c4b', name: '青山龍星', styles: [{ name: 'ノーマル', id: 13 }] },
  { speaker_uuid: 'b44d74c3-3f5a-4d40-9d7e-8e3e5c6f9b3a', name: 'No.7', styles: [{ name: 'ノーマル', id: 29 }] },
  { speaker_uuid: '481fb609-6446-4870-9f46-90c4dd623403', name: 'もち子さん', styles: [{ name: 'ノーマル', id: 20 }] },
  { speaker_uuid: '9f3ee141-26ad-437e-97bd-d22298d02ad2', name: '剣崎雌雄', styles: [{ name: 'ノーマル', id: 21 }] },
  { speaker_uuid: 'b1a81618-b27b-40d2-b0ea-27a9ad408c4b', name: 'ちび式じい', styles: [{ name: 'ノーマル', id: 42 }] },
  { speaker_uuid: '8eaad775-3119-417e-8cf4-2a10bfd592c8', name: '櫻歌ミコ', styles: [{ name: 'ノーマル', id: 43 }] },
  { speaker_uuid: '0693554c-338e-4790-8982-b9c6d476dc69', name: '小夜/SAYO', styles: [{ name: 'ノーマル', id: 46 }] },
];

/**
 * 利用可能な話者一覧を取得
 */
export async function getSpeakers(): Promise<VoiceVoxSpeaker[]> {
  const baseURL = getVoiceVoxBaseURL();

  try {
    if (isLocalVoiceVox()) {
      // ローカルVoiceVoxエンジンから話者一覧を取得
      const response = await axios.get(`${baseURL}/speakers`, { timeout: 5000 });
      return response.data;
    } else {
      // WEB版APIは話者一覧エンドポイントがないため、固定リストを返す
      console.log('[VoiceVox] WEB版APIのためデフォルト話者リストを返します');
      return DEFAULT_SPEAKERS;
    }
  } catch (error: any) {
    console.error('[VoiceVox] 話者一覧取得エラー:', error.message);
    // エラー時はデフォルトの話者リストを返す
    return DEFAULT_SPEAKERS;
  }
}

/**
 * VoiceVox APIの接続テスト
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await generateSpeech({
      text: 'テスト',
      speaker: 1,
    });
    console.log('[VoiceVox] 接続テスト成功:', {
      bufferSize: result.audioBuffer.length,
      duration: result.duration,
    });
    return true;
  } catch (error: any) {
    console.error('[VoiceVox] 接続テストエラー:', error.message);
    return false;
  }
}
