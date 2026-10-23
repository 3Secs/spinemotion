import type { RefObject } from "react";
import {
  ActivityIcon,
  GhostIcon,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  RotateIcon,
  SlidersIcon,
  WarningIcon,
} from "../Icons";
import type {
  GhostAction,
  GhostCalibration,
  GhostSampleStatus,
} from "../../types/ghost";
import type { GhostOverlayStatus } from "../../hooks/useGhostPlayback";

interface GhostPlaybackPanelProps {
  action: GhostAction | null;
  previewCanvasRef: RefObject<HTMLCanvasElement | null>;
  isPlaying: boolean;
  speed: number;
  timeMs: number;
  durationMs: number;
  sampleStatus: GhostSampleStatus;
  overlayStatus: GhostOverlayStatus;
  ghostVisible: boolean;
  ghostOpacity: number;
  calibration: GhostCalibration;
  cameraReady: boolean;
  interactionLocked: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSeek: (timeMs: number) => void;
  onSpeedChange: (speed: number) => void;
  onGhostVisibleChange: (visible: boolean) => void;
  onGhostOpacityChange: (opacity: number) => void;
  onCalibrationChange: (calibration: GhostCalibration) => void;
  onResetCalibration: () => void;
  onSyncStart: () => void;
}

const SPEED_OPTIONS = [0.5, 1, 1.5] as const;

const overlayLabels: Record<GhostOverlayStatus, string> = {
  off: "GHOST HIDDEN",
  "waiting-camera": "WAITING CAMERA",
  "waiting-live": "WAITING LIVE BODY",
  uncalibrated: "ALIGNING BODY",
  gap: "REFERENCE GAP",
  ready: "GHOST LIVE",
};

const sampleLabels: Record<GhostSampleStatus, string> = {
  empty: "无动作",
  first: "起始帧",
  last: "结束帧",
  interpolated: "时间插值",
  held: "短暂保持",
  gap: "关键帧缺失",
};

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00.0";
  const seconds = ms / 1000;
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${(seconds - minutes * 60)
    .toFixed(1)
    .padStart(4, "0")}`;
}

export function GhostPlaybackPanel({
  action,
  previewCanvasRef,
  isPlaying,
  speed,
  timeMs,
  durationMs,
  sampleStatus,
  overlayStatus,
  ghostVisible,
  ghostOpacity,
  calibration,
  cameraReady,
  interactionLocked,
  onPlay,
  onPause,
  onRestart,
  onSeek,
  onSpeedChange,
  onGhostVisibleChange,
  onGhostOpacityChange,
  onCalibrationChange,
  onResetCalibration,
  onSyncStart,
}: GhostPlaybackPanelProps) {
  const aspect = action
    ? `${action.capture.videoWidth} / ${action.capture.videoHeight}`
    : "16 / 9";
  const hasAction = Boolean(action);
  const controlsDisabled = !hasAction || interactionLocked;

  return (
    <section className="panel ghost-playback-panel" aria-label="动作回放与 Ghost">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">PLAYBACK / DIGITAL DOUBLE</span>
          <h2>回放与 Ghost 叠加</h2>
        </div>
        <span className={`signal-pill ${isPlaying ? "signal-ok" : overlayStatus === "ready" ? "signal-ok" : "signal-none"}`}>
          {isPlaying ? "PLAYING" : overlayLabels[overlayStatus]}
        </span>
      </div>

      <div className="ghost-playback-grid">
        <div className="ghost-preview-wrap">
          <div className="ghost-preview-frame" style={{ aspectRatio: aspect }}>
            <canvas ref={previewCanvasRef} className="ghost-preview-canvas" />
            {!action && (
              <div className="ghost-preview-empty">
                <GhostIcon />
                <strong>还没有参考动作</strong>
                <span>完成一次录制或导入 JSON 后，这里会显示骨架回放。</span>
              </div>
            )}
            {action && (
              <>
                <span className="ghost-preview-tag">REFERENCE GHOST · {action.mode === "upper-body" ? "UPPER" : "FULL"}</span>
                {sampleStatus === "gap" && (
                  <span className="ghost-gap-tag"><WarningIcon /> 参考关键帧缺失</span>
                )}
              </>
            )}
          </div>
          <div className="ghost-preview-meta">
            <span><GhostIcon /> 青蓝 = 参考</span>
            <span><ActivityIcon /> 橙色 = 实时</span>
            <span className="meta-grow" />
            <span>{action ? `有效帧 ${(action.recording.validFrameRatio * 100).toFixed(0)}%` : "—"}</span>
          </div>
        </div>

        <div className="ghost-playback-controls">
          <div className="playback-buttons">
            <button
              className="btn btn-primary"
              onClick={isPlaying ? onPause : onPlay}
              disabled={controlsDisabled}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
              {isPlaying ? "暂停" : "播放"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onRestart}
              disabled={controlsDisabled}
            >
              <RotateIcon />
              重新播放
            </button>
          </div>

          <div className="timeline-block">
            <input
              className="range-input"
              type="range"
              min={0}
              max={Math.max(1, durationMs)}
              step={10}
              value={Math.min(timeMs, Math.max(1, durationMs))}
              disabled={controlsDisabled}
              onChange={(event) => onSeek(Number(event.target.value))}
              aria-label="动作回放进度"
            />
            <div className="timeline-labels">
              <span>{formatTime(timeMs)}</span>
              <span className="mono-muted">{sampleLabels[sampleStatus]}</span>
              <span>{formatTime(durationMs)}</span>
            </div>
          </div>

          <div className="playback-speed-row">
            <span className="setting-label">播放速度</span>
            <div className="segmented speed-segmented" role="group" aria-label="播放速度">
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={speed === option ? "is-active" : ""}
                  aria-pressed={speed === option}
                  onClick={() => onSpeedChange(option)}
                  disabled={controlsDisabled}
                >
                  {option}×
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary btn-block ghost-sync-button"
            onClick={onSyncStart}
            disabled={!hasAction || !cameraReady || interactionLocked}
          >
            <GhostIcon />
            开始 3 秒 Ghost 同步
          </button>
          <span className="ghost-sync-hint">
            {!cameraReady
              ? "先启动摄像头，才能把 Ghost 叠加到实时画面上。"
              : interactionLocked
                ? "录制或倒计时期间不可启动 Ghost 同步。"
                : "倒计时结束后，参考 Ghost 与实时骨架同时开始。"}
          </span>
        </div>
      </div>

      <div className="ghost-settings">
        <div className="ghost-settings-head">
          <span><SlidersIcon /> Ghost 显示与位置校准</span>
          <button
            className={`toggle ${ghostVisible ? "is-on" : ""}`}
            aria-pressed={ghostVisible}
            onClick={() => onGhostVisibleChange(!ghostVisible)}
          >
            {ghostVisible ? "Ghost 显示中" : "Ghost 已隐藏"}
          </button>
        </div>

        <div className="ghost-slider-grid">
          <label className="range-field">
            <span>Ghost 透明度 <strong>{(ghostOpacity * 100).toFixed(0)}%</strong></span>
            <input
              className="range-input"
              type="range"
              min={15}
              max={90}
              step={1}
              value={Math.round(ghostOpacity * 100)}
              onChange={(event) => onGhostOpacityChange(Number(event.target.value) / 100)}
            />
          </label>
          <label className="range-field">
            <span>参考缩放 <strong>{calibration.scale.toFixed(2)}×</strong></span>
            <input
              className="range-input"
              type="range"
              min={70}
              max={130}
              step={1}
              value={Math.round(calibration.scale * 100)}
              onChange={(event) =>
                onCalibrationChange({
                  ...calibration,
                  scale: Number(event.target.value) / 100,
                })
              }
            />
          </label>
          <label className="range-field">
            <span>水平偏移 <strong>{(calibration.offsetX * 100).toFixed(0)}%</strong></span>
            <input
              className="range-input"
              type="range"
              min={-25}
              max={25}
              step={1}
              value={Math.round(calibration.offsetX * 100)}
              onChange={(event) =>
                onCalibrationChange({
                  ...calibration,
                  offsetX: Number(event.target.value) / 100,
                })
              }
            />
          </label>
          <label className="range-field">
            <span>垂直偏移 <strong>{(calibration.offsetY * 100).toFixed(0)}%</strong></span>
            <input
              className="range-input"
              type="range"
              min={-25}
              max={25}
              step={1}
              value={Math.round(calibration.offsetY * 100)}
              onChange={(event) =>
                onCalibrationChange({
                  ...calibration,
                  offsetY: Number(event.target.value) / 100,
                })
              }
            />
          </label>
        </div>

        <div className="calibration-footer">
          <span>
            <InfoIcon />
            自动以髋部/躯干对齐当前人体。不同站位通常无需手动调整。
          </span>
          <button className="text-button" onClick={onResetCalibration}>
            重置校准
          </button>
        </div>
      </div>
    </section>
  );
}
