import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { Loader2, MessageSquare, Plus, Send, Trash2, FolderKey, Settings, Save, BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function Chat() {
  const { user, loading: authLoading } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [contentType, setContentType] = useState<"general" | "email" | "slide" | "script" | "longContent">("general");
  const [selectedKeywordProjectId, setSelectedKeywordProjectId] = useState<number | null>(null);
  const [lastKeywordCounts, setLastKeywordCounts] = useState<Array<{ keyword: string; count: number; targetCount: number }>>([]);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [isManageProjectDialogOpen, setIsManageProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordTarget, setNewKeywordTarget] = useState<number>(5);
  const [isSaveTemplateDialogOpen, setIsSaveTemplateDialogOpen] = useState(false);
  const [isTemplateListDialogOpen, setIsTemplateListDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track if conversation ID was set from URL to prevent overwriting
  const [conversationIdFromUrl, setConversationIdFromUrl] = useState(false);

  // Get conversationId from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const conversationIdParam = params.get('conversationId');
    console.log('[DEBUG] URL params:', { conversationIdParam });
    if (conversationIdParam) {
      const id = parseInt(conversationIdParam, 10);
      console.log('[DEBUG] Setting selectedConversationId to:', id);
      setSelectedConversationId(id);
      setConversationIdFromUrl(true);
    }
  }, []);

  const { data: conversations, refetch: refetchConversations } = trpc.chat.listConversations.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: conversationData, refetch: refetchMessages } = trpc.chat.getConversation.useQuery(
    { conversationId: selectedConversationId! },
    { enabled: !!selectedConversationId }
  );

  const { data: keywordProjects } = trpc.keywordProject.list.useQuery(undefined, {
    enabled: !!user,
  });

  const createConversation = trpc.chat.createConversation.useMutation({
    onSuccess: (data) => {
      setSelectedConversationId(data.conversationId);
      refetchConversations();
      toast.success("新しい会話を作成しました");
    },
  });

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      refetchMessages();
      setMessage("");
      if (data.keywordCounts && data.keywordCounts.length > 0) {
        setLastKeywordCounts(data.keywordCounts);
      }
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  const deleteConversation = trpc.chat.deleteConversation.useMutation({
    onSuccess: () => {
      setSelectedConversationId(null);
      refetchConversations();
      toast.success("会話を削除しました");
    },
  });

  const updateConversationProject = trpc.chat.updateKeywordProject.useMutation({
    onSuccess: () => {
      refetchConversations();
      toast.success("キーワードプロジェクトを設定しました");
    },
  });

  const createProject = trpc.keywordProject.create.useMutation({
    onSuccess: (data) => {
      toast.success("プロジェトを作成しました");
      setNewProjectName("");
      setIsCreateProjectDialogOpen(false);
      trpc.useUtils().keywordProjects.list.invalidate();
      setSelectedKeywordProjectId(data.id);
      if (selectedConversationId) {
        updateConversationProject.mutate({
          conversationId: selectedConversationId,
          keywordProjectId: data.id,
        });
      }
    },
  });

  const { data: selectedProjectItems, refetch: refetchProjectItems } = trpc.keywordProject.getItems.useQuery(
    { projectId: selectedKeywordProjectId! },
    { enabled: !!selectedKeywordProjectId }
  );

  const addKeywordItem = trpc.keywordProject.addItem.useMutation({
    onSuccess: () => {
      toast.success("キーワードを追加しました");
      setNewKeyword("");
      setNewKeywordTarget(5);
      refetchProjectItems();
    },
  });

  const deleteKeywordItem = trpc.keywordProject.deleteItem.useMutation({
    onSuccess: () => {
      toast.success("キーワードを削除しました");
      refetchProjectItems();
    },
  });

  const saveContent = trpc.generatedContents.create.useMutation({
    onSuccess: () => {
      toast.success("コンテンツを保存しました");
    },
    onError: (error) => {
      toast.error(`保存エラー: ${getErrorMessage(error)}`);
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationData?.messages]);

  // Create first conversation if none exist
  useEffect(() => {
    // Don't auto-select if conversation ID was set from URL
    if (conversationIdFromUrl) {
      console.log('[DEBUG] Skipping auto-select because conversationId is from URL');
      return;
    }
    
    if (conversations && conversations.length === 0 && !selectedConversationId) {
      createConversation.mutate({});
    } else if (conversations && conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, conversationIdFromUrl]);

  // Sync keyword project ID when conversation changes
  useEffect(() => {
    if (conversationData) {
      setSelectedKeywordProjectId(conversationData.keywordProjectId || null);
    }
  }, [conversationData]);

  const handleSendMessage = () => {
    console.log('[DEBUG] handleSendMessage called', { message: message.trim(), selectedConversationId, contentType });
    alert(`[DEBUG] handleSendMessage called! conversationId=${selectedConversationId}, message="${message.trim()}", contentType=${contentType}`);
    
    if (!message.trim() || !selectedConversationId) {
      console.log('[DEBUG] Validation failed - returning');
      alert('[DEBUG] Validation failed!');
      return;
    }

    console.log('[DEBUG] Calling sendMessage.mutate...');
    alert('[DEBUG] About to call sendMessage.mutate');
    sendMessage.mutate({
      conversationId: selectedConversationId,
      message: message.trim(),
      contentType,
    });
    console.log('[DEBUG] sendMessage.mutate called');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <p className="text-lg mb-4">ログインが必要です</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">AIチャット</h1>
            </div>
            <div className="flex items-center gap-4">
              <a href="/" className="text-white/70 hover:text-white transition-colors">
                ホーム
              </a>
              <a href="/dashboard" className="text-white/70 hover:text-white transition-colors">
                ダッシュボード
              </a>
              <a href="/generated-contents" className="text-white/70 hover:text-white transition-colors">
                生成履歴
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
          {/* Conversations Sidebar */}
          <Card className="col-span-3 bg-white/5 border-white/10 backdrop-blur-sm p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">会話履歴</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => createConversation.mutate({})}
                disabled={createConversation.isPending}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {conversations?.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                      selectedConversationId === conv.id
                        ? "bg-purple-600/30 border border-purple-500/50"
                        : "bg-white/5 hover:bg-white/10 border border-transparent"
                    }`}
                    onClick={() => setSelectedConversationId(conv.id)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white truncate flex-1">{conv.title || "新しい会話"}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation.mutate({ conversationId: conv.id });
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </Button>
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      {new Date(conv.updatedAt).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Chat Area */}
          <Card className="col-span-9 bg-white/5 border-white/10 backdrop-blur-sm flex flex-col">
            {/* Content Type Tabs and Keyword Project Selector */}
            <div className="border-b border-white/10 p-4 space-y-4">
              <Tabs value={contentType} onValueChange={(v) => setContentType(v as typeof contentType)}>
                <TabsList className="bg-white/10">
                  <TabsTrigger value="general">一般</TabsTrigger>
                  <TabsTrigger value="email">メール生成</TabsTrigger>
                  <TabsTrigger value="slide">スライド生成</TabsTrigger>
                  <TabsTrigger value="script">スクリプト生成</TabsTrigger>
                  <TabsTrigger value="longContent">長文生成</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Keyword Project Selector */}
              <div className="flex items-center gap-3">
                <FolderKey className="w-4 h-4 text-purple-400" />
                <Select
                  value={selectedKeywordProjectId?.toString() || "none"}
                  onValueChange={(value) => {
                    const projectId = value === "none" ? null : parseInt(value);
                    setSelectedKeywordProjectId(projectId);
                    if (selectedConversationId) {
                      updateConversationProject.mutate({
                        conversationId: selectedConversationId,
                        keywordProjectId: projectId,
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-[250px] bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="キーワードプロジェクトを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">プロジェクトなし</SelectItem>
                    {keywordProjects?.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Create Project Button */}
                <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="bg-purple-600/30 border-purple-500/50 hover:bg-purple-600/50">
                      <Plus className="w-4 h-4 mr-1" />
                      新規
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>キーワードプロジェクトを作成</DialogTitle>
                      <DialogDescription>新しいキーワードプロジェクトを作成します。</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="project-name">プロジェクト名</Label>
                        <Input
                          id="project-name"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder="例: ブログ記事SEOプロジェクト"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          if (newProjectName.trim()) {
                            createProject.mutate({ name: newProjectName.trim() });
                          }
                        }}
                        disabled={!newProjectName.trim()}
                      >
                        作成
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Manage Project Button */}
                {selectedKeywordProjectId && (
                  <Dialog open={isManageProjectDialogOpen} onOpenChange={setIsManageProjectDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20">
                        <Settings className="w-4 h-4 mr-1" />
                        管理
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>キーワード管理</DialogTitle>
                        <DialogDescription>プロジェクトのキーワードを管理します。</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {/* Add Keyword Form */}
                        <div className="flex gap-2">
                          <Input
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            placeholder="キーワードを入力"
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={newKeywordTarget}
                            onChange={(e) => setNewKeywordTarget(parseInt(e.target.value) || 0)}
                            placeholder="目標回数"
                            className="w-24"
                          />
                          <Button
                            onClick={() => {
                              if (newKeyword.trim() && selectedKeywordProjectId) {
                                addKeywordItem.mutate({
                                  projectId: selectedKeywordProjectId,
                                  keyword: newKeyword.trim(),
                                  targetCount: newKeywordTarget,
                                });
                              }
                            }}
                            disabled={!newKeyword.trim()}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Keyword List */}
                        <ScrollArea className="h-[300px] border rounded-lg p-4">
                          <div className="space-y-2">
                            {selectedProjectItems?.map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded">
                                <div>
                                  <span className="font-medium">{item.keyword}</span>
                                  <span className="text-sm text-muted-foreground ml-2">
                                    (目標: {item.targetCount}回)
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteKeywordItem.mutate({ id: item.id })}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              <div className="space-y-6">
                {conversationData?.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        msg.role === "user"
                          ? "bg-purple-600/30 border border-purple-500/50"
                          : "bg-white/10 border border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-white/70">
                          {msg.role === "user" ? "ユーザー" : "AI"}
                        </div>
                        {msg.role === "assistant" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-purple-300 hover:text-purple-100 hover:bg-purple-600/30"
                            onClick={() => {
                              saveContent.mutate({
                                conversationId: selectedConversationId!,
                                contentType,
                                content: msg.content,
                                keywordProjectId: selectedKeywordProjectId || undefined,
                              });
                            }}
                          >
                            保存
                          </Button>
                        )}
                      </div>
                      <div className="text-white prose prose-invert max-w-none">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    </div>
                  </div>
                ))}

                {sendMessage.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 border border-white/20 rounded-lg p-4">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                    </div>
                  </div>
                )}

                {/* Keyword Counts Display */}
                {lastKeywordCounts.length > 0 && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-purple-900/30 border border-purple-500/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-purple-300">キーワード出現回数</div>
                        {lastKeywordCounts.some((kc) => kc.count < kc.targetCount) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-yellow-600/30 border-yellow-500/50 hover:bg-yellow-600/50 text-xs"
                            onClick={() => {
                              const underPerformingKeywords = lastKeywordCounts
                                .filter((kc) => kc.count < kc.targetCount)
                                .map((kc) => `${kc.keyword}（あと${kc.targetCount - kc.count}回）`)
                                .join("、");
                              const optimizationPrompt = `以下のキーワードが目標回数に達していません。これらのキーワードを自然に追加して、コンテンツを再生成してください。\n\n不足キーワード: ${underPerformingKeywords}`;
                              setMessage(optimizationPrompt);
                            }}
                          >
                            最適化
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {lastKeywordCounts.map((kc, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-4">
                            <span className="text-white text-sm">{kc.keyword}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-32 bg-white/10 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full ${
                                    kc.count >= kc.targetCount ? "bg-green-500" : "bg-yellow-500"
                                  }`}
                                  style={{
                                    width: `${kc.targetCount > 0 ? Math.min((kc.count / kc.targetCount) * 100, 100) : 0}%`,
                                  }}
                                />
                              </div>
                              <span
                                className={`text-sm font-mono ${
                                  kc.count >= kc.targetCount ? "text-green-400" : "text-yellow-400"
                                }`}
                              >
                                {kc.count}/{kc.targetCount}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t border-white/10 p-4">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    contentType === "email"
                      ? "メールの内容を説明してください..."
                      : contentType === "slide"
                      ? "スライドのテーマを説明してください..."
                      : contentType === "script"
                      ? "動画のテーマを説明してください..."
                      : contentType === "longContent"
                      ? "長文記事のテーマと構成を説明してください（2-3万文字）..."
                      : "メッセージを入力..."
                  }
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  disabled={!selectedConversationId || sendMessage.isPending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || !selectedConversationId || sendMessage.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {/* Debug info */}
              <div className="text-xs text-white/50 mt-2">
                Debug: conversationId={selectedConversationId || 'null'}, 
                message={message.trim() ? 'yes' : 'no'}, 
                pending={sendMessage.isPending ? 'yes' : 'no'},
                fromUrl={conversationIdFromUrl ? 'yes' : 'no'}
              </div>
              <p className="text-xs text-white/50 mt-2">
                過去の動画分析結果を参考にして、AIが回答します
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
