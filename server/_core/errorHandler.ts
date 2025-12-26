/**
 * エラーハンドリングの統一ユーティリティ
 * 
 * バックグラウンドジョブや非同期処理のエラーを適切に処理するためのヘルパー関数
 */

export interface ErrorContext {
  context: string;
  jobId?: number;
  userId?: number;
  additionalInfo?: Record<string, unknown>;
}

/**
 * バックグラウンドジョブのエラーを適切に処理する
 * 
 * @param promise - 処理するPromise
 * @param context - エラーのコンテキスト（例: "SEO Job 123"）
 * @returns Promiseの結果、またはエラー時はnull
 */
export async function handleBackgroundError<T>(
  promise: Promise<T>,
  context: string | ErrorContext
): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    const ctx = typeof context === "string" ? { context } : context;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // 詳細なエラーログを出力
    console.error(`[${ctx.context}] Error occurred:`, errorMessage);
    if (errorStack) {
      console.error(`[${ctx.context}] Stack trace:`, errorStack);
    }
    if (ctx.jobId) {
      console.error(`[${ctx.context}] Job ID:`, ctx.jobId);
    }
    if (ctx.additionalInfo) {
      console.error(`[${ctx.context}] Additional info:`, ctx.additionalInfo);
    }
    
    // エラーオブジェクトの詳細情報も出力
    if (error instanceof Error) {
      if ((error as any).code) {
        console.error(`[${ctx.context}] Error code:`, (error as any).code);
      }
      if ((error as any).status) {
        console.error(`[${ctx.context}] HTTP status:`, (error as any).status);
      }
    }
    
    return null;
  }
}

/**
 * エラーを適切な形式で文字列化する
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * エラーの詳細情報を取得する
 */
export function getErrorDetails(error: unknown): {
  message: string;
  stack?: string;
  code?: string;
  status?: number;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      status: (error as any).status,
    };
  }
  return {
    message: String(error),
  };
}

