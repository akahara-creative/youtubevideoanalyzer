# ローカル開発環境 クイックスタート

このガイドでは、**費用をかけずに**ローカル開発環境を構築する方法を説明します。

## 🚀 5分で始める

### 1. 環境変数ファイルの作成

プロジェクトルートに`.env`ファイルを作成し、以下をコピー：

```bash
# データベース（SQLite - セットアップ不要）
DATABASE_URL=sqlite:./local.db

# 認証バイパス（マスターユーザーとして常時ログイン）
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

### 2. 依存関係のインストール

```bash
npm install
```

### 3. データベースのマイグレーション

```bash
npm run db:push
```

**注意**: 現在の設定はMySQL用です。SQLiteを使用する場合は、`drizzle.config.ts`の設定変更が必要です（後述）。

### 4. 開発サーバーの起動

```bash
npm run dev
```

### 5. ブラウザでアクセス

```
http://localhost:3000
```

**認証なしで自動的にマスターユーザーとしてログイン**されます！

---

## 📦 Ollamaのセットアップ（オプション）

AI機能を使用する場合は、Ollamaをセットアップしてください。

### インストール

```bash
# macOS / Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# https://ollama.ai/download からダウンロード
```

### モデルのダウンロード

```bash
# 推奨モデル（8GB RAM以上推奨）
ollama pull llama3.1:8b

# 軽量モデル（4GB RAMで動作）
ollama pull llama3.1:3b
```

### 動作確認

```bash
ollama run llama3.1:8b "こんにちは"
```

Ollamaが起動していれば、AI機能が自動的に使用されます。

---

## 🗄️ データベースの選択

### オプション1: MySQL（現在の設定）

**セットアップ**:
```bash
# macOS
brew install mysql
brew services start mysql

# データベース作成
mysql -u root -p
CREATE DATABASE youtube_analyzer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**`.env`設定**:
```bash
DATABASE_URL=mysql://root:password@localhost:3306/youtube_analyzer
```

### オプション2: SQLite（推奨：最も簡単）

**注意**: SQLiteを使用する場合は、`drizzle.config.ts`を修正する必要があります。

**`drizzle.config.ts`の修正**:
```typescript
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// SQLiteかどうかを判定
const isSqlite = connectionString.startsWith("sqlite:");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: isSqlite ? "sqlite" : "mysql",
  dbCredentials: isSqlite
    ? { url: connectionString.replace("sqlite:", "file:") }
    : { url: connectionString },
});
```

**`.env`設定**:
```bash
DATABASE_URL=sqlite:./local.db
```

**依存関係の追加**:
```bash
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

---

## ✅ 動作確認

1. **サーバーが起動しているか確認**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **ブラウザでアクセス**
   - `http://localhost:3000` にアクセス
   - ログイン画面が表示されず、直接ダッシュボードが表示されれば成功

3. **Ollamaが動作しているか確認**（オプション）
   ```bash
   curl http://localhost:11434/api/tags
   ```

---

## 🔧 トラブルシューティング

### 認証エラーが表示される

**解決策**:
1. `.env`ファイルに`ENABLE_AUTH_BYPASS=true`が設定されているか確認
2. サーバーを再起動: `npm run dev`

### Ollamaに接続できない

**解決策**:
1. Ollamaが起動しているか確認: `ollama list`
2. `.env`ファイルの`OLLAMA_HOST`を確認

### データベース接続エラー

**解決策**:
1. MySQLが起動しているか確認: `brew services list`（macOS）
2. `.env`ファイルの`DATABASE_URL`を確認

---

## 📚 詳細情報

- [LOCAL_DEVELOPMENT_SETUP.md](./LOCAL_DEVELOPMENT_SETUP.md) - 詳細なセットアップガイド
- [LOCAL_DEVELOPMENT_ALTERNATIVES.md](./LOCAL_DEVELOPMENT_ALTERNATIVES.md) - 代替技術の詳細

---

**作成日**: 2025年11月21日


