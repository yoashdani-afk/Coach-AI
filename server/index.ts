import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { handleAnalyseVideo } from './api/analyse-video.js';
import { handleTrackPlayerPreview } from './api/track-player-preview.js';
import { handleDebugPlayerFrame } from './api/debug-player-frame.js';
import { GEMINI_MODELS_LIST_ENDPOINT } from './lib/geminiLogger.js';
import { warmupModelDiscovery } from './lib/geminiModelResolver.js';

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
  });
});

app.post('/api/analyse-video', upload.single('video'), (req, res) => {
  void handleAnalyseVideo(req, res);
});

app.post('/api/track-player-preview', upload.single('video'), (req, res) => {
  void handleTrackPlayerPreview(req, res);
});

if (process.env.NODE_ENV !== 'production') {
  app.post('/api/debug-player-frame', upload.single('video'), (req, res) => {
    void handleDebugPlayerFrame(req, res);
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Coach AI analysis server listening on http://0.0.0.0:${PORT}`);

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
