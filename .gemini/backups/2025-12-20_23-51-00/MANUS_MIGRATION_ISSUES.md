# Manusプラットフォームからの移行時の問題点と改善案

## 問題の本質

Manusプラットフォーム向けに作られたコードをローカル環境に移植する際、**「後付けの条件分岐」による無理矢理な対応**が多数存在し、これがサーバーの不安定さの原因となっています。

## 具体的な問題点

### 1. **条件分岐の多用による複雑化**

#### 問題箇所1: LLM呼び出し (`server/_core/llm.ts`)
```typescript
// 問題: 条件分岐が多く、エラーハンドリングが不統一
const useOllama = process.env.USE_OLLAMA === "true" || 
                  (process.env.NODE_ENV === "development" && !ENV.forgeApiKey);

if (useOllama) {
  try {
    return await invokeOllama(params);
  } catch (error) {
    console.error("[LLM] Ollama failed, falling back to Forge API:", error);
    // フォールバック処理が続くが、エラーが無視される
  }
}

assertApiKey(); // ここでエラーが発生する可能性
```

**問題点**:
- Ollamaが失敗しても、Forge APIキーがない場合に`assertApiKey()`でエラーが発生
- エラーハンドリングが不統一で、予期しない動作が発生しやすい

#### 問題箇所2: ストレージ (`server/storage.ts`)
```typescript
// 問題: 条件分岐による分岐が複雑
if (!baseUrl || !apiKey) {
  if (process.env.NODE_ENV === 'development' || process.env.USE_LOCAL_STORAGE === 'true') {
    return null; // ローカルストレージを使用
  }
  throw new Error("Storage proxy credentials missing...");
}
```

**問題点**:
- 条件が複雑で、予期しない動作が発生しやすい
- エラーメッセージが不十分

### 2. **非同期処理のエラーハンドリング不足**

#### 問題箇所1: バックグラウンド処理 (`server/_core/index.ts`)
```typescript
// 問題: エラーが無視される
const { startWorker } = await import("../videoGenerationWorker");
startWorker().catch(console.error); // エラーがログに出力されるだけ
```

**問題点**:
- エラーが発生してもサーバーは続行するが、機能が動作しない
- ユーザーにはエラーが伝わらない

#### 問題箇所2: 動画分析のバックグラウンド処理 (`server/routers.ts`)
```typescript
// 問題: エラーが適切に処理されない
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

### 3. **エラーハンドリングの不統一**

#### 問題箇所: 複数のエラーハンドリングパターンが混在
- `try-catch`で適切に処理されている箇所
- `.catch(console.error)`で無視されている箇所
- エラーハンドリングがない箇所

**問題点**:
- エラーの伝播が予測不可能
- デバッグが困難

### 4. **環境変数への過度な依存**

#### 問題箇所: 環境変数のチェックが各所に散在
```typescript
// 各ファイルで個別に環境変数をチェック
const useLocalWhisper = process.env.USE_LOCAL_WHISPER === "true" || 
                        (process.env.NODE_ENV === "development" && !ENV.forgeApiUrl);
```

**問題点**:
- 条件が複雑で、予期しない動作が発生しやすい
- 環境変数の設定ミスが発見しにくい

## 改善案

### 1. **統一された設定管理の実装**

```typescript
// server/_core/config.ts (新規作成)
export class AppConfig {
  private static instance: AppConfig;
  
  readonly useLocalStorage: boolean;
  readonly useLocalWhisper: boolean;
  readonly useOllama: boolean;
  readonly ollamaModel: string;
  readonly ollamaVisionModel: string;
  
  private constructor() {
    // 環境変数を一度だけ読み込んで検証
    this.useLocalStorage = this.shouldUseLocalStorage();
    this.useLocalWhisper = this.shouldUseLocalWhisper();
    this.useOllama = this.shouldUseOllama();
    // ...
  }
  
  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }
  
  private shouldUseLocalStorage(): boolean {
    // 統一されたロジック
  }
}
```

### 2. **統一されたエラーハンドリング**

```typescript
// server/_core/errorHandler.ts (新規作成)
export class ErrorHandler {
  static handleAsyncError<T>(
    promise: Promise<T>,
    context: string
  ): Promise<T> {
    return promise.catch((error) => {
      console.error(`[${context}] Error:`, error);
      // エラーを適切に処理（通知、ログ記録など）
      throw error; // エラーを再スローして、呼び出し元で処理
    });
  }
  
  static handleBackgroundError(
    promise: Promise<void>,
    context: string
  ): void {
    promise.catch((error) => {
      console.error(`[${context}] Background error:`, error);
      // バックグラウンド処理のエラーを適切に処理
      // 必要に応じて、データベースにエラーを記録
    });
  }
}
```

### 3. **サービス抽象化の実装**

```typescript
// server/_core/services/llmService.ts (新規作成)
export interface LLMService {
  invoke(params: InvokeParams): Promise<InvokeResult>;
}

export class OllamaLLMService implements LLMService {
  async invoke(params: InvokeParams): Promise<InvokeResult> {
    // Ollama実装
  }
}

export class ForgeLLMService implements LLMService {
  async invoke(params: InvokeParams): Promise<InvokeResult> {
    // Forge API実装
  }
}

export class LLMServiceFactory {
  static create(): LLMService {
    const config = AppConfig.getInstance();
    if (config.useOllama) {
      return new OllamaLLMService();
    }
    return new ForgeLLMService();
  }
}
```

### 4. **バックグラウンド処理の改善**

```typescript
// server/_core/backgroundProcessor.ts (新規作成)
export class BackgroundProcessor {
  private static activeJobs = new Map<number, Promise<void>>();
  
  static async processWithErrorHandling<T>(
    jobId: number,
    processor: () => Promise<T>,
    onError: (error: Error) => Promise<void>
  ): Promise<void> {
    const job = processor()
      .catch(async (error) => {
        await onError(error);
        throw error;
      });
    
    this.activeJobs.set(jobId, job);
    
    try {
      await job;
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
}
```

## 推奨される改善手順

1. **Phase 1: 設定管理の統一**
   - `AppConfig`クラスの実装
   - 環境変数の検証とデフォルト値の設定

2. **Phase 2: エラーハンドリングの統一**
   - `ErrorHandler`クラスの実装
   - 既存のエラーハンドリングを統一

3. **Phase 3: サービス抽象化**
   - LLM、ストレージ、音声文字起こしなどのサービスを抽象化
   - ファクトリーパターンで適切な実装を選択

4. **Phase 4: バックグラウンド処理の改善**
   - 統一されたバックグラウンド処理フレームワークの実装
   - エラーハンドリングとリトライロジックの改善

## 現在の実装との比較

### 現在の実装（問題あり）
```typescript
// 各所で条件分岐
if (process.env.USE_LOCAL_WHISPER === "true") {
  // ローカルWhisper
} else {
  // Forge API
}

// エラーハンドリングが不統一
startWorker().catch(console.error);
```

### 改善後の実装（推奨）
```typescript
// 設定は一度だけ読み込む
const config = AppConfig.getInstance();

// サービスはファクトリーで取得
const llmService = LLMServiceFactory.create();
const result = await llmService.invoke(params);

// エラーハンドリングは統一
BackgroundProcessor.processWithErrorHandling(
  jobId,
  () => processJob(jobId),
  (error) => handleJobError(jobId, error)
);
```

## 結論

Manusプラットフォームからの移行時に、**「後付けの条件分岐」による無理矢理な対応**が多数存在し、これがサーバーの不安定さの主な原因です。

改善には、以下のアプローチが推奨されます：
1. 設定管理の統一
2. エラーハンドリングの統一
3. サービス抽象化の実装
4. バックグラウンド処理の改善

これらの改善により、コードの保守性と安定性が大幅に向上します。

