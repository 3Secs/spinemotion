import {
  GHOST_CONFIG,
} from "../../config/constants";
import {
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  RecordIcon,
  SaveIcon,
  StopIcon,
  WarningIcon,
} from "../Icons";
import type { GhostAction } from "../../types/ghost";

export type GhostRecordingState = "idle" | "countdown" | "recording" | "stopped";

interface GhostRecordPanelProps {
  durationSec: number;
  onDurationChange: (seconds: number) => void;
  recordingState: GhostRecordingState;
  countdownValue: number | null;
  elapsedMs: number;
  frameCount: number;
  validFrameCount: number;
  cameraReady: boolean;
  locked: boolean;
  action: GhostAction | null;
  actionName: string;
  onActionNameChange: (name: string) => void;
  saved: boolean;
  storageError: string | null;
  recordingError: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSave: () => void;
  onExport: () => void;
  onReRecord: () => void;
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00.0";
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

export function GhostRecordPanel({
  durationSec,
  onDurationChange,
  recordingState,
  countdownValue,
  elapsedMs,
  frameCount,
  validFrameCount,
  cameraReady,
  locked,
  action,
  actionName,
  onActionNameChange,
  saved,
  storageError,
  recordingError,
  onStartRecording,
  onStopRecording,
  onSave,
  onExport,
  onReRecord,
}: GhostRecordPanelProps) {
  const recording = recordingState === "recording";
  const countdown = recordingState === "countdown";
  const stopped = recordingState === "stopped";
  const durationMs = durationSec * 1000;
  const progress = Math.min(1, elapsedMs / durationMs);
  const validRatio =
    frameCount > 0 ? validFrameCount / frameCount : 0;
  const displayAction = stopped ? action : null;

  return (
    <section className="panel ghost-record-panel" aria-label="动作录制">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">MOTION RECORDER</span>
          <h2>动作录制</h2>
        </div>
        <span className={`signal-pill ${recording ? "signal-partial" : countdown ? "signal-paused" : ""}`}>
          {recording ? "REC" : countdown ? "READY" : stopped ? "CAPTURED" : "IDLE"}
        </span>
      </div>

      <div className="setting-label-row">
        <span className="setting-label">录制时长</span>
        <span className="setting-hint">{durationSec} 秒 · 可设 5–15 秒</span>
      </div>
      <input
        className="range-input"
        type="range"
        min={GHOST_CONFIG.minDurationSec}
        max={GHOST_CONFIG.maxDurationSec}
        step={1}
        value={durationSec}
        disabled={recording || countdown || locked}
        onChange={(event) => onDurationChange(Number(event.target.value))}
        aria-label="录制时长（秒）"
      />
      <div className="range-labels">
        <span>5s</span>
        <span>8s 默认</span>
        <span>15s</span>
      </div>

      {(recording || countdown) && (
        <div className="record-progress-block">
          <div className="record-progress-head">
            <span>
              {countdown
                ? `倒计时 ${countdownValue ?? ""}`
                : `录制中 ${formatMs(elapsedMs)} / ${formatMs(durationMs)}`}
            </span>
            <span className="mono-muted">{frameCount} 帧 · 有效 {validFrameCount}</span>
          </div>
          <div className="record-progress-track">
            <span style={{ width: `${countdown ? 0 : progress * 100}%` }} />
          </div>
          <div className="record-stats-row">
            <span><RecordIcon /> 有效帧 {frameCount > 0 ? `${(validRatio * 100).toFixed(0)}%` : "—"}</span>
            <span><ClockIcon /> 目标 {durationSec}s</span>
          </div>
        </div>
      )}

      {displayAction && (
        <div className="capture-summary">
          <div className="capture-summary-grid">
            <div>
              <span>实际时长</span>
              <strong>{formatMs(displayAction.durationMs)}</strong>
            </div>
            <div>
              <span>总帧 / 有效帧</span>
              <strong>{displayAction.recording.totalFrames} / {displayAction.recording.validFrames}</strong>
            </div>
            <div>
              <span>有效帧占比</span>
              <strong>{(displayAction.recording.validFrameRatio * 100).toFixed(0)}%</strong>
            </div>
            <div>
              <span>实际录制 FPS</span>
              <strong>{displayAction.recording.measuredFps.toFixed(1)}</strong>
            </div>
          </div>
          <label className="action-name-row">
            <span>动作名称</span>
            <input
              className="text-input"
              value={actionName}
              maxLength={80}
              disabled={locked}
              onChange={(event) => onActionNameChange(event.target.value)}
              placeholder="给这段动作起个名字"
            />
          </label>
        </div>
      )}

      {storageError && (
        <div className="inline-note note-warn">
          <WarningIcon />
          <span>{storageError}</span>
        </div>
      )}
      {recordingError && (
        <div className="inline-note note-warn">
          <WarningIcon />
          <span>{recordingError}</span>
        </div>
      )}

      <div className="control-actions">
        {!recording && !countdown && (
          <button
            className="btn btn-primary btn-block"
            onClick={stopped ? onReRecord : onStartRecording}
            disabled={!cameraReady || locked}
          >
            <RecordIcon />
            {stopped ? "重新录制" : "开始录制"}
          </button>
        )}
        {recording && (
          <button className="btn btn-danger-soft btn-block" onClick={onStopRecording}>
            <StopIcon />
            结束录制
          </button>
        )}
        {countdown && (
          <button className="btn btn-secondary btn-block" disabled>
            <ClockIcon />
            倒计时 {countdownValue ?? ""}…
          </button>
        )}
      </div>

      {displayAction && (
        <div className="button-row record-save-row">
          <button className="btn btn-primary" onClick={onSave} disabled={locked}>
            {saved ? <CheckIcon /> : <SaveIcon />}
            {saved ? "已保存 · 更新" : "保存到动作库"}
          </button>
          <button className="btn btn-ghost" onClick={onExport} disabled={locked}>
            <DownloadIcon />
            导出 JSON
          </button>
        </div>
      )}

      <div className="record-footnote">
        {cameraReady
          ? "只保存 33 点关键点、可见性、presence 与时间戳；不保存任何摄像头视频。"
          : "请先在右侧/上方启动摄像头，再开始录制。"}
        {displayAction && (
          <span className="saved-hint">
            <CheckIcon /> 本地动作库与 JSON 均只在浏览器中处理
          </span>
        )}
      </div>
    </section>
  );
}
