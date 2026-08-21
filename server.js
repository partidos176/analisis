import express from 'express';
import multer from 'multer';
import cors from 'cors';
import archiver from 'archiver';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ffmpegPath = path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2gb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2048 * 1024 * 1024 } });

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

app.get('/api/cortar', (req, res) => {
  console.log('GET /api/cortar - health check');
  res.json({ ok: true });
});

app.options('/api/cortar', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.post('/api/cortar', upload.single('video'), async (req, res) => {
  let dir = null;
  console.log('POST /api/cortar - file:', req.file?.originalname, 'size:', req.file?.size);
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió el archivo de vídeo' });
    }
    let cortes;
    try {
      cortes = JSON.parse(req.body.cortes || '[]');
    } catch {
      return res.status(400).json({ error: 'Formato de cortes inválido' });
    }
    const segundos = Math.max(1, parseInt(req.body.segundos, 10) || 15);
    if (!Array.isArray(cortes) || cortes.length === 0) {
      return res.status(400).json({ error: 'No hay cortes que generar' });
    }
    dir = tmpDir();
    const inputPath = path.join(dir, 'input.mp4');
    fs.writeFileSync(inputPath, req.file.buffer);
    const writtenSize = fs.statSync(inputPath).size;
    console.log('Input written:', inputPath, 'size:', writtenSize, 'of', req.file.size);

    const header = Buffer.alloc(12);
    const fd = fs.openSync(inputPath, 'r');
    fs.readSync(fd, header, 0, 12, 0);
    fs.closeSync(fd);
    const ftyp = header.toString('ascii', 0, 4);
    const mdat = header.toString('ascii', 4, 8);
    console.log('MP4 header bytes:', header.toString('hex').substring(0, 24), 'ftyp:', ftyp, 'next:', mdat);

    if (writtenSize !== req.file.size) {
      return res.status(500).json({ error: `Tamaño del archivo no coincide: esperaba ${req.file.size}, escrito ${writtenSize}` });
    }

    if (ftyp === 'ftyp' || mdat === 'ftyp') {
      console.log('Valid MP4/ftyp header detected');
    } else {
      console.log('WARNING: File may not be a valid MP4');
    }

    const outputDir = path.join(dir, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    for (const corte of cortes) {
      const startSecs = parseTime(corte.time);
      const outName = (corte.name || 'corte').replace(/[\\/:*?"<>|]/g, '_');
      const outPath = path.join(outputDir, `${outName}.mp4`);
      const args = ['-ss', String(startSecs), '-t', String(segundos), '-i', inputPath, '-c', 'copy', '-movflags', '+faststart', '-y', outPath];
      console.log('ffmpeg args:', args.join(' '));
      try {
        await execFileAsync(ffmpegPath, args, { timeout: 300000 });
      } catch (err) {
        console.error('ffmpeg error:', err.message);
        return res.status(500).json({ error: `Error al cortar ${corte.time}: ${err.message}` });
      }
    }

    const zipPath = path.join(dir, 'cortes.zip');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    archive.directory(outputDir, false);
    await archive.finalize();
    await new Promise((resolve) => output.on('close', resolve));

    console.log('ZIP created:', fs.statSync(zipPath).size, 'bytes');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="cortes.zip"`);
    const stream = fs.createReadStream(zipPath);
    stream.pipe(res);
    res.on('finish', () => { setTimeout(() => rmrf(dir), 1000); dir = null; });
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