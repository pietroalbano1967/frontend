// src/server.ts
import 'zone.js/node';
import express from 'express';
import { join } from 'node:path';
import { CommonEngine } from '@angular/ssr/node';
import bootstrap from './main.server';

const app = express();
const engine = new CommonEngine();
const distFolder = join(process.cwd(), 'dist/frontend/browser');

app.use(express.static(distFolder, {
  maxAge: '1y',
  index: false,
}));

// ✅ Wildcard compatibile con Express 5 / path-to-regexp v8
app.get(/.*/, async (req, res, next) => {
  try {
    const html = await engine.render({
      bootstrap,
      documentFilePath: join(distFolder, 'index.html'),
      url: req.originalUrl,
    });
    res.send(html);
  } catch (err) {
    next(err);
  }
});

const port = Number(process.env['PORT'] || 4000);
app.listen(port, () => {
  console.log(`✅ SSR server listening on http://localhost:${port}`);
});
