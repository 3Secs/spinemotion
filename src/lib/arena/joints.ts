import type { CaptureMode } from "../../types/pose";
import type { JointGroup } from "../../types/arena";

/** Anatomical joint groups used for Arena comparison. */
export const JOINT_GROUPS: readonly JointGroup[] = [
  { label: "shoulder", labelZh: "肩部", indices: [11, 12] },
  { label: "elbow", labelZh: "肘部", indices: [13, 14] },
  { label: "wrist", labelZh: "腕部", indices: [15, 16] },
  { label: "hip", labelZh: "髋部", indices: [23, 24] },
  { label: "knee", labelZh: "膝部", indices: [25, 26] },
  { label: "ankle", labelZh: "踝部", indices: [27, 28] },
] as const;

const UPPER_BODY_GROUPS = new Set(["shoulder", "elbow", "wrist", "hip"]);
const FULL_BODY_GROUPS = new Set(["shoulder", "elbow", "wrist", "hip", "knee", "ankle"]);

/** Groups applicable to a capture mode. */
export function jointGroupsForMode(mode: CaptureMode): JointGroup[] {
  const allowed = mode === "upper-body" ? UPPER_BODY_GROUPS : FULL_BODY_GROUPS;
  return JOINT_GROUPS.filter((group) => allowed.has(group.label));
}

/** Flat list of landmark indices for a mode. */
export function jointIndicesForMode(mode: CaptureMode): number[] {
  return jointGroupsForMode(mode).flatMap((group) => [...group.indices]);
}

/** Look up a joint group by landmark index. */
export function groupForIndex(index: number): JointGroup | null {
  return JOINT_GROUPS.find((group) => group.indices.includes(index)) ?? null;
}