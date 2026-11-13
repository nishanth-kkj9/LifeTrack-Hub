import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import helmet from 'helmet';

dotenv.config();

// Process-level safety nets.
process.on('unhandledRejection', (reason) => {
  console.error('[Server Fatal: Unhandled Rejection] Shutting down.', reason);
  process.exit(1);
});

// uncaughtException: the process is in an undefined state. Log, then exit
// non-zero so the supervisor (systemd / Docker / Render / Cloud Run) restarts cleanly.
process.on('uncaughtException', (error) => {
  console.error('[Server Fatal: Uncaught Exception] Shutting down.', error);
  process.exit(1);
});

export async function createAppServer(options?: { port?: number; host?: string }) {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  // Respect platform-injected PORT (Render, Railway, Cloud Run, Heroku); default 3000.
  const PORT = options?.port ?? (Number(process.env.PORT) || 3000);
  const HOST = options?.host ?? '0.0.0.0';

  // Set trusted proxy hop for secure IP resolution
  app.set('trust proxy', 1);

  // Security Headers (Helmet)
  app.use(
    helmet({
      frameguard: isProd ? { action: 'sameorigin' } : false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isProd
            ? [
                "'self'",
                'https://apis.google.com',
                'https://www.gstatic.com',
                'https://*.firebaseapp.com',
              ]
            : [
                "'self'",
                "'unsafe-inline'",
                'https://apis.google.com',
                'https://www.gstatic.com',
                'https://*.firebaseapp.com',
              ],
          connectSrc: [
            "'self'",
            ...(isProd ? [] : ['ws:', 'wss:']),
            'https://*.googleapis.com',
            'https://*.firebaseio.com',
            'https://*.cloudfunctions.net',
            'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com',
            'https://firestore.googleapis.com',
          ],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://*.googleusercontent.com',
            'https://*.gstatic.com',
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://accounts.google.com'],
          frameAncestors: isProd ? ["'self'"] : ['*'],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // Optional CORS for API routes only, driven by comma-separated CORS_ORIGINS env var.
  // Same-origin static assets and index.html are never blocked. Denied origins simply omit CORS headers.
  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (corsOrigins.length > 0) {
    app.use('/api', (req, res, next) => {
      const origin = req.headers.origin;
      if (origin && corsOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
        if (req.method === 'OPTIONS') {
          res.status(204).end();
          return;
        }
      }
      next();
    });
  }

  // Lightweight health endpoint for uptime probes / load balancers
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });

  // Vite middleware for development (dynamically imported so production omit-dev works cleanly)
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // Since HMR & WebSockets are disabled in the preview iframe, prevent @vite/client
    // from calling new WebSocket(...) while preserving CSS/style & module helpers.
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result) return next();
        const patchedCode = result.code.replace(
          'transport.connect(createHMRHandler(handleMessage));',
          '// HMR disabled: WebSocket transport.connect skipped cleanly'
        );
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(patchedCode);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback (Express 4 wildcard) — never for /api paths:
    // unknown API routes fall through to the JSON 404 handler below.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 404 handler for unknown API paths (must come AFTER all routes/middleware)
  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  // Global error handling middleware — registered LAST
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Express Global Error Handler]', err);
    if (!res.headersSent) {
      const status = typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
      const message = err instanceof Error ? err.message : String(err);
      res.status(status).json({
        error: 'An unexpected internal server error occurred',
        message: isProd ? undefined : message,
      });
    }
  });

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const srv = app.listen(PORT, HOST, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      resolve(srv);
    });
    srv.once('error', reject);
  });

  return server;
}

// Only auto-start when invoked directly (not when imported in tests)
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.cjs'));

if (isDirectRun) {
  createAppServer().then((server) => {
    const shutdown = (signal: string) => {
      console.log(`[Server] ${signal} received — closing HTTP server gracefully.`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
}
