/**
 * compositeVideo.js
 * Overlay de trail de tracking sobre un Blob de vídeo cortado.
 * Usado por App.jsx: compositeVideoWithOverlay(blob, trailData)
 * trailData = { points: [{x,y,time,videoTime,bbox:[x,y,w,h]}], cutStartSecs, duration, videoTimeOffset }
 */

export async function compositeVideoWithOverlay(videoBlob, trailData) {
  if (!videoBlob) throw new Error('No se proporcionó vídeo');
  if (!trailData || !Array.isArray(trailData.points) || trailData.points.length < 2) {
    return videoBlob;
  }

  const points = trailData.points;
  const cutStart = Number(trailData.cutStartSecs ?? 0);
  const duration = Number(trailData.duration ?? 5);
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return videoBlob;
  }

  const hasVideoTime = points.some((p) => typeof p.videoTime === 'number' && !Number.isNaN(p.videoTime));

  let relevant = points;
  let useVideoTime = false;
  if (hasVideoTime) {
    const filtered = points.filter(
      (p) => typeof p.videoTime === 'number' && p.videoTime >= cutStart - 0.5 && p.videoTime <= cutStart + duration + 0.5
    );
    if (filtered.length >= 2) {
      relevant = filtered;
      useVideoTime = true;
    }
  }

  const videoUrl = URL.createObjectURL(videoBlob);

  let video = null;
  let canvas = null;
  let stream = null;
  let recorder = null;

  try {
    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    // Offscreen but attached to DOM so playback + captureStream works in all browsers
    video.style.position = 'fixed';
    video.style.left = '0px';
    video.style.top = '0px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0.01';
    video.style.pointerEvents = 'none';
    video.src = videoUrl;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('No se pudo cargar el vídeo para compositar'));
      // timeout
      setTimeout(() => reject(new Error('Timeout cargando vídeo')), 10000);
    });

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    if (!w || !h) return videoBlob;

    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.style.position = 'fixed';
    canvas.style.left = '0px';
    canvas.style.top = '0px';
    canvas.style.width = '1px';
    canvas.style.height = '1px';
    canvas.style.opacity = '0.01';
    canvas.style.pointerEvents = 'none';

    document.body.appendChild(video);
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return videoBlob;

    const mimeProbe = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mime = mimeProbe.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

    stream = canvas.captureStream(30);
    const chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3500000 });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };

    // Draw helpers — same colours as tracking preview (#38bdf8 trail, #22c55e bbox)
    const drawOverlay = (visible) => {
      if (!visible || visible.length === 0) return;
      // scale: points are already in videoWidth/Height space when canvas == videoWidth/Height.
      // If points were stored scaled differently (e.g. capped), clamp.
      // Detect if points x out of [0,w] but within [0,1] normalized
      const isNormalized = visible.every((p) => p.x >= 0 && p.x <= 1.5 && p.y >= 0 && p.y <= 1.5);
      const sx = isNormalized ? w : 1;
      const sy = isNormalized ? h : 1;

      if (visible.length > 1) {
        for (let i = 1; i < visible.length; i++) {
          const alpha = 0.3 + 0.7 * (i / visible.length);
          ctx.beginPath();
          ctx.moveTo(visible[i - 1].x * sx, visible[i - 1].y * sy);
          ctx.lineTo(visible[i].x * sx, visible[i].y * sy);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.lineWidth = Math.max(3, w * 0.005);
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }
      const last = visible[visible.length - 1];
      if (last && Array.isArray(last.bbox) && last.bbox.length >= 4) {
        const bx = last.bbox[0] * (isNormalized ? w : 1);
        const by = last.bbox[1] * (isNormalized ? h : 1);
        const bw = last.bbox[2] * (isNormalized ? w : 1);
        const bh = last.bbox[3] * (isNormalized ? h : 1);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = Math.max(3, w * 0.004);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.fillRect(bx, by, bw, bh);
      }
    };

    const getVisible = (cutTime) => {
      if (useVideoTime) {
        const abs = cutStart + cutTime;
        // include points whose videoTime <= abs (+ small hysteresis)
        const idx = relevant.findLastIndex((p) => p.videoTime <= abs + 0.05);
        if (idx < 0) return [];
        // when videoTime jumps, we may want at least 2 points if tracking started slightly before cut
        return relevant.slice(0, idx + 1);
      }
      // fallback: linear progress based on cut time and wall time delta
      // use Date.now delta if available to keep 2s trail feel; otherwise linear over duration
      const hasWall = relevant[0] && typeof relevant[0].time === 'number';
      if (hasWall && duration > 0) {
        // trail lasts ~2s wall; map wall span to cut duration proportionally
        const t0 = relevant[0].time;
        const t1 = relevant[relevant.length - 1].time;
        const wallSpan = Math.max(1, t1 - t0);
        // cutTime 0 -> t0, cutTime duration -> t1, but clamp to wallSpan/ duration
        const wallNow = t0 + (cutTime / duration) * wallSpan;
        let idx = relevant.findLastIndex((p) => p.time <= wallNow);
        if (idx < 0) idx = Math.floor((cutTime / duration) * relevant.length);
        if (idx < 0) idx = 0;
        return relevant.slice(0, Math.max(1, idx + 1));
      }
      const n = Math.ceil((cutTime / Math.max(0.1, duration)) * relevant.length);
      return relevant.slice(0, Math.max(1, Math.min(relevant.length, n)));
    };

    let rafId = 0;
    let finished = false;
    let recordingDone = null;
    const recordingPromise = new Promise((resolve) => {
      recordingDone = resolve;
    });
    recorder.onstop = () => recordingDone();

    const stop = () => {
      if (finished) return;
      finished = true;
      if (rafId) cancelAnimationFrame(rafId);
      try {
        if (recorder && recorder.state === 'recording') recorder.stop();
      } catch {}
      try {
        video.pause();
      } catch {}
      stream?.getTracks().forEach((t) => t.stop());
    };

    // animation loop: draw video frame + overlay each frame
    const loop = () => {
      if (finished) return;
      try {
        ctx.drawImage(video, 0, 0, w, h);
      } catch {}
      const ct = video.currentTime || 0;
      const visible = getVisible(ct);
      if (visible.length >= 1) drawOverlay(visible);
      rafId = requestAnimationFrame(loop);
    };

    // handle ended / error
    video.addEventListener('ended', stop);
    video.addEventListener('error', stop);

    recorder.start(100);
    loop();
    // must play after recorder start to capture first frames
    try {
      video.currentTime = 0;
      await video.play();
    } catch {
      // autoplay blocked without user gesture: try muted play again
      try {
        await video.play();
      } catch (e) {
        stop();
      }
    }

    // safety timeout: duration + 5s max
    const timeoutMs = (duration + 4) * 1000 + 5000;
    const timeout = setTimeout(stop, timeoutMs);

    // wait until recorder stopped (video ended)
    await recordingPromise;
    clearTimeout(timeout);
    if (rafId) cancelAnimationFrame(rafId);

    if (chunks.length === 0) return videoBlob;

    const outBlob = new Blob(chunks, { type: mime });
    // if produced blob is empty / too small, fallback to original
    if (outBlob.size < 1024) return videoBlob;
    return outBlob;
  } catch (e) {
    console.warn('[compositeVideo] fallback a blob original:', e);
    return videoBlob;
  } finally {
    URL.revokeObjectURL(videoUrl);
    try {
      if (video && video.parentNode) video.parentNode.removeChild(video);
    } catch {}
    try {
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    } catch {}
    try {
      stream?.getTracks().forEach((t) => t.stop());
    } catch {}
  }
}

// alias por si se usaba nombre composer
export const composerWithOverlay = compositeVideoWithOverlay;
export default compositeVideoWithOverlay;
