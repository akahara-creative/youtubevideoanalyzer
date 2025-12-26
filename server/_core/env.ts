export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

/**
 * ローカルサービスを使用すべきかどうかを判定する
 * 
 * @param serviceName - サービス名 ('storage' | 'whisper' | 'ollama')
 * @returns ローカルサービスを使用すべき場合はtrue
 */
export function shouldUseLocalService(
  serviceName: "storage" | "whisper" | "ollama"
): boolean {
  // 環境変数で明示的に指定されている場合はそれに従う
  const envKey = `USE_LOCAL_${serviceName.toUpperCase()}`;
  const envValue = process.env[envKey];
  
  if (envValue === "true") {
    return true;
  }
  
  // 開発環境で、Forge APIが設定されていない場合はローカルを使用
  if (process.env.NODE_ENV === "development") {
    return !ENV.forgeApiUrl || !ENV.forgeApiKey;
  }
  
  return false;
}
