import type { BeatMap } from "./schema.js";

export function syntheticBeatMap(duration: number, bpm = 124): BeatMap {
  const step = 60 / bpm;
  const beats = [];
  for (let time = 0.25; time < duration; time += step) {
    const barPulse = Math.round(time / step) % 4 === 0 ? 1 : 0.72;
    beats.push({ time: round(time), strength: barPulse });
  }
  return {
    duration,
    bpmEstimate: bpm,
    beats,
    cutPoints: beats.filter((beat) => beat.strength >= 0.9).map((beat) => beat.time)
  };
}

export function snapToBeat(time: number, beatMap: BeatMap, maxDistance = 0.18): number {
  let best = time;
  let bestDistance = maxDistance;
  for (const beat of beatMap.beats) {
    const distance = Math.abs(beat.time - time);
    if (distance < bestDistance) {
      best = beat.time;
      bestDistance = distance;
    }
  }
  return round(best);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
