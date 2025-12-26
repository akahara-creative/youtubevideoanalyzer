/**
 * サーバーへの接続状態を確認するユーティリティ
 */

export interface ConnectionStatus {
  connected: boolean;
  error?: string;
  serverInfo?: {
    status: string;
    timestamp: string;
    environment: string;
    port: string;
  };
}

/**
 * サーバーのヘルスチェックを実行
 * @param timeout タイムアウト時間（ミリ秒）
 * @returns 接続状態
 */
export async function checkServerConnection(timeout: number = 5000): Promise<ConnectionStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch("/api/health", {
      method: "GET",
      credentials: "include",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return {
        connected: true,
        serverInfo: {
          status: data.status,
          timestamp: data.timestamp,
          environment: data.environment,
          port: data.port,
        },
      };
    } else {
      return {
        connected: false,
        error: `サーバーがエラーを返しました: ${response.status} ${response.statusText}`,
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // より詳細なエラーメッセージを提供
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      return {
        connected: false,
        error: 'サーバーに接続できません。開発サーバー（pnpm dev）が起動しているか確認してください。',
      };
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
      return {
        connected: false,
        error: 'サーバーへの接続がタイムアウトしました。サーバーが応答していない可能性があります。',
      };
    }
    
    return {
      connected: false,
      error: errorMessage,
    };
  }
}

/**
 * 接続エラーの診断情報を取得
 * @returns 診断情報の文字列
 */
export function getConnectionDiagnostics(): string {
  const diagnostics: string[] = [];
  
  // 現在のURL情報
  diagnostics.push(`現在のURL: ${window.location.href}`);
  diagnostics.push(`プロトコル: ${window.location.protocol}`);
  diagnostics.push(`ホスト: ${window.location.host}`);
  
  // 開発環境かどうか
  const isDev = process.env.NODE_ENV === "development";
  diagnostics.push(`環境: ${isDev ? "開発" : "本番"}`);
  
  // 推奨されるアクション
  if (isDev) {
    diagnostics.push("\n【推奨される対処法】");
    diagnostics.push("1. ターミナルで 'pnpm dev' が実行されているか確認");
    diagnostics.push("2. サーバーが正常に起動しているか確認（ポート3000など）");
    diagnostics.push("3. ブラウザのコンソールでエラーメッセージを確認");
    diagnostics.push("4. ファイアウォールやVPNが接続をブロックしていないか確認");
  }
  
  return diagnostics.join("\n");
}


