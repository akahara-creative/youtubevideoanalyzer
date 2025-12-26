import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { ArrowLeft, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function StrategyRecommendation() {
  const { user, loading: authLoading } = useAuth();
  const [purpose, setPurpose] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [duration, setDuration] = useState("");
  const [style, setStyle] = useState("");

  const recommendMutation = trpc.strategy.recommend.useMutation({
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  const handleRecommend = () => {
    if (!purpose.trim()) {
      toast.error("目的を入力してください");
      return;
    }

    recommendMutation.mutate({
      purpose,
      targetAudience: targetAudience || undefined,
      duration: duration || undefined,
      style: style || undefined,
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-card-foreground">{APP_TITLE}</h1>
            <Link href="/">
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4 mr-2" />
                ホーム
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Lightbulb className="w-8 h-8 text-primary" />
              戦略レコメンデーション
            </h2>
            <p className="text-muted-foreground">
              あなたの目的に基づいて、RAGから最適な戦略を自動提案します
            </p>
          </div>

          <Card className="bg-card text-card-foreground mb-6">
            <CardHeader>
              <CardTitle>目的を入力</CardTitle>
              <CardDescription>
                作りたい動画の目的や条件を入力してください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="purpose">目的 *</Label>
                <Textarea
                  id="purpose"
                  placeholder="例: 教育動画を作りたい、商品紹介動画を作りたい"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={3}
                  className="bg-background text-foreground"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="targetAudience">対象視聴者</Label>
                  <Input
                    id="targetAudience"
                    placeholder="例: 初心者、専門家"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="bg-background text-foreground"
                  />
                </div>

                <div>
                  <Label htmlFor="duration">動画の長さ</Label>
                  <Input
                    id="duration"
                    placeholder="例: 5分、10分"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="bg-background text-foreground"
                  />
                </div>

                <div>
                  <Label htmlFor="style">スタイル</Label>
                  <Input
                    id="style"
                    placeholder="例: カジュアル、フォーマル"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="bg-background text-foreground"
                  />
                </div>
              </div>

              <Button
                onClick={handleRecommend}
                disabled={recommendMutation.isPending}
                className="w-full"
              >
                {recommendMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    戦略を提案
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {recommendMutation.data && (
            <div className="space-y-6">
              {/* Overall Summary */}
              <Card className="bg-primary/10 border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    総合推奨事項
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground">
                    {recommendMutation.data.overallSummary}
                  </p>
                </CardContent>
              </Card>

              {/* Category Recommendations */}
              {recommendMutation.data.recommendations.map((rec, index) => (
                <Card key={index} className="bg-card text-card-foreground">
                  <CardHeader>
                    <CardTitle>{rec.category}</CardTitle>
                    {rec.summary && (
                      <CardDescription>{rec.summary}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {rec.strategies.map((strategy, sIndex) => (
                        <div
                          key={sIndex}
                          className="p-4 rounded-lg bg-muted border border-border"
                        >
                          <h4 className="font-semibold text-foreground mb-2">
                            {strategy.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            {strategy.description}
                          </p>
                          <p className="text-xs text-muted-foreground italic">
                            推奨理由: {strategy.source}
                          </p>
                          {strategy.successLevel && (
                            <Badge variant="outline" className="mt-2">
                              成功度: {strategy.successLevel}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Action Buttons */}
              <Card className="bg-card text-card-foreground">
                <CardContent className="py-6">
                  <div className="flex gap-4">
                    <Button asChild className="flex-1">
                      <Link href="/video-projects">
                        <Sparkles className="w-4 h-4 mr-2" />
                        この戦略で動画を作成
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => recommendMutation.reset()}
                      className="flex-1"
                    >
                      別の目的で再提案
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Empty State */}
          {!recommendMutation.data && !recommendMutation.isPending && (
            <Card className="bg-muted">
              <CardContent className="py-12 text-center">
                <Lightbulb className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  目的を入力して、最適な戦略を提案してもらいましょう
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
