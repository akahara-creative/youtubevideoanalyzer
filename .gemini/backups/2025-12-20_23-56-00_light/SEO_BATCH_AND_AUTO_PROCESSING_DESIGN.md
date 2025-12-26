# SEO記事生成 バッチ処理・自動加工機能 実装設計書

**作成者**: Manus AI  
**作成日**: 2025年11月19日  
**目的**: CSVバッチ処理と自動加工機能の実装難易度評価と実装方法の提案

---

## 目次

1. [機能要件](#1-機能要件)
2. [難易度評価](#2-難易度評価)
3. [機能1: CSVバッチ処理](#3-機能1-csvバッチ処理)
4. [機能2: 自動加工モード](#4-機能2-自動加工モード)
5. [実装スケジュール](#5-実装スケジュール)
6. [技術的な注意点](#6-技術的な注意点)

---

## 1. 機能要件

### 1.1 機能1: CSVバッチ処理

**現状**: テーマ、文字数、筆者名を手動で1件ずつ入力してSEO記事を生成

**要望**: CSVファイルで複数のテーマをまとめて渡し、自動的に一括生成

**CSV形式例**:
```csv
テーマ,文字数,筆者名
"副業で月10万円稼ぐ方法",3000,"山田太郎"
"在宅ワークの始め方",2500,"山田太郎"
"フリーランスの確定申告",4000,"佐藤花子"
```

**期待動作**:
1. CSVファイルをアップロード
2. CSVの各行を読み取り、SEO記事生成ジョブを自動作成
3. バックグラウンドで順次処理
4. 完了後、一覧画面で全記事を確認可能

### 1.2 機能2: 自動加工モード

**現状**: 生成された記事を手動で加工（編集、整形、WordPress形式への変換）

**要望**: 生成後、自動的に加工まで進めるモード

**自動加工の内容**:
1. **文章の整形**: 改行、段落、見出しの調整
2. **WordPress形式への変換**: HTMLタグの追加、メタ情報の設定
3. **画像の自動挿入**: テーマに関連する画像を自動検索・挿入
4. **内部リンクの自動追加**: 過去の記事との関連性を分析し、内部リンクを自動追加
5. **SEOメタタグの自動生成**: タイトルタグ、メタディスクリプション、OGPタグ

**期待動作**:
1. SEO記事生成時に「自動加工モード」をONにする
2. 記事生成完了後、自動的に加工処理を実行
3. 加工完了後、WordPress形式でダウンロード可能

---

## 2. 難易度評価

### 2.1 機能1: CSVバッチ処理

**難易度**: ★★☆☆☆（低〜中）

**理由**:
- CSVパース処理は標準ライブラリで簡単に実装可能
- 既存のSEO記事生成ジョブシステムを再利用できる
- バックグラウンドジョブの仕組みは既に実装済み

**実装工数**: 1〜2日

**必要な作業**:
1. CSVアップロード機能の追加（フロントエンド）
2. CSVパース処理の実装（バックエンド）
3. バッチジョブ管理テーブルの追加（データベース）
4. バッチジョブ一覧画面の追加（フロントエンド）

### 2.2 機能2: 自動加工モード

**難易度**: ★★★☆☆（中）

**理由**:
- 文章整形は正規表現で実装可能
- WordPress形式への変換は既存のエクスポート機能を拡張
- 画像検索・挿入はUnsplash APIなどを利用
- 内部リンク追加はRAGドキュメント検索を活用
- SEOメタタグ生成はLLMで自動生成可能

**実装工数**: 3〜5日

**必要な作業**:
1. 自動加工モードのON/OFF設定（フロントエンド）
2. 文章整形処理の実装（バックエンド）
3. 画像検索・挿入処理の実装（Unsplash API連携）
4. 内部リンク自動追加処理の実装（RAG検索活用）
5. SEOメタタグ自動生成処理の実装（LLM活用）
6. WordPress形式エクスポートの拡張（既存機能の改良）

---

## 3. 機能1: CSVバッチ処理

### 3.1 データベーススキーマ

**新規テーブル**: `seoArticleBatches`

```typescript
export const seoArticleBatches = mysqlTable("seoArticleBatches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  totalCount: int("totalCount").notNull(),
  completedCount: int("completedCount").default(0).notNull(),
  failedCount: int("failedCount").default(0).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

**既存テーブルの拡張**: `seoArticleJobs`

```typescript
export const seoArticleJobs = mysqlTable("seoArticleJobs", {
  // 既存のカラム
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  theme: text("theme").notNull(),
  // ...
  
  // 新規追加
  batchId: int("batchId"), // バッチIDを追加
});
```

### 3.2 バックエンド実装

**CSVパース処理**:

```typescript
import Papa from "papaparse";

export async function parseCSV(csvContent: string): Promise<Array<{
  theme: string;
  targetWordCount: number;
  authorName: string;
}>> {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });
  
  return result.data.map((row: any) => ({
    theme: row["テーマ"],
    targetWordCount: parseInt(row["文字数"]) || 3000,
    authorName: row["筆者名"],
  }));
}
```

**バッチジョブ作成処理**:

```typescript
export async function createSeoArticleBatch(params: {
  userId: number;
  fileName: string;
  csvContent: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // CSVをパース
  const items = await parseCSV(params.csvContent);
  
  // バッチレコードを作成
  const [batchResult] = await db.insert(seoArticleBatches).values({
    userId: params.userId,
    fileName: params.fileName,
    totalCount: items.length,
  });
  
  const batchId = batchResult.insertId;
  
  // 各アイテムに対してSEO記事生成ジョブを作成
  for (const item of items) {
    await createSeoArticleJob({
      userId: params.userId,
      theme: item.theme,
      targetWordCount: item.targetWordCount,
      authorName: item.authorName,
      batchId, // バッチIDを設定
    });
  }
  
  return batchId;
}
```

**バッチジョブ進捗更新処理**:

```typescript
export async function updateBatchProgress(batchId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // バッチに属するジョブの状態を集計
  const jobs = await db
    .select()
    .from(seoArticleJobs)
    .where(eq(seoArticleJobs.batchId, batchId));
  
  const completedCount = jobs.filter(j => j.status === "completed").length;
  const failedCount = jobs.filter(j => j.status === "failed").length;
  
  // バッチの進捗を更新
  await db.update(seoArticleBatches)
    .set({
      completedCount,
      failedCount,
      status: completedCount + failedCount === jobs.length ? "completed" : "processing",
    })
    .where(eq(seoArticleBatches.id, batchId));
}
```

### 3.3 フロントエンド実装

**CSVアップロードUI**:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export function CSVBatchUpload() {
  const [file, setFile] = useState<File | null>(null);
  
  const createBatch = trpc.seoArticle.createBatch.useMutation({
    onSuccess: (data) => {
      toast.success(`バッチ処理を開始しました（${data.totalCount}件）`);
    },
  });
  
  const handleUpload = async () => {
    if (!file) return;
    
    const csvContent = await file.text();
    createBatch.mutate({
      fileName: file.name,
      csvContent,
    });
  };
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">CSVバッチアップロード</h2>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <Input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>
      
      <Button onClick={handleUpload} disabled={!file || createBatch.isLoading}>
        {createBatch.isLoading ? "アップロード中..." : "バッチ処理を開始"}
      </Button>
      
      <div className="text-sm text-gray-500">
        <p>CSV形式: テーマ,文字数,筆者名</p>
        <p>例: "副業で月10万円稼ぐ方法",3000,"山田太郎"</p>
      </div>
    </div>
  );
}
```

**バッチジョブ一覧UI**:

```tsx
export function BatchJobList() {
  const { data: batches } = trpc.seoArticle.listBatches.useQuery();
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">バッチ処理一覧</h2>
      
      <div className="space-y-2">
        {batches?.map((batch) => (
          <div key={batch.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{batch.fileName}</p>
                <p className="text-sm text-gray-500">
                  {batch.completedCount} / {batch.totalCount} 完了
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={batch.status === "completed" ? "success" : "default"}>
                  {batch.status}
                </Badge>
                
                <Button variant="outline" size="sm">
                  詳細を見る
                </Button>
              </div>
            </div>
            
            <Progress
              value={(batch.completedCount / batch.totalCount) * 100}
              className="mt-2"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3.4 tRPCルーター

```typescript
seoArticle: router({
  // 既存のルーター
  createJob: protectedProcedure
    .input(z.object({
      theme: z.string(),
      targetWordCount: z.number(),
      authorName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ...
    }),
  
  // 新規追加
  createBatch: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      csvContent: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const batchId = await createSeoArticleBatch({
        userId: ctx.user.id,
        fileName: input.fileName,
        csvContent: input.csvContent,
      });
      
      const batch = await getSeoArticleBatchById(batchId);
      return batch;
    }),
  
  listBatches: protectedProcedure
    .query(async ({ ctx }) => {
      return await getSeoArticleBatchesByUserId(ctx.user.id);
    }),
  
  getBatch: protectedProcedure
    .input(z.object({ batchId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await getSeoArticleBatchById(input.batchId);
    }),
}),
```

---

## 4. 機能2: 自動加工モード

### 4.1 データベーススキーマ

**既存テーブルの拡張**: `seoArticleJobs`

```typescript
export const seoArticleJobs = mysqlTable("seoArticleJobs", {
  // 既存のカラム
  id: int("id").autoincrement().primaryKey(),
  // ...
  
  // 新規追加
  autoProcessing: boolean("autoProcessing").default(false).notNull(),
  processedArticle: text("processedArticle"), // 加工後の記事
  featuredImageUrl: varchar("featuredImageUrl", { length: 512 }), // アイキャッチ画像URL
  internalLinks: text("internalLinks"), // 内部リンク（JSON）
  seoMetaTags: text("seoMetaTags"), // SEOメタタグ（JSON）
});
```

### 4.2 バックエンド実装

**文章整形処理**:

```typescript
export function formatArticle(article: string): string {
  // 改行を正規化
  let formatted = article.replace(/\n{3,}/g, "\n\n");
  
  // 見出しの前後に空行を追加
  formatted = formatted.replace(/(^|\n)(#{1,6} .+?)(\n|$)/g, "\n\n$2\n\n");
  
  // リストの前後に空行を追加
  formatted = formatted.replace(/(^|\n)([-*] .+?)(\n|$)/g, "\n\n$2\n\n");
  
  // 連続する空行を削除
  formatted = formatted.replace(/\n{3,}/g, "\n\n");
  
  return formatted.trim();
}
```

**画像検索・挿入処理**:

```typescript
import fetch from "node-fetch";

export async function searchAndInsertImages(params: {
  article: string;
  theme: string;
}): Promise<{ article: string; featuredImageUrl: string }> {
  // Unsplash APIで画像を検索
  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(params.theme)}&per_page=5`,
    {
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
      },
    }
  );
  
  const data = await response.json();
  const images = data.results;
  
  if (images.length === 0) {
    return { article: params.article, featuredImageUrl: "" };
  }
  
  // アイキャッチ画像
  const featuredImageUrl = images[0].urls.regular;
  
  // 記事内に画像を挿入
  let article = params.article;
  const h2Sections = article.split(/\n## /);
  
  for (let i = 1; i < Math.min(h2Sections.length, images.length); i++) {
    const imageUrl = images[i].urls.regular;
    const imageAlt = images[i].alt_description || params.theme;
    h2Sections[i] = `![${imageAlt}](${imageUrl})\n\n${h2Sections[i]}`;
  }
  
  article = h2Sections.join("\n## ");
  
  return { article, featuredImageUrl };
}
```

**内部リンク自動追加処理**:

```typescript
export async function addInternalLinks(params: {
  article: string;
  userId: number;
}): Promise<{ article: string; internalLinks: Array<{ text: string; url: string }> }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 過去のSEO記事を取得
  const pastArticles = await db
    .select()
    .from(seoArticleJobs)
    .where(
      and(
        eq(seoArticleJobs.userId, params.userId),
        eq(seoArticleJobs.status, "completed")
      )
    )
    .limit(50);
  
  // LLMで関連記事を抽出
  const response = await invokeLLM({
    messages: [{
      role: "user",
      content: `以下の記事に関連する過去の記事を3つ選んでください:\n\n${params.article}\n\n過去の記事:\n${pastArticles.map(a => `- ${a.theme}`).join("\n")}`,
    }],
    response_format: {
      type: "json_schema",
      json_schema: {
        schema: {
          properties: {
            relatedArticles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  theme: { type: "string" },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  });
  
  const relatedArticles = JSON.parse(response.choices[0].message.content).relatedArticles;
  
  // 記事内に内部リンクを挿入
  let article = params.article;
  const internalLinks: Array<{ text: string; url: string }> = [];
  
  for (const related of relatedArticles) {
    const pastArticle = pastArticles.find(a => a.theme === related.theme);
    if (!pastArticle) continue;
    
    const linkText = related.theme;
    const linkUrl = `/seo-articles/${pastArticle.id}`;
    
    // 記事の最後に「関連記事」セクションを追加
    internalLinks.push({ text: linkText, url: linkUrl });
  }
  
  if (internalLinks.length > 0) {
    article += `\n\n## 関連記事\n\n`;
    for (const link of internalLinks) {
      article += `- [${link.text}](${link.url})\n`;
    }
  }
  
  return { article, internalLinks };
}
```

**SEOメタタグ自動生成処理**:

```typescript
export async function generateSEOMetaTags(params: {
  article: string;
  theme: string;
}): Promise<{
  titleTag: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
}> {
  const response = await invokeLLM({
    messages: [{
      role: "user",
      content: `以下の記事のSEOメタタグを生成してください:\n\nテーマ: ${params.theme}\n\n記事:\n${params.article.substring(0, 1000)}`,
    }],
    response_format: {
      type: "json_schema",
      json_schema: {
        schema: {
          properties: {
            titleTag: { type: "string", description: "60文字以内のタイトルタグ" },
            metaDescription: { type: "string", description: "160文字以内のメタディスクリプション" },
            ogTitle: { type: "string", description: "OGPタイトル" },
            ogDescription: { type: "string", description: "OGPディスクリプション" },
          },
        },
      },
    },
  });
  
  const metaTags = JSON.parse(response.choices[0].message.content);
  
  return {
    titleTag: metaTags.titleTag,
    metaDescription: metaTags.metaDescription,
    ogTitle: metaTags.ogTitle,
    ogDescription: metaTags.ogDescription,
    ogImage: "", // 画像検索処理で設定
  };
}
```

**自動加工処理の統合**:

```typescript
export async function autoProcessArticle(jobId: number): Promise<void> {
  const job = await getSeoArticleJobById(jobId);
  if (!job || !job.article) {
    throw new Error("Job not found or article not generated");
  }
  
  // 1. 文章整形
  let processedArticle = formatArticle(job.article);
  
  // 2. 画像検索・挿入
  const { article: articleWithImages, featuredImageUrl } = await searchAndInsertImages({
    article: processedArticle,
    theme: job.theme,
  });
  processedArticle = articleWithImages;
  
  // 3. 内部リンク追加
  const { article: articleWithLinks, internalLinks } = await addInternalLinks({
    article: processedArticle,
    userId: job.userId,
  });
  processedArticle = articleWithLinks;
  
  // 4. SEOメタタグ生成
  const seoMetaTags = await generateSEOMetaTags({
    article: processedArticle,
    theme: job.theme,
  });
  seoMetaTags.ogImage = featuredImageUrl;
  
  // 5. データベースに保存
  await updateSeoArticleJob(jobId, {
    processedArticle,
    featuredImageUrl,
    internalLinks: JSON.stringify(internalLinks),
    seoMetaTags: JSON.stringify(seoMetaTags),
  });
}
```

### 4.3 フロントエンド実装

**自動加工モードON/OFF設定**:

```tsx
export function SEOArticleForm() {
  const [autoProcessing, setAutoProcessing] = useState(false);
  
  const createJob = trpc.seoArticle.createJob.useMutation({
    onSuccess: (data) => {
      toast.success("SEO記事生成を開始しました");
    },
  });
  
  return (
    <form onSubmit={handleSubmit}>
      {/* テーマ、文字数、筆者名の入力フィールド */}
      
      <div className="flex items-center gap-2">
        <Switch
          checked={autoProcessing}
          onCheckedChange={setAutoProcessing}
        />
        <Label>自動加工モード（画像挿入、内部リンク、SEOメタタグを自動生成）</Label>
      </div>
      
      <Button type="submit">
        生成開始
      </Button>
    </form>
  );
}
```

**加工後の記事プレビュー**:

```tsx
export function ProcessedArticlePreview({ jobId }: { jobId: number }) {
  const { data: job } = trpc.seoArticle.getJob.useQuery({ jobId });
  
  if (!job?.processedArticle) {
    return <p>加工処理中...</p>;
  }
  
  const seoMetaTags = job.seoMetaTags ? JSON.parse(job.seoMetaTags) : null;
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">加工後の記事</h2>
      
      {/* アイキャッチ画像 */}
      {job.featuredImageUrl && (
        <img src={job.featuredImageUrl} alt="アイキャッチ画像" className="w-full rounded-lg" />
      )}
      
      {/* SEOメタタグ */}
      {seoMetaTags && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold mb-2">SEOメタタグ</h3>
          <p><strong>タイトルタグ:</strong> {seoMetaTags.titleTag}</p>
          <p><strong>メタディスクリプション:</strong> {seoMetaTags.metaDescription}</p>
        </div>
      )}
      
      {/* 記事本文 */}
      <div className="prose max-w-none">
        <Streamdown>{job.processedArticle}</Streamdown>
      </div>
      
      {/* WordPress形式でダウンロード */}
      <Button onClick={() => downloadWordPressFormat(job)}>
        WordPress形式でダウンロード
      </Button>
    </div>
  );
}
```

---

## 5. 実装スケジュール

### 5.1 機能1: CSVバッチ処理

| タスク | 工数 | 担当 |
|--------|------|------|
| データベーススキーマ設計・マイグレーション | 0.5日 | バックエンド |
| CSVパース処理の実装 | 0.5日 | バックエンド |
| バッチジョブ作成・進捗更新処理の実装 | 1日 | バックエンド |
| CSVアップロードUIの実装 | 0.5日 | フロントエンド |
| バッチジョブ一覧UIの実装 | 0.5日 | フロントエンド |
| tRPCルーターの実装 | 0.5日 | バックエンド |
| テスト・デバッグ | 0.5日 | 全体 |
| **合計** | **4日** | |

### 5.2 機能2: 自動加工モード

| タスク | 工数 | 担当 |
|--------|------|------|
| データベーススキーマ設計・マイグレーション | 0.5日 | バックエンド |
| 文章整形処理の実装 | 0.5日 | バックエンド |
| 画像検索・挿入処理の実装（Unsplash API連携） | 1日 | バックエンド |
| 内部リンク自動追加処理の実装 | 1日 | バックエンド |
| SEOメタタグ自動生成処理の実装 | 0.5日 | バックエンド |
| 自動加工処理の統合 | 0.5日 | バックエンド |
| 自動加工モードON/OFF設定UIの実装 | 0.5日 | フロントエンド |
| 加工後の記事プレビューUIの実装 | 1日 | フロントエンド |
| WordPress形式エクスポートの拡張 | 0.5日 | バックエンド |
| テスト・デバッグ | 1日 | 全体 |
| **合計** | **7日** | |

### 5.3 全体スケジュール

**合計工数**: 11日（約2週間）

**推奨実装順序**:
1. 機能1: CSVバッチ処理（4日）
2. 機能2: 自動加工モード（7日）

**理由**: CSVバッチ処理は独立した機能であり、先に実装することで早期にユーザーに価値を提供できます。自動加工モードは既存のSEO記事生成機能に依存するため、後から実装する方が効率的です。

---

## 6. 技術的な注意点

### 6.1 CSVバッチ処理

**注意点1: CSVエンコーディング**
- 日本語を含むCSVファイルはUTF-8 BOM付きで保存する必要がある
- Excelで作成したCSVはShift_JISの場合があるため、エンコーディング変換が必要

**対策**:
```typescript
import iconv from "iconv-lite";

export function detectAndConvertEncoding(buffer: Buffer): string {
  // BOMをチェック
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.toString("utf8").substring(1); // BOMを削除
  }
  
  // Shift_JISの可能性をチェック
  const sjisText = iconv.decode(buffer, "shift_jis");
  const utf8Text = buffer.toString("utf8");
  
  // 文字化けしていないか簡易チェック
  if (sjisText.includes("�") && !utf8Text.includes("�")) {
    return utf8Text;
  }
  
  return sjisText;
}
```

**注意点2: バッチ処理の並列実行**
- 大量のジョブを同時に実行すると、LLM APIのレート制限に引っかかる可能性がある
- バックグラウンドワーカーで順次処理する仕組みが必要

**対策**:
```typescript
// バックグラウンドワーカーで1件ずつ処理
setInterval(async () => {
  const pendingJob = await getNextPendingSeoArticleJob();
  if (pendingJob) {
    await processSeoArticleJob(pendingJob.id);
  }
}, 10000); // 10秒ごとに1件処理
```

### 6.2 自動加工モード

**注意点1: 画像の著作権**
- Unsplash APIで取得した画像は商用利用可能だが、クレジット表記が推奨される
- 画像URLに有効期限がある場合があるため、S3にアップロードして永続化する

**対策**:
```typescript
export async function downloadAndUploadImage(imageUrl: string): Promise<string> {
  // Unsplashから画像をダウンロード
  const response = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await response.arrayBuffer());
  
  // S3にアップロード
  const { url } = await storagePut(
    `seo-images/${Date.now()}.jpg`,
    imageBuffer,
    "image/jpeg"
  );
  
  return url;
}
```

**注意点2: 内部リンクの精度**
- LLMで関連記事を抽出する際、精度が低い場合がある
- ベクトル検索（OpenAI Embeddings）を使うと精度が向上する

**対策**:
```typescript
export async function findRelatedArticlesByEmbedding(params: {
  article: string;
  userId: number;
}): Promise<Array<{ id: number; theme: string; similarity: number }>> {
  // 記事のベクトル化
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: params.article.substring(0, 8000),
  });
  
  // 過去の記事のベクトルと比較
  const pastArticles = await db
    .select()
    .from(seoArticleJobs)
    .where(
      and(
        eq(seoArticleJobs.userId, params.userId),
        eq(seoArticleJobs.status, "completed")
      )
    );
  
  const results = pastArticles.map(article => ({
    ...article,
    similarity: cosineSimilarity(
      embedding.data[0].embedding,
      JSON.parse(article.embedding)
    ),
  }));
  
  return results.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}
```

**注意点3: WordPress形式エクスポートの互換性**
- WordPressのバージョンによってHTMLタグの仕様が異なる場合がある
- Gutenbergエディタとクラシックエディタで形式が異なる

**対策**:
```typescript
export function exportToWordPressFormat(params: {
  article: string;
  seoMetaTags: any;
  featuredImageUrl: string;
}): string {
  // Gutenbergブロック形式で出力
  let wpContent = "";
  
  // アイキャッチ画像
  wpContent += `<!-- wp:image -->\n<figure class="wp-block-image"><img src="${params.featuredImageUrl}" alt=""/></figure>\n<!-- /wp:image -->\n\n`;
  
  // 記事本文（Markdownから変換）
  const htmlContent = markdownToHtml(params.article);
  wpContent += htmlContent;
  
  // SEOメタタグ（Yoast SEO形式）
  wpContent += `\n\n<!-- Yoast SEO -->\n`;
  wpContent += `<title>${params.seoMetaTags.titleTag}</title>\n`;
  wpContent += `<meta name="description" content="${params.seoMetaTags.metaDescription}" />\n`;
  wpContent += `<meta property="og:title" content="${params.seoMetaTags.ogTitle}" />\n`;
  wpContent += `<meta property="og:description" content="${params.seoMetaTags.ogDescription}" />\n`;
  wpContent += `<meta property="og:image" content="${params.seoMetaTags.ogImage}" />\n`;
  
  return wpContent;
}
```

---

**作成者**: Manus AI  
**作成日**: 2025年11月19日

この設計書は、SEO記事生成のCSVバッチ処理と自動加工機能の実装方法を詳細に記載しています。実装工数は合計11日（約2週間）と見積もられています。
