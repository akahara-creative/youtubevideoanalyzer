import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { FileText, Loader2, Trash2, Star, Upload, Home } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { APP_TITLE, getLoginUrlSafe } from "@/const";
import { Link } from "wouter";

export default function Import() {
  const { user, loading: authLoading } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const { data: documents = [], refetch: refetchDocuments } = trpc.rag.listDocuments.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: allTagsData, refetch: refetchTags } = trpc.tags.getAllWithCategories.useQuery(undefined, {
    enabled: !!user,
  });

  const uploadMutation = trpc.rag.uploadDocument.useMutation({
    onSuccess: () => {
      toast.success("ファイルをアップロードしました");
      setSelectedFile(null);
      refetchDocuments();
      setIsUploading(false);
    },
    onError: (error) => {
      toast.error(`アップロードエラー: ${getErrorMessage(error)}`);
      setIsUploading(false);
    },
  });

  const deleteMutation = trpc.rag.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("ドキュメントを削除しました");
      refetchDocuments();
    },
    onError: (error) => {
      toast.error(`削除エラー: ${getErrorMessage(error)}`);
    },
  });

  const updateTagsMutation = trpc.rag.updateDocumentTags.useMutation({
    onSuccess: () => {
      toast.success("タグを更新しました");
      refetchDocuments();
    },
    onError: (error) => {
      toast.error(`タグ更新エラー: ${getErrorMessage(error)}`);
    },
  });

  const togglePickupMutation = trpc.rag.togglePickup.useMutation({
    onSuccess: () => {
      refetchDocuments();
    },
    onError: (error) => {
      toast.error(`ピックアップエラー: ${getErrorMessage(error)}`);
    },
  });

  const createTagMutation = trpc.tags.createTag.useMutation({
    onSuccess: () => {
      toast.success("タグを追加しました");
      setNewTagName("");
      setSelectedCategoryId(null);
      refetchTags();
    },
    onError: (error) => {
      toast.error(`タグ追加エラー: ${getErrorMessage(error)}`);
    },
  });

  const deleteTagMutation = trpc.tags.deleteTag.useMutation({
    onSuccess: () => {
      toast.success("タグを削除しました");
      refetchTags();
      refetchDocuments();
    },
    onError: (error) => {
      toast.error(`タグ削除エラー: ${getErrorMessage(error)}`);
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.txt') || file.name.endsWith('.docx') || file.name.endsWith('.pdf') || file.name.endsWith('.m4a')) {
        setSelectedFile(file);
      } else {
        toast.error('txt, docx, pdf, m4a形式のファイルのみ対応しています');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("ファイルを選択してください");
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileContent = e.target?.result as string;
        const base64Content = fileContent.split(",")[1];

        const fileType = selectedFile.name.endsWith(".pdf")
          ? "pdf"
          : selectedFile.name.endsWith(".docx")
          ? "docx"
          : selectedFile.name.endsWith(".m4a")
          ? "m4a"
          : "txt";

        await uploadMutation.mutateAsync({
          fileName: selectedFile.name,
          fileContent: base64Content,
          fileType,
        });
      };

      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error("Upload error:", error);
      setIsUploading(false);
    }
  };

  const handleTagToggle = (docId: number, tagId: number) => {
    const doc = documents.find((d: any) => d.id === docId);
    if (!doc) return;

    // Get current tag IDs from the document
    const currentTagIds = doc.tags?.map((t: any) => {
      // Find the tag ID by matching the value
      const matchingTag = allTagsData
        ?.flatMap((cat: any) => cat.tags)
        .find((tag: any) => tag.value === t.value);
      return matchingTag?.id;
    }).filter(Boolean) || [];

    const isChecked = currentTagIds.includes(tagId);
    const newTagIds = isChecked
      ? currentTagIds.filter((id: number) => id !== tagId)
      : [...currentTagIds, tagId];

    updateTagsMutation.mutate({
      documentId: docId,
      tagIds: newTagIds,
    });
  };

  const handleTogglePickup = (docId: number, currentPickedUp: number) => {
    togglePickupMutation.mutate({
      documentId: docId,
      pickedUp: currentPickedUp === 1 ? 0 : 1,
    });
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) {
      toast.error("タグ名を入力してください");
      return;
    }

    if (!selectedCategoryId) {
      toast.error("カテゴリを選択してください");
      return;
    }

    createTagMutation.mutate({
      categoryId: selectedCategoryId,
      value: newTagName.trim(),
      displayName: newTagName.trim(),
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-2xl font-bold">{APP_TITLE}</h1>
        <p className="text-muted-foreground">ログインしてRAG管理を利用してください</p>
        <Button asChild>
              <a href={getLoginUrlSafe()}>ログイン</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">RAG管理</h1>
            <p className="text-purple-200">ドキュメントをアップロードしてタグ付けし、AI参照できるようにします</p>
          </div>
          <Link href="/">
            <Button variant="outline" className="gap-2 bg-white/10 border-white/20 hover:bg-white/20">
              <Home className="h-4 w-4" />
              ホーム
            </Button>
          </Link>
        </div>

        {/* ファイルアップロード */}
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">ファイルアップロード</CardTitle>
            <CardDescription className="text-purple-200">txt, docx, pdf, m4a形式のファイルに対応しています</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-purple-400 bg-purple-700/30'
                  : 'border-white/30 hover:border-purple-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Input
                type="file"
                accept=".txt,.docx,.pdf,.m4a"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-12 w-12 text-purple-200" />
                <span className="text-sm text-purple-200">
                  {selectedFile ? selectedFile.name : "ファイルをドラッグ&ドロップ"}
                </span>
                <span className="text-xs text-purple-300">または</span>
                <Button variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20">
                  ファイルを選択
                </Button>
              </label>
            </div>

            {selectedFile && (
              <div className="flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      アップロード中...
                    </>
                  ) : (
                    "アップロード"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedFile(null)}
                  className="bg-white/10 border-white/20 hover:bg-white/20"
                >
                  キャンセル
                </Button>
              </div>
            )}

            {/* 新しいタグを追加 */}
            <div className="pt-4 border-t border-white/20">
              <Label className="text-white mb-2 block">新しいタグを追加</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedCategoryId?.toString() || ""}
                  onValueChange={(value) => setSelectedCategoryId(Number(value))}
                >
                  <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="カテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTagsData?.map((category: any) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="タグ名を入力"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-purple-300"
                />
                <Button
                  onClick={handleAddTag}
                  disabled={createTagMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  追加
                </Button>
              </div>
            </div>

            {/* 全タグ一覧 */}
            <div className="pt-4 border-t border-white/20">
              <Label className="text-white mb-2 block">全タグ一覧</Label>
              <div className="space-y-4">
                {allTagsData?.map((category: any) => (
                  <div key={category.id}>
                    <h4 className="text-sm font-semibold text-purple-200 mb-2">{category.displayName}</h4>
                    <div className="flex flex-wrap gap-2">
                      {category.tags.map((tag: any) => (
                        <div
                          key={tag.id}
                          className="flex items-center gap-2 bg-white/10 border border-white/20 rounded px-3 py-1.5"
                        >
                          <span className="text-sm text-white">{tag.displayName}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`タグ「${tag.displayName}」を削除しますか？このタグが紐付いているRAGドキュメントからも削除されます。`)) {
                                deleteTagMutation.mutate({ tagId: tag.id });
                              }
                            }}
                            className="h-auto p-0 text-red-400 hover:text-red-300 hover:bg-transparent"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RAGドキュメント一覧 */}
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">RAGドキュメント一覧</CardTitle>
            <CardDescription className="text-purple-200">
              登録されているドキュメント: {documents.length}件
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-center text-purple-300 py-8">まだドキュメントが登録されていません</p>
            ) : (
              <div className="space-y-4">
                {documents.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="bg-white/5 border border-white/20 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-purple-300" />
                          <h3 className="font-semibold text-white">ドキュメント #{doc.id}</h3>
                          {doc.pickedUp === 1 && (
                            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                          )}
                        </div>
                        <p className="text-sm text-purple-200 mt-2 line-clamp-2">{doc.content}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTogglePickup(doc.id, doc.pickedUp || 0)}
                          className={
                            doc.pickedUp === 1
                              ? "bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/30"
                              : "bg-white/10 border-white/20 hover:bg-white/20"
                          }
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('本当に削除しますか？')) {
                              deleteMutation.mutate({ documentId: doc.id });
                            }
                          }}
                          className="bg-white/10 border-white/20 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* タグチェックボックス */}
                    <div className="space-y-2">
                      <Label className="text-sm text-purple-200">タグを選択</Label>
                      <div className="flex flex-wrap gap-2">
                        {allTagsData?.map((category: any) =>
                          category.tags.map((tag: any) => {
                            const isChecked = doc.tags?.some((t: any) => t.value === tag.value);
                            return (
                              <label
                                key={tag.id}
                                className="flex items-center gap-2 bg-white/10 border border-white/20 rounded px-3 py-1.5 cursor-pointer hover:bg-white/20"
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => handleTagToggle(doc.id, tag.id)}
                                />
                                <span className="text-sm text-white">{tag.displayName}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-purple-300 flex items-center gap-4">
                      <span>登録日: {new Date(doc.createdAt).toLocaleDateString()}</span>
                      <span>重要度: {doc.importance || 0}</span>
                      <span>使用回数: {doc.usageCount || 0}</span>
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
