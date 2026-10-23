import { CAPTURE_CONFIG } from "../config/constants";
import type { CameraDevice, CaptureError } from "../types/pose";

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
      detail: "浏览器未能枚举到所选的视频输入设备。",
      hint:
        "确认 Mac 内置摄像头、iPhone 连续互通相机或 USB 摄像头已连接；刷新设备列表后重新选择，并关闭占用摄像头的其他应用。",
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
      title: "所选摄像头当前不可用",
      detail: message || "摄像头已断开，或无法满足设备 ID / 分辨率约束。",
      hint:
        "刷新设备列表并重新选择摄像头；iPhone 连续互通相机需保持解锁、靠近且未被其他应用占用。应用只固定设备，不强制分辨率。",
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

export async function listVideoDevices(): Promise<CameraDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new DOMException(
      "navigator.mediaDevices.enumerateDevices 不可用",
      "NotSupportedError",
    );
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "videoinput" && device.deviceId.length > 0)
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `视频设备 ${index + 1}`,
      groupId: device.groupId,
    }));
}

export async function requestCamera(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException(
      "navigator.mediaDevices.getUserMedia 不可用",
      "NotSupportedError",
    );
  }

  const videoConstraints: MediaTrackConstraints = {
    width: CAPTURE_CONFIG.camera.width,
    height: CAPTURE_CONFIG.camera.height,
    frameRate: CAPTURE_CONFIG.camera.frameRate,
  };
  if (deviceId) {
    videoConstraints.deviceId = { exact: deviceId };
  }

  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: videoConstraints,
  });
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}
