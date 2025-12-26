import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, FileText, Trash2, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrlSafe } from "@/const";
import { Link } from "wouter";

export default function LongContent() {
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [targetWordCount, setTargetWordCount] = useState("20000");
  const [contentType, setContentType] = useState<"blog" | "article" | "essay" | "report">("blog");
  const [tone, setTone] = useState("professional");
  const [keywords, setKeywords] = useState("");
  const [keywordProjectId, setKeywordProjectId] = useState<number | null>(null);
  const [useRAGStyle, setUseRAGStyle] = useState(false);

  // Fetch keyword projects
  const { data: keywordProjects } = trpc.keywordProject.list.useQuery(undefined, {
    enabled: !!user,
  });

  // Fetch keywords from selected project
  const { data: projectKeywords } = trpc.keywordProject.getItems.useQuery(
    { projectId: keywordProjectId! },
    { enabled: !!keywordProjectId }
  );

  // Auto-fill keywords when project keywords are loaded
  useEffect(() => {
    if (projectKeywords && projectKeywords.length > 0) {
      setKeywords(projectKeywords.map((k) => k.keyword).join(", "));
    }
  }, [projectKeywords]);

  const [isCreating, setIsCreating] = useState(false);

  const { data: contents, refetch } = trpc.longContent.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 5000, // Poll every 5 seconds to check generation status
  });

  const createMutation = trpc.longContent.create.useMutation({
    onSuccess: async (data) => {
      toast.success("コンテンツ生成を開始しました");
      // Start generation
      await generateMutation.mutateAsync({ contentId: data.contentId });
      refetch();
      // Reset form
      setTitle("");
      setPrompt("");
      setKeywords("");
      setIsCreating(false);
    },
    onError: (error) => {
      toast.error(`エラーが発生しました: ${getErrorMessage(error)}`);
      setIsCreating(false);
    },
  });

  const generateMutation = trpc.longContent.generate.useMutation();

  const deleteMutation = trpc.longContent.delete.useMutation({
    onSuccess: () => {
      toast.success("コンテンツを削除しました");
      refetch();
    },
    onError: (error) => {
      toast.error(`削除に失敗しました: ${getErrorMessage(error)}`);
    },
  });

  const handleCreate = async () => {
    if (!title.trim() || !prompt.trim()) {
      toast.error("タイトルとプロンプトを入力してください");
      return;
    }

    setIsCreating(true);
    createMutation.mutate({
      title: title.trim(),
      prompt: prompt.trim(),
      targetWordCount: parseInt(targetWordCount),
      contentType,
      tone,
      keywords: keywords.trim() ? keywords.split(",").map((k) => k.trim()) : undefined,
      useRAGStyle,
    });
  };

  const handleDelete = (contentId: number) => {
    if (confirm("このコンテンツを削除しますか？")) {
      deleteMutation.mutate({ contentId });
    }
  };

  const handleDownload = (content: any, format: "txt" | "md" | "docx") => {
    if (!content.content) {
      toast.error("コンテンツがまだ生成されていません");
      return;
    }

    if (format === "docx") {
      // For docx, download from server
      window.open(`/api/longContent/download/${content.id}?format=docx`, "_blank");
      toast.success("ダウンロードを開始しました");
      return;
    }

    let mimeType = "text/plain";
    let fileExtension = "txt";
    let fileContent = content.content;

    if (format === "md") {
      mimeType = "text/markdown";
      fileExtension = "md";
      // Add markdown formatting
      fileContent = `# ${content.title}\n\n${content.content}`;
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${content.title}.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("ダウンロードを開始しました");
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
              長文コンテンツ生成機能を使用するには、ログインしてください。
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
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">長文コンテンツ生成</h1>
          <p className="text-gray-300">
            2-3万文字のブログ記事や論文を自動生成します
          </p>
        </div>

        {/* Creation Form */}
        <Card className="mb-8 bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">新規コンテンツ作成</CardTitle>
            <CardDescription className="text-gray-400">
              タイトルとプロンプトを入力して、長文コンテンツを生成します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-white">タイトル</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: AIと動画制作の未来"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>

            <div>
              <Label htmlFor="prompt" className="text-white">プロンプト（詳細な指示）</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例: AIを活用した動画制作の最新トレンドについて、具体的な事例を交えながら詳しく解説してください。"
                rows={4}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="wordCount" className="text-white">目標文字数</Label>
                <Input
                  id="wordCount"
                  type="number"
                  value={targetWordCount}
                  onChange={(e) => setTargetWordCount(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>

              <div>
                <Label htmlFor="contentType" className="text-white">コンテンツタイプ</Label>
                <Select value={contentType} onValueChange={(v: any) => setContentType(v)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blog">ブログ</SelectItem>
                    <SelectItem value="article">記事</SelectItem>
                    <SelectItem value="essay">エッセイ</SelectItem>
                    <SelectItem value="report">レポート</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tone" className="text-white">トーン</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">プロフェッショナル</SelectItem>
                    <SelectItem value="casual">カジュアル</SelectItem>
                    <SelectItem value="academic">アカデミック</SelectItem>
                    <SelectItem value="friendly">フレンドリー</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="keywordProject" className="text-white">キーワードプロジェクト（オプション）</Label>
              <Select
                value={keywordProjectId?.toString() || ""}
                onValueChange={(v) => {
                  const id = v ? parseInt(v) : null;
                  setKeywordProjectId(id);
                  if (id && projectKeywords) {
                    setKeywords(projectKeywords.map((k) => k.keyword).join(", "));
                  }
                }}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="プロジェクトを選択" />
                </SelectTrigger>
                <SelectContent>
                  {keywordProjects?.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="keywords" className="text-white">キーワード（カンマ区切り、または上記プロジェクトから自動取得）</Label>
              <Input
                id="keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="例: AI, 動画編集, 自動化"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="useRAGStyle"
                checked={useRAGStyle}
                onChange={(e) => setUseRAGStyle(e.target.checked)}
                className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
              />
              <Label htmlFor="useRAGStyle" className="text-white flex items-center gap-2 cursor-pointer">
                <Sparkles className="h-4 w-4 text-purple-400" />
                過去のメルマガの執筆スタイルを使用
              </Label>
            </div>

            <Button
              onClick={handleCreate}
              disabled={isCreating || !title.trim() || !prompt.trim()}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                "コンテンツを生成"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Content List */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">生成履歴</CardTitle>
            <CardDescription className="text-gray-400">
              生成したコンテンツの一覧
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!contents || contents.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                まだコンテンツが生成されていません
              </p>
            ) : (
              <div className="space-y-4">
                {contents.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <FileText className="h-8 w-8 text-purple-400" />
                      <div className="flex-1">
                        <Link href={`/long-content/${item.id}`}>
                          <p className="font-medium text-white hover:text-purple-400 cursor-pointer">
                            {item.title}
                          </p>
                        </Link>
                        <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                          <span>
                            {item.status === "pending" && "待機中"}
                            {item.status === "generating" && "生成中..."}
                            {item.status === "completed" && `完了 (${item.actualWordCount}文字)`}
                            {item.status === "failed" && "失敗"}
                          </span>
                          <span>
                            {new Date(item.createdAt).toLocaleDateString("ja-JP", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        {item.status === "completed" && item.metadata && (() => {
                          try {
                            const metadata = JSON.parse(item.metadata as string);
                            const keywordCounts = metadata.keywordCounts;
                            if (keywordCounts && Object.keys(keywordCounts).length > 0) {
                              return (
                                <div className="mt-2 text-xs text-gray-500">
                                  <span className="font-semibold">キーワード出現回数:</span>
                                  {Object.entries(keywordCounts).map(([keyword, count]) => (
                                    <span key={keyword} className="ml-2">
                                      {keyword}: <span className="text-purple-400">{count as number}回</span>
                                    </span>
                                  ))}
                                </div>
                              );
                            }
                          } catch (e) {
                            // Ignore JSON parse errors
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === "completed" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                            >
                              <Download className="h-4 w-4 text-green-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleDownload(item, "txt")}>
                              TXT形式
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(item, "md")}>
                              Markdown形式
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(item, "docx")}>
                              Word形式
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
