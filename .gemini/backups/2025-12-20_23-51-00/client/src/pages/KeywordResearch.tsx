import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, TrendingUp, Home, BarChart } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrlSafe } from "@/const";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function KeywordResearch() {
  const { user, loading: authLoading } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [multipleKeywords, setMultipleKeywords] = useState("");
  const [relatedResult, setRelatedResult] = useState<any>(null);
  const [compareResult, setCompareResult] = useState<any[]>([]);
  const [seoKeyword, setSeoKeyword] = useState("");
  const [seoResult, setSeoResult] = useState<any>(null);

  const relatedQuery = trpc.keywordResearch.getRelated.useQuery(
    { keyword, geo: "JP" },
    { enabled: false }
  );

  const compareQuery = trpc.keywordResearch.compareKeywords.useQuery(
    { keywords: multipleKeywords.split("\n").map(k => k.trim()).filter(k => k.length > 0), geo: "JP" },
    { enabled: false }
  );

  const seoAnalysisMutation = trpc.seoAnalysis.analyze.useMutation();

  const handleSearchRelated = async () => {
    if (!keyword.trim()) {
      toast.error("キーワードを入力してください");
      return;
    }

    try {
      const result = await relatedQuery.refetch();
      if (result.data) {
        setRelatedResult(result.data);
        toast.success("関連キーワードを取得しました");
      }
    } catch (error) {
      toast.error("エラーが発生しました");
    }
  };

  const handleCompare = async () => {
    const keywords = multipleKeywords.split("\n").map(k => k.trim()).filter(k => k.length > 0);
    
    if (keywords.length === 0) {
      toast.error("キーワードを入力してください");
      return;
    }

    if (keywords.length > 5) {
      toast.error("一度に比較できるのは5つまでです");
      return;
    }

    try {
      const result = await compareQuery.refetch();
      if (result.data) {
        setCompareResult(result.data);
        toast.success("キーワード比較が完了しました");
      }
    } catch (error) {
      toast.error("エラーが発生しました");
    }
  };

  const handleSEOAnalysis = async () => {
    if (!seoKeyword.trim()) {
      toast.error("キーワードを入力してください");
      return;
    }

    try {
      const result = await seoAnalysisMutation.mutateAsync({
        keyword: seoKeyword,
        limit: 10,
      });
      setSeoResult(result);
      toast.success("SEO分析が完了しました");
    } catch (error) {
      toast.error("エラーが発生しました");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>ログインが必要です</CardTitle>
            <CardDescription>
              キーワード選定機能を使用するには、ログインしてください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href={getLoginUrlSafe()}>ログイン</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">キーワード選定</h1>
            <p className="text-gray-300">
              Google Trendsを使用してSEO最適化されたキーワードを発見しましょう
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              ホーム
            </Button>
          </Link>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Related Keywords */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Search className="h-5 w-5" />
                関連キーワード検索
              </CardTitle>
              <CardDescription className="text-gray-400">
                1つのキーワードから関連するキーワードを発見
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="keyword" className="text-white">キーワード</Label>
                <Input
                  id="keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="例: YouTube 動画編集"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>

              <Button
                onClick={handleSearchRelated}
                disabled={relatedQuery.isFetching}
                className="w-full"
              >
                {relatedQuery.isFetching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    検索中...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    関連キーワードを検索
                  </>
                )}
              </Button>

              {relatedResult && (
                <div className="mt-4 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">平均検索ボリューム</h3>
                    <div className="text-3xl font-bold text-purple-400">
                      {relatedResult.averageInterest.toFixed(1)}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">関連キーワード</h3>
                    <div className="space-y-2">
                      {relatedResult.relatedQueries.map((query: string, index: number) => (
                        <div
                          key={index}
                          className="bg-gray-700 px-3 py-2 rounded text-sm"
                        >
                          {query}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compare Keywords */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                キーワード比較
              </CardTitle>
              <CardDescription className="text-gray-400">
                複数のキーワードを比較して最適なものを選択
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="multipleKeywords" className="text-white">
                  キーワード（改行区切り、最大5つ）
                </Label>
                <Textarea
                  id="multipleKeywords"
                  value={multipleKeywords}
                  onChange={(e) => setMultipleKeywords(e.target.value)}
                  placeholder="YouTube 動画編集&#10;動画編集 初心者&#10;動画編集 アプリ"
                  rows={5}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>

              <Button
                onClick={handleCompare}
                disabled={compareQuery.isFetching}
                className="w-full"
              >
                {compareQuery.isFetching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    比較中...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    キーワードを比較
                  </>
                )}
              </Button>

              {compareResult.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">比較結果</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-white">順位</TableHead>
                        <TableHead className="text-white">キーワード</TableHead>
                        <TableHead className="text-white">検索ボリューム</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compareResult.map((item) => (
                        <TableRow key={item.keyword}>
                          <TableCell className="text-white">{item.rank}</TableCell>
                          <TableCell className="text-white">{item.keyword}</TableCell>
                          <TableCell className="text-white">
                            {item.averageInterest.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SEO Analysis */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              SEO分析
            </CardTitle>
            <CardDescription className="text-gray-400">
              上位記事を分析して、推奨キーワード出現回数を算出
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="seoKeyword" className="text-white">キーワード</Label>
              <Input
                id="seoKeyword"
                value={seoKeyword}
                onChange={(e) => setSeoKeyword(e.target.value)}
                placeholder="例: YouTube 動画編集"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>

            <Button
              onClick={handleSEOAnalysis}
              disabled={seoAnalysisMutation.isPending}
              className="w-full"
            >
              {seoAnalysisMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <BarChart className="mr-2 h-4 w-4" />
                  SEO分析を実行
                </>
              )}
            </Button>

            {seoResult && (
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">平均文字数</h3>
                  <div className="text-3xl font-bold text-purple-400">
                    {seoResult.averageWordCount.toLocaleString()}文字
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">推奨キーワード出現回数</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-white">キーワード</TableHead>
                        <TableHead className="text-white">推奨回数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(seoResult.recommendedKeywordFrequency).map(([kw, freq]: [string, any]) => (
                        <TableRow key={kw}>
                          <TableCell className="text-white">{kw}</TableCell>
                          <TableCell className="text-white">{freq}回</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">SEOインサイト</h3>
                  <div className="bg-gray-700 px-4 py-3 rounded text-sm whitespace-pre-wrap">
                    {seoResult.insights}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
