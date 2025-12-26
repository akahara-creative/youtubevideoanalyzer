# SEO記事生成 自動加工機能 簡略化実装設計書

**作成者**: Manus AI  
**作成日**: 2025年11月19日  
**目的**: 既存の加工機能を活用したSEO記事生成完了後の自動加工機能の実装

---

## 既存の加工機能の確認結果

既に`server/articleEnhancer.ts`に以下の加工機能が実装されています：

| 機能 | 関数名 | 説明 |
|------|--------|------|
| **スペースキーワード修正** | `fixSpaceKeywords()` | 「」付きスペース繋ぎキーワードを自然な日本語に修正 |
| **AIO要約生成** | `generateAIOSummary()` | AIO（Answer In One）要約セクションを生成 |
| **FAQ生成** | `generateFAQ()` | よくある質問（FAQ）を生成 |
| **JSON-LD生成** | `generateJSONLD()` | 構造化データ（JSON-LD）を生成 |
| **メタ情報生成** | `generateMetaInfo()` | SEOメタタグ（タイトル、ディスクリプション）を生成 |
| **統合加工関数** | `enhanceArticle()` | 上記の全機能を統合して実行 |

また、`server/routers.ts`には既に以下のエンドポイントが実装されています：

- `seoArticle.enhanceJob`: 記事加工エンドポイント（手動実行）
- `seoArticle.exportWordPressHTML`: WordPress用HTMLエクスポート

---

## 簡略化された実装方法

既存の`enhanceArticle()`関数を自動的に呼び出すだけで実現できます。

### 実装難易度

**難易度**: ★☆☆☆☆（非常に低）

**工数**: 0.5日（4時間）

**理由**: 既存の加工機能をSEO記事生成完了時に自動実行するだけなので、実装は非常に簡単です。

---

## 実装手順

### ステップ1: データベーススキーマの拡張

`seoArticleJobs`テーブルに`autoEnhance`フラグを追加します。

```typescript
// drizzle/schema.ts
export const seoArticleJobs = mysqlTable("seoArticleJobs", {
  // 既存のカラム
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  theme: text("theme").notNull(),
  // ...
  
  // 新規追加
  autoEnhance: boolean("autoEnhance").default(false).notNull(),
});
```

### ステップ2: SEO記事生成ジョブプロセッサーの修正

`server/seoArticleJobProcessor.ts`の最後に自動加工処理を追加します。

```typescript
// server/seoArticleJobProcessor.ts

export async function processSeoArticleJob(jobId: number): Promise<void> {
  // ... 既存のSEO記事生成処理（ステップ1〜8）...
  
  // ステップ9: 自動加工処理（autoEnhanceがtrueの場合）
  const job = await getSeoArticleJobById(jobId);
  if (job && job.autoEnhance) {
    console.log(`[SEO Job ${jobId}] Step 9: Auto-enhancing article...`);
    
    try {
      // 既存のenhanceArticle()関数を呼び出し
      const { enhanceArticle } = await import('./articleEnhancer');
      const result = await enhanceArticle(jobId, job.userId, {
        fixKeywords: true,      // スペースキーワード修正
        generateAIO: true,      // AIO要約生成
        generateFAQ: true,      // FAQ生成
        generateJSONLD: true,   // JSON-LD生成
        generateMeta: true,     // メタ情報生成
      });
      
      // 加工結果をデータベースに保存
      const { seoArticleEnhancements } = await import('../drizzle/schema');
      const db = await getDb();
      if (db) {
        await db.insert(seoArticleEnhancements).values({
          jobId,
          userId: job.userId,
          enhancedArticle: result.enhancedArticle,
          aioSummary: result.aioSummary,
          faqSection: result.faqSection,
          jsonLd: result.jsonLd ? JSON.stringify(result.jsonLd) : null,
          metaInfo: result.metaInfo ? JSON.stringify(result.metaInfo) : null,
        });
      }
      
      console.log(`[SEO Job ${jobId}] Auto-enhancement completed`);
    } catch (error) {
      console.error(`[SEO Job ${jobId}] Auto-enhancement failed:`, error);
      // エラーが発生しても記事生成自体は成功しているので、ジョブは完了扱い
    }
  }
  
  // ジョブを完了状態に更新
  await updateSeoArticleJob(jobId, {
    status: "completed",
    progress: 100,
    completedAt: new Date(),
  });
}
```

### ステップ3: フロントエンドUIの修正

`client/src/pages/SEOArticleGeneration.tsx`に自動加工モードのON/OFFスイッチを追加します。

```tsx
// client/src/pages/SEOArticleGeneration.tsx

export function SEOArticleForm() {
  const [theme, setTheme] = useState("");
  const [targetWordCount, setTargetWordCount] = useState(3000);
  const [authorName, setAuthorName] = useState("");
  const [autoEnhance, setAutoEnhance] = useState(false); // 新規追加
  
  const createJob = trpc.seoArticle.createJob.useMutation({
    onSuccess: (data) => {
      toast.success("SEO記事生成を開始しました");
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createJob.mutate({
      theme,
      targetWordCount,
      authorName,
      autoEnhance, // 新規追加
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* テーマ、文字数、筆者名の入力フィールド */}
      
      <div className="flex items-center gap-2">
        <Switch
          checked={autoEnhance}
          onCheckedChange={setAutoEnhance}
        />
        <Label>
          自動加工モード
          <span className="text-sm text-gray-500 ml-2">
            （記事生成後、自動的にAIO要約・FAQ・JSON-LD・メタ情報を生成）
          </span>
        </Label>
      </div>
      
      <Button type="submit" disabled={createJob.isLoading}>
        {createJob.isLoading ? "生成中..." : "生成開始"}
      </Button>
    </form>
  );
}
```

### ステップ4: tRPCルーターの修正

`server/routers.ts`の`seoArticle.createJob`エンドポイントに`autoEnhance`パラメータを追加します。

```typescript
// server/routers.ts

seoArticle: router({
  createJob: protectedProcedure
    .input(z.object({
      theme: z.string(),
      targetWordCount: z.number().default(3000),
      authorName: z.string().default("赤原"),
      autoEnhance: z.boolean().default(false), // 新規追加
    }))
    .mutation(async ({ ctx, input }) => {
      const jobId = await createSeoArticleJob({
        userId: ctx.user.id,
        theme: input.theme,
        targetWordCount: input.targetWordCount,
        authorName: input.authorName,
        autoEnhance: input.autoEnhance, // 新規追加
        status: "pending",
        progress: 0,
      });
      
      // バックグラウンドジョブを開始
      processSeoArticleJob(jobId).catch(error => {
        console.error(`Failed to process SEO article job ${jobId}:`, error);
      });
      
      return { jobId };
    }),
  
  // 既存のエンドポイント...
}),
```

---

## CSVバッチ処理との統合

CSVバッチ処理でも自動加工モードを使用できるようにします。

### CSV形式の拡張

```csv
テーマ,文字数,筆者名,自動加工
"副業で月10万円稼ぐ方法",3000,"山田太郎",true
"在宅ワークの始め方",2500,"山田太郎",false
"フリーランスの確定申告",4000,"佐藤花子",true
```

### CSVパース処理の修正

```typescript
export async function parseCSV(csvContent: string): Promise<Array<{
  theme: string;
  targetWordCount: number;
  authorName: string;
  autoEnhance: boolean; // 新規追加
}>> {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });
  
  return result.data.map((row: any) => ({
    theme: row["テーマ"],
    targetWordCount: parseInt(row["文字数"]) || 3000,
    authorName: row["筆者名"],
    autoEnhance: row["自動加工"] === "true" || row["自動加工"] === "TRUE", // 新規追加
  }));
}
```

---

## 実装スケジュール

| タスク | 工数 |
|--------|------|
| データベーススキーマの拡張 | 0.5時間 |
| SEO記事生成ジョブプロセッサーの修正 | 1時間 |
| フロントエンドUIの修正 | 1時間 |
| tRPCルーターの修正 | 0.5時間 |
| CSVバッチ処理との統合 | 0.5時間 |
| テスト・デバッグ | 0.5時間 |
| **合計** | **4時間（0.5日）** |

---

## 動作フロー

### 手動実行の場合

1. ユーザーがSEO記事生成フォームで「自動加工モード」をONにする
2. テーマ、文字数、筆者名を入力して「生成開始」をクリック
3. バックグラウンドでSEO記事生成（ステップ1〜8）が実行される
4. 記事生成完了後、自動的に`enhanceArticle()`が実行される
5. 加工結果が`seoArticleEnhancements`テーブルに保存される
6. ユーザーは記事一覧画面で「WordPress形式でダウンロード」をクリック
7. 加工済みの記事がWordPress用HTMLとしてダウンロードされる

### CSVバッチ処理の場合

1. ユーザーがCSVファイルをアップロード（「自動加工」列にtrue/falseを指定）
2. 各行に対してSEO記事生成ジョブが作成される
3. バックグラウンドで順次処理される
4. 「自動加工」がtrueの行は、記事生成完了後に自動的に加工処理が実行される
5. 全ジョブ完了後、ユーザーは一覧画面で各記事をダウンロード

---

## 技術的な注意点

### 注意点1: 加工処理のエラーハンドリング

加工処理でエラーが発生しても、記事生成自体は成功しているため、ジョブは完了扱いにします。エラーログは記録しますが、ユーザーには「記事生成完了（加工処理は失敗）」と表示します。

```typescript
try {
  const result = await enhanceArticle(jobId, job.userId, { ... });
  // 成功時の処理
} catch (error) {
  console.error(`[SEO Job ${jobId}] Auto-enhancement failed:`, error);
  // エラーログを記録するが、ジョブは完了扱い
}
```

### 注意点2: 加工処理の実行時間

加工処理（AIO要約、FAQ、JSON-LD、メタ情報の生成）は、LLM APIを複数回呼び出すため、1〜2分程度かかります。ユーザーには「加工処理中...」と表示し、進捗状況を更新します。

```typescript
// 進捗状況の更新
await updateSeoArticleJob(jobId, {
  currentStep: "加工処理中（AIO要約生成）",
  progress: 85,
});
```

### 注意点3: 加工結果の保存先

加工結果は`seoArticleEnhancements`テーブルに保存されます。このテーブルは既に実装されており、以下のカラムがあります：

- `enhancedArticle`: 加工後の記事本文
- `aioSummary`: AIO要約
- `faqSection`: FAQ
- `jsonLd`: JSON-LD構造化データ
- `metaInfo`: SEOメタ情報

---

## まとめ

既存の`enhanceArticle()`関数を活用することで、自動加工機能は**0.5日（4時間）**で実装できます。新たに実装する必要がある機能は以下のみです：

1. `autoEnhance`フラグの追加（データベース、フロントエンド、バックエンド）
2. SEO記事生成完了後に`enhanceArticle()`を自動実行する処理

これにより、ユーザーは「自動加工モード」をONにするだけで、記事生成完了後に自動的にAIO要約、FAQ、JSON-LD、メタ情報が生成され、WordPress用HTMLとしてダウンロードできるようになります。

---

**作成者**: Manus AI  
**作成日**: 2025年11月19日
