# サーバー不安定性の根本原因分析

## 結論

**はい、Manusプラットフォーム向けの当初のコーディングが無理矢理だったため、不安定になっています。**

## 根本原因

### 1. **後付けの条件分岐による複雑化**

Manusプラットフォーム向けに作られたコードを、後からローカル環境に対応させるために、**各所に条件分岐を追加**したことが問題です。

#### 問題のパターン

```typescript
// 問題のあるパターン（現在のコード）
const useLocalWhisper = process.env.USE_LOCAL_WHISPER === "true" || 
                       (process.env.NODE_ENV === "development" && !ENV.forgeApiUrl);

if (useLocalWhisper) {
  // ローカル処理
} else {
  // Manus API処理
  if (!ENV.forgeApiUrl) {
    throw new Error("...");
  }
}
```

**問題点**:
- 条件が複雑で、予期しない動作が発生しやすい
- エラーハンドリングが不統一
- デバッグが困難

### 2. **エラーハンドリングの不統一**

#### 問題箇所1: バックグラウンド処理のエラーが無視される

```typescript
// server/_core/index.ts
startWorker().catch(console.error); // エラーがログに出力されるだけ

// server/routers.ts
processSeoArticleJob(jobId).catch(error => {
  console.error(`[SEO Job ${jobId}] Background processing failed:`, error);
  // エラーが無視される
});
```

**問題点**:
- エラーが発生してもサーバーは続行するが、機能が動作しない
- ユーザーにはエラーが伝わらない
- エラーの原因が特定しにくい

#### 問題箇所2: 非同期処理のエラーが適切に処理されない

```typescript
// server/routers.ts
processYouTubeVideo(input.youtubeUrl)
  .then(async (result) => {
    // 処理...
  })
  .catch(async (error) => {
    console.error("Video processing failed:", error);
    // エラーはログに出力されるだけ
  });
```

**問題点**:
- エラーが発生しても、ユーザーに適切に通知されない
- エラーの詳細が失われる可能性がある

### 3. **環境変数への過度な依存**

各ファイルで個別に環境変数をチェックしているため、設定ミスが発見しにくい。

```typescript
// 各ファイルで個別にチェック
const useLocalStorage = process.env.NODE_ENV === "development" || 
                       process.env.USE_LOCAL_STORAGE === "true";
const useLocalWhisper = process.env.USE_LOCAL_WHISPER === "true" || 
                       (process.env.NODE_ENV === "development" && !ENV.forgeApiUrl);
const useOllama = process.env.USE_OLLAMA === "true" || 
                 (process.env.NODE_ENV === "development" && !ENV.forgeApiKey);
```

**問題点**:
- 条件が複雑で、予期しない動作が発生しやすい
- 環境変数の設定ミスが発見しにくい

### 4. **Connection Failの具体的な原因**

#### 原因1: 未処理の例外でサーバーがクラッシュ

```typescript
// グローバルエラーハンドリングがない（改善前）
// → 予期しないエラーでサーバーが停止
```

#### 原因2: Promise拒否でサーバーが停止

```typescript
// unhandledRejectionハンドラーがない（改善前）
// → 非同期処理のエラーでサーバーが停止
```

#### 原因3: 長時間実行時のタイムアウト

```typescript
// タイムアウト処理がない
// → 長時間実行される処理でサーバーがハング
```

## 改善の方向性

### Phase 1: 設定管理の統一（最優先）

```typescript
// server/_core/config.ts
export class AppConfig {
  static getInstance(): AppConfig {
    // シングルトンパターンで設定を一元管理
  }
  
  readonly useLocalStorage: boolean;
  readonly useLocalWhisper: boolean;
  readonly useOllama: boolean;
  
  // 環境変数の検証とデフォルト値の設定
  private constructor() {
    this.validateAndSetDefaults();
  }
}
```

### Phase 2: サービス抽象化

```typescript
// インターフェースで抽象化
interface LLMService {
  invoke(params: InvokeParams): Promise<InvokeResult>;
}

// ファクトリーパターンで適切な実装を選択
class LLMServiceFactory {
  static create(): LLMService {
    const config = AppConfig.getInstance();
    return config.useOllama 
      ? new OllamaLLMService() 
      : new ForgeLLMService();
  }
}
```

### Phase 3: エラーハンドリングの統一

```typescript
// 統一されたエラーハンドリング
class ErrorHandler {
  static handleBackgroundError(
    promise: Promise<void>,
    context: string
  ): void {
    promise.catch((error) => {
      // エラーを適切に処理（通知、ログ記録、データベースへの記録など）
    });
  }
}
```

## 現在の実装との比較

### 現在の実装（問題あり）

```typescript
// 各所で条件分岐
if (process.env.USE_LOCAL_WHISPER === "true") {
  // ローカルWhisper
} else {
  // Forge API
  if (!ENV.forgeApiUrl) {
    throw new Error("...");
  }
}

// エラーハンドリングが不統一
startWorker().catch(console.error);
processSeoArticleJob(jobId).catch(error => {
  console.error("...", error);
});
```

### 改善後の実装（推奨）

```typescript
// 設定は一度だけ読み込む
const config = AppConfig.getInstance();

// サービスはファクトリーで取得
const llmService = LLMServiceFactory.create();
const result = await llmService.invoke(params);

// エラーハンドリングは統一
ErrorHandler.handleBackgroundError(
  processSeoArticleJob(jobId),
  `SEO Job ${jobId}`
);
```

## 推奨される改善手順

1. **即座に実装**: グローバルエラーハンドリング（✅ 完了）
2. **短期**: 設定管理の統一
3. **中期**: サービス抽象化
4. **長期**: エラーハンドリングの統一

## まとめ

Manusプラットフォームからの移行時に、**「後付けの条件分岐」による無理矢理な対応**が多数存在し、これがサーバーの不安定さの主な原因です。

改善には、以下のアプローチが推奨されます：
1. 設定管理の統一
2. サービス抽象化の実装
3. エラーハンドリングの統一
4. バックグラウンド処理の改善

これらの改善により、コードの保守性と安定性が大幅に向上します。

