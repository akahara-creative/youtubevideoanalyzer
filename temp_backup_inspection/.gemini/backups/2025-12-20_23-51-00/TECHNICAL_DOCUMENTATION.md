# YouTube動画分析アプリ 技術詳細ドキュメント

**作成者**: Manus AI  
**最終更新日**: 2025年11月19日

---

## 目次

1. [動画分析機能](#1-動画分析機能)
2. [分析履歴機能](#2-分析履歴機能)
3. [ダッシュボード機能](#3-ダッシュボード機能)
4. [RAG（Retrieval-Augmented Generation）機能](#4-ragretrieval-augmented-generation機能)
5. [SEO記事生成機能](#5-seo記事生成機能)
6. [動画生成機能](#6-動画生成機能)
7. [共通技術スタック](#7-共通技術スタック)

---

## 1. 動画分析機能

### 概要

YouTube動画のURLを入力すると、音声文字起こし、映像内容分析、コード認識、学習ポイント抽出を自動的に実行し、タイムライン形式で結果を表示する機能です。

### 技術アーキテクチャ

動画分析機能は、以下の4つのステップで構成されています。

#### Step 1: 動画ダウンロード

**実装ファイル**: `server/videoProcessor.ts`

YouTube動画をダウンロードするために、**yt-dlp**（YouTube-DLのフォーク）を使用しています。yt-dlpは、YouTubeだけでなく、1000以上の動画サイトに対応しており、高い安定性と柔軟性を持っています。

```typescript
async function downloadVideoAndExtractAudio(
  videoUrl: string,
  outputDir: string
): Promise<{ videoPath: string; audioPath: string; title: string }> {
  const ytDlpPath = path.join(__dirname, "yt-dlp");
  
  // 動画タイトルを取得
  const title = await new Promise<string>((resolve, reject) => {
    exec(`"${ytDlpPath}" --get-title "${videoUrl}"`, ...);
  });
  
  // 動画をダウンロード（最高品質のMP4形式）
  exec(`"${ytDlpPath}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" -o "${videoPath}" "${videoUrl}"`, ...);
  
  // 音声を抽出（MP3形式）
  exec(`"${ytDlpPath}" -x --audio-format mp3 -o "${audioPath}" "${videoUrl}"`, ...);
}
```

**技術的なポイント**:
- yt-dlpは、YouTube APIを使用せず、Webスクレイピングで動画情報を取得するため、API制限を気にする必要がありません
- `-f`オプションで動画品質を指定（`bestvideo[ext=mp4]+bestaudio[ext=m4a]`は最高品質のMP4動画とM4A音声を結合）
- `-x --audio-format mp3`で音声のみを抽出してMP3形式に変換

#### Step 2: 音声文字起こし

**実装ファイル**: `server/_core/voiceTranscription.ts`

音声文字起こしには、**OpenAI Whisper API**（Manus組み込みAPI経由）を使用しています。Whisperは、OpenAIが開発した最先端の音声認識モデルで、99言語に対応し、高い精度を誇ります。

```typescript
export async function transcribeAudio(params: {
  audioUrl: string;
  language?: string;
  prompt?: string;
}) {
  const response = await fetch(params.audioUrl);
  const audioBuffer = await response.arrayBuffer();
  
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer]), "audio.mp3");
  formData.append("model", "whisper-1");
  if (params.language) formData.append("language", params.language);
  if (params.prompt) formData.append("prompt", params.prompt);
  
  const result = await fetch(`${ENV.forgeApiUrl}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    body: formData,
  });
  
  return result.json();
}
```

**技術的なポイント**:
- Whisper APIは、タイムスタンプ付きのセグメント情報を返すため、タイムライン表示に最適
- `language`パラメータで言語を指定すると、認識精度が向上
- `prompt`パラメータで専門用語や固有名詞のヒントを与えることができる
- 16MBのファイルサイズ制限があるため、長時間動画は分割が必要

#### Step 3: フレーム抽出と映像分析

**実装ファイル**: `server/videoProcessor.ts`

動画から一定間隔でフレームを抽出し、各フレームをLLM（GPT-4 Vision）で分析します。

```typescript
async function extractFrames(
  videoPath: string,
  outputDir: string,
  interval: number = 30
): Promise<string[]> {
  const framePaths: string[] = [];
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        `-vf fps=1/${interval}`, // 30秒ごとに1フレーム抽出
      ])
      .output(path.join(outputDir, "frame-%04d.jpg"))
      .on("end", () => {
        const files = fs.readdirSync(outputDir).filter(f => f.startsWith("frame-"));
        resolve(files.map(f => path.join(outputDir, f)));
      })
      .on("error", reject)
      .run();
  });
}

async function analyzeFrame(
  frameUrl: string,
  timestamp: number
): Promise<FrameAnalysis> {
  const response = await invokeLLM({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "この画像を詳しく説明してください。プログラミングコードが含まれている場合は、コード内容とその説明も提供してください。" },
          { type: "image_url", image_url: { url: frameUrl, detail: "high" } },
        ],
      },
    ],
  });
  
  return {
    timestamp,
    visualDescription: response.choices[0].message.content,
    frameUrl,
  };
}
```

**技術的なポイント**:
- **ffmpeg**を使用してフレームを抽出（`-vf fps=1/30`で30秒ごとに1フレーム）
- GPT-4 Visionの`image_url`コンテンツタイプで画像を分析
- `detail: "high"`で高解像度分析を実行（コード認識に有効）
- フレームはS3にアップロードし、公開URLをLLMに渡す

#### Step 4: 学習ポイント抽出

**実装ファイル**: `server/videoProcessor.ts`

文字起こし結果とフレーム分析結果を統合し、LLMで学習ポイントを抽出します。

```typescript
async function extractLearningPoints(
  transcription: string,
  frameAnalyses: FrameAnalysis[]
): Promise<string[]> {
  const prompt = `
以下は動画の文字起こしと映像分析結果です。この動画から学べる重要なポイントを5つ抽出してください。

**文字起こし:**
${transcription}

**映像分析:**
${frameAnalyses.map(f => `[${f.timestamp}s] ${f.visualDescription}`).join("\n")}

**出力形式:**
1. ポイント1
2. ポイント2
...
`;
  
  const response = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
  });
  
  return response.choices[0].message.content.split("\n").filter(line => /^\d+\./.test(line));
}
```

**技術的なポイント**:
- 文字起こしとフレーム分析を統合することで、音声と映像の両方から学習ポイントを抽出
- LLMのコンテキストウィンドウ（128K tokens）内に収まるように、長時間動画は要約が必要

### データベーススキーマ

**テーブル**: `videoAnalyses`, `timelineSegments`

```typescript
export const videoAnalyses = mysqlTable("videoAnalyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  videoUrl: varchar("videoUrl", { length: 500 }).notNull(),
  videoId: varchar("videoId", { length: 100 }).notNull(),
  title: text("title").notNull(),
  transcription: longtext("transcription"),
  learningPoints: json("learningPoints").$type<string[]>(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const timelineSegments = mysqlTable("timelineSegments", {
  id: int("id").autoincrement().primaryKey(),
  analysisId: int("analysisId").notNull(),
  timestamp: int("timestamp").notNull(), // 秒単位
  type: mysqlEnum("type", ["transcription", "frame", "code"]).notNull(),
  content: text("content").notNull(),
  frameUrl: varchar("frameUrl", { length: 500 }),
  codeContent: text("codeContent"),
  codeExplanation: text("codeExplanation"),
});
```

**リレーション**:
- `videoAnalyses` ← `timelineSegments` (1対多)
- `videoAnalyses.userId` → `users.id` (多対1)

### フロントエンド実装

**ファイル**: `client/src/pages/Analysis.tsx`

```typescript
export default function Analysis() {
  const [videoUrl, setVideoUrl] = useState("");
  const analyzeMutation = trpc.video.analyze.useMutation({
    onSuccess: (data) => {
      toast.success("分析を開始しました");
      // ポーリングで進捗状況を確認
      pollAnalysisStatus(data.analysisId);
    },
  });
  
  const handleAnalyze = () => {
    analyzeMutation.mutate({ videoUrl });
  };
  
  return (
    <div>
      <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
      <Button onClick={handleAnalyze}>分析開始</Button>
    </div>
  );
}
```

**技術的なポイント**:
- tRPCの`useMutation`で非同期処理を実行
- 分析は時間がかかるため、バックグラウンドで実行し、ポーリングで進捗確認
- リアルタイム更新には、WebSocketやServer-Sent Eventsも検討可能

---

## 2. 分析履歴機能

### 概要

過去に分析した動画の履歴を一覧表示し、再度閲覧できる機能です。エクスポート機能（PDF、Markdown）や共有URL生成機能も含まれます。

### 技術アーキテクチャ

#### 履歴一覧表示

**実装ファイル**: `client/src/pages/History.tsx`

```typescript
export default function History() {
  const { data: analyses, isLoading } = trpc.video.listAnalyses.useQuery();
  
  return (
    <div>
      {analyses?.map(analysis => (
        <Card key={analysis.id}>
          <h3>{analysis.title}</h3>
          <p>分析日時: {new Date(analysis.createdAt).toLocaleString()}</p>
          <Button onClick={() => navigate(`/analysis/${analysis.id}`)}>詳細を見る</Button>
        </Card>
      ))}
    </div>
  );
}
```

#### エクスポート機能

**実装ファイル**: `server/routers.ts`

PDFエクスポートには**PDFKit**、Markdownエクスポートには単純な文字列生成を使用しています。

```typescript
export const videoRouter = router({
  exportPDF: protectedProcedure
    .input(z.object({ analysisId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const analysis = await getAnalysisById(input.analysisId);
      
      const doc = new PDFDocument();
      doc.fontSize(20).text(analysis.title);
      doc.fontSize(12).text(analysis.transcription);
      
      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        const buffers: Buffer[] = [];
        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.end();
      });
      
      const { url } = await storagePut(`exports/${analysis.id}.pdf`, pdfBuffer, "application/pdf");
      return { url };
    }),
});
```

**技術的なポイント**:
- PDFKitは日本語フォント対応が必要（Noto Sans JPなど）
- エクスポートしたファイルはS3に保存し、ダウンロードURLを返す
- Markdownエクスポートは、GitHub Flavored Markdown（GFM）形式で出力

#### 共有URL機能

**実装ファイル**: `server/routers.ts`, `client/src/pages/SharedAnalysis.tsx`

```typescript
export const videoRouter = router({
  toggleShare: protectedProcedure
    .input(z.object({ analysisId: z.number(), isPublic: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await db.update(videoAnalyses)
        .set({ isPublic: input.isPublic })
        .where(eq(videoAnalyses.id, input.analysisId));
      
      return { shareUrl: `https://your-domain.com/shared/${input.analysisId}` };
    }),
  
  getSharedAnalysis: publicProcedure
    .input(z.object({ analysisId: z.number() }))
    .query(async ({ input }) => {
      const analysis = await db.select()
        .from(videoAnalyses)
        .where(and(
          eq(videoAnalyses.id, input.analysisId),
          eq(videoAnalyses.isPublic, true)
        ))
        .limit(1);
      
      if (!analysis[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return analysis[0];
    }),
});
```

**技術的なポイント**:
- `isPublic`フラグで公開/非公開を制御
- 共有URLは認証不要でアクセス可能（`publicProcedure`）
- セキュリティのため、ランダムなトークンを使用することも検討可能

---

## 3. ダッシュボード機能

### 概要

ユーザーの分析統計、最近の分析履歴、エクスポート履歴などを一覧表示するダッシュボードです。

### 技術アーキテクチャ

**実装ファイル**: `client/src/pages/Dashboard.tsx`

```typescript
export default function Dashboard() {
  const { data: stats } = trpc.dashboard.getStats.useQuery();
  const { data: recentAnalyses } = trpc.video.listAnalyses.useQuery({ limit: 5 });
  
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <h3>総分析数</h3>
        <p className="text-4xl">{stats?.totalAnalyses}</p>
      </Card>
      <Card>
        <h3>今月の分析数</h3>
        <p className="text-4xl">{stats?.monthlyAnalyses}</p>
      </Card>
      <Card>
        <h3>エクスポート数</h3>
        <p className="text-4xl">{stats?.totalExports}</p>
      </Card>
      
      <div className="col-span-3">
        <h2>最近の分析</h2>
        {recentAnalyses?.map(analysis => (
          <AnalysisCard key={analysis.id} analysis={analysis} />
        ))}
      </div>
    </div>
  );
}
```

**バックエンド実装**: `server/routers.ts`

```typescript
export const dashboardRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const totalAnalyses = await db.select({ count: sql`count(*)` })
      .from(videoAnalyses)
      .where(eq(videoAnalyses.userId, ctx.user.id));
    
    const monthlyAnalyses = await db.select({ count: sql`count(*)` })
      .from(videoAnalyses)
      .where(and(
        eq(videoAnalyses.userId, ctx.user.id),
        sql`createdAt >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`
      ));
    
    return {
      totalAnalyses: totalAnalyses[0].count,
      monthlyAnalyses: monthlyAnalyses[0].count,
    };
  }),
});
```

**技術的なポイント**:
- SQLの`COUNT(*)`で集計
- `DATE_SUB(NOW(), INTERVAL 1 MONTH)`で過去1ヶ月のデータを取得
- グラフ表示には、Chart.jsやRechartsを使用可能

---

## 4. RAG（Retrieval-Augmented Generation）機能

### 概要

RAG（Retrieval-Augmented Generation）は、外部知識ベースから関連情報を検索し、LLMの生成結果に反映させる技術です。本アプリでは、過去の動画分析結果やインポートしたドキュメントをRAGデータベースに保存し、AIチャットやSEO記事生成で活用しています。

### 技術アーキテクチャ

#### RAGデータベースの構造

**実装ファイル**: `drizzle/schema.ts`

```typescript
export const ragDocuments = mysqlTable("ragDocuments", {
  id: int("id").autoincrement().primaryKey(),
  content: longtext("content").notNull(),
  type: varchar("type", { length: 100 }).notNull(), // "動画分析", "メルマガ", "構成パターン"など
  sourceId: varchar("sourceId", { length: 255 }), // 元の動画ID、ファイル名など
  successLevel: mysqlEnum("successLevel", ["高", "中", "低"]),
  importance: int("importance").default(0), // ピックアップ機能用
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tagCategories = mysqlTable("tagCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(), // "genre", "author", "contentType", "theme"
  displayName: varchar("displayName", { length: 100 }).notNull(),
});

export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  value: varchar("value", { length: 100 }).notNull(),
  displayName: varchar("displayName", { length: 100 }).notNull(),
});

export const ragDocumentTags = mysqlTable("ragDocumentTags", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  tagId: int("tagId").notNull(),
});
```

**リレーション**:
- `ragDocuments` ← `ragDocumentTags` ← `tags` ← `tagCategories` (多対多)

#### RAGドキュメントの保存

**実装ファイル**: `server/ragWithTags.ts`

```typescript
export async function saveToRAGWithTags(params: {
  content: string;
  type: string;
  sourceId?: string;
  successLevel?: "高" | "中" | "低";
  tags: {
    genre?: string[];
    author?: string[];
    contentType?: string[];
    theme?: string[];
  };
}) {
  const db = await getDb();
  
  // 1. ドキュメントを保存
  const [result] = await db.insert(ragDocuments).values({
    content: params.content,
    type: params.type,
    sourceId: params.sourceId,
    successLevel: params.successLevel,
    importance: 0,
  });
  
  const documentId = result.insertId;
  
  // 2. タグIDを取得
  const tagIds: number[] = [];
  for (const [categoryName, tagValues] of Object.entries(params.tags)) {
    const [category] = await db.select()
      .from(tagCategories)
      .where(eq(tagCategories.name, categoryName))
      .limit(1);
    
    const categoryTags = await db.select()
      .from(tags)
      .where(and(
        eq(tags.categoryId, category.id),
        inArray(tags.value, tagValues)
      ));
    
    tagIds.push(...categoryTags.map(t => t.id));
  }
  
  // 3. ドキュメント-タグの関連付け
  await db.insert(ragDocumentTags).values(
    tagIds.map(tagId => ({ documentId, tagId }))
  );
  
  return { success: true, documentId };
}
```

#### RAGドキュメントの検索

**実装ファイル**: `server/ragWithTags.ts`

```typescript
export async function searchRAGWithTags(params: {
  query?: string;
  tagFilters?: {
    genre?: string[];
    author?: string[];
    contentType?: string[];
    theme?: string[];
    successLevel?: ("高" | "中" | "低")[];
  };
  limit?: number;
}) {
  const db = await getDb();
  
  // 1. タグフィルタでドキュメントIDを取得
  const whereConditions: any[] = [];
  
  if (params.tagFilters) {
    for (const [categoryName, tagValues] of Object.entries(params.tagFilters)) {
      const [category] = await db.select()
        .from(tagCategories)
        .where(eq(tagCategories.name, categoryName))
        .limit(1);
      
      const categoryTags = await db.select()
        .from(tags)
        .where(and(
          eq(tags.categoryId, category.id),
          inArray(tags.value, tagValues)
        ));
      
      const tagIds = categoryTags.map(t => t.id);
      const documentIds = await db.select({ documentId: ragDocumentTags.documentId })
        .from(ragDocumentTags)
        .where(inArray(ragDocumentTags.tagId, tagIds));
      
      whereConditions.push(inArray(ragDocuments.id, documentIds.map(d => d.documentId)));
    }
  }
  
  // 2. ドキュメントを取得
  const results = await db.select()
    .from(ragDocuments)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .limit(params.limit || 10);
  
  // 3. 各ドキュメントのタグを取得
  const documentsWithTags = await Promise.all(
    results.map(async (doc) => {
      const docTags = await db.select({
        tagId: ragDocumentTags.tagId,
        tagValue: tags.value,
        tagDisplayName: tags.displayName,
        categoryName: tagCategories.name,
        categoryDisplayName: tagCategories.displayName,
      })
      .from(ragDocumentTags)
      .leftJoin(tags, eq(ragDocumentTags.tagId, tags.id))
      .leftJoin(tagCategories, eq(tags.categoryId, tagCategories.id))
      .where(eq(ragDocumentTags.documentId, doc.id));
      
      return { ...doc, tags: docTags };
    })
  );
  
  return documentsWithTags;
}
```

**技術的なポイント**:
- タグベースのフィルタリングで、特定の発信者やジャンルのドキュメントを検索
- `importance`フィールドで「ピックアップ」機能を実装（重要度の高いドキュメントを優先）
- 全文検索には、MySQLの`FULLTEXT INDEX`やElasticsearchを使用可能

#### RAGコンテキストの生成

**実装ファイル**: `server/ragWithTags.ts`

```typescript
export async function getRAGContextWithTags(params: {
  query: string;
  tagFilters?: {
    genre?: string[];
    author?: string[];
    contentType?: string[];
    theme?: string[];
  };
  limit?: number;
}) {
  const documents = await searchRAGWithTags({
    query: params.query,
    tagFilters: params.tagFilters,
    limit: params.limit || 5,
  });
  
  // ドキュメントをLLMのコンテキストに変換
  const context = documents.map((doc, i) => 
    `[参考資料${i + 1}] ${doc.type} (成功度: ${doc.successLevel || "不明"})\n${doc.content}`
  ).join("\n\n");
  
  return context;
}
```

**技術的なポイント**:
- 検索結果をLLMのプロンプトに挿入可能な形式に変換
- コンテキストウィンドウ（128K tokens）を超えないように、ドキュメント数を制限
- ベクトル検索（Embeddings）を使用すると、より高精度な検索が可能

### ベクトル検索への拡張（将来的な改善案）

現在の実装は、タグベースの検索ですが、**ベクトル検索**（Semantic Search）を導入すると、より高精度な検索が可能になります。

#### ベクトル検索の実装例

```typescript
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. ドキュメントをベクトル化
async function embedDocument(content: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: content,
  });
  return response.data[0].embedding;
}

// 2. クエリをベクトル化
async function embedQuery(query: string): Promise<number[]> {
  return embedDocument(query);
}

// 3. コサイン類似度で検索
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// 4. ベクトル検索
async function vectorSearch(query: string, limit: number = 5) {
  const queryEmbedding = await embedQuery(query);
  
  // データベースから全ドキュメントのベクトルを取得
  const documents = await db.select().from(ragDocuments);
  
  // 類似度を計算してソート
  const results = documents.map(doc => ({
    ...doc,
    similarity: cosineSimilarity(queryEmbedding, doc.embedding),
  }))
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, limit);
  
  return results;
}
```

**技術的なポイント**:
- OpenAI Embeddings APIで1536次元のベクトルを生成
- ベクトルはデータベースに保存（MySQLの`JSON`型またはベクトル専用DB）
- ベクトル専用データベース（Pinecone、Weaviate、Qdrant）を使用すると、大規模データでも高速検索が可能

---

## 5. SEO記事生成機能

### 概要

テーマを入力すると、RAGドキュメントを参照しながら、SEO最適化された記事を自動生成する機能です。発信者名でフィルタリングすることで、特定の発信者のスタイルで記事を生成できます。

### 技術アーキテクチャ

#### バックグラウンドジョブシステム

SEO記事生成は時間がかかるため、**バックグラウンドジョブ**として実行します。

**実装ファイル**: `server/seoArticleJobProcessor.ts`

```typescript
export async function processSEOArticleJob(jobId: number) {
  const job = await getSEOArticleJob(jobId);
  
  // Step 1: RAGドキュメントを検索
  await updateJobStatus(jobId, "processing", 10, "RAGドキュメントを検索中...");
  const ragContext = await getRAGContextWithTags({
    query: job.theme,
    tagFilters: {
      author: job.authorFilter ? [job.authorFilter] : undefined,
    },
    limit: 10,
  });
  
  // Step 2: 記事構成を生成
  await updateJobStatus(jobId, "processing", 30, "記事構成を生成中...");
  const outline = await generateArticleOutline(job.theme, ragContext);
  
  // Step 3: 各セクションを生成
  await updateJobStatus(jobId, "processing", 50, "記事本文を生成中...");
  const sections = await Promise.all(
    outline.sections.map(section => generateSection(section, ragContext))
  );
  
  // Step 4: SEO最適化
  await updateJobStatus(jobId, "processing", 80, "SEO最適化中...");
  const optimizedArticle = await optimizeForSEO({
    title: outline.title,
    sections,
    keywords: job.keywords,
  });
  
  // Step 5: 完了
  await updateJobStatus(jobId, "completed", 100, "完了");
  await saveArticle(jobId, optimizedArticle);
}
```

**技術的なポイント**:
- ジョブの進捗状況をデータベースに保存し、フロントエンドでポーリング
- 各ステップで`updateJobStatus`を呼び出し、進捗率とメッセージを更新
- エラー発生時は`status: "failed"`に変更し、エラーメッセージを保存

#### 記事構成の生成

**実装ファイル**: `server/seoArticleGenerator.ts`

```typescript
async function generateArticleOutline(theme: string, ragContext: string) {
  const prompt = `
あなたはSEOライティングのエキスパートです。以下のテーマで、SEO最適化された記事の構成を作成してください。

**テーマ:** ${theme}

**参考資料:**
${ragContext}

**出力形式（JSON）:**
{
  "title": "記事タイトル（30-60文字、キーワードを含む）",
  "metaDescription": "メタディスクリプション（120-160文字）",
  "sections": [
    {
      "heading": "見出し（H2）",
      "subheadings": ["小見出し（H3）", "小見出し（H3）"]
    }
  ]
}
`;
  
  const response = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "article_outline",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            metaDescription: { type: "string" },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string" },
                  subheadings: { type: "array", items: { type: "string" } },
                },
                required: ["heading", "subheadings"],
              },
            },
          },
          required: ["title", "metaDescription", "sections"],
        },
      },
    },
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

**技術的なポイント**:
- `response_format: { type: "json_schema" }`で構造化されたJSON出力を強制
- RAGコンテキストを参照することで、過去の成功事例を反映
- SEOのベストプラクティス（タイトル長、メタディスクリプション長）を遵守

#### SEO最適化

**実装ファイル**: `server/seoAnalyzer.ts`

```typescript
export function analyzeSEO(article: {
  title: string;
  content: string;
  keywords: string[];
}) {
  const issues: string[] = [];
  
  // タイトル長チェック
  if (article.title.length < 30 || article.title.length > 60) {
    issues.push("タイトルは30-60文字が推奨です");
  }
  
  // キーワード密度チェック
  const wordCount = article.content.split(/\s+/).length;
  for (const keyword of article.keywords) {
    const keywordCount = (article.content.match(new RegExp(keyword, "gi")) || []).length;
    const density = (keywordCount / wordCount) * 100;
    
    if (density < 0.5) {
      issues.push(`キーワード「${keyword}」の出現頻度が低すぎます（${density.toFixed(2)}%）`);
    } else if (density > 3) {
      issues.push(`キーワード「${keyword}」の出現頻度が高すぎます（${density.toFixed(2)}%）`);
    }
  }
  
  // 見出し構造チェック
  const h2Count = (article.content.match(/<h2>/gi) || []).length;
  const h3Count = (article.content.match(/<h3>/gi) || []).length;
  
  if (h2Count < 3) {
    issues.push("H2見出しが少なすぎます（最低3つ推奨）");
  }
  
  return {
    passed: issues.length === 0,
    issues,
  };
}
```

**技術的なポイント**:
- キーワード密度は0.5-3%が理想的（Googleのガイドライン）
- 見出し構造（H1 → H2 → H3）を階層的に配置
- 内部リンク、外部リンク、画像のalt属性なども最適化対象

### フロントエンド実装

**ファイル**: `client/src/pages/SEOArticle.tsx`

```typescript
export default function SEOArticle() {
  const [theme, setTheme] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  
  const createJobMutation = trpc.seo.createJob.useMutation({
    onSuccess: (data) => {
      toast.success("記事生成を開始しました");
      pollJobStatus(data.jobId);
    },
  });
  
  const handleGenerate = () => {
    createJobMutation.mutate({ theme, authorFilter });
  };
  
  return (
    <div>
      <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="テーマを入力" />
      <select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)}>
        <option value="">すべての発信者</option>
        <option value="発信者A">発信者A</option>
        <option value="発信者B">発信者B</option>
      </select>
      <Button onClick={handleGenerate}>記事生成</Button>
    </div>
  );
}
```

---

## 6. 動画生成機能

### 概要

テーマを入力すると、RAGドキュメントを参照しながら、YouTube動画の台本を自動生成し、スライド形式の解説動画を作成する機能です。

### 技術アーキテクチャ

動画生成は、以下の9つのステップで構成されています。

#### Step 1: ベンチマーク動画検索

**実装ファイル**: `server/benchmarkAnalyzer.ts`

```typescript
async function searchBenchmarkVideos(theme: string): Promise<string[]> {
  const prompt = `
以下のテーマに関連するYouTube動画を5つ検索してください。

**テーマ:** ${theme}

**出力形式（JSON）:**
{
  "videos": [
    { "title": "動画タイトル", "url": "https://www.youtube.com/watch?v=..." }
  ]
}
`;
  
  const response = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
  });
  
  const result = JSON.parse(response.choices[0].message.content);
  return result.videos.map((v: any) => v.url);
}
```

**技術的なポイント**:
- LLMで関連動画を検索（YouTube Data APIも使用可能）
- ベンチマーク動画は、成功事例として参照

#### Step 2: ベンチマーク動画分析

**実装ファイル**: `server/benchmarkAnalyzer.ts`

```typescript
async function analyzeBenchmarkVideo(videoUrl: string) {
  // 動画をダウンロード
  const { videoPath, audioPath, title } = await downloadVideoAndExtractAudio(videoUrl, outputDir);
  
  // 文字起こし
  const transcription = await transcribeAudio({ audioUrl: audioPath });
  
  // フレーム分析
  const framePaths = await extractFrames(videoPath, outputDir, 30);
  const frameAnalyses = await Promise.all(
    framePaths.map((path, i) => analyzeFrame(path, i * 30))
  );
  
  // 構成パターンを抽出
  const pattern = await extractPattern(transcription, frameAnalyses);
  
  return {
    title,
    transcription,
    frameAnalyses,
    pattern,
  };
}

async function extractPattern(transcription: string, frameAnalyses: FrameAnalysis[]) {
  const prompt = `
以下の動画から、構成パターンを抽出してください。

**文字起こし:**
${transcription}

**映像分析:**
${frameAnalyses.map(f => `[${f.timestamp}s] ${f.visualDescription}`).join("\n")}

**出力形式（JSON）:**
{
  "hook": "冒頭のつかみ（最初の30秒）",
  "problem": "問題提起（視聴者の課題）",
  "solution": "解決策（具体的な方法）",
  "cta": "行動喚起（最後のメッセージ）"
}
`;
  
  const response = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

**技術的なポイント**:
- ベンチマーク動画から構成パターン（Hook-Problem-Solution-CTA）を抽出
- 抽出したパターンはRAGに保存し、将来の動画生成で参照

#### Step 3: RAG保存

**実装ファイル**: `server/videoGenerationWorker.ts`

```typescript
await saveToRAGWithTags({
  content: JSON.stringify(benchmarkAnalysis),
  type: "構成パターン",
  sourceId: theme,
  tags: {
    genre: ["動画"],
    contentType: ["構成パターン"],
    theme: [],
    author: [],
  },
});
```

#### Step 4: 戦略設計

**実装ファイル**: `server/contentStrategy.ts`

```typescript
async function designStrategy(theme: string, ragContext: string) {
  const prompt = `
以下のテーマで、YouTube動画の戦略を設計してください。

**テーマ:** ${theme}

**参考資料（過去の成功事例）:**
${ragContext}

**出力形式（JSON）:**
{
  "targetAudience": "ターゲット視聴者",
  "painPoints": ["視聴者の課題1", "視聴者の課題2"],
  "desiredOutcome": "視聴者が得られる成果",
  "uniqueValueProposition": "独自の価値提案",
  "trafficKeywords": ["流入キーワード1", "流入キーワード2"],
  "solutionKeywords": ["解決策キーワード1", "解決策キーワード2"]
}
`;
  
  const response = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

**技術的なポイント**:
- RAGコンテキストから過去の成功事例を参照
- ターゲット視聴者、課題、成果、独自の価値提案を明確化

#### Step 5: シナリオ生成

**実装ファイル**: `server/contentStrategy.ts`

```typescript
async function generateScenario(strategy: Strategy, ragContext: string) {
  const prompt = `
以下の戦略に基づいて、YouTube動画のシナリオを作成してください。

**戦略:**
- ターゲット視聴者: ${strategy.targetAudience}
- 課題: ${strategy.painPoints.join(", ")}
- 成果: ${strategy.desiredOutcome}
- 独自の価値提案: ${strategy.uniqueValueProposition}

**参考資料:**
${ragContext}

**出力形式（JSON）:**
{
  "hook": {
    "duration": 30,
    "content": "冒頭のつかみ（ナレーション）"
  },
  "problemPresentation": {
    "duration": 60,
    "content": "問題提起（ナレーション）"
  },
  "solution": {
    "duration": 180,
    "content": "解決策（ナレーション）"
  },
  "callToAction": {
    "duration": 30,
    "content": "行動喚起（ナレーション）"
  }
}
`;
  
  const response = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

**技術的なポイント**:
- Hook（つかみ）、Problem（問題提起）、Solution（解決策）、CTA（行動喚起）の4部構成
- 各セクションの長さ（duration）を指定

#### Step 6: スライド生成

**実装ファイル**: `server/videoComposer.ts`

```typescript
async function generateSlideImage(slide: Slide): Promise<string> {
  const browser = await puppeteer.launch({
    executablePath: findChromeExecutable(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const html = generateSlideHTML(slide);
  await page.setContent(html);
  
  const screenshotBuffer = await page.screenshot({ type: "png" });
  await browser.close();
  
  // S3にアップロード
  const { url } = await storagePut(`slides/${slide.slideNumber}.png`, screenshotBuffer, "image/png");
  return url;
}

function generateSlideHTML(slide: Slide): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 1920px;
      height: 1080px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Noto Sans JP', sans-serif;
    }
    .slide-container {
      width: 90%;
      height: 90%;
      background: white;
      border-radius: 20px;
      padding: 60px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    h1 {
      font-size: 72px;
      color: #333;
      margin-bottom: 40px;
    }
    .content-item {
      font-size: 48px;
      color: #666;
      margin-bottom: 30px;
    }
  </style>
</head>
<body>
  <div class="slide-container">
    <h1>${slide.title}</h1>
    <div class="content">
      ${slide.content.map(item => `<div class="content-item">${item}</div>`).join("")}
    </div>
  </div>
</body>
</html>
`;
}
```

**技術的なポイント**:
- Puppeteerでスライドを画像化（1920x1080px）
- Google Fonts（Noto Sans JP）で日本語フォントを使用
- グラデーション背景、シャドウ、ボーダーラディウスで視覚的に魅力的なデザイン

#### Step 7: 音声生成（VoiceVox）

**実装ファイル**: `server/voicevoxClient.ts`

```typescript
export async function generateSpeech(options: VoiceVoxOptions): Promise<VoiceVoxResult> {
  const baseURL = getVoiceVoxBaseURL();
  
  // Step 1: 音声合成クエリを作成
  const queryResponse = await axios.post(
    `${baseURL}/audio_query`,
    null,
    {
      params: {
        text: options.text,
        speaker: options.speaker || 3, // ずんだもん・ノーマル
      },
    }
  );
  
  // Step 2: 音声を合成
  const synthesisResponse = await axios.post(
    `${baseURL}/synthesis`,
    queryResponse.data,
    {
      params: { speaker: options.speaker || 3 },
      responseType: "arraybuffer",
    }
  );
  
  const audioBuffer = Buffer.from(synthesisResponse.data);
  const estimatedDuration = options.text.length * 0.1; // 文字数から推定
  
  return { audioBuffer, duration: estimatedDuration };
}
```

**技術的なポイント**:
- VoiceVox WEB版API（無料）を使用
- 話者ID（speakerId）で声を選択（ずんだもん、四国めたんなど14種類）
- 音声の長さは文字数から推定（1文字 ≈ 0.1秒）

#### Step 8: 動画合成（ffmpeg）

**実装ファイル**: `server/videoRenderer.ts`

```typescript
export async function renderVideo(params: {
  slides: { imagePath: string; duration: number }[];
  audioPath: string;
  outputPath: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    
    // スライド画像を入力
    params.slides.forEach(slide => {
      command = command.input(slide.imagePath).inputOptions([
        `-loop 1`,
        `-t ${slide.duration}`,
      ]);
    });
    
    // 音声を入力
    command = command.input(params.audioPath);
    
    // スライドを連結
    const filterComplex = params.slides.map((_, i) => `[${i}:v]`).join("") + `concat=n=${params.slides.length}:v=1:a=0[outv]`;
    
    command
      .complexFilter([
        filterComplex,
      ])
      .outputOptions([
        `-map [outv]`,
        `-map ${params.slides.length}:a`, // 音声トラック
        `-c:v libx264`,
        `-c:a aac`,
        `-pix_fmt yuv420p`,
        `-shortest`,
      ])
      .output(params.outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}
```

**技術的なポイント**:
- ffmpegの`concat`フィルタでスライドを連結
- `-shortest`オプションで、音声とスライドの短い方に合わせる
- H.264コーデック（libx264）でエンコード（YouTube推奨）

#### Step 9: S3アップロードと完了

**実装ファイル**: `server/videoGenerationWorker.ts`

```typescript
const videoBuffer = await fs.readFile(outputPath);
const { url } = await storagePut(`videos/video-${jobId}.mp4`, videoBuffer, "video/mp4");

await db.update(videoGenerationJobs)
  .set({
    status: "completed",
    videoUrl: url,
    progress: 100,
    completedAt: new Date(),
  })
  .where(eq(videoGenerationJobs.id, jobId));
```

### データベーススキーマ

**テーブル**: `videoGenerationJobs`, `benchmarkVideos`, `videoStrategy`, `videoScenario`, `videoSlide`

```typescript
export const videoGenerationJobs = mysqlTable("videoGenerationJobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  theme: text("theme").notNull(),
  speakerId: int("speakerId").default(3), // VoiceVox話者ID
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending"),
  currentStep: varchar("currentStep", { length: 100 }),
  progress: int("progress").default(0), // 0-100
  videoUrl: varchar("videoUrl", { length: 500 }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
```

---

## 7. 共通技術スタック

### フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| React | 19 | UIライブラリ |
| TypeScript | 5.x | 型安全性 |
| Tailwind CSS | 4 | スタイリング |
| shadcn/ui | - | UIコンポーネント |
| tRPC | 11 | 型安全なAPI通信 |
| Wouter | - | ルーティング |
| TanStack Query | - | データフェッチング（tRPC内部で使用） |

### バックエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Node.js | 22.x | ランタイム |
| Express | 4 | Webフレームワーク |
| tRPC | 11 | API定義 |
| Drizzle ORM | - | データベースORM |
| MySQL/TiDB | - | データベース |

### AI・機械学習

| 技術 | 用途 |
|------|------|
| OpenAI GPT-4 | LLM（テキスト生成、分析） |
| OpenAI GPT-4 Vision | 画像分析 |
| OpenAI Whisper | 音声文字起こし |
| VoiceVox | 音声合成 |

### 動画処理

| 技術 | 用途 |
|------|------|
| yt-dlp | YouTube動画ダウンロード |
| ffmpeg | 動画編集、フレーム抽出、動画合成 |
| Puppeteer | スライド画像生成 |

### ストレージ

| 技術 | 用途 |
|------|------|
| AWS S3 | 動画、画像、エクスポートファイルの保存 |
| CloudFront | CDN（高速配信） |

### 認証

| 技術 | 用途 |
|------|------|
| Manus OAuth | ユーザー認証 |
| JWT | セッション管理 |

---

## まとめ

本アプリケーションは、**YouTube動画分析**、**RAG**、**SEO記事生成**、**動画生成**という4つの主要機能を統合した、AI駆動のコンテンツ制作プラットフォームです。

各機能は、**LLM**（GPT-4）、**音声認識**（Whisper）、**音声合成**（VoiceVox）、**動画処理**（ffmpeg、Puppeteer）、**RAG**（タグベース検索）という最先端の技術を組み合わせて実装されています。

今後の拡張として、**ベクトル検索**（Embeddings）、**リアルタイム更新**（WebSocket）、**バッチ処理**（複数動画の一括生成）、**音声品質調整UI**などが検討されています。

---

**作成者**: Manus AI  
**最終更新日**: 2025年11月19日
