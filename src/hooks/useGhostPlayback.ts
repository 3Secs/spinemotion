import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { GHOST_CONFIG } from "../config/constants";
import { clearGhostCanvas, renderGhostSkeleton } from "../lib/ghost/render";
import { sampleGhostAction } from "../lib/ghost/playback";
import {
  computeBodyCalibration,
  computeReferenceCalibration,
  transformLandmarks,
} from "../lib/ghost/transform";
import type {
  GhostAction,
  GhostBodyCalibration,
  GhostCalibration,
  GhostSampleStatus,
} from "../types/ghost";
import type { PoseFrameSample } from "../types/pose";

export type GhostOverlayStatus =
  | "off"
  | "waiting-camera"
  | "waiting-live"
  | "uncalibrated"
  | "gap"
  | "ready";

interface UseGhostPlaybackOptions {
  action: GhostAction | null;
  ghostCanvasRef: RefObject<HTMLCanvasElement | null>;
  previewCanvasRef: RefObject<HTMLCanvasElement | null>;
  liveFrameRef: RefObject<PoseFrameSample | null>;
  ghostVisible: boolean;
  ghostOpacity: number;
  calibration: GhostCalibration;
  overlayActive: boolean;
}

interface PlaybackSettings {
  ghostVisible: boolean;
  ghostOpacity: number;
  calibration: GhostCalibration;
  overlayActive: boolean;
}

interface SmoothCalibration {
  anchorX: number;
  anchorY: number;
  scale: number;
  aspect: number;
  updatedAt: number;
}

const SPEEDS = [0.5, 1, 1.5] as const;

export function useGhostPlayback({
  action,
  ghostCanvasRef,
  previewCanvasRef,
  liveFrameRef,
  ghostVisible,
  ghostOpacity,
  calibration,
  overlayActive,
}: UseGhostPlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [timeMs, setTimeMs] = useState(0);
  const [sampleStatus, setSampleStatus] = useState<GhostSampleStatus>("empty");
  const [overlayStatus, setOverlayStatus] = useState<GhostOverlayStatus>("off");

  const actionRef = useRef<GhostAction | null>(action);
  const referenceCalibration = useMemo(
    () => (action ? computeReferenceCalibration(action) : null),
    [action],
  );
  const referenceCalibrationRef = useRef<GhostBodyCalibration | null>(
    referenceCalibration,
  );
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const timeRef = useRef(0);
  const overlayStatusRef = useRef<GhostOverlayStatus>("off");
  const statusRef = useRef<GhostSampleStatus>("empty");
  const smoothRef = useRef<SmoothCalibration | null>(null);
  const settingsRef = useRef<PlaybackSettings>({
    ghostVisible,
    ghostOpacity,
    calibration,
    overlayActive,
  });

  useEffect(() => {
    settingsRef.current = {
      ghostVisible,
      ghostOpacity,
      calibration,
      overlayActive,
    };
  }, [ghostVisible, ghostOpacity, calibration, overlayActive]);

  useEffect(() => {
    actionRef.current = action;
    referenceCalibrationRef.current = referenceCalibration;
    timeRef.current = 0;
    playingRef.current = false;
    smoothRef.current = null;
    setIsPlaying(false);
    setTimeMs(0);
    setSpeedState(1);
    speedRef.current = 1;
    setSampleStatus(action ? "first" : "empty");
    statusRef.current = action ? "first" : "empty";
    setOverlayStatus("off");
    overlayStatusRef.current = "off";
    clearGhostCanvas(ghostCanvasRef.current);
    clearGhostCanvas(previewCanvasRef.current);
  }, [action, ghostCanvasRef, previewCanvasRef, referenceCalibration]);

  const updateOverlayStatus = (next: GhostOverlayStatus) => {
    if (overlayStatusRef.current === next) return;
    overlayStatusRef.current = next;
    setOverlayStatus(next);
  };

  useEffect(() => {
    let frameId = 0;
    let lastTime = performance.now();
    let lastDraw = 0;
    let lastUi = 0;

    const drawPreview = (
      currentAction: GhostAction,
      landmarks: ReturnType<typeof sampleGhostAction>["landmarks"],
    ) => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      if (!landmarks) {
        clearGhostCanvas(canvas);
        return;
      }
      const scale = Math.min(
        1,
        GHOST_CONFIG.previewMaxWidth / currentAction.capture.videoWidth,
      );
      const width = Math.max(1, Math.round(currentAction.capture.videoWidth * scale));
      const height = Math.max(1, Math.round(currentAction.capture.videoHeight * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      renderGhostSkeleton(canvas, landmarks, {
        mode: currentAction.mode,
        opacity: 0.9,
      });
    };

    const drawOverlay = (
      currentAction: GhostAction,
      landmarks: ReturnType<typeof sampleGhostAction>["landmarks"],
    ) => {
      const canvas = ghostCanvasRef.current;
      if (!canvas) return;
      const settings = settingsRef.current;
      if (!settings.ghostVisible) {
        clearGhostCanvas(canvas);
        updateOverlayStatus("off");
        return;
      }
      if (!settings.overlayActive) {
        clearGhostCanvas(canvas);
        updateOverlayStatus("waiting-camera");
        return;
      }
      if (!landmarks) {
        clearGhostCanvas(canvas);
        updateOverlayStatus("gap");
        return;
      }

      const liveFrame = liveFrameRef.current;
      if (!liveFrame?.landmarks) {
        clearGhostCanvas(canvas);
        updateOverlayStatus("waiting-live");
        return;
      }
      const { width: videoWidth, height: videoHeight } = liveFrame.videoSize;
      if (videoWidth <= 0 || videoHeight <= 0) {
        clearGhostCanvas(canvas);
        updateOverlayStatus("waiting-camera");
        return;
      }
      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
      }

      const reference = referenceCalibrationRef.current;
      const currentAspect = videoWidth / videoHeight;
      const currentRaw = computeBodyCalibration(
        liveFrame.landmarks,
        currentAction.mode,
        currentAspect,
      );
      if (!reference || !currentRaw) {
        clearGhostCanvas(canvas);
        updateOverlayStatus("uncalibrated");
        return;
      }

      const now = performance.now();
      const previous = smoothRef.current;
      let current = currentRaw;
      if (
        previous &&
        previous.aspect === currentAspect &&
        now - previous.updatedAt < 1000
      ) {
        current = {
          anchorX: previous.anchorX * 0.8 + currentRaw.anchorX * 0.2,
          anchorY: previous.anchorY * 0.8 + currentRaw.anchorY * 0.2,
          scale: previous.scale * 0.82 + currentRaw.scale * 0.18,
          aspect: currentAspect,
        };
      }
      smoothRef.current = { ...current, updatedAt: now };

      const transformed = transformLandmarks(landmarks, {
        reference,
        current,
        manual: settings.calibration,
        referenceMirrored: currentAction.mirrored,
        currentMirrored: false,
      });
      renderGhostSkeleton(canvas, transformed, {
        mode: currentAction.mode,
        opacity: settings.ghostOpacity,
      });
      updateOverlayStatus("ready");
    };

    const loop = (now: number) => {
      const delta = Math.min(100, now - lastTime);
      lastTime = now;
      const currentAction = actionRef.current;
      let sample = null;

      if (currentAction) {
        if (playingRef.current) {
          const nextTime = Math.min(
            currentAction.durationMs,
            timeRef.current + delta * speedRef.current,
          );
          timeRef.current = nextTime;
          if (nextTime >= currentAction.durationMs) {
            playingRef.current = false;
            setIsPlaying(false);
          }
        }
        sample = sampleGhostAction(currentAction, timeRef.current);
      }

      if (now - lastDraw >= 33) {
        lastDraw = now;
        if (currentAction && sample) {
          drawPreview(currentAction, sample.landmarks);
          drawOverlay(currentAction, sample.landmarks);
        } else {
          clearGhostCanvas(previewCanvasRef.current);
          clearGhostCanvas(ghostCanvasRef.current);
          updateOverlayStatus("off");
        }
      }

      if (now - lastUi >= 180) {
        lastUi = now;
        setTimeMs(Math.round(timeRef.current));
        const nextStatus = sample?.status ?? "empty";
        if (statusRef.current !== nextStatus) {
          statusRef.current = nextStatus;
          setSampleStatus(nextStatus);
        }
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameId);
      clearGhostCanvas(ghostCanvasRef.current);
      clearGhostCanvas(previewCanvasRef.current);
    };
  }, [ghostCanvasRef, liveFrameRef, previewCanvasRef]);

  const play = useCallback(() => {
    const currentAction = actionRef.current;
    if (!currentAction) return;
    if (timeRef.current >= currentAction.durationMs) {
      timeRef.current = 0;
      setTimeMs(0);
    }
    playingRef.current = true;
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [pause, play]);

  const restart = useCallback(() => {
    timeRef.current = 0;
    playingRef.current = false;
    setIsPlaying(false);
    setTimeMs(0);
  }, []);

  const playFromStart = useCallback(() => {
    if (!actionRef.current) return;
    timeRef.current = 0;
    setTimeMs(0);
    playingRef.current = true;
    setIsPlaying(true);
  }, []);

  const seek = useCallback(
    (nextTimeMs: number) => {
      const currentAction = actionRef.current;
      if (!currentAction) return;
      const clamped = Math.min(
        currentAction.durationMs,
        Math.max(0, nextTimeMs),
      );
      timeRef.current = clamped;
      setTimeMs(Math.round(clamped));
    },
    [],
  );

  const setSpeed = useCallback((nextSpeed: number) => {
    if (!SPEEDS.includes(nextSpeed as (typeof SPEEDS)[number])) return;
    speedRef.current = nextSpeed;
    setSpeedState(nextSpeed);
  }, []);

  return {
    isPlaying,
    speed,
    timeMs,
    durationMs: action?.durationMs ?? 0,
    sampleStatus,
    overlayStatus,
    play,
    pause,
    toggle,
    restart,
    playFromStart,
    seek,
    setSpeed,
  };
}
