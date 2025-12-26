import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { ArrowLeft, Lightbulb, Loader2, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function StrategyBrainstorm() {
  const { user, loading: authLoading } = useAuth();
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);

  const brainstormMutation = trpc.strategy.brainstorm.useMutation({
    onSuccess: (data) => {
      setConversation((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
      setMessage("");
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;

    setConversation((prev) => [...prev, { role: "user", content: message }]);
    brainstormMutation.mutate({ message, conversationHistory: conversation });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
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
              <Sparkles className="w-8 h-8" />
              戦略紐解きエンジン
            </h2>
            <p className="text-muted-foreground">
              RAGに蓄積された戦略を活用して、事業展開やツール開発のアイデアをAIと壁打ちできます
            </p>
          </div>

          {/* Conversation Area */}
          <Card className="mb-4 bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                アイデア壁打ち
              </CardTitle>
              <CardDescription>
                「どんな事業展開ができるか？」「どんなツールを作れば実現できるか？」など、自由に相談してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-4 max-h-[500px] overflow-y-auto">
                {conversation.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="mb-4">まだ会話がありません</p>
                    <div className="text-sm space-y-2">
                      <p>💡 例: 「蓄積された戦略から、どんな新しいビジネスが考えられますか？」</p>
                      <p>🛠️ 例: 「動画生成を自動化するツールのアイデアを教えてください」</p>
                      <p>📈 例: 「SEO記事と動画を組み合わせた戦略を提案してください」</p>
                    </div>
                  </div>
                ) : (
                  conversation.map((msg, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground ml-12"
                          : "bg-muted text-muted-foreground mr-12"
                      }`}
                    >
                      <div className="font-semibold mb-2">
                        {msg.role === "user" ? "あなた" : "AI"}
                      </div>
                      {msg.role === "assistant" ? (
                        <Streamdown>{msg.content}</Streamdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  ))
                )}
                {brainstormMutation.isPending && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AIが考えています...</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="メッセージを入力してください（Ctrl+Enterで送信）"
                  className="min-h-[100px] bg-background text-foreground"
                  disabled={brainstormMutation.isPending}
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Ctrl+Enter で送信
                  </span>
                  <Button
                    onClick={handleSend}
                    disabled={!message.trim() || brainstormMutation.isPending}
                  >
                    {brainstormMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        送信中...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        送信
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="bg-muted">
            <CardHeader>
              <CardTitle className="text-base">💡 使い方のヒント</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• AIはRAGに蓄積された戦略（動画分析、SEO記事、メルマガなど）を参照して回答します</p>
              <p>• 具体的な質問をすると、より実践的なアイデアが得られます</p>
              <p>• 「どんなツールを作れば実現できるか？」と聞くと、技術的な提案も受けられます</p>
              <p>• 会話履歴は自動的に保存されます（将来的に実装予定）</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
