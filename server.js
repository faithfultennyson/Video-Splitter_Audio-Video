const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.SPLITTER_API_KEY || 'change-me';
const FF_BINARY = process.env.FFMPEG_PATH || 'ffmpeg';
const CLEANUP_DELAY_MS = 30 * 60 * 1000;

const TMP_DIR = path.join(__dirname, 'tmp');
const OUTPUT_DIR = path.join(__dirname, 'jobs');
fs.mkdirSync(TMP_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const app = express();
app.use(morgan('dev'));
app.use('/jobs', express.static(OUTPUT_DIR, { fallthrough: false }));

function requireKey(req, res, next) {
  if (!API_KEY) return next();
  const provided = req.get('x-api-key') || req.query.key;
  if (provided !== API_KEY) {
    return res.status(401).json({ error: 'invalid-api-key', code: 'INVALID_API_KEY' });
  }
  next();
}

const storage = multer.diskStorage({
  destination: TMP_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.mp4';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

function fileFilter(_req, file, cb) {
  if (!file.mimetype || !file.mimetype.startsWith('video/')) {
    const err = new Error('Only video files are allowed');
    err.code = 'INVALID_FILE_TYPE';
    return cb(err);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 800 * 1024 * 1024
  }
});

function safeBaseName(input, fallback) {
  const cleaned = (input || '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const ff = spawn(FF_BINARY, args, { stdio: ['ignore', 'inherit', 'pipe'] });
    let stderr = '';
    ff.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    ff.on('error', reject);
    ff.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
      }
    });
  });
}

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', ffmpeg: 'required on PATH' });
});

app.post('/split', requireKey, upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'missing-file', code: 'MISSING_FILE', hint: 'send multipart/form-data with field "video"' });
  }

  const jobId = uuidv4();
  const jobDir = path.join(OUTPUT_DIR, jobId);
  await fsp.mkdir(jobDir, { recursive: true });

  const baseName = safeBaseName(path.parse(req.file.originalname || '').name, `job-${jobId}`);
  const visualFile = `${baseName}-visual-muted.mp4`;
  const audioFile = `${baseName}-audio-black.mp4`;
  const visualPath = path.join(jobDir, visualFile);
  const audioPath = path.join(jobDir, audioFile);

  let audioAvailable = true;
  let note = null;

  try {
    await runFFmpeg(['-y', '-i', req.file.path, '-c:v', 'copy', '-an', visualPath]);

    try {
      await runFFmpeg([
        '-y',
        '-i', req.file.path,
        '-f', 'lavfi',
        '-i', 'color=c=black:s=640x360:r=30',
        '-shortest',
        '-map', '1:v:0',
        '-map', '0:a:0',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '30',
        '-c:a', 'aac',
        '-b:a', '128k',
        audioPath
      ]);
    } catch (audioErr) {
      audioAvailable = false;
      note = 'Input file has no audio track; only visual output generated.';
      console.warn('[split] audio proxy skipped:', audioErr.message || audioErr);
      await fsp.unlink(audioPath).catch(() => {});
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json({
      status: 'ok',
      jobId,
      downloads: {
        visual: `${baseUrl}/jobs/${jobId}/${visualFile}`,
        audio: audioAvailable ? `${baseUrl}/jobs/${jobId}/${audioFile}` : null
      },
      audioAvailable,
      note
    });

    setTimeout(async () => {
      try {
        await fs.promises.rm(jobDir, { recursive: true, force: true });
        console.log(`[cleanup] removed job ${jobId}`);
      } catch (cleanupErr) {
        console.warn(`[cleanup] failed for job ${jobId}:`, cleanupErr);
      }
    }, CLEANUP_DELAY_MS);
  } catch (err) {
    console.error('[split] ffmpeg failed:', err);
    res.status(500).json({ error: 'ffmpeg-failed', code: 'FFMPEG_FAILED', detail: err.message });
  } finally {
    await fsp.unlink(req.file.path).catch(() => {});
  }
});

app.use((err, _req, res, _next) => {
  if (err) {
    console.error('[server] error:', err);
    const code = err.code === 'INVALID_FILE_TYPE' ? 'INVALID_FILE_TYPE' : 'BAD_REQUEST';
    return res.status(400).json({ error: err.message || 'bad-request', code });
  }
});

app.listen(PORT, () => {
  console.log(`VideoSplitter listening on http://localhost:${PORT}`);
});
