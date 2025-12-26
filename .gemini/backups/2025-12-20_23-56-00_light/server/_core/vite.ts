import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  console.log("[Vite] Creating Vite server...");
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });
  console.log("[Vite] Vite server created");

  // HTMLページリクエストを先に処理（Viteのミドルウェアの前に配置）
  app.get("*", async (req, res, next) => {
    // /api/* パスは除外（APIエンドポイントは別途処理）
    if (req.originalUrl.startsWith("/api/")) {
      return next();
    }
    
    // 静的ファイルのリクエスト（拡張子がある）はViteのミドルウェアに渡す
    if (req.originalUrl.match(/\.(js|css|ts|tsx|json|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/)) {
      return next();
    }
    
    // Viteの特殊パス（/@vite/client, /@react-refresh など）もViteのミドルウェアに渡す
    if (req.originalUrl.startsWith("/@")) {
      return next();
    }
    
    // /src/で始まるパス（ソースファイル）はViteのミドルウェアに渡す
    if (req.originalUrl.startsWith("/src/")) {
      return next();
    }
    
    // /node_modules/で始まるパスもViteのミドルウェアに渡す
    if (req.originalUrl.startsWith("/node_modules/")) {
      return next();
    }
    
    // HTMLページリクエストのみを処理
    const url = req.originalUrl;
    console.log(`[Vite] Handling HTML request: ${url}`);

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      console.log(`[Vite] Sending HTML for: ${url}`);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      console.error(`[Vite] Error handling ${url}:`, e);
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  // APIエンドポイントを除外してからViteのミドルウェアを適用
  // Viteのミドルウェアは静的ファイル（JS、CSSなど）とHMRリクエストを処理
  app.use((req, res, next) => {
    // /api/* パスはViteのミドルウェアを通さない
    if (req.originalUrl.startsWith("/api/")) {
      return next();
    }
    // Viteのミドルウェアを適用（静的ファイルやHMRリクエストを処理）
    vite.middlewares(req, res, next);
  });
  
  console.log("[Vite] Vite middleware registered");
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
