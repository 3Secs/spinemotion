import type { CaptureMode } from "../types/pose";

/**
 * Engineering configuration for SpineMotion 2.0.
 *
 * IMPORTANT: every threshold below is an engineering heuristic chosen for a
 * browser demo. None of them is a clinically validated cut-off. They live in
 * one place so the research team can review and tune them explicitly.
 */

export const APP_NAME = "SpineMotion 2.0";
export const APP_SUBTITLE = "Interactive & Trustworthy Human Motion Lab";

export const CAPTURE_CONFIG = {
  /** Supported inference rates (decoupled from the display refresh rate). */
  targetFpsOptions: [10, 12, 15] as const,
  defaultTargetFps: 12,
  camera: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  },
  /** Pose Landmarker runs in single-person mode. */
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
} as const;

export const QUALITY_THRESHOLDS = {
  /** A point is drawn / counted when its visibility reaches this value. */
  landmarkVisible: 0.35,
  /** Stricter visibility requirement for the eight key body joints. */
  keyJointVisible: 0.5,
  /** At least this many of the eight key joints must be visible. */
  minVisibleKeyJoints: 5,
  /** Show the “pose lost” warning only after this grace period. */
  lostPoseGraceMs: 600,
  /** UI metrics refresh cadence; rendering itself is not React-driven. */
  uiUpdateIntervalMs: 250,
  /** FPS display requires at least this much observation time. */
  fpsWarmupMs: 500,
} as const;

export const ENGINEERING_NOTE =
  "以上为工程启发式阈值，仅用于交互演示与质量控制原型，不是临床验证标准。";

export interface JointRequirementGroup {
  label: string;
  indices: readonly number[];
}

export interface CaptureModeDefinition {
  label: string;
  labelZh: string;
  description: string;
  rule: string;
  requiredGroups: readonly JointRequirementGroup[];
  displayIndices: readonly number[];
}

/**
 * Upper Body is intended for seated / close-camera work and for future
 * Motion Ghost / Motion Arena recordings that do not require the lower body.
 * Full Body additionally requires head, hips, knees and ankles in frame.
 */
export const CAPTURE_MODES: Record<CaptureMode, CaptureModeDefinition> = {
  "upper-body": {
    label: "Upper Body",
    labelZh: "上半身",
    description: "肩 / 肘 / 腕 / 躯干",
    rule: "肩、肘、腕至少各一个关键点稳定可见；下肢不计入要求，预览只绘制上半身骨架。",
    requiredGroups: [
      { label: "肩部", indices: [11, 12] },
      { label: "肘部", indices: [13, 14] },
      { label: "腕部", indices: [15, 16] },
    ],
    displayIndices: [11, 12, 13, 14, 15, 16, 23, 24],
  },
  "full-body": {
    label: "Full Body",
    labelZh: "全身",
    description: "头 / 肩 / 髋 / 膝 / 踝",
    rule: "头部、肩部、髋部、膝部、踝/足部均需稳定可见并位于画面内。",
    requiredGroups: [
      { label: "头部", indices: [0, 7, 8] },
      { label: "肩部", indices: [11, 12] },
      { label: "髋部", indices: [23, 24] },
      { label: "膝部", indices: [25, 26] },
      { label: "踝/足部", indices: [27, 28, 31, 32] },
    ],
    displayIndices: [0, 11, 12, 23, 24, 25, 26, 27, 28],
  },
};

export const CAPTURE_MODE_OPTIONS: readonly CaptureMode[] = [
  "upper-body",
  "full-body",
];
export const DEFAULT_CAPTURE_MODE: CaptureMode = "upper-body";

export const GHOST_CONFIG = {
  defaultDurationSec: 8,
  minDurationSec: 5,
  maxDurationSec: 15,
  countdownSeconds: 3,
  /** Do not linearly interpolate across inference gaps longer than this. */
  maxInterpolationGapMs: 250,
  /** Hold the nearest valid frame for at most this long, then show a gap. */
  maxHoldMs: 400,
  defaultOpacity: 0.55,
  minOpacity: 0.15,
  maxOpacity: 0.9,
  maxLibraryActions: 8,
  previewMaxWidth: 960,
} as const;

export const POSE_MODEL_PATH = "models/pose_landmarker_lite.task";
export const MEDIAPIPE_WASM_PATH = "wasm";

/** MediaPipe Pose landmark indices. */
export const LANDMARK_NAMES = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
] as const;

export const LANDMARK_LABELS_ZH = [
  "鼻尖",
  "左眼内角",
  "左眼",
  "左眼外角",
  "右眼内角",
  "右眼",
  "右眼外角",
  "左耳",
  "右耳",
  "左嘴角",
  "右嘴角",
  "左肩",
  "右肩",
  "左肘",
  "右肘",
  "左腕",
  "右腕",
  "左小指",
  "右小指",
  "左食指",
  "右食指",
  "左拇指",
  "右拇指",
  "左髋",
  "右髋",
  "左膝",
  "右膝",
  "左踝",
  "右踝",
  "左足跟",
  "右足跟",
  "左足尖",
  "右足尖",
] as const;

export const KEY_JOINT_INDICES = [11, 12, 23, 24, 25, 26, 27, 28] as const;

export type PoseConnectionGroup =
  | "face"
  | "torso"
  | "leftArm"
  | "rightArm"
  | "leftLeg"
  | "rightLeg";

export interface PoseConnection {
  from: number;
  to: number;
  group: PoseConnectionGroup;
}

export const POSE_CONNECTIONS: readonly PoseConnection[] = [
  { from: 0, to: 1, group: "face" },
  { from: 1, to: 2, group: "face" },
  { from: 2, to: 3, group: "face" },
  { from: 3, to: 7, group: "face" },
  { from: 0, to: 4, group: "face" },
  { from: 4, to: 5, group: "face" },
  { from: 5, to: 6, group: "face" },
  { from: 6, to: 8, group: "face" },
  { from: 9, to: 10, group: "face" },
  { from: 11, to: 12, group: "torso" },
  { from: 11, to: 23, group: "torso" },
  { from: 12, to: 24, group: "torso" },
  { from: 23, to: 24, group: "torso" },
  { from: 11, to: 13, group: "leftArm" },
  { from: 13, to: 15, group: "leftArm" },
  { from: 15, to: 17, group: "leftArm" },
  { from: 15, to: 19, group: "leftArm" },
  { from: 15, to: 21, group: "leftArm" },
  { from: 17, to: 19, group: "leftArm" },
  { from: 12, to: 14, group: "rightArm" },
  { from: 14, to: 16, group: "rightArm" },
  { from: 16, to: 18, group: "rightArm" },
  { from: 16, to: 20, group: "rightArm" },
  { from: 16, to: 22, group: "rightArm" },
  { from: 18, to: 20, group: "rightArm" },
  { from: 23, to: 25, group: "leftLeg" },
  { from: 25, to: 27, group: "leftLeg" },
  { from: 27, to: 29, group: "leftLeg" },
  { from: 27, to: 31, group: "leftLeg" },
  { from: 29, to: 31, group: "leftLeg" },
  { from: 24, to: 26, group: "rightLeg" },
  { from: 26, to: 28, group: "rightLeg" },
  { from: 28, to: 30, group: "rightLeg" },
  { from: 28, to: 32, group: "rightLeg" },
  { from: 30, to: 32, group: "rightLeg" },
];

export const CONNECTION_COLORS: Record<PoseConnectionGroup, string> = {
  torso: "#55e6d8",
  face: "rgba(148, 180, 255, 0.62)",
  leftArm: "#ffc46b",
  rightArm: "#a78bfa",
  leftLeg: "#ffc46b",
  rightLeg: "#a78bfa",
};
