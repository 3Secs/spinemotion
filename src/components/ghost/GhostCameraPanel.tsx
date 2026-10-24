import {
  CAPTURE_MODES,
  CAPTURE_MODE_OPTIONS,
} from "../../config/constants";
import {
  CameraIcon,
  InfoIcon,
  StopIcon,
} from "../Icons";
import type {
  CameraDevice,
  CaptureMetrics,
  CaptureMode,
  CapturePhase,
  DelegateInfo,
  ModelStatus,
  VideoSize,
} from "../../types/pose";

interface GhostCameraPanelProps {
  phase: CapturePhase;
  modelStatus: ModelStatus;
  metrics: CaptureMetrics;
  delegateInfo: DelegateInfo;
  videoSize: VideoSize;
  cameraDevices: CameraDevice[];
  selectedDeviceId: string;
  devicesLoading: boolean;
  devicesError: string | null;
  captureMode: CaptureMode;
  locked: boolean;
  onStart: () => void;
  onStop: () => void;
  onRefreshDevices: () => void;
  onSelectDevice: (deviceId: string) => void;
  onCaptureModeChange: (mode: CaptureMode) => void;
  /** 紧凑模式：隐藏次要指标与长提示，用于 Arena 页顶部卡片 */
  compact?: boolean;
}

export function GhostCameraPanel({
  phase,
  modelStatus,
  metrics,
  delegateInfo,
  videoSize,
  cameraDevices,
  selectedDeviceId,
  devicesLoading,
  devicesError,
  captureMode,
  locked,
  onStart,
  onStop,
  onRefreshDevices,
  onSelectDevice,
  onCaptureModeChange,
  compact = false,
}: GhostCameraPanelProps) {
  const active = phase === "starting" || phase === "running" || phase === "paused";
  const running = phase === "running";
  const canStart = !active;
  const canStop = active && !locked;
  const source =
    videoSize.width > 0 ? `${videoSize.width}×${videoSize.height}` : "—";
  const modeDefinition = CAPTURE_MODES[captureMode];

  return (
    <section className="panel ghost-camera-panel" aria-label="Motion Ghost 摄像头控制">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">CAMERA / MODE</span>
          <h2>摄像头与采集模式</h2>
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
          <strong>
            {modelStatus === "loading"
              ? "正在加载本地模型"
              : modelStatus === "ready"
                ? `${delegateInfo.active ?? "本地"} 推理已就绪`
                : modelStatus === "error"
                  ? "模型或推理异常"
                  : "等待启动"}
          </strong>
          <span>本地 AI 姿态推理</span>
        </div>
      </div>

      <div className="mode-block">
        <div className="setting-label-row">
          <span className="setting-label">采集模式</span>
          <span className="setting-hint">录制期间锁定</span>
        </div>
        <div className="mode-options" role="group" aria-label="Motion Ghost 采集模式">
          {CAPTURE_MODE_OPTIONS.map((mode) => {
            const definition = CAPTURE_MODES[mode];
            return (
              <button
                key={mode}
                className={`mode-option ${captureMode === mode ? "is-active" : ""}`}
                aria-pressed={captureMode === mode}
                disabled={locked}
                onClick={() => onCaptureModeChange(mode)}
              >
                <strong>{definition.label}</strong>
                <span>{definition.description}</span>
              </button>
            );
          })}
        </div>
        {!compact && <p className="mode-rule">{modeDefinition.rule}</p>}
      </div>

      <div className="settings-block device-block">
        <div className="setting-label-row">
          <label className="setting-label" htmlFor="ghost-camera-device">
            摄像头设备
          </label>
          <button
            type="button"
            className="text-button"
            onClick={onRefreshDevices}
            disabled={active || locked || devicesLoading}
          >
            {devicesLoading ? "刷新中…" : "刷新设备"}
          </button>
        </div>
        <select
          id="ghost-camera-device"
          className="select"
          value={selectedDeviceId}
          disabled={active || locked || devicesLoading}
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
          {compact
            ? cameraDevices.length > 0
              ? `${cameraDevices.length} 个视频输入`
              : "首次授权后显示设备名称"
            : active
              ? "停止摄像头后可切换设备。"
              : devicesLoading
                ? "正在读取视频输入设备…"
                : cameraDevices.length > 0
                  ? `${cameraDevices.length} 个视频输入 · 内置 / 连续互通 / USB`
                  : "首次授权后显示设备名称。"}
        </span>
        {devicesError && <span className="device-error">{devicesError}</span>}
      </div>

      {!compact && (
        <div className="ghost-mini-metrics">
          <span><strong>{running && metrics.frames > 0 ? metrics.fps.toFixed(1) : "—"}</strong> FPS</span>
          <span><strong>{running && metrics.frames > 0 ? metrics.inferenceMs.toFixed(1) : "—"}</strong> ms</span>
          <span><strong>{source}</strong> 源画面</span>
        </div>
      )}

      <div className="control-actions">
        {canStart && (
          <button className="btn btn-primary btn-block" onClick={onStart}>
            <CameraIcon />
            {phase === "error" ? "重新启动摄像头" : "启动摄像头"}
          </button>
        )}
        {active && (
          <button
            className="btn btn-danger-soft btn-block"
            onClick={onStop}
            disabled={!canStop}
          >
            <StopIcon />
            {phase === "starting" ? "取消启动" : "停止摄像头"}
          </button>
        )}
      </div>

      {!compact && (
        <div className="control-footnote">
          <InfoIcon />
          <span>
            Motion Ghost 只改变所需关键点和 Ghost 对齐，不裁切或放大原始摄像头画面。
            {locked ? " 当前录制/倒计时期间摄像头控制已锁定。" : ""}
          </span>
        </div>
      )}
    </section>
  );
}
