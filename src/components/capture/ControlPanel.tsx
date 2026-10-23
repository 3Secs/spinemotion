import {
  CAPTURE_CONFIG,
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
  CaptureMetrics,
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
  targetFps: number;
  delegateMode: DelegateMode;
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
  targetFps,
  delegateMode,
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
          可见性阈值 {QUALITY_THRESHOLDS.keyJointVisible.toFixed(2)}、
          关键关节 ≥ {QUALITY_THRESHOLDS.minVisibleKeyJoints}/8 仅用于实时提示，
          属于工程启发式参数。
        </span>
      </div>
    </section>
  );
}
