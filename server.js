import express from 'express';
import multer from 'multer';
import cors from 'cors';
import archiver from 'archiver';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ffmpegPath = path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2048 * 1024 * 1024 } });

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cortes-'));

const parseTime = (str) => {
  const parts = String(str).split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
};

app.get('/api/cortar', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/cortar', upload.single('video'), async (req, res) => {
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
    const dir = tmpDir();
    const inputPath = path.join(dir, 'input.mp4');
    fs.writeFileSync(inputPath, req.file.buffer);

    const outputDir = path.join(dir, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    for (const corte of cortes) {
      const startSecs = parseTime(corte.time);
      const outName = (corte.name || 'corte').replace(/[\\/:*?"<>|]/g, '_');
      const outPath = path.join(outputDir, `${outName}.mp4`);
      const args = ['-ss', String(startSecs), '-t', String(segundos), '-i', inputPath, '-c', 'copy', '-movflags', '+faststart', '-y', outPath];
      try {
        await execFileAsync(ffmpegPath, args, { timeout: 300000 });
      } catch (err) {
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

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="cortes.zip"`);
    fs.createReadStream(zipPath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor de cortes escuchando en http://localhost:${PORT}`);
});