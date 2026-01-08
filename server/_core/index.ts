import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Start video generation worker
  const { startWorker } = await import("../videoGenerationWorker");
  startWorker().catch(console.error);

  // Start SEO article generation worker
  const { startSeoWorker } = await import("../seoWorker");
  startSeoWorker().catch(console.error);
  
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Health check endpoint for connection diagnostics (Viteの前に配置)
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      port: process.env.PORT || "3000",
    });
  });
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Serve uploads directory as static files (for local development)
  const { shouldUseLocalService } = await import("./env");
  if (shouldUseLocalService("storage")) {
    const uploadsPath = path.join(process.cwd(), "uploads");
    app.use("/uploads", express.static(uploadsPath));
    console.log(`[Server] Serving uploads from: ${uploadsPath}`);
  }
  
  // Long content download endpoint
  app.get("/api/longContent/download/:contentId", async (req, res) => {
    try {
      const { generateDocx } = await import("../docxGenerator");
      const { getLongContentById } = await import("../db");
      const contentId = parseInt(req.params.contentId);
      const format = req.query.format as string;
      
      const content = await getLongContentById(contentId);
      if (!content || !content.content) {
        res.status(404).send("Content not found");
        return;
      }
      
      if (format === "docx") {
        const buffer = await generateDocx(content.title, content.content);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(content.title)}.docx"`);
        res.send(buffer);
      } else {
        res.status(400).send("Invalid format");
      }
    } catch (error) {
      console.error("[Download] Error:", error);
      res.status(500).send("Internal server error");
    }
  });
  
  // tRPC API endpoint
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // development mode uses Vite, production mode uses static files
  // Viteのセットアップはサーバー起動後に実行（非ブロッキング）
  if (process.env.NODE_ENV === "development") {
    // サーバーを先に起動してからViteをセットアップ
    // IPv4で明示的にリッスン（IPv6の問題を回避）
    server.listen(port, "127.0.0.1", async () => {
      console.log(`Server running on http://127.0.0.1:${port}/`);
      console.log(`Server running on http://localhost:${port}/`);
      console.log("[Vite] Setting up Vite middleware...");
      try {
        await setupVite(app, server);
        console.log("[Vite] Vite middleware setup complete");
      } catch (error) {
        console.error("[Vite] Failed to setup Vite:", error);
      }
    });
  } else {
    serveStatic(app);
    server.listen(port, "127.0.0.1", () => {
      console.log(`Server running on http://127.0.0.1:${port}/`);
      console.log(`Server running on http://localhost:${port}/`);
    });
  }
}

// グローバルエラーハンドリングを追加してサーバーの安定性を向上
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  // サーバーを即座に終了させず、ログを記録して続行
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  // サーバーを即座に終了させず、ログを記録して続行
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  process.exit(0);
});

startServer().catch((error) => {
  console.error('[Server] Failed to start server:', error);
  process.exit(1);
});
