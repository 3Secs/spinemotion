import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  CAPTURE_CONFIG,
  MEDIAPIPE_WASM_PATH,
  POSE_MODEL_PATH,
} from "../config/constants";
import type { ActiveDelegate, DelegateMode } from "../types/pose";

export interface PoseEngine {
  landmarker: PoseLandmarker;
  activeDelegate: ActiveDelegate;
  fallbackNote: string | null;
  requestedMode: DelegateMode;
}

function assetUrl(relativePath: string): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.href);
  return new URL(relativePath, base).href;
}

function shortError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Load MediaPipe entirely from local assets. "auto" prefers WebGL GPU and
 * falls back to CPU when the browser cannot create a GPU delegate.
 */
export async function createPoseEngine(mode: DelegateMode): Promise<PoseEngine> {
  const wasmRoot = assetUrl(`${MEDIAPIPE_WASM_PATH}/`);
  const modelPath = assetUrl(POSE_MODEL_PATH);

  let fileset;
  try {
    fileset = await FilesetResolver.forVisionTasks(wasmRoot);
  } catch (error) {
    throw new Error(
      `MediaPipe WASM 运行时加载失败（${shortError(error)}）。请确认 public/wasm 存在并重新启动开发服务器。`,
    );
  }

  const build = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate,
      },
      runningMode: "VIDEO",
      numPoses: CAPTURE_CONFIG.numPoses,
      minPoseDetectionConfidence: CAPTURE_CONFIG.minPoseDetectionConfidence,
      minPosePresenceConfidence: CAPTURE_CONFIG.minPosePresenceConfidence,
      minTrackingConfidence: CAPTURE_CONFIG.minTrackingConfidence,
    });

  if (mode === "cpu") {
    try {
      const landmarker = await build("CPU");
      return {
        landmarker,
        activeDelegate: "CPU",
        fallbackNote: null,
        requestedMode: mode,
      };
    } catch (error) {
      throw new Error(
        `Pose Landmarker 模型加载失败（CPU，${shortError(error)}）。请检查 public/models/pose_landmarker_lite.task 是否存在。`,
      );
    }
  }

  try {
    const landmarker = await build("GPU");
    return {
      landmarker,
      activeDelegate: "GPU",
      fallbackNote: null,
      requestedMode: mode,
    };
  } catch (gpuError) {
    if (mode === "gpu") {
      throw new Error(
        `GPU delegate 创建失败（${shortError(gpuError)}）。请把推理模式切换为“自动”或“CPU”后重试。`,
      );
    }

    try {
      const landmarker = await build("CPU");
      return {
        landmarker,
        activeDelegate: "CPU",
        fallbackNote: `GPU 初始化失败，已自动回退 CPU：${shortError(gpuError)}`,
        requestedMode: mode,
      };
    } catch (cpuError) {
      throw new Error(
        `GPU 与 CPU 两种推理模式均加载失败。CPU 错误：${shortError(cpuError)}`,
      );
    }
  }
}

export type PoseLandmark = NormalizedLandmark;
