import mysql from 'mysql2/promise';
import 'dotenv/config';

const initialCategories = [
  {
    name: 'genre',
    displayName: '生成ジャンル',
    description: 'コンテンツの生成ジャンル（SEO、動画、スライドなど）',
    sortOrder: 1,
  },
  {
    name: 'author',
    displayName: '発信者名',
    description: 'コンテンツの発信者・著者名',
    sortOrder: 2,
  },
  {
    name: 'contentType',
    displayName: 'コンテンツタイプ',
    description: 'コンテンツの種類（構成パターン、スライドデザイン、学習ポイントなど）',
    sortOrder: 3,
  },
  {
    name: 'theme',
    displayName: 'テーマ',
    description: 'コンテンツのテーマ（技術解説、ビジネス、教育など）',
    sortOrder: 4,
  },
  {
    name: 'successLevel',
    displayName: '成功度',
    description: 'コンテンツの成功度（高、中、低）',
    sortOrder: 5,
  },
];

const initialTags = {
  genre: [
    { value: 'SEO', displayName: 'SEO記事', color: '#10B981' },
    { value: '動画', displayName: '動画', color: '#EF4444' },
    { value: 'スライド', displayName: 'スライド', color: '#3B82F6' },
    { value: 'メール', displayName: 'メール', color: '#8B5CF6' },
    { value: '共通', displayName: '共通', color: '#6B7280' },
  ],
  author: [
    { value: '赤原', displayName: '赤原', color: '#F59E0B' },
    { value: 'ひかりちゃん', displayName: 'ひかりちゃん', color: '#EC4899' },
  ],
  contentType: [
    { value: '構成パターン', displayName: '構成パターン', color: '#14B8A6' },
    { value: 'スライドデザイン', displayName: 'スライドデザイン', color: '#6366F1' },
    { value: 'タイミング戦略', displayName: 'タイミング戦略', color: '#F97316' },
    { value: '説明パターン', displayName: '説明パターン', color: '#84CC16' },
    { value: 'AI活用戦略', displayName: 'AI活用戦略', color: '#06B6D4' },
    { value: '学習ポイント', displayName: '学習ポイント', color: '#A855F7' },
    { value: '執筆スタイル', displayName: '執筆スタイル', color: '#D946EF' },
  ],
  theme: [
    { value: '技術解説', displayName: '技術解説', color: '#2563EB' },
    { value: 'ビジネス', displayName: 'ビジネス', color: '#DC2626' },
    { value: '教育', displayName: '教育', color: '#059669' },
    { value: 'ライフスタイル', displayName: 'ライフスタイル', color: '#DB2777' },
  ],
  successLevel: [
    { value: '高', displayName: '高', color: '#22C55E' },
    { value: '中', displayName: '中', color: '#EAB308' },
    { value: '低', displayName: '低', color: '#EF4444' },
  ],
};

async function setupTags() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    console.log('🚀 タグシステムの初期データをセットアップ中...\n');

    // カテゴリーを挿入
    for (const category of initialCategories) {
      const [result] = await connection.execute(
        `INSERT INTO tagCategories (name, displayName, description, sortOrder) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE displayName = VALUES(displayName), description = VALUES(description), sortOrder = VALUES(sortOrder)`,
        [category.name, category.displayName, category.description, category.sortOrder]
      );
      console.log(`✅ カテゴリー「${category.displayName}」を作成しました`);

      // カテゴリーIDを取得
      const [rows] = await connection.execute(
        'SELECT id FROM tagCategories WHERE name = ?',
        [category.name]
      );
      const categoryId = rows[0].id;

      // タグを挿入
      if (initialTags[category.name]) {
        for (let i = 0; i < initialTags[category.name].length; i++) {
          const tag = initialTags[category.name][i];
          await connection.execute(
            `INSERT INTO tags (categoryId, value, displayName, color, sortOrder) 
             VALUES (?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE displayName = VALUES(displayName), color = VALUES(color), sortOrder = VALUES(sortOrder)`,
            [categoryId, tag.value, tag.displayName, tag.color, i]
          );
          console.log(`  └─ タグ「${tag.displayName}」を作成しました`);
        }
      }
    }

    console.log('\n✅ タグシステムの初期データセットアップが完了しました！');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

setupTags().catch(console.error);
