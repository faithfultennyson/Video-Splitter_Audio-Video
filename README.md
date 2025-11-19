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

Example cURL:

```bash
curl -X POST \
  -H "x-api-key: super-secret" \
  -F "video=@sample.mp4;type=video/mp4" \
  http://localhost:8080/split
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

- `SPLITTER_API_KEY` defaults to `change-me`; set it to a real secret in production.
- `FFMPEG_PATH` can point directly to the ffmpeg binary (useful on Windows/Render). Otherwise the server calls `ffmpeg` from `PATH`.
- Output filenames inherit the upload name (sanitized).
- Generated job folders are removed after 30 minutes (`CLEANUP_DELAY_MS`).
- The upload limit is ~800MB (see `multer`'s `fileSize` limit).
- Error responses include `code` values (`INVALID_API_KEY`, `MISSING_FILE`, `INVALID_FILE_TYPE`, `FFMPEG_FAILED`, …) for easier client handling.
