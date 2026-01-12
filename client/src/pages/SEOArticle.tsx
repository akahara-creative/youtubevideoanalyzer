import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, Download, Home, History, Trash2, Sparkles, Square } from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import CSVBatchUpload from "@/components/CSVBatchUpload";
import JobList from "@/components/JobList";

export default function SEOArticle() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [theme, setTheme] = useState("");
  const [targetWordCount, setTargetWordCount] = useState<number | "">("");
  const [authorName, setAuthorName] = useState("赤原");
  const [targetPersona, setTargetPersona] = useState(""); // ターゲットペルソナ像の特徴
  const [remarks, setRemarks] = useState(""); // 備考欄
  const [offer, setOffer] = useState(""); // オファー
  const [currentStep, setCurrentStep] = useState(0);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any>(null);
  const [structure, setStructure] = useState("");
  const [article, setArticle] = useState("");
  const [qualityCheck, setQualityCheck] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressDetail, setProgressDetail] = useState("");
  const [showEnhanceDialog, setShowEnhanceDialog] = useState(false);
  const [enhanceOption, setEnhanceOption] = useState<"keywords" | "full">("keywords");
  const [enhancedArticle, setEnhancedArticle] = useState<string | null>(null);
  const [enhancementResult, setEnhancementResult] = useState<any>(null);
  const lastCompletedJobId = useRef<number | null>(null);
  
  const { data: history = [], refetch: refetchHistory } = trpc.seoArticle.list.useQuery();
  const { data: allTagsData } = trpc.tags.getAllWithCategories.useQuery();
  
  // 発信者名カテゴリのタグ一覧を取得
  const authorTags = allTagsData?.find((cat: any) => cat.name === 'author')?.tags || [];
  const saveMutation = trpc.seoArticle.save.useMutation();
  const deleteMutation = trpc.seoArticle.delete.useMutation();
  const cancelJobMutation = trpc.seoArticle.cancelJob.useMutation({
    onSuccess: () => {
      toast.success("ジョブをキャンセルしました");
      refetchHistory();
    },
    onError: (error) => {
      toast.error(`キャンセル失敗: ${getErrorMessage(error)}`);
    }
  });
  const rewriteMutation = trpc.seoArticle.rewrite.useMutation({
    onSuccess: (data) => {
      toast.success("リライトを開始しました！完了までしばらくお待ちください。");
      // ポーリングで自動的に更新されるので、ここでは何もしない
    },
    onError: (error) => {
      toast.error(`リライトエラー: ${getErrorMessage(error)}`);
    }
  });

  const enhanceMutation = trpc.seoArticle.enhance.useMutation({
    onSuccess: (data) => {
      setEnhancedArticle(data.enhancedArticle);
      setEnhancementResult(data);
      toast.success("記事の加工が完了しました！");
    },
    onError: (error) => {
      toast.error(`加工エラー: ${getErrorMessage(error)}`);
    }
  });

  const exportWordPressHTMLMutation = trpc.seoArticle.exportWordPressHTML.useMutation();

  const polishArticleMutation = trpc.seoArticle.polishArticle.useMutation({
    onSuccess: async (polishData) => {
      // 最終仕上げ完了後、記事を更新
      setArticle(polishData.article);
      setCurrentStep(8);
      
      // Auto-save to history with polished article
      try {
        await saveMutation.mutateAsync({
          theme,
          keywords,
          analyses,
          criteria,
          structure,
          article: polishData.article,
          qualityCheck,
        });
        refetchHistory();
      } catch (error) {
        console.error('Failed to save article:', error);
      }
      
      toast.success("SEO記事の生成が完了しました！（赤原カラー全開）");
    },
    onError: (error) => {
      toast.error(`最終仕上げエラー: ${getErrorMessage(error)}`);
      setCurrentStep(8); // エラー時もステップ8に移動
    }
  });

  const createJobMutation = trpc.seoArticle.createJob.useMutation({
    onSuccess: (data) => {
      setCurrentJobId(data.jobId);
      setCurrentStep(1);
      toast.success("記事生成ジョブを開始しました");
    },
    onError: (error) => {
      console.error('[SEO Article] createJob error:', error);
      const errorMsg = getErrorMessage(error);
      
      // Check if the error is a JSON parse error (HTML response)
      if (errorMsg.includes('Unexpected token') || errorMsg.includes('<!doctype')) {
        toast.error('サーバーエラーが発生しました。ページを再読み込みして再度お試しください。');
      } else {
        toast.error(`エラーが発生しました: ${errorMsg}`);
      }
      setCurrentStep(0);
    }
  });

  // Poll job status every 3 seconds when a job is active
  const { data: jobStatus, isError, error } = trpc.seoArticle.getJobStatus.useQuery(
    { jobId: currentJobId! },
    { 
      enabled: currentJobId !== null,
      refetchInterval: (query) => {
        const data = query.state.data;
        // 生成完了または失敗した場合はポーリングを停止
        if (data?.status === 'completed' || data?.status === 'failed') {
          return false;
        }
        return 3000; // Poll every 3 seconds
      }
    }
  );

  // Handle errors
  useEffect(() => {
    if (isError && error) {
      console.error('[SEO Article] getJobStatus error:', error);
      const errorMsg = getErrorMessage(error);
      
      // Check if the error is a JSON parse error (HTML response)
      if (errorMsg.includes('Unexpected token') || errorMsg.includes('<!doctype')) {
        toast.error('サーバーエラーが発生しました。ページを再読み込みして再度お試しください。');
        setCurrentJobId(null); // Stop polling
      } else {
        toast.error(`エラーが発生しました: ${errorMsg}`);
      }
    }
  }, [isError, error]);

  // Update UI when job status changes
  useEffect(() => {
    if (!jobStatus) return;

    if (jobStatus.currentStep !== null) {
      setCurrentStep(jobStatus.currentStep);
    }
    if (jobStatus.progress !== null) {
      setProgress(jobStatus.progress);
    }
    if (jobStatus.progressDetail) {
      setProgressDetail(jobStatus.progressDetail);
    }

    if (jobStatus.status === "completed") {
      // Job completed successfully
      if (jobStatus.keywords) {
        // Ensure keywords is an array
        let keywordsArray: string[] = [];
        if (Array.isArray(jobStatus.keywords)) {
          keywordsArray = jobStatus.keywords.flat().filter((k: any) => typeof k === 'string');
        } else if (typeof jobStatus.keywords === 'string') {
          try {
            const parsed = JSON.parse(jobStatus.keywords);
            keywordsArray = Array.isArray(parsed) ? parsed.flat().filter((k: any) => typeof k === 'string') : [];
          } catch {
            keywordsArray = [];
          }
        } else if (typeof jobStatus.keywords === 'object') {
          keywordsArray = Object.values(jobStatus.keywords).flat().filter((k: any) => typeof k === 'string');
        }
        setKeywords(keywordsArray);
      }
      if (jobStatus.analyses) setAnalyses(jobStatus.analyses);
      if (jobStatus.criteria) setCriteria(jobStatus.criteria);
      if (jobStatus.structure) setStructure(JSON.stringify(jobStatus.structure));
      if (jobStatus.article) setArticle(jobStatus.article);
      if (jobStatus.qualityCheck) setQualityCheck(jobStatus.qualityCheck);
      
      // ジョブIDを保持（リライト機能で使用するため）
      // setCurrentJobId(null); // Stop polling - コメントアウト
      
      // トーストを一度だけ表示
      if (lastCompletedJobId.current !== currentJobId) {
        lastCompletedJobId.current = currentJobId;
        toast.success("SEO記事の生成が完了しました！");
      }
      
      // Auto-save to history
      if (jobStatus.article) {
        // Ensure keywords is an array
        let keywordsArray: string[] = [];
        if (Array.isArray(jobStatus.keywords)) {
          keywordsArray = jobStatus.keywords.flat().filter((k: any) => typeof k === 'string');
        } else if (typeof jobStatus.keywords === 'string') {
          try {
            const parsed = JSON.parse(jobStatus.keywords);
            keywordsArray = Array.isArray(parsed) ? parsed.flat().filter((k: any) => typeof k === 'string') : [];
          } catch {
            keywordsArray = [];
          }
        } else if (jobStatus.keywords && typeof jobStatus.keywords === 'object') {
          keywordsArray = Object.values(jobStatus.keywords).flat().filter((k: any) => typeof k === 'string');
        }
        
        saveMutation.mutate({
          theme: jobStatus.theme,
          keywords: keywordsArray,
          analyses: jobStatus.analyses || [],
          criteria: jobStatus.criteria || {},
          structure: JSON.stringify(jobStatus.structure || ""),
          article: jobStatus.article,
          qualityCheck: jobStatus.qualityCheck || {},
        });
        refetchHistory();
      }
    } else if (jobStatus.status === "failed") {
      // Job failed
      setCurrentJobId(null); // Stop polling
      toast.error(`記事生成に失敗しました: ${jobStatus.errorMessage || "不明なエラー"}`);
      setCurrentStep(0);
    }
  }, [jobStatus]);

  const handleGenerate = () => {
    if (!theme.trim()) {
      toast.error("テーマを入力してください");
      return;
    }
    createJobMutation.mutate({ 
      theme, 
      targetWordCount: targetWordCount === "" ? 5000 : Number(targetWordCount),
      authorName,
      targetPersona,
      remarks,
      offer,
      autoEnhance 
    });
  };

  const handleEnhance = () => {
    if (!currentJobId) {
      toast.error("記事がIDが見つかりません。再度記事を生成してください。");
      return;
    }

    const options = enhanceOption === "full" 
      ? {
          fixKeywords: true,
          generateAIO: true,
          generateFAQ: true,
          generateJSONLD: true,
          generateMeta: true,
        }
      : {
          fixKeywords: true,
        };

    enhanceMutation.mutate({ jobId: currentJobId, options });
    setShowEnhanceDialog(false);
  };

  const handleDownload = () => {
    const blob = new Blob([article], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${theme.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("記事をダウンロードしました");
  };

  const handleDownloadItem = (content: string, themeTitle: string) => {
    if (!content) {
      toast.error("ダウンロードするコンテンツがありません");
      return;
    }
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${themeTitle.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("記事をダウンロードしました");
  };

  const handleRewrite = () => {
    if (!currentJobId) {
      toast.error("記事がIDが見つかりません。再度記事を生成してください。");
      return;
    }
    rewriteMutation.mutate({ jobId: currentJobId });
  };

  const steps = [
    { id: 1, title: "テーマ決定", description: "記事のテーマを設定" },
    { id: 2, title: "検索ワード想定", description: "関連キーワードを生成" },
    { id: 3, title: "競合記事分析", description: "上位10記事を分析" },
    { id: 4, title: "SEO基準作成", description: "競合を上回る基準を設定" },
    { id: 5, title: "記事構成作成", description: "赤原カラー全開の構成を生成" },
    { id: 6, title: "記事生成", description: "SEO基準を満たす記事を生成" },
    { id: 7, title: "品質チェック", description: "基準クリア確認" },
    { id: 8, title: "最終仕上げ", description: "赤原カラー復元" },
  ];

  const handleLoadHistory = (historyItem: any) => {
    try {
      setTheme(historyItem.theme);
      setTargetWordCount(historyItem.targetWordCount || 5000);
      setTargetPersona(historyItem.targetPersona || "");
      setRemarks(historyItem.remarks || "");
      setOffer(historyItem.offer || "");
      // keywordsがJSON文字列の場合はパースして配列に変換
      const parsedKeywords = typeof historyItem.keywords === 'string' 
        ? JSON.parse(historyItem.keywords) 
        : historyItem.keywords;
      
      // Handle new object structure
      if (parsedKeywords && !Array.isArray(parsedKeywords) && typeof parsedKeywords === 'object') {
        setKeywords(parsedKeywords.searchKeywords || []);
      } else {
        setKeywords(Array.isArray(parsedKeywords) ? parsedKeywords : []);
      }
      // 他のJSON文字列フィールドも同様に処理
      const parsedAnalyses = typeof historyItem.analyses === 'string'
        ? JSON.parse(historyItem.analyses)
        : Array.isArray(historyItem.analyses)
        ? historyItem.analyses
        : [];
      setAnalyses(parsedAnalyses);
      const parsedCriteria = typeof historyItem.criteria === 'string'
        ? JSON.parse(historyItem.criteria)
        : historyItem.criteria || null;
      setCriteria(parsedCriteria);
      const parsedStructure = typeof historyItem.structure === 'string'
        ? JSON.parse(historyItem.structure)
        : historyItem.structure || null;
      setStructure(parsedStructure);
      setArticle(historyItem.article || '');
      const parsedQualityCheck = typeof historyItem.qualityCheck === 'string'
        ? JSON.parse(historyItem.qualityCheck)
        : historyItem.qualityCheck || null;
      setQualityCheck(parsedQualityCheck);
      setQualityCheck(parsedQualityCheck);
      
      // Use the saved step if available, otherwise default to 8 (completed)
      if (historyItem.status === 'processing' || historyItem.status === 'pending') {
        setCurrentStep(historyItem.currentStep || 1);
      } else {
        setCurrentStep(8);
      }
      
      // ジョブIDを設定（加工機能で使用）
      if (historyItem.id) {
        setCurrentJobId(historyItem.id);
      }
      setShowHistory(false);
    } catch (error) {
      console.error('Failed to load history item:', error);
      toast.error('履歴の読み込みに失敗しました。データ形式が不正です。');
    }
    toast.success("履歴から記事を読み込みました");
  };

  const handleDeleteHistory = async (id: number) => {
    if (!confirm("本当に削除しますか？")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      refetchHistory();
      toast.success("履歴を削除しました");
    } catch (error) {
      toast.error("削除に失敗しました");
    }
  };

  const handleCancelJob = async (id: number) => {
    if (!confirm("生成を中断しますか？")) return;
    try {
      await cancelJobMutation.mutateAsync({ id });
    } catch (error) {
      // Error handled in mutation
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex gap-2 mb-6">
        <Button
          variant="outline"
          onClick={() => setLocation("/")}
          className="gap-2"
        >
          <Home className="h-4 w-4" />
          ホームへ戻る
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowHistory(!showHistory)}
          className="gap-2"
        >
          <History className="h-4 w-4" />
          履歴 ({history.length})
        </Button>
      </div>
      <div>
        <h1 className="text-3xl font-bold">SEO記事生成</h1>
        <p className="text-muted-foreground mt-2">
          8ステッププロセスで検索上位を狙いつつ、赤原カラー全開のコンテンツを生成します
        </p>
      </div>

      {/* 履歴表示 */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle>生成履歴</CardTitle>
            <CardDescription>過去に生成したSEO記事の一覧</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">履歴がありません</p>
            ) : (
              <div className="space-y-4">
                {history.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        <span className="mr-2 text-primary font-mono">#{item.id}</span>
                        {item.theme}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString('ja-JP')}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          {(() => {
                            try {
                              if (!item.keywords) return 0;
                              const keywords = typeof item.keywords === 'string' ? JSON.parse(item.keywords) : item.keywords;
                              if (Array.isArray(keywords)) return keywords.length;
                              if (keywords && typeof keywords === 'object') {
                                // Handle new object structure { conclusionKeywords, trafficKeywords, searchKeywords }
                                return (keywords.searchKeywords?.length || 0);
                              }
                              return 0;
                            } catch {
                              return 0;
                            }
                          })()}キーワード
                        </span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          {item.article?.length || 0}文字
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadItem(item.article, item.theme)}
                        title="ダウンロード"
                        disabled={!item.article}
                      >
                        <Download className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoadHistory(item)}
                      >
                        読み込む
                      </Button>

                      {/* ステータス表示・停止ボタン（読み込むと削除の間） */}
                      <div className="min-w-[100px] flex justify-center">
                        {item.status === 'processing' || item.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-primary animate-pulse flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                            </span>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancelJob(item.id)}
                              title="生成を中断"
                              className="h-8 px-2"
                            >
                              <Square className="h-3 w-3 fill-current mr-1" />
                              停止
                            </Button>
                          </div>
                        ) : item.status === 'failed' || item.status === 'cancelled' ? (
                          <span className="text-xs text-red-500 flex items-center gap-1 font-medium border border-red-200 bg-red-50 px-2 py-1 rounded">
                            <XCircle className="h-3 w-3" />
                            {item.status === 'cancelled' ? '中断' : '失敗'}
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 flex items-center gap-1 font-medium border border-green-200 bg-green-50 px-2 py-1 rounded">
                            <CheckCircle2 className="h-3 w-3" />
                            完了
                          </span>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteHistory(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ステップインジケーター */}
      <Card>
        <CardHeader>
          <CardTitle>生成プロセス</CardTitle>
          <CardDescription>現在のステップ: {currentStep === 0 ? "未開始" : steps[currentStep - 1]?.title}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Progress bar */}
          {currentStep > 0 && (
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span>進捗: {progress}%</span>
                <span>{currentStep === 0 ? "未開始" : steps[currentStep - 1]?.title}</span>
              </div>
              {/* Progress Detail Message */}
              {(jobStatus?.progressDetail || progressDetail) && (
                <div className="text-xs text-primary mb-2 animate-pulse font-mono">
                  {jobStatus?.progressDetail || progressDetail}
                </div>
              )}
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-4 gap-4">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex flex-col items-center p-4 rounded-lg border ${
                  currentStep >= step.id
                    ? "bg-primary/10 border-primary"
                    : "bg-muted border-muted"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {currentStep > step.id ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : currentStep === step.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                  )}
                  <span className="font-semibold text-sm">{step.id}</span>
                </div>
                <p className="text-xs font-medium text-center">{step.title}</p>
                <p className="text-xs text-muted-foreground text-center mt-1">{step.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* テーマ入力 */}
      <Card>
        <CardHeader>
          <CardTitle>ステップ1: テーマ決定</CardTitle>
          <CardDescription>記事のテーマを入力してください</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">記事のテーマ</label>
            <Input
              placeholder="例: ネットビジネスで稼げない人は、料理をすべき理由"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              disabled={currentJobId !== null || polishArticleMutation.isPending}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">目標文字数</label>
              <Input
                type="number"
                placeholder="5000"
                value={targetWordCount}
                onChange={(e) => {
                  const val = e.target.value;
                  setTargetWordCount(val === '' ? "" : Number(val));
                }}
                disabled={currentJobId !== null || polishArticleMutation.isPending}
              />
              <p className="text-xs text-muted-foreground mt-1">
                競合記事がこれより長い場合、自動で調整されます
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">発信者名</label>
              <Select
                value={authorName}
                onValueChange={setAuthorName}
                disabled={currentJobId !== null || polishArticleMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="発信者を選択" />
                </SelectTrigger>
                <SelectContent>
                  {authorTags.map((tag: any) => (
                    <SelectItem key={tag.id} value={tag.displayName}>
                      {tag.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                筆者として記事を執筆する名前
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">ターゲットとするペルソナ像の特徴</label>
            <Input
              placeholder="例: 30代男性、会社員、副業で動画編集を始めたが稼げずに悩んでいる。将来への不安がある。"
              value={targetPersona}
              onChange={(e) => setTargetPersona(e.target.value)}
              disabled={currentJobId !== null || polishArticleMutation.isPending}
            />
            <p className="text-xs text-muted-foreground mt-1">
              この情報を元に、ターゲットの擬似人格（幼少期〜現在のエピソード、悩み、葛藤など）を生成します
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">備考欄</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="記事の概略、方向性、書いて欲しいこと、意図、網羅して欲しいSEOキーワードなど"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={currentJobId !== null || polishArticleMutation.isPending}
            />
            <p className="text-xs text-muted-foreground mt-1">
              記事の方向性や意図、必ず含めて欲しい要素などを自由に記述してください
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">オファー</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="例: 無料ステップメールへの登録、LINE公式アカウントへの誘導など。登録したくなるような訴求ポイントもあれば記述してください。"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              disabled={currentJobId !== null || polishArticleMutation.isPending}
            />
            <p className="text-xs text-muted-foreground mt-1">
              記事のゴールとなるオファー内容。ここへの誘導が自然に行われるように構成されます
            </p>
          </div>
          
          {/* 自動加工モード */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/20">
            <div className="space-y-0.5">
              <Label htmlFor="autoEnhance" className="font-semibold">自動加工モード</Label>
              <p className="text-sm text-muted-foreground">
                記事生成完了後、自動的にAIO要約・FAQ・JSON-LD・メタ情報を生成します
              </p>
            </div>
            <Switch
              id="autoEnhance"
              checked={autoEnhance}
              onCheckedChange={setAutoEnhance}
              disabled={currentJobId !== null || polishArticleMutation.isPending}
            />
          </div>
          
          <Button
            onClick={handleGenerate}
            disabled={currentJobId !== null || polishArticleMutation.isPending || !theme.trim()}
            className="w-full"
          >
            {currentJobId !== null || polishArticleMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {polishArticleMutation.isPending ? "最終仕上げ中..." : "生成中..."}
              </>
            ) : (
              "SEO記事を生成"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 生成結果 */}
      {currentStep > 1 && (
        <>
          {/* ステップ2: キーワード */}
          {keywords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>ステップ2: 検索ワード想定</CardTitle>
                <CardDescription>生成されたキーワード</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ステップ3: 競合分析詳細 */}
          {analyses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>ステップ3: 競合記事分析</CardTitle>
                <CardDescription>上位10記事のSEO対策データ</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">#</th>
                        <th className="text-left p-2">タイトル</th>
                        <th className="text-right p-2">文字数</th>
                        <th className="text-right p-2">H2</th>
                        <th className="text-right p-2">H3</th>
                        <th className="text-right p-2">キーワード出現</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyses.map((analysis: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-2">{idx + 1}</td>
                          <td className="p-2 max-w-xs truncate">
                            <a href={analysis.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {analysis.title}
                            </a>
                          </td>
                          <td className="p-2 text-right">{analysis.wordCount.toLocaleString()}</td>
                          <td className="p-2 text-right">{analysis.h2Count}</td>
                          <td className="p-2 text-right">{analysis.h3Count}</td>
                          <td className="p-2 text-right">
                            {analysis.keywordOccurrences.reduce((sum: number, ko: any) => sum + ko.count, 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* キーワード別出現回数 */}
                <div className="mt-6">
                  <h4 className="font-semibold mb-3">キーワード別出現回数</h4>
                  <div className="space-y-2">
                    {analyses[0]?.keywordOccurrences.map((ko: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="font-medium">{ko.keyword}</span>
                        <div className="flex gap-2">
                          {analyses.map((analysis: any, aIdx: number) => {
                            const count = analysis.keywordOccurrences.find((k: any) => k.keyword === ko.keyword)?.count || 0;
                            return (
                              <span key={aIdx} className="text-xs px-2 py-1 bg-background rounded">
                                #{aIdx + 1}: {count}回
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ステップ4: SEO基準 */}
          {criteria && (
            <Card>
              <CardHeader>
                <CardTitle>ステップ4: SEO基準設定</CardTitle>
                <CardDescription>競合を上回る基準を設定しました</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">目標文字数</p>
                    <p className="text-2xl font-bold">{criteria.targetWordCount}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">H2見出し数</p>
                    <p className="text-2xl font-bold">{criteria.targetH2Count}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">H3見出し数</p>
                    <p className="text-2xl font-bold">{criteria.targetH3Count}</p>
                  </div>
                </div>

                {/* キーワード目標回数 */}
                {criteria.targetKeywords && criteria.targetKeywords.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3">キーワード目標出現回数:</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">キーワード</th>
                            <th className="text-right p-2">目標回数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {criteria.targetKeywords.map((tk: any, idx: number) => (
                            <tr key={idx} className="border-b hover:bg-muted/50">
                              <td className="p-2">{tk.keyword}</td>
                              <td className="p-2 text-right font-semibold">{tk.minCount}回</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ステップ5: 記事構成 */}
          {structure && (
            <Card>
              <CardHeader>
                <CardTitle>ステップ5: 記事構成</CardTitle>
                <CardDescription>赤原カラー全開の構成</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <Streamdown>{structure}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ステップ6-7: 完成記事と品質チェック */}
          {article && qualityCheck && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>ステップ7: 品質チェック</CardTitle>
                  <CardDescription>
                    {qualityCheck && qualityCheck.passed ? (
                      <span className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        すべてのSEO基準をクリアしました
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-orange-600">
                        <XCircle className="h-4 w-4" />
                        一部の基準を満たしていません
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">実際の文字数</p>
                      <p className="text-2xl font-bold">{qualityCheck?.wordCount || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        目標: {criteria.targetWordCount}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">H2見出し数</p>
                      <p className="text-2xl font-bold">{qualityCheck?.h2Count || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        目標: {criteria.targetH2Count}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">H3見出し数</p>
                      <p className="text-2xl font-bold">{qualityCheck?.h3Count || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        目標: {criteria.targetH3Count}
                      </p>
                    </div>
                  </div>

                  {/* キーワード達成状況 */}
                  {qualityCheck.keywordCounts && qualityCheck.keywordCounts.length > 0 && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="font-semibold mb-3">キーワード達成状況:</p>
                      <div className="space-y-2">
                        {qualityCheck.keywordCounts.map((kc: any, idx: number) => {
                          const achieved = kc.count >= kc.target;
                          return (
                            <div
                              key={idx}
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                achieved
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-orange-50 border-orange-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {achieved ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-orange-600" />
                                )}
                                <span className="font-medium">{kc.keyword}</span>
                              </div>
                              <div className="text-sm">
                                <span className={achieved ? 'text-green-700' : 'text-orange-700'}>
                                  {kc.count}回
                                </span>
                                <span className="text-muted-foreground"> / 目標: {kc.target}回</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {qualityCheck.issues && qualityCheck.issues.length > 0 && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="font-semibold text-orange-900 mb-2">その他の改善項目:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {qualityCheck.issues
                          .filter((issue: string) => !issue.includes('キーワード'))
                          .map((issue: string, idx: number) => (
                            <li key={idx} className="text-sm text-orange-800">
                              {issue}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {/* リライトボタン */}
                  {qualityCheck && !qualityCheck.passed && (
                    <div className="flex justify-center pt-4">
                      <Button
                        onClick={handleRewrite}
                        disabled={rewriteMutation.isPending}
                        variant="default"
                        size="lg"
                        className="gap-2"
                      >
                        {rewriteMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            リライト中...
                          </>
                        ) : (
                          "不足キーワードを自動追加してリライト"
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ステップ8: 完成記事</CardTitle>
                  <CardDescription>
                    <Button onClick={handleDownload} variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Markdownでダウンロード
                    </Button>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none seo-article-content">
                    <Streamdown>{article}</Streamdown>
                  </div>
                  <style>{`
                    .seo-article-content h2 {
                      font-size: 1.75rem;
                      font-weight: 700;
                      margin-top: 2.5rem;
                      margin-bottom: 1.25rem;
                      padding-bottom: 0.5rem;
                      border-bottom: 2px solid hsl(var(--primary));
                      color: hsl(var(--foreground));
                    }
                    .seo-article-content h3 {
                      font-size: 1.375rem;
                      font-weight: 600;
                      margin-top: 1.75rem;
                      margin-bottom: 1rem;
                      padding-left: 0.75rem;
                      border-left: 4px solid hsl(var(--primary));
                      color: hsl(var(--foreground));
                    }
                    .seo-article-content p {
                      margin-bottom: 1.25rem;
                      line-height: 1.8;
                    }
                    .seo-article-content strong {
                      font-weight: 700;
                      color: hsl(var(--primary));
                    }
                  `}</style>
                </CardContent>
              </Card>

              {/* 記事分析データ表示 */}
              {article && (
                <Card>
                  <CardHeader>
                    <CardTitle>記事分析データ</CardTitle>
                    <CardDescription>
                      現在の記事の文字数、見出し数、キーワード網羅率です
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-sm text-muted-foreground mb-1">文字数</div>
                        <div className="text-2xl font-bold">{article.length.toLocaleString()}</div>
                      </div>
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-sm text-muted-foreground mb-1">H2見出し</div>
                        <div className="text-2xl font-bold">{(article.match(/^\s*##\s+/gm) || []).length}</div>
                      </div>
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-sm text-muted-foreground mb-1">H3見出し</div>
                        <div className="text-2xl font-bold">{(article.match(/^\s*###\s+/gm) || []).length}</div>
                      </div>
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-sm text-muted-foreground mb-1">キーワード網羅率</div>
                        <div className="text-2xl font-bold">
                          {(() => {
                            if (!jobStatus?.criteria?.targetKeywords) return "-";
                            const keywords = jobStatus.criteria.targetKeywords;
                            const covered = keywords.filter((k: any) => {
                              // Split keyword by space (half or full width)
                              const parts = k.keyword.split(/[\s　]+/);
                              if (parts.length === 1) return article.includes(parts[0]);
                              
                              // Create regex to allow up to 15 chars between words (for particles etc.)
                              // Escape special regex chars in keyword parts
                              const escapedParts = parts.map((p: string) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                              const pattern = escapedParts.join('.{0,15}');
                              return new RegExp(pattern).test(article);
                            }).length;
                            return `${Math.round((covered / keywords.length) * 100)}%`;
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold">キーワード出現状況</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border rounded-md">
                        {jobStatus?.criteria?.targetKeywords?.map((k: any, i: number) => {
                          // Same logic for individual counts
                          const parts = k.keyword.split(/[\s　]+/);
                          let count = 0;
                          
                          if (parts.length === 1) {
                            count = (article.match(new RegExp(k.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                          } else {
                            const escapedParts = parts.map((p: string) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                            const pattern = escapedParts.join('.{0,15}');
                            count = (article.match(new RegExp(pattern, 'g')) || []).length;
                          }
                          
                          return (
                            <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                              <span className="truncate mr-2" title={k.keyword}>{k.keyword}</span>
                              <span className={`font-mono font-bold ${count >= k.minCount ? 'text-green-600' : count > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                                {count}回 / {k.minCount}回
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 記事加工ボタン */}
              <Card>
                <CardHeader>
                  <CardTitle>記事をさらに加工する</CardTitle>
                  <CardDescription>
                    AIO対策、FAQ、JSON-LDなどを追加してSEOを強化します
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => setShowEnhanceDialog(true)}
                    variant="default"
                    className="w-full"
                    disabled={enhanceMutation.isPending}
                  >
                    {enhanceMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        加工中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        記事を加工する
                      </>
                    )}
                  </Button>

                  {/* 加工結果表示 */}
                  {enhancedArticle && (
                    <div className="mt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">加工後の記事</h3>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => {
                              const blob = new Blob([enhancedArticle], { type: "text/markdown" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${theme.replace(/\s+/g, "_")}_加工済.md`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                            variant="outline" 
                            size="sm"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Markdown
                          </Button>
                          {enhanceOption === "full" && (
                            <Button 
                              onClick={async () => {
                                if (!currentJobId) {
                                  toast.error("記事IDが見つかりません");
                                  return;
                                }
                                try {
                  const result = await exportWordPressHTMLMutation.mutateAsync({ jobId: currentJobId });
                  const blob = new Blob([result.html], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${theme.replace(/\s+/g, "_")}_WordPress.txt`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                  toast.success("WordPress用HTMLをダウンロードしました！");
                                } catch (error: any) {
                                  console.error('[WordPress Export Error]', error);
                                  const errorMessage = error?.message || '不明なエラー';
                                  toast.error(`エクスポートに失敗しました: ${errorMessage}`);
                                }
                              }}
                              variant="default" 
                              size="sm"
                              disabled={exportWordPressHTMLMutation.isPending}
                            >
                              {exportWordPressHTMLMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  生成中...
                                </>
                              ) : (
                                <>
                                  <Download className="mr-2 h-4 w-4" />
                                  WordPress HTML
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="prose prose-sm max-w-none seo-article-content">
                        <Streamdown>{enhancedArticle}</Streamdown>
                      </div>
                      
                      {/* AIO要約セクション */}
                      {enhancementResult?.aioSummary && (
                        <Card>
                          <CardHeader>
                            <CardTitle>AIO要約セクション</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-sm max-w-none">
                              <Streamdown>{enhancementResult.aioSummary}</Streamdown>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* FAQ */}
                      {enhancementResult?.faqSection && (
                        <Card>
                          <CardHeader>
                            <CardTitle>FAQ</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-sm max-w-none">
                              <Streamdown>{enhancementResult.faqSection}</Streamdown>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* JSON-LD */}
                      {enhancementResult?.jsonLd && (
                        <Card>
                          <CardHeader>
                            <CardTitle>JSON-LD（構造化データ）</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
                              {JSON.stringify(enhancementResult.jsonLd, null, 2)}
                            </pre>
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* メタ情報 */}
                      {enhancementResult?.metaInfo && (
                        <Card>
                          <CardHeader>
                            <CardTitle>メタ情報</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div>
                              <Label>SEOタイトル</Label>
                              <p className="text-sm text-muted-foreground">{enhancementResult.metaInfo.title}</p>
                            </div>
                            <div>
                              <Label>メタディスクリプション</Label>
                              <p className="text-sm text-muted-foreground">{enhancementResult.metaInfo.description}</p>
                            </div>
                            <div>
                              <Label>OGタイトル</Label>
                              <p className="text-sm text-muted-foreground">{enhancementResult.metaInfo.ogTitle}</p>
                            </div>
                            <div>
                              <Label>OGディスクリプション</Label>
                              <p className="text-sm text-muted-foreground">{enhancementResult.metaInfo.ogDescription}</p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* 加工オプション選択ダイアログ */}
      <Dialog open={showEnhanceDialog} onOpenChange={setShowEnhanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>記事加工オプションを選択</DialogTitle>
            <DialogDescription>
              記事をどのように加工するか選択してください
            </DialogDescription>
          </DialogHeader>
          
          <RadioGroup value={enhanceOption} onValueChange={(value) => setEnhanceOption(value as "keywords" | "full")}>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => setEnhanceOption("keywords")}>
                <RadioGroupItem value="keywords" id="keywords" />
                <div className="flex-1">
                  <Label htmlFor="keywords" className="cursor-pointer font-semibold">
                    「」付きキーワード修正のみ
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    スペース繋ぎキーワードを自然な日本語に修正します。最も軽量で高速です。
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    例: 「SEO 稼げない」 → 「SEOで稼げない」
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => setEnhanceOption("full")}>
                <RadioGroupItem value="full" id="full" />
                <div className="flex-1">
                  <Label htmlFor="full" className="cursor-pointer font-semibold">
                    フル加工（全部セット）
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    キーワード修正 + AIO要約 + FAQ + JSON-LD + メタ情報を生成します。
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                    <li>• AIO要約セクション（AI Overviews対策）</li>
                    <li>• FAQ（2〜6問）</li>
                    <li>• JSON-LD（構造化データ）</li>
                    <li>• メタ情報（SEOタイトル、ディスクリプション等）</li>
                  </ul>
                </div>
              </div>
            </div>
          </RadioGroup>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnhanceDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleEnhance}>
              加工を開始
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSVバッチ処理とジョブ一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>CSVバッチ処理</CardTitle>
          <CardDescription>
            CSVファイルで複数のテーマをまとめてアップロードし、一括生成できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "single" | "batch")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">単一生成</TabsTrigger>
              <TabsTrigger value="batch">バッチ生成</TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="mt-4">
              <p className="text-sm text-muted-foreground">
                上記のフォームから、1件ずつ記事を生成できます。
              </p>
            </TabsContent>
            <TabsContent value="batch" className="mt-4 space-y-4">
              <CSVBatchUpload 
                autoEnhance={autoEnhance} 
                onBatchCreated={(batchId) => setCurrentBatchId(batchId)}
              />
              {currentBatchId && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">バッチジョブ一覧</h3>
                  <JobList batchId={currentBatchId} />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>


    </div>
  );
}
