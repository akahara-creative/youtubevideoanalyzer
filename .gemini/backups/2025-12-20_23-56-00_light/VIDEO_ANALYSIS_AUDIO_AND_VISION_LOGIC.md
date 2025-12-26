# 動画分析：音声抽出と映像分析のロジック

## 概要

このドキュメントでは、YouTube動画の分析における音声抽出（文字起こし）と映像分析（フレーム分析）の実装ロジックを説明します。

---

## 1. 音声抽出（文字起こし）のロジック

### 1.1 処理フロー

```
YouTube動画URL
  ↓
yt-dlpで動画ダウンロード + 音声抽出
  ↓
音声ファイル（.m4a → .mp3にリネーム）
  ↓
ストレージにアップロード（ローカルまたはS3）
  ↓
Whisper APIで文字起こし（ローカルまたはリモート）
  ↓
文字起こしセグメント（タイムスタンプ付き）を返却
```

### 1.2 実装詳細

#### 1.2.1 動画ダウンロードと音声抽出

**ファイル**: `server/videoProcessor.ts`  
**関数**: `downloadVideoAndExtractAudio()`

```typescript
// yt-dlpを使用して動画をダウンロード
// - 動画タイトルを取得
// - 動画ファイル（.mp4）をダウンロード
// - 音声ファイル（.m4a）を直接ダウンロード（ffmpeg変換を回避してメモリ使用量を削減）
// - .m4aを.mp3にリネーム（Whisper APIはm4aも受け付ける）
```

**主な処理**:
- `yt-dlp --get-title`: 動画タイトルを取得
- `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"`: 動画をダウンロード
- `yt-dlp -f "worstaudio[ext=m4a]/worstaudio/bestaudio[ext=m4a]/bestaudio"`: 音声のみをダウンロード（軽量版を優先）
- ファイルサイズチェック（15MB制限）

#### 1.2.2 文字起こし処理

**ファイル**: `server/videoProcessor.ts`  
**関数**: `transcribeVideoAudio()`

```typescript
// 音声ファイルをストレージにアップロード
// transcribeAudio()を呼び出して文字起こし
// Whisper APIのレスポンスをTranscriptionSegment形式に変換
```

**ファイル**: `server/_core/voiceTranscription.ts`  
**関数**: `transcribeAudio()`

**処理の分岐**:
1. **ローカルWhisper使用時** (`USE_LOCAL_WHISPER=true`):
   - `transcribeAudioLocal()`を呼び出し
   - Pythonスクリプト `scripts/transcribe_local.py` を実行
   - faster-whisperライブラリを使用

2. **API使用時** (デフォルト):
   - Forge API経由でWhisper APIを呼び出し
   - リトライロジック（最大3回、タイムアウト3分）

#### 1.2.3 ローカルWhisper実装

**ファイル**: `scripts/transcribe_local.py`

**使用ライブラリ**: `faster-whisper`

**設定**:
- モデルサイズ: `WHISPER_MODEL_SIZE`環境変数（デフォルト: `small`）
- デバイス: `USE_GPU=true`でGPU使用、それ以外はCPU
- 計算タイプ: GPU使用時は`float16`、CPU使用時は`int8`
- タイムアウト: 20分（`small`モデル用）

**出力形式**:
```json
{
  "task": "transcribe",
  "language": "ja",
  "duration": 123.45,
  "text": "完全な文字起こしテキスト",
  "segments": [
    {
      "id": 0,
      "seek": 0,
      "start": 0.0,
      "end": 5.2,
      "text": "セグメントのテキスト",
      "tokens": [],
      "temperature": 0.0,
      "avg_logprob": -0.5,
      "compression_ratio": 1.0,
      "no_speech_prob": 0.0
    }
  ]
}
```

### 1.3 環境変数

- `USE_LOCAL_WHISPER`: ローカルWhisperを使用するか（`true`/`false`）
- `WHISPER_MODEL_SIZE`: Whisperモデルサイズ（`tiny`, `base`, `small`, `medium`, `large-v2`, `large-v3`）
- `USE_GPU`: GPUを使用するか（`true`/`false`）

---

## 2. 映像分析（フレーム分析）のロジック

### 2.1 処理フロー

```
動画ファイル（.mp4）
  ↓
ffprobeで動画の長さを取得
  ↓
30秒間隔でフレームを抽出（最大15フレーム）
  ↓
各フレームを640x360にリサイズ
  ↓
各フレームをストレージにアップロード
  ↓
LLM Visionモデル（LLaVA）で各フレームを分析
  ↓
コード検出用の追加LLM呼び出し（JSON形式で返却）
  ↓
フレーム分析結果を返却
```

### 2.2 実装詳細

#### 2.2.1 フレーム抽出

**ファイル**: `server/videoProcessor.ts`  
**関数**: `extractFrames()`

**処理**:
1. `ffprobe`で動画の長さを取得
2. 30秒間隔でフレームを抽出（最大15フレーム）
3. 各フレームを`ffmpeg`で抽出:
   ```bash
   ffmpeg -ss {timestamp} -i "{videoPath}" -vframes 1 -s 640x360 -y "{framePath}"
   ```
   - `-ss`: タイムスタンプにシーク
   - `-vframes 1`: 1フレームのみ抽出
   - `-s 640x360`: 640x360にリサイズ（メモリ使用量削減）
   - `-y`: 上書き許可

**フレーム数計算**:
```typescript
const numFrames = Math.max(1, Math.min(Math.floor(duration / intervalSeconds), 15));
```

#### 2.2.2 フレーム分析

**ファイル**: `server/videoProcessor.ts`  
**関数**: `analyzeFrame()`

**処理ステップ**:

1. **フレーム画像のアップロード**
   - フレーム画像をストレージにアップロード
   - 画像URLを取得

2. **LLM Visionモデルで分析**
   - システムプロンプト: 動画フレーム分析の専門家として、構造化された詳細な説明を生成
   - ユーザープロンプト: 画面の概要、主要な要素（人物、背景、テキスト、UI）、コードの有無などを分析

3. **コード検出の追加分析**
   - 最初の分析結果からコードが含まれているかを判定
   - JSON形式で返却:
     ```json
     {
       "hasCode": boolean,
       "codeContent": string,
       "codeExplanation": string
     }
     ```

4. **結果の返却**
   ```typescript
   {
     visualDescription: string,      // 視覚的な説明
     codeContent?: string,            // コード内容（存在する場合）
     codeExplanation?: string,        // コードの説明（存在する場合）
     frameUrl: string                 // フレーム画像のURL
   }
   ```

#### 2.2.3 LLM Vision API呼び出し

**ファイル**: `server/_core/llm-ollama.ts`  
**関数**: `invokeOllama()`

**処理**:
1. メッセージに画像コンテンツが含まれているかチェック
2. 画像URLをbase64に変換（ローカルファイルまたはHTTP URLから）
3. OllamaのVision API形式に変換:
   ```json
   {
     "model": "llava:13b",
     "messages": [
       {
         "role": "user",
         "content": "テキストプロンプト",
         "images": ["base64エンコードされた画像"]
       }
     ],
     "options": {
       "num_predict": 4096,
       "temperature": 0.7
     }
   }
   ```
4. JSON形式が要求されている場合、最後のメッセージにJSONスキーマ要求を追加（Ollamaは`json_schema`を直接サポートしないため）

**使用モデル**:
- 通常: `OLLAMA_MODEL`（デフォルト: `llama3.1:8b`）
- Vision: `OLLAMA_VISION_MODEL`（デフォルト: `llava:13b`）

### 2.3 環境変数

- `OLLAMA_HOST`: OllamaサーバーのURL（デフォルト: `http://localhost:11434`）
- `OLLAMA_MODEL`: 通常のLLMモデル（デフォルト: `llama3.1:8b`）
- `OLLAMA_VISION_MODEL`: Visionモデル（デフォルト: `llava:13b`）

---

## 3. 統合処理フロー

**ファイル**: `server/videoProcessor.ts`  
**関数**: `processYouTubeVideo()`

### 3.1 処理ステップと進捗率

1. **動画ダウンロード** (0-20%)
   - YouTube動画をダウンロード
   - 音声を抽出

2. **文字起こし** (20-50%)
   - 音声を文字起こし
   - セグメントを生成

3. **フレーム抽出** (50-55%)
   - 動画からフレームを抽出

4. **フレーム分析** (55-90%)
   - 各フレームをLLM Visionで分析
   - 進捗率: `55 + (フレーム番号 * (90-55) / フレーム数)`

5. **サマリー生成** (90-100%)
   - 文字起こしとフレーム分析からサマリーを生成
   - 学習ポイントを抽出

### 3.2 キャンセル機能

各ステップの前に`checkCancelled()`を呼び出し、分析がキャンセルされた場合は処理を中断します。

### 3.3 エラーハンドリング

- フレーム分析でエラーが発生しても処理を続行（デフォルト値を設定）
- JSON解析エラー時は、テキストからJSON部分を抽出して再試行
- パースに失敗した場合はフォールバック値を返却

---

## 4. データベース制約への対応

### 4.1 テキスト長制限

MySQLの`TEXT`型は約64KB（約60,000文字）の制限があります。

**対応**:
- `summary`、`learningPoints`、`title`が60KBを超える場合、LLMを使用して要約・箇条書き化
- `server/_core/textCompressor.ts`の`compressText()`関数を使用

**処理**:
1. テキストが60KBを超える場合
2. LLMに要約・箇条書き化を依頼
3. 60KB以下になるまで繰り返し

---

## 5. 依存関係

### 5.1 必要なツール

- **yt-dlp**: YouTube動画ダウンロード
- **ffmpeg**: 動画処理、フレーム抽出
- **ffprobe**: 動画情報取得
- **Python 3**: ローカルWhisper実行
- **faster-whisper**: Pythonライブラリ（ローカルWhisper使用時）
- **Ollama**: ローカルLLM実行環境

### 5.2 インストール方法

```bash
# yt-dlp
# プロジェクトのserver/ディレクトリに配置済み

# ffmpeg
brew install ffmpeg  # macOS
# または apt install ffmpeg  # Linux

# Python 3
# macOS: /opt/homebrew/bin/python3

# faster-whisper
pip install faster-whisper

# Ollama
# https://ollama.ai/ からインストール
ollama pull llava:13b  # Visionモデル
ollama pull llama3.1:8b  # 通常モデル
```

---

## 6. パフォーマンス最適化

### 6.1 メモリ使用量削減

- 音声抽出: ffmpeg変換を回避し、yt-dlpで直接m4a形式をダウンロード
- フレーム抽出: フレームを640x360にリサイズ
- フレーム抽出: 一度に1フレームずつ処理（メモリバッファを最小化）

### 6.2 処理時間短縮

- Whisperモデル: `small`モデルを使用（`large-v3`より高速）
- フレーム間隔: 30秒間隔（必要に応じて調整可能）
- 最大フレーム数: 15フレームに制限

### 6.3 タイムアウト設定

- 文字起こし: 20分（`small`モデル用）
- API呼び出し: 3分（リトライ3回）

---

## 7. トラブルシューティング

### 7.1 よくある問題

1. **Whisperタイムアウト**
   - 原因: モデルサイズが大きすぎる、CPU処理が遅い
   - 解決: `WHISPER_MODEL_SIZE=small`に設定

2. **Ollama Visionモデルが見つからない**
   - 原因: `llava:13b`がインストールされていない
   - 解決: `ollama pull llava:13b`を実行

3. **JSON解析エラー**
   - 原因: OllamaのレスポンスがJSON形式でない
   - 解決: 自動的にJSON部分を抽出するロジックが実装済み

4. **データベースエラー（テキストが長すぎる）**
   - 原因: サマリーや学習ポイントが60KBを超えている
   - 解決: 自動的に要約・箇条書き化するロジックが実装済み

---

## 8. 関連ファイル

- `server/videoProcessor.ts`: メインの処理ロジック
- `server/_core/voiceTranscription.ts`: 音声文字起こしの統合
- `scripts/transcribe_local.py`: ローカルWhisper実装
- `server/_core/llm-ollama.ts`: Ollama LLM呼び出し
- `server/_core/textCompressor.ts`: テキスト圧縮・要約
- `server/db.ts`: データベース更新処理

