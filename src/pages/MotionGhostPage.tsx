import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { CameraStage } from "../components/capture/CameraStage";
import { GhostCameraPanel } from "../components/ghost/GhostCameraPanel";
import {
  GhostRecordPanel,
  type GhostRecordingState,
} from "../components/ghost/GhostRecordPanel";
import { GhostReferencePanel } from "../components/ghost/GhostReferencePanel";
import { GhostPlaybackPanel } from "../components/ghost/GhostPlaybackPanel";
import {
  ActivityIcon,
  CheckIcon,
  CpuIcon,
  GhostIcon,
  ScanIcon,
  ShieldIcon,
  WarningIcon,
} from "../components/Icons";
import {
  CAPTURE_CONFIG,
  DEFAULT_CAPTURE_MODE,
  GHOST_CONFIG,
} from "../config/constants";
import { useGhostPlayback } from "../hooks/useGhostPlayback";
import { usePoseCapture } from "../hooks/usePoseCapture";
import {
  downloadGhostAction,
  loadGhostLibrary,
  persistGhostLibrary,
  removeGhostAction,
  upsertGhostAction,
} from "../lib/ghost/library";
import { MotionRecorder } from "../lib/ghost/recorder";
import { parseGhostActionJson } from "../lib/ghost/schema";
import { assessCaptureReadiness } from "../lib/pose";
import type {
  CameraDevice,
  CaptureMode,
  PoseFrameSample,
  VideoSize,
} from "../types/pose";
import {
  DEFAULT_GHOST_CALIBRATION,
  type GhostAction,
  type GhostCalibration,
} from "../types/ghost";
import type { GhostOverlayStatus } from "../hooks/useGhostPlayback";

interface CountdownState {
  purpose: "record" | "ghost";
  value: number;
}

interface CameraSnapshot {
  phase: ReturnType<typeof usePoseCapture>["phase"];
  mode: CaptureMode;
  videoSize: VideoSize;
  selectedDeviceId: string;
  devices: CameraDevice[];
  activeDelegate: "GPU" | "CPU" | null;
}

const overlayLabels: Record<GhostOverlayStatus, string> = {
  off: "GHOST OFF",
  "waiting-camera": "WAITING CAMERA",
  "waiting-live": "WAITING LIVE BODY",
  uncalibrated: "ALIGNING BODY",
  gap: "REFERENCE GAP",
  ready: "GHOST LIVE",
};

function formatActionCount(value: number): string {
  return value.toLocaleString("zh-CN");
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function MotionGhostPage() {
  const [captureMode, setCaptureMode] = useState<CaptureMode>(DEFAULT_CAPTURE_MODE);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [durationSec, setDurationSec] = useState<number>(GHOST_CONFIG.defaultDurationSec);
  const [ghostVisible, setGhostVisible] = useState(true);
  const [ghostOpacity, setGhostOpacity] = useState<number>(GHOST_CONFIG.defaultOpacity);
  const [calibration, setCalibration] = useState<GhostCalibration>(
    DEFAULT_GHOST_CALIBRATION,
  );

  const [recordingState, setRecordingState] = useState<GhostRecordingState>("idle");
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordingFrameCount, setRecordingFrameCount] = useState(0);
  const [recordingValidFrames, setRecordingValidFrames] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<CountdownState | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const [draftAction, setDraftAction] = useState<GhostAction | null>(null);
  const [library, setLibrary] = useState<GhostAction[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState("");
  const [actionName, setActionName] = useState("");
  const [saved, setSaved] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const capture = usePoseCapture({
    targetFps: CAPTURE_CONFIG.defaultTargetFps,
    delegateMode: "auto",
    captureMode,
    showSkeleton,
    showGrid,
    skeletonTheme: "amber",
  });
  const readiness = useMemo(
    () => assessCaptureReadiness(capture.live.landmarks, captureMode),
    [capture.live.landmarks, captureMode],
  );

  const ghostCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveFrameRef = useRef<PoseFrameSample | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MotionRecorder | null>(null);
  const recordingActiveRef = useRef(false);
  const recordingStartedPerfRef = useRef(0);
  const pendingDurationMsRef = useRef(GHOST_CONFIG.defaultDurationSec * 1000);
  const didInitLibraryRef = useRef(false);
  const cameraSnapshotRef = useRef<CameraSnapshot>({
    phase: "idle",
    mode: captureMode,
    videoSize: { width: 0, height: 0 },
    selectedDeviceId: "",
    devices: [],
    activeDelegate: null,
  });

  const availableActions = useMemo(() => {
    const byId = new Map<string, GhostAction>();
    for (const action of library) byId.set(action.id, action);
    if (draftAction) byId.set(draftAction.id, draftAction);
    return [...byId.values()].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  }, [library, draftAction]);

  const referenceAction = useMemo(
    () => availableActions.find((action) => action.id === referenceId) ?? null,
    [availableActions, referenceId],
  );
  const referenceActionRef = useRef<GhostAction | null>(null);

  const playback = useGhostPlayback({
    action: referenceAction,
    ghostCanvasRef,
    previewCanvasRef,
    liveFrameRef,
    ghostVisible,
    ghostOpacity,
    calibration,
    overlayActive:
      capture.phase === "running" || capture.phase === "paused",
  });

  useEffect(() => {
    referenceActionRef.current = referenceAction;
  }, [referenceAction]);

  useEffect(() => {
    cameraSnapshotRef.current = {
      phase: capture.phase,
      mode: captureMode,
      videoSize: capture.videoSize,
      selectedDeviceId: capture.selectedDeviceId,
      devices: capture.cameraDevices,
      activeDelegate: capture.delegateInfo.active,
    };
  }, [
    capture.phase,
    capture.videoSize,
    capture.selectedDeviceId,
    capture.cameraDevices,
    capture.delegateInfo.active,
    captureMode,
  ]);

  useEffect(() => {
    if (didInitLibraryRef.current) return;
    didInitLibraryRef.current = true;
    const result = loadGhostLibrary();
    setLibrary(result.actions);
    setLibraryError(result.error);
    const latest = result.actions[0];
    if (latest) {
      setReferenceId(latest.id);
      setCaptureMode(latest.mode);
      setActionName(latest.name);
    }
  }, []);

  useEffect(() => {
    const canvas = ghostCanvasRef.current;
    if (!canvas || capture.videoSize.width <= 0 || capture.videoSize.height <= 0) {
      return;
    }
    canvas.width = capture.videoSize.width;
    canvas.height = capture.videoSize.height;
  }, [capture.videoSize]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !referenceAction) return;
    const scale = Math.min(
      1,
      GHOST_CONFIG.previewMaxWidth / referenceAction.capture.videoWidth,
    );
    canvas.width = Math.max(
      1,
      Math.round(referenceAction.capture.videoWidth * scale),
    );
    canvas.height = Math.max(
      1,
      Math.round(referenceAction.capture.videoHeight * scale),
    );
  }, [referenceAction]);

  const finishRecording = useCallback(
    (reason: "manual" | "duration" | "camera" = "manual") => {
      if (!recordingActiveRef.current) return;
      recordingActiveRef.current = false;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      const action = recorder?.stop() ?? null;
      setCountdown(null);

      if (!action) {
        setRecordingState("idle");
        setRecordingError(
          "本次没有捕获到任何姿态帧。请确认摄像头画面和人物状态后重试。",
        );
        return;
      }

      setRecordingState("stopped");
      setDraftAction(action);
      setReferenceId(action.id);
      setActionName(action.name);
      setCaptureMode(action.mode);
      setCalibration(DEFAULT_GHOST_CALIBRATION);
      setSaved(false);
      setGhostVisible(true);
      setRecordingElapsedMs(action.durationMs);
      setRecordingFrameCount(action.recording.totalFrames);
      setRecordingValidFrames(action.recording.validFrames);
      setRecordingError(
        action.recording.validFrames === 0
          ? "录制包含关键点帧，但没有达到有效阈值的帧；仍可在回放中查看原始数据。"
          : null,
      );
      playback.pause();
      setNotice(
        reason === "camera"
          ? "摄像头中断，已保留本次录制的可用关键点。"
          : reason === "duration"
            ? "录制完成，可以回放或开始 Ghost 同步。"
            : "录制已结束，可以保存、导出或回放。",
      );
    },
    [playback.pause],
  );

  const beginRecording = useCallback(() => {
    const snapshot = cameraSnapshotRef.current;
    if (snapshot.phase !== "running" || snapshot.videoSize.width <= 0) {
      setRecordingState("idle");
      setRecordingError("摄像头未处于运行状态，录制未开始。");
      return;
    }
    const deviceLabel =
      snapshot.devices.find(
        (device) => device.deviceId === snapshot.selectedDeviceId,
      )?.label ??
      (snapshot.selectedDeviceId ? "已选择摄像头" : "系统默认摄像头");

    const recorder = new MotionRecorder({
      requestedDurationMs: pendingDurationMsRef.current,
      mode: snapshot.mode,
      mirrored: false,
      targetFps: CAPTURE_CONFIG.defaultTargetFps,
      activeDelegate: snapshot.activeDelegate,
      cameraLabel: deviceLabel,
    });
    recorder.start();
    recorderRef.current = recorder;
    recordingActiveRef.current = true;
    recordingStartedPerfRef.current = performance.now();
    setRecordingState("recording");
    setRecordingElapsedMs(0);
    setRecordingFrameCount(0);
    setRecordingValidFrames(0);
    setRecordingError(null);
    setSaved(false);
    setGhostVisible(false);
    playback.pause();
    setNotice("录制中：请完成动作。");
  }, [playback.pause]);

  const beginGhostSync = useCallback(() => {
    if (!referenceActionRef.current) {
      setNotice("没有可播放的参考动作。");
      return;
    }
    setGhostVisible(true);
    playback.playFromStart();
    setNotice("Ghost 同步开始：参考骨架与实时骨架同时显示。");
  }, [playback.playFromStart]);

  const startRecordingCountdown = useCallback(() => {
    if (countdown || recordingState === "recording") return;
    if (capture.phase !== "running") {
      setRecordingError("请先启动摄像头，再开始录制。");
      return;
    }
    pendingDurationMsRef.current = durationSec * 1000;
    playback.pause();
    setGhostVisible(false);
    setRecordingError(null);
    setSaved(false);
    setRecordingState("countdown");
    setCountdown({ purpose: "record", value: GHOST_CONFIG.countdownSeconds });
  }, [capture.phase, countdown, durationSec, playback.pause, recordingState]);

  const startGhostCountdown = useCallback(() => {
    if (!referenceAction) {
      setNotice("请先选择或录制一个参考动作。");
      return;
    }
    if (capture.phase !== "running") {
      setNotice("请先启动摄像头，再开始 Ghost 同步。");
      return;
    }
    if (countdown || recordingState === "recording") return;
    playback.pause();
    playback.seek(0);
    setGhostVisible(true);
    setCountdown({ purpose: "ghost", value: GHOST_CONFIG.countdownSeconds });
  }, [capture.phase, countdown, playback.pause, playback.seek, recordingState, referenceAction]);

  useEffect(() => {
    if (!countdown) return;
    const timer = window.setTimeout(() => {
      if (countdown.value > 1) {
        setCountdown({ ...countdown, value: countdown.value - 1 });
        return;
      }
      const purpose = countdown.purpose;
      setCountdown(null);
      setAnnouncement(purpose === "record" ? "录制开始" : "Ghost 同步开始");
      if (purpose === "record") beginRecording();
      else beginGhostSync();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, beginRecording, beginGhostSync]);

  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(() => setAnnouncement(null), 1200);
    return () => window.clearTimeout(timer);
  }, [announcement]);

  useEffect(() => {
    if (!countdown) return;
    if (capture.phase === "running") return;
    setCountdown(null);
    if (countdown.purpose === "record") {
      setRecordingState("idle");
      setRecordingError("摄像头未处于运行状态，录制倒计时已取消。");
    } else {
      setNotice("摄像头已停止，Ghost 同步倒计时已取消。");
    }
  }, [capture.phase, countdown]);

  useEffect(() => {
    if (recordingState !== "recording") return;
    if (capture.phase === "running") return;
    finishRecording("camera");
  }, [capture.phase, finishRecording, recordingState]);

  useEffect(() => {
    if (recordingState !== "recording") return;
    const update = () => {
      const recorder = recorderRef.current;
      if (!recorder) return;
      const snapshot = recorder.snapshot();
      setRecordingFrameCount(snapshot.frameCount);
      setRecordingValidFrames(snapshot.validFrameCount);
      const elapsed = performance.now() - recordingStartedPerfRef.current;
      setRecordingElapsedMs(
        Math.min(elapsed, pendingDurationMsRef.current),
      );
      if (!recorder.isActive()) {
        finishRecording("duration");
      }
    };
    update();
    const timer = window.setInterval(update, 180);
    return () => window.clearInterval(timer);
  }, [finishRecording, recordingState]);

  useEffect(() => {
    const unsubscribe = capture.subscribeToPoseFrames((sample) => {
      liveFrameRef.current = sample;
      if (!recordingActiveRef.current) return;
      const recorder = recorderRef.current;
      if (!recorder) return;
      const result = recorder.addFrame(sample);
      if (result.reachedDuration) {
        finishRecording("duration");
      }
    });
    return unsubscribe;
  }, [capture.subscribeToPoseFrames, finishRecording]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleSelectReference = useCallback(
    (id: string) => {
      setReferenceId(id);
      setImportError(null);
      const action = availableActions.find((item) => item.id === id);
      if (!action) {
        setActionName("");
        playback.pause();
        setGhostVisible(false);
        return;
      }
      setCaptureMode(action.mode);
      setActionName(action.name);
      setCalibration(DEFAULT_GHOST_CALIBRATION);
      setGhostVisible(true);
      playback.pause();
    },
    [availableActions, playback.pause],
  );

  const handleSaveAction = useCallback(() => {
    if (!draftAction) return;
    const name = actionName.trim() || draftAction.name;
    const updated: GhostAction = { ...draftAction, name };
    const nextLibrary = upsertGhostAction(library, updated);
    const persisted = persistGhostLibrary(nextLibrary);
    setLibrary(nextLibrary);
    setDraftAction(updated);
    setReferenceId(updated.id);
    setActionName(updated.name);
    setSaved(persisted.ok);
    setStorageError(persisted.ok ? null : persisted.error);
    setLibraryError(persisted.ok ? null : persisted.error);
    setNotice(
      persisted.ok
        ? "动作已保存到本机浏览器动作库。"
        : "动作保存在当前页面内存中；本地持久化失败，请使用导出 JSON。",
    );
  }, [actionName, draftAction, library]);

  const handleExportAction = useCallback(() => {
    if (!referenceAction) return;
    const actionToExport =
      draftAction?.id === referenceAction.id
        ? { ...referenceAction, name: actionName.trim() || referenceAction.name }
        : referenceAction;
    downloadGhostAction(actionToExport);
    setNotice("已导出 Motion Ghost JSON（仅关键点数据）。");
  }, [actionName, draftAction, referenceAction]);

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    async (file: File) => {
      setImportError(null);
      if (file.size > 10 * 1024 * 1024) {
        setImportError("JSON 文件超过 10 MB，已拒绝加载。");
        return;
      }
      try {
        const text = await file.text();
        const result = parseGhostActionJson(text);
        if (!result.ok) {
          setImportError(result.error);
          return;
        }
        const nextLibrary = upsertGhostAction(library, result.action);
        const persisted = persistGhostLibrary(nextLibrary);
        setLibrary(nextLibrary);
        setLibraryError(persisted.ok ? null : persisted.error);
        setStorageError(persisted.ok ? null : persisted.error);
        setReferenceId(result.action.id);
        setCaptureMode(result.action.mode);
        setActionName(result.action.name);
        setCalibration(DEFAULT_GHOST_CALIBRATION);
        setGhostVisible(true);
        playback.pause();
        setNotice(
          `已导入「${result.action.name}」。${
            persisted.ok ? "" : " 但本地动作库写入失败。"
          }`,
        );
      } catch (error) {
        setImportError(
          error instanceof Error ? `读取文件失败：${error.message}` : "读取文件失败。",
        );
      }
    },
    [library, playback.pause],
  );

  const handleDeleteAction = useCallback(() => {
    if (!referenceAction) return;
    const nextLibrary = removeGhostAction(library, referenceAction.id);
    const persisted = persistGhostLibrary(nextLibrary);
    setLibrary(nextLibrary);
    if (draftAction?.id === referenceAction.id) setDraftAction(null);
    setReferenceId("");
    setActionName("");
    setSaved(false);
    setGhostVisible(false);
    setLibraryError(persisted.ok ? null : persisted.error);
    setNotice("当前参考动作已删除。");
    playback.pause();
  }, [draftAction, library, playback.pause, referenceAction]);

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleImportFile(file);
    event.target.value = "";
  };

  const cameraReady = capture.phase === "running";
  const interactionLocked =
    recordingState === "countdown" ||
    recordingState === "recording" ||
    countdown !== null;
  const overlayLabel = overlayLabels[playback.overlayStatus];
  const ghostActive =
    referenceAction !== null &&
    ghostVisible &&
    (capture.phase === "running" || capture.phase === "paused");

  const systemOverlay = (
    <>
      {ghostActive && (
        <div className="stage-ghost-legend">
          <span><i className="legend-dot legend-ghost" /> 参考 Ghost</span>
          <span><i className="legend-dot legend-live" /> 实时人体</span>
          <span className={`legend-state legend-state-${playback.overlayStatus}`}>
            {overlayLabel}
          </span>
        </div>
      )}
      {countdown && (
        <div className="countdown-overlay">
          <span className="countdown-kicker">
            {countdown.purpose === "record" ? "RECORDING IN" : "GHOST SYNC IN"}
          </span>
          <strong>{countdown.value}</strong>
          <span>
            {countdown.purpose === "record"
              ? "准备录制 · 让身体完整进入画面"
              : "准备跟随参考 Ghost · 保持全身入镜"}
          </span>
        </div>
      )}
      {!countdown && announcement && (
        <div className="countdown-overlay is-go">
          <span className="countdown-kicker">ACTION START</span>
          <strong>{announcement}</strong>
          <span>{recordingState === "recording" ? "动作录制中" : "跟随 Ghost 开始"}</span>
        </div>
      )}
    </>
  );

  return (
    <div className="ghost-page page-enter">
      <header className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            PHASE 2 · MOTION GHOST
          </div>
          <h1>动作数字分身</h1>
          <p>
            录制 MediaPipe 关键点序列，按真实时间戳回放，并在新一轮摄像头画面中
            叠加半透明青蓝 Ghost 与实时橙色骨架。全程不保存原始视频。
          </p>
        </div>
        <div className="heading-chips">
          <span className="heading-chip"><GhostIcon /> GHOST OVERLAY</span>
          <span className="heading-chip"><ScanIcon /> 33 LANDMARKS</span>
          <span className="heading-chip"><ShieldIcon /> NO VIDEO</span>
        </div>
      </header>

      {notice && (
        <div className="ghost-notice" role="status">
          <CheckIcon />
          <span>{notice}</span>
          <button className="text-button" onClick={() => setNotice(null)}>关闭</button>
        </div>
      )}

      <div className="ghost-status-strip">
        <span><ActivityIcon /> {capture.phase === "running" ? "LIVE" : "CAMERA OFFLINE"}</span>
        <span><GhostIcon /> {referenceAction ? `REF · ${referenceAction.mode === "upper-body" ? "UPPER" : "FULL"}` : "NO REFERENCE"}</span>
        <span><CpuIcon /> {capture.delegateInfo.active ?? "LOCAL"} DELEGATE</span>
        <span className="ghost-strip-grow" />
        <span>{overlayLabel}</span>
      </div>

      <div className="ghost-layout">
        <div className="ghost-main">
          <CameraStage
            videoRef={capture.videoRef}
            canvasRef={capture.canvasRef}
            ghostCanvasRef={ghostCanvasRef}
            systemOverlay={systemOverlay}
            phase={capture.phase}
            modelStatus={capture.modelStatus}
            error={capture.error}
            metrics={capture.metrics}
            live={capture.live}
            videoSize={capture.videoSize}
            delegateInfo={capture.delegateInfo}
            captureMode={captureMode}
            readiness={readiness}
            showSkeleton={showSkeleton}
            showGrid={showGrid}
            onToggleSkeleton={() => setShowSkeleton((value) => !value)}
            onToggleGrid={() => setShowGrid((value) => !value)}
            onStart={capture.start}
            onResume={capture.resume}
            onStop={capture.stop}
          />

          <GhostPlaybackPanel
            action={referenceAction}
            previewCanvasRef={previewCanvasRef}
            isPlaying={playback.isPlaying}
            speed={playback.speed}
            timeMs={playback.timeMs}
            durationMs={playback.durationMs}
            sampleStatus={playback.sampleStatus}
            overlayStatus={playback.overlayStatus}
            ghostVisible={ghostVisible}
            ghostOpacity={ghostOpacity}
            calibration={calibration}
            cameraReady={cameraReady}
            interactionLocked={interactionLocked}
            onPlay={playback.play}
            onPause={playback.pause}
            onRestart={playback.restart}
            onSeek={playback.seek}
            onSpeedChange={playback.setSpeed}
            onGhostVisibleChange={setGhostVisible}
            onGhostOpacityChange={setGhostOpacity}
            onCalibrationChange={setCalibration}
            onResetCalibration={() => setCalibration(DEFAULT_GHOST_CALIBRATION)}
            onSyncStart={startGhostCountdown}
          />
        </div>

        <aside className="ghost-sidebar">
          <GhostCameraPanel
            phase={capture.phase}
            modelStatus={capture.modelStatus}
            metrics={capture.metrics}
            delegateInfo={capture.delegateInfo}
            videoSize={capture.videoSize}
            cameraDevices={capture.cameraDevices}
            selectedDeviceId={capture.selectedDeviceId}
            devicesLoading={capture.devicesLoading}
            devicesError={capture.devicesError}
            captureMode={captureMode}
            locked={interactionLocked}
            onStart={capture.start}
            onStop={capture.stop}
            onRefreshDevices={() => { void capture.refreshDevices(); }}
            onSelectDevice={capture.selectDevice}
            onCaptureModeChange={setCaptureMode}
          />

          <GhostRecordPanel
            durationSec={durationSec}
            onDurationChange={setDurationSec}
            recordingState={recordingState}
            countdownValue={countdown?.purpose === "record" ? countdown.value : null}
            elapsedMs={recordingElapsedMs}
            frameCount={recordingFrameCount}
            validFrameCount={recordingValidFrames}
            cameraReady={cameraReady}
            locked={interactionLocked}
            action={draftAction}
            actionName={actionName}
            onActionNameChange={(name) => {
              setActionName(name);
              setSaved(false);
            }}
            saved={saved}
            storageError={storageError}
            recordingError={recordingError}
            onStartRecording={startRecordingCountdown}
            onStopRecording={() => finishRecording("manual")}
            onSave={handleSaveAction}
            onExport={handleExportAction}
            onReRecord={startRecordingCountdown}
          />

          <GhostReferencePanel
            actions={availableActions}
            selectedId={referenceId}
            reference={referenceAction}
            importError={importError}
            libraryError={libraryError}
            disabled={interactionLocked}
            onSelect={handleSelectReference}
            onImport={handleImportClick}
            onExport={handleExportAction}
            onDelete={handleDeleteAction}
          />

          {referenceAction && (
            <section className="panel ghost-detail-panel">
              <div className="panel-kicker">REFERENCE METADATA</div>
              <h2>动作数据</h2>
              <div className="reference-meta-list">
                <div><span>创建时间</span><strong>{formatTimestamp(referenceAction.createdAt)}</strong></div>
                <div><span>帧数</span><strong>{formatActionCount(referenceAction.recording.totalFrames)}</strong></div>
                <div><span>有效帧</span><strong>{referenceAction.recording.validFrames} · {(referenceAction.recording.validFrameRatio * 100).toFixed(0)}%</strong></div>
                <div><span>实测 FPS</span><strong>{referenceAction.recording.measuredFps.toFixed(1)}</strong></div>
                <div><span>摄像头</span><strong>{referenceAction.capture.cameraLabel ?? "未记录"}</strong></div>
                <div><span>源分辨率</span><strong>{referenceAction.capture.videoWidth}×{referenceAction.capture.videoHeight}</strong></div>
                <div><span>镜像</span><strong>{referenceAction.mirrored ? "是" : "否"}</strong></div>
                <div><span>Schema</span><strong>v{referenceAction.version}</strong></div>
              </div>
              <div className="ghost-detail-note">
                <WarningIcon />
                <span>
                  仅保存 MediaPipe 关键点序列与质量字段；不存在原始视频文件。
                </span>
              </div>
            </section>
          )}

          <section className="panel ghost-privacy-panel">
            <div className="panel-kicker"><ShieldIcon /> LOCAL MOTION DATA</div>
            <h2>动作数据留在本机</h2>
            <p>
              动作库使用浏览器 localStorage；导出文件由你主动保存。Ghost
              叠加完全在 Canvas 2D 中完成，不会再次运行 MediaPipe，也不会上传视频。
            </p>
            <div className="ghost-privacy-line">
              <span className="status-dot status-dot-live" />
              单一 MediaPipe 实例 · Canvas 双骨架合成
            </div>
          </section>
        </aside>
      </div>

      <input
        ref={importInputRef}
        id="ghost-import-input"
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={importFile}
      />
    </div>
  );
}
