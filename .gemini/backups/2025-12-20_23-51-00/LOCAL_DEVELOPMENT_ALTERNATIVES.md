# ローカル開発環境での代替技術ガイド

このドキュメントは、Cursorなどのローカル開発環境でYouTube動画分析アプリを動かす場合の技術的な代替案をまとめたものです。Manusプラットフォームで使用している有料サービスを、オープンソースや低コストの技術に置き換える方法を説明します。

---

## 目次

1. [現在使用している技術スタック](#現在使用している技術スタック)
2. [代替技術の概要](#代替技術の概要)
3. [詳細な代替案](#詳細な代替案)
4. [コスト比較](#コスト比較)
5. [実装の難易度](#実装の難易度)
6. [推奨構成](#推奨構成)

---

## 現在使用している技術スタック

### 1. **AI/ML関連**

| 機能 | 現在の技術 | 用途 | コスト |
|------|-----------|------|--------|
| テキスト生成 | OpenAI GPT-4 (Manus Forge API経由) | SEO記事生成、動画台本生成、チャット | 高 |
| 音声文字起こし | OpenAI Whisper API (Manus Forge API経由) | YouTube動画の音声文字起こし | 中 |
| 画像認識 | OpenAI GPT-4 Vision (Manus Forge API経由) | 動画フレームの内容分析 | 高 |
| ベクトルデータベース | ChromaDB (ローカル) | RAGドキュメントの埋め込みベクトル保存 | 無料 |
| 埋め込み生成 | OpenAI Embeddings (Manus Forge API経由) | テキストのベクトル化 | 低 |

### 2. **ストレージ関連**

| 機能 | 現在の技術 | 用途 | コスト |
|------|-----------|------|--------|
| ファイルストレージ | S3 (Manus built-in) | アップロードファイル、動画、画像の保存 | 低 |
| データベース | MySQL/TiDB (Manus managed) | メタデータ、ユーザー情報、履歴の保存 | 中 |

### 3. **認証関連**

| 機能 | 現在の技術 | 用途 | コスト |
|------|-----------|------|--------|
| 認証 | Manus OAuth | ユーザー認証・セッション管理 | 無料 |

### 4. **インフラ関連**

| 機能 | 現在の技術 | 用途 | コスト |
|------|-----------|------|--------|
| ホスティング | Manus Sandbox | アプリケーションのホスティング | 無料〜低 |
| CDN | Manus built-in | 静的ファイルの配信 | 無料 |

---

## 代替技術の概要

### 代替戦略

ローカル開発環境で動かす場合、以下の3つの戦略があります：

1. **完全オープンソース戦略**: 全てをオープンソース技術で置き換え、コストをゼロに
2. **ハイブリッド戦略**: 重要な部分のみ有料サービスを使用し、他はオープンソースで
3. **低コストクラウド戦略**: AWS/GCP/Azureの低コストサービスを組み合わせる

---

## 詳細な代替案

### 1. テキスト生成（OpenAI GPT-4）

#### 現在の実装
```typescript
import { invokeLLM } from "./server/_core/llm";

const response = await invokeLLM({
  messages: [
    { role: "system", content: "あなたはSEOライターです。" },
    { role: "user", content: "記事を書いてください。" },
  ],
});
```

#### 代替案A: ローカルLLM（Ollama）

**技術**: [Ollama](https://ollama.ai/) + Llama 3.1, Mistral, Gemma など

**実装例**:
```typescript
import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://localhost:11434' });

const response = await ollama.chat({
  model: 'llama3.1:8b',
  messages: [
    { role: 'system', content: 'あなたはSEOライターです。' },
    { role: 'user', content: '記事を書いてください。' },
  ],
});
```

**メリット**:
- 完全無料
- データがローカルに留まる（プライバシー）
- API制限なし

**デメリット**:
- 高性能なGPU（VRAM 8GB以上）が必要
- 品質がGPT-4より劣る可能性がある
- 初回のモデルダウンロードに時間がかかる（数GB）

**推奨モデル**:
- **Llama 3.1 8B**: バランスが良い、日本語対応
- **Mistral 7B**: 高速、英語に強い
- **Gemma 2 9B**: Googleのモデル、品質が高い

**必要スペック**:
- CPU: 8コア以上
- RAM: 16GB以上
- GPU: NVIDIA RTX 3060以上（VRAM 8GB以上）推奨

#### 代替案B: OpenRouter（複数LLMのAPI集約サービス）

**技術**: [OpenRouter](https://openrouter.ai/)

**実装例**:
```typescript
import OpenAI from 'openai';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const response = await openrouter.chat.completions.create({
  model: 'meta-llama/llama-3.1-8b-instruct',
  messages: [
    { role: 'system', content: 'あなたはSEOライターです。' },
    { role: 'user', content: '記事を書いてください。' },
  ],
});
```

**メリット**:
- OpenAIより安い（10分の1〜100分の1）
- 複数のモデルから選択可能
- OpenAI互換のAPI

**デメリット**:
- 有料（ただし低コスト）
- 品質はモデルによる

**コスト例**:
- Llama 3.1 8B: $0.06 / 1M tokens（GPT-4の約1/500）
- Claude 3.5 Sonnet: $3 / 1M tokens（GPT-4の約1/10）

#### 代替案C: Groq（超高速推論API）

**技術**: [Groq](https://groq.com/)

**実装例**:
```typescript
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const response = await groq.chat.completions.create({
  model: 'llama-3.1-8b-instant',
  messages: [
    { role: 'system', content: 'あなたはSEOライターです。' },
    { role: 'user', content: '記事を書いてください。' },
  ],
});
```

**メリット**:
- 無料枠が大きい（1日あたり14,400リクエスト）
- 超高速（GPT-4の10倍以上）
- OpenAI互換のAPI

**デメリット**:
- 無料枠を超えると有料
- 品質はGPT-4より劣る

---

### 2. 音声文字起こし（OpenAI Whisper API）

#### 現在の実装
```typescript
import { transcribeAudio } from "./server/_core/voiceTranscription";

const result = await transcribeAudio({
  audioUrl: "https://storage.example.com/audio.mp3",
  language: "ja",
});
```

#### 代替案A: ローカルWhisper（faster-whisper）

**技術**: [faster-whisper](https://github.com/SYSTRAN/faster-whisper)（Python）

**実装例**:
```python
from faster_whisper import WhisperModel

model = WhisperModel("large-v3", device="cuda", compute_type="float16")

segments, info = model.transcribe("audio.mp3", language="ja")

for segment in segments:
    print(f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}")
```

**Node.jsから呼び出す**:
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function transcribeLocal(audioPath: string) {
  const { stdout } = await execAsync(`python3 transcribe.py ${audioPath}`);
  return JSON.parse(stdout);
}
```

**メリット**:
- 完全無料
- データがローカルに留まる
- 高精度（Whisper large-v3）

**デメリット**:
- GPU必須（VRAM 6GB以上）
- 処理時間がかかる（リアルタイムの0.5〜1倍）
- Pythonの環境構築が必要

**必要スペック**:
- GPU: NVIDIA RTX 3060以上（VRAM 6GB以上）
- RAM: 8GB以上

#### 代替案B: Whisper.cpp（C++実装）

**技術**: [whisper.cpp](https://github.com/ggerganov/whisper.cpp)

**実装例**:
```bash
# モデルのダウンロード
bash ./models/download-ggml-model.sh large-v3

# 文字起こし実行
./main -m models/ggml-large-v3.bin -f audio.wav -l ja
```

**メリット**:
- CPUでも動作（GPUなしでOK）
- 軽量・高速
- 完全無料

**デメリット**:
- 精度がやや劣る
- C++のビルドが必要

#### 代替案C: Deepgram（低コストAPI）

**技術**: [Deepgram](https://deepgram.com/)

**実装例**:
```typescript
import { createClient } from '@deepgram/sdk';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const { result } = await deepgram.listen.prerecorded.transcribeUrl(
  { url: 'https://storage.example.com/audio.mp3' },
  { model: 'nova-2', language: 'ja' }
);
```

**メリット**:
- OpenAI Whisperより安い（約1/3）
- 高速
- 日本語対応

**デメリット**:
- 有料

**コスト**:
- $0.0043 / 分（OpenAI: $0.006 / 分）

---

### 3. 画像認識（OpenAI GPT-4 Vision）

#### 現在の実装
```typescript
const response = await invokeLLM({
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "この画像を説明してください" },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }
  ],
});
```

#### 代替案A: Llama 3.2 Vision（ローカル）

**技術**: [Ollama](https://ollama.ai/) + Llama 3.2 Vision

**実装例**:
```typescript
const response = await ollama.chat({
  model: 'llama3.2-vision:11b',
  messages: [
    {
      role: 'user',
      content: 'この画像を説明してください',
      images: [fs.readFileSync('image.jpg').toString('base64')]
    }
  ],
});
```

**メリット**:
- 完全無料
- データがローカルに留まる

**デメリット**:
- 高性能なGPU必須（VRAM 12GB以上）
- 品質がGPT-4 Visionより劣る

**必要スペック**:
- GPU: NVIDIA RTX 4070以上（VRAM 12GB以上）

#### 代替案B: Google Gemini Flash（低コストAPI）

**技術**: [Google Gemini API](https://ai.google.dev/)

**実装例**:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const result = await model.generateContent([
  'この画像を説明してください',
  { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } }
]);
```

**メリット**:
- 無料枠が大きい（1日1500リクエスト）
- 高速
- 品質が高い

**デメリット**:
- 無料枠を超えると有料

**コスト**:
- 無料枠: 1日1500リクエスト
- 有料: $0.075 / 1M tokens（GPT-4 Visionの約1/100）

---

### 4. ファイルストレージ（S3）

#### 現在の実装
```typescript
import { storagePut } from "./server/storage";

const { url } = await storagePut(
  "files/document.pdf",
  fileBuffer,
  "application/pdf"
);
```

#### 代替案A: ローカルファイルシステム

**実装例**:
```typescript
import fs from 'fs/promises';
import path from 'path';

async function saveFile(filePath: string, buffer: Buffer) {
  const fullPath = path.join(process.cwd(), 'uploads', filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  return `/uploads/${filePath}`;
}
```

**メリット**:
- 完全無料
- シンプル

**デメリット**:
- スケールしない
- バックアップが必要
- CDNなし

#### 代替案B: MinIO（オープンソースS3互換ストレージ）

**技術**: [MinIO](https://min.io/)

**実装例**:
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true,
});

await s3.send(new PutObjectCommand({
  Bucket: 'uploads',
  Key: 'files/document.pdf',
  Body: fileBuffer,
}));
```

**メリット**:
- 完全無料
- S3互換（コード変更不要）
- ローカルまたはセルフホスト可能

**デメリット**:
- セルフホストの管理が必要
- CDNは別途必要

#### 代替案C: Cloudflare R2（低コストS3互換）

**技術**: [Cloudflare R2](https://www.cloudflare.com/products/r2/)

**実装例**:
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
```

**メリット**:
- S3互換（コード変更不要）
- 転送料金無料（S3より大幅に安い）
- CDN統合

**デメリット**:
- 有料（ただし低コスト）

**コスト**:
- ストレージ: $0.015 / GB / 月（S3の約1/2）
- 転送料金: 無料（S3: $0.09 / GB）

---

### 5. データベース（MySQL/TiDB）

#### 現在の実装
```typescript
import { drizzle } from "drizzle-orm/mysql2";

const db = drizzle(process.env.DATABASE_URL);
```

#### 代替案A: SQLite（ローカル）

**実装例**:
```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const sqlite = new Database('data.db');
const db = drizzle(sqlite);
```

**メリット**:
- 完全無料
- セットアップ不要
- 軽量

**デメリット**:
- 同時接続数に制限
- スケールしない

#### 代替案B: PostgreSQL（ローカル）

**実装例**:
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://localhost:5432/youtube_analyzer',
});

const db = drizzle(pool);
```

**メリット**:
- 完全無料
- 高機能
- スケール可能

**デメリット**:
- セットアップが必要
- メモリ使用量が多い

#### 代替案C: Supabase（低コストマネージドPostgreSQL）

**技術**: [Supabase](https://supabase.com/)

**実装例**:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.SUPABASE_DATABASE_URL);
const db = drizzle(client);
```

**メリット**:
- 無料枠が大きい（500MB DB、2GB転送/月）
- マネージド（管理不要）
- バックアップ自動

**デメリット**:
- 無料枠を超えると有料

**コスト**:
- 無料枠: 500MB DB、2GB転送/月
- 有料: $25/月〜（8GB DB、50GB転送/月）

---

### 6. 認証（Manus OAuth）

#### 現在の実装
```typescript
// Manus OAuthは自動的に処理される
const { user } = useAuth();
```

#### 代替案A: NextAuth.js（オープンソース）

**技術**: [NextAuth.js](https://next-auth.js.org/)

**実装例**:
```typescript
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
});
```

**メリット**:
- 完全無料
- 複数のプロバイダー対応（Google、GitHub、Emailなど）
- カスタマイズ可能

**デメリット**:
- セットアップが必要
- OAuth設定が必要

#### 代替案B: Clerk（低コストマネージド認証）

**技術**: [Clerk](https://clerk.com/)

**実装例**:
```typescript
import { ClerkProvider, useUser } from '@clerk/nextjs';

function App() {
  return (
    <ClerkProvider>
      <YourApp />
    </ClerkProvider>
  );
}
```

**メリット**:
- 無料枠が大きい（10,000 MAU）
- セットアップ簡単
- UI付き

**デメリット**:
- 無料枠を超えると有料

**コスト**:
- 無料枠: 10,000 MAU
- 有料: $25/月〜（10,000 MAU以上）

---

### 7. ベクトルデータベース（ChromaDB）

#### 現在の実装
```typescript
// ChromaDBはローカルで動作（変更不要）
```

#### 代替案A: Qdrant（オープンソース）

**技術**: [Qdrant](https://qdrant.tech/)

**実装例**:
```typescript
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({ url: 'http://localhost:6333' });

await client.upsert('documents', {
  points: [
    {
      id: 1,
      vector: embedding,
      payload: { text: 'ドキュメント内容' }
    }
  ]
});
```

**メリット**:
- 完全無料
- ChromaDBより高速
- スケール可能

**デメリット**:
- セットアップが必要

#### 代替案B: Pinecone（マネージドベクトルDB）

**技術**: [Pinecone](https://www.pinecone.io/)

**メリット**:
- 無料枠が大きい（1M vectors）
- マネージド
- 高速

**デメリット**:
- 無料枠を超えると有料

**コスト**:
- 無料枠: 1M vectors
- 有料: $70/月〜（5M vectors）

---

## コスト比較

### 月間1万リクエストの場合

| 機能 | 現在（Manus） | Ollama（ローカル） | OpenRouter | Groq | 削減率 |
|------|--------------|-------------------|-----------|------|--------|
| テキスト生成 | $300 | $0 | $30 | $0 | 90-100% |
| 音声文字起こし | $60 | $0 | - | - | 100% |
| 画像認識 | $200 | $0 | - | $0 | 100% |
| ストレージ | $5 | $0 | - | $2 | 60-100% |
| データベース | $10 | $0 | - | $0 | 100% |
| 認証 | $0 | $0 | - | $0 | 0% |
| **合計** | **$575** | **$0** | **$30** | **$2** | **95-100%** |

### 初期投資（ローカル環境）

| 項目 | コスト |
|------|--------|
| GPU（NVIDIA RTX 4070） | $600 |
| RAM増設（16GB → 32GB） | $100 |
| SSD増設（1TB） | $100 |
| **合計** | **$800** |

**投資回収期間**: 約1.4ヶ月（月$575削減の場合）

---

## 実装の難易度

| 代替案 | 難易度 | セットアップ時間 | 推奨レベル |
|--------|--------|----------------|-----------|
| Ollama（ローカルLLM） | ★★☆☆☆ | 30分 | 初級〜中級 |
| faster-whisper（ローカル） | ★★★☆☆ | 1時間 | 中級 |
| MinIO（ローカルS3） | ★★☆☆☆ | 30分 | 初級〜中級 |
| SQLite（ローカルDB） | ★☆☆☆☆ | 10分 | 初級 |
| PostgreSQL（ローカルDB） | ★★☆☆☆ | 30分 | 初級〜中級 |
| NextAuth.js（認証） | ★★★☆☆ | 1時間 | 中級 |
| OpenRouter（API） | ★☆☆☆☆ | 10分 | 初級 |
| Groq（API） | ★☆☆☆☆ | 10分 | 初級 |
| Cloudflare R2（ストレージ） | ★★☆☆☆ | 30分 | 初級〜中級 |
| Supabase（DB） | ★☆☆☆☆ | 10分 | 初級 |

---

## 推奨構成

### 構成1: 完全ローカル（コスト: $0/月）

**対象**: 個人開発、プライバシー重視、高性能PCあり

| 機能 | 技術 |
|------|------|
| テキスト生成 | Ollama + Llama 3.1 8B |
| 音声文字起こし | faster-whisper |
| 画像認識 | Ollama + Llama 3.2 Vision |
| ストレージ | ローカルファイルシステム |
| データベース | PostgreSQL（ローカル） |
| 認証 | NextAuth.js |
| ベクトルDB | ChromaDB（現状維持） |

**必要スペック**:
- CPU: 8コア以上
- RAM: 32GB以上
- GPU: NVIDIA RTX 4070以上（VRAM 12GB以上）
- SSD: 1TB以上

**メリット**:
- 完全無料
- データがローカルに留まる
- API制限なし

**デメリット**:
- 初期投資が必要（$800程度）
- セットアップに時間がかかる
- 品質がGPT-4より劣る可能性

### 構成2: ハイブリッド（コスト: $30-50/月）

**対象**: スタートアップ、品質とコストのバランス重視

| 機能 | 技術 |
|------|------|
| テキスト生成 | OpenRouter + Claude 3.5 Sonnet |
| 音声文字起こし | Groq + Whisper Large v3 |
| 画像認識 | Google Gemini Flash |
| ストレージ | Cloudflare R2 |
| データベース | Supabase |
| 認証 | Clerk |
| ベクトルDB | ChromaDB（現状維持） |

**メリット**:
- 低コスト（現状の90%削減）
- セットアップが簡単
- 品質が高い

**デメリット**:
- 月額費用がかかる
- API制限がある

### 構成3: 低コストクラウド（コスト: $10-20/月）

**対象**: 小規模ビジネス、最小コストで運用

| 機能 | 技術 |
|------|------|
| テキスト生成 | Groq + Llama 3.1 8B |
| 音声文字起こし | Groq + Whisper Large v3 |
| 画像認識 | Google Gemini Flash（無料枠） |
| ストレージ | Cloudflare R2 |
| データベース | Supabase（無料枠） |
| 認証 | Clerk（無料枠） |
| ベクトルDB | ChromaDB（現状維持） |

**メリット**:
- 超低コスト（現状の95%削減）
- セットアップが簡単
- 無料枠が大きい

**デメリット**:
- 品質がGPT-4より劣る
- 無料枠を超えると課金

---

## 実装ガイド

### 構成1: 完全ローカルの実装手順

#### ステップ1: Ollamaのインストール

```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# https://ollama.ai/download からインストーラーをダウンロード

# モデルのダウンロード
ollama pull llama3.1:8b
ollama pull llama3.2-vision:11b
```

#### ステップ2: faster-whisperのインストール

```bash
# Python環境の作成
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# faster-whisperのインストール
pip install faster-whisper

# モデルのダウンロード（自動）
```

#### ステップ3: PostgreSQLのインストール

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt install postgresql-15
sudo systemctl start postgresql

# Windows
# https://www.postgresql.org/download/windows/ からインストーラーをダウンロード

# データベースの作成
createdb youtube_analyzer
```

#### ステップ4: コードの変更

**server/_core/llm.ts**を変更:
```typescript
import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://localhost:11434' });

export async function invokeLLM(params: any) {
  const response = await ollama.chat({
    model: 'llama3.1:8b',
    messages: params.messages,
  });
  
  return {
    choices: [
      {
        message: {
          content: response.message.content,
        },
      },
    ],
  };
}
```

**server/_core/voiceTranscription.ts**を変更:
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function transcribeAudio(params: any) {
  const { stdout } = await execAsync(
    `python3 scripts/transcribe.py ${params.audioUrl}`
  );
  
  return JSON.parse(stdout);
}
```

**scripts/transcribe.py**を作成:
```python
import sys
from faster_whisper import WhisperModel

model = WhisperModel("large-v3", device="cuda", compute_type="float16")

audio_path = sys.argv[1]
segments, info = model.transcribe(audio_path, language="ja")

result = {
    "text": "",
    "segments": []
}

for segment in segments:
    result["text"] += segment.text + " "
    result["segments"].append({
        "start": segment.start,
        "end": segment.end,
        "text": segment.text
    })

print(json.dumps(result))
```

**server/storage.ts**を変更:
```typescript
import fs from 'fs/promises';
import path from 'path';

export async function storagePut(
  key: string,
  data: Buffer | string,
  contentType?: string
) {
  const fullPath = path.join(process.cwd(), 'uploads', key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, data);
  
  return {
    key,
    url: `/uploads/${key}`,
  };
}

export async function storageGet(key: string) {
  return {
    key,
    url: `/uploads/${key}`,
  };
}
```

**.env**を変更:
```bash
# PostgreSQLに変更
DATABASE_URL=postgresql://localhost:5432/youtube_analyzer

# Manus関連の環境変数は削除（または空にする）
# BUILT_IN_FORGE_API_KEY=
# BUILT_IN_FORGE_API_URL=
```

---

### 構成2: ハイブリッドの実装手順

#### ステップ1: OpenRouterのAPIキーを取得

1. [OpenRouter](https://openrouter.ai/)にアクセス
2. アカウントを作成
3. APIキーを取得

#### ステップ2: GroqのAPIキーを取得

1. [Groq](https://console.groq.com/)にアクセス
2. アカウントを作成
3. APIキーを取得

#### ステップ3: Google Gemini APIキーを取得

1. [Google AI Studio](https://aistudio.google.com/)にアクセス
2. APIキーを取得

#### ステップ4: Cloudflare R2のセットアップ

1. [Cloudflare](https://www.cloudflare.com/)にアクセス
2. R2を有効化
3. APIキーを取得

#### ステップ5: Supabaseのセットアップ

1. [Supabase](https://supabase.com/)にアクセス
2. プロジェクトを作成
3. データベースURLを取得

#### ステップ6: コードの変更

**server/_core/llm.ts**を変更:
```typescript
import OpenAI from 'openai';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function invokeLLM(params: any) {
  return await openrouter.chat.completions.create({
    model: 'anthropic/claude-3.5-sonnet',
    messages: params.messages,
  });
}
```

**server/_core/voiceTranscription.ts**を変更:
```typescript
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function transcribeAudio(params: any) {
  const response = await fetch(params.audioUrl);
  const audioBuffer = await response.arrayBuffer();
  
  const transcription = await groq.audio.transcriptions.create({
    file: new File([audioBuffer], 'audio.mp3'),
    model: 'whisper-large-v3',
    language: params.language || 'ja',
  });
  
  return {
    text: transcription.text,
  };
}
```

**server/storage.ts**を変更:
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export async function storagePut(
  key: string,
  data: Buffer | string,
  contentType?: string
) {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: data,
    ContentType: contentType,
  }));
  
  return {
    key,
    url: `https://${process.env.R2_PUBLIC_URL}/${key}`,
  };
}
```

**.env**を変更:
```bash
# OpenRouter
OPENROUTER_API_KEY=your-openrouter-api-key

# Groq
GROQ_API_KEY=your-groq-api-key

# Google Gemini
GOOGLE_API_KEY=your-google-api-key

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=your-public-url

# Supabase
DATABASE_URL=your-supabase-database-url
```

---

## まとめ

ローカル開発環境でYouTube動画分析アプリを動かす場合、以下の3つの構成から選択できます：

1. **完全ローカル**: 初期投資$800、月額$0、GPUが必要
2. **ハイブリッド**: 初期投資$0、月額$30-50、品質とコストのバランス
3. **低コストクラウド**: 初期投資$0、月額$10-20、最小コスト

どの構成を選択するかは、予算、技術レベル、品質要件によって異なります。個人開発であれば完全ローカル、スタートアップであればハイブリッド、小規模ビジネスであれば低コストクラウドがおすすめです。

---

**作成者**: Manus AI  
**最終更新日**: 2025年11月17日
