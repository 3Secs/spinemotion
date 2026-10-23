import { KEY_JOINT_INDICES, LANDMARK_LABELS_ZH, POSE_CONNECTIONS, QUALITY_THRESHOLDS } from "../../config/constants";

export interface SkeletonRenderConfig {
  color: string;
  glowColor: string;
  opacity: number;
  upperBodyOnly: boolean;
  /** Indices to highlight (e.g. selected joint). */
  highlightIndices?: readonly number[];
  /** If true, draw only key joints (shoulders, hips, knees, ankles). */
  keyJointsOnly?: boolean;
  /** If true, draw Chinese anatomical labels next to key joints. */
  showLabels?: boolean;
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

  // Anatomical labels
  if (config.showLabels) {
    drawLabels(ctx, points, width, height, config);
  }

  ctx.restore();
}

function isKeyJoint(index: number): boolean {
  return (KEY_JOINT_INDICES as readonly number[]).includes(index);
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  points: readonly (DrawPoint | null | undefined)[],
  width: number,
  height: number,
  config: SkeletonRenderConfig,
): void {
  const unit = Math.max(0.75, width / 720);
  const threshold = QUALITY_THRESHOLDS.landmarkVisible;
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.font = `${Math.max(9, 11 * unit)}px ui-sans-serif, system-ui, "PingFang SC", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (const index of KEY_JOINT_INDICES as readonly number[]) {
    const p = points[index];
    if (!p) continue;
    if (p.visibility < threshold) continue;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const x = p.x * width;
    const y = p.y * height;
    const label = LANDMARK_LABELS_ZH[index];
    if (!label) continue;

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    const padX = 4 * unit;
    const padY = 3 * unit;
    const textW = ctx.measureText(label).width;
    ctx.fillRect(x + padX, y - padY - 6 * unit, textW + 2 * padX, 12 * unit + 2 * padY);
    ctx.fillStyle = config.color;
    ctx.globalAlpha = config.opacity * 0.95;
    ctx.fillText(label, x + padX + 2 * unit, y - padY);
  }
  ctx.globalAlpha = config.opacity;
}
