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
import ffmpegStatic from 'ffmpeg-static';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ffmpegPath = ffmpegStatic;

const app = express();
app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});
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
let cachedVideoSize = 0;
const metaPath = path.join(videoCacheDir, 'meta.json');
try {
  const cachedPath = path.join(videoCacheDir, 'cached.mp4');
  if (fs.existsSync(cachedPath) && fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta && meta.name && fs.statSync(cachedPath).size > 0) {
      cachedVideoPath = cachedPath;
      cachedVideoName = meta.name;
      cachedVideoSize = fs.statSync(cachedPath).size;
      console.log('Cache restaurada:', cachedVideoName, cachedVideoSize, 'bytes');
    }
  }
} catch (err) {
  console.warn('No se pudo restaurar la caché:', err.message);
}
const guardarMetaCache = () => {
  try { fs.writeFileSync(metaPath, JSON.stringify({ name: cachedVideoName, size: cachedVideoSize })); } catch {}
};

app.get('/api/cortar', (req, res) => {
  console.log('GET /api/cortar - health check');
  res.json({ ok: true, cached: !!cachedVideoPath, cachedName: cachedVideoName, cachedSize: cachedVideoSize });
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
    cachedVideoSize = req.file.size;
    guardarMetaCache();
    rmrf(path.dirname(inputPath));
    console.log('Video cached:', cachedVideoName, req.file.size, 'bytes');
    res.json({ ok: true, name: cachedVideoName, size: req.file.size });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Error al subir: ' + err.message });
  }
});

// Subida por fragmentos para vídeos muy grandes (evita colgar el navegador)
const chunkUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => { const d = tmpDir(); req._chunkDir = d; cb(null, d); }, filename: (req, file, cb) => cb(null, 'chunk') }) });
const pendingUploads = {};

app.post('/api/upload-init', (req, res) => {
  try {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const dir = tmpDir();
    pendingUploads[id] = { dir, target: path.join(dir, 'input.mp4'), total: Number(req.body.totalChunks) || 0, done: 0, name: String(req.body.name || 'video').slice(0, 200) };
    fs.writeFileSync(pendingUploads[id].target, Buffer.alloc(0));
    res.json({ ok: true, uploadId: id });
  } catch (err) {
    res.status(500).json({ error: 'Error iniciando subida: ' + err.message });
  }
});

app.post('/api/upload-chunk', chunkUpload.single('chunk'), (req, res) => {
  try {
    const id = req.body.uploadId;
    const job = pendingUploads[id];
    if (!job) return res.status(400).json({ error: 'Subida no iniciada o caducada' });
    if (!req.file) return res.status(400).json({ error: 'Falta el fragmento' });
    const data = fs.readFileSync(req.file.path);
    fs.appendFileSync(job.target, data);
    job.done += 1;
    rmrf(req._chunkDir);
    res.json({ ok: true, done: job.done, total: job.total });
  } catch (err) {
    res.status(500).json({ error: 'Error en fragmento: ' + err.message });
  }
});

app.post('/api/upload-complete', (req, res) => {
  try {
    const id = req.body.uploadId;
    const job = pendingUploads[id];
    if (!job) return res.status(400).json({ error: 'Subida no iniciada o caducada' });
    const cachedPath = path.join(videoCacheDir, 'cached.mp4');
    fs.copyFileSync(job.target, cachedPath);
    cachedVideoPath = cachedPath;
    cachedVideoName = job.name;
    const size = fs.statSync(cachedPath).size;
    cachedVideoSize = size;
    guardarMetaCache();
    rmrf(job.dir);
    delete pendingUploads[id];
    console.log('Video cached (por fragmentos):', cachedVideoName, size, 'bytes');
    res.json({ ok: true, name: cachedVideoName, size });
  } catch (err) {
    res.status(500).json({ error: 'Error completando subida: ' + err.message });
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
      cachedVideoSize = req.file.size;
      guardarMetaCache();
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
      const raw = req.body.cortes;
      cortes = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : JSON.parse(raw || '[]'));
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
      const args = ['-ss', String(startSecs), '-i', inputPath, '-t', String(duracion), '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-c:a', 'aac', '-movflags', '+faststart', '-y', outPath];
      console.log(`[Corte] ffmpeg: ${ffmpegPath} ${args.join(' ')}`);
      try {
        const result = await execFileAsync(ffmpegPath, args, { timeout: 300000 });
        const outSize = fs.statSync(outPath).size;
        console.log(`[Corte] OK: ${outName}.mp4 → ${outSize} bytes`);
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

app.post('/api/trim-webm', upload.single('video'), async (req, res) => {
  let dir = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió el vídeo' });
    dir = req._uploadDir || tmpDir();
    const ext = (req.body.ext === 'mp4' || /mp4/i.test(req.file.originalname || '')) ? 'mp4' : 'webm';
    const inputPath = path.join(dir, 'input.' + ext);
    if (path.resolve(req.file.path) !== path.resolve(inputPath)) fs.copyFileSync(req.file.path, inputPath);
    // Trim inteligente: recorta solo el negro real detectado al inicio
    // (canvas vacío/encoder). Con cap de 0.6s para no comerse fundidos reales.
    let trimSecs = 0;
    try {
      const probe = await execFileAsync(ffmpegPath, ['-t', '2', '-i', inputPath, '-vf', 'blackdetect=d=0.05:pix_th=0.10', '-f', 'null', '-'], { timeout: 60000 });
      const log = String((probe && probe.stderr) || '') + String((probe && probe.stdout) || '');
      const m = /black_start:([0-9.]+)\s+black_end:([0-9.]+)/.exec(log);
      if (m && parseFloat(m[1]) < 0.05) trimSecs = Math.min(parseFloat(m[2]) || 0, 0.6);
    } catch (_) { trimSecs = 0; }
    console.log(`[Trim] negro inicial detectado: ${trimSecs}s`);
    const outPath = path.join(dir, 'output.' + ext);
    // -g 30 = keyframe cada 1s (30fps): seeking fluido sin saltos/deformación
    const args = ext === 'mp4'
      ? ['-i', inputPath, '-ss', String(trimSecs), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-g', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', '-y', outPath]
      : ['-i', inputPath, '-ss', String(trimSecs), '-c:v', 'libvpx-vp9', '-crf', '28', '-b:v', '0', '-g', '30', '-deadline', 'good', '-cpu-used', '4', '-an', '-y', outPath];
    console.log(`[Trim] ffmpeg: ${ffmpegPath} ${args.join(' ')}`);
    await execFileAsync(ffmpegPath, args, { timeout: 300000 });
    const outSize = fs.statSync(outPath).size;
    console.log(`[Trim] OK: ${outSize} bytes`);
    res.setHeader('Content-Type', ext === 'mp4' ? 'video/mp4' : 'video/webm');
    res.setHeader('Content-Disposition', `inline; filename="montaje.${ext}"`);
    fs.createReadStream(outPath).pipe(res);
    res.on('finish', () => { setTimeout(() => rmrf(dir), 2000); });
  } catch (err) {
    console.error('[Trim] Error:', err.message);
    res.status(500).json({ error: 'Error al recortar: ' + err.message });
    if (dir) rmrf(dir);
  }
});

const tmpBase = path.join(__dirname, '.tmp-cortes');
try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch {}
fs.mkdirSync(tmpBase, { recursive: true });

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de cortes escuchando en http://0.0.0.0:${PORT}`);
  console.log(`ffmpeg: ${ffmpegPath}`);
  console.log(`ffmpeg exists: ${fs.existsSync(ffmpegPath)}`);
  console.log(`Temp dir: ${tmpBase}`);
});
