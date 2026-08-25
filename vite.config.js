import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'export-video',
      configureServer(server) {
        server.middlewares.use('/export-video', (req, res, next) => {
          if (req.method !== 'POST') return next();
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => {
            try {
              const buf = Buffer.concat(chunks);
              const dir = 'C:\\Users\\uSer\\Videos';
              fs.mkdirSync(dir, { recursive: true });
              const name = `video-final-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
              fs.writeFileSync(path.join(dir, name), buf);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, name }));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          });
          req.on('error', () => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'request error' }));
          });
        });
        server.middlewares.use('/abrir-carpeta', (req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'POST') return next();
          exec('explorer "C:\\Users\\uSer\\Videos"', () => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          });
        });
      }
    }
  ],
  server: {
    port: 5173,
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0
      }
    }
  }
});
