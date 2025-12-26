# 実用的なアプローチ：機能を失わずに安定性を向上

## 方針

**「設定管理の統一」は後回しにして、まずは「エラーの原因となるもの」を特定して修正する**

## 現状の問題点

### 1. バックグラウンドジョブのエラー処理が不十分

**問題箇所**:
- `server/routers.ts` (1529行目): `processSeoArticleJob(jobId).catch(error => { console.error(...) })`
- `server/routers.ts` (1942行目): バッチ処理でも同様

**問題**:
- エラーがログに出力されるだけで、ユーザーに通知されない
- エラーの詳細が失われる
- ジョブの状態が「pending」のまま残る可能性がある

### 2. 環境変数のチェックロジックが重複

**問題箇所**:
- `server/_core/llm.ts`: `process.env.USE_OLLAMA === "true" || (process.env.NODE_ENV === "development" && !ENV.forgeApiKey)`
- `server/storage.ts`: `process.env.USE_LOCAL_STORAGE === 'true' || process.env.NODE_ENV === 'development'`
- `server/_core/voiceTranscription.ts`: `process.env.USE_LOCAL_WHISPER === "true" || (process.env.NODE_ENV === "development" && !ENV.forgeApiUrl)`

**問題**:
- 同じロジックが各所に散在している
- 修正時に複数箇所を変更する必要がある
- ただし、これは「エラーの原因」というより「保守性の問題」

## 優先順位

### 最優先：エラーハンドリングの改善（1-2時間）

**理由**:
- これが「connection fail」などのエラーの直接的な原因になっている可能性が高い
- 修正が簡単で、既存の機能に影響を与えない
- ユーザー体験を直接改善する

**対応内容**:
1. バックグラウンドジョブのエラーを適切に処理
2. エラーログを改善（スタックトレースを含める）
3. ジョブの状態を確実に「failed」に更新

### 中優先：環境変数チェックの簡素化（2-3時間）

**理由**:
- エラーの直接的な原因ではないが、将来的なバグの原因になる可能性がある
- 修正が簡単で、既存の機能に影響を与えない

**対応内容**:
1. 環境変数のチェックロジックを1つの関数に集約
2. 各所でその関数を呼び出すように変更

### 低優先：設定管理の完全統一（1-2週間）

**理由**:
- 現状でも動作している
- 大きなリファクタリングが必要
- 既存の機能に影響を与える可能性がある

**対応内容**:
- 必要になったら実装（現時点では不要）

## 実装計画

### Step 1: エラーハンドリングの改善（今すぐ実装）

```typescript
// server/_core/errorHandler.ts (新規作成)
export class ErrorHandler {
  static async handleBackgroundError<T>(
    promise: Promise<T>,
    context: string
  ): Promise<T | null> {
    try {
      return await promise;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error(`[${context}] Error:`, errorMessage);
      if (errorStack) {
        console.error(`[${context}] Stack:`, errorStack);
      }
      
      // 必要に応じて、ジョブの状態を更新する処理を追加
      // 例: await updateJobStatus(jobId, "failed", errorMessage);
      
      return null;
    }
  }
}
```

**使用例**:
```typescript
// 改善前
processSeoArticleJob(jobId).catch(error => {
  console.error(`[SEO Job ${jobId}] Background processing failed:`, error);
});

// 改善後
ErrorHandler.handleBackgroundError(
  processSeoArticleJob(jobId),
  `SEO Job ${jobId}`
);
```

### Step 2: 環境変数チェックの簡素化（必要に応じて）

```typescript
// server/_core/env.ts に追加
export function shouldUseLocalService(serviceName: 'storage' | 'whisper' | 'ollama'): boolean {
  const envKey = `USE_LOCAL_${serviceName.toUpperCase()}`;
  const envValue = process.env[envKey];
  
  if (envValue === "true") {
    return true;
  }
  
  if (process.env.NODE_ENV === "development") {
    // 開発環境で、Forge APIが設定されていない場合はローカルを使用
    return !ENV.forgeApiUrl || !ENV.forgeApiKey;
  }
  
  return false;
}
```

**使用例**:
```typescript
// 改善前
const useLocalWhisper = process.env.USE_LOCAL_WHISPER === "true" || 
                       (process.env.NODE_ENV === "development" && !ENV.forgeApiUrl);

// 改善後
const useLocalWhisper = shouldUseLocalService('whisper');
```

## 結論

**今すぐ実装すべきこと**:
1. ✅ エラーハンドリングの改善（1-2時間）
2. ⚠️ 環境変数チェックの簡素化（必要に応じて、2-3時間）

**後回しにして良いこと**:
- 設定管理の完全統一（AppConfigクラスなど）
- サービス抽象化（LLMServiceFactoryなど）

**理由**:
- 現状でも動作している
- 大きなリファクタリングが必要
- 既存の機能に影響を与える可能性がある
- 追加開発を続けながら、必要に応じて段階的に改善できる

