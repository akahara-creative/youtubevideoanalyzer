import { recommendStrategies } from './server/strategyRecommendation.ts';
import { createVideoProject, generateScenarios } from './server/videoProjectDb.ts';
import { generateSlides } from './server/videoGenerator.ts';

async function testVideoGeneration() {
  console.log('=== 動画生成テスト開始 ===\n');

  // Step 1: 戦略レコメンデーション
  console.log('Step 1: 戦略レコメンデーション');
  const recommendations = await recommendStrategies({
    purpose: 'SEOとかバズ、プレゼント企画、SNSマーケという人は全員ステップメールを書くべき理由を解説する教育動画を作りたい',
    targetAudience: 'マーケター、ブロガー、SNS運用者',
    duration: '5-10分',
    style: 'わかりやすく、説得力のある',
  });

  console.log('推奨戦略:', JSON.stringify(recommendations, null, 2));
  console.log('\n');

  // Step 2: 動画プロジェクト作成
  console.log('Step 2: 動画プロジェクト作成');
  const project = await createVideoProject({
    userId: 1,
    title: 'ステップメールの重要性',
    description: 'SEOとかバズ、プレゼント企画、SNSマーケという人は全員ステップメールを書くべき理由',
    targetDuration: 600, // 10分
  });

  console.log('プロジェクトID:', project.id);
  console.log('\n');

  // Step 3: シナリオ生成
  console.log('Step 3: シナリオ生成');
  const scenarios = await generateScenarios(project.id, {
    theme: 'ステップメールの重要性',
    targetAudience: 'マーケター、ブロガー、SNS運用者',
    duration: '5-10分',
  });

  console.log('生成されたシーン数:', scenarios.length);
  scenarios.forEach((scene, i) => {
    console.log(`シーン${i + 1}: ${scene.title}`);
  });
  console.log('\n');

  // Step 4: スライド生成
  console.log('Step 4: スライド生成');
  for (const scene of scenarios) {
    console.log(`シーン「${scene.title}」のスライドを生成中...`);
    await generateSlides(project.id, scene.id);
  }

  console.log('\n=== 動画生成テスト完了 ===');
}

testVideoGeneration().catch(console.error);
