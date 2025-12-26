import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { APP_TITLE, getLoginUrlSafe } from "@/const";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { Loader2, Video, PlayCircle, FileText, Code } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState("");

  const analyzeMutation = trpc.video.analyze.useMutation({
    onSuccess: (data) => {
      toast.success("動画分析を開始しました");
      setYoutubeUrl("");
      setIsAnalyzing(false);
      window.location.href = `/analysis/${data.analysisId}`;
    },
    onError: (error) => {
      toast.error(`エラーが発生しました: ${getErrorMessage(error)}`);
      setIsAnalyzing(false);
    },
  });

  const analyzeBatchMutation = trpc.video.analyzeBatch.useMutation({
    onSuccess: (data) => {
      const successCount = data.results.filter(r => r.status === "started").length;
      const errorCount = data.results.filter(r => r.status === "error").length;
      
      if (successCount > 0) {
        toast.success(`${successCount}件の動画分析を開始しました`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount}件の動画がエラーでした`);
      }
      
      setBatchUrls("");
      setIsAnalyzing(false);
      window.location.href = "/history";
    },
    onError: (error) => {
      toast.error(`エラーが発生しました: ${getErrorMessage(error)}`);
      setIsAnalyzing(false);
    },
  });

  const handleAnalyze = () => {
    if (!youtubeUrl.trim()) {
      toast.error("YouTube URLを入力してください");
      return;
    }
    setIsAnalyzing(true);
    analyzeMutation.mutate({ youtubeUrl });
  };

  const handleBatchAnalyze = () => {
    const urls = batchUrls.split("\n").map(url => url.trim()).filter(url => url.length > 0);
    
    if (urls.length === 0) {
      toast.error("URLを入力してください");
      return;
    }
    
    if (urls.length > 20) {
      toast.error("一度に分析できるのは20件までです");
      return;
    }
    
    setIsAnalyzing(true);
    analyzeBatchMutation.mutate({ youtubeUrls: urls });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
        <header className="container py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">{APP_TITLE}</h1>
            <Button asChild>
              <a href={getLoginUrlSafe()}>ログイン</a>
            </Button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-4xl w-full text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-5xl font-bold text-foreground">
                YouTube動画を
                <span className="text-primary"> AI分析</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                動画の音声を文字起こしし、映像内容を分析。タイムライン形式で学習内容を整理します。
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <Card className="bg-card text-card-foreground">
                <CardHeader>
                  <FileText className="w-12 h-12 text-primary mb-2" />
                  <CardTitle>音声文字起こし</CardTitle>
                  <CardDescription>
                    Whisper APIで高精度な文字起こしを実現
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-card text-card-foreground">
                <CardHeader>
                  <Video className="w-12 h-12 text-primary mb-2" />
                  <CardTitle>映像分析</CardTitle>
                  <CardDescription>
                    画面に表示される内容をAIが自動で解析
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-card text-card-foreground">
                <CardHeader>
                  <Code className="w-12 h-12 text-primary mb-2" />
                  <CardTitle>コード認識</CardTitle>
                  <CardDescription>
                    プログラミング動画のコードを自動抽出・説明
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            <div className="pt-8">
              <Button size="lg" asChild>
                <a href={getLoginUrlSafe()}>
                  <PlayCircle className="w-5 h-5 mr-2" />
                  今すぐ始める
                </a>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-card-foreground">{APP_TITLE}</h1>
            <div className="flex items-center gap-4">
              <Link href="/history">
                <Button variant="ghost">分析履歴</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="ghost">ダッシュボード</Button>
              </Link>
              <Link href="/chat">
                <Button variant="ghost">AIチャット</Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost">RAG</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link href="/import">インポート</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/strategy-search">戦略検索</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/tags">タグ管理</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link href="/strategy-recommendation">
                <Button variant="ghost">戦略レコメンデーション</Button>
              </Link>
              <Link href="/strategy-brainstorm">
                <Button variant="ghost">戦略壁打ち</Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost">動画生成</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link href="/video-generation">ナレーション動画生成</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/video-projects">動画プロジェクト</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link href="/seo-article">
                <Button variant="ghost">SEO記事生成</Button>
              </Link>
              <span className="text-sm text-muted-foreground">{user?.name}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-12">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-bold text-foreground">YouTube動画を分析</h2>
            <p className="text-lg text-muted-foreground">
              URLを入力して、動画の内容を詳しく分析しましょう
            </p>
          </div>

          <Card className="bg-card text-card-foreground">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>動画URL入力</CardTitle>
                  <CardDescription>
                    {isBatchMode ? "複数のYouTube URLを改行区切りで入力してください" : "分析したいYouTube動画のURLを入力してください"}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBatchMode(!isBatchMode)}
                >
                  {isBatchMode ? "単一モード" : "バッチモード"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isBatchMode ? (
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    disabled={isAnalyzing}
                    className="flex-1 bg-background text-foreground"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAnalyze();
                      }
                    }}
                  />
                  <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        分析中...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-4 h-4 mr-2" />
                        分析開始
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    placeholder="https://www.youtube.com/watch?v=...&#10;https://www.youtube.com/watch?v=...&#10;https://www.youtube.com/watch?v=..."
                    value={batchUrls}
                    onChange={(e) => setBatchUrls(e.target.value)}
                    disabled={isAnalyzing}
                    className="w-full min-h-[150px] p-3 rounded-md border border-input bg-background text-foreground resize-y"
                  />
                  <Button onClick={handleBatchAnalyze} disabled={isAnalyzing} className="w-full">
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        分析中...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-4 h-4 mr-2" />
                        バッチ分析開始
                      </>
                    )}
                  </Button>
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                <p className="font-semibold mb-2">分析内容:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>音声の文字起こし(タイムスタンプ付き)</li>
                  <li>映像内容の詳細分析</li>
                  <li>コードの自動抽出と説明</li>
                  <li>学習ポイントのまとめ</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-card text-card-foreground">
              <CardContent className="pt-6">
                <FileText className="w-8 h-8 text-primary mb-2" />
                <h3 className="font-semibold mb-1">高精度文字起こし</h3>
                <p className="text-sm text-muted-foreground">
                  Whisper APIによる正確な音声認識
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card text-card-foreground">
              <CardContent className="pt-6">
                <Video className="w-8 h-8 text-primary mb-2" />
                <h3 className="font-semibold mb-1">映像内容解析</h3>
                <p className="text-sm text-muted-foreground">
                  画面表示内容をAIが自動分析
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card text-card-foreground">
              <CardContent className="pt-6">
                <Code className="w-8 h-8 text-primary mb-2" />
                <h3 className="font-semibold mb-1">コード認識</h3>
                <p className="text-sm text-muted-foreground">
                  プログラミング学習に最適
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
