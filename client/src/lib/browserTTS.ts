/**
 * ブラウザTTS（Web Speech API）ユーティリティ
 * 
 * フロントエンドで音声を生成し、Blob形式で返す。
 * 動画生成時にバックエンドにアップロードして使用する。
 */

export interface TTSOptions {
  text: string;
  lang?: string;
  rate?: number; // 0.1 ~ 10 (デフォルト: 1)
  pitch?: number; // 0 ~ 2 (デフォルト: 1)
  volume?: number; // 0 ~ 1 (デフォルト: 1)
  voice?: SpeechSynthesisVoice;
}

export interface TTSResult {
  audioBlob: Blob;
  duration: number; // 秒
}

/**
 * Web Speech APIを使用して音声を生成
 * 
 * @param options TTS設定
 * @returns 音声Blobと再生時間
 */
export async function generateSpeech(options: TTSOptions): Promise<TTSResult> {
  const {
    text,
    lang = 'ja-JP',
    rate = 1,
    pitch = 1,
    volume = 1,
    voice,
  } = options;

  // Web Speech APIのサポート確認
  if (!('speechSynthesis' in window)) {
    throw new Error('このブラウザはWeb Speech APIをサポートしていません');
  }

  // MediaRecorderのサポート確認
  if (!('MediaRecorder' in window)) {
    throw new Error('このブラウザはMediaRecorderをサポートしていません');
  }

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    if (voice) {
      utterance.voice = voice;
    }

    // AudioContextを作成して音声を録音
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    const mediaRecorder = new MediaRecorder(destination.stream);
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(chunks, { type: 'audio/webm' });
      const duration = audioContext.currentTime;
      audioContext.close();
      resolve({ audioBlob, duration });
    };

    utterance.onstart = () => {
      mediaRecorder.start();
    };

    utterance.onend = () => {
      // 録音を停止（少し遅延を入れて確実に録音を完了させる）
      setTimeout(() => {
        mediaRecorder.stop();
      }, 100);
    };

    utterance.onerror = (event) => {
      mediaRecorder.stop();
      audioContext.close();
      reject(new Error(`音声生成エラー: ${event.error}`));
    };

    // 音声を再生（録音のため）
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * 利用可能な音声一覧を取得
 * 
 * @returns 音声一覧
 */
export function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    let voices = window.speechSynthesis.getVoices();
    
    if (voices.length > 0) {
      resolve(voices);
    } else {
      // 一部のブラウザでは非同期で音声が読み込まれる
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        resolve(voices);
      };
    }
  });
}

/**
 * 日本語音声を取得
 * 
 * @returns 日本語音声一覧
 */
export async function getJapaneseVoices(): Promise<SpeechSynthesisVoice[]> {
  const voices = await getAvailableVoices();
  return voices.filter(voice => voice.lang.startsWith('ja'));
}

/**
 * デフォルトの日本語音声を取得
 * 
 * @returns デフォルトの日本語音声
 */
export async function getDefaultJapaneseVoice(): Promise<SpeechSynthesisVoice | undefined> {
  const japaneseVoices = await getJapaneseVoices();
  
  // Google日本語音声を優先
  const googleVoice = japaneseVoices.find(voice => 
    voice.name.includes('Google') && voice.lang === 'ja-JP'
  );
  
  if (googleVoice) {
    return googleVoice;
  }
  
  // それ以外の日本語音声
  return japaneseVoices[0];
}

/**
 * 音声プレビュー（実際に音声を再生）
 * 
 * @param text テキスト
 * @param options TTS設定
 */
export function previewSpeech(text: string, options?: Partial<TTSOptions>): void {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options?.lang || 'ja-JP';
  utterance.rate = options?.rate || 1;
  utterance.pitch = options?.pitch || 1;
  utterance.volume = options?.volume || 1;

  if (options?.voice) {
    utterance.voice = options.voice;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * 音声再生を停止
 */
export function stopSpeech(): void {
  window.speechSynthesis.cancel();
}
