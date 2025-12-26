import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import StrategyBrainstorm from "./pages/StrategyBrainstorm";
import StrategyRecommendation from "./pages/StrategyRecommendation";
import StrategySearch from "./pages/StrategySearch";
import VideoProjects from "./pages/VideoProjects";
import VideoProjectDetail from "./pages/VideoProjectDetail";
import Analysis from "./pages/Analysis";
import History from "./pages/History";
import SharedAnalysis from "./pages/SharedAnalysis";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Import from "./pages/Import";
import LongContent from "./pages/LongContent";
import KeywordResearch from "./pages/KeywordResearch";
import KeywordProjects from "./pages/KeywordProjects";
import GeneratedContents from "./pages/GeneratedContents";
import SEOArticle from "./pages/SEOArticle";
import TagManagement from "./pages/TagManagement";
import VideoGeneration from "./pages/VideoGeneration";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/strategy-search" component={StrategySearch} />
      <Route path="/strategy-recommendation" component={StrategyRecommendation} />
      <Route path="/strategy-brainstorm" component={StrategyBrainstorm} />
      <Route path={"/video-projects"} component={VideoProjects} />
      <Route path={"/video-projects/:id"} component={VideoProjectDetail} />
      <Route path="/analysis/:id" component={Analysis} />
      <Route path="/history" component={History} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/chat" component={Chat} />
      <Route path="/import" component={Import} />
      <Route path="/long-content" component={LongContent} />
      <Route path="/keyword-research" component={KeywordResearch} />
      <Route path="/keyword-projects" component={KeywordProjects} />
      <Route path="/generated-contents" component={GeneratedContents} />
      <Route path="/seo-article" component={SEOArticle} />
      <Route path="/tags" component={TagManagement} />
      <Route path="/video-generation" component={VideoGeneration} />
      <Route path="/share/:token" component={SharedAnalysis} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
