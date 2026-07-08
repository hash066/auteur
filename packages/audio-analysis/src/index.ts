import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { syntheticBeatMap, type Beat, type BeatMap } from "@motion-director/core";

export interface AnalyzeAudioOptions {
  path?: string;
  durationSeconds?: number;
  ffmpegPath?: string;
  sampleRate?: number;
}

export function analyzeAudio(options: AnalyzeAudioOptions): BeatMap {
  const duration = options.durationSeconds ?? 28;
  if (!options.path || !existsSync(options.path)) {
    return syntheticBeatMap(duration, 124);
  }

  const ffmpeg = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? "ffmpeg";
  const sampleRate = options.sampleRate ?? 22050;
  const decoded = spawnSync(ffmpeg, [
    "-v",
    "error",
    "-i",
    options.path,
    "-t",
    String(duration),
    "-f",
    "f32le",
    "-ac",
    "1",
    "-ar",
    String(sampleRate),
    "pipe:1"
  ]);

  if (decoded.status !== 0 || !decoded.stdout.length) {
    return syntheticBeatMap(duration, 124);
  }

  const floats = new Float32Array(decoded.stdout.buffer, decoded.stdout.byteOffset, Math.floor(decoded.stdout.byteLength / 4));
  return onsetBeatMap(floats, sampleRate, duration);
}

function onsetBeatMap(samples: Float32Array, sampleRate: number, duration: number): BeatMap {
  const hop = 512;
  const frame = 2048;
  const windows = Math.max(0, Math.floor((samples.length - frame) / hop));
  const energy: number[] = [];

  for (let i = 0; i < windows; i += 1) {
    let sum = 0;
    const offset = i * hop;
    for (let j = 0; j < frame; j += 1) {
      const value = samples[offset + j] ?? 0;
      sum += value * value;
    }
    energy.push(Math.sqrt(sum / frame));
  }

  const onset = energy.map((value, index) => Math.max(0, value - (energy[index - 1] ?? value)));
  const max = Math.max(...onset, 0.0001);
  const normalized = onset.map((value) => value / max);
  const threshold = percentile(normalized, 0.82);
  const beats: Beat[] = [];
  let last = -Infinity;

  for (let i = 2; i < normalized.length - 2; i += 1) {
    const local = normalized.slice(i - 2, i + 3);
    const strength = normalized[i] ?? 0;
    const time = (i * hop) / sampleRate;
    if (strength >= threshold && strength === Math.max(...local) && time - last > 0.22) {
      beats.push({ time: round(time), strength: round(Math.max(0.45, strength)) });
      last = time;
    }
  }

  if (beats.length < 8) {
    return syntheticBeatMap(duration, 124);
  }

  const gaps = beats.slice(1).map((beat, index) => beat.time - beats[index]!.time).filter((gap) => gap > 0.25 && gap < 1);
  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / Math.max(1, gaps.length);
  const bpmEstimate = Math.round(60 / avgGap);
  return {
    duration,
    bpmEstimate: Number.isFinite(bpmEstimate) ? bpmEstimate : 124,
    beats,
    cutPoints: beats.filter((beat) => beat.strength >= 0.72).map((beat) => beat.time)
  };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * p)] ?? 0.2;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
