export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "App";

export const APP_LOGO = "https://placehold.co/128x128/E1E7EF/1F2937?text=App";

/**
 * OAuth設定が有効かどうかをチェック
 */
export const isOAuthConfigured = (): boolean => {
  return !!(
    import.meta.env.VITE_OAUTH_PORTAL_URL && 
    import.meta.env.VITE_APP_ID
  );
};

/**
 * 安全にログインURLを取得（エラーをスローしない）
 */
export const getLoginUrlSafe = (): string => {
  try {
    return getLoginUrl();
  } catch (error) {
    console.error("[getLoginUrlSafe] Error:", error);
    return "#oauth-config-error";
  }
};

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = (): string => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  
  // 環境変数が設定されていない場合のエラーハンドリング
  if (!oauthPortalUrl) {
    // 開発環境では認証バイパスが有効な可能性があるため、エラーをスローせずに警告のみ表示
    if (import.meta.env.DEV) {
      // 開発環境では警告のみ（認証バイパスが有効な場合は問題ない）
      console.warn(
        "[OAuth Config] VITE_OAUTH_PORTAL_URL が設定されていません。\n" +
        "認証バイパス（ENABLE_AUTH_BYPASS=true）が有効な場合は問題ありません。\n" +
        "OAuthを使用する場合は、.env ファイルに以下を追加してください：\n" +
        "VITE_OAUTH_PORTAL_URL=https://portal.manus.im\n" +
        "VITE_APP_ID=your-app-id"
      );
      // フォールバックURLを返す（実際には使用されない）
      return "/login-error";
    }
    
    // 本番環境では適切なエラーページにリダイレクト
    return "/error?message=" + encodeURIComponent("OAuth設定が不足しています");
  }
  
  if (!appId) {
    // 開発環境では認証バイパスが有効な可能性があるため、エラーをスローせずに警告のみ表示
    if (import.meta.env.DEV) {
      // 開発環境では警告のみ（認証バイパスが有効な場合は問題ない）
      console.warn(
        "[OAuth Config] VITE_APP_ID が設定されていません。\n" +
        "認証バイパス（ENABLE_AUTH_BYPASS=true）が有効な場合は問題ありません。\n" +
        "OAuthを使用する場合は、.env ファイルに以下を追加してください：\n" +
        "VITE_APP_ID=your-app-id"
      );
      // フォールバックURLを返す（実際には使用されない）
      return "/login-error";
    }
    
    return "/error?message=" + encodeURIComponent("OAuth設定が不足しています");
  }
  
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  try {
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch (error) {
    const errorMessage = 
      `OAuth URLの構築に失敗しました: ${error instanceof Error ? error.message : String(error)}\n\n` +
      `VITE_OAUTH_PORTAL_URL: ${oauthPortalUrl}\n` +
      `VITE_APP_ID: ${appId}`;
    
    console.error("[OAuth URL Error]", errorMessage);
    
    if (import.meta.env.DEV) {
      throw new Error(errorMessage);
    }
    
    return "/error?message=" + encodeURIComponent("OAuth URLの構築に失敗しました");
  }
};
