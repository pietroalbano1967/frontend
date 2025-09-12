// src/server.ts
import 'zone.js/node';
import express from 'express';
import { join } from 'node:path';
import { CommonEngine } from '@angular/ssr/node';
import bootstrap from './main.server';

const app = express();
const distFolder = join(process.cwd(), 'dist/frontend/browser');
const indexHtmlPath = join(distFolder, 'index.html');

// Configura CommonEngine con la nuova API
const engine = new CommonEngine();

// Middleware per servire file statici
app.use(express.static(distFolder, {
  maxAge: '1y',
  index: false,
  fallthrough: true,
}));

// Middleware per logging
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Gestione route principale SSR - FIXED per Express 5
// Usa una route specifica invece del wildcard '*'
app.get('/', async (req, res, next) => {
  await handleSsrRequest(req, res, next);
});

// Gestione di tutte le altre route
app.get('/*', async (req, res, next) => {
  await handleSsrRequest(req, res, next);
});

// Funzione per gestire le richieste SSR
async function handleSsrRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  const startTime = Date.now();
  const url = req.originalUrl;

  console.log(`📦 Rendering SSR per: ${url}`);

  try {
    const html = await engine.render({
      bootstrap,
      documentFilePath: indexHtmlPath,
      url,
      publicPath: distFolder,
      providers: [
        { provide: 'REQUEST', useValue: req },
        { provide: 'RESPONSE', useValue: res },
        { provide: 'APP_BASE_URL', useValue: `${req.protocol}://${req.get('host')}` }
      ]
    });

    const renderTime = Date.now() - startTime;
    console.log(`✅ SSR completato in ${renderTime}ms per: ${url}`);

    res.set('Cache-Control', 'no-cache');
    res.set('X-SSR-Render-Time', `${renderTime}ms`);
    res.send(html);

  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`❌ SSR Error dopo ${errorTime}ms per ${url}:`, error);

    try {
      // Fallback al client-side rendering
      const fs = await import('node:fs/promises');
      const indexHtml = await fs.readFile(indexHtmlPath, 'utf-8');
      console.log('🔄 Fallback a client-side rendering');
      
      res.set('Cache-Control', 'no-cache');
      res.set('X-SSR-Fallback', 'true');
      res.send(indexHtml);

    } catch (fallbackError) {
      console.error('❌ Fallback failed:', fallbackError);
      
      res.status(500).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Server Error - Trading Platform</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              padding: 40px; 
              text-align: center; 
              background: #f8f9fa;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              borderRadius: 12px;
              boxShadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            h1 { 
              color: #dc3545; 
              marginBottom: 20px;
            }
            p { 
              color: #6c757d; 
              lineHeight: 1.6;
            }
            .code {
              background: #f8f9fa;
              padding: 15px;
              borderRadius: 6px;
              margin: 20px 0;
              fontFamily: monospace;
              textAlign: left;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚧 Server Temporarily Unavailable</h1>
            <p>We're experiencing some technical difficulties. Please try again in a few moments.</p>
            <div class="code">
              Error: ${error instanceof Error ? error.message : 'Unknown error'}
            </div>
            <p>If the problem persists, contact support.</p>
          </div>
        </body>
        </html>
      `);
    }
  }
}

// Gestione errori globale
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('🔥 Error globale:', error);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env['NODE_ENV'] === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Gestione 404 per API routes
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({ 
      error: 'Not Found',
      path: req.originalUrl 
    });
  } else {
    // Per route non-API, lascia che Angular gestisca il routing lato client
    res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Page Not Found</title>
        <meta http-equiv="refresh" content="0;url=/" />
      </head>
      <body>
        <script>
          window.location.href = '/';
        </script>
      </body>
      </html>
    `);
  }
});

const port = Number(process.env['PORT'] || 4200);
const host = process.env['HOST'] || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`✅ SSR Server avviato`);
  console.log(`📍 Local: http://localhost:${port}`);
  console.log(`📍 Network: http://${host}:${port}`);
  console.log(`📁 Static files: ${distFolder}`);
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));