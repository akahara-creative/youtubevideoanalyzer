import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { FileText, Loader2, Trash2, Eye, Download } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { Link } from "wouter";

export default function GeneratedContents() {
  const { user, loading: authLoading } = useAuth();
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportingContentId, setExportingContentId] = useState<number | null>(null);

  const { data: contents, refetch } = trpc.generatedContents.list.useQuery(undefined, {
    enabled: !!user,
  });

  const deleteContent = trpc.generatedContents.delete.useMutation({
    onSuccess: () => {
      toast.success("コンテンツを削除しました");
      refetch();
    },
  });

  const exportMarkdown = trpc.generatedContents.exportMarkdown.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Markdownファイルをエクスポートしました");
      setIsExportDialogOpen(false);
    },
  });

  const exportPdf = trpc.generatedContents.exportPdf.useMutation({
    onSuccess: (data) => {
      window.open(data.url, '_blank');
      toast.success("PDFファイルをエクスポートしました");
      setIsExportDialogOpen(false);
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <p className="text-center">ログインしてください</p>
        </Card>
      </div>
    );
  }

  const filteredContents = contents?.filter((c) => {
    if (filterType === "all") return true;
    return c.contentType === filterType;
  });

  const contentTypeLabels: Record<string, string> = {
    general: "一般",
    email: "メール",
    slide: "スライド",
    script: "スクリプト",
    longContent: "長文",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <h1 className="text-2xl font-bold text-white cursor-pointer hover:text-purple-300 transition-colors">
                YouTube動画分析アプリ
              </h1>
            </Link>
            <nav className="flex items-center gap-6">
              <Link href="/history">
                <span className="text-white/70 hover:text-white transition-colors cursor-pointer">分析履歴</span>
              </Link>
              <Link href="/dashboard">
                <span className="text-white/70 hover:text-white transition-colors cursor-pointer">ダッシュボード</span>
              </Link>
              <Link href="/chat">
                <span className="text-white/70 hover:text-white transition-colors cursor-pointer">AIチャット</span>
              </Link>
              <Link href="/generated-contents">
                <span className="text-purple-300 font-semibold cursor-pointer">生成履歴</span>
              </Link>
              <Link href="/import">
                <span className="text-white/70 hover:text-white transition-colors cursor-pointer">メルマガインポート</span>
              </Link>
              <span className="text-white/70">{user.name || "ユーザー"}</span>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-white mb-2">生成履歴</h2>
          <p className="text-white/70">AIチャットで生成したコンテンツの履歴</p>
        </div>

        {/* Filter */}
        <div className="mb-6 flex items-center gap-4">
          <span className="text-white">フィルター:</span>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="general">一般</SelectItem>
              <SelectItem value="email">メール</SelectItem>
              <SelectItem value="slide">スライド</SelectItem>
              <SelectItem value="script">スクリプト</SelectItem>
              <SelectItem value="longContent">長文</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contents List */}
        <div className="grid gap-4">
          {filteredContents?.map((content) => (
            <Card key={content.id} className="bg-white/10 border-white/20 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-5 h-5 text-purple-400" />
                    <span className="text-sm font-semibold text-purple-300">
                      {contentTypeLabels[content.contentType]}
                    </span>
                    <span className="text-sm text-white/50">
                      {new Date(content.createdAt).toLocaleString("ja-JP")}
                    </span>
                  </div>
                  <div className="text-white/80 text-sm line-clamp-3">
                    {content.content.substring(0, 200)}...
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-purple-600/30 border-purple-500/50 hover:bg-purple-600/50"
                    onClick={() => {
                      setSelectedContent(content);
                      setIsViewDialogOpen(true);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-blue-600/30 border-blue-500/50 hover:bg-blue-600/50"
                    onClick={() => {
                      setExportingContentId(content.id);
                      setIsExportDialogOpen(true);
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-red-600/30 border-red-500/50 hover:bg-red-600/50"
                    onClick={() => {
                      if (confirm("本当に削除しますか？")) {
                        deleteContent.mutate({ id: content.id });
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {filteredContents?.length === 0 && (
            <Card className="bg-white/10 border-white/20 p-8 text-center">
              <p className="text-white/70">生成履歴がありません</p>
            </Card>
          )}
        </div>
      </main>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedContent && contentTypeLabels[selectedContent.contentType]}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] p-4">
            {selectedContent && (
              <div className="prose prose-invert max-w-none">
                <Streamdown>{selectedContent.content}</Streamdown>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>エクスポート形式を選択</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                if (exportingContentId) {
                  exportMarkdown.mutate({ id: exportingContentId });
                }
              }}
              disabled={exportMarkdown.isPending}
            >
              {exportMarkdown.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Markdown (.md)
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                if (exportingContentId) {
                  exportPdf.mutate({ id: exportingContentId });
                }
              }}
              disabled={exportPdf.isPending}
            >
              {exportPdf.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              PDF (.pdf)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
