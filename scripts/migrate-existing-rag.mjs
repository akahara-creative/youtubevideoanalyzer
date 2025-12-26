import mysql from 'mysql2/promise';
import 'dotenv/config';

/**
 * Migrate existing RAG data to the new tag-based system
 * This script:
 * 1. Finds existing content imports (mailmag data)
 * 2. Creates RAG documents with appropriate tags
 * 3. Links them to the tag system
 */
async function migrateExistingRAG() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    console.log('🚀 既存RAGデータの移行を開始します...\n');

    // Get tag IDs
    const [genreTagsRows] = await connection.execute(
      `SELECT t.id, t.value FROM tags t
       JOIN tagCategories tc ON t.categoryId = tc.id
       WHERE tc.name = 'genre'`
    );
    const genreTags = Object.fromEntries(genreTagsRows.map(row => [row.value, row.id]));

    const [authorTagsRows] = await connection.execute(
      `SELECT t.id, t.value FROM tags t
       JOIN tagCategories tc ON t.categoryId = tc.id
       WHERE tc.name = 'author'`
    );
    const authorTags = Object.fromEntries(authorTagsRows.map(row => [row.value, row.id]));

    const [contentTypeTagsRows] = await connection.execute(
      `SELECT t.id, t.value FROM tags t
       JOIN tagCategories tc ON t.categoryId = tc.id
       WHERE tc.name = 'contentType'`
    );
    const contentTypeTags = Object.fromEntries(contentTypeTagsRows.map(row => [row.value, row.id]));

    console.log('📋 タグマッピング:');
    console.log('  ジャンル:', Object.keys(genreTags));
    console.log('  発信者:', Object.keys(authorTags));
    console.log('  コンテンツタイプ:', Object.keys(contentTypeTags));
    console.log('');

    // 1. Migrate content imports (mailmag data)
    console.log('📧 メルマガデータを移行中...');
    const [contentImports] = await connection.execute(
      `SELECT id, fileName, extractedText, category, createdAt 
       FROM contentImports 
       WHERE extractedText IS NOT NULL AND extractedText != ''
       LIMIT 100`
    );

    let migratedCount = 0;
    for (const content of contentImports) {
      try {
        // Create RAG document
        const [result] = await connection.execute(
          `INSERT INTO ragDocuments (content, type, sourceId, successLevel, importance, createdAt, updatedAt)
           VALUES (?, 'mailmag', ?, '高', 0, ?, ?)`,
          [
            content.extractedText.substring(0, 10000), // Limit content length
            `import_${content.id}`,
            content.createdAt,
            new Date()
          ]
        );

        const documentId = result.insertId;

        // Add tags
        const tagIds = [
          genreTags['共通'], // Genre: 共通
          contentTypeTags['執筆スタイル'], // ContentType: 執筆スタイル
        ].filter(Boolean);

        // Determine author from filename
        if (content.fileName.includes('赤原') || content.fileName.includes('akahara')) {
          tagIds.push(authorTags['赤原']);
        } else if (content.fileName.includes('ひかり') || content.fileName.includes('hikari')) {
          tagIds.push(authorTags['ひかりちゃん']);
        }

        // Insert tag relationships
        for (const tagId of tagIds) {
          await connection.execute(
            `INSERT INTO ragDocumentTags (documentId, tagId, createdAt)
             VALUES (?, ?, ?)`,
            [documentId, tagId, new Date()]
          );
        }

        migratedCount++;
        if (migratedCount % 10 === 0) {
          console.log(`  ✅ ${migratedCount}件のメルマガデータを移行しました`);
        }
      } catch (error) {
        console.error(`  ❌ エラー (ID: ${content.id}):`, error.message);
      }
    }

    console.log(`\n✅ メルマガデータの移行完了: ${migratedCount}件\n`);

    // 2. Migrate SEO articles
    console.log('📝 SEO記事データを移行中...');
    const [seoArticles] = await connection.execute(
      `SELECT id, theme, article, createdAt 
       FROM seoArticles 
       WHERE article IS NOT NULL AND article != ''
       LIMIT 50`
    );

    let seoMigratedCount = 0;
    for (const article of seoArticles) {
      try {
        // Create RAG document
        const [result] = await connection.execute(
          `INSERT INTO ragDocuments (content, type, sourceId, successLevel, importance, createdAt, updatedAt)
           VALUES (?, 'seo_article', ?, '高', 0, ?, ?)`,
          [
            `テーマ: ${article.theme}\n\n${article.article.substring(0, 10000)}`,
            `seo_${article.id}`,
            article.createdAt,
            new Date()
          ]
        );

        const documentId = result.insertId;

        // Add tags
        const tagIds = [
          genreTags['SEO'], // Genre: SEO
          contentTypeTags['構成パターン'], // ContentType: 構成パターン
        ].filter(Boolean);

        // Insert tag relationships
        for (const tagId of tagIds) {
          await connection.execute(
            `INSERT INTO ragDocumentTags (documentId, tagId, createdAt)
             VALUES (?, ?, ?)`,
            [documentId, tagId, new Date()]
          );
        }

        seoMigratedCount++;
        if (seoMigratedCount % 10 === 0) {
          console.log(`  ✅ ${seoMigratedCount}件のSEO記事を移行しました`);
        }
      } catch (error) {
        console.error(`  ❌ エラー (ID: ${article.id}):`, error.message);
      }
    }

    console.log(`\n✅ SEO記事データの移行完了: ${seoMigratedCount}件\n`);

    // Summary
    console.log('📊 移行サマリー:');
    console.log(`  メルマガデータ: ${migratedCount}件`);
    console.log(`  SEO記事: ${seoMigratedCount}件`);
    console.log(`  合計: ${migratedCount + seoMigratedCount}件`);
    console.log('\n✅ 既存RAGデータの移行が完了しました！');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

migrateExistingRAG().catch(console.error);
