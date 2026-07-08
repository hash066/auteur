import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { MotionStoryboard, Shot } from "@motion-director/core";

export interface MotionDirectorVideoProps {
  storyboard: MotionStoryboard;
}

export function MotionDirectorVideo({ storyboard }: MotionDirectorVideoProps): React.ReactElement {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#f4f1ea", fontFamily: "Arial, Helvetica, sans-serif" }}>
      {storyboard.shots.map((shot, index) => (
        <Sequence key={`${shot.type}-${shot.start}`} from={Math.round(shot.start * fps)} durationInFrames={Math.max(1, Math.round((shot.end - shot.start) * fps))}>
          <ShotScene shot={shot} index={index} product={storyboard.product.name} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

function ShotScene({ shot, index, product }: { shot: Shot; index: number; product: string }): React.ReactElement {
  if (shot.type === "typography_hook") {
    return <TypographyHook lines={shot.text ?? [product.toUpperCase()]} />;
  }

  if (shot.type === "mcp_tools") {
    return <McpTools shot={shot} />;
  }

  if (shot.type === "proof_montage") {
    return <ProofMontage shot={shot} />;
  }

  if (shot.type === "end_card") {
    return <TypographyHook lines={shot.text ?? [product]} light />;
  }

  return <ScreenShot shot={shot} index={index} />;
}

function TypographyHook({ lines, light = false }: { lines: string[]; light?: boolean }): React.ReactElement {
  const frame = useCurrentFrame();
  const bg = light ? "#ffffff" : "#090b12";
  const fg = light ? "#111111" : "#ffffff";
  return (
    <AbsoluteFill style={{ background: bg, color: fg, justifyContent: "center", padding: 110 }}>
      {lines.map((line, index) => {
        const visibleChars = Math.floor(interpolate(frame, [index * 14, index * 14 + 24], [0, line.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
        return (
          <div key={line} style={{ fontSize: index === 0 ? 110 : 48, fontWeight: 900, lineHeight: 1.05, color: index === 1 ? "#8b5cf6" : fg }}>
            {line.slice(0, visibleChars)}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function ScreenShot({ shot, index }: { shot: Shot; index: number }): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const push = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const scale = interpolate(push, [0, 1], [0.93, 1.14]);
  const rotate = interpolate(push, [0, 1], [index % 2 ? 0.7 : -0.7, index % 2 ? -0.4 : 0.4]);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #f7f9ff, #dff7f8)", overflow: "hidden" }}>
      {shot.preferredCapture ? (
        <Img
          src={shot.preferredCapture}
          style={{
            position: "absolute",
            width: "78%",
            left: "6%",
            top: "8%",
            border: "2px solid #111",
            boxShadow: "18px 20px 0 rgba(17,17,17,0.18)",
            transform: `scale(${scale}) rotate(${rotate}deg)`,
            transformOrigin: "58% 45%"
          }}
        />
      ) : (
        <FallbackScreen />
      )}
      <Callout lines={shot.sideCallout ?? []} side={index % 2 ? "left" : "right"} />
    </AbsoluteFill>
  );
}

function McpTools({ shot }: { shot: Shot }): React.ReactElement {
  const tools = ["status", "run_workload", "list_nodes", "list_devices", "wallet_balance", "caps_mint", "caps_attenuate", "caps_revoke", "caps_list", "conflicts_list", "conflicts_resolve", "metrics"];
  return (
    <AbsoluteFill style={{ background: "#ffffff", color: "#111", padding: 84 }}>
      <h1 style={{ fontSize: 64, margin: 0 }}>Cerberus MCP</h1>
      <h2 style={{ fontSize: 104, margin: "44px 0 24px" }}>tools/list returned 12</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22, width: "78%" }}>
        {tools.map((tool) => (
          <div key={tool} style={{ border: "2px solid #d8e0ec", borderRadius: 12, padding: 18, fontSize: 26 }}>
            <span style={{ color: "#7c3aed", marginRight: 12 }}>●</span>cerberus_{tool}
          </div>
        ))}
      </div>
      <Callout lines={shot.sideCallout ?? []} side="right" />
    </AbsoluteFill>
  );
}

function ProofMontage({ shot }: { shot: Shot }): React.ReactElement {
  const frame = useCurrentFrame();
  const word = shot.words?.[Math.floor(frame / 16) % (shot.words.length || 1)] ?? "PROVE";
  const capture = shot.preferredCaptures?.find(Boolean);
  return (
    <AbsoluteFill style={{ background: "#eef7f8" }}>
      {capture ? <Img src={capture} style={{ width: "82%", margin: "5% auto", border: "2px solid #111", transform: "rotate(-0.5deg)" }} /> : <FallbackScreen />}
      <div style={{ position: "absolute", left: 80, bottom: 96, background: "rgba(255,255,255,0.88)", border: "2px solid #111", padding: "30px 42px", fontSize: 86, fontWeight: 900 }}>{word}</div>
    </AbsoluteFill>
  );
}

function Callout({ lines, side }: { lines: string[]; side: "left" | "right" }): React.ReactElement | null {
  if (!lines.length) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 160,
        [side]: 70,
        width: 380,
        background: "rgba(255,255,255,0.9)",
        borderLeft: "8px solid #7c3aed",
        boxShadow: "0 18px 40px rgba(15,23,42,0.16)",
        padding: 24
      }}
    >
      <div style={{ color: "#7c3aed", fontWeight: 900, fontSize: 20 }}>{lines[0]}</div>
      <div style={{ fontWeight: 900, fontSize: 44, marginTop: 10 }}>{lines[1]}</div>
      <div style={{ fontSize: 24, marginTop: 8 }}>{lines.slice(2).join(" · ")}</div>
    </div>
  );
}

function FallbackScreen(): React.ReactElement {
  return <div style={{ margin: "9% auto", width: "78%", height: "70%", background: "#fff", border: "2px solid #111", boxShadow: "18px 20px 0 rgba(17,17,17,0.18)" }} />;
}
