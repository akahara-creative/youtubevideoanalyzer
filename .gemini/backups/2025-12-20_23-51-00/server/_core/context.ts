import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// マスターユーザーのキャッシュ（パフォーマンス向上）
let masterUserCache: User | null = null;
let masterUserCacheTime = 0;
const MASTER_USER_CACHE_TTL = 60000; // 1分間キャッシュ

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // 開発環境で認証をバイパス（マスターユーザーとして常時ログイン）
  const isDevelopment = process.env.NODE_ENV === "development";
  const enableAuthBypass = process.env.ENABLE_AUTH_BYPASS === "true" || isDevelopment;

  if (enableAuthBypass) {
    // キャッシュをチェック
    const now = Date.now();
    if (masterUserCache && (now - masterUserCacheTime) < MASTER_USER_CACHE_TTL) {
      user = masterUserCache;
    } else {
      // マスターユーザーを作成または取得（タイムアウト付き）
      const { getUserByOpenId, upsertUser } = await import("../db");
      const masterOpenId = process.env.MASTER_OPEN_ID || "master-user";
      const masterName = process.env.MASTER_NAME || "Master User";
      
      try {
        // タイムアウト付きでデータベースアクセス
        const dbPromise = getUserByOpenId(masterOpenId);
        const timeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => resolve(null), 2000)
        );
        
        user = await Promise.race([dbPromise, timeoutPromise]);
        
        if (!user) {
          // マスターユーザーが存在しない場合は作成
          try {
            await upsertUser({
              openId: masterOpenId,
              name: masterName,
              email: process.env.MASTER_EMAIL || null,
              loginMethod: "local-dev",
              lastSignedIn: new Date(),
            });
            user = await getUserByOpenId(masterOpenId);
          } catch (createError) {
            console.warn("[Auth Bypass] Failed to create master user:", createError);
            // データベースエラーの場合はダミーユーザーを使用
            user = {
              id: 0,
              openId: masterOpenId,
              name: masterName,
              email: process.env.MASTER_EMAIL || null,
              loginMethod: "local-dev",
              lastSignedIn: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            } as User;
          }
        }
        
        // キャッシュを更新
        if (user) {
          masterUserCache = user;
          masterUserCacheTime = now;
        }
      } catch (error) {
        console.warn("[Auth Bypass] Failed to get master user:", error);
        // データベース接続エラーの場合はダミーユーザーを使用
        user = {
          id: 0,
          openId: masterOpenId,
          name: masterName,
          email: process.env.MASTER_EMAIL || null,
          loginMethod: "local-dev",
          lastSignedIn: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as User;
      }
    }
  } else {
    // 本番環境では通常の認証フロー
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
