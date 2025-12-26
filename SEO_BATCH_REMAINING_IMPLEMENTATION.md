# SEO記事生成のCSVバッチ処理・自動加工モード - 残りの実装手順

## 完了した実装

### バックエンド（100%完了）
- ✅ データベーススキーマ拡張（`autoEnhance`、`batchId`、`completedAt`カラム）
- ✅ 自動加工処理（`server/seoArticleJobProcessor.ts`）
- ✅ CSVパーサー（`server/csvParser.ts`）
- ✅ tRPCエンドポイント
  - `seoArticle.createJob`に`autoEnhance`パラメータを追加
  - `seoArticle.createBatchJob`（CSVバッチ処理）
  - `seoArticle.getBatchJobs`（ジョブ一覧取得）
  - `seoArticle.downloadBatch`（一括ダウンロード）

### フロントエンド（30%完了）
- ✅ CSVBatchUploadコンポーネント（`client/src/components/CSVBatchUpload.tsx`）
- ❌ JobListコンポーネント（未実装）
- ❌ SEOArticle.tsxへの統合（未実装）

---

## 残りの実装手順

### Step 1: JobListコンポーネントの作成

**ファイル**: `client/src/components/JobList.tsx`

**実装内容**:
```typescript
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface JobListProps {
  batchId?: string;
}

export default function JobList({ batchId }: JobListProps) {
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  
  const { data: jobs = [], refetch } = trpc.seoArticle.getBatchJobs.useQuery(
    { batchId },
    { refetchInterval: 3000 } // 3秒ごとにポーリング
  );

  const downloadBatchMutation = trpc.seoArticle.downloadBatch.useMutation({
    onSuccess: (data) => {
      // Base64をBlobに変換してダウンロード
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("ダウンロードを開始しました");
    },
    onError: (error) => {
      toast.error(`ダウンロードエラー: ${error.message}`);
    }
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(jobs.map(job => job.id));
    } else {
      setSelectedJobIds([]);
    }
  };

  const handleSelectJob = (jobId: number, checked: boolean) => {
    if (checked) {
      setSelectedJobIds([...selectedJobIds, jobId]);
    } else {
      setSelectedJobIds(selectedJobIds.filter(id => id !== jobId));
    }
  };

  const handleDownloadSelected = () => {
    if (selectedJobIds.length === 0) {
      toast.error("ダウンロードするジョブを選択してください");
      return;
    }
    downloadBatchMutation.mutate({ jobIds: selectedJobIds });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />完了</Badge>;
      case "processing":
        return <Badge variant="default" className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />処理中</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />待機中</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />失敗</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // 統計情報を計算
  const stats = {
    total: jobs.length,
    completed: jobs.filter(j => j.status === "completed").length,
    processing: jobs.filter(j => j.status === "processing").length,
    pending: jobs.filter(j => j.status === "pending").length,
    failed: jobs.filter(j => j.status === "failed").length,
  };

  return (
    <div className="space-y-4">
      {/* 統計情報 */}
      <Card>
        <CardHeader>
          <CardTitle>ジョブ統計</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">総数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-sm text-muted-foreground">完了</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
              <div className="text-sm text-muted-foreground">処理中</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">待機中</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-sm text-muted-foreground">失敗</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ジョブ一覧 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>ジョブ一覧</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedJobIds.length === jobs.length && jobs.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm">全選択</span>
            </div>
            <Button
              size="sm"
              onClick={handleDownloadSelected}
              disabled={selectedJobIds.length === 0 || downloadBatchMutation.isPending}
            >
              <Download className="w-4 h-4 mr-2" />
              選択したジョブをダウンロード ({selectedJobIds.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {jobs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">ジョブがありません</p>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedJobIds.includes(job.id)}
                    onCheckedChange={(checked) => handleSelectJob(job.id, checked as boolean)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium truncate">{job.theme}</h4>
                      {getStatusBadge(job.status)}
                      {job.autoEnhance === 1 && (
                        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950">
                          自動加工
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{job.targetWordCount}文字</span>
                      <span>{job.authorName}</span>
                      <span>ステップ {job.currentStep}/8</span>
                      {job.status === "processing" && (
                        <span className="text-blue-600">進捗: {job.progress}%</span>
                      )}
                    </div>
                  </div>
                  {job.status === "completed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadBatchMutation.mutate({ jobIds: [job.id] })}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      ダウンロード
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### Step 2: SEOArticle.tsxへの統合

**ファイル**: `client/src/pages/SEOArticle.tsx`

**変更内容**:

1. **インポートを追加**（ファイルの先頭）:
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CSVBatchUpload from "@/components/CSVBatchUpload";
import JobList from "@/components/JobList";
import { Switch } from "@/components/ui/switch";
```

2. **ステート変数を追加**（`export default function SEOArticle()`の直後）:
```typescript
const [activeTab, setActiveTab] = useState<"single" | "batch">("single");
const [autoEnhance, setAutoEnhance] = useState(false);
```

3. **createJobMutationを修正**（既存のコードを置き換え）:
```typescript
const createJobMutation = trpc.seoArticle.createJob.useMutation({
  onSuccess: (data) => {
    setCurrentJobId(data.jobId);
    setCurrentStep(1);
    toast.success("記事生成を開始しました！");
  },
  onError: (error) => {
    toast.error(`エラー: ${error.message}`);
  }
});
```

4. **handleGenerateArticle関数を修正**（既存のコードを置き換え）:
```typescript
const handleGenerateArticle = () => {
  if (!theme) {
    toast.error("テーマを入力してください");
    return;
  }
  
  createJobMutation.mutate({
    theme,
    targetWordCount,
    authorName,
    autoEnhance, // 自動加工フラグを追加
  });
};
```

5. **UIを修正**（returnの中の既存のフォーム部分を置き換え）:
```typescript
return (
  <div className="container mx-auto py-8">
    <div className="mb-8">
      <h1 className="text-3xl font-bold">SEO記事生成</h1>
      <p className="text-muted-foreground mt-2">
        テーマを入力して、SEO最適化された記事を自動生成します
      </p>
    </div>

    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "single" | "batch")}>
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="single">単一生成</TabsTrigger>
        <TabsTrigger value="batch">バッチ生成</TabsTrigger>
      </TabsList>

      <TabsContent value="single">
        {/* 既存の単一生成フォーム */}
        <Card>
          <CardHeader>
            <CardTitle>記事生成設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* テーマ入力 */}
            <div>
              <Label htmlFor="theme">テーマ</Label>
              <Input
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="例: AIツールの選び方"
              />
            </div>

            {/* 文字数 */}
            <div>
              <Label htmlFor="wordCount">目標文字数</Label>
              <Input
                id="wordCount"
                type="number"
                value={targetWordCount}
                onChange={(e) => setTargetWordCount(Number(e.target.value))}
              />
            </div>

            {/* 筆者名 */}
            <div>
              <Label htmlFor="author">筆者名</Label>
              <Input
                id="author"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
              />
            </div>

            {/* 自動加工モード */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="autoEnhance">自動加工モード</Label>
                <p className="text-sm text-muted-foreground">
                  記事生成完了後、自動的にAIO要約・FAQ・JSON-LD・メタ情報を生成します
                </p>
              </div>
              <Switch
                id="autoEnhance"
                checked={autoEnhance}
                onCheckedChange={setAutoEnhance}
              />
            </div>

            {/* 生成ボタン */}
            <Button
              className="w-full"
              onClick={handleGenerateArticle}
              disabled={createJobMutation.isPending || !theme}
            >
              {createJobMutation.isPending ? "生成中..." : "記事を生成"}
            </Button>
          </CardContent>
        </Card>

        {/* 既存の進捗表示・結果表示部分はそのまま残す */}
      </TabsContent>

      <TabsContent value="batch">
        <CSVBatchUpload />
      </TabsContent>
    </Tabs>

    {/* ジョブ一覧（タブの外に配置） */}
    <div className="mt-8">
      <JobList />
    </div>

    {/* 既存の履歴ダイアログなどはそのまま残す */}
  </div>
);
```

---

### Step 3: Switchコンポーネントの追加（shadcn/ui）

shadcn/uiのSwitchコンポーネントが未インストールの場合、以下のコマンドで追加：

```bash
cd /home/ubuntu/youtube-video-analyzer
npx shadcn@latest add switch
```

---

### Step 4: Checkboxコンポーネントの追加（shadcn/ui）

shadcn/uiのCheckboxコンポーネントが未インストールの場合、以下のコマンドで追加：

```bash
cd /home/ubuntu/youtube-video-analyzer
npx shadcn@latest add checkbox
```

---

### Step 5: Tabsコンポーネントの追加（shadcn/ui）

shadcn/uiのTabsコンポーネントが未インストールの場合、以下のコマンドで追加：

```bash
cd /home/ubuntu/youtube-video-analyzer
npx shadcn@latest add tabs
```

---

## テスト手順

### 1. 単一生成のテスト
1. SEO記事生成ページにアクセス
2. 「単一生成」タブを選択
3. テーマ、文字数、筆者名を入力
4. 「自動加工モード」をONにする
5. 「記事を生成」ボタンをクリック
6. ジョブ一覧に新しいジョブが表示されることを確認
7. ジョブのステータスが「処理中」→「完了」に変わることを確認
8. 完了後、ダウンロードボタンが表示されることを確認

### 2. CSVバッチ処理のテスト
1. 以下の内容でCSVファイルを作成（`test_batch.csv`）:
```csv
テーマ,文字数,筆者名,自動加工
AIツールの選び方,5000,赤原,true
SEO対策の基本,3000,赤原,false
マーケティング戦略,4000,山田,true
```

2. 「バッチ生成」タブを選択
3. CSVファイルをドラッグ&ドロップまたは選択
4. 「バッチ生成を開始」ボタンをクリック
5. ジョブ一覧に3件のジョブが表示されることを確認
6. 全てのジョブが完了するまで待機
7. チェックボックスで複数のジョブを選択
8. 「選択したジョブをダウンロード」ボタンをクリック
9. ZIPファイルがダウンロードされることを確認

### 3. 自動加工モードのテスト
1. 自動加工モードONで記事を生成
2. 記事生成完了後、データベースの`seoArticleEnhancements`テーブルを確認
3. 該当ジョブIDの加工データが保存されていることを確認

```sql
SELECT * FROM seoArticleEnhancements WHERE jobId = <ジョブID>;
```

---

## トラブルシューティング

### エラー: "CSV解析エラー: テーマが指定されていない行があります"
**原因**: CSVファイルのヘッダー行が正しくないか、空行が含まれている  
**解決策**: CSVファイルのフォーマットを確認し、ヘッダー行を正しく設定する

### エラー: "Database not available"
**原因**: データベース接続が確立されていない  
**解決策**: `DATABASE_URL`環境変数が正しく設定されているか確認

### ジョブが「処理中」のまま進まない
**原因**: バックグラウンドジョブプロセッサーがエラーで停止している  
**解決策**: サーバーログを確認し、エラーメッセージを特定する

```bash
cd /home/ubuntu/youtube-video-analyzer
pnpm dev
# ログを確認
```

### ダウンロードしたZIPファイルが開けない
**原因**: Base64デコードエラーまたはZIP生成エラー  
**解決策**: ブラウザのコンソールログを確認し、エラーメッセージを特定する

---

## 今後の拡張案

1. **バッチジョブのキャンセル機能**
   - 処理中のジョブをキャンセルできるようにする
   - `seoArticle.cancelJob`エンドポイントを追加

2. **バッチジョブの優先度設定**
   - 重要なジョブを優先的に処理できるようにする
   - `priority`カラムをデータベースに追加

3. **バッチジョブの進捗通知**
   - バッチ全体の進捗をメールやSlackで通知
   - `notifyOwner`関数を活用

4. **CSVテンプレートのダウンロード**
   - ユーザーがCSVフォーマットを簡単に理解できるように、テンプレートファイルを提供
   - ダウンロードボタンを追加

5. **バッチジョブの履歴管理**
   - 過去のバッチジョブを検索・フィルタリングできるようにする
   - バッチIDでグループ化して表示

---

## まとめ

このドキュメントに従って実装を完了すれば、SEO記事生成機能にCSVバッチ処理と自動加工モードが完全に統合されます。

**実装時間の目安**:
- Step 1（JobListコンポーネント）: 2時間
- Step 2（SEOArticle.tsxへの統合）: 1時間
- Step 3-5（shadcn/uiコンポーネント追加）: 30分
- テスト: 1時間

**合計**: 約4.5時間
