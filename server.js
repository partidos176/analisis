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
import os from 'os';
import ffmpegStatic from 'ffmpeg-static';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ffmpegPath = ffmpegStatic;

const app = express();
// Esta cabecera va ANTES que cors(), no despues. cors() responde al preflight y
// cierra la peticion, asi que si el middleware de la cabecera estaba despues
// nunca llegaba a ejecutarse y la cabecera salia vacia. Sin ella, Chrome
// bloquea que una pagina en https (la web publicada) pida a localhost (este
// ordenador), que es justamente el caso del que sale "Sin conexion con el
// servidor". Desde http://localhost:5173 si funcionaba, porque ahi no hay salto
// de red publica a privada.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});
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

// ===========================================================================
// /api/montaje - compone el montaje con ffmpeg nativo, sin pasar por el
// navegador. Antes el montaje se grababa en tiempo real sobre un canvas con
// MediaRecorder (con un techo de 1x: nunca puede bajar de la duracion del
// propio montaje) y despues se recodificaba entero con ffmpeg.wasm. Aqui se
// recortan los tramos del fichero fuente directamente y se concatenan, que es
// una sola pasada de codificacion y sin realtime.
// ===========================================================================

const MONTAJE_MAX_SEGMENTOS = 500;
const MONTAJE_MAX_SEGUNDOS = 60 * 60;
const RECURSOS_DIR = path.join(videoCacheDir, 'recursos');
try { fs.mkdirSync(RECURSOS_DIR, { recursive: true }); } catch (e) { console.warn('No se pudo crear recursos:', e.message); }

// En los argumentos de un filtro ':' separa opciones y '\' escapa. Una ruta de
// Windows necesita las dos cosas, y con barras normales ffmpeg la acepta.
const escaparRutaFiltro = (p) => String(p).replace(/\\/g, '/').replace(/:/g, '\\:');

// La app pinta los rotulos con Inter 800, asi que el servidor tiene que usar
// la misma fuente: con Arial la letra salia distinta a la de la vista previa.
// Se prueban por orden: la que indique FUENTE_ROTULO, luego Inter Bold (que es
// lo mas parecido a Inter 800), y como ultimo recurso Arial.
const FUENTES_ROTULO = [
  process.env.FUENTE_ROTULO,
  'C:\\Windows\\Fonts\\Inter-Bold-slnt=0.ttf',
  'C:\\Windows\\Fonts\\Inter[wght].ttf',
  'C:\\Windows\\Fonts\\Inter.ttf',
  'C:\\Windows\\Fonts\\arialbd.ttf',
].filter(Boolean);
const fuenteElegida = FUENTES_ROTULO.find((x) => fs.existsSync(x)) || 'C:\\Windows\\Fonts\\arialbd.ttf';
const fuenteFiltro = escaparRutaFiltro(fuenteElegida);
console.log('[Rotulo] fuente: ' + fuenteElegida);

// El rotulo va en linea en el filtro, no en textfile=: en el build de ffmpeg de
// ffmpeg-static (6.1.1) textfile= siempre falla con "Both text and text file
// provided", porque el valor por defecto de text= cuenta como informado. Asi que
// hay que escapar el texto a mano. Pasa por dos analizadores: el de la cadena
// de filtros (parte en , ; [ ]) y el de opciones (parte en :), de ahi las dos
// familias de escapes. Con expansion=none el % no se expande y se deja tal cual.
const escaparTexto = (s) => String(s)
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/:/g, '\\:')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;')
  .replace(/\[/g, '\\[')
  .replace(/\]/g, '\\]');

// Escala al ancho de salida, completa con bandas negras si el original no es
// 16:9 (para no deformar) y pinta el rotulo igual que el canvas: barra negra
// de 52 px al 65% y el nombre en #facc15 centrado.
const filtroRotulo = (nombre, ancho, alto) => {
  const partes = ['scale=' + ancho + ':' + alto + ':force_original_aspect_ratio=decrease',
    'pad=' + ancho + ':' + alto + ':(ow-iw)/2:(oh-ih)/2'];
  if (nombre) {
    const hBarra = Math.max(24, Math.round(52 * (alto / 720)));
    const fTam = Math.max(14, Math.round(32 * (alto / 720)));
    partes.push('drawbox=x=0:y=0:w=iw:h=' + hBarra + ':color=black@0.65:t=fill');
    partes.push("drawtext=fontfile='" + fuenteFiltro.replace(/'/g, "\\'") + "':text='" + escaparTexto(nombre) + "'"
      + ':fontcolor=#facc15:fontsize=' + fTam + ':x=(w-text_w)/2:y=(' + hBarra + '-text_h)/2'
      + ':expansion=none:fix_bounds=1');
  }
  return partes.join(',');
};

// Estos parametros son los mismos para todos los tramos, sea cual sea su origen.
// Es lo que permite concatenar luego con -c copy sin recodificar otra vez. El
// -r 30 es importante: sin el, un tramo que venga de una imagen sale a 25 fps y
// la concatenacion con copia de bits se descuadra y pierde contenido.
const parametrosCodificacion = (out, hilos) => [
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
  '-g', '30', '-keyint_min', '30', '-sc_threshold', '0',
  '-pix_fmt', 'yuv420p', '-an', '-r', '30',
  // Los nucleos se reparten entre los procesos. Con varios tramos en paralelo
  // sale mejor un hilo por proceso y que el sistema los vaya turnando; con un
  // solo tramo, en cambio, los nucleos libres se le dan a ese proceso para que
  // no se queden mirando.
  '-threads', String(Math.max(1, hilos || 1)),
  '-y', out,
];

const rutaRecurso = (id, ext) => path.join(RECURSOS_DIR, id + '.' + (ext || 'bin'));

// Traduce un tramo del plan a los argumentos de entrada de ffmpeg, y devuelve
// su duracion. Un tramo puede ser del video fuente, de un clip subido (las
// animaciones, que el navegador genera y el servidor no tiene) o de una imagen.
const entradaTramo = (t) => {
  if (t.tipo === 'clip' || t.tipo === 'imagen') {
    const ext = t.ext || sniffExtension(t.id);
    const fichero = rutaRecurso(t.id, ext);
    if (!fs.existsSync(fichero)) throw new Error('recurso no subido: ' + t.id);
    if (t.tipo === 'imagen') {
      const d = Number(t.dur);
      // -framerate 30 en la entrada para que el bucle de la imagen produzca los
      // mismos 30 fps que el resto de tramos.
      return { args: ['-loop', '1', '-framerate', '30', '-t', d.toFixed(3), '-i', fichero], dur: d };
    }
    const dur = Math.max(0.05, Number(t.hasta) - Number(t.desde));
    return { args: ['-ss', Number(t.desde).toFixed(3), '-i', fichero, '-t', dur.toFixed(3)], dur };
  }
  const dur = Number(t.fin) - Number(t.ini);
  // -ss ANTES de -i: el salto por indice evita decodificar todo lo anterior,
  // que en un partido de 98 min seria inaceptable.
  return { args: ['-ss', Number(t.ini).toFixed(3), '-i', cachedVideoPath, '-t', dur.toFixed(3)], dur };
};

const sniffExtension = (id) => {
  // El cliente manda la extension cuando la sabe; si no, se busca el fichero.
  for (const ext of ['mp4', 'webm', 'jpg', 'png']) {
    if (fs.existsSync(rutaRecurso(id, ext))) return ext;
  }
  return 'bin';
};

// Recorta un tramo, sea del fuente, de un clip o de una imagen, y lo deja en un
// mp4 con los parametros comunes.
const recortarTramo = async (t, i, dir, ancho, alto, hilos) => {
  const { args, dur } = entradaTramo(t);
  if (!(dur > 0.02)) throw new Error('tramo ' + i + ': duracion invalida');
  const out = path.join(dir, 'seg-' + i + '.mp4');
  const ffmpegArgs = [...args, '-vf', filtroRotulo(t.nombre, ancho, alto), ...parametrosCodificacion(out, hilos)];
  const t0 = Date.now();
  await execFileAsync(ffmpegPath, ffmpegArgs, { timeout: 600000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  console.log('[Montaje] tramo ' + i + ' (' + (t.tipo || 'fuente') + ', ' + dur.toFixed(2) + 's) en ' + (Date.now() - t0) + ' ms');
  return out;
};

// ---- Fundidos (transiciones) ---------------------------------------------
// Una transicion mezcla la cola del tramo anterior con la cabeza del siguiente
// durante 'dur' segundos. Los dos operandos pueden venir del video fuente o de
// un clip subido (una animacion), asi que se describen aparte.

const entradaOperando = (o, dur) => {
  if (!o || !(dur > 0.02)) throw new Error('fundido: operando invalido');
  if (o.origen === 'recurso') {
    const fichero = rutaRecurso(o.id, o.ext);
    if (!fs.existsSync(fichero)) throw new Error('fundido: recurso no subido ' + o.id);
    return { args: ['-ss', Number(o.desde).toFixed(3), '-i', fichero, '-t', dur.toFixed(3)] };
  }
  return { args: ['-ss', Number(o.ini).toFixed(3), '-i', cachedVideoPath, '-t', dur.toFixed(3)] };
};

// Los modelos de transicion de la app y el nombre equivalente en xfade.
// Comprobado uno a uno contra este build de ffmpeg: los siete existen.
const MODELO_XFADE = {
  crossfade: 'fade',
  negro: 'fadeblack',
  flash: 'fadewhite',
  'slide-left': 'slideleft',
  'slide-right': 'slideright',
  'zoom-in': 'zoomin',
  wipe: 'wipeleft',
};

const construirFundido = async (t, i, dir, ancho, alto, hilos) => {
  const d = Number(t.dur);
  if (!(d > 0.05)) throw new Error('fundido ' + i + ': duracion invalida');
  const a = entradaOperando(t.a, d);
  const b = entradaOperando(t.b, d);
  const out = path.join(dir, 'seg-' + i + '.mp4');
  // scale+pad deja los dos operandos con la misma caja; fps y format son
  // necesarios porque el filtro blend exige que coincidan.
  const caja = 'scale=' + ancho + ':' + alto + ':force_original_aspect_ratio=decrease'
    + ',pad=' + ancho + ':' + alto + ':(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p';
  const dnum = d.toFixed(4);
  // xfade y no blend con all_expr: la formula de blend se evalua pixel a pixel
  // y un fundido de 2 s tardaba 9,8 s. Con xfade, que es codigo nativo, el mismo
  // fundido tarda 4,1 s: 2,4 veces menos, y con 25 transiciones la diferencia
  // es de minutos.
  const modelo = String(t.modelo || 'crossfade');
  const xfade = MODELO_XFADE[modelo] || 'fade';
  if (!MODELO_XFADE[modelo]) console.log('[Fundido] modelo desconocido: ' + modelo + ', se usa fundido cruzado');
  const fc = "[0:v]" + caja + '[a];[1:v]' + caja + '[b];'
    + '[a][b]xfade=transition=' + xfade + ':duration=' + dnum + ':offset=0[v]';
  const t0 = Date.now();
  await execFileAsync(ffmpegPath, [...a.args, ...b.args,
    '-filter_complex', fc, '-map', '[v]', '-t', dnum,
    ...parametrosCodificacion(out, hilos)], { timeout: 600000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  console.log('[Fundido] ' + i + ': ' + modelo + ' -> ' + xfade + ' (' + d.toFixed(2) + 's) en ' + (Date.now() - t0) + ' ms');
  return out;
};

// Ejecuta una tarea por hueco, con un limite de cuantas corren a la vez.
const enCola = async (n, limite, tarea) => {
  const resultados = new Array(n);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < n) {
      const i = siguiente++;
      resultados[i] = await tarea(i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limite, n)) }, trabajador));
  return resultados;
};

// ---- Subida de recursos (animaciones, imagenes) ---------------------------
// Se guardan por hash del contenido: si el mismo clip vuelve a usarse en otro
// montaje no se vuelve a subir.

const sniffMagic = (buf) => {
  if (buf.length > 3 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  if (buf.length > 12 && buf.toString('latin1', 4, 8) === 'ftyp') return 'mp4';
  if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length > 4 && buf.readUInt32BE(0) === 0x89504e47) return 'png';
  return 'bin';
};

// La fuente se lee al arrancar, pero si el fichero aparece despues (una subida
// que termina, o el cache restaurado a mano) el servidor se quedaba diciendo
// que no hay fuente. Se reintenta en cada peticion mientras no haya ninguna.
const reintentarFuente = () => {
  if (cachedVideoPath && fs.existsSync(cachedVideoPath)) return cachedVideoPath;
  cachedVideoPath = null;
  cachedVideoName = null;
  cachedVideoSize = 0;
  try {
    const cp = path.join(videoCacheDir, 'cached.mp4');
    const mp = path.join(videoCacheDir, 'meta.json');
    if (!fs.existsSync(cp) || !fs.existsSync(mp)) return null;
    const meta = JSON.parse(fs.readFileSync(mp, 'utf8'));
    if (!meta || !meta.name) return null;
    cachedVideoPath = cp;
    cachedVideoName = meta.name;
    cachedVideoSize = meta.size || fs.statSync(cp).size;
    console.log('[Fuente] restaurada desde disco: ' + cachedVideoName);
    return cachedVideoPath;
  } catch (_) { return null; }
};

app.post('/api/recurso', express.raw({ type: '*/*', limit: '400mb' }), (req, res) => {
  try {
    const buf = req.body;
    if (!buf || !buf.length) return res.status(400).json({ error: 'Recurso vacio' });
    const ext = sniffMagic(buf);
    if (ext === 'bin') return res.status(400).json({ error: 'Formato no reconocido (se esperaba mp4, webm, jpg o png)' });
    const id = crypto.createHash('sha1').update(buf).digest('hex');
    const destino = rutaRecurso(id, ext);
    const yaEstaba = fs.existsSync(destino);
    if (!yaEstaba) fs.writeFileSync(destino, buf);
    console.log('[Recurso] ' + ext + ' ' + buf.length + ' bytes -> ' + id + (yaEstaba ? ' (ya estaba)' : ''));
    res.json({ ok: true, id, ext, bytes: buf.length, reutilizado: yaEstaba });
  } catch (err) {
    console.error('[Recurso] Error:', err.message);
    res.status(500).json({ error: 'Error guardando el recurso: ' + err.message });
  }
});

app.get('/api/estado', (req, res) => {
  let recursos = 0;
  try { recursos = fs.readdirSync(RECURSOS_DIR).length; } catch (_) {}
  reintentarFuente();
  res.json({
    ok: true,
    fuente: !!cachedVideoPath,
    fuenteNombre: cachedVideoName,
    fuenteBytes: cachedVideoSize,
    recursos,
  });
});

// ---- Composicion del montaje ---------------------------------------------

app.post('/api/montaje', async (req, res) => {
  let dir = null;
  try {
    if (!reintentarFuente()) {
      return res.status(409).json({ error: 'sin-fuente', detalle: 'El servidor no tiene el video fuente en la cache' });
    }
    const segs = (req.body && Array.isArray(req.body.segmentos)) ? req.body.segmentos : null;
    if (!segs || !segs.length) { console.log('[Montaje] 400: no vinieron segmentos'); return res.status(400).json({ error: 'No se recibieron segmentos' }); }
    if (segs.length > MONTAJE_MAX_SEGMENTOS) { console.log('[Montaje] 400: demasiados segmentos (' + segs.length + ')'); return res.status(400).json({ error: 'Demasiados segmentos: ' + segs.length }); }
    const ancho = Math.min(3840, Math.max(160, Math.round(Number(req.body.ancho) || 1280)));
    const alto = Math.min(2160, Math.max(90, Math.round(Number(req.body.alto) || 720)));

    // Validar antes de lanzar ffmpeg: un tramo con tiempos rotos haria que un
    // proceso en paralelo fallara y el concat no se pudiera montar.
    const limpio = [];
    let total = 0;
    for (const s of segs) {
      const tipo = (s && s.tipo) || 'fuente';
      const nombre = String((s && s.nombre) || '').slice(0, 120);
      let dur = 0;
      try {
        if (tipo === 'clip') {
          if (!s.id || !/^[0-9a-f]{40}$/.test(String(s.id))) continue;
          dur = Number(s.hasta) - Number(s.desde);
        } else if (tipo === 'transicion') {
          if (!s.a || !s.b) continue;
          dur = Number(s.dur);
        } else if (tipo === 'imagen') {
          if (!s.id || !/^[0-9a-f]{40}$/.test(String(s.id))) continue;
          dur = Number(s.dur);
        } else {
          const ini = Number(s.ini);
          const fin = Number(s.fin);
          if (!Number.isFinite(ini) || !Number.isFinite(fin) || fin <= ini) continue;
          s.ini = Math.max(0, ini);
          dur = fin - s.ini;
        }
      } catch (_) { continue; }
      if (!(dur > 0.02)) continue;
      limpio.push(Object.assign({}, s, { tipo, nombre, _dur: dur }));
      total += dur;
    }
    if (!limpio.length) {
      // Casi siempre es un tramo de clip o imagen sin id, o con duracion cero.
      // Sin esto el cliente solo veía un 400 sin explicación.
      console.log('[Montaje] 400: ningun tramo valido de ' + segs.length + ' recibidos. Primeros: '
        + JSON.stringify(segs.slice(0, 4)).slice(0, 900));
      return res.status(400).json({ error: 'Ningun tramo con tiempos validos' });
    }
    if (total > MONTAJE_MAX_SEGUNDOS) { console.log('[Montaje] 400: ' + total.toFixed(1) + ' s superan el maximo'); return res.status(400).json({ error: 'El montaje supera el maximo de ' + MONTAJE_MAX_SEGUNDOS + ' s' }); }

    dir = path.join(tmpBase, 'montaje-' + Date.now());
    fs.mkdirSync(dir, { recursive: true });
    const tIni = Date.now();
    const nucleos = Math.max(1, ((os.cpus() || []).length || 4));
    const enParalelo = Math.max(1, Math.min(4, Math.floor(nucleos / 2) + 1));
    // Un solo tramo no se puede paralelizar, asi que en vez de wasted los
    // nucleos se le dan a ese proceso: 15 s de un tramo tardaban 8,8 s usando un
    // unico hilo. Con varios tramos, el reparto es al reves.
    const hilosPorProceso = Math.max(1, Math.floor(nucleos / enParalelo));
    const deFuente = limpio.filter((t) => t.tipo === 'fuente').length;
    const nFundidos = limpio.filter((t) => t.tipo === 'transicion').length;
    console.log('[Montaje] ' + limpio.length + ' tramos (' + deFuente + ' del fuente), ' + total.toFixed(1)
      + 's de contenido, ' + ancho + 'x' + alto + ', en paralelo x' + enParalelo + ' (' + nucleos + ' nucleos)');

    console.log('[Montaje] ' + limpio.length + ' tramos (' + nFundidos + ' fundidos) con ' + enParalelo + ' en paralelo x ' + hilosPorProceso + ' hilos');
    const ficheros = await enCola(limpio.length, enParalelo, (i) => (limpio[i].tipo === 'transicion'
      ? construirFundido(limpio[i], i, dir, ancho, alto, hilosPorProceso)
      : recortarTramo(limpio[i], i, dir, ancho, alto, hilosPorProceso)));

    // Todos los tramos salen con los mismos parametros (mismo codec, misma
    // resolucion, mismo GOP), asi que concatenar es una copia de bits: sin una
    // segunda codificacion.
    const lista = path.join(dir, 'lista.txt');
    fs.writeFileSync(lista, ficheros.map((f) => "file '" + f.replace(/\\/g, '/') + "'").join('\n'), 'utf8');
    const outPath = path.join(dir, 'montaje.mp4');
    await execFileAsync(ffmpegPath, ['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-movflags', '+faststart', '-y', outPath],
      { timeout: 600000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });

    const tam = fs.statSync(outPath).size;
    const ms = Date.now() - tIni;
    console.log('[Montaje] OK: ' + limpio.length + ' tramos, ' + total.toFixed(1) + 's en ' + ms
      + ' ms (x' + (total / (ms / 1000)).toFixed(2) + '), ' + tam + ' bytes');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', tam);
    res.setHeader('Content-Disposition', 'inline; filename="montaje.mp4"');
    res.setHeader('Access-Control-Expose-Headers', 'X-Montaje-Ms, X-Montaje-Tramos, X-Montaje-Contenido');
    res.setHeader('X-Montaje-Ms', String(ms));
    res.setHeader('X-Montaje-Tramos', String(limpio.length));
    res.setHeader('X-Montaje-Contenido', total.toFixed(2));
    fs.createReadStream(outPath).pipe(res);
    res.on('finish', () => { setTimeout(() => rmrf(dir), 2000); });
  } catch (err) {
    console.error('[Montaje] Error:', err.message);
    res.status(500).json({ error: 'Error componiendo el montaje: ' + err.message });
    if (dir) rmrf(dir);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de cortes escuchando en http://0.0.0.0:${PORT}`);
  console.log(`ffmpeg: ${ffmpegPath}`);
  console.log(`ffmpeg exists: ${fs.existsSync(ffmpegPath)}`);
  console.log(`Temp dir: ${tmpBase}`);
});
