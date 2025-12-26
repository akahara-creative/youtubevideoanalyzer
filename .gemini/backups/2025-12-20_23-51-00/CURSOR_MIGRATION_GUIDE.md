# Cursor移行ガイド

このドキュメントは、ManusからCursor環境への移行時に必要な作業をまとめたものです。

---

## 1. TypeScriptエラーについて（149個）

### 概要
現在のTypeScriptエラー149個は、**動画生成機能とは無関係の別機能**（SEO記事生成、戦略レコメンデーション）のエラーです。動画生成機能の動作には影響しません。

### 主なエラー内容

#### strategyRecommendation.ts（59行目、68行目、84行目）
```typescript
// エラー: Property 'strategies' does not exist on type '...'
if (ragResults.strategies.length === 0) { ... }
```

**原因**: `searchRAGWithTags`関数の戻り値は`ragDocuments`の配列ですが、コードは`strategies`プロパティにアクセスしようとしています。

**修正方法**:
```typescript
// 修正前
const ragResults = await searchRAGWithTags({ ... });
if (ragResults.strategies.length === 0) { ... }

// 修正後
const ragResults = await searchRAGWithTags({ ... });
if (ragResults.length === 0) { ... }
// または、戻り値を { strategies: ragResults } のようにラップする
```

#### seoArticleJobProcessor.ts（224行目）
```typescript
// エラー: Property 'overallScore' does not exist on type '...'
const score = validation.overallScore;
```

**原因**: バリデーション関数の戻り値に`overallScore`プロパティが定義されていません。

**修正方法**: バリデーション関数の戻り値型に`overallScore`を追加するか、該当行を削除してください。

### 修正の優先度
これらのエラーは**優先度低**です。動画生成機能を優先的に実装してください。

---

## 2. Manus組み込みAPIの置き換え

### 必須の置き換え作業

Cursor環境では、Manus組み込みAPIが利用できないため、以下のAPIを外部サービスに置き換える必要があります。

#### 2.1 LLM API（最重要）

**現在の実装**: `server/_core/llm.ts`
```typescript
// Manus組み込みLLM API（OpenAI互換）
const response = await invokeLLM({
  messages: [{ role: "user", content: "..." }],
});
```

**置き換え先**: OpenAI API
```bash
# 環境変数を追加
OPENAI_API_KEY=sk-...
```

**修正ファイル**: `server/_core/llm.ts`
```typescript
// 修正前
const apiUrl = ENV.forgeApiUrl + "/v1/chat/completions";
const apiKey = ENV.forgeApiKey;

// 修正後
const apiUrl = "https://api.openai.com/v1/chat/completions";
const apiKey = process.env.OPENAI_API_KEY;
```

#### 2.2 S3ストレージ（重要）

**現在の実装**: `server/storage.ts`
```typescript
// Manus組み込みS3プロキシ
const { url } = await storagePut(fileKey, buffer, mimeType);
```

**置き換え先**: AWS S3直接接続
```bash
# 環境変数を追加
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-northeast-1
AWS_S3_BUCKET=your-bucket-name
```

**修正ファイル**: `server/storage.ts`
```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function storagePut(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType?: string
) {
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    Body: data,
    ContentType: contentType,
  }));
  
  return {
    key,
    url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
  };
}
```

**必要なパッケージ**:
```bash
pnpm add @aws-sdk/client-s3
```

#### 2.3 Whisper API（音声文字起こし）

**現在の実装**: `server/_core/voiceTranscription.ts`
```typescript
// Manus組み込みWhisper API
const result = await transcribeAudio({
  audioUrl: "...",
  language: "ja",
});
```

**置き換え先**: OpenAI Whisper API
```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribeAudio(params: {
  audioUrl: string;
  language?: string;
}) {
  // 音声ファイルをダウンロード
  const response = await fetch(params.audioUrl);
  const audioBuffer = await response.arrayBuffer();
  
  // Whisper APIで文字起こし
  const transcription = await openai.audio.transcriptions.create({
    file: new File([audioBuffer], "audio.mp3"),
    model: "whisper-1",
    language: params.language,
  });
  
  return {
    text: transcription.text,
    language: params.language || "ja",
  };
}
```

#### 2.4 画像生成API（オプション）

**現在の実装**: `server/_core/imageGeneration.ts`

**置き換え先**: OpenAI DALL-E API
```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateImage(params: {
  prompt: string;
}) {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: params.prompt,
    n: 1,
    size: "1024x1024",
  });
  
  return {
    url: response.data[0].url!,
  };
}
```

### 置き換え不要なAPI

以下のAPIは外部サービスを直接使用しているため、置き換え不要です：

- **VoiceVox API**: 無料のWEB版APIを使用（`server/voicevoxClient.ts`）
- **YouTube Data API**: Google APIを直接使用（`server/benchmarkAnalyzer.ts`）

---

## 3. データベースについて

### 現在の設定

データベースは**環境変数`DATABASE_URL`で接続**しており、Manus固有の設定は使用していません。

**接続コード**: `server/db.ts`
```typescript
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
```

### Cursor移行時の対応

#### オプション1: Manus提供のデータベースを継続利用（推奨）

Manusで作成したデータベースをCursor環境から接続できます。

**手順**:
1. Manus管理画面でデータベース接続情報を確認
2. `.env`ファイルに`DATABASE_URL`を設定
```bash
DATABASE_URL=mysql://user:password@host:port/database
```

**メリット**:
- データ移行不要
- 既存の分析履歴、RAGドキュメント、動画生成履歴をそのまま利用可能

#### オプション2: 新しいデータベースを作成

新規にMySQLデータベースを作成する場合：

**手順**:
1. MySQL/TiDBデータベースを作成（PlanetScale、AWS RDS、ローカルMySQLなど）
2. `.env`ファイルに`DATABASE_URL`を設定
3. マイグレーション実行
```bash
pnpm db:push
```

**注意**: 既存のデータは失われます。

### データベーススキーマ

スキーマは`drizzle/schema.ts`で定義されており、Manus固有の設定は含まれていません。

---

## 4. VoiceVox音声生成機能の実装（最優先）

### 現在の状況

- `server/videoComposer.ts`の`ENABLE_VOICE=false`で音声生成を無効化
- 動画はサイレント音声トラックのみで生成
- VoiceVox関連コードは削除せず保持

### 実装手順

#### Step 1: ENABLE_VOICEフラグを有効化

**ファイル**: `server/videoComposer.ts`
```typescript
// 修正前
const ENABLE_VOICE = false;

// 修正後
const ENABLE_VOICE = true;
```

#### Step 2: VoiceVox APIの直接呼び出しを実装

**ファイル**: `server/voicevoxClient.ts`

現在の実装は以下の問題があります：
- 音声ダウンロードが失敗する（"Downloaded audio buffer is empty"エラー）
- レート制限で複数チャンクの処理が遅い

**修正案**:
```typescript
export async function generateSpeech(
  options: VoiceVoxOptions
): Promise<VoiceVoxResult> {
  const baseURL = getVoiceVoxBaseURL();
  const apiKey = getVoiceVoxAPIKey();
  
  try {
    // Step 1: 音声合成クエリを作成
    const queryResponse = await axios.post(
      `${baseURL}/audio_query`,
      null,
      {
        params: {
          text: options.text,
          speaker: options.speaker || 3,
        },
        headers: apiKey ? { "x-api-key": apiKey } : {},
      }
    );
    
    // Step 2: 音声を合成
    const synthesisResponse = await axios.post(
      `${baseURL}/synthesis`,
      queryResponse.data,
      {
        params: {
          speaker: options.speaker || 3,
        },
        headers: apiKey ? { "x-api-key": apiKey } : {},
        responseType: "arraybuffer",
      }
    );
    
    const audioBuffer = Buffer.from(synthesisResponse.data);
    
    if (audioBuffer.length === 0) {
      throw new Error("Downloaded audio buffer is empty");
    }
    
    // 音声の長さを推定（文字数から）
    const estimatedDuration = options.text.length * 0.1;
    
    return {
      audioBuffer,
      duration: estimatedDuration,
    };
  } catch (error) {
    console.error("[VoiceVox] Error generating speech:", error);
    throw error;
  }
}
```

#### Step 3: 並列処理の実装

**ファイル**: `server/videoComposer.ts`

複数チャンクを並列処理できるように修正：
```typescript
// 各チャンクごとに音声を生成（並列処理）
const audioBuffers: Buffer[] = [];
const chunkPromises = chunks.map(async (chunk, i) => {
  console.log(`[VideoComposer] Generating audio for chunk ${i + 1}/${chunks.length}`);
  const result = await generateSpeech({
    text: chunk,
    speaker: speakerId,
  });
  return { index: i, buffer: result.audioBuffer, duration: result.duration };
});

const results = await Promise.all(chunkPromises);
results.sort((a, b) => a.index - b.index);
audioBuffers.push(...results.map(r => r.buffer));
```

#### Step 4: リトライ処理の強化

```typescript
async function generateSpeechWithRetry(
  options: VoiceVoxOptions,
  maxRetries: number = 5
): Promise<VoiceVoxResult> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await generateSpeech(options);
    } catch (error) {
      console.warn(`[VoiceVox] Retry ${i + 1}/${maxRetries}:`, error);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
  throw new Error("Max retries exceeded");
}
```

---

## 5. 環境変数の設定

### 必須の環境変数

Cursor環境で`.env`ファイルを作成し、以下の環境変数を設定してください：

```bash
# データベース
DATABASE_URL=mysql://user:password@host:port/database

# OpenAI API（LLM、Whisper、DALL-E）
OPENAI_API_KEY=sk-...

# AWS S3（動画ストレージ）
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-northeast-1
AWS_S3_BUCKET=your-bucket-name

# JWT認証（既存の値を使用）
JWT_SECRET=your-jwt-secret

# OAuth（Manusを継続利用する場合）
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=your-owner-name

# VoiceVox API（オプション、高速APIを使う場合）
VOICEVOX_API_URL=https://api.tts.quest/v3/voicevox
VOICEVOX_API_KEY=your-voicevox-api-key
```

### オプションの環境変数

```bash
# Google Maps API（戦略レコメンデーション機能で使用）
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# YouTube Data API（ベンチマーク分析で使用）
YOUTUBE_API_KEY=your-youtube-api-key
```

---

## 6. 移行チェックリスト

### Phase 1: 環境構築
- [ ] `.env`ファイルを作成し、必須の環境変数を設定
- [ ] `pnpm install`で依存関係をインストール
- [ ] データベース接続を確認（`pnpm db:push`）
- [ ] 開発サーバーを起動（`pnpm dev`）

### Phase 2: API置き換え
- [ ] OpenAI APIキーを取得し、環境変数に設定
- [ ] `server/_core/llm.ts`を修正（Manus API → OpenAI API）
- [ ] `server/storage.ts`を修正（Manus S3プロキシ → AWS S3直接接続）
- [ ] `server/_core/voiceTranscription.ts`を修正（Manus Whisper → OpenAI Whisper）
- [ ] AWS S3バケットを作成し、認証情報を設定

### Phase 3: VoiceVox音声機能の実装
- [ ] `server/videoComposer.ts`の`ENABLE_VOICE`を`true`に変更
- [ ] `server/voicevoxClient.ts`の音声ダウンロード処理を修正
- [ ] 並列処理とリトライ処理を実装
- [ ] 音声付き動画が正常に生成されることを確認

### Phase 4: TypeScriptエラー修正（オプション）
- [ ] `server/strategyRecommendation.ts`の`strategies`プロパティエラーを修正
- [ ] `server/seoArticleJobProcessor.ts`の`overallScore`プロパティエラーを修正
- [ ] 残りのTypeScriptエラーを修正

### Phase 5: 動作確認
- [ ] 動画生成機能のエンドツーエンドテスト
- [ ] 音声付き動画が正常に生成されることを確認
- [ ] S3に動画が正常にアップロードされることを確認
- [ ] データベースに履歴が正常に保存されることを確認

---

## 7. トラブルシューティング

### データベース接続エラー

**エラー**: `[Database] Failed to connect`

**原因**: `DATABASE_URL`が正しく設定されていない

**解決方法**:
1. `.env`ファイルに`DATABASE_URL`が設定されているか確認
2. データベースサーバーが起動しているか確認
3. 接続情報（ホスト、ポート、ユーザー名、パスワード）が正しいか確認

### OpenAI APIエラー

**エラー**: `401 Unauthorized`

**原因**: `OPENAI_API_KEY`が正しく設定されていない

**解決方法**:
1. `.env`ファイルに`OPENAI_API_KEY`が設定されているか確認
2. APIキーが有効か確認（OpenAIダッシュボードで確認）

### S3アップロードエラー

**エラー**: `AccessDenied`

**原因**: AWS認証情報が正しく設定されていない

**解決方法**:
1. `.env`ファイルに`AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`が設定されているか確認
2. IAMユーザーにS3バケットへの書き込み権限があるか確認

### VoiceVox音声生成エラー

**エラー**: `Downloaded audio buffer is empty`

**原因**: VoiceVox APIの音声ダウンロードが失敗

**解決方法**:
1. `server/voicevoxClient.ts`の音声ダウンロード処理を修正（上記の修正案を参照）
2. リトライ処理を実装
3. 高速API（API Key必要）を使用する

---

## 8. 参考リンク

- **OpenAI API**: https://platform.openai.com/docs/api-reference
- **AWS S3 SDK**: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/
- **VoiceVox API**: https://voicevox.hiroshiba.jp/
- **Drizzle ORM**: https://orm.drizzle.team/docs/overview

---

## まとめ

Cursor移行時に最も重要なのは、**Manus組み込みAPIの置き換え**です。特に以下の3つは必須です：

1. **LLM API** (OpenAI API)
2. **S3ストレージ** (AWS S3)
3. **Whisper API** (OpenAI Whisper)

データベースはManus提供のものを継続利用できるため、移行作業は不要です。

VoiceVox音声機能は、`ENABLE_VOICE=true`に変更し、音声ダウンロード処理を修正すれば実装完了です。

TypeScriptエラー（149個）は動画生成機能とは無関係なので、後回しで問題ありません。
