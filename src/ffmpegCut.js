import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpegRef = null;
let loaded = false;

export async function loadFFmpeg(onProgress) {
  if (loaded && ffmpegRef) return ffmpegRef;
  const ffmpeg = new FFmpeg();
  ffmpegRef = ffmpeg;
  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress) onProgress(progress);
  });
  const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
  });
  loaded = true;
  return ffmpeg;
}

function readFileAsUint8Array(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

const MAX_BROWSER_SIZE = 2 * 1024 * 1024 * 1024;

export function isBrowserCutSupported(file) {
  return file && file.size <= MAX_BROWSER_SIZE;
}

export async function cutVideoSingle(file, timeSecs, durationSecs, outputName, onProgress) {
  const ffmpeg = await loadFFmpeg(onProgress);
  const inputName = 'input.mp4';
  const outputNameClean = (outputName || 'corte') + '.mp4';
  const fileData = await readFileAsUint8Array(file);
  await ffmpeg.writeFile(inputName, fileData);
  const parts = String(timeSecs).split(':').map(Number);
  const startSecs = (parts[0] || 0) * 60 + (parts[1] || 0);
  await ffmpeg.exec(['-ss', String(startSecs), '-t', String(durationSecs), '-i', inputName, '-c', 'copy', '-movflags', '+faststart', '-y', outputNameClean]);
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
    await ffmpeg.exec(['-ss', String(startSecs), '-t', String(duracion), '-i', inputName, '-c', 'copy', '-movflags', '+faststart', '-y', outName]);
    const data = await ffmpeg.readFile(outName);
    results.push({ name: (corte.name || 'corte') + '.mp4', blob: new Blob([data.buffer], { type: 'video/mp4' }) });
    await ffmpeg.deleteFile(outName);
    if (onProgress) onProgress((i + 1) / cortes.length);
  }
  await ffmpeg.deleteFile(inputName);
  return results;
}
