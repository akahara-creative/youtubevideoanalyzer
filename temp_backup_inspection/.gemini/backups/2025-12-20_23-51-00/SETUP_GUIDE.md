# セットアップガイド

このドキュメントは、YouTube動画分析アプリのセットアップ手順、環境構築、トラブルシューティングをまとめたものです。

---

## 目次

1. [前提条件](#前提条件)
2. [セットアップ手順](#セットアップ手順)
3. [環境変数の設定](#環境変数の設定)
4. [データベースのセットアップ](#データベースのセットアップ)
5. [開発サーバーの起動](#開発サーバーの起動)
6. [本番環境へのデプロイ](#本番環境へのデプロイ)
7. [トラブルシューティング](#トラブルシューティング)
8. [よくある質問](#よくある質問)

---

## 前提条件

### 必須ソフトウェア

| ソフトウェア | バージョン | インストール方法 |
|-------------|-----------|----------------|
| Node.js | 22.x | [公式サイト](https://nodejs.org/)からダウンロード |
| pnpm | 最新版 | `npm install -g pnpm` |
| MySQL/TiDB | 5.7以上 | [公式サイト](https://www.mysql.com/)からダウンロード |

### 推奨ソフトウェア

- Git（バージョン管理）
- Visual Studio Code（エディタ）
- Postman（API テスト）

---

## セットアップ手順

### ステップ1: ZIPファイルを解凍

```bash
unzip youtube-video-analyzer-complete-backup-YYYYMMDD-HHMMSS.zip
cd youtube-video-analyzer
```

### ステップ2: 依存関係をインストール

```bash
pnpm install
```

**注意**: `node_modules`ディレクトリは除外されているため、必ず`pnpm install`を実行してください。

**インストール時間**: 環境によりますが、通常2〜5分程度かかります。

### ステップ3: 環境変数を設定

プロジェクトルートに`.env`ファイルを作成し、以下の環境変数を設定します。

```bash
# データベース接続情報
DATABASE_URL=mysql://user:password@host:port/database

# JWT認証
JWT_SECRET=your-jwt-secret-here

# Manus OAuth
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im

# オーナー情報
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=your-owner-name

# Manus Forge API（AI機能）
BUILT_IN_FORGE_API_URL=https://forge-api.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-api-key
VITE_FRONTEND_FORGE_API_URL=https://forge-api.manus.im

# アプリケーション設定
VITE_APP_TITLE=YouTube動画分析アプリ
VITE_APP_LOGO=/logo.svg
```

**重要**: 環境変数の値は、実際の環境に合わせて変更してください。

### ステップ4: データベースをマイグレーション

```bash
pnpm db:push
```

このコマンドは、`drizzle/schema.ts`で定義されたスキーマをデータベースに反映します。

**実行結果の例**:
```
✓ Pushing schema to database...
✓ Schema pushed successfully
```

### ステップ5: 開発サーバーを起動

```bash
pnpm dev
```

**実行結果の例**:
```
[10:09:14] [OAuth] Initialized with baseURL: https://api.manus.im
[10:09:14] Server running on http://localhost:3000/
```

### ステップ6: ブラウザでアクセス

ブラウザで以下のURLにアクセスします。

```
http://localhost:3000
```

ログイン画面が表示されれば、セットアップは成功です。

---

## 環境変数の設定

### 必須環境変数

| 環境変数 | 説明 | 例 |
|---------|------|-----|
| `DATABASE_URL` | データベース接続文字列 | `mysql://user:pass@localhost:3306/db` |
| `JWT_SECRET` | JWT署名用のシークレット | `your-random-secret-key` |
| `VITE_APP_ID` | Manus OAuthアプリケーションID | `abc123` |
| `OAUTH_SERVER_URL` | Manus OAuth サーバーURL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | Manus OAuthポータルURL | `https://portal.manus.im` |
| `OWNER_OPEN_ID` | オーナーのOpenID | `user-123` |
| `OWNER_NAME` | オーナーの名前 | `山田太郎` |
| `BUILT_IN_FORGE_API_URL` | Manus Forge API URL（サーバー側） | `https://forge-api.manus.im` |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge APIキー（サーバー側） | `sk-xxx` |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus Forge APIキー（フロントエンド側） | `sk-xxx` |
| `VITE_FRONTEND_FORGE_API_URL` | Manus Forge API URL（フロントエンド側） | `https://forge-api.manus.im` |

### オプション環境変数

| 環境変数 | 説明 | デフォルト値 |
|---------|------|------------|
| `VITE_APP_TITLE` | アプリケーションのタイトル | `YouTube動画分析アプリ` |
| `VITE_APP_LOGO` | アプリケーションのロゴパス | `/logo.svg` |
| `PORT` | サーバーのポート番号 | `3000` |

### 環境変数の取得方法

#### DATABASE_URL
- MySQL/TiDBのデータベース接続情報を使用します。
- フォーマット: `mysql://ユーザー名:パスワード@ホスト:ポート/データベース名`
- 例: `mysql://root:password@localhost:3306/youtube_analyzer`

#### JWT_SECRET
- ランダムな文字列を生成します。
- 生成コマンド: `openssl rand -base64 32`

#### Manus OAuth関連
- Manus管理画面から取得します。
- 詳細は[Manus公式ドキュメント](https://docs.manus.im)を参照してください。

---

## データベースのセットアップ

### データベースの作成

MySQL/TiDBにデータベースを作成します。

```sql
CREATE DATABASE youtube_analyzer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### マイグレーションの実行

```bash
pnpm db:push
```

このコマンドは、以下のテーブルを作成します：

- `users` - ユーザー情報
- `ragDocuments` - RAGドキュメント
- `tagCategories` - タグカテゴリ
- `tags` - タグ
- `documentTags` - ドキュメントとタグの中間テーブル
- `seoArticleJobs` - SEO記事生成ジョブ
- `videoGenerationJobs` - 動画生成ジョブ
- `chatMessages` - チャットメッセージ
- `analysisHistory` - 動画分析履歴

### 初期データの投入（オプション）

タグカテゴリとタグの初期データを投入する場合は、以下のSQLを実行します。

```sql
-- タグカテゴリの作成
INSERT INTO tagCategories (name, displayName, description, sortOrder) VALUES
('genre', '生成ジャンル', 'コンテンツの生成ジャンル', 1),
('author', '発信者名', 'コンテンツの発信者', 2),
('contentType', 'コンテンツタイプ', 'コンテンツの種類', 3),
('theme', 'テーマ', 'コンテンツのテーマ', 4),
('importance', '重要度', 'コンテンツの重要度', 5);

-- タグの作成（例）
INSERT INTO tags (categoryId, name, displayName, description, sortOrder) VALUES
(1, 'seo', 'SEO記事', 'SEO最適化された記事', 1),
(1, 'video', '動画台本', 'YouTube動画の台本', 2),
(2, 'akahara', '赤原', '赤原さんのスタイル', 1),
(2, 'hikari', 'ひかりちゃん', 'ひかりちゃんのスタイル', 2),
(3, 'tutorial', 'チュートリアル', 'チュートリアル形式', 1),
(3, 'case_study', 'ケーススタディ', 'ケーススタディ形式', 2),
(4, 'marketing', 'マーケティング', 'マーケティング関連', 1),
(4, 'technology', 'テクノロジー', 'テクノロジー関連', 2),
(5, 'high', '高', '重要度が高い', 1),
(5, 'medium', '中', '重要度が中程度', 2),
(5, 'low', '低', '重要度が低い', 3);
```

---

## 開発サーバーの起動

### 通常の起動

```bash
pnpm dev
```

### ポートを変更して起動

```bash
PORT=3001 pnpm dev
```

### デバッグモードで起動

```bash
DEBUG=* pnpm dev
```

### 開発サーバーの停止

`Ctrl + C`を押して停止します。

---

## 本番環境へのデプロイ

### ステップ1: ビルド

```bash
pnpm build
```

このコマンドは、フロントエンドとバックエンドをビルドし、`dist`ディレクトリに出力します。

### ステップ2: 本番サーバーで起動

```bash
NODE_ENV=production pnpm start
```

### ステップ3: プロセスマネージャーで管理（推奨）

本番環境では、PM2などのプロセスマネージャーを使用することを推奨します。

```bash
# PM2のインストール
npm install -g pm2

# アプリケーションの起動
pm2 start pnpm --name youtube-analyzer -- start

# 自動起動の設定
pm2 startup
pm2 save
```

---

## トラブルシューティング

### 問題1: `pnpm install`が失敗する

**症状**:
```
ERR_PNPM_FETCH_404  GET https://registry.npmjs.org/xxx: Not Found - 404
```

**原因**: パッケージが見つからない、またはネットワークエラー

**解決策**:
1. インターネット接続を確認
2. pnpmのキャッシュをクリア: `pnpm store prune`
3. 再度インストール: `pnpm install`

### 問題2: データベース接続エラー

**症状**:
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**原因**: データベースが起動していない、または接続情報が間違っている

**解決策**:
1. データベースが起動しているか確認: `mysql -u root -p`
2. `.env`ファイルの`DATABASE_URL`を確認
3. ホスト、ポート、ユーザー名、パスワードが正しいか確認

### 問題3: `pnpm db:push`が失敗する

**症状**:
```
Error: Access denied for user 'xxx'@'localhost' (using password: YES)
```

**原因**: データベースのユーザー権限が不足している

**解決策**:
1. データベースユーザーに適切な権限を付与:
```sql
GRANT ALL PRIVILEGES ON youtube_analyzer.* TO 'user'@'localhost';
FLUSH PRIVILEGES;
```

### 問題4: ポート3000が既に使用されている

**症状**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**原因**: ポート3000が既に別のプロセスで使用されている

**解決策**:
1. 使用中のプロセスを確認: `lsof -i :3000`
2. プロセスを停止: `kill -9 <PID>`
3. または、別のポートで起動: `PORT=3001 pnpm dev`

### 問題5: RAGドキュメントが表示されない

**症状**: RAGページでドキュメント一覧が「0件」と表示される

**原因**: データベースに`userId`カラムが存在しないため、フィルタが機能していない

**解決策**:
1. `server/routers.ts`の`rag.listDocuments`プロシージャを確認
2. `userId`フィルタが削除されていることを確認
3. データベースを確認: `SELECT COUNT(*) FROM ragDocuments;`

### 問題6: タグが削除できない

**症状**: タグを削除しようとするとエラーが発生する

**原因**: タグが他のドキュメントで使用されている

**解決策**:
1. タグ削除時に確認ダイアログが表示されることを確認
2. 「削除」ボタンをクリックして、連動削除を実行
3. データベースを確認: `SELECT * FROM documentTags WHERE tagId = <tagId>;`

### 問題7: SEO記事生成が失敗する

**症状**: SEO記事生成ジョブが「failed」ステータスになる

**原因**: Manus Forge APIキーが無効、またはRAGドキュメントが不足している

**解決策**:
1. `.env`ファイルの`BUILT_IN_FORGE_API_KEY`を確認
2. RAGドキュメントが少なくとも1件以上存在することを確認
3. 発信者名タグが正しく設定されていることを確認
4. ピックアップされたドキュメントが存在することを確認

### 問題8: TypeScriptエラーが表示される

**症状**: 開発サーバー起動時にTypeScriptエラーが表示される

**原因**: 型定義が不一致、または未定義の変数を使用している

**解決策**:
1. エラーメッセージを確認し、該当ファイルを修正
2. 型定義を確認: `pnpm tsc --noEmit`
3. エディタのTypeScript拡張機能を使用して、リアルタイムでエラーを確認

---

## よくある質問

### Q1: どのブラウザがサポートされていますか？

**A**: 以下のブラウザがサポートされています。
- Google Chrome（最新版）
- Firefox（最新版）
- Safari（最新版）
- Microsoft Edge（最新版）

### Q2: データベースは何を使用できますか？

**A**: MySQL 5.7以上、またはTiDBが使用できます。

### Q3: RAGドキュメントはどこに保存されますか？

**A**: RAGドキュメントのメタデータはデータベースに保存され、ファイル本体はS3に保存されます。

### Q4: ピックアップ機能とは何ですか？

**A**: ピックアップ機能は、SEO記事生成や動画生成で優先的に参照するRAGドキュメントを指定する機能です。ピックアップされたドキュメントのみが参照されます。

### Q5: 発信者名タグとは何ですか？

**A**: 発信者名タグは、RAGドキュメントの発信者を識別するためのタグです。SEO記事生成や動画生成で、特定の発信者のスタイルでコンテンツを生成する際に使用されます。

### Q6: タグを削除すると、RAGドキュメントも削除されますか？

**A**: いいえ、タグを削除しても、RAGドキュメント自体は削除されません。ただし、そのタグとRAGドキュメントの紐付けは削除されます。

### Q7: 複数のユーザーで使用できますか？

**A**: はい、複数のユーザーで使用できます。ただし、現在のバージョンでは、RAGドキュメントは全ユーザーで共有されます（`ragDocuments`テーブルに`userId`カラムが存在しないため）。

### Q8: 本番環境でHTTPSを使用するにはどうすればよいですか？

**A**: Nginxなどのリバースプロキシを使用して、HTTPSを設定することを推奨します。Let's Encryptを使用して、無料のSSL証明書を取得できます。

### Q9: データベースのバックアップはどうすればよいですか？

**A**: `mysqldump`コマンドを使用して、データベースをバックアップできます。

```bash
mysqldump -u root -p youtube_analyzer > backup.sql
```

### Q10: ZIPファイルから復元した後、チェックポイントを作成できますか？

**A**: はい、復元後に`webdev_save_checkpoint`を実行することで、新しいチェックポイントを作成できます。

---

## サポート

問題が解決しない場合は、以下の方法でサポートを受けることができます。

- **Manus公式サポート**: https://help.manus.im
- **GitHub Issues**: プロジェクトのGitHubリポジトリでIssueを作成
- **コミュニティフォーラム**: Manusコミュニティフォーラムで質問

---

**作成者**: Manus AI  
**最終更新日**: 2025年11月17日
