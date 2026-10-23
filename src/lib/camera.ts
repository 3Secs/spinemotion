import { CAPTURE_CONFIG } from "../config/constants";
import type { CaptureError } from "../types/pose";

export function cameraErrorToCaptureError(error: unknown): CaptureError {
  const name =
    error instanceof DOMException || error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);

  if (!window.isSecureContext) {
    return {
      code: "INSECURE_CONTEXT",
      title: "当前页面不是安全上下文",
      detail: "Chrome 只有在 localhost 或 HTTPS 页面中才允许访问摄像头。",
      hint: "请使用 http://127.0.0.1:5173 或 http://localhost:5173 打开应用，不要直接双击 HTML 文件。",
    };
  }

  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      code: "CAMERA_PERMISSION_DENIED",
      title: "摄像头权限被拒绝",
      detail: "浏览器或 macOS 阻止了摄像头访问，当前没有采集任何视频。",
      hint:
        "点击 Chrome 地址栏左侧的网站设置，将“摄像头”改为允许；再到 macOS 系统设置 → 隐私与安全性 → 摄像头，确认已允许 Google Chrome。修改后刷新页面。",
    };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      code: "CAMERA_NOT_FOUND",
      title: "没有找到可用摄像头",
      detail: "浏览器未能枚举到视频输入设备。",
      hint: "确认 Mac 内置摄像头或外接摄像头已连接，关闭占用摄像头的其他应用后重试。",
    };
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      code: "CAMERA_BUSY",
      title: "摄像头无法启动",
      detail: "系统报告摄像头被占用，或硬件暂时不可读。",
      hint: "退出正在使用摄像头的 Zoom、Teams、QuickTime 等应用，然后重新点击启动。",
    };
  }

  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return {
      code: "CAMERA_CONSTRAINT",
      title: "摄像头不支持请求的分辨率",
      detail: message || "无法满足 1280×720 的首选采集参数。",
      hint: "关闭其他占用摄像头的应用后重试；应用会自动使用设备可用的分辨率。",
    };
  }

  if (name === "AbortError") {
    return {
      code: "CAMERA_ABORTED",
      title: "摄像头启动被中断",
      detail: message || "设备启动流程被浏览器中止。",
      hint: "再次点击“启动摄像头”。如果重复出现，请重新连接摄像头或重启浏览器。",
    };
  }

  if (name === "NotSupportedError") {
    return {
      code: "CAMERA_UNSUPPORTED",
      title: "当前浏览器不支持摄像头采集",
      detail: "navigator.mediaDevices.getUserMedia 不可用。",
      hint: "请使用最新版 Google Chrome，并通过 http://127.0.0.1:5173 打开应用。",
    };
  }

  return {
    code: "CAMERA_UNKNOWN",
    title: "摄像头启动失败",
    detail: message || "未知的摄像头错误。",
    hint: "确认浏览器版本为最新，并检查 macOS 的摄像头隐私权限后重试。",
  };
}

export function modelErrorToCaptureError(error: unknown): CaptureError {
  return {
    code: "MODEL_LOAD_FAILED",
    title: "姿态模型加载失败",
    detail: error instanceof Error ? error.message : String(error),
    hint:
      "确认 public/models/pose_landmarker_lite.task 与 public/wasm 文件存在；然后运行 npm run sync:assets 并重启 npm run dev。若使用 GPU 模式，请切换到自动或 CPU 重试。",
  };
}

export async function requestCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException(
      "navigator.mediaDevices.getUserMedia 不可用",
      "NotSupportedError",
    );
  }

  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: CAPTURE_CONFIG.camera.width,
      height: CAPTURE_CONFIG.camera.height,
      frameRate: CAPTURE_CONFIG.camera.frameRate,
    },
  });
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}
