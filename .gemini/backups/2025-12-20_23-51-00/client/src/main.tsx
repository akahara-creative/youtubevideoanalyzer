import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrlSafe } from "./const";
import { isConnectionError, getErrorMessage } from "./lib/errorUtils";
import { checkServerConnection, getConnectionDiagnostics } from "./lib/connectionUtils";
import { toast } from "sonner";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // 接続エラーの場合は最大3回までリトライ
        if (isConnectionError(error)) {
          return failureCount < 3;
        }
        // 認証エラーの場合はリトライしない
        if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) {
          return false;
        }
        // その他のエラーは1回までリトライ
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: (failureCount, error) => {
        // 接続エラーの場合のみリトライ
        if (isConnectionError(error)) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrlSafe();
};

// 最後に通知したエラーのタイムスタンプを記録（重複通知を防ぐ）
let lastErrorNotificationTime = 0;
const ERROR_NOTIFICATION_COOLDOWN = 3000; // 3秒間は同じエラーを通知しない

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    
    // 接続エラーの場合はユーザーに通知（認証エラー以外）
    if (error instanceof TRPCClientError && error.message !== UNAUTHED_ERR_MSG) {
      if (isConnectionError(error)) {
        // 重複通知を防ぐ（最後の通知から3秒以内は通知しない）
        const now = Date.now();
        if (now - lastErrorNotificationTime > ERROR_NOTIFICATION_COOLDOWN) {
          lastErrorNotificationTime = now;
          
          // 開発環境では診断情報も提供
          const isDev = process.env.NODE_ENV === "development";
          const diagnostics = isDev ? getConnectionDiagnostics() : undefined;
          
          toast.error(getErrorMessage(error), {
            duration: 8000,
            description: isDev ? "開発サーバーが起動しているか確認してください" : undefined,
            action: diagnostics ? {
              label: "診断情報をコピー",
              onClick: () => {
                navigator.clipboard.writeText(diagnostics);
                toast.success("診断情報をコピーしました");
              },
            } : undefined,
          });
          
          // 開発環境では詳細なログを出力
          if (isDev) {
            console.error("[Connection Error Details]", {
              error,
              diagnostics,
              queryKey: event.query.queryKey,
            });
          }
        }
      }
    }
    
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    
    // 接続エラーの場合はユーザーに通知（認証エラー以外）
    if (error instanceof TRPCClientError && error.message !== UNAUTHED_ERR_MSG) {
      if (isConnectionError(error)) {
        // 重複通知を防ぐ（最後の通知から3秒以内は通知しない）
        const now = Date.now();
        if (now - lastErrorNotificationTime > ERROR_NOTIFICATION_COOLDOWN) {
          lastErrorNotificationTime = now;
          
          // 開発環境では診断情報も提供
          const isDev = process.env.NODE_ENV === "development";
          const diagnostics = isDev ? getConnectionDiagnostics() : undefined;
          
          toast.error(getErrorMessage(error), {
            duration: 8000,
            description: isDev ? "開発サーバーが起動しているか確認してください" : undefined,
            action: diagnostics ? {
              label: "診断情報をコピー",
              onClick: () => {
                navigator.clipboard.writeText(diagnostics);
                toast.success("診断情報をコピーしました");
              },
            } : undefined,
          });
          
          // 開発環境では詳細なログを出力
          if (isDev) {
            console.error("[Connection Error Details]", {
              error,
              diagnostics,
              mutationKey: event.mutation.options.mutationKey,
            });
          }
        }
      }
    }
    
    console.error("[API Mutation Error]", error);
  }
});

// アプリ起動時に接続状態を確認（開発環境のみ）
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  checkServerConnection().then((status) => {
    if (!status.connected) {
      console.warn("[Connection Warning]", status.error);
      console.log("[Connection Diagnostics]", getConnectionDiagnostics());
      // 開発環境でのみ警告を表示
      toast.warning("開発サーバーへの接続を確認できませんでした。", {
        description: status.error,
        duration: 10000,
        action: {
          label: "診断情報をコピー",
          onClick: () => {
            navigator.clipboard.writeText(getConnectionDiagnostics());
            toast.success("診断情報をコピーしました");
          },
        },
      });
    } else {
      console.log("[Connection Check] Server is healthy:", status.serverInfo);
    }
  });
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        // Create AbortController with 10-minute timeout for long-running operations
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes
        
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          signal: controller.signal,
        }).catch((error) => {
          // ネットワークエラーやタイムアウトエラーを適切に処理
          if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            // 開発環境ではより詳細な情報を提供
            const isDev = process.env.NODE_ENV === "development";
            const devHint = isDev ? "開発サーバーが起動しているか確認してください。" : "";
            throw new Error(`接続がタイムアウトしました。${devHint}しばらく待ってから再度お試しください。`);
          }
          if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            const isDev = process.env.NODE_ENV === "development";
            const devHint = isDev ? "開発サーバーが起動しているか確認してください。" : "";
            throw new Error(`接続に失敗しました。${devHint}インターネット接続またはVPN設定を確認してください。`);
          }
          throw error;
        }).finally(() => clearTimeout(timeoutId));
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
