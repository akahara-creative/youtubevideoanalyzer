# ローカル開発環境セットアップガイド

このガイドでは、費用を抑えてローカル開発環境を構築する方法を説明します。オープンソースのツールを使用して、完全無料で開発を進められます。

## 目次

1. [前提条件](#前提条件)
2. [クイックスタート](#クイックスタート)
3. [詳細なセットアップ手順](#詳細なセットアップ手順)
4. [Ollamaのセットアップ](#ollamaのセットアップ)
5. [データベースのセットアップ](#データベースのセットアップ)
6. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

### 必須ソフトウェア

| ソフトウェア | バージョン | インストール方法 |
|-------------|-----------|----------------|
| Node.js | 22.x | [公式サイト](https://nodejs.org/)からダウンロード |
| npm | 最新版 | Node.jsに含まれています |

### 推奨ソフトウェア（オプション）

- **Ollama**（LLM用）: 完全無料のローカルLLM
- **SQLite**（データベース用）: 軽量でセットアップ不要
- **MySQL/PostgreSQL**（本番環境に近い開発用）: より本格的な開発環境

---

## クイックスタート

### 1. 環境変数ファイルの作成

```bash
cp .env.local.example .env
```

### 2. データベースのセットアップ（SQLite推奨）

SQLiteを使用する場合、追加のセットアップは不要です。`.env`ファイルで以下を設定：

```bash
DATABASE_URL=sqlite:./local.db
```

### 3. 依存関係のインストール

```bash
npm install
```

### 4. データベースのマイグレーション

```bash
npm run db:push
```

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスすると、**認証なしでマスターユーザーとして自動ログイン**されます。

---

## 詳細なセットアップ手順

### ステップ1: 環境変数の設定

`.env`ファイルを作成し、以下の最小限の設定を追加：

```bash
# データベース（SQLite推奨）
DATABASE_URL=sqlite:./local.db

# 認証バイパス（開発環境）
ENABLE_AUTH_BYPASS=true
MASTER_OPEN_ID=master-user
MASTER_NAME=Master User

# Ollamaを使用（オプション、後で設定可能）
USE_OLLAMA=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# アプリケーション設定
VITE_APP_TITLE=YouTube動画分析アプリ（ローカル開発）
NODE_ENV=development
PORT=3000
```

### ステップ2: データベースの選択

#### オプションA: SQLite（推奨：最も簡単）

**メリット**:
- セットアップ不要
- ファイルベースで管理が簡単
- 完全無料

**設定**:
```bash
DATABASE_URL=sqlite:./local.db
```

**注意**: Drizzle ORMでSQLiteを使用する場合、`drizzle.config.ts`の設定を確認してください。

#### オプションB: MySQL（本番環境に近い）

**セットアップ**:
```bash
# macOS
brew install mysql
brew services start mysql

# Ubuntu/Debian
sudo apt install mysql-server
sudo systemctl start mysql

# データベースの作成
mysql -u root -p
CREATE DATABASE youtube_analyzer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**設定**:
```bash
DATABASE_URL=mysql://root:password@localhost:3306/youtube_analyzer
```

#### オプションC: PostgreSQL（本番環境に近い）

**セットアップ**:
```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt install postgresql-15
sudo systemctl start postgresql

# データベースの作成
createdb youtube_analyzer
```

**設定**:
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/youtube_analyzer
```

### ステップ3: データベースのマイグレーション

```bash
npm run db:push
```

これで、必要なテーブルが作成されます。

---

## Ollamaのセットアップ

Ollamaは、完全無料のローカルLLMです。GPT-4の代替として使用できます。

### インストール

```bash
# macOS / Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# https://ollama.ai/download からインストーラーをダウンロード
```

### モデルのダウンロード

```bash
# Llama 3.1 8B（推奨：バランスが良い、日本語対応）
ollama pull llama3.1:8b

# より軽量なモデル（4GB RAMで動作）
ollama pull llama3.1:3b

# より高性能なモデル（16GB RAM推奨）
ollama pull llama3.1:70b
```

### 動作確認

```bash
ollama run llama3.1:8b "こんにちは"
```

### 環境変数の設定

`.env`ファイルに以下を追加：

```bash
USE_OLLAMA=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

### 必要スペック

| モデル | 最小RAM | 推奨RAM | 推奨GPU |
|--------|---------|---------|---------|
| llama3.1:3b | 4GB | 8GB | なし（CPU可） |
| llama3.1:8b | 8GB | 16GB | NVIDIA RTX 3060以上 |
| llama3.1:70b | 32GB | 64GB | NVIDIA RTX 4090以上 |

**注意**: GPUがない場合でもCPUで動作しますが、処理速度が遅くなります。

---

## データベースのセットアップ

### SQLiteを使用する場合

追加のセットアップは不要です。`.env`ファイルで以下を設定するだけ：

```bash
DATABASE_URL=sqlite:./local.db
```

### MySQLを使用する場合

1. MySQLをインストール（上記参照）
2. データベースを作成
3. `.env`ファイルで接続文字列を設定

### PostgreSQLを使用する場合

1. PostgreSQLをインストール（上記参照）
2. データベースを作成
3. `.env`ファイルで接続文字列を設定

---

## 認証バイパス機能

開発環境では、認証をバイパスしてマスターユーザーとして常時ログインできます。

### 設定方法

`.env`ファイルに以下を追加：

```bash
ENABLE_AUTH_BYPASS=true
MASTER_OPEN_ID=master-user
MASTER_NAME=Master User
MASTER_EMAIL=master@localhost
```

### 動作

- アプリ起動時に自動的にマスターユーザーとしてログイン
- ログイン画面は表示されません
- すべての機能にアクセス可能

### 本番環境での無効化

本番環境では、`ENABLE_AUTH_BYPASS=false`に設定するか、環境変数を削除してください。

---

## トラブルシューティング

### 問題1: Ollamaに接続できない

**症状**: `Ollama API error: fetch failed`

**解決策**:
1. Ollamaが起動しているか確認: `ollama list`
2. ポートが正しいか確認: `curl http://localhost:11434/api/tags`
3. `.env`ファイルの`OLLAMA_HOST`を確認

### 問題2: データベース接続エラー

**症状**: `Error: connect ECONNREFUSED`

**解決策**:
1. データベースが起動しているか確認
2. `.env`ファイルの`DATABASE_URL`を確認
3. SQLiteを使用する場合は、ファイルパスが正しいか確認

### 問題3: 認証エラーが表示される

**症状**: ログイン画面が表示される

**解決策**:
1. `.env`ファイルに`ENABLE_AUTH_BYPASS=true`が設定されているか確認
2. サーバーを再起動: `npm run dev`
3. ブラウザのキャッシュをクリア

### 問題4: モデルが見つからない

**症状**: `Ollama API error: model not found`

**解決策**:
```bash
# モデルをダウンロード
ollama pull llama3.1:8b

# 利用可能なモデルを確認
ollama list
```

---

## 次のステップ

1. **Ollamaのセットアップ**: ローカルLLMを使用してAI機能をテスト
2. **データの投入**: サンプルデータを追加して機能を確認
3. **機能の開発**: 新しい機能を追加・修正

---

## 参考資料

- [Ollama公式ドキュメント](https://ollama.ai/docs)
- [Drizzle ORMドキュメント](https://orm.drizzle.team/)
- [LOCAL_DEVELOPMENT_ALTERNATIVES.md](./LOCAL_DEVELOPMENT_ALTERNATIVES.md) - より詳細な代替技術の説明

---

**作成日**: 2025年11月21日  
**最終更新**: 2025年11月21日


