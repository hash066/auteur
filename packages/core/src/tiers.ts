import type { TierDefinition } from "./schema.js";

export const tiers: TierDefinition[] = [
  {
    id: "open-source",
    name: "Open Source",
    monthlyUsd: 0,
    includedRenders: 0,
    includedAudioMinutes: 0,
    maxDurationSeconds: 45,
    watermark: false,
    notes: ["Local skill and API", "BYO provider keys", "No hosted render credits"]
  },
  {
    id: "starter",
    name: "Starter",
    monthlyUsd: 19,
    includedRenders: 20,
    includedAudioMinutes: 60,
    maxDurationSeconds: 30,
    watermark: true,
    notes: ["Hosted storyboards", "Basic beat maps", "Watermarked renders"]
  },
  {
    id: "creator",
    name: "Creator",
    monthlyUsd: 49,
    includedRenders: 80,
    includedAudioMinutes: 240,
    maxDurationSeconds: 60,
    watermark: false,
    notes: ["Hosted Remotion rendering", "Playwright capture", "Audio analysis"]
  },
  {
    id: "pro",
    name: "Pro",
    monthlyUsd: 149,
    includedRenders: 350,
    includedAudioMinutes: 1200,
    maxDurationSeconds: 120,
    watermark: false,
    notes: ["Reference-video matching", "Brand kits", "Priority queue"]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyUsd: 0,
    includedRenders: -1,
    includedAudioMinutes: -1,
    maxDurationSeconds: 300,
    watermark: false,
    notes: ["Private workers", "BYO cloud", "SSO", "Custom retention"]
  }
];
