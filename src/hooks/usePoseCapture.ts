import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAPTURE_CONFIG,
  QUALITY_THRESHOLDS,
} from "../config/constants";
import {
  cameraErrorToCaptureError,
  listVideoDevices,
  modelErrorToCaptureError,
  requestCamera,
  stopMediaStream,
} from "../lib/camera";
import { Ema, FpsMeter } from "../lib/metrics";
import {
  assessFraming,
  averageVisibility,
  classifyPoseSignal,
  countVisibleKeyJoints,
  renderOverlay,
  toPosePoints,
} from "../lib/pose";
import { createPoseEngine, type PoseEngine } from "../lib/poseLandmarker";
import { nextMonotonicTimestamp } from "../lib/time";
import type {
  CameraDevice,
  CaptureError,
  CaptureMetrics,
  CaptureMode,
  CapturePhase,
  DelegateInfo,
  DelegateMode,
  LivePoseState,
  ModelStatus,
  PoseFrameSample,
  PosePoint,
  SkeletonTheme,
  VideoSize,
} from "../types/pose";

const EMPTY_METRICS: CaptureMetrics = {
  fps: 0,
  inferenceMs: 0,
  frames: 0,
  sourceTimeSec: 0,
};

const EMPTY_LIVE: LivePoseState = {
  hasPose: false,
  signal: "none",
  visibleKeyJoints: 0,
  visibilityAverage: 0,
  landmarks: null,
  lostForMs: 0,
  framing: "unknown",
};

const EMPTY_DELEGATE: DelegateInfo = { active: null, fallbackNote: null };
const EMPTY_VIDEO_SIZE: VideoSize = { width: 0, height: 0 };

export type PoseFrameListener = (frame: PoseFrameSample) => void;

interface UsePoseCaptureOptions {
  targetFps: number;
  delegateMode: DelegateMode;
  captureMode: CaptureMode;
  showSkeleton: boolean;
  showGrid: boolean;
  skeletonTheme?: SkeletonTheme;
}

export function usePoseCapture({
  targetFps,
  delegateMode,
  captureMode,
  showSkeleton,
  showGrid,
  skeletonTheme = "default",
}: UsePoseCaptureOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<CapturePhase>("idle");
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [error, setError] = useState<CaptureError | null>(null);
  const [metrics, setMetrics] = useState<CaptureMetrics>(EMPTY_METRICS);
  const [live, setLive] = useState<LivePoseState>(EMPTY_LIVE);
  const [videoSize, setVideoSize] = useState<VideoSize>(EMPTY_VIDEO_SIZE);
  const [delegateInfo, setDelegateInfo] = useState<DelegateInfo>(EMPTY_DELEGATE);
  const [cameraDevices, setCameraDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);

  const phaseRef = useRef<CapturePhase>("idle");
  const activeRef = useRef(false);
  const pausedRef = useRef(true);
  const operationIdRef = useRef(0);
  const unmountedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<PoseEngine | null>(null);
  const engineLoadRef = useRef<Promise<PoseEngine> | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const streamEpochRef = useRef(0);
  const lastPoseAtRef = useRef<number | null>(null);
  const lastLandmarksRef = useRef<PosePoint[] | null>(null);
  const lastUiUpdateRef = useRef(0);
  const framesRef = useRef(0);
  const selectedDeviceIdRef = useRef("");
  const targetFpsRef = useRef(targetFps);
  const delegateModeRef = useRef(delegateMode);
  const captureModeRef = useRef(captureMode);
  const skeletonThemeRef = useRef<SkeletonTheme>(skeletonTheme);
  const showSkeletonRef = useRef(showSkeleton);
  const showGridRef = useRef(showGrid);
  const frameListenersRef = useRef(new Set<PoseFrameListener>());
  const fpsMeterRef = useRef(new FpsMeter(1500, QUALITY_THRESHOLDS.fpsWarmupMs));
  const latencyRef = useRef(new Ema(0.2));

  const updatePhase = useCallback((next: CapturePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    targetFpsRef.current = CAPTURE_CONFIG.targetFpsOptions.includes(
      targetFps as (typeof CAPTURE_CONFIG.targetFpsOptions)[number],
    )
      ? targetFps
      : CAPTURE_CONFIG.defaultTargetFps;
  }, [targetFps]);

  useEffect(() => {
    delegateModeRef.current = delegateMode;
  }, [delegateMode]);

  const refreshDevices = useCallback(async (): Promise<CameraDevice[]> => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDevicesError("当前浏览器不支持摄像头设备枚举。");
      return [];
    }

    setDevicesLoading(true);
    try {
      const devices = await listVideoDevices();
      setCameraDevices(devices);
      setDevicesError(null);

      const current = selectedDeviceIdRef.current;
      if (current && !devices.some((device) => device.deviceId === current)) {
        selectedDeviceIdRef.current = "";
        setSelectedDeviceId("");
      }
      return devices;
    } catch (cause) {
      setDevicesError(
        cause instanceof Error ? cause.message : "无法读取摄像头设备列表。",
      );
      return [];
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const selectDevice = useCallback((deviceId: string) => {
    if (
      phaseRef.current === "starting" ||
      phaseRef.current === "running" ||
      phaseRef.current === "paused"
    ) {
      return;
    }
    selectedDeviceIdRef.current = deviceId;
    setSelectedDeviceId(deviceId);
  }, []);

  useEffect(() => {
    void refreshDevices();
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;
    const handleDeviceChange = () => {
      void refreshDevices();
    };
    mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [refreshDevices]);

  const drawLatest = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderOverlay(canvas, lastLandmarksRef.current, {
      showSkeleton: showSkeletonRef.current,
      showGrid: showGridRef.current,
      captureMode: captureModeRef.current,
      theme: skeletonThemeRef.current,
    });
  }, []);

  useEffect(() => {
    showSkeletonRef.current = showSkeleton;
    showGridRef.current = showGrid;
    drawLatest();
  }, [showSkeleton, showGrid, drawLatest]);

  useEffect(() => {
    captureModeRef.current = captureMode;
    drawLatest();
  }, [captureMode, drawLatest]);

  useEffect(() => {
    skeletonThemeRef.current = skeletonTheme;
    drawLatest();
  }, [skeletonTheme, drawLatest]);

  const subscribeToPoseFrames = useCallback((listener: PoseFrameListener) => {
    frameListenersRef.current.add(listener);
    return () => {
      frameListenersRef.current.delete(listener);
    };
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const cancelInferenceTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const detachStream = useCallback(
    (clearVideo = true) => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        if (clearVideo) video.srcObject = null;
      }
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      clearCanvas();
    },
    [clearCanvas],
  );

  const syncVideoSize = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }
    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    setVideoSize((previous) =>
      previous.width === video.videoWidth &&
      previous.height === video.videoHeight
        ? previous
        : { width: video.videoWidth, height: video.videoHeight },
    );
    drawLatest();
  }, [drawLatest]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleMetadata = () => syncVideoSize();
    video.addEventListener("loadedmetadata", handleMetadata);
    video.addEventListener("resize", handleMetadata);
    return () => {
      video.removeEventListener("loadedmetadata", handleMetadata);
      video.removeEventListener("resize", handleMetadata);
    };
  }, [syncVideoSize]);

  const ensureEngine = useCallback(async (mode: DelegateMode): Promise<PoseEngine> => {
    const existing = engineRef.current;
    if (existing && existing.requestedMode === mode) return existing;

    if (engineLoadRef.current) {
      try {
        await engineLoadRef.current;
      } catch {
        // The new attempt below produces the actionable error.
      }
    }

    const reusable = engineRef.current;
    if (reusable && reusable.requestedMode === mode) return reusable;
    if (engineRef.current) {
      engineRef.current.landmarker.close();
      engineRef.current = null;
    }

    const load = createPoseEngine(mode);
    engineLoadRef.current = load;
    try {
      const engine = await load;
      if (unmountedRef.current) {
        engine.landmarker.close();
        throw new Error("页面已关闭，模型加载已取消");
      }
      engineRef.current = engine;
      return engine;
    } finally {
      if (engineLoadRef.current === load) engineLoadRef.current = null;
    }
  }, []);

  const updateLiveUi = useCallback((now: number, sourceTimeSec: number) => {
    const landmarks = lastLandmarksRef.current;
    const visible = countVisibleKeyJoints(landmarks);
    const signalInfo = classifyPoseSignal(
      landmarks,
      now,
      lastPoseAtRef.current,
      visible,
    );
    const latency = latencyRef.current.get() ?? 0;
    setMetrics({
      fps: Number(fpsMeterRef.current.value().toFixed(1)),
      inferenceMs: Number(latency.toFixed(1)),
      frames: framesRef.current,
      sourceTimeSec,
    });
    setLive({
      hasPose: Boolean(landmarks),
      signal: signalInfo.signal,
      visibleKeyJoints: visible,
      visibilityAverage: averageVisibility(landmarks),
      landmarks,
      lostForMs: Number.isFinite(signalInfo.lostForMs)
        ? signalInfo.lostForMs
        : 0,
      framing: assessFraming(landmarks),
    });
  }, []);

  const failWithInferenceError = useCallback(
    (cause: unknown) => {
      activeRef.current = false;
      pausedRef.current = true;
      cancelInferenceTimer();
      detachStream();
      if (engineRef.current) {
        engineRef.current.landmarker.close();
        engineRef.current = null;
      }
      setModelStatus("error");
      setMetrics(EMPTY_METRICS);
      setLive(EMPTY_LIVE);
      setError({
        code: "INFERENCE_FAILED",
        title: "姿态推理中断",
        detail: cause instanceof Error ? cause.message : String(cause),
        hint:
          "请点击重试；如果重复发生，将推理模式切换为“CPU”，并确认浏览器支持 WebGL2。模型会在重试时重新加载。",
      });
      updatePhase("error");
    },
    [cancelInferenceTimer, detachStream, updatePhase],
  );

  /**
   * Decoupled inference loop: one synchronous detect at a time, scheduled by a
   * timer based on the previous inference cost. React state is sampled at 4 Hz.
   */
  const kickInference = useCallback(() => {
    if (!activeRef.current || pausedRef.current) return;
    if (timerRef.current !== null) return;

    const tick = () => {
      timerRef.current = null;
      if (!activeRef.current || pausedRef.current) return;

      const video = videoRef.current;
      const engine = engineRef.current;
      if (!video || !engine || video.readyState < 2) {
        timerRef.current = window.setTimeout(tick, 120);
        return;
      }

      const frameStart = performance.now();
      const sourceTimeSec = video.currentTime;
      const mediaTimestamp = streamEpochRef.current + sourceTimeSec * 1000;
      const timestamp = nextMonotonicTimestamp(
        lastTimestampRef.current,
        mediaTimestamp,
        1,
      );
      lastTimestampRef.current = timestamp;

      let landmarks: PosePoint[] | null = null;
      try {
        const result = engine.landmarker.detectForVideo(video, timestamp);
        landmarks = toPosePoints(result.landmarks?.[0]);
      } catch (cause) {
        console.error("[SpineMotion] pose inference failed", cause);
        failWithInferenceError(cause);
        return;
      }

      const frameEnd = performance.now();
      const latency = frameEnd - frameStart;
      framesRef.current += 1;
      fpsMeterRef.current.record(frameEnd);
      latencyRef.current.push(latency);

      lastLandmarksRef.current = landmarks;
      if (landmarks) lastPoseAtRef.current = frameEnd;

      if (frameListenersRef.current.size > 0) {
        const sample: PoseFrameSample = {
          timestampMs: timestamp,
          sourceTimeSec,
          landmarks,
          captureMode: captureModeRef.current,
          mirrored: false,
          videoSize: {
            width: video.videoWidth,
            height: video.videoHeight,
          },
          inferenceMs: latency,
        };
        for (const listener of frameListenersRef.current) {
          try {
            listener(sample);
          } catch (listenerError) {
            console.error("[SpineMotion] pose frame listener failed", listenerError);
          }
        }
      }

      if (activeRef.current && !pausedRef.current) {
        drawLatest();
      }

      if (frameEnd - lastUiUpdateRef.current >= QUALITY_THRESHOLDS.uiUpdateIntervalMs) {
        lastUiUpdateRef.current = frameEnd;
        updateLiveUi(frameEnd, sourceTimeSec);
      }

      if (!activeRef.current || pausedRef.current) return;
      const interval = 1000 / targetFpsRef.current;
      const wait = Math.max(0, interval - latency);
      timerRef.current = window.setTimeout(tick, wait);
    };

    tick();
  }, [drawLatest, failWithInferenceError, updateLiveUi]);

  const start = useCallback(async () => {
    if (phaseRef.current === "starting") return;
    if (phaseRef.current === "running" || phaseRef.current === "paused") return;

    operationIdRef.current += 1;
    const operationId = operationIdRef.current;
    const isStale = () => operationId !== operationIdRef.current || unmountedRef.current;

    cancelInferenceTimer();
    activeRef.current = false;
    pausedRef.current = true;
    detachStream();
    lastLandmarksRef.current = null;
    lastPoseAtRef.current = null;
    lastUiUpdateRef.current = 0;
    framesRef.current = 0;
    fpsMeterRef.current.reset();
    latencyRef.current.reset();
    setError(null);
    setMetrics(EMPTY_METRICS);
    setLive(EMPTY_LIVE);
    setDelegateInfo((previous) => ({ ...previous, fallbackNote: null }));
    updatePhase("starting");

    const mode = delegateModeRef.current;
    const cachedMode = engineRef.current?.requestedMode;
    if (cachedMode !== mode) setModelStatus("loading");
    else if (engineRef.current) setModelStatus("ready");

    let stream: MediaStream | null = null;
    try {
      stream = await requestCamera(selectedDeviceIdRef.current || undefined);
      if (isStale()) {
        stopMediaStream(stream);
        return;
      }
      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      void refreshDevices();

      videoTrack?.addEventListener(
        "ended",
        () => {
          if (operationId !== operationIdRef.current || !activeRef.current) {
            return;
          }
          activeRef.current = false;
          pausedRef.current = true;
          cancelInferenceTimer();
          detachStream();
          setError({
            code: "CAMERA_DISCONNECTED",
            title: "摄像头连接已断开",
            detail:
              "所选摄像头轨道已结束。可能是 USB 被拔出、iPhone 连续互通相机断开，或设备被其他应用占用。",
            hint:
              "重新连接设备后刷新摄像头列表，再次选择设备并启动。其他已完成的页面数据不受影响。",
          });
          setModelStatus(engineRef.current ? "ready" : "idle");
          updatePhase("error");
          void refreshDevices();
        },
        { once: true },
      );

      const video = videoRef.current;
      if (!video) {
        throw new Error("视频元素尚未就绪，请刷新页面后重试。");
      }
      video.srcObject = stream;
      video.muted = true;

      await video.play();
      if (isStale()) {
        detachStream();
        return;
      }
      syncVideoSize();
    } catch (cause) {
      if (isStale()) return;
      stopMediaStream(stream);
      streamRef.current = null;
      detachStream();
      setModelStatus(engineRef.current ? "ready" : "idle");
      setError(cameraErrorToCaptureError(cause));
      updatePhase("error");
      void refreshDevices();
      return;
    }

    let engine: PoseEngine;
    try {
      setModelStatus("loading");
      engine = await ensureEngine(mode);
    } catch (cause) {
      if (isStale()) return;
      detachStream();
      setError(modelErrorToCaptureError(cause));
      setModelStatus("error");
      updatePhase("error");
      return;
    }

    if (isStale()) {
      if (!engineRef.current) engine.landmarker.close();
      return;
    }

    setDelegateInfo({
      active: engine.activeDelegate,
      fallbackNote: engine.fallbackNote,
    });
    setModelStatus("ready");

    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      detachStream();
      setError({
        code: "VIDEO_NOT_READY",
        title: "摄像头画面尚未就绪",
        detail: "浏览器已授权，但视频帧没有进入可读取状态。",
        hint: "再次点击启动；如果持续出现，请关闭其他摄像头应用后重试。",
      });
      updatePhase("error");
      return;
    }

    streamEpochRef.current = performance.now() - video.currentTime * 1000;
    activeRef.current = true;
    pausedRef.current = false;
    updatePhase("running");
    kickInference();
  }, [
    cancelInferenceTimer,
    detachStream,
    ensureEngine,
    kickInference,
    refreshDevices,
    syncVideoSize,
    updatePhase,
  ]);

  const pause = useCallback(() => {
    if (phaseRef.current !== "running") return;
    pausedRef.current = true;
    cancelInferenceTimer();
    const video = videoRef.current;
    if (video) video.pause();
    for (const track of streamRef.current?.getVideoTracks() ?? []) {
      track.enabled = false;
    }
    setMetrics((previous) => ({ ...previous, fps: 0 }));
    updatePhase("paused");
  }, [cancelInferenceTimer, updatePhase]);

  const resume = useCallback(async () => {
    if (phaseRef.current !== "paused") return;
    const video = videoRef.current;
    if (!video) return;
    try {
      for (const track of streamRef.current?.getVideoTracks() ?? []) {
        track.enabled = true;
      }
      await video.play();
      if (phaseRef.current !== "paused") return;
      pausedRef.current = false;
      updatePhase("running");
      kickInference();
    } catch (cause) {
      pausedRef.current = true;
      detachStream();
      setError({
        code: "RESUME_FAILED",
        title: "无法恢复摄像头",
        detail: cause instanceof Error ? cause.message : String(cause),
        hint: "摄像头轨道已释放。请点击“重新启动摄像头”重新授权并启动采集。",
      });
      updatePhase("error");
    }
  }, [detachStream, kickInference, updatePhase]);

  const stop = useCallback(() => {
    operationIdRef.current += 1;
    activeRef.current = false;
    pausedRef.current = true;
    cancelInferenceTimer();
    detachStream();
    lastLandmarksRef.current = null;
    lastPoseAtRef.current = null;
    framesRef.current = 0;
    fpsMeterRef.current.reset();
    latencyRef.current.reset();
    setMetrics(EMPTY_METRICS);
    setLive(EMPTY_LIVE);
    setError(null);
    setModelStatus(engineRef.current ? "ready" : "idle");
    updatePhase("idle");
  }, [
    cancelInferenceTimer,
    detachStream,
    updatePhase,
  ]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      operationIdRef.current += 1;
      activeRef.current = false;
      pausedRef.current = true;
      cancelInferenceTimer();
      detachStream();
      if (engineRef.current) {
        engineRef.current.landmarker.close();
        engineRef.current = null;
      }
    };
  }, [cancelInferenceTimer, detachStream]);

  return {
    videoRef,
    canvasRef,
    phase,
    modelStatus,
    error,
    metrics,
    live,
    videoSize,
    delegateInfo,
    cameraDevices,
    selectedDeviceId,
    devicesLoading,
    devicesError,
    refreshDevices,
    selectDevice,
    subscribeToPoseFrames,
    start,
    pause,
    resume,
    stop,
  };
}
