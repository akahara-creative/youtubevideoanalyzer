import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

// グローバルエラーハンドリングミドルウェア
const errorHandlingMiddleware = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // TRPCErrorはそのままスロー
    if (error instanceof TRPCError) {
      throw error;
    }
    
    // 通常のErrorをTRPCErrorに変換
    if (error instanceof Error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
        cause: error,
      });
    }
    
    // その他のエラー
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      cause: error,
    });
  }
});

export const publicProcedure = t.procedure.use(errorHandlingMiddleware);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(errorHandlingMiddleware).use(requireUser);

export const adminProcedure = t.procedure.use(errorHandlingMiddleware).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
