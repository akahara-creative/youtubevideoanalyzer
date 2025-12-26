import { generateBlogStrategy } from "./server/blogStrategyAdvisor.ts";

async function testStrategyAdvisor() {
  console.log("=== Testing Blog Strategy Advisor with Competitor Analysis ===\n");

  const projectName = "健康食品ブログSEO対策";
  const projectDescription = "健康食品に関するブログ記事のSEO対策とキーワード選定";
  
  const keywords = [
    {
      id: 1,
      keyword: "プロテイン おすすめ",
      searchVolume: null,
      competition: "medium",
      targetCount: null,
      seoAnalysisData: null,
    },
    {
      id: 2,
      keyword: "ビタミンC サプリ",
      searchVolume: null,
      competition: null,
      targetCount: null,
      seoAnalysisData: null,
    },
    {
      id: 3,
      keyword: "オメガ3 効果",
      searchVolume: null,
      competition: null,
      targetCount: null,
      seoAnalysisData: null,
    },
  ];

  try {
    console.log("Generating strategy with competitor analysis...\n");
    const strategy = await generateBlogStrategy(projectName, projectDescription, keywords);
    
    console.log("✅ Strategy generated successfully!\n");
    console.log("=== Prioritized Keywords ===");
    strategy.prioritizedKeywords.forEach((kw, index) => {
      console.log(`\n${index + 1}. ${kw.keyword}`);
      console.log(`   Priority: ${kw.priority}`);
      console.log(`   Difficulty: ${kw.estimatedDifficulty}`);
      console.log(`   Suggested Length: ${kw.suggestedContentLength} characters`);
      console.log(`   Reason: ${kw.reason}`);
      
      if (kw.suggestedArticleTitles && kw.suggestedArticleTitles.length > 0) {
        console.log(`   Suggested Article Titles:`);
        kw.suggestedArticleTitles.forEach((title, i) => {
          console.log(`     ${i + 1}. ${title}`);
        });
      }
      
      if (kw.competitorData) {
        console.log(`   Competitor Analysis:`);
        console.log(`     - Average Word Count: ${kw.competitorData.averageWordCount}`);
        console.log(`     - Recommended Word Count: ${kw.competitorData.recommendedWordCount}`);
        console.log(`     - Co-occurring Keywords: ${kw.competitorData.coOccurringKeywords.slice(0, 5).join(", ")}`);
        console.log(`     - Related Keywords: ${kw.competitorData.relatedKeywords.slice(0, 5).join(", ")}`);
        console.log(`     - Expert Vocabulary: ${kw.competitorData.expertVocabulary.slice(0, 5).join(", ")}`);
      }
    });
    
    console.log("\n=== Content Plan ===");
    console.log("Phase 1:", strategy.contentPlan.phase1.join(", "));
    console.log("Phase 2:", strategy.contentPlan.phase2.join(", "));
    console.log("Phase 3:", strategy.contentPlan.phase3.join(", "));
    
    console.log("\n=== Overall Strategy ===");
    console.log(strategy.overallStrategy);
    
    console.log("\n=== Estimated Timeline ===");
    console.log(strategy.estimatedTimeline);
    
  } catch (error) {
    console.error("❌ Error generating strategy:", error);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

testStrategyAdvisor();
