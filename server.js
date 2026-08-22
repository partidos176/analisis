import express from 'express';
import multer from 'multer';
import cors from 'cors';
import archiver from 'archiver';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ffmpegPath = path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2gb' }));

const upload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => { const d = tmpDir(); req._uploadDir = d; cb(null, d); }, filename: (req, file, cb) => cb(null, 'input.mp4') }), limits: { fileSize: 20 * 1024 * 1024 * 1024 } });

let tmpCounter = 0;
const tmpDir = () => {
  const dir = path.join(__dirname, '.tmp-cortes', `job-${++tmpCounter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch {} };

const parseTime = (str) => {
  const parts = String(str).split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
};

const videoCacheDir = path.join(__dirname, '.video-cache');
fs.mkdirSync(videoCacheDir, { recursive: true });

let cachedVideoPath = null;
let cachedVideoName = null;

app.get('/api/cortar', (req, res) => {
  console.log('GET /api/cortar - health check');
  res.json({ ok: true, cached: !!cachedVideoPath, cachedName: cachedVideoName });
});

app.options('/api/cortar', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió el archivo de vídeo' });
    }
    const inputPath = path.join(req._uploadDir || tmpDir(), 'input.mp4');
    const cachedPath = path.join(videoCacheDir, 'cached.mp4');
    fs.copyFileSync(inputPath, cachedPath);
    cachedVideoPath = cachedPath;
    cachedVideoName = req.file.originalname;
    rmrf(path.dirname(inputPath));
    console.log('Video cached:', cachedVideoName, req.file.size, 'bytes');
    res.json({ ok: true, name: cachedVideoName, size: req.file.size });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Error al subir: ' + err.message });
  }
});

app.post('/api/cortar', upload.single('video'), async (req, res) => {
  let dir = null;
  try {
    let inputPath;
    if (req.file) {
      dir = req._uploadDir || tmpDir();
      inputPath = path.join(dir, 'input.mp4');
      const cachedPath = path.join(videoCacheDir, 'cached.mp4');
      fs.copyFileSync(inputPath, cachedPath);
      cachedVideoPath = cachedPath;
      cachedVideoName = req.file.originalname;
      rmrf(path.dirname(inputPath));
      dir = null;
      inputPath = cachedPath;
      console.log('Video cached:', cachedVideoName, req.file.size, 'bytes');
    } else if (cachedVideoPath && fs.existsSync(cachedVideoPath)) {
      inputPath = cachedVideoPath;
      console.log('Using cached video:', cachedVideoName);
    } else {
      return res.status(400).json({ error: 'No hay vídeo disponible. Sube uno primero.' });
    }

    let cortes;
    try {
      cortes = JSON.parse(req.body.cortes || '[]');
    } catch {
      return res.status(400).json({ error: 'Formato de cortes inválido' });
    }
    if (!Array.isArray(cortes) || cortes.length === 0) {
      return res.status(400).json({ error: 'No hay cortes que generar' });
    }

    const outDir = tmpDir();
    const results = [];
    for (const corte of cortes) {
      const startSecs = parseTime(corte.time);
      const duracion = corte.duracion ? Math.max(1, parseInt(corte.duracion, 10)) : 5;
      const outName = (corte.name || 'corte').replace(/[\\/:*?"<>|]/g, '_');
      const outPath = path.join(outDir, `${outName}.mp4`);
      const args = ['-ss', String(startSecs), '-t', String(duracion), '-i', inputPath, '-c', 'copy', '-movflags', '+faststart', '-y', outPath];
      try {
        await execFileAsync(ffmpegPath, args, { timeout: 300000 });
        results.push({ ok: true, name: outName, path: outPath });
      } catch (err) {
        console.error('ffmpeg error:', err.message);
        results.push({ ok: false, name: outName, error: err.message });
      }
    }

    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      rmrf(outDir);
      return res.status(500).json({ error: `Error al cortar: ${failed.map(f => f.name + ': ' + f.error).join('; ')}` });
    }

    if (cortes.length === 1) {
      const single = results[0];
      console.log('Single video:', single.path, fs.statSync(single.path).size, 'bytes');
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `inline; filename="${single.name}.mp4"`);
      const stream = fs.createReadStream(single.path);
      stream.pipe(res);
      res.on('finish', () => { setTimeout(() => rmrf(outDir), 1000); });
      return;
    }

    const zipPath = path.join(outDir, 'cortes.zip');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    for (const r of results) archive.file(r.path, { name: r.name + '.mp4' });
    await archive.finalize();
    await new Promise((resolve) => output.on('close', resolve));

    console.log('ZIP created:', fs.statSync(zipPath).size, 'bytes');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="cortes.zip"`);
    const stream = fs.createReadStream(zipPath);
    stream.pipe(res);
    res.on('finish', () => { setTimeout(() => rmrf(outDir), 1000); });
  } catch (err) {
    console.error('Error interno:', err);
    res.status(500).json({ error: 'Error interno: ' + err.message });
    if (dir) rmrf(dir);
  }
});

const tmpBase = path.join(__dirname, '.tmp-cortes');
try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch {}
fs.mkdirSync(tmpBase, { recursive: true });

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor de cortes escuchando en http://localhost:${PORT}`);
  console.log(`ffmpeg: ${ffmpegPath}`);
  console.log(`ffmpeg exists: ${fs.existsSync(ffmpegPath)}`);
  console.log(`Temp dir: ${tmpBase}`);
});
