import type { GhostAction } from "./ghost";

/** Result of checking whether two GhostAction records can be compared. */
export interface ArenaCompatibilityCheck {
  compatible: boolean;
  reasons: string[];
  warnings: string[];
}

/** A single step in the DTW alignment path. */
export interface DtwStep {
  /** Index into sequence A (reference). */
  i: number;
  /** Index into sequence B (imitation). */
  j: number;
}

/** Aggregate DTW result for two time series. */
export interface DtwResult {
  /** Alignment path (reference-index → imitation-index pairs). */
  path: DtwStep[];
  /** Normalized accumulated cost (total / path length), in normalized units. */
  normalizedCost: number;
  /** Number of frame pairs in the alignment path. */
  pathLength: number;
}

/** Per-joint DTW difference after alignment. */
export interface JointDifference {
  landmarkIndex: number;
  /** Mean Euclidean distance (normalized space) across aligned frame pairs. */
  meanDistance: number;
  /** Maximum distance observed. */
  maxDistance: number;
}

/** Normalized landmark set used internally by the alignment pipeline. */
export interface NormalizedPose {
  /** Normalized x (origin at body anchor, unit = torso length). */
  nx: number;
  /** Normalized y. */
  ny: number;
  /** Original z (depth) unchanged — MediaPipe z is only for completeness, not normalised. */
  z: number;
  visibility: number;
}

/** One normalized frame from a GhostAction. */
export interface NormalizedFrame {
  timestampMs: number;
  landmarks: NormalizedPose[] | null;
}

/** Prepared pair after normalization, ready for DTW. */
export interface ArenaPreparedPair {
  reference: GhostAction;
  imitation: GhostAction;
  /** Normalized reference frames (only valid frames retained). */
  refFrames: NormalizedFrame[];
  /** Normalized imitation frames. */
  imitFrames: NormalizedFrame[];
  /** The DTW alignment between them. */
  alignment: DtwResult;
  /** Per-joint differences after alignment. */
  jointDiffs: JointDifference[];
}