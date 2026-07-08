export type CaptureKind = "screen" | "browser" | "desktop" | "terminal" | "image";

export interface CaptureAsset {
  name?: string;
  path: string;
  kind?: CaptureKind;
  label?: string;
}

export interface AudioSource {
  path?: string;
  libraryId?: string;
  provider?: "deepgram" | "local" | "uploaded" | "auto";
}

export interface MotionDirectorRequest {
  repoPath?: string;
  appUrl?: string;
  githubUrl?: string;
  productName?: string;
  durationSeconds?: number;
  vibe?: string;
  referenceStyle?: string;
  captures?: Array<CaptureAsset | string>;
  referenceVideos?: string[];
  audio?: AudioSource;
  render?: boolean;
  renderProfile?: "manifest-first" | "remotion" | "python-compositor";
  outputName?: string;
  tier?: "open-source" | "starter" | "creator" | "pro" | "enterprise";
}

export interface ProductAnalysis {
  name: string;
  summary: string;
  signals: string[];
}

export interface Shot {
  start: number;
  end: number;
  type:
    | "typography_hook"
    | "real_screen"
    | "mcp_tools"
    | "proof_montage"
    | "end_card";
  text?: string[];
  preferredCapture?: string | null;
  preferredCaptures?: Array<string | null>;
  sideCallout?: string[];
  words?: string[];
  motion: string;
  requiredIfAvailable?: boolean;
}

export interface MotionStoryboard {
  jobId: string;
  createdAt: number;
  product: ProductAnalysis;
  creativeDirection: {
    vibe: string;
    referenceStyle: string;
    promise: string;
    nonNegotiables: string[];
  };
  audio: {
    source: string;
    strategy: string;
  };
  motionLanguage: {
    camera: string;
    easing: string;
    transitionPalette: string[];
    cursor: string;
  };
  shots: Shot[];
  assets: {
    captures: CaptureAsset[];
    referenceVideos: string[];
    outputDir: string;
  };
  render: {
    requested: boolean;
    profile: string;
    outputName: string;
  };
}

export interface Beat {
  time: number;
  strength: number;
}

export interface BeatMap {
  duration: number;
  bpmEstimate: number;
  beats: Beat[];
  cutPoints: number[];
}

export interface TierDefinition {
  id: string;
  name: string;
  monthlyUsd: number;
  includedRenders: number;
  includedAudioMinutes: number;
  maxDurationSeconds: number;
  watermark: boolean;
  notes: string[];
}
