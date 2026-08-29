import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const baseURL = (import.meta.env.BASE_URL || '/') + 'ffmpeg';

let ffmpegRef = null;
let loaded = false;

export async function loadFFmpeg(onProgress) {
  if (loaded && ffmpegRef) return ffmpegRef;
  const ffmpeg = new FFmpeg();
  ffmpegRef = ffmpeg;
  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress) onProgress(progress);
  });
  const loadFrom = async (coreBase) => {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  };
  try {
    await loadFrom(baseURL);
  } catch (err) {
    console.warn('[ffmpeg] core local falló, usando CDN', err);
    await loadFrom('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm');
  }
  loaded = true;
  return ffmpeg;
}

async function readFileAsUint8Array(file) {
  const total = file && file.size ? file.size : 0;
  const sizeMB = (total / 1024 / 1024).toFixed(0);
  try {
    if (typeof file.arrayBuffer === 'function') {
      const buf = await file.arrayBuffer();
      return new Uint8Array(buf);
    }
  } catch (e) {
    console.warn('[ffmpeg] arrayBuffer falló, usando lectura por chunks', e);
  }
  const CHUNK = 256 * 1024 * 1024;
  const parts = [];
  let offset = 0;
  try {
    while (offset < total) {
      const end = Math.min(offset + CHUNK, total);
      const slice = file.slice(offset, end);
      const buf = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('lectura de chunk fallida'));
        reader.readAsArrayBuffer(slice);
      });
      parts.push(new Uint8Array(buf));
      offset = end;
    }
  } catch (e) {
    throw new Error('No se pudo leer el archivo (tamaño ' + sizeMB + ' MB). Motivo: ' + (e && e.message ? e.message : e));
  }
  let length = 0;
  for (const p of parts) length += p.length;
  const out = new Uint8Array(length);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

const MAX_BROWSER_SIZE = 2 * 1024 * 1024 * 1024;

export function isBrowserCutSupported(file) {
  return file && file.size <= MAX_BROWSER_SIZE;
}

export async function cutVideoSingle(file, timeSecs, durationSecs, outputName, onProgress) {
  if (!file) throw new Error('No se ha seleccionado ningún archivo de vídeo');
  if (file.size > MAX_BROWSER_SIZE) throw new Error(`El archivo es demasiado grande (${(file.size / 1024 / 1024 / 1024).toFixed(1)} GB) para el corte en navegador (máximo 2 GB de memoria wasm). Reduce/comprese el vídeo en la pestaña de vídeo o usa el servidor con: node server.js`);
  const ffmpeg = await loadFFmpeg(onProgress);
  const inputName = 'input.mp4';
  const outputNameClean = (outputName || 'corte') + '.mp4';
  const fileData = await readFileAsUint8Array(file);
  await ffmpeg.writeFile(inputName, fileData);
  const parts = String(timeSecs).split(':').map(Number);
  const startSecs = (parts[0] || 0) * 60 + (parts[1] || 0);
  const dur = Number.isFinite(durationSecs) ? durationSecs : 5;
  const logs = [];
  ffmpeg.on('log', ({ message }) => logs.push(message));
  const baseArgs = [
    '-ss', String(startSecs),
    '-t', String(dur),
    '-i', inputName,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
    '-movflags', '+faststart',
    '-y', outputNameClean
  ];
  try {
    await ffmpeg.exec([...baseArgs, '-c:a', 'aac']);
  } catch (e1) {
    try {
      await ffmpeg.exec([...baseArgs, '-an']);
    } catch (e2) {
      const tail = logs.slice(-8).join(' || ');
      throw new Error('ffmpeg falló (time=' + timeSecs + ', start=' + startSecs + 's, dur=' + dur + 's). ffmpeg: ' + (tail || e2.message || e2));
    }
  }
  const data = await ffmpeg.readFile(outputNameClean);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputNameClean);
  return new Blob([data.buffer], { type: 'video/mp4' });
}

export async function cutVideoMultiple(file, cortes, onProgress) {
  const ffmpeg = await loadFFmpeg(onProgress);
  const inputName = 'input.mp4';
  const fileData = await readFileAsUint8Array(file);
  await ffmpeg.writeFile(inputName, fileData);
  const results = [];
  for (let i = 0; i < cortes.length; i++) {
    const corte = cortes[i];
    const parts = String(corte.time).split(':').map(Number);
    const startSecs = (parts[0] || 0) * 60 + (parts[1] || 0);
    const duracion = corte.duracion ? Math.max(1, parseInt(corte.duracion, 10)) : 5;
    const outName = `corte_${i}.mp4`;
    try {
      await ffmpeg.exec(['-ss', String(startSecs), '-t', String(duracion), '-i', inputName, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', '-y', outName]);
    } catch (e1) {
      await ffmpeg.exec(['-ss', String(startSecs), '-t', String(duracion), '-i', inputName, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-movflags', '+faststart', '-an', '-y', outName]);
    }
    const data = await ffmpeg.readFile(outName);
    results.push({ name: (corte.name || 'corte') + '.mp4', blob: new Blob([data.buffer], { type: 'video/mp4' }) });
    await ffmpeg.deleteFile(outName);
    if (onProgress) onProgress((i + 1) / cortes.length);
  }
  await ffmpeg.deleteFile(inputName);
  return results;
}
