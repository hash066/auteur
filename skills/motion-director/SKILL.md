---
name: motion-director
description: Generate cinematic product launch films and reusable motion storyboards/API jobs from local repositories, real screen recordings, screenshots, audio references, and product docs. Use when asked to create a launch video, beat-sync product demo, Cursorful-style screen motion, motion typography, or a Motion Director API/skill workflow.
---

# Motion Director

Use this skill to turn a product repo plus real screen captures into a cinematic launch film plan or render job.

## Workflow

1. Analyze the local repo first. Read high-signal product docs such as `README.md`, architecture docs, user docs, and feature docs.
2. Collect real visual proof: screenshots, screen recordings, or browser captures. Use real UI as the hero surface.
3. Ask for music/vibe only if the user has not provided it.
4. Build a storyboard with:
   - first 3-4 seconds as a sharp typography hook,
   - real screen motion immediately after the hook,
   - quick focal zooms around clicks,
   - side callouts that never cover dense UI text,
   - proof shots for GPU/VRAM, audio devices, MCP tools, metrics, workload execution, and wallet/credits when available.
5. Send the job to Motion Director:
   - Endpoint: `POST /api/v1/generate-launch-film`
   - Header: `Authorization: Bearer $MOTION_DIRECTOR_API_KEY`
   - Body: product/repo context, captures, reference videos, audio, vibe, duration, and render preference.
6. If rendering locally, use beat detection from the chosen audio and compose with Remotion or the local compositor.
7. Verify the final MP4: duration, resolution, audio stream, intro, middle, MCP/tools, and finale frames.

## Quality Bar

- Make the viewer feel it is their screen moving, not an AI mockup.
- Prefer edited screen-recording motion over abstract fake UI.
- Use one clear text idea per beat.
- Never write large text on top of UI text.
- Do not mindlessly scroll.
- Use fast zoom-in/zoom-out moves.
- Show all MCP tools if the product claim is a tool count.
- Keep side typography minimal: label, headline, one or two proof lines.

## References

- For endpoint shape, read `references/api-contract.md`.
- For motion/design rules, read `references/style-system.md`.

## Script

Use `scripts/call_motion_director_api.py` to submit a launch-film job to the API without rewriting request code.
