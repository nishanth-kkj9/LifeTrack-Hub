import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/apiRouter.ts';

dotenv.config();

// Process-level safety nets to prevent server crashes from unhandled errors
process.on('unhandledRejection', (reason) => {
  console.warn('[Server Warning: Unhandled Rejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Server Error: Uncaught Exception]', error);
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set trusted proxy hop for secure IP resolution
  app.set('trust proxy', 1);

  // Security headers & basic parsing
  app.use(express.json({ limit: '2mb' }));

  // API routes FIRST
  app.use('/api', apiRouter);

  // Global error handling middleware for API routes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Express Global Error Handler]', err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        error: 'An unexpected internal server error occurred',
        message: err?.message || 'Server error',
      });
    }
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
