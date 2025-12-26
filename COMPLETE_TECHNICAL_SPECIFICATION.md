# YouTube動画分析アプリ 完全技術仕様書

**作成者**: Manus AI  
**最終更新日**: 2025年11月19日  
**目的**: 本ドキュメントを読むことで、全機能を完全に再構築できるレベルの詳細を提供します。

---

## 目次

1. [システム全体像](#1-システム全体像)
2. [動画分析機能](#2-動画分析機能)
3. [分析履歴機能](#3-分析履歴機能)
4. [ダッシュボード機能](#4-ダッシュボード機能)
5. [RAG機能](#5-rag機能)
6. [SEO記事生成機能](#6-seo記事生成機能)
7. [動画生成機能](#7-動画生成機能)
8. [データベーススキーマ](#8-データベーススキーマ)
9. [API仕様](#9-api仕様)
10. [デプロイメント](#10-デプロイメント)

---

## 1. システム全体像

### 1.1 アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                        フロントエンド                          │
│  React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui + tRPC │
└─────────────────────────────────────────────────────────────┘
                              ↓ tRPC (HTTP/WebSocket)
┌─────────────────────────────────────────────────────────────┐
│                        バックエンド                            │
│         Node.js 22 + Express 4 + tRPC 11 + Drizzle ORM     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 動画分析      │  │ SEO記事生成  │  │ 動画生成      │      │
│  │ yt-dlp       │  │ バックグラウンド│  │ Puppeteer    │      │
│  │ Whisper API  │  │ ジョブ        │  │ VoiceVox     │      │
│  │ GPT-4 Vision │  │ GPT-4        │  │ ffmpeg       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        データ層                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ MySQL/TiDB   │  │ AWS S3       │  │ Manus APIs   │      │
│  │ (Drizzle ORM)│  │ (ファイル保存)│  │ (LLM, Whisper)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技術スタック

| レイヤー | 技術 | バージョン | 用途 |
|---------|------|----------|------|
| **フロントエンド** | React | 19 | UIフレームワーク |
| | TypeScript | 5.x | 型安全性 |
| | Tailwind CSS | 4 | スタイリング |
| | shadcn/ui | latest | UIコンポーネント |
| | tRPC | 11 | 型安全なAPI通信 |
| | wouter | latest | ルーティング |
| **バックエンド** | Node.js | 22 | ランタイム |
| | Express | 4 | Webサーバー |
| | tRPC | 11 | API層 |
| | Drizzle ORM | latest | データベースORM |
| **AI・機械学習** | GPT-4 | latest | テキスト生成、分析 |
| | GPT-4 Vision | latest | 映像分析 |
| | Whisper API | latest | 音声文字起こし |
| | VoiceVox | latest | 音声合成 |
| **動画処理** | yt-dlp | latest | YouTube動画ダウンロード |
| | ffmpeg | latest | 動画・音声処理 |
| | Puppeteer | latest | スライド画像生成 |
| **ストレージ** | AWS S3 | - | ファイル保存 |
| | CloudFront | - | CDN |
| **データベース** | MySQL/TiDB | 8.x | リレーショナルDB |
| **認証** | Manus OAuth | - | ユーザー認証 |
| | JWT | - | セッション管理 |

### 1.3 ディレクトリ構造

```
youtube-video-analyzer/
├── client/                    # フロントエンド
│   ├── public/               # 静的ファイル
│   └── src/
│       ├── pages/            # ページコンポーネント
│       │   ├── Home.tsx
│       │   ├── VideoAnalysis.tsx
│       │   ├── AnalysisHistory.tsx
│       │   ├── Dashboard.tsx
│       │   ├── RAG.tsx
│       │   ├── SEOArticle.tsx
│       │   └── VideoGeneration.tsx
│       ├── components/       # 再利用可能なコンポーネント
│       ├── lib/              # ユーティリティ
│       │   └── trpc.ts       # tRPCクライアント
│       └── App.tsx           # ルーティング
├── server/                   # バックエンド
│   ├── _core/                # コア機能
│   │   ├── llm.ts            # LLM API
│   │   ├── voiceTranscription.ts  # Whisper API
│   │   └── ...
│   ├── db.ts                 # データベースヘルパー
│   ├── routers.ts            # tRPCルーター
│   ├── videoProcessor.ts     # 動画分析
│   ├── ragWithTags.ts        # RAG機能
│   ├── seoArticleGenerator.ts # SEO記事生成
│   ├── seoArticleJobProcessor.ts # SEO記事ジョブ
│   ├── videoGenerator.ts     # 動画生成
│   ├── videoComposer.ts      # 動画合成
│   ├── videoRenderer.ts      # 動画レンダリング
│   └── voicevoxClient.ts     # VoiceVox API
├── drizzle/                  # データベーススキーマ
│   └── schema.ts
├── shared/                   # 共有型定義
└── storage/                  # S3ヘルパー
```

---

## 2. 動画分析機能

**詳細ドキュメント**: `VIDEO_ANALYSIS_DEEP_DIVE.md`を参照

### 2.1 処理フロー

```
[YouTube URL入力]
    ↓
[yt-dlpで動画・音声ダウンロード]
    ↓
[音声文字起こし（Whisper API）]
    ├─ 15MB以下: そのまま処理
    └─ 15MB超過: 10分ごとにチャンク分割
    ↓
[フレーム抽出（ffmpeg）]
    ├─ 60秒間隔で最大15フレーム
    └─ 640x360にリサイズ
    ↓
[映像分析（GPT-4 Vision）]
    ├─ 映像内容の説明
    └─ コード検出（JSON Schema）
    ↓
[学習ポイント抽出（GPT-4）]
    ↓
[データベースに保存]
```

### 2.2 主要コンポーネント

#### 2.2.1 動画ダウンロード（yt-dlp）

**コマンド**:
```bash
# 動画ダウンロード
yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" -o "${videoPath}" "${videoUrl}"

# 音声ダウンロード（低音質優先）
yt-dlp -f "worstaudio[ext=m4a]/worstaudio/bestaudio[ext=m4a]/bestaudio" -o "${m4aPath}" "${videoUrl}"
```

**最適化ポイント**:
- 音声は`worstaudio`を優先（文字起こしには高音質不要）
- ffmpegでの音声抽出を避ける（メモリ削減）
- M4A形式のまま保存（Whisper APIはM4Aを受け付ける）

#### 2.2.2 音声文字起こし（Whisper API）

**チャンク分割戦略**:
```typescript
if (audioSizeMB > 15) {
  // 10分（600秒）ごとにチャンク分割
  const chunkPaths = await splitAudioFile(audioPath, chunkDir, 600);
  
  // 各チャンクを順次処理
  for (let i = 0; i < chunkPaths.length; i++) {
    const result = await transcribeAudio({ audioUrl, language: "ja" });
    
    // タイムスタンプを累積時間で調整
    const chunkSegments = result.segments.map(seg => ({
      start: Math.floor(seg.start) + cumulativeTime,
      end: Math.ceil(seg.end) + cumulativeTime,
      text: seg.text.trim(),
    }));
  }
}
```

**リトライ戦略**:
- 最大3回リトライ
- 指数バックオフ（2秒、4秒、6秒）
- タイムアウト: 180秒（3分）

#### 2.2.3 フレーム抽出（ffmpeg）

**コマンド**:
```bash
ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -s 640x360 -y "${framePath}"
```

**最適化ポイント**:
- 1フレームずつ抽出（メモリ効率化）
- 640x360にリサイズ（LLM処理高速化）
- 最大15フレームまで（コスト削減）

#### 2.2.4 映像分析（GPT-4 Vision）

**2段階分析**:
1. **第1段階**: 映像全体の説明
   ```typescript
   const response = await invokeLLM({
     messages: [{
       role: "user",
       content: [
         { type: "image_url", image_url: { url: frameUrl, detail: "high" } },
         { type: "text", text: "この画面に何が表示されていますか?" },
       ],
     }],
   });
   ```

2. **第2段階**: コード検出（JSON Schema）
   ```typescript
   const codeDetectionResponse = await invokeLLM({
     response_format: {
       type: "json_schema",
       json_schema: {
         schema: {
           properties: {
             hasCode: { type: "boolean" },
             codeContent: { type: "string" },
             codeExplanation: { type: "string" },
           },
         },
       },
     },
   });
   ```

---

## 3. 分析履歴機能

### 3.1 処理フロー

```
[分析履歴一覧表示]
    ↓
[フィルタリング・ソート]
    ├─ 日付範囲
    ├─ タイトル検索
    └─ ソート（作成日時、タイトル）
    ↓
[詳細表示]
    ├─ 文字起こしセグメント
    ├─ フレーム分析
    └─ 学習ポイント
    ↓
[エクスポート]
    ├─ PDF（PDFKit）
    ├─ Markdown
    └─ 共有URL
```

### 3.2 PDFエクスポート（PDFKit）

**実装例**:
```typescript
import PDFDocument from "pdfkit";

export async function exportAnalysisToPDF(analysis: VideoAnalysis): Promise<Buffer> {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  
  doc.on("data", (chunk) => chunks.push(chunk));
  
  // タイトル
  doc.fontSize(20).text(analysis.title, { align: "center" });
  doc.moveDown();
  
  // 文字起こし
  doc.fontSize(16).text("文字起こし");
  doc.fontSize(12).text(analysis.transcription);
  doc.moveDown();
  
  // フレーム分析
  doc.fontSize(16).text("映像分析");
  for (const frame of analysis.frameAnalyses) {
    doc.fontSize(12).text(`[${frame.timestamp}s] ${frame.visualDescription}`);
    doc.moveDown();
  }
  
  doc.end();
  
  return Buffer.concat(chunks);
}
```

### 3.3 共有URL機能

**データベーススキーマ**:
```typescript
export const videoAnalyses = mysqlTable("videoAnalyses", {
  id: int("id").autoincrement().primaryKey(),
  isPublic: boolean("isPublic").default(false).notNull(),
  shareToken: varchar("shareToken", { length: 64 }).unique(),
  // ...
});
```

**共有URL生成**:
```typescript
const shareToken = randomBytes(32).toString("hex");
await db.update(videoAnalyses)
  .set({ isPublic: true, shareToken })
  .where(eq(videoAnalyses.id, analysisId));

const shareUrl = `https://example.com/share/${shareToken}`;
```

---

## 4. ダッシュボード機能

### 4.1 統計情報の集計

**SQL集計クエリ**:
```typescript
// 総分析数
const totalAnalyses = await db
  .select({ count: sql`COUNT(*)` })
  .from(videoAnalyses)
  .where(eq(videoAnalyses.userId, userId));

// 月次分析数
const monthlyAnalyses = await db
  .select({ count: sql`COUNT(*)` })
  .from(videoAnalyses)
  .where(
    and(
      eq(videoAnalyses.userId, userId),
      sql`DATE(createdAt) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
    )
  );

// 最近の分析履歴
const recentAnalyses = await db
  .select()
  .from(videoAnalyses)
  .where(eq(videoAnalyses.userId, userId))
  .orderBy(desc(videoAnalyses.createdAt))
  .limit(10);
```

### 4.2 チャート表示

**フロントエンド実装（Recharts）**:
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const data = [
  { date: "2025-01-01", count: 5 },
  { date: "2025-01-02", count: 8 },
  // ...
];

<LineChart width={600} height={300} data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="count" stroke="#8884d8" />
</LineChart>
```

---

## 5. RAG機能

### 5.1 タグベースのドキュメント管理

**データベーススキーマ**:
```
tagCategories (タグカテゴリ)
    ├── id
    ├── name (genre, author, contentType, theme)
    └── displayName

tags (タグ)
    ├── id
    ├── categoryId → tagCategories.id
    ├── value
    └── displayName

ragDocuments (RAGドキュメント)
    ├── id
    ├── content
    ├── type
    ├── sourceId
    ├── successLevel (高, 中, 低)
    └── importance

ragDocumentTags (多対多リレーション)
    ├── documentId → ragDocuments.id
    └── tagId → tags.id
```

### 5.2 タグフィルタリング検索

**実装詳細**:
```typescript
export async function searchRAGWithTags(params: {
  tagFilters?: {
    genre?: string[];
    author?: string[];
    contentType?: string[];
    theme?: string[];
  };
}) {
  const db = await getDb();
  
  // 1. タグカテゴリからタグIDを取得
  const tagIds: number[] = [];
  for (const [categoryName, tagValues] of Object.entries(params.tagFilters)) {
    const [category] = await db
      .select()
      .from(tagCategories)
      .where(eq(tagCategories.name, categoryName))
      .limit(1);
    
    const categoryTags = await db
      .select()
      .from(tags)
      .where(
        and(
          eq(tags.categoryId, category.id),
          inArray(tags.value, tagValues)
        )
      );
    
    tagIds.push(...categoryTags.map(t => t.id));
  }
  
  // 2. タグIDからドキュメントIDを取得
  const documentIds = await db
    .select({ documentId: ragDocumentTags.documentId })
    .from(ragDocumentTags)
    .where(inArray(ragDocumentTags.tagId, tagIds));
  
  const uniqueDocIds = [...new Set(documentIds.map(d => d.documentId))];
  
  // 3. ドキュメントを取得
  const documents = await db
    .select()
    .from(ragDocuments)
    .where(inArray(ragDocuments.id, uniqueDocIds));
  
  return documents;
}
```

### 5.3 RAGコンテキストの生成

**実装例**:
```typescript
export async function generateRAGContext(query: string, tagFilters?: any): Promise<string> {
  const documents = await searchRAGWithTags({ tagFilters });
  
  // ドキュメントを関連度順にソート（簡易的にimportanceで）
  const sortedDocs = documents.sort((a, b) => b.importance - a.importance);
  
  // 上位10件を取得
  const topDocs = sortedDocs.slice(0, 10);
  
  // RAGコンテキストを生成
  const context = topDocs
    .map(doc => `### ${doc.type}\n${doc.content}`)
    .join('\n\n---\n\n');
  
  return context;
}
```

### 5.4 ベクトル検索への拡張（将来的な改善案）

**OpenAI Embeddingsを使った実装例**:
```typescript
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ドキュメント保存時にベクトル化
export async function saveDocumentWithEmbedding(content: string) {
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: content,
  });
  
  await db.insert(ragDocuments).values({
    content,
    embedding: JSON.stringify(embedding.data[0].embedding),
  });
}

// 検索時にコサイン類似度で検索
export async function searchByEmbedding(query: string) {
  const queryEmbedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  
  const documents = await db.select().from(ragDocuments);
  
  // コサイン類似度を計算
  const results = documents.map(doc => ({
    ...doc,
    similarity: cosineSimilarity(
      queryEmbedding.data[0].embedding,
      JSON.parse(doc.embedding)
    ),
  }));
  
  // 類似度順にソート
  return results.sort((a, b) => b.similarity - a.similarity);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
```

---

## 6. SEO記事生成機能

### 6.1 バックグラウンドジョブシステム

**ジョブステータス遷移**:
```
pending → processing → completed
                    ↓
                  failed
```

**ジョブテーブルスキーマ**:
```typescript
export const seoArticleJobs = mysqlTable("seoArticleJobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  theme: text("theme").notNull(),
  authorName: varchar("authorName", { length: 255 }).notNull(),
  targetWordCount: int("targetWordCount").default(3000).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  currentStep: int("currentStep").default(0).notNull(),
  progress: int("progress").default(0).notNull(),
  keywords: text("keywords"),
  analyses: text("analyses"),
  criteria: text("criteria"),
  structure: text("structure"),
  article: text("article"),
  qualityCheck: text("qualityCheck"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

### 6.2 処理ステップ

**全7ステップ**:
1. **テーマ確認** (0-10%)
2. **検索キーワード生成** (10-20%)
3. **上位記事分析** (20-50%)
4. **SEO基準作成** (50-60%)
5. **記事構成生成** (60-70%)
6. **記事本文生成** (70-90%)
7. **品質チェック** (90-100%)

**実装例**:
```typescript
export async function processSeoArticleJob(jobId: number): Promise<void> {
  // Step 1: テーマ確認
  await updateSeoArticleJob(jobId, {
    status: "processing",
    currentStep: 1,
    progress: 10,
  });
  
  // Step 1.5: キーワード分離
  const { conclusionKeywords, trafficKeywords } = await separateKeywords(job.theme);
  
  // Step 2: 検索キーワード生成
  const keywords = await generateSearchKeywords(trafficKeywords);
  await updateSeoArticleJob(jobId, {
    keywords: JSON.stringify({ conclusionKeywords, trafficKeywords, searchKeywords: keywords }),
    currentStep: 2,
    progress: 20,
  });
  
  // Step 3: 上位記事分析
  const allAnalyses = [];
  for (let i = 0; i < keywords.length; i++) {
    const analyses = await analyzeTopArticles(keywords[i], keywords);
    allAnalyses.push(...analyses);
    
    const keywordProgress = Math.floor(30 * (i + 1) / keywords.length);
    await updateSeoArticleJob(jobId, {
      progress: 20 + keywordProgress,
    });
  }
  
  // Step 3.5: 読者の痛み・報われない希望を抽出
  const { painPoints, realVoices } = await extractPainPoints(job.theme, allAnalyses);
  
  // Step 3.6: 苦労したエピソードに繋げやすいキーワード生成
  const { storyKeywords } = await generateStoryKeywords(painPoints, trafficKeywords, job.authorName);
  
  // Step 3.7: オファーへの橋渡し生成
  const { offerBridge } = await generateOfferBridge(painPoints, storyKeywords, conclusionKeywords, job.authorName);
  
  // RAGドキュメントを取得
  const ragDocs = await getRagDocumentsByAuthor(job.authorName);
  const ragContext = generateRagContext(ragDocs, allAnalyses, painPoints, realVoices, storyKeywords, offerBridge);
  
  // Step 4: SEO基準作成
  const criteria = await createSEOCriteria(allAnalyses, job.targetWordCount);
  await updateSeoArticleJob(jobId, {
    criteria: JSON.stringify(criteria),
    currentStep: 4,
    progress: 60,
  });
  
  // Step 5: 記事構成生成
  const structure = await createArticleStructure(job.theme, criteria, ragContext, job.authorName, painPoints, storyKeywords, offerBridge);
  await updateSeoArticleJob(jobId, {
    structure: JSON.stringify(structure),
    currentStep: 5,
    progress: 70,
  });
  
  // Step 6: 記事本文生成
  const article = await generateSEOArticle(structure, criteria, ragContext, job.authorName);
  await updateSeoArticleJob(jobId, {
    article,
    currentStep: 6,
    progress: 90,
  });
  
  // Step 7: 品質チェック
  const qualityCheck = await checkArticleQuality(article, criteria);
  await updateSeoArticleJob(jobId, {
    qualityCheck: JSON.stringify(qualityCheck),
    currentStep: 7,
    progress: 100,
    status: "completed",
  });
}
```

### 6.3 JSON Schema構造

**記事構成（ArticleStructure）**:
```json
{
  "title": "記事タイトル",
  "metaDescription": "メタディスクリプション",
  "h2Sections": [
    {
      "h2Title": "H2見出し",
      "h3Subsections": [
        {
          "h3Title": "H3見出し",
          "contentPoints": ["ポイント1", "ポイント2"]
        }
      ]
    }
  ]
}
```

**SEO基準（SEOCriteria）**:
```json
{
  "keywords": {
    "キーワード1": { "target": 5, "density": 0.02 },
    "キーワード2": { "target": 3, "density": 0.01 }
  },
  "targetWordCount": 3000,
  "minH2Count": 5,
  "minH3Count": 10
}
```

### 6.4 ポーリング戦略

**フロントエンド実装**:
```tsx
const { data: job } = trpc.seoArticle.getJob.useQuery(
  { jobId },
  {
    refetchInterval: (data) => {
      // 完了またはエラーの場合はポーリング停止
      if (data?.status === "completed" || data?.status === "failed") {
        return false;
      }
      // 処理中は3秒ごとにポーリング
      return 3000;
    },
  }
);
```

---

## 7. 動画生成機能

### 7.1 処理フロー

```
[テーマ入力]
    ↓
[ベンチマーク動画検索・分析]
    ├─ YouTube検索（yt-dlp）
    ├─ 動画分析（Whisper + GPT-4 Vision）
    └─ 構成パターン抽出（Hook-Problem-Solution-CTA）
    ↓
[RAG保存]
    ↓
[戦略設計]
    ├─ RAGドキュメント参照
    ├─ ターゲットオーディエンス分析
    └─ コンテンツ戦略生成
    ↓
[シナリオ生成]
    ├─ スライド構成（Hook-Problem-Solution-CTA）
    ├─ ナレーションスクリプト
    └─ 各スライドの表示時間
    ↓
[スライド画像生成（Puppeteer）]
    ├─ HTMLテンプレート生成
    ├─ スクリーンショット撮影
    └─ S3アップロード
    ↓
[音声合成（VoiceVox）]
    ├─ ナレーションスクリプトを音声化
    ├─ 話者ID、速度、ピッチ調整
    └─ MP3ファイル生成
    ↓
[動画合成（ffmpeg）]
    ├─ スライド画像 + 音声を結合
    ├─ トランジション効果
    └─ MP4ファイル生成
    ↓
[S3アップロード]
```

### 7.2 ベンチマーク動画分析

**YouTube検索**:
```typescript
import { google } from "googleapis";

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

const searchResults = await youtube.search.list({
  part: ["snippet"],
  q: theme,
  type: ["video"],
  maxResults: 5,
  order: "viewCount",
});
```

**構成パターン抽出**:
```typescript
const pattern = await invokeLLM({
  messages: [{
    role: "user",
    content: `以下の動画分析結果から、構成パターンを抽出してください:\n\n${analysisResult}`,
  }],
  response_format: {
    type: "json_schema",
    json_schema: {
      schema: {
        properties: {
          hook: { type: "string", description: "冒頭のフック" },
          problem: { type: "string", description: "問題提起" },
          solution: { type: "string", description: "解決策" },
          cta: { type: "string", description: "行動喚起" },
        },
      },
    },
  },
});
```

### 7.3 スライド画像生成（Puppeteer）

**HTMLテンプレート**:
```typescript
function generateSlideHTML(slide: Slide): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      width: 1920px;
      height: 1080px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: 'Noto Sans JP', sans-serif;
      padding: 80px;
    }
    
    .slide-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: white;
      border-radius: 20px;
      padding: 80px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    
    h1 {
      font-size: 72px;
      font-weight: bold;
      color: #2d3748;
      margin-bottom: 60px;
      text-align: center;
    }
    
    .content-item {
      font-size: 48px;
      color: #4a5568;
      margin-bottom: 40px;
      padding-left: 40px;
      position: relative;
    }
    
    .content-item::before {
      content: "•";
      position: absolute;
      left: 0;
      color: #667eea;
      font-weight: bold;
      font-size: 60px;
    }
  </style>
</head>
<body>
  <div class="slide-container">
    <h1>${slide.title}</h1>
    <div class="content">
      ${slide.content.map(item => `<div class="content-item">${item}</div>`).join('')}
    </div>
  </div>
</body>
</html>
  `;
}
```

**スクリーンショット撮影**:
```typescript
const browser = await puppeteer.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

for (const slide of slides) {
  const html = generateSlideHTML(slide);
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  
  const screenshot = await page.screenshot({
    type: "png",
    fullPage: false,
  });
  
  const { url } = await storagePut(
    `video-slides/slide-${slide.slideNumber}.png`,
    screenshot,
    "image/png"
  );
  
  slideImages.push({ imageUrl: url, duration: slide.duration });
}

await browser.close();
```

### 7.4 音声合成（VoiceVox）

**VoiceVox API呼び出し**:
```typescript
export async function generateSpeech(params: {
  text: string;
  speakerId: number;
  speedScale?: number;
  pitchScale?: number;
}): Promise<Buffer> {
  const { text, speakerId, speedScale = 1.0, pitchScale = 0.0 } = params;
  
  // Step 1: 音声合成クエリを生成
  const queryResponse = await fetch(
    `http://localhost:50021/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
    { method: "POST" }
  );
  const query = await queryResponse.json();
  
  // Step 2: 速度・ピッチを調整
  query.speedScale = speedScale;
  query.pitchScale = pitchScale;
  
  // Step 3: 音声合成
  const synthesisResponse = await fetch(
    `http://localhost:50021/synthesis?speaker=${speakerId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    }
  );
  
  const audioBuffer = Buffer.from(await synthesisResponse.arrayBuffer());
  return audioBuffer;
}
```

**話者ID一覧**:
| ID | 話者名 | 特徴 |
|----|--------|------|
| 0 | 四国めたん（ノーマル） | 標準的な女性声 |
| 1 | ずんだもん（ノーマル） | 可愛らしい声 |
| 2 | 春日部つむぎ（ノーマル） | 落ち着いた女性声 |
| 3 | 雨晴はう（ノーマル） | 明るい女性声 |
| 8 | 青山龍星（ノーマル） | 男性声 |

### 7.5 動画合成（ffmpeg）

**ffmpegコマンド生成**:
```typescript
export async function renderVideo(params: {
  slides: Array<{ imageUrl: string; duration: number }>;
  audioUrl: string;
}): Promise<string> {
  const { slides, audioUrl } = params;
  
  // 1. 画像をダウンロード
  const imagePaths = await Promise.all(
    slides.map(async (slide, i) => {
      const response = await fetch(slide.imageUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const imagePath = `/tmp/slide-${i}.png`;
      await fs.writeFile(imagePath, buffer);
      return imagePath;
    })
  );
  
  // 2. 音声をダウンロード
  const audioResponse = await fetch(audioUrl);
  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
  const audioPath = "/tmp/audio.mp3";
  await fs.writeFile(audioPath, audioBuffer);
  
  // 3. ffmpegコマンドを生成
  const filterComplex = slides
    .map((slide, i) => {
      const prevDuration = slides.slice(0, i).reduce((sum, s) => sum + s.duration, 0);
      return `[${i}:v]setpts=PTS-STARTPTS+${prevDuration}/TB[v${i}]`;
    })
    .join(';');
  
  const concatFilter = slides.map((_, i) => `[v${i}]`).join('') + `concat=n=${slides.length}:v=1:a=0[outv]`;
  
  const cmd = `ffmpeg ${imagePaths.map((p, i) => `-loop 1 -t ${slides[i].duration} -i ${p}`).join(' ')} -i ${audioPath} -filter_complex "${filterComplex};${concatFilter}" -map "[outv]" -map ${slides.length}:a -c:v libx264 -c:a aac -shortest /tmp/output.mp4`;
  
  // 4. ffmpegを実行
  await execAsync(cmd);
  
  // 5. S3にアップロード
  const videoBuffer = await fs.readFile("/tmp/output.mp4");
  const { url } = await storagePut(
    `videos/${Date.now()}.mp4`,
    videoBuffer,
    "video/mp4"
  );
  
  return url;
}
```

**トランジション効果**:
```bash
# クロスフェード（1秒）
ffmpeg -i slide1.png -i slide2.png -filter_complex "
  [0:v]fade=t=out:st=4:d=1[v0];
  [1:v]fade=t=in:st=0:d=1[v1];
  [v0][v1]overlay
" output.mp4
```

---

## 8. データベーススキーマ

### 8.1 ER図

```
users (ユーザー)
  ├── id (PK)
  ├── openId (Manus OAuth ID)
  ├── name
  ├── email
  ├── role (admin, user)
  └── createdAt

videoAnalyses (動画分析)
  ├── id (PK)
  ├── userId (FK → users.id)
  ├── videoId (YouTube ID)
  ├── title
  ├── transcription (全文)
  ├── summary
  ├── learningPoints
  ├── isPublic
  ├── shareToken
  └── createdAt

timelineSegments (タイムラインセグメント)
  ├── id (PK)
  ├── analysisId (FK → videoAnalyses.id)
  ├── startTime
  ├── endTime
  ├── text
  └── type (transcription, frame)

frameAnalyses (フレーム分析)
  ├── id (PK)
  ├── analysisId (FK → videoAnalyses.id)
  ├── timestamp
  ├── frameUrl
  ├── visualDescription
  ├── codeContent
  └── codeExplanation

tagCategories (タグカテゴリ)
  ├── id (PK)
  ├── name (genre, author, contentType, theme)
  └── displayName

tags (タグ)
  ├── id (PK)
  ├── categoryId (FK → tagCategories.id)
  ├── value
  └── displayName

ragDocuments (RAGドキュメント)
  ├── id (PK)
  ├── content
  ├── type
  ├── sourceId
  ├── successLevel (高, 中, 低)
  ├── importance
  ├── pickedUp
  └── createdAt

ragDocumentTags (ドキュメント-タグ関連)
  ├── documentId (FK → ragDocuments.id)
  └── tagId (FK → tags.id)

seoArticleJobs (SEO記事生成ジョブ)
  ├── id (PK)
  ├── userId (FK → users.id)
  ├── theme
  ├── authorName
  ├── targetWordCount
  ├── status (pending, processing, completed, failed)
  ├── currentStep
  ├── progress
  ├── keywords (JSON)
  ├── analyses (JSON)
  ├── criteria (JSON)
  ├── structure (JSON)
  ├── article (TEXT)
  ├── qualityCheck (JSON)
  └── createdAt

videoGenerationJobs (動画生成ジョブ)
  ├── id (PK)
  ├── userId (FK → users.id)
  ├── theme
  ├── speakerId
  ├── status (pending, processing, completed, failed)
  ├── currentStep
  ├── progress
  ├── benchmarkAnalysisId
  ├── strategyId
  ├── scenarioId
  ├── videoUrl
  └── createdAt
```

### 8.2 インデックス設計

**パフォーマンス最適化のためのインデックス**:
```sql
-- videoAnalyses
CREATE INDEX idx_videoAnalyses_userId ON videoAnalyses(userId);
CREATE INDEX idx_videoAnalyses_shareToken ON videoAnalyses(shareToken);
CREATE INDEX idx_videoAnalyses_createdAt ON videoAnalyses(createdAt);

-- timelineSegments
CREATE INDEX idx_timelineSegments_analysisId ON timelineSegments(analysisId);

-- frameAnalyses
CREATE INDEX idx_frameAnalyses_analysisId ON frameAnalyses(analysisId);

-- ragDocumentTags
CREATE INDEX idx_ragDocumentTags_documentId ON ragDocumentTags(documentId);
CREATE INDEX idx_ragDocumentTags_tagId ON ragDocumentTags(tagId);

-- seoArticleJobs
CREATE INDEX idx_seoArticleJobs_userId ON seoArticleJobs(userId);
CREATE INDEX idx_seoArticleJobs_status ON seoArticleJobs(status);

-- videoGenerationJobs
CREATE INDEX idx_videoGenerationJobs_userId ON videoGenerationJobs(userId);
CREATE INDEX idx_videoGenerationJobs_status ON videoGenerationJobs(status);
```

---

## 9. API仕様

### 9.1 tRPCルーター構造

```typescript
export const appRouter = router({
  auth: router({
    me: publicProcedure.query(),
    logout: publicProcedure.mutation(),
  }),
  
  videoAnalysis: router({
    analyze: protectedProcedure
      .input(z.object({ videoUrl: z.string() }))
      .mutation(),
    list: protectedProcedure.query(),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(),
    exportPDF: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(),
    share: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(),
  }),
  
  dashboard: router({
    stats: protectedProcedure.query(),
    recentAnalyses: protectedProcedure.query(),
  }),
  
  rag: router({
    save: protectedProcedure
      .input(z.object({
        content: z.string(),
        type: z.string(),
        tags: z.object({
          genre: z.array(z.string()).optional(),
          author: z.array(z.string()).optional(),
        }),
      }))
      .mutation(),
    search: protectedProcedure
      .input(z.object({
        query: z.string().optional(),
        tagFilters: z.object({
          genre: z.array(z.string()).optional(),
        }).optional(),
      }))
      .query(),
  }),
  
  seoArticle: router({
    createJob: protectedProcedure
      .input(z.object({
        theme: z.string(),
        authorName: z.string(),
        targetWordCount: z.number(),
      }))
      .mutation(),
    getJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(),
    listJobs: protectedProcedure.query(),
  }),
  
  videoGeneration: router({
    createJob: protectedProcedure
      .input(z.object({
        theme: z.string(),
        speakerId: z.number(),
      }))
      .mutation(),
    getJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(),
    listJobs: protectedProcedure.query(),
  }),
});
```

---

## 10. デプロイメント

### 10.1 環境変数

**必須環境変数**:
```bash
# データベース
DATABASE_URL=mysql://user:password@host:port/database

# Manus OAuth
JWT_SECRET=your-jwt-secret
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://login.manus.im

# Manus組み込みAPI
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-api-key

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-northeast-1
S3_BUCKET=your-bucket-name

# OpenAI (Cursor移行後)
OPENAI_API_KEY=your-openai-api-key

# VoiceVox
VOICEVOX_API_URL=http://localhost:50021
```

### 10.2 デプロイ手順

**1. 依存関係のインストール**:
```bash
pnpm install
```

**2. データベースマイグレーション**:
```bash
pnpm db:push
```

**3. ビルド**:
```bash
pnpm build
```

**4. 起動**:
```bash
pnpm start
```

### 10.3 Docker構成

**Dockerfile**:
```dockerfile
FROM node:22-alpine

WORKDIR /app

# 依存関係のインストール
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# yt-dlpのインストール
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp

# ffmpegのインストール
RUN apk add --no-cache ffmpeg

# Puppeteer依存ライブラリのインストール
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# アプリケーションコードのコピー
COPY . .

# ビルド
RUN pnpm build

# 起動
CMD ["pnpm", "start"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    depends_on:
      - db
      - voicevox
  
  db:
    image: mysql:8
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_DATABASE=youtube_analyzer
    ports:
      - "3306:3306"
    volumes:
      - db_data:/var/lib/mysql
  
  voicevox:
    image: voicevox/voicevox_engine:cpu-ubuntu20.04-latest
    ports:
      - "50021:50021"

volumes:
  db_data:
```

---

**作成者**: Manus AI  
**最終更新日**: 2025年11月19日

このドキュメントは、YouTube動画分析アプリの全機能を完全に再構築できるレベルの詳細を提供しています。
