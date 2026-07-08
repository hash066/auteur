import { buildStoryboard } from "./index.js";

const storyboard = buildStoryboard({
  productName: "Cerberus",
  repoPath: "../../..",
  durationSeconds: 28,
  captures: [
    "examples/cerberus/captures/overview.png",
    "examples/cerberus/captures/devices.png",
    "examples/cerberus/captures/audio.png",
    "examples/cerberus/captures/metrics.png"
  ]
});

if (storyboard.shots.length < 6) {
  throw new Error("Expected at least 6 shots");
}

console.log(JSON.stringify({ ok: true, jobId: storyboard.jobId, shots: storyboard.shots.length }, null, 2));
