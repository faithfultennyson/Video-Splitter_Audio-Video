# VideoSplitter

Small Express server that accepts a video upload and produces two MP4s:

1. `<original>-visual-muted.mp4` - original frames with audio removed.
2. `<original>-audio-black.mp4` - solid black 640x360 video containing only the original audio (skipped if the source clip lacks audio).

The service relies on `ffmpeg` being installed on the host. Set `FFMPEG_PATH` if the binary is not on `PATH`.

## Running locally

```bash
cd VideoSplitter
npm install
set SPLITTER_API_KEY=super-secret
set FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe   # optional if ffmpeg is already on PATH
set PORT=8080                                  # optional
npm start
```

## API

### `POST /split`

- Authentication: send `x-api-key: <value>` header that matches `SPLITTER_API_KEY`.
- Body: `multipart/form-data` with field `video`.
- Response: JSON containing job id, download URLs, and an `audioAvailable` flag.

Example cURL (local):

```bash
curl -X POST \
  -H "x-api-key: super-secret" \
  -F "video=@sample.mp4;type=video/mp4" \
  http://localhost:8080/split
```

Example cURL (deployed):

```bash
curl -X POST \
  -H "x-api-key: <your_api_key>" \
  -F "video=@sample.mp4;type=video/mp4" \
  https://video-splitter-audio-video.onrender.com/split
```

Response:

```json
{
  "status": "ok",
  "jobId": "1d0b1fb7-7c2a-4c7e-afd5-32f1f60d24c9",
  "downloads": {
    "visual": "http://localhost:8080/jobs/1d0b1fb7-7c2a-4c7e-afd5-32f1f60d24c9/sample-visual-muted.mp4",
    "audio": "http://localhost:8080/jobs/1d0b1fb7-7c2a-4c7e-afd5-32f1f60d24c9/sample-audio-black.mp4"
  },
  "audioAvailable": true,
  "note": null
}
```

If the upload contains no audio, `audioAvailable` becomes `false`, `downloads.audio` is `null`, and `note` explains why.

Generated files live under `VideoSplitter/jobs/<jobId>/` and are automatically deleted 30 minutes after creation.

### `GET /jobs/:jobId/:file`

Static hosting for the generated MP4s. URLs are returned in the `POST /split` response.

### `GET /healthz`

Simple readiness probe.

## Notes

- `SPLITTER_API_KEY` defaults to `u8wd172309n9d0!h7^##@&*tww4` in the current server, but you should always set `SPLITTER_API_KEY` to a strong secret in production (do not rely on the hardcoded default).
- `FFMPEG_PATH` can point directly to the ffmpeg binary (useful on Windows/Render). Otherwise the server calls `ffmpeg` from `PATH`.
- Output filenames inherit the upload name (sanitized).
- Generated job folders are removed after 30 minutes (`CLEANUP_DELAY_MS`).
- The upload limit is ~800MB (see `multer`'s `fileSize` limit). If deploying to hosted platforms, confirm max request size / timeouts and increase plan or use chunked uploads if needed.
- Error responses include `code` values (`INVALID_API_KEY`, `MISSING_FILE`, `INVALID_FILE_TYPE`, `FFMPEG_FAILED`, …) for easier client handling.

## Additional usage tips

### Docker / Render notes

A Dockerfile is included. For Render, use a Docker service (not the static Node environment). Ensure you set `SPLITTER_API_KEY` in Render environment variables and that the service has sufficient request body limits for large uploads.

**Live deployment URL**

- Primary API base: `https://video-splitter-audio-video.onrender.com`

Examples using the live deployment:

```powershell
# Health check
curl.exe https://video-splitter-audio-video.onrender.com/healthz

# Upload (PowerShell)
curl.exe -X POST -H 'x-api-key: <your_api_key>' -F 'video=@test-video.mp4;type=video/mp4' https://video-splitter-audio-video.onrender.com/split
```


### Example clients

Windows PowerShell (use curl.exe to avoid the Invoke-WebRequest alias and escaping issues):

```powershell
# from the directory containing the file
curl.exe -X POST -H "x-api-key: $env:SPLITTER_API_KEY" -F "video=@test-video.mp4;type=video/mp4" https://your-deploy-url/split
```

If curl.exe reports "Failed to open/read local data", cd into the file folder or use a forward-slash path (D:/path/file.mp4).

Git Bash / Linux:

```bash
curl -X POST \
  -H "x-api-key: super-secret" \
  -F "video=@/path/to/sample.mp4;type=video/mp4" \
  https://your-deploy-url/split
```

Downloading generated files (copy the returned `downloads.*` URL):

```bash
curl -o visual.mp4 "https://your-deploy-url/jobs/<jobId>/sample-visual-muted.mp4"
curl -o audio.mp4  "https://your-deploy-url/jobs/<jobId>/sample-audio-black.mp4"
```
