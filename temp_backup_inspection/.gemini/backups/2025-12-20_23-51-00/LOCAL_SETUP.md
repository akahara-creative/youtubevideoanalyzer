# ローカル開発環境セットアップガイド

このプロジェクトをローカル環境で動作させるための完全なセットアップガイドです。

## 前提条件

- Node.js 18以上
- Python 3.8以上（音声文字起こし機能を使用する場合）
- PostgreSQL（データベース）
- Ollama（ローカルLLM）

## 1. 依存関係のインストール

### Node.js依存関係
```bash
pnpm install
```

### Python依存関係（音声文字起こしを使用する場合）
```bash
pip install faster-whisper
```

**注意**: faster-whisperはGPU（CUDA）を使用する場合、追加の設定が必要です。CPUのみで動作させる場合は、上記のコマンドで十分です。

## 2. 環境変数の設定

`.env`ファイルを作成し、以下の環境変数を設定します：

```bash
# データベース
DATABASE_URL=postgresql://user:password@localhost:5432/youtube_analyzer

# ローカル開発モード
NODE_ENV=development
USE_LOCAL_STORAGE=true
USE_LOCAL_WHISPER=true

# Ollama（ローカルLLM）
OLLAMA_BASE_URL=http://localhost:11434

# OAuth（開発環境では任意）
OAUTH_SERVER_URL=http://localhost:3000
```

### 環境変数の説明

- `USE_LOCAL_STORAGE=true`: ファイルストレージをローカルファイルシステム（`uploads/`ディレクトリ）に切り替えます
- `USE_LOCAL_WHISPER=true`: 音声文字起こしをローカルのfaster-whisperに切り替えます
- `OLLAMA_BASE_URL`: OllamaサーバーのURL（デフォルト: `http://localhost:11434`）

## 3. データベースのセットアップ

```bash
# マイグレーションの実行
pnpm drizzle-kit push

# または、マイグレーションファイルから実行
pnpm drizzle-kit migrate
```

## 4. Ollamaのセットアップ

### Ollamaのインストール

macOS:
```bash
brew install ollama
```

Linux:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### モデルのダウンロード

```bash
# Llama 3.1 8Bモデル（推奨）
ollama pull llama3.1:8b

# または、より大きなモデル（より高精度だが、より多くのメモリが必要）
ollama pull llama3.1:70b
```

### Ollamaサーバーの起動

```bash
ollama serve
```

## 5. サーバーの起動

```bash
# 開発モードで起動
pnpm dev

# または、環境変数を明示的に指定
NODE_ENV=development USE_LOCAL_STORAGE=true USE_LOCAL_WHISPER=true pnpm dev
```

サーバーは `http://localhost:3000` で起動します。

## 6. 動作確認

### ヘルスチェック
```bash
curl http://localhost:3000/api/health
```

### ストレージの確認
`uploads/`ディレクトリが作成され、ファイルが保存されることを確認します。

### 音声文字起こしの確認
音声ファイルをアップロードし、文字起こし機能が動作することを確認します。

## トラブルシューティング

### faster-whisperがインストールできない

**エラー**: `faster-whisper is not installed`

**解決策**:
```bash
# Python 3.8以上が必要
python3 --version

# faster-whisperのインストール
pip install faster-whisper

# または、ユーザー環境にインストール
pip install --user faster-whisper
```

### GPUを使用したい場合

**環境変数の設定**:
```bash
USE_GPU=true
```

**注意**: CUDAがインストールされている必要があります。

### モデルサイズの変更

デフォルトでは`large-v3`モデルが使用されます。より軽量なモデルを使用する場合：

```bash
export WHISPER_MODEL_SIZE=base
```

利用可能なモデルサイズ: `tiny`, `base`, `small`, `medium`, `large-v2`, `large-v3`

### ストレージディレクトリの権限エラー

**エラー**: `EACCES: permission denied`

**解決策**:
```bash
# uploadsディレクトリの権限を確認
ls -la uploads/

# 必要に応じて権限を変更
chmod 755 uploads/
```

### Ollamaに接続できない

**エラー**: `Connection refused` または `ECONNREFUSED`

**解決策**:
1. Ollamaサーバーが起動しているか確認:
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. 環境変数`OLLAMA_BASE_URL`が正しく設定されているか確認

3. ファイアウォールの設定を確認

## パフォーマンス最適化

### CPUのみで動作させる場合

- Whisperモデルサイズを`base`または`small`に変更
- 処理時間が長くなることを想定（リアルタイムの1.5〜2倍）

### GPUを使用する場合

- `USE_GPU=true`を設定
- VRAM 6GB以上推奨（`large-v3`モデルの場合）
- 処理時間が大幅に短縮されます（リアルタイムの0.5〜1倍）

## 次のステップ

- [LOCAL_DEVELOPMENT_ALTERNATIVES.md](./LOCAL_DEVELOPMENT_ALTERNATIVES.md) - その他の代替案
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - 本番環境のセットアップ
- [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md) - 技術ドキュメント

