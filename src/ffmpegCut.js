import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegRef = null;
let loaded = false;

export async function loadFFmpeg(onProgress) {
  if (loaded && ffmpegRef) return ffmpegRef;
  const ffmpeg = new FFmpeg();
  ffmpegRef = ffmpeg;
  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress) onProgress(progress);
  });
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  loaded = true;
  return ffmpeg;
}

export async function cutVideoSingle(file, timeSecs, durationSecs, outputName, onProgress) {
  const ffmpeg = await loadFFmpeg(onProgress);
  const inputName = 'input.mp4';
  const outputNameClean = (outputName || 'corte') + '.mp4';
  await ffmpeg.writeFile(inputName, await fetchFile(file));
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
  await ffmpeg.writeFile(inputName, await fetchFile(file));
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
