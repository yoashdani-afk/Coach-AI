import './lib/tracking/tfNodePolyfill.js';
import 'dotenv/config';
import { spawn } from 'node:child_process';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { handleAnalyseVideo } from './api/analyse-video.js';
import { handleCancelTrackPlayerPreview, handleConfirmTrackPlayerPreview, handleTrackPlayerPreview } from './api/track-player-preview.js';
import {
  handleCancelTrackingJob,
  handleCreateTrackingJob,
  handleGetTrackingJob,
  handleTrackingJobEvents,
} from './api/tracking-jobs.js';
import { handleDebugPlayerFrame } from './api/debug-player-frame.js';
import { handleVideoFrame } from './api/video-frame.js';
import { FFMPEG_PATH } from './lib/ffmpegPath.js';
import { GEMINI_MODELS_LIST_ENDPOINT } from './lib/geminiLogger.js';
import { warmupModelDiscovery } from './lib/geminiModelResolver.js';
import { warmupTrackingModels, getTrackingBackendName } from './lib/tracking/modelLoader.js';
import { getTrackingEngine, isBotsortEngine } from './lib/tracking/trackingEngine.js';
import { pingBotsortTracker } from './lib/tracking/botsortClient.js';

const PORT = Number(process.env.PORT ?? 3001);
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB ?? 80);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_MB * 1024 * 1024 },
});

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'coach-ai-analysis',
    trackingEngine: getTrackingEngine(),
    ffmpegPath: FFMPEG_PATH,
  });
});

/** Confirms system ffmpeg + libx264 are available (Railway diagnose). */
app.get('/health/ffmpeg', (_req, res) => {
  const stderr: Buffer[] = [];
  const proc = spawn(FFMPEG_PATH, ['-hide_banner', '-encoders']);
  proc.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
  proc.stdout.on('data', (chunk: Buffer) => stderr.push(chunk));
  proc.on('error', (err) => {
    res.status(500).json({
      ok: false,
      ffmpegPath: FFMPEG_PATH,
      error: err.message,
    });
  });
  proc.on('close', (code) => {
    const out = Buffer.concat(stderr).toString('utf8');
    const hasLibx264 = /\blibx264\b/.test(out);
    res.status(hasLibx264 ? 200 : 500).json({
      ok: hasLibx264,
      ffmpegPath: FFMPEG_PATH,
      exitCode: code,
      hasLibx264,
      versionLine: out.split('\n').find((l) => /ffmpeg version/i.test(l)) ?? null,
    });
  });
});

app.post('/api/analyse-video', upload.single('video'), (req, res) => {
  void handleAnalyseVideo(req, res);
});

app.post('/api/tracking/jobs', upload.single('video'), (req, res) => {
  void handleCreateTrackingJob(req, res);
});

app.get('/api/tracking/jobs/:jobId', (req, res) => {
  handleGetTrackingJob(req, res);
});

app.get('/api/tracking/jobs/:jobId/events', (req, res) => {
  handleTrackingJobEvents(req, res);
});

app.delete('/api/tracking/jobs/:jobId', (req, res) => {
  handleCancelTrackingJob(req, res);
});

app.post('/api/video/frame', upload.single('video'), (req, res) => {
  void handleVideoFrame(req, res);
});

app.post('/api/track-player-preview', upload.single('video'), (req, res) => {
  void handleTrackPlayerPreview(req, res);
});

app.delete('/api/track-player-preview/:jobId', (req, res) => {
  handleCancelTrackPlayerPreview(req, res);
});

app.post('/api/track-player-preview/:jobId/confirm', express.json(), (req, res) => {
  handleConfirmTrackPlayerPreview(req, res);
});

if (process.env.NODE_ENV !== 'production') {
  app.post('/api/debug-player-frame', upload.single('video'), (req, res) => {
    void handleDebugPlayerFrame(req, res);
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Coach AI analysis server listening on http://0.0.0.0:${PORT}`);
  console.log('[FFmpeg] path =', FFMPEG_PATH);
  console.log('[Tracking] Engine =', getTrackingEngine());

  if (isBotsortEngine()) {
    void pingBotsortTracker().then((ok) => {
      if (ok) {
        console.log('[Tracking] BoT-SORT service reachable');
      } else {
        console.warn(
          '[Tracking] BoT-SORT service not reachable — start tracker_service: python app.py'
        );
      }
    });
  } else {
    // Warmup must not crash the process — frame extract + analyse-video do not need TF.js.
    // Exit-on-failure caused Railway 502s when native bindings failed in Docker.
    void warmupTrackingModels()
      .then(() => {
        console.log('[Tracking] startup warmup complete, backend =', getTrackingBackendName());
      })
      .catch((error) => {
        console.error(
          '[Tracking] model warmup failed — custom tracking unavailable; analyse-video still runs.'
        );
        console.error(error instanceof Error ? error.message : error);
      });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const hasKey = Boolean(apiKey && apiKey !== 'PASTE_KEY_HERE');

  if (hasKey) {
    console.log('Gemini API key loaded from environment.');
    console.log(`[Gemini] Endpoint: ${GEMINI_MODELS_LIST_ENDPOINT} (model discovery on first request)`);
    void warmupModelDiscovery(apiKey!).then((model) => {
      if (model) {
        console.log(`[Gemini] Warmup resolved model: ${model}`);
      }
    });
  } else {
    console.log('WARNING: GEMINI_API_KEY is not set — analysis requests will fail.');
  }
});
