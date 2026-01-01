# VoiceVox TTS統合 - 引き継ぎドキュメント

## 概要

YouTube動画生成機能に**VoiceVox TTS（Text-to-Speech）**を統合しました。これにより、シナリオのナレーションテキストから音声を自動生成し、動画に合成できるようになります。

**実装日**: 2025年11月19日  
**実装バージョン**: Phase 1.5  
**実装者**: AI Assistant

---

## 技術選定の経緯

### 検討した選択肢

#### 1. ブラウザTTS（Web Speech API）
- **メリット**: 無料、ブラウザ標準API
- **デメリット**: 録音機能の制限、品質が低い、ロボット声
- **結論**: ❌ 採用見送り

#### 2. OpenAI TTS API
- **メリット**: 高品質、自然な音声
- **デメリット**: API料金（$15/1M文字）、Manus環境でのAPIキー管理懸念
- **結論**: ❌ 採用見送り（将来的な選択肢として保留）

#### 3. Google Cloud TTS
- **メリット**: 高品質、無料枠あり
- **デメリット**: API料金、Manus環境でのAPIキー管理懸念
- **結論**: ❌ 採用見送り

#### 4. VoiceVox（最終決定）
- **メリット**: 
  - ✅ 完全無料
  - ✅ 日本語音声が自然
  - ✅ 低速API（API Key不要）が利用可能
  - ✅ ローカル開発でVoiceVoxエンジンを使用可能
  - ✅ 商用利用可能
- **デメリット**: 低速APIはリクエスト間隔に制限あり
- **結論**: ✅ 採用

---

## 実装内容

### 1. VoiceVox APIクライアント（`server/voicevoxClient.ts`）

VoiceVox APIを呼び出すクライアントを実装しました。

**主な機能：**
- 低速API（API Key不要）への対応
- 高速API（API Key必要）への対応
- ローカルVoiceVoxエンジンへの対応
- 環境変数による切り替え

**主な関数：**
```typescript
// 音声を生成
export async function generateSpeech(options: VoiceVoxOptions): Promise<VoiceVoxResult>

// 利用可能な話者一覧を取得
export async function getSpeakers(): Promise<any[]>

// VoiceVox APIの接続テスト
export async function testConnection(): Promise<boolean>
```

**パラメータ：**
```typescript
interface VoiceVoxOptions {
  text: string;           // 読み上げるテキスト
  speaker?: number;       // 話者ID（デフォルト: 1 = ずんだもん）
  speed?: number;         // 話速（0.5 ~ 2.0、デフォルト: 1.0）
  pitch?: number;         // ピッチ（-0.15 ~ 0.15、デフォルト: 0.0）
  intonationScale?: number; // イントネーション（0.0 ~ 2.0、デフォルト: 1.0）
}
```

### 2. 動画合成への統合（`server/videoComposer.ts`）

`generateAudio`関数を修正し、VoiceVoxを使用して音声を生成するようにしました。

**変更内容：**
```typescript
// Before: 空のaudioBufferを返す（サイレント動画）
const audioBuffer = Buffer.alloc(0);

// After: VoiceVoxで音声を生成
const result = await generateSpeech({
  text: fullText,
  speaker: 1, // ずんだもん
  speed: 1.0,
  pitch: 0.0,
  intonationScale: 1.0,
});
return result.audioBuffer;
```

**エラーハンドリング：**
- VoiceVox APIが失敗した場合、サイレント動画（音声なし）にフォールバック
- エラーログを出力して問題を追跡可能

---

## 環境変数の設定

### デフォルト設定（本番環境）

**低速API（API Key不要）**を使用します。

```bash
# 環境変数なし（デフォルト）
# 自動的に https://api.tts.quest/v3/voicevox が使用されます
```

### 高速API（API Key必要）

将来的に高速APIに切り替える場合は、以下の環境変数を設定してください。

```bash
VOICEVOX_API_URL=https://deprecatedapis.tts.quest/v2/voicevox
VOICEVOX_API_KEY=<取得したAPIキー>
```

**API Key取得方法：**
1. https://su-shiki.com/api/ にアクセス
2. Googleアカウントでログイン（Chromeブラウザ推奨）
3. reCAPTCHAを通過
4. API Keyが生成される

### ローカル開発（VoiceVoxエンジン）

ローカル開発では、VoiceVoxエンジンを起動して使用することを推奨します。

```bash
VOICEVOX_API_URL=http://localhost:50021
```

**VoiceVoxエンジンの起動方法：**
1. VoiceVoxをダウンロード: https://voicevox.hiroshiba.jp/
2. VoiceVoxを起動
3. エンジンが`http://localhost:50021`で待機

---

## セキュリティ注意事項

### API Keyの管理

⚠️ **重要**: API Keyは環境変数のみで管理してください。

**禁止事項：**
- ❌ チャットやコードに直接記載しない
- ❌ GitHubにコミットしない
- ❌ ログに出力しない

**推奨事項：**
- ✅ Manusの管理画面から環境変数を設定
- ✅ ローカル開発では`.env`ファイルを使用（`.gitignore`に追加）
- ✅ ローカル開発ではVoiceVoxエンジンを使用（API Key不要）

---

## 動作確認方法

### 1. VoiceVox APIの接続テスト

```bash
# サーバーコンソールで実行
node -e "require('./server/voicevoxClient').testConnection().then(console.log)"
```

**期待される出力：**
```
[VoiceVox] 低速API呼び出し（API Key不要）: { url: 'https://api.tts.quest/v3/voicevox/synthesis', text: 'テスト' }
[VoiceVox] 音声生成成功: { bufferSize: 12345, estimatedDuration: '0.40秒' }
[VoiceVox] 接続テスト成功: { bufferSize: 12345, duration: 0.4 }
true
```

### 2. 動画生成テスト

1. フロントエンドで動画生成ページにアクセス
2. テーマを入力（例: 「YouTube動画の作り方」）
3. 動画生成を開始
4. Step 7（音声生成）で以下のログを確認：
   ```
   [VideoComposer] Generating audio with VoiceVox TTS
   [VoiceVox] 低速API呼び出し（API Key不要）: { url: '...', text: '...' }
   [VoiceVox] 音声生成成功: { bufferSize: ..., estimatedDuration: '...' }
   ```
5. Step 8（動画合成）で音声が動画に合成されることを確認

---

## トラブルシューティング

### 問題1: VoiceVox APIが失敗する

**症状：**
```
[VoiceVox] WEB版API呼び出しエラー: ...
[VideoComposer] Failed to generate audio with VoiceVox: ...
[VideoComposer] Falling back to silent audio
```

**原因：**
- 低速APIのリクエスト間隔制限に引っかかった
- ネットワークエラー
- API側の一時的な障害

**解決策：**
1. 数秒待ってから再試行
2. 高速API（API Key必要）に切り替え
3. ローカルVoiceVoxエンジンを使用

### 問題2: 音声が生成されない（サイレント動画）

**症状：**
- 動画は生成されるが、音声がない

**原因：**
- VoiceVox APIが失敗してフォールバックした
- シナリオにナレーションテキストがない

**解決策：**
1. サーバーログを確認してVoiceVoxのエラーを特定
2. シナリオ生成時にナレーションテキストが含まれているか確認

### 問題3: ローカルVoiceVoxエンジンに接続できない

**症状：**
```
[VoiceVox] ローカルエンジン呼び出しエラー: connect ECONNREFUSED
VoiceVoxエンジンに接続できません。ローカルでVoiceVoxエンジンを起動してください。
```

**原因：**
- VoiceVoxエンジンが起動していない
- ポート番号が間違っている

**解決策：**
1. VoiceVoxを起動
2. `http://localhost:50021`にアクセスして確認
3. 環境変数`VOICEVOX_API_URL`を確認

---

## 今後の改善案

### Phase 2: 高速APIへの切り替え

低速APIはリクエスト間隔に制限があるため、本番環境では高速API（API Key必要）への切り替えを検討してください。

**手順：**
1. https://su-shiki.com/api/ でAPI Keyを取得
2. Manusの管理画面から環境変数を設定：
   ```
   VOICEVOX_API_URL=https://deprecatedapis.tts.quest/v2/voicevox
   VOICEVOX_API_KEY=<取得したAPIキー>
   ```
3. 動作確認

### Phase 3: 他のTTS APIへの切り替え

将来的に、OpenAI TTS APIやGoogle Cloud TTSに切り替えることも可能です。

**手順：**
1. `server/voicevoxClient.ts`を参考に新しいクライアントを作成
2. `server/videoComposer.ts`の`generateAudio`関数を修正
3. 環境変数で切り替え可能にする

---

## 参考資料

- **VoiceVox公式サイト**: https://voicevox.hiroshiba.jp/
- **WEB版VOICEVOX API**: https://voicevox.su-shiki.com/su-shikiapis/
- **VoiceVoxエンジンGitHub**: https://github.com/VOICEVOX/voicevox_engine
- **低速API仕様**: https://voicevox.su-shiki.com/su-shikiapis/ttsquest/

---

## まとめ

VoiceVox TTS統合により、YouTube動画生成機能に音声合成機能が追加されました。低速API（API Key不要）をデフォルトで使用し、将来的に高速APIやローカルVoiceVoxエンジンに切り替え可能な設計になっています。

**次のステップ：**
1. 動作テストを実施
2. 本番環境で動画生成を試す
3. 必要に応じて高速APIに切り替え

---

**作成日**: 2025年11月19日  
**最終更新日**: 2025年11月19日  
**バージョン**: 1.0
