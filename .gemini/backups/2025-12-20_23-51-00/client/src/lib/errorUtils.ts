/**
 * 接続エラーかどうかを判定する
 * @param error - エラーオブジェクト
 * @returns 接続エラーの場合true
 */
export function isConnectionError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === 'object' && error !== null) {
    const err = error as any;
    const message = err.message || err.data?.message || err.shape?.message || '';
    const errorMessage = String(message).toLowerCase();

    // 接続関連のエラーメッセージを検出
    return (
      errorMessage.includes('connection') ||
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('networkerror') ||
      errorMessage.includes('network request failed') ||
      errorMessage.includes('aborted') ||
      errorMessage.includes('timeout') ||
      err.data?.code === 'TIMEOUT' ||
      err.data?.code === 'INTERNAL_SERVER_ERROR'
    );
  }

  if (typeof error === 'string') {
    const errorMessage = error.toLowerCase();
    return (
      errorMessage.includes('connection') ||
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('failed to fetch')
    );
  }

  return false;
}

/**
 * tRPCエラーオブジェクトから安全にエラーメッセージを取得する
 * @param error - tRPCエラーオブジェクト
 * @returns エラーメッセージ文字列
 */
export function getErrorMessage(error: unknown): string {
  if (!error) {
    return 'エラーが発生しました';
  }

  // 接続エラーの場合は日本語メッセージを返す
  if (isConnectionError(error)) {
    return '接続に失敗しました。インターネット接続またはVPN設定を確認してください。';
  }

  // tRPCエラーの場合
  if (typeof error === 'object' && error !== null) {
    const err = error as any;
    
    // error.message が存在する場合
    if (typeof err.message === 'string' && err.message) {
      // 英語の接続エラーメッセージを日本語に変換
      const message = err.message;
      if (message.toLowerCase().includes('connection failed')) {
        return '接続に失敗しました。インターネット接続またはVPN設定を確認してください。';
      }
      if (message.toLowerCase().includes('check your internet connection')) {
        return '接続に失敗しました。インターネット接続またはVPN設定を確認してください。';
      }
      return message;
    }
    
    // error.data?.message が存在する場合
    if (err.data && typeof err.data.message === 'string' && err.data.message) {
      return err.data.message;
    }
    
    // error.shape?.message が存在する場合
    if (err.shape && typeof err.shape.message === 'string' && err.shape.message) {
      return err.shape.message;
    }
  }

  // 文字列の場合
  if (typeof error === 'string') {
    const message = error;
    if (message.toLowerCase().includes('connection failed')) {
      return '接続に失敗しました。インターネット接続またはVPN設定を確認してください。';
    }
    if (message.toLowerCase().includes('check your internet connection')) {
      return '接続に失敗しました。インターネット接続またはVPN設定を確認してください。';
    }
    return message;
  }

  // その他の場合
  return 'エラーが発生しました';
}
