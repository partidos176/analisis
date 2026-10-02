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

// ---------------------------------------------------------------------------
// Montaje completo en el servidor (ffmpeg nativo). El navegador solo manda el
// plan (tramos/clip/imagen) y los ficheros sueltos; aquí se extraen los
// tramos del vídeo en caché, se normalizan todos a 1280x720@25 y se concatenan.
// Si algo falla se responde con error y el cliente se queda en la ruta de
// grabación por canvas (fallback), así que nunca se pierde la descarga.
// ---------------------------------------------------------------------------
const montajeUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { const d = tmpDir(); req._montajeDir = d; cb(null, d); },
    // Nombre por fieldname (f0, f1, …): dos clips con el mismo nombre de
    // origen no se pisan entre sí dentro del directorio del trabajo.
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '';
      cb(null, `${file.fieldname || 'archivo'}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 * 1024 },
});

const FONT_CANDIDATES = [
  'C:\\Windows\\Fonts\\segoeuib.ttf',
  'C:\\Windows\\Fonts\\arialbd.ttf',
  'C:\\Windows\\Fonts\\segoeui.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/Library/Fonts/Arial Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
];
const FONT_PATH = FONT_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
console.log('Fuente para banners:', FONT_PATH || '(sin fuente: se usará la por defecto)');

// Los paths absolutos de Windows llevan 'C:' y ese ':' separa opciones dentro
// de -vf, así que todos los ficheros auxiliares (fuente y textfile) se copian
// al directorio del trabajo y se referencian en relativo con cwd en el job.
const runFfmpeg = (args, timeout = 600000, cwd = null) =>
  execFileAsync(ffmpegPath, args, { timeout, maxBuffer: 16 * 1024 * 1024, ...(cwd ? { cwd } : {}) });

// Extracción paralela: con 4-6 trabajos a la vez el cuello de botella pasa a
// ser el disco/CPU en vez de la cola, y un tramo largo no para el resto.
const poolExtraer = async (trabajos, concurrencia = 5) => {
  const resultados = new Array(trabajos.length);
  let i = 0;
  const worker = async () => {
    while (i < trabajos.length) {
      const idx = i++;
      const t = trabajos[idx];
      try {
        await runFfmpeg(t.args, 600000, t.cwd || null);
        if (!fs.existsSync(t.salida) || fs.statSync(t.salida).size < 32) throw new Error('salida vacía');
        resultados[idx] = { ok: true, path: t.salida };
      } catch (err) {
        resultados[idx] = { ok: false, error: (err && err.message) || String(err) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrencia, trabajos.length)) }, worker));
  return resultados;
};

app.post('/api/montaje', montajeUpload.any(), async (req, res) => {
  // Con un plan que solo lleva tramos no entra ningún fichero y multer no
  // llega a crear el directorio del trabajo: hay que reservarlo aquí.
  if (!req._montajeDir) req._montajeDir = tmpDir();
  const dir = req._montajeDir;
  const t0 = Date.now();
  res.setHeader('Access-Control-Expose-Headers', 'X-Tiempo-Ms');
  try {
    let plan;
    try {
      plan = typeof req.body.plan === 'string' ? JSON.parse(req.body.plan) : req.body.plan;
    } catch { plan = null; }
    const items = plan && Array.isArray(plan.items) ? plan.items : null;
    if (!items || !items.length) {
      if (dir) rmrf(dir);
      return res.status(400).json({ error: 'Plan de montaje vacío o inválido' });
    }
    if (items.length > 500) {
      if (dir) rmrf(dir);
      return res.status(400).json({ error: 'Demasiados segmentos (' + items.length + ')' });
    }

    // Ficheros subidos (clip/imagen): el cliente los nombra f0, f1...
    const archivos = {};
    for (const f of (req.files || [])) archivos[f.fieldname] = f.path;

    if (!cachedVideoPath || !fs.existsSync(cachedVideoPath)) {
      const hayTramos = items.some((it) => it && it.t === 'tramo');
      if (hayTramos) {
        if (dir) rmrf(dir);
        return res.status(400).json({ error: 'No hay vídeo en caché para los tramos', sinCache: true });
      }
    }

    const salidas = [];
    const trabajos = [];
    const ESCALA = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1';
    // Fuente copiada al job: en relativo no hay ':' que rompa -vf.
    let fuenteRel = null;
    if (FONT_PATH) {
      try { fs.copyFileSync(FONT_PATH, path.join(dir, 'banner.ttf')); fuenteRel = 'banner.ttf'; } catch {}
    }
    for (let k = 0; k < items.length; k++) {
      const it = items[k] || {};
      const salida = path.join(dir, `seg-${String(k).padStart(4, '0')}.mp4`);
      // 'dur' opcional: si el cliente no lo manda, el clip se toma entero.
      const durN = Number(it.dur) || 0;
      // Banner de nombre: el canvas lo pinta en la barra superior durante todo
      // el segmento, así que aquí se dibuja igual con drawbox + drawtext.
      let vf = ESCALA;
      const nombre = it.nombre != null ? String(it.nombre).trim() : '';
      if (nombre) {
        const txtRel = `txt-${String(k).padStart(4, '0')}.txt`;
        fs.writeFileSync(path.join(dir, txtRel), nombre.replace(/\r?\n/g, ' '), 'utf8');
        vf += ',drawbox=x=0:y=0:w=iw:h=52:color=black@0.65:t=fill'
          + `,drawtext=${fuenteRel ? `fontfile='${fuenteRel}':` : ''}textfile='${txtRel}'`
          + ':expansion=none:fontsize=32:fontcolor=0xfacc15:x=(w-text_w)/2:y=26-text_h/2';
      }
      const normalizar = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-vf', vf,
        '-r', '25', '-pix_fmt', 'yuv420p', '-g', '25', '-an'];
      if (it.t === 'tramo') {
        const ini = Math.max(0, Number(it.ini) || 0);
        const fin = Math.max(ini + 0.2, Number(it.fin) || 0);
        trabajos.push({
          salida, cwd: dir,
          args: ['-ss', String(ini), '-i', cachedVideoPath, '-t', (fin - ini).toFixed(3),
            ...normalizar, '-y', salida],
        });
      } else if (it.t === 'clip') {
        const src = archivos['f' + k];
        if (!src) { if (dir) rmrf(dir); return res.status(400).json({ error: `Falta el clip ${k}` }); }
        trabajos.push({
          salida, cwd: dir,
          args: ['-i', src, ...(durN > 0 ? ['-t', durN.toFixed(3)] : []), ...normalizar, '-y', salida],
        });
      } else if (it.t === 'imagen') {
        const src = archivos['f' + k];
        if (!src) { if (dir) rmrf(dir); return res.status(400).json({ error: `Falta la imagen ${k}` }); }
        trabajos.push({
          salida, cwd: dir,
          args: ['-loop', '1', '-t', String(durN || 4), '-i', src, ...normalizar, '-y', salida],
        });
      } else {
        if (dir) rmrf(dir);
        return res.status(400).json({ error: `Tipo de segmento desconocido: ${it.t}` });
      }
      salidas.push(salida);
    }

    console.log(`[Montaje] ${items.length} segmentos, ${trabajos.length} ffmpeg en paralelo`);
    const resultados = await poolExtraer(trabajos, 5);
    const fallidos = resultados.map((r, i) => (r && r.ok ? null : { i, e: (r && r.error) || 'desconocido' })).filter(Boolean);
    if (fallidos.length) {
      if (dir) rmrf(dir);
      return res.status(500).json({ error: 'Fallo extrayendo segmentos: ' + fallidos.map((f) => `${f.i}: ${f.e}`).join('; ') });
    }

    const listPath = path.join(dir, 'lista.txt');
    // Rutas relativas + cwd: en concat demuxer los ':' de 'C:\...' se comen.
    fs.writeFileSync(listPath, salidas.map((p) => `file '${path.basename(p)}'`).join('\n'));
    const finalPath = path.join(dir, 'montaje.mp4');

    // Camino rápido: concat en stream-copy (sin re-codificar) cuando no hay
    // transiciones que calcular. Si el contenedor lo rechaza, se re-codifica.
    let rapido = false;
    if (!plan.conTransiciones) {
      try {
        await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', '-movflags', '+faststart', '-y', 'montaje.mp4'], 300000, dir);
        rapido = fs.existsSync(finalPath) && fs.statSync(finalPath).size > 1024;
      } catch (err) {
        console.warn('[Montaje] concat en copia falló, se re-codifica:', err.message);
        rapido = false;
      }
    }
    if (!rapido) {
      await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1',
        '-r', '25', '-pix_fmt', 'yuv420p', '-g', '25', '-an', '-movflags', '+faststart', '-y', 'montaje.mp4'], 600000, dir);
    }
    const size = fs.statSync(finalPath).size;
    const ms = Date.now() - t0;
    console.log(`[Montaje] OK: ${size} bytes en ${ms} ms (rapido=${rapido})`);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'inline; filename="montaje.mp4"');
    res.setHeader('X-Tiempo-Ms', String(ms));
    // Longitud fija: el cliente puede medir el descargado y mostrar progreso.
    res.setHeader('Content-Length', String(size));
    const stream = fs.createReadStream(finalPath);
    stream.pipe(res);
    res.on('finish', () => { setTimeout(() => rmrf(dir), 2000); });
    res.on('close', () => { setTimeout(() => rmrf(dir), 2000); });
  } catch (err) {
    console.error('[Montaje] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error al montar: ' + err.message });
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
