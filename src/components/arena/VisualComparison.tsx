import { useCallback, useEffect, useRef, useState } from "react";
import type { GhostAction } from "../../types/ghost";
import type { CaptureMode } from "../../types/pose";
import { useComparisonPlayback } from "../../hooks/useComparisonPlayback";
import { renderSkeleton } from "../../lib/arena/skeletonRender";
import type { NormPoint } from "../../lib/arena/arenaPlayback";

interface Props {
  actionA: GhostAction | null;
  actionB: GhostAction | null;
  captureMode: CaptureMode;
}

const REF_COLOR = "rgba(84, 220, 255, 1)";
const REF_GLOW = "#47d7ff";
const IMIT_COLOR = "rgba(255, 169, 90, 1)";
const IMIT_GLOW = "#ffa85a";

function drawSkeletonToCtx(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number; visibility: number }[] | null,
  width: number, height: number,
  color: string, glow: string, opacity: number,
  upperBody: boolean,
  highlight: readonly number[] = [],
  keyOnly = false,
  showLabels = false,
) {
  ctx.clearRect(0, 0, width, height);
  if (!points) return;
  renderSkeleton(ctx, points, width, height, {
    color, glowColor: glow, opacity, upperBodyOnly: upperBody, highlightIndices: highlight, keyJointsOnly: keyOnly, showLabels,
  });
}

export default function VisualComparison({ actionA, actionB, captureMode }: Props) {
  const refCanvasRef = useRef<HTMLCanvasElement>(null);
  const imitCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<"side" | "overlay">("side");
  const [keyOnly, setKeyOnly] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  const upperBody = captureMode === "upper-body";
  const pb = useComparisonPlayback(actionA, actionB);

  // Size the side-by-side canvases to the container (equal size, DPR-aware).
  // The grid container holds two equal columns; divide width by 2.
  useEffect(() => {
    if (view !== "side") return;
    const canvases = [refCanvasRef.current, imitCanvasRef.current];
    if (!canvases[0]) return;

    const container = canvases[0].parentElement?.parentElement;
    const resize = () => {
      const width = container?.clientWidth ?? 360;
      const dpr = window.devicePixelRatio || 1;
      // Each of the two grid columns gets half the container width (minus gap).
      const cssW = Math.max(120, Math.floor((width - 8) / 2));
      const cssH = Math.round(cssW * (3 / 2.2)); // portrait, ~1.37 aspect
      for (const cv of canvases) {
        if (!cv) continue;
        const drawW = Math.round(cssW * dpr);
        const drawH = Math.round(cssH * dpr);
        if (cv.width !== drawW || cv.height !== drawH) {
          cv.width = drawW;
          cv.height = drawH;
        }
        cv.style.width = `${cssW}px`;
        cv.style.height = `${cssH}px`;
      }
    };
    resize();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(resize);
    if (container) ro.observe(container);
    return () => ro.disconnect();
  }, [view]);

  // Render frame
  useEffect(() => {
    const frame = pb.frame;
    if (!frame) return;

    const hl = pb.selectedJoint !== null ? [pb.selectedJoint] : [];

    if (view === "side") {
      const rc = refCanvasRef.current;
      const ic = imitCanvasRef.current;
      if (rc) {
        const ctx = rc.getContext("2d");
        if (ctx) drawSkeletonToCtx(ctx, frame.refLandmarks, rc.width, rc.height, REF_COLOR, REF_GLOW, 1, upperBody, hl, keyOnly, showLabels);
      }
      if (ic) {
        const ctx = ic.getContext("2d");
        if (ctx) drawSkeletonToCtx(ctx, frame.imitLandmarks, ic.width, ic.height, IMIT_COLOR, IMIT_GLOW, 1, upperBody, hl, keyOnly, showLabels);
      }
    } else {
      const oc = overlayCanvasRef.current;
      if (oc) {
        const ctx = oc.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, oc.width, oc.height);
          // Overlap: both normalized skeletons centered in the same canvas.
          // Normalized nx goes approx [-0.5, +0.5], ny goes [-0.2, +1.2].
          // Map to center with margin.
          const mapNorm = (n: NormPoint) => ({
            x: (n.nx + 0.5) * 0.6 + 0.05,
            y: (n.ny + 0.2) * 0.7 + 0.05,
            visibility: n.visibility,
          });
          if (frame.refNorm) {
            renderSkeleton(ctx, frame.refNorm.map(mapNorm), oc.width, oc.height, {
              color: REF_COLOR, glowColor: REF_GLOW, opacity: 0.85, upperBodyOnly: upperBody, highlightIndices: hl, keyJointsOnly: keyOnly,
            });
          }
          if (frame.imitNorm) {
            renderSkeleton(ctx, frame.imitNorm.map(mapNorm), oc.width, oc.height, {
              color: IMIT_COLOR, glowColor: IMIT_GLOW, opacity: 0.85, upperBodyOnly: upperBody, highlightIndices: hl, keyJointsOnly: keyOnly,
            });
          }
        }
      }
    }
  }, [pb.frame, view, pb.selectedJoint, upperBody, keyOnly]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ex = (e.clientX - rect.left) / rect.width;
    const ey = (e.clientY - rect.top) / rect.height;
    const landmarks = pb.frame?.refLandmarks;
    if (!landmarks) return;
    let bestIdx: number | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < landmarks.length; i += 1) {
      const p = landmarks[i];
      const d = Math.sqrt((p.x - ex) ** 2 + (p.y - ey) ** 2);
      if (d < 0.05 && d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx !== null) {
      pb.setSelectedJoint(pb.selectedJoint === bestIdx ? null : bestIdx);
    }
  }, [pb]);

  const formatTime = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

  return (
    <div className="visual-compare">
      <div className="vc-toolbar">
        <div className="vc-controls">
          <button className="btn btn-icon btn-sm" onClick={pb.restart} title="重新播放">⏮</button>
          <button className="btn btn-icon btn-sm" onClick={pb.playing ? pb.pause : pb.play} title={pb.playing ? "暂停" : "播放"}>
            {pb.playing ? "⏸" : "▶"}
          </button>
          <span className="vc-time">{pb.frame && actionA ? formatTime(Math.max(pb.frame.refTimeMs, pb.frame.imitTimeMs)) : "0.0s"}</span>
        </div>
        <div className="vc-middle">
          <input className="vc-scrubber" type="range" min={0} max={1} step={0.001} value={pb.progress} onChange={(e) => pb.seek(Number(e.target.value))} />
        </div>
        <div className="vc-right">
          <select className="vc-select" value={pb.speed} onChange={(e) => pb.setSpeed(Number(e.target.value))}>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={1.5}>1.5×</option>
          </select>
          <button className={`btn btn-sm ${view === "side" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("side")}>并排</button>
          <button className={`btn btn-sm ${view === "overlay" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("overlay")}>重叠</button>
          <button className={`btn btn-sm ${keyOnly ? "btn-secondary" : "btn-ghost"}`} onClick={() => setKeyOnly(!keyOnly)}>
            {keyOnly ? "关键关节" : "完整骨架"}
          </button>
          <button className={`btn btn-sm ${showLabels ? "btn-secondary" : "btn-ghost"}`} onClick={() => setShowLabels(!showLabels)}>
            解剖标注
          </button>
          <button className={`btn btn-sm ${pb.mode === "original" ? "btn-secondary" : "btn-ghost"}`} onClick={pb.toggleMode}>
            {pb.mode === "original" ? "原始时序" : "DTW"}
          </button>
        </div>
      </div>

      {!actionA || !actionB ? (
        <div className="vc-empty">完成评分后可查看动作对比。</div>
      ) : view === "side" ? (
        <div className="vc-canvases vc-side">
          <div className="vc-canvas-box">
            <canvas ref={refCanvasRef} width={360} height={480} className="vc-canvas" onClick={handleCanvasClick} />
            <span className="vc-label" style={{ color: REF_COLOR }}>玩家 A · 参考</span>
          </div>
          <div className="vc-canvas-box">
            <canvas ref={imitCanvasRef} width={360} height={480} className="vc-canvas" onClick={handleCanvasClick} />
            <span className="vc-label" style={{ color: IMIT_COLOR }}>玩家 B · 复刻</span>
          </div>
        </div>
      ) : (
        <div className="vc-canvases vc-overlay-box">
          <canvas ref={overlayCanvasRef} width={720} height={480} className="vc-canvas" onClick={handleCanvasClick} />
          <div className="vc-overlay-legend">
            <span style={{ color: REF_COLOR }}>● 玩家 A</span>
            <span style={{ color: IMIT_COLOR }}>● 玩家 B</span>
          </div>
        </div>
      )}
    </div>
  );
}