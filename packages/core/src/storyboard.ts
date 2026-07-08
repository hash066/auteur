import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaptureAsset, MotionDirectorRequest, MotionStoryboard, ProductAnalysis, Shot } from "./schema.js";

const DOC_CANDIDATES = [
  "README.md",
  "ARCHITECTURE.md",
  "VISION-AND-ROADMAP.md",
  "docs/user-guide.md",
  "docs/mcp.md",
  "docs/gpu.md",
  "docs/gateway.md",
  "docs/cli.md"
];

export function normalizeCaptures(input: MotionDirectorRequest["captures"] = []): CaptureAsset[] {
  return input.map((capture) => {
    if (typeof capture === "string") {
      return {
        path: capture,
        name: capture.split(/[\\/]/).pop() ?? capture,
        kind: "screen"
      };
    }
    return {
      ...capture,
      name: capture.name ?? capture.path.split(/[\\/]/).pop() ?? capture.path,
      kind: capture.kind ?? "screen"
    };
  });
}

export function analyzeProduct(request: MotionDirectorRequest): ProductAnalysis {
  const root = request.repoPath ? resolve(request.repoPath) : undefined;
  const docs: string[] = [];

  if (root) {
    for (const rel of DOC_CANDIDATES) {
      const path = resolve(root, rel);
      if (existsSync(path)) {
        docs.push(readFileSync(path, "utf8").slice(0, 7000));
      }
    }
  }

  const corpus = docs.join("\n").toLowerCase();
  const name = request.productName ?? (corpus.includes("cerberus") ? "Cerberus" : root?.split(/[\\/]/).pop() ?? "Product");
  const signalPairs: Array<[string, string]> = [
    ["zero-trust", "zero-trust"],
    ["capability", "capability-gated"],
    ["mcp", "MCP tools"],
    ["gpu", "GPU/VRAM"],
    ["vram", "GPU/VRAM"],
    ["audio", "audio devices"],
    ["wasm", "WASM workloads"],
    ["mesh", "mesh control"],
    ["metrics", "local telemetry"],
    ["wallet", "compute credits"]
  ];
  const signals = [...new Set(signalPairs.filter(([needle]) => corpus.includes(needle)).map(([, label]) => label))];

  const summary =
    name.toLowerCase() === "cerberus" || corpus.includes("distributed hypervisor")
      ? "Zero-trust distributed hypervisor for multi-agent orchestration: capability-gated local devices, mesh workloads, MCP tools, and local proof."
      : firstUsefulSentence(docs.join("\n")) ??
        "A product with real interface proof, workflow evidence, and a launch story that should feel like it runs on the viewer's machine.";

  return { name, summary, signals };
}

export function buildStoryboard(request: MotionDirectorRequest): MotionStoryboard {
  const product = analyzeProduct(request);
  const captures = normalizeCaptures(request.captures);
  const duration = clamp(request.durationSeconds ?? 28, 18, 45);
  const vibe = request.vibe ?? "mysterious premium tech, precise beat cuts, real screen motion";
  const referenceStyle = request.referenceStyle ?? "Cursorful-like focal zooms with side callouts";
  const shots = buildShots(product.name, duration, captures, product.signals);

  return {
    jobId: jobId(product.name, request),
    createdAt: Math.floor(Date.now() / 1000),
    product,
    creativeDirection: {
      vibe,
      referenceStyle,
      promise: "Make the viewer feel the product is running on their machine, not floating in an AI mockup.",
      nonNegotiables: [
        "Use real screen captures as the hero surface.",
        "Never place large text over UI text.",
        "Use quick zoom-in/zoom-out camera pushes, not slow side-to-side slides.",
        "Cut and pulse motion on detected beats.",
        "Prefer side callouts with minimal words.",
        "Show real proof moments when available."
      ]
    },
    audio: {
      source: request.audio?.path ?? request.audio?.libraryId ?? "auto",
      strategy: "Detect onset peaks, snap scene cuts to strong beats, add micro-zooms on secondary beats."
    },
    motionLanguage: {
      camera: "screen-recording illusion with edited focal zooms",
      easing: "cubic ease-in-out for pans; faster ease-out for click zooms",
      transitionPalette: ["white flash", "circle wipe", "tilt push", "beat-cut word card"],
      cursor: "visible only near clicks; click ring expands for 0.32s"
    },
    shots,
    assets: {
      captures,
      referenceVideos: request.referenceVideos ?? [],
      outputDir: "jobs"
    },
    render: {
      requested: Boolean(request.render),
      profile: request.renderProfile ?? "manifest-first",
      outputName: request.outputName ?? `${slug(product.name)}-launch.mp4`
    }
  };
}

function buildShots(product: string, duration: number, captures: CaptureAsset[], signals: string[]): Shot[] {
  const names = captures.map((capture) => `${capture.name ?? ""} ${capture.path}`.toLowerCase());
  const pick = (needle: string) => captures.find((capture, index) => names[index]?.includes(needle))?.path ?? null;
  const has = (needle: string) => Boolean(pick(needle));
  const end = duration;

  const shots: Shot[] = [
    {
      start: 0,
      end: Math.min(4, end),
      type: "typography_hook",
      text: [product.toUpperCase(), "still renting the machine?"],
      motion: "letter-by-letter black-screen type, then circle flash into live screen"
    },
    {
      start: 4,
      end: Math.min(7.2, end),
      type: "real_screen",
      preferredCapture: pick("overview") ?? pick("dashboard"),
      sideCallout: ["MESH STATUS", "Daemon up", "local control surface"],
      motion: "fast push into dashboard, slight tilt, zoom out on beat"
    },
    {
      start: 7.2,
      end: Math.min(10.2, end),
      type: "real_screen",
      preferredCapture: pick("devices") ?? pick("gpu"),
      sideCallout: ["GPU / VRAM", "Device cap", "/cer/dev/vram/local/0"],
      motion: "cursor appears only for click; callout pops on beat",
      requiredIfAvailable: has("devices") || signals.includes("GPU/VRAM")
    },
    {
      start: 10.2,
      end: Math.min(12.9, end),
      type: "real_screen",
      preferredCapture: pick("audio"),
      sideCallout: ["AUDIO I/O", "Local endpoints", "mic + speaker by cap"],
      motion: "quick pan from device row to side callout",
      requiredIfAvailable: has("audio") || signals.includes("audio devices")
    },
    {
      start: 12.9,
      end: Math.min(16, end),
      type: "real_screen",
      preferredCapture: pick("workloads") ?? pick("run"),
      sideCallout: ["WORKLOADS", "Run locally", "gateway:8080"],
      motion: "click zoom, hold for legibility, hard beat-cut out"
    },
    {
      start: 16,
      end: Math.min(20.5, end),
      type: "mcp_tools",
      sideCallout: ["MCP", "12 tools", "capability-gated"],
      motion: "show all tools on screen; side callout must not cover the main heading"
    },
    {
      start: 20.5,
      end: Math.min(end - 2, end),
      type: "proof_montage",
      preferredCaptures: [pick("metrics"), pick("wallet"), pick("conflicts")],
      words: ["LOCAL", "GPU", "AUDIO", "RUN", "PROVE"],
      motion: "one word per beat over real UI, never over dense text"
    },
    {
      start: Math.max(end - 2, 0),
      end,
      type: "end_card",
      text: [product, "your machine is the control plane"],
      motion: "snap to final product screen, logo/title lockup"
    }
  ];

  return shots.filter((shot) => shot.start < shot.end);
}

function firstUsefulSentence(text: string): string | undefined {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized
    .split(/(?<=[.!?])\s+/)
    .find((sentence) => sentence.length >= 50 && sentence.length <= 220 && !sentence.startsWith("#"));
}

function jobId(product: string, request: MotionDirectorRequest): string {
  return createHash("sha1").update(JSON.stringify({ product, request, now: Date.now() })).digest("hex").slice(0, 12);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
