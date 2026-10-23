import { useCallback, useEffect, useRef, useState } from "react";
import { CAPTURE_CONFIG, DEFAULT_CAPTURE_MODE } from "../config/constants";
import { checkArenaCompatibility } from "../lib/arena/compatibility";
import { alignDtw } from "../lib/arena/dtw";
import { prepareArenaPair } from "../lib/arena/normalize";
import { computeArenaScore } from "../lib/arena/scoring";
import { MotionRecorder } from "../lib/ghost/recorder";
import { usePoseCapture } from "./usePoseCapture";
import type { ArenaScore } from "../types/arena";
import type { GhostAction } from "../types/ghost";
import type { CaptureMode } from "../types/pose";

export type ArenaStep =
  | "setup"
  | "player-a"
  | "confirm-a"
  | "player-b"
  | "confirm-b"
  | "analyzing"
  | "results";

export function useArenaSession() {
  const [step, setStep] = useState<ArenaStep>("setup");
  const [captureMode, setCaptureMode] = useState<CaptureMode>(DEFAULT_CAPTURE_MODE);
  const [durationSec, setDurationSec] = useState(8);
  const [actionA, setActionA] = useState<GhostAction | null>(null);
  const [actionB, setActionB] = useState<GhostAction | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordingFrameCount, setRecordingFrameCount] = useState(0);
  const [recordingValidFrames, setRecordingValidFrames] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recordingActive, setRecordingActive] = useState(false);
  const [score, setScore] = useState<ArenaScore | null>(null);
  const [refusalReason, setRefusalReason] = useState<string | null>(null);
  const [refusalWarnings, setRefusalWarnings] = useState<string[]>([]);

  // Mutable refs for internal orchestration
  const stepRef = useRef<ArenaStep>("setup");
  const recorderRef = useRef<MotionRecorder | null>(null);
  const recordingActiveRef = useRef(false);
  const recordingStartedPerfRef = useRef(0);
  const pendingDurationMsRef = useRef(8000);
  const progressTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);

  // Sync state → ref
  stepRef.current = step;

  const capture = usePoseCapture({
    targetFps: CAPTURE_CONFIG.defaultTargetFps,
    delegateMode: "auto",
    captureMode,
    showSkeleton: true,
    showGrid: false,
    skeletonTheme: "amber",
  });

  // Mutable ref for which player is currently recording.
  const activePlayerRef = useRef<"A" | "B" | null>(null);

  const clearNoticeTimer = useCallback(() => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  }, []);

  const showNotice = useCallback(
    (message: string, timeoutMs = 4200) => {
      clearNoticeTimer();
      setNotice(message);
      if (timeoutMs > 0) {
        noticeTimerRef.current = window.setTimeout(() => setNotice(null), timeoutMs);
      }
    },
    [clearNoticeTimer],
  );

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  /**
   * Stop the wall-clock progress polling timer and mark recording inactive.
   * Called by manual stop, auto-duration, and cleanup paths.
   */
  const stopProgressTimer = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  // Finish the active recording — the single exit point for any recording end.
  const finishRecording = useCallback(
    (which: "A" | "B") => {
      if (!recordingActiveRef.current) return;
      recordingActiveRef.current = false;
      setRecordingActive(false);
      activePlayerRef.current = null;
      stopProgressTimer();
      clearCountdown();

      const recorder = recorderRef.current;
      recorderRef.current = null;
      setCountdown(null);

      const action = recorder?.stop() ?? null;
      if (!action) {
        setError("本次没有捕获到任何姿态帧。请确认摄像头画面和人物状态后重试。");
        setStep(which === "A" ? "setup" : "player-b");
        setRecordingElapsedMs(0);
        setRecordingFrameCount(0);
        setRecordingValidFrames(0);
        return;
      }

      if (which === "A") {
        setActionA(action);
        setStep("confirm-a");
        showNotice("玩家A动作已录制完成。");
      } else {
        setActionB(action);
        setStep("confirm-b");
        showNotice("玩家B动作已录制完成。");
      }
      setRecordingElapsedMs(action.durationMs);
      setRecordingFrameCount(action.recording.totalFrames);
      setRecordingValidFrames(action.recording.validFrames);
    },
    [clearCountdown, showNotice, stopProgressTimer],
  );

  /**
   * Start wall-clock recording timer. Runs independently of React renders and
   * step transitions. Cancels itself when duration is reached or recording
   * becomes inactive.
   */
  const startProgressTimer = useCallback(() => {
    stopProgressTimer();
    const poll = () => {
      if (!recordingActiveRef.current) {
        stopProgressTimer();
        return;
      }
      const recorder = recorderRef.current;
      if (recorder) {
        const snapshot = recorder.snapshot();
        setRecordingFrameCount(snapshot.frameCount);
        setRecordingValidFrames(snapshot.validFrameCount);
      }
      const elapsed = performance.now() - recordingStartedPerfRef.current;
      const durationMs = pendingDurationMsRef.current;
      setRecordingElapsedMs(Math.min(elapsed, durationMs));
      if (elapsed >= durationMs) {
        const player = activePlayerRef.current;
        if (player === "A" || player === "B") finishRecording(player);
        return;
      }
      progressTimerRef.current = window.setTimeout(poll, 180);
    };
    progressTimerRef.current = window.setTimeout(poll, 50);
  }, [finishRecording, stopProgressTimer]);

  // Pose frame subscription — feed frames to active recorder (duration-limit
  // is handled by the wall-clock timer; this is purely for data collection).
  useEffect(() => {
    const unsubscribe = capture.subscribeToPoseFrames((sample) => {
      if (!recordingActiveRef.current) return;
      const recorder = recorderRef.current;
      if (!recorder) return;
      recorder.addFrame(sample);
    });
    return unsubscribe;
  }, [capture.subscribeToPoseFrames]);

  // Cleanup on unmount
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      recordingActiveRef.current = false;
      stopProgressTimer();
      clearNoticeTimer();
      clearCountdown();
    };
  }, [clearCountdown, clearNoticeTimer, stopProgressTimer]);

  /**
   * Begin actual recording. Creates a fresh MotionRecorder, starts the wall-clock
   * timer, sets state, and records which player is active so the timer's
   * auto-completion targets the right one.
   */
  const beginRecordingFor = useCallback(
    (which: "A" | "B") => {
      if (capture.phase !== "running") {
        setError("请先启动摄像头，再开始录制。");
        return;
      }

      // Discard any previous uncommitted recorder.
      recordingActiveRef.current = false;
      stopProgressTimer();
      recorderRef.current = null;

      pendingDurationMsRef.current = durationSec * 1000;

      const recorder = new MotionRecorder({
        requestedDurationMs: pendingDurationMsRef.current,
        mode: captureMode,
        mirrored: false,
        targetFps: CAPTURE_CONFIG.defaultTargetFps,
        activeDelegate: capture.delegateInfo.active,
        cameraLabel: capture.cameraDevices.find(
          (d) => d.deviceId === capture.selectedDeviceId,
        )?.label ?? "摄像头",
      });
      recorder.start();
      recorderRef.current = recorder;
      recordingActiveRef.current = true;
      setRecordingActive(true);
      activePlayerRef.current = which;
      recordingStartedPerfRef.current = performance.now();
      setCountdown(null);
      setError(null);
      setRecordingElapsedMs(0);
      setRecordingFrameCount(0);
      setRecordingValidFrames(0);
      setStep(which === "A" ? "player-a" : "player-b");
      showNotice(which === "A" ? "玩家A录制中…" : "玩家B录制中…", 0);
      startProgressTimer();
    },
    [
      capture.phase, capture.cameraDevices, capture.selectedDeviceId,
      capture.delegateInfo.active, captureMode, durationSec, showNotice,
      startProgressTimer, stopProgressTimer,
    ],
  );

  const startCountdown = useCallback(
    (which: "A" | "B") => {
      if (capture.phase !== "running") {
        setError("请先启动摄像头。");
        return;
      }
      clearCountdown();
      if (recordingActiveRef.current) {
        finishRecording(activePlayerRef.current ?? "A");
      }
      setError(null);
      setCountdown(3);
      let remaining = 3;
      const tick = () => {
        if (unmountedRef.current) return;
        remaining -= 1;
        if (remaining <= 0) {
          beginRecordingFor(which);
        } else {
          setCountdown(remaining);
          countdownTimerRef.current = window.setTimeout(tick, 1000);
        }
      };
      countdownTimerRef.current = window.setTimeout(tick, 1000);
    },
    [capture.phase, beginRecordingFor, clearCountdown, finishRecording],
  );

  const resetSession = useCallback(() => {
    recordingActiveRef.current = false;
    setRecordingActive(false);
    activePlayerRef.current = null;
    stopProgressTimer();
    clearCountdown();
    clearNoticeTimer();
    recorderRef.current = null;
    setActionA(null);
    setActionB(null);
    setScore(null);
    setRefusalReason(null);
    setRefusalWarnings([]);
    setError(null);
    setNotice(null);
    setCountdown(null);
    setRecordingElapsedMs(0);
    setRecordingFrameCount(0);
    setRecordingValidFrames(0);
    if (capture.phase === "running") capture.stop();
    setStep("setup");
  }, [capture, clearNoticeTimer, clearCountdown, stopProgressTimer]);

  // Auto-run analysis when entering analyzing step
  useEffect(() => {
    if (step !== "analyzing") return;
    if (!actionA || !actionB) return;

    const timer = window.setTimeout(() => {
      setRefusalReason(null);
      setRefusalWarnings([]);

      // Compatibility check
      const compat = checkArenaCompatibility(actionA, actionB);
      if (!compat.compatible) {
        setRefusalReason(compat.reasons.join("；"));
        setRefusalWarnings(compat.warnings);
        setScore(null);
        setStep("results");
        return;
      }

      // Normalize + DTW
      const pair = prepareArenaPair(actionA, actionB, alignDtw);
      if (!pair) {
        setRefusalReason("归一化失败：有效关键帧不足，无法对齐动作。");
        setScore(null);
        setStep("results");
        return;
      }

      // Score
      try {
        const result = computeArenaScore(pair);
        setScore(result);
        if (!result.quality.acceptable) {
          setRefusalReason(result.quality.reasons.join("；"));
        }
        setRefusalWarnings(compat.warnings);
      } catch (err) {
        setRefusalReason(
          `评分计算异常：${err instanceof Error ? err.message : String(err)}`,
        );
        setScore(null);
      }
      setStep("results");
    }, 300);

    return () => window.clearTimeout(timer);
  }, [step, actionA, actionB]);

  return {
    step,
    captureMode,
    durationSec,
    actionA,
    actionB,
    countdown,
    recordingElapsedMs,
    recordingFrameCount,
    recordingValidFrames,
    isRecording: recordingActive,
    error,
    notice,
    score,
    refusalReason,
    refusalWarnings,
    capture,
    setCaptureMode,
    setDurationSec,
    resetSession,
    startPlayerA: () => startCountdown("A"),
    startPlayerB: () => startCountdown("B"),
    confirmA: () => setStep("player-b"),
    confirmB: () => setStep("analyzing"),
    reRecordA: () => { setActionA(null); setStep("setup"); },
    reRecordB: () => { setActionB(null); setStep("player-b"); },
    dismissError: () => setError(null),
    dismissNotice: () => setNotice(null),
    stopRecording: () => {
      const player = activePlayerRef.current;
      if (player === "A" || player === "B") finishRecording(player);
    },
  };
}