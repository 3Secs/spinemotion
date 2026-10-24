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

/** Sync a canvas backing store to its CSS display size × devicePixelRatio. */
function syncCanvasPixels(cv: HTMLCanvasElement) {
  const rect = cv.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
  return true;
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

  // Keep canvas backing store in sync with CSS display size (DPR-aware).
  // CSS owns the layout (grid columns / aspect-ratio); JS only resizes the
  // internal pixel buffer so skeletons are never blurry or stretched.
  useEffect(() => {
    const canvases = [refCanvasRef.current, imitCanvasRef.current, overlayCanvasRef.current].filter(
      (c): c is HTMLCanvasElement => c !== null,
    );
    if (canvases.length === 0) return;
    const resize = () => {
      for (const cv of canvases) syncCanvasPixels(cv);
    };
    resize();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(resize);
    for (const cv of canvases) ro.observe(cv);
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
        syncCanvasPixels(rc);
        const ctx = rc.getContext("2d");
        if (ctx) drawSkeletonToCtx(ctx, frame.refLandmarks, rc.width, rc.height, REF_COLOR, REF_GLOW, 1, upperBody, hl, keyOnly, showLabels);
      }
      if (ic) {
        syncCanvasPixels(ic);
        const ctx = ic.getContext("2d");
        if (ctx) drawSkeletonToCtx(ctx, frame.imitLandmarks, ic.width, ic.height, IMIT_COLOR, IMIT_GLOW, 1, upperBody, hl, keyOnly, showLabels);
      }
    } else {
      const oc = overlayCanvasRef.current;
      if (oc) {
        syncCanvasPixels(oc);
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
  }, [pb.frame, view, pb.selectedJoint, upperBody, keyOnly, showLabels]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!pb.frame || !pb.frame.refLandmarks) return;
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const ex = (e.clientX - rect.left) / rect.width;
      const ey = (e.clientY - rect.top) / rect.height;
      const landmarks = pb.frame.refLandmarks;
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
    },
    [pb],
  );

  const formatTime = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

  return (
    <div className="visual-compare">
      {/* Row 1: canvas stage */}
      {!actionA || !actionB ? (
        <div className="vc-empty">完成评分后可查看动作对比。</div>
      ) : view === "side" ? (
        <div className="vc-canvases vc-side">
          <div className="vc-canvas-box">
            <canvas ref={refCanvasRef} className="vc-canvas" onClick={handleCanvasClick} />
            <span className="vc-label" style={{ color: REF_COLOR }}>● 玩家 A · 参考</span>
          </div>
          <div className="vc-canvas-box">
            <canvas ref={imitCanvasRef} className="vc-canvas" onClick={handleCanvasClick} />
            <span className="vc-label" style={{ color: IMIT_COLOR }}>● 玩家 B · 复刻</span>
          </div>
        </div>
      ) : (
        <div className="vc-canvases vc-overlay-box">
          <canvas ref={overlayCanvasRef} className="vc-canvas vc-canvas-overlay" onClick={handleCanvasClick} />
          <div className="vc-overlay-legend">
            <span style={{ color: REF_COLOR }}>● 玩家 A</span>
            <span style={{ color: IMIT_COLOR }}>● 玩家 B</span>
          </div>
        </div>
      )}

      {/* Row 2: unified playback controls, grouped */}
      <div className="vc-toolbar">
        {/* A. Playback */}
        <div className="vc-group vc-group-play" aria-label="播放控制">
          <button className="btn btn-icon" onClick={pb.restart} title="回到开头" aria-label="回到开头">⏮</button>
          <button
            className="btn btn-play"
            onClick={pb.playing ? pb.pause : pb.play}
            title={pb.playing ? "暂停" : "播放"}
            aria-label={pb.playing ? "暂停" : "播放"}
          >
            {pb.playing ? "⏸" : "▶"}
          </button>
          <span className="vc-time">{pb.frame && actionA ? formatTime(Math.max(pb.frame.refTimeMs, pb.frame.imitTimeMs)) : "0.0s"}</span>
        </div>

        <div className="vc-scrub-wrap">
          <input className="vc-scrubber" type="range" min={0} max={1} step={0.001} value={pb.progress} onChange={(e) => pb.seek(Number(e.target.value))} aria-label="播放进度" />
        </div>

        {/* B. Speed */}
        <div className="vc-group" aria-label="播放速度">
          <span className="vc-group-label">速度</span>
          {([0.5, 1, 1.5] as const).map((sp) => (
            <button
              key={sp}
              className={`vc-seg ${pb.speed === sp ? "is-on" : ""}`}
              onClick={() => pb.setSpeed(sp)}
            >
              {sp}×
            </button>
          ))}
        </div>

        {/* C. View */}
        <div className="vc-group" aria-label="显示方式">
          <span className="vc-group-label">显示</span>
          <button className={`vc-seg ${view === "side" ? "is-on" : ""}`} onClick={() => setView("side")}>并排</button>
          <button className={`vc-seg ${view === "overlay" ? "is-on" : ""}`} onClick={() => setView("overlay")}>重叠</button>
        </div>

        {/* D. Alignment mode */}
        <div className="vc-group" aria-label="分析方式">
          <span className="vc-group-label">对齐</span>
          <button className={`vc-seg ${pb.mode === "original" ? "is-on" : ""}`} onClick={pb.toggleMode}>原始时序</button>
          <button className={`vc-seg ${pb.mode === "dtw" ? "is-on" : ""}`} onClick={pb.toggleMode}>DTW 对齐</button>
        </div>

        {/* E. Optional overlays */}
        <div className="vc-group" aria-label="可选显示">
          <span className="vc-group-label">标注</span>
          <button className={`vc-seg ${keyOnly ? "is-on" : ""}`} onClick={() => setKeyOnly(!keyOnly)}>关键关节</button>
          <button className={`vc-seg ${showLabels ? "is-on" : ""}`} onClick={() => setShowLabels(!showLabels)}>解剖标注</button>
        </div>
      </div>
    </div>
  );
}