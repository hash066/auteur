# Motion Director

Motion Director turns real product screens into cinematic launch films. It ships as four surfaces:

- **Skill** for Codex, Claude, Cursor, and agent workflows.
- **MCP server** exposing tools such as storyboard generation, browser capture, audio analysis, and render-job creation.
- **Hosted/local API** for products, teams, billing, render queues, and credits.
- **Adapters** for Playwright capture, audio beat maps, and Remotion rendering.

The product principle is simple: make videos feel like the viewer's own screen is moving. Do not fake a dashboard when real captures exist.

## Repo Layout

```text
motion-director/
  apps/
    api/
    studio/
  packages/
    core/
    renderer-remotion/
    capture-playwright/
    audio-analysis/
    mcp-server/
  skills/
    motion-director/
  examples/
    cerberus/
```

## Quick Start

```bash
npm install
npm run build
npm run dev:api
```

Then open:

```text
http://localhost:3000
```

Generate a storyboard:

```bash
curl -X POST http://localhost:3000/api/v1/generate-launch-film \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MOTION_DIRECTOR_API_KEY" \
  -d @examples/cerberus/job.json
```

For local development without auth:

```bash
MOTION_DIRECTOR_DEV_ALLOW_NO_AUTH=1 npm run dev:api
```

## Vercel Deploy

Deploy from the repository root, not `apps/api`.

- Root Directory: leave blank / repo root
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `apps/studio/public`

The API routes are served from the root `api/` Vercel functions and reuse the same handler as the local server.

## Product Tiers

- **Open Source**: local skill, local API, BYO keys.
- **Starter**: hosted storyboards and basic beat maps.
- **Creator**: hosted render jobs, Playwright capture, audio analysis, no watermark.
- **Pro**: longer videos, brand kits, reference-video matching, priority queue.
- **Enterprise**: private workers, BYO cloud, SSO, no retention.

Keep provider usage metered. Do not spend your Deepgram, Gemini, or render credits on unlimited free users.
