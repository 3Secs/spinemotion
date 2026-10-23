import { POSE_CONNECTIONS, QUALITY_THRESHOLDS } from "../../config/constants";

export interface SkeletonRenderConfig {
  color: string;
  glowColor: string;
  opacity: number;
  upperBodyOnly: boolean;
  /** Indices to highlight (e.g. selected joint). */
  highlightIndices?: readonly number[];
  /** If true, draw only key joints (shoulders, hips, knees, ankles). */
  keyJointsOnly?: boolean;
}

interface DrawPoint {
  x: number;
  y: number;
  visibility: number;
}

/** Draw a single skeleton with configurable color and highlights. */
export function renderSkeleton(
  ctx: CanvasRenderingContext2D,
  points: readonly (DrawPoint | null | undefined)[] | null,
  width: number,
  height: number,
  config: SkeletonRenderConfig,
): void {
  if (!points || width <= 0 || height <= 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const unit = Math.max(0.75, width / 720);
  const threshold = QUALITY_THRESHOLDS.landmarkVisible;
  const highlight = new Set(config.highlightIndices ?? []);

  const visible = (i: number): DrawPoint | null => {
    const p = points[i];
    if (!p) return null;
    if (p.visibility < threshold) return null;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return p;
  };

  // Connections
  for (const conn of POSE_CONNECTIONS) {
    if (config.upperBodyOnly && (conn.group === "leftLeg" || conn.group === "rightLeg")) continue;
    if (config.keyJointsOnly && conn.group === "face") continue;
    const a = visible(conn.from);
    const b = visible(conn.to);
    if (!a || !b) continue;

    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.strokeStyle = config.color;
    ctx.globalAlpha = config.opacity * (conn.group === "face" ? 0.4 : 0.75);
    ctx.lineWidth = (conn.group === "face" ? 1.5 : 3.4) * unit;
    ctx.shadowColor = config.glowColor;
    ctx.shadowBlur = 8 * unit;
    ctx.stroke();
  }

  // Points
  for (let i = 0; i < points.length; i += 1) {
    if (config.upperBodyOnly && i >= 25) continue;
    if (config.keyJointsOnly && !isKeyJoint(i)) continue;
    const p = visible(i);
    if (!p) continue;
    const x = p.x * width;
    const y = p.y * height;
    const isHighlight = highlight.has(i);
    const isKey = isKeyJoint(i);
    const radius = (isHighlight ? 7 : isKey ? 4.8 : 3.2) * unit;

    ctx.beginPath();
    ctx.arc(x, y, radius + 2.4 * unit, 0, Math.PI * 2);
    ctx.globalAlpha = config.opacity * 0.9;
    ctx.fillStyle = "rgba(7, 24, 35, 0.72)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.globalAlpha = config.opacity;
    ctx.fillStyle = isHighlight ? "#ffd166" : config.color;
    ctx.shadowColor = isHighlight ? "#ffd166" : config.glowColor;
    ctx.shadowBlur = isHighlight ? 14 * unit : 10 * unit;
    ctx.fill();
  }

  ctx.restore();
}

function isKeyJoint(index: number): boolean {
  return index === 11 || index === 12 || index === 23 || index === 24 ||
    index === 25 || index === 26 || index === 27 || index === 28;
}
