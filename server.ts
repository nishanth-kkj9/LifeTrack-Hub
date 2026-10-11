import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/apiRouter.ts';

dotenv.config();

// Process-level safety nets.
// unhandledRejection: log and keep serving (request-scoped promise failures).
process.on('unhandledRejection', (reason) => {
  console.warn('[Server Warning: Unhandled Rejection]', reason);
});

// uncaughtException: the process is in an undefined state. Log, then exit
// non-zero so the supervisor (systemd / Docker / Render / Cloud Run) restarts cleanly.
process.on('uncaughtException', (error) => {
  console.error('[Server Fatal: Uncaught Exception] Shutting down.', error);
  process.exit(1);
});

async function startServer() {
  const app = express();
  // Respect platform-injected PORT (Render, Railway, Cloud Run, Heroku); default 3000.
  const PORT = Number(process.env.PORT) || 3000;

  // Set trusted proxy hop for secure IP resolution
  app.set('trust proxy', 1);

  // NOTE: JSON body parsing is registered once, inside apiRouter (scoped to /api).
  // Registering express.json() here too would parse every request body twice.

  // API routes FIRST
  app.use('/api', apiRouter);

  // Lightweight health endpoint for uptime probes / load balancers
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback (Express 4 wildcard) — but never for /api paths:
    // unknown API routes must fall through to the JSON 404 handler below.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 404 handler for unknown API paths (must come AFTER all routes/middleware)
  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  // Global error handling middleware — MUST be registered LAST so it can also
  // catch errors thrown by the Vite/static/404 layers above.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Express Global Error Handler]', err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        error: 'An unexpected internal server error occurred',
        message: process.env.NODE_ENV === 'production' ? undefined : err?.message,
      });
    }
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown: stop accepting connections, let in-flight requests drain.
  const shutdown = (signal: string) => {
    console.log(`[Server] ${signal} received — closing HTTP server gracefully.`);
    server.close(() => process.exit(0));
    // Hard-kill fallback if connections refuse to drain
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
