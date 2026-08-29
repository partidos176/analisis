import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { exec, spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const coreMain = require.resolve('@ffmpeg/core');
const pkgRoot = path.resolve(path.dirname(coreMain), '..', '..');
const coreDir = path.join(pkgRoot, 'dist', 'esm');

const copyFfmpegCore = (outDir) => {
  const out = path.join(outDir, 'ffmpeg');
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(path.join(coreDir, 'ffmpeg-core.js'), path.join(out, 'ffmpeg-core.js'));
  fs.copyFileSync(path.join(coreDir, 'ffmpeg-core.wasm'), path.join(out, 'ffmpeg-core.wasm'));
};

export default defineConfig({
  plugins: [
    {
      name: 'auto-start-cortes-server',
      apply: 'serve',
      configureServer() {
        try {
          const child = spawn('node', ['server.js'], { cwd: process.cwd(), windowsHide: true });
          const tag = (d) => String(d).split('\n').filter(Boolean).map((l) => '[cortes-server] ' + l + '\n').join('');
          if (child.stdout) child.stdout.on('data', (d) => process.stdout.write(tag(d)));
          if (child.stderr) child.stderr.on('data', (d) => process.stderr.write(tag(d)));
          const kill = () => { try { child.kill(); } catch (_) {} };
          process.on('exit', kill);
          process.on('SIGINT', kill);
          process.on('SIGTERM', kill);
        } catch (e) {
          console.warn('[cortes-server] no se pudo auto-arrancar:', e.message);
        }
      }
    },
    react(),
    {
      name: 'export-video',
      configureServer(server) {
        server.middlewares.use('/ffmpeg', (req, res, next) => {
          const file = path.join(coreDir, path.basename(req.url.split('?')[0]));
          if (fs.existsSync(file)) {
            const ext = path.extname(file);
            res.setHeader('Content-Type', ext === '.wasm' ? 'application/wasm' : 'text/javascript');
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            fs.createReadStream(file).pipe(res);
          } else {
            next();
          }
        });
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
    },
    {
      name: 'copy-ffmpeg-core',
      apply: 'build',
      closeBundle() {
        copyFfmpegCore(path.resolve(process.cwd(), 'dist'));
      }
    }
  ],
  server: {
    port: 5173,
    host: true,
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
