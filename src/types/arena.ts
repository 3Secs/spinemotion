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

/** A named anatomical joint group used for comparison. */
export interface JointGroup {
  label: string;
  labelZh: string;
  /** Landmark indices belonging to this group. */
  indices: readonly number[];
}

/** Per-joint DTW difference after alignment. */
export interface JointDifference {
  landmarkIndex: number;
  label: string;
  labelZh: string;
  /** Mean Euclidean distance (normalized space) across aligned frame pairs. */
  meanDistance: number;
  /** Maximum distance observed. */
  maxDistance: number;
  /** Number of contributing frame pairs. */
  sampleCount: number;
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

/** Timing and rhythm analysis between reference and imitation. */
export interface ArenaTimingMetrics {
  /** Reference actual duration (ms). */
  refDurationMs: number;
  /** Imitation actual duration (ms). */
  imitDurationMs: number;
  /** Absolute duration difference (ms). */
  absoluteDiffMs: number;
  /** Relative duration difference (0 = identical). */
  relativeDiff: number;
  /**
   * Rhythm similarity in [0,1]: how closely the two speed profiles match after
   * being resampled to a common axis. 1 = identical rhythm.
   */
  rhythmSimilarity: number;
  /** Whether a meaningful motion cycle was detected in either action. */
  hasRhythm: boolean;
  /** Human-readable basis note for transparency. */
  note: string;
}

/** A time segment with the largest aligned pose error. */
export interface KeyMoment {
  /** Reference-relative start time (ms). */
  startMs: number;
  /** Reference-relative end time (ms). */
  endMs: number;
  /** Mean normalized distance in this segment. */
  meanDistance: number;
  /** Peak normalized distance in this segment. */
  peakDistance: number;
}

/** Quality gate outcome, kept separate from scores. */
export interface ArenaQualityResult {
  /** false → scoring refused; use reasons to explain why. */
  acceptable: boolean;
  reasons: string[];
  /** Non-blocking notes for human review. */
  reviewNotes: string[];
}

/** Final, fully explained Arena scoring result. */
export interface ArenaScore {
  /** Pose trajectory similarity, 0–100. */
  poseSimilarity: number;
  /** Timing + rhythm similarity, 0–100. */
  timingSimilarity: number;
  /** Weighted overall match, 0–100. */
  overallMatch: number;
  /** Joint differences sorted by meanDistance (descending). */
  jointDifferences: JointDifference[];
  /** The largest-error time segments (up to 3). */
  keyMoments: KeyMoment[];
  /** Quality gate result (independent of the numeric scores). */
  quality: ArenaQualityResult;
  /** Deterministic formula/basis explanation for transparency. */
  explanation: string;
}

/** Prepared pair after normalization + DTW, before scoring. */
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