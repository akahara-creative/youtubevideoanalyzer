import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { Download, Edit, FileText, Loader2, Search, Trash2, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { EditExportDialog } from "@/components/EditExportDialog";
import type { ExportHistory } from "../../../drizzle/schema";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingExport, setEditingExport] = useState<ExportHistory | null>(null);

  const { data: exports, isLoading } = trpc.exports.list.useQuery(
    {
      category: selectedCategory || undefined,
      search: searchQuery || undefined,
    },
    {
      enabled: !!user,
    }
  );

  const deleteMutation = trpc.exports.delete.useMutation({
    onSuccess: () => {
      utils.exports.list.invalidate();
      toast.success("エクスポートを削除しました");
    },
    onError: (error) => {
      toast.error(`削除に失敗しました: ${getErrorMessage(error)}`);
    },
  });

  const handleDelete = (exportId: number, fileName: string) => {
    if (confirm(`「${fileName}」を削除しますか?`)) {
      deleteMutation.mutate({ exportId });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "不明";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleString("ja-JP");
  };

  const parseTags = (tagsJson: string | null): string[] => {
    if (!tagsJson) return [];
    try {
      const parsed = JSON.parse(tagsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  // Get unique categories from exports
  const categories = useMemo(() => {
    if (!exports) return [];
    const cats = new Set<string>();
    exports.forEach((exp) => {
      if (exp.category) cats.add(exp.category);
    });
    return Array.from(cats).sort();
  }, [exports]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md bg-card text-card-foreground">
          <CardHeader>
            <CardTitle>ログインが必要です</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              ダッシュボードを表示するにはログインしてください
            </p>
            <Button asChild>
              <Link href="/">ホームに戻る</Link>
            </Button>
          </CardContent>
        </Card>
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
              <Button asChild variant="outline">
                <Link href="/">ホーム</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/history">分析履歴</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">ダッシュボード</h2>
            <p className="text-muted-foreground">
              エクスポートしたファイルの管理
            </p>
          </div>

          {/* Filters */}
          <Card className="bg-card text-card-foreground">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">検索</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="ファイル名、タグ、メモで検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">カテゴリ</label>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={selectedCategory === "" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory("")}
                    >
                      すべて
                    </Button>
                    {categories.map((cat) => (
                      <Button
                        key={cat}
                        variant={selectedCategory === cat ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat}
                        {selectedCategory === cat && (
                          <X className="w-3 h-3 ml-1" onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCategory("");
                          }} />
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exports List */}
          <Card className="bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                エクスポート履歴
              </CardTitle>
              <CardDescription>
                {exports && exports.length > 0
                  ? `${exports.length}件のエクスポート`
                  : "エクスポート履歴がありません"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!exports || exports.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>
                    {searchQuery || selectedCategory
                      ? "条件に一致するエクスポートが見つかりませんでした"
                      : "エクスポート履歴がありません"}
                  </p>
                  <p className="text-sm mt-2">
                    分析結果をエクスポートすると、ここに表示されます
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {exports.map((exportItem) => {
                    const tags = parseTags(exportItem.tags);
                    return (
                      <div
                        key={exportItem.id}
                        className="flex items-start justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                            <FileText className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate">
                              {exportItem.fileName}
                            </h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                              <span className="uppercase font-semibold">
                                {exportItem.exportType}
                              </span>
                              <span>{formatFileSize(exportItem.fileSize)}</span>
                              <span>{formatDate(exportItem.createdAt)}</span>
                            </div>
                            {exportItem.category && (
                              <div className="mt-2">
                                <span className="inline-block px-2 py-1 bg-blue-500/10 text-blue-500 rounded text-xs font-medium">
                                  {exportItem.category}
                                </span>
                              </div>
                            )}
                            {tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-block px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {exportItem.notes && (
                              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                {exportItem.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingExport(exportItem)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={exportItem.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={exportItem.fileName}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              DL
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(exportItem.id, exportItem.fileName)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <EditExportDialog
        exportItem={editingExport}
        open={!!editingExport}
        onOpenChange={(open) => {
          if (!open) setEditingExport(null);
        }}
      />
    </div>
  );
}
