import { getDb } from '../server/db';
import { tagCategories, tags } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const db = await getDb();
  if (!db) {
    console.error('No DB connection');
    process.exit(1);
  }

  const categories = [
    { name: 'genre', displayName: 'ジャンル', description: '記事のジャンル' },
    { name: 'contentType', displayName: 'コンテンツタイプ', description: '記事の種類' },
    { name: 'competitor', displayName: '競合分析', description: '競合記事分析用' },
  ];

  for (const cat of categories) {
    const existing = await db.select().from(tagCategories).where(eq(tagCategories.name, cat.name));
    if (existing.length === 0) {
      console.log(`Creating category: ${cat.name}`);
      await db.insert(tagCategories).values({
        name: cat.name,
        displayName: cat.displayName,
        description: cat.description,
        sortOrder: 0
      });
    } else {
      console.log(`Category exists: ${cat.name}`);
    }
  }

  // Ensure 'competitor_article' tag exists in 'competitor' category
  const competitorCat = await db.select().from(tagCategories).where(eq(tagCategories.name, 'competitor'));
  if (competitorCat.length > 0) {
    const catId = competitorCat[0].id;
    const tagName = 'competitor_article';
    const existingTag = await db.select().from(tags).where(eq(tags.value, tagName));
    
    if (existingTag.length === 0) {
      console.log(`Creating tag: ${tagName}`);
      await db.insert(tags).values({
        categoryId: catId,
        value: tagName,
        displayName: '競合記事',
        color: '#FF0000',
        sortOrder: 0
      });
    } else {
      console.log(`Tag exists: ${tagName}`);
    }
  } else {
    console.error('Competitor category not found (should have been created)');
  }

  console.log('Done');
  process.exit(0);
}

main();
