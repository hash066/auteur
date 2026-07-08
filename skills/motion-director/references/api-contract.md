# Motion Director API Contract

## Endpoint

`POST /api/v1/generate-launch-film`

## Authentication

Send `Authorization: Bearer $MOTION_DIRECTOR_API_KEY`.

For local development only, the API can set `MOTION_DIRECTOR_DEV_ALLOW_NO_AUTH=1`.

## Request

```json
{
  "repoPath": "E:/10w10p/Cerberus",
  "productName": "Cerberus",
  "durationSeconds": 28,
  "vibe": "mysterious premium tech, fast beat cuts",
  "referenceStyle": "Cursorful-like focal zooms with side callouts",
  "captures": ["examples/cerberus/captures/overview.png"],
  "referenceVideos": ["C:/Users/asus/Downloads/reference.mp4"],
  "audio": {"path": "music.mp3"},
  "render": false,
  "renderProfile": "manifest-first",
  "outputName": "cerberus-launch.mp4"
}
```

## Response

```json
{
  "status": "storyboard_ready",
  "jobId": "abc123",
  "storyboard": {
    "product": {},
    "creativeDirection": {},
    "audio": {},
    "motionLanguage": {},
    "shots": []
  }
}
```
