# Manusからローカル環境への移行戦略

## 結論

**Manusのコードをローカル環境に引き継ぐことは可能ですが、段階的なリファクタリングが必要です。**

完全に書き直す必要はありませんが、**「後付けの条件分岐」を「適切な抽象化」に置き換える**ことで、安定性と保守性を大幅に向上させることができます。

## 現状分析

### 実装済み機能とManus依存度

| 機能 | Manus依存度 | ローカル対応状況 | 優先度 |
|------|------------|----------------|--------|
| **動画分析機能** | 中 | ✅ 部分的対応済み | 高 |
| **SEO記事生成機能** | 高 | ⚠️ 未対応 | 高 |
| **SEOバッチ処理** | 高 | ⚠️ 未対応 | 中 |
| **動画生成機能** | 高 | ⚠️ 未対応 | 中 |

### Manus APIへの依存箇所

1. **LLM呼び出し** (`server/_core/llm.ts`)
   - ✅ **対応済み**: Ollama統合完了
   - 残課題: 一部の関数で直接Forge APIを呼び出している

2. **音声文字起こし** (`server/_core/voiceTranscription.ts`)
   - ✅ **対応済み**: faster-whisper統合完了

3. **ストレージ** (`server/storage.ts`)
   - ✅ **対応済み**: ローカルファイルシステム対応完了

4. **画像生成** (`server/_core/imageGeneration.ts`)
   - ⚠️ **未対応**: 完全にManus APIに依存

5. **SEO記事生成** (`server/seoArticleGenerator.ts`)
   - ⚠️ **未対応**: `invokeLLM`を使用しているが、一部で直接Forge APIを呼び出している可能性

6. **動画生成** (`server/videoGenerator.ts`, `server/videoGenerationWorker.ts`)
   - ⚠️ **未対応**: 画像生成、音声生成などでManus APIに依存

## 段階的リファクタリング戦略

### Phase 1: 基盤の整備（1-2週間）

#### 1.1 設定管理の統一

```typescript
// server/_core/config.ts (新規作成)
export class AppConfig {
  private static instance: AppConfig;
  
  // ストレージ設定
  readonly useLocalStorage: boolean;
  
  // LLM設定
  readonly useOllama: boolean;
  readonly ollamaModel: string;
  readonly ollamaVisionModel: string;
  
  // 音声文字起こし設定
  readonly useLocalWhisper: boolean;
  
  // 画像生成設定
  readonly useLocalImageGeneration: boolean;
  
  private constructor() {
    // 環境変数を一度だけ読み込んで検証
    this.validateAndSetDefaults();
  }
  
  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }
  
  private validateAndSetDefaults(): void {
    // 統一されたロジックで設定を決定
    const isDev = process.env.NODE_ENV === "development";
    const hasForgeApi = !!(process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY);
    
    this.useLocalStorage = process.env.USE_LOCAL_STORAGE === "true" || (isDev && !hasForgeApi);
    this.useOllama = process.env.USE_OLLAMA === "true" || (isDev && !hasForgeApi);
    this.useLocalWhisper = process.env.USE_LOCAL_WHISPER === "true" || (isDev && !hasForgeApi);
    // ...
  }
}
```

#### 1.2 サービス抽象化の実装

```typescript
// server/_core/services/llmService.ts
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
    return config.useOllama 
      ? new OllamaLLMService() 
      : new ForgeLLMService();
  }
}
```

**効果**:
- 条件分岐が1箇所に集約される
- テストが容易になる
- 新しい実装を追加しやすくなる

### Phase 2: 既存機能のリファクタリング（2-3週間）

#### 2.1 動画分析機能の完全対応

**現状**: 部分的に対応済み
**残課題**:
- 画像分析（Visionモデル）の完全対応
- エラーハンドリングの改善

**対応方法**:
```typescript
// server/videoProcessor.ts
// 既存のコードをそのまま使用
// invokeLLMが自動的にOllamaを使用するため、追加の変更は不要
```

#### 2.2 SEO記事生成機能の対応

**現状**: `invokeLLM`を使用しているため、基本的には動作する
**残課題**:
- 一部の関数で直接Forge APIを呼び出している可能性
- エラーハンドリングの改善

**対応方法**:
```typescript
// server/seoArticleGenerator.ts
// invokeLLMを使用している箇所は自動的にOllamaを使用
// 直接Forge APIを呼び出している箇所があれば、invokeLLMに置き換え
```

#### 2.3 バッチ処理の改善

**現状**: エラーハンドリングが不十分
**対応方法**:
```typescript
// server/seoArticleJobProcessor.ts
// エラーハンドリングを統一
// プログレス更新の改善
```

### Phase 3: 新機能の追加（必要に応じて）

#### 3.1 画像生成のローカル対応

**現状**: 完全にManus APIに依存
**対応方法**:
- Stable Diffusionなどのローカル画像生成ツールを使用
- または、画像生成機能を一時的に無効化

#### 3.2 動画生成機能の完全対応

**現状**: 基盤は実装済み
**対応方法**:
- 画像生成部分をローカル対応
- 音声生成部分をローカル対応（VoiceVoxなど）

## 実装の優先順位

### 最優先（即座に実装）

1. ✅ **グローバルエラーハンドリング** - 完了
2. ✅ **ローカルストレージ** - 完了
3. ✅ **ローカルWhisper** - 完了
4. ✅ **Ollama LLM統合** - 完了

### 高優先度（1-2週間以内）

1. **設定管理の統一** (`AppConfig`クラス)
2. **サービス抽象化** (LLM、ストレージ、音声文字起こし)
3. **SEO記事生成機能の動作確認と修正**

### 中優先度（2-4週間以内）

1. **バッチ処理のエラーハンドリング改善**
2. **動画生成機能の部分対応**（画像生成以外）

### 低優先度（必要に応じて）

1. **画像生成のローカル対応**
2. **動画生成機能の完全対応**

## リファクタリングのアプローチ

### アプローチ1: 段階的置き換え（推奨）

**メリット**:
- 既存の機能を壊さない
- 段階的に改善できる
- リスクが低い

**手順**:
1. 新しい抽象化レイヤーを追加
2. 既存のコードを段階的に新しいレイヤーを使用するように変更
3. テストして動作確認
4. 古いコードを削除

### アプローチ2: 一括書き直し（非推奨）

**デメリット**:
- 既存の機能が一時的に動作しなくなる
- リスクが高い
- 時間がかかる

## 具体的な実装例

### 例1: SEO記事生成機能の改善

```typescript
// 改善前（現在のコード）
export async function generateSEOArticle(...) {
  const response = await invokeLLM({
    messages: [...],
  });
  // ...
}

// 改善後（サービス抽象化後）
export async function generateSEOArticle(...) {
  const llmService = LLMServiceFactory.create();
  const response = await llmService.invoke({
    messages: [...],
  });
  // ...
}
```

**変更点**: 最小限（`invokeLLM`を`llmService.invoke`に置き換えるだけ）

### 例2: バッチ処理の改善

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

**変更点**: エラーハンドリングを統一

## 結論

### Manusのコードをローカルで引き継ぐのは可能か？

**はい、可能です。** ただし、以下の条件が必要です：

1. **段階的なリファクタリング**: 一度に全部を書き直すのではなく、段階的に改善
2. **適切な抽象化**: 条件分岐をサービス抽象化に置き換える
3. **エラーハンドリングの統一**: バックグラウンド処理のエラーを適切に処理

### 実装済み機能の状況

- **動画分析機能**: ✅ ほぼ対応済み（画像分析の完全対応が残っている）
- **SEO記事生成機能**: ⚠️ 基本的には動作するが、エラーハンドリングの改善が必要
- **バッチ処理**: ⚠️ 動作するが、エラーハンドリングの改善が必要
- **動画生成機能**: ⚠️ 基盤は実装済みだが、画像生成などの部分対応が必要

### 推奨されるアプローチ

1. **まずは設定管理の統一**を実装（1-2日）
2. **サービス抽象化**を実装（2-3日）
3. **既存機能の動作確認と修正**（1週間）
4. **エラーハンドリングの統一**（1週間）

これにより、**既存の機能を壊すことなく、段階的に安定性を向上**させることができます。

