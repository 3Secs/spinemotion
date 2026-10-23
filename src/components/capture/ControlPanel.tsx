import {
  CAPTURE_CONFIG,
  CAPTURE_MODES,
  CAPTURE_MODE_OPTIONS,
  QUALITY_THRESHOLDS,
} from "../../config/constants";
import {
  CameraIcon,
  CpuIcon,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
} from "../../components/Icons";
import { formatSeconds } from "../../lib/time";
import type {
  CameraDevice,
  CaptureMetrics,
  CaptureMode,
  CapturePhase,
  DelegateInfo,
  DelegateMode,
  ModelStatus,
} from "../../types/pose";

interface ControlPanelProps {
  phase: CapturePhase;
  modelStatus: ModelStatus;
  metrics: CaptureMetrics;
  delegateInfo: DelegateInfo;
  captureMode: CaptureMode;
  cameraDevices: CameraDevice[];
  selectedDeviceId: string;
  devicesLoading: boolean;
  devicesError: string | null;
  targetFps: number;
  delegateMode: DelegateMode;
  onCaptureModeChange: (mode: CaptureMode) => void;
  onSelectDevice: (deviceId: string) => void;
  onRefreshDevices: () => void;
  onTargetFpsChange: (fps: number) => void;
  onDelegateModeChange: (mode: DelegateMode) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

function modelLabel(status: ModelStatus, delegate: DelegateInfo["active"]): string {
  if (status === "loading") return "正在加载本地模型";
  if (status === "ready") return delegate ? `${delegate} 推理已就绪` : "本地模型已就绪";
  if (status === "error") return "模型或推理异常";
  return "等待启动";
}

export function ControlPanel({
  phase,
  modelStatus,
  metrics,
  delegateInfo,
  captureMode,
  cameraDevices,
  selectedDeviceId,
  devicesLoading,
  devicesError,
  targetFps,
  delegateMode,
  onCaptureModeChange,
  onSelectDevice,
  onRefreshDevices,
  onTargetFpsChange,
  onDelegateModeChange,
  onStart,
  onPause,
  onResume,
  onStop,
}: ControlPanelProps) {
  const isStarting = phase === "starting";
  const isRunning = phase === "running";
  const isPaused = phase === "paused";
  const isIdleOrError = phase === "idle" || phase === "error";
  const active = isRunning || isPaused || isStarting;
  const showMetrics = metrics.frames > 0;
  const modeDefinition = CAPTURE_MODES[captureMode];

  return (
    <section className="panel control-panel" aria-label="采集控制">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">CAPTURE CONTROL</span>
          <h2>采集控制台</h2>
        </div>
        <span className={`status-badge status-${phase}`}>
          {phase === "running" && "运行中"}
          {phase === "paused" && "已暂停"}
          {phase === "starting" && "启动中"}
          {phase === "idle" && "待机"}
          {phase === "error" && "异常"}
        </span>
      </div>

      <div className={`model-row model-${modelStatus}`}>
        <span className={`status-dot ${modelStatus === "ready" ? "status-dot-live" : modelStatus === "error" ? "status-dot-error" : ""}`} />
        <div>
          <strong>{modelLabel(modelStatus, delegateInfo.active)}</strong>
          <span>POSE LANDMARKER LITE · LOCAL</span>
        </div>
      </div>

      {delegateInfo.fallbackNote && (
        <div className="inline-note note-warn">
          <InfoIcon />
          <span>{delegateInfo.fallbackNote}</span>
        </div>
      )}

      <div className="mode-block">
        <div className="setting-label-row">
          <span className="setting-label">采集模式</span>
          <span className="setting-hint">只改变质控规则，不改变视野</span>
        </div>
        <div className="mode-options" role="group" aria-label="采集模式">
          {CAPTURE_MODE_OPTIONS.map((mode) => {
            const definition = CAPTURE_MODES[mode];
            return (
              <button
                key={mode}
                className={`mode-option ${captureMode === mode ? "is-active" : ""}`}
                aria-pressed={captureMode === mode}
                onClick={() => onCaptureModeChange(mode)}
              >
                <strong>{definition.label}</strong>
                <span>{definition.description}</span>
              </button>
            );
          })}
        </div>
        <p className="mode-rule">{modeDefinition.rule}</p>
      </div>

      <div className="settings-block device-block">
        <div className="setting-label-row">
          <label className="setting-label" htmlFor="camera-device">
            摄像头设备
          </label>
          <button
            type="button"
            className="text-button"
            onClick={onRefreshDevices}
            disabled={active || devicesLoading}
          >
            {devicesLoading ? "刷新中…" : "刷新设备"}
          </button>
        </div>
        <select
          id="camera-device"
          className="select"
          value={selectedDeviceId}
          disabled={active || devicesLoading}
          onChange={(event) => onSelectDevice(event.target.value)}
        >
          <option value="">系统默认摄像头</option>
          {cameraDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
        <span className="device-hint">
          {active
            ? "停止采集后可切换设备。"
            : devicesLoading
              ? "正在读取视频输入设备…"
              : cameraDevices.length > 0
                ? `${cameraDevices.length} 个视频输入 · 支持内置 / 连续互通 / USB`
                : "尚未发现设备；首次授权后会显示设备名称。"}
        </span>
        {devicesError && <span className="device-error">{devicesError}</span>}
      </div>

      <div className="control-actions">
        {isIdleOrError && (
          <button className="btn btn-primary btn-block" onClick={onStart}>
            <CameraIcon />
            {phase === "error" ? "重新启动摄像头" : "启动摄像头"}
          </button>
        )}
        {isStarting && (
          <button className="btn btn-danger-soft btn-block" onClick={onStop}>
            <StopIcon />
            取消启动
          </button>
        )}
        {isRunning && (
          <div className="button-row">
            <button className="btn btn-secondary" onClick={onPause}>
              <PauseIcon />
              暂停
            </button>
            <button className="btn btn-danger-soft" onClick={onStop}>
              <StopIcon />
              停止
            </button>
          </div>
        )}
        {isPaused && (
          <div className="button-row">
            <button className="btn btn-primary" onClick={onResume}>
              <PlayIcon />
              继续
            </button>
            <button className="btn btn-danger-soft" onClick={onStop}>
              <StopIcon />
              停止
            </button>
          </div>
        )}
      </div>

      <div className="metric-grid">
        <div className="metric">
          <span className="metric-label">实际推理 FPS</span>
          <strong className="metric-value">
            {showMetrics ? metrics.fps.toFixed(1) : "—"}
            <small>fps</small>
          </strong>
          <span className="metric-hint">最近 1.5s 滚动窗口</span>
        </div>
        <div className="metric">
          <span className="metric-label">单帧推理耗时</span>
          <strong className="metric-value">
            {showMetrics ? metrics.inferenceMs.toFixed(1) : "—"}
            <small>ms</small>
          </strong>
          <span className="metric-hint">同步 detectForVideo 墙钟</span>
        </div>
        <div className="metric">
          <span className="metric-label">已处理帧</span>
          <strong className="metric-value">
            {showMetrics ? metrics.frames.toLocaleString("zh-CN") : "—"}
            <small>帧</small>
          </strong>
          <span className="metric-hint">本次启动累计</span>
        </div>
        <div className="metric">
          <span className="metric-label">视频源时间</span>
          <strong className="metric-value">
            {showMetrics ? formatSeconds(metrics.sourceTimeSec, 2) : "—"}
          </strong>
          <span className="metric-hint">MediaStream 实际时间</span>
        </div>
      </div>

      <div className="settings-block">
        <div className="setting-label-row">
          <span className="setting-label">目标推理频率</span>
          <span className="setting-hint">与屏幕刷新解耦</span>
        </div>
        <div className="segmented" role="group" aria-label="目标推理频率">
          {CAPTURE_CONFIG.targetFpsOptions.map((fps) => (
            <button
              key={fps}
              className={targetFps === fps ? "is-active" : ""}
              aria-pressed={targetFps === fps}
              onClick={() => onTargetFpsChange(fps)}
              disabled={isStarting}
            >
              {fps} FPS
            </button>
          ))}
        </div>
      </div>

      <div className="settings-block">
        <label className="setting-label-row" htmlFor="delegate-mode">
          <span className="setting-label">推理设备</span>
          <span className="setting-hint">{active ? "下次启动生效" : "GPU 失败可回退"}</span>
        </label>
        <select
          id="delegate-mode"
          className="select"
          value={delegateMode}
          disabled={active}
          onChange={(event) => onDelegateModeChange(event.target.value as DelegateMode)}
        >
          <option value="auto">自动 · GPU 优先，失败回退 CPU</option>
          <option value="gpu">GPU · WebGL 加速</option>
          <option value="cpu">CPU · 兼容优先</option>
        </select>
      </div>

      <div className="control-footnote">
        <CpuIcon />
        <span>
          首次加载约需数秒；推理完全在浏览器本地运行，不调用云端 AI API。
        </span>
      </div>

      <div className="threshold-note">
        <InfoIcon />
        <span>
          可见性阈值 {QUALITY_THRESHOLDS.keyJointVisible.toFixed(2)}；
          Upper Body / Full Body 按各自关键点组判定。以上均为工程启发式参数，
          不是临床标准。
        </span>
      </div>
    </section>
  );
}
