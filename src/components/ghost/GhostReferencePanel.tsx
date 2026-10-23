import {
  DownloadIcon,
  InfoIcon,
  TrashIcon,
  UploadIcon,
  WarningIcon,
} from "../Icons";
import type { GhostAction } from "../../types/ghost";

interface GhostReferencePanelProps {
  actions: GhostAction[];
  selectedId: string;
  reference: GhostAction | null;
  importError: string | null;
  libraryError: string | null;
  disabled: boolean;
  onSelect: (actionId: string) => void;
  onImport: () => void;
  onExport: () => void;
  onDelete: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  return `${seconds.toFixed(1)}s`;
}

export function GhostReferencePanel({
  actions,
  selectedId,
  reference,
  importError,
  libraryError,
  disabled,
  onSelect,
  onImport,
  onExport,
  onDelete,
}: GhostReferencePanelProps) {
  return (
    <section className="panel ghost-reference-panel" aria-label="参考动作管理">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">REFERENCE ACTIONS</span>
          <h2>参考动作</h2>
        </div>
        <span className="ghost-count">{actions.length} 个</span>
      </div>

      <div className="setting-label-row">
        <label className="setting-label" htmlFor="ghost-reference-select">
          选择 / 切换参考
        </label>
        <span className="setting-hint">v1 · LOCAL</span>
      </div>
      <select
        id="ghost-reference-select"
        className="select"
        value={selectedId}
        disabled={disabled}
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="">选择一个动作…</option>
        {actions.map((action) => (
          <option key={action.id} value={action.id}>
            {action.name} · {action.mode === "upper-body" ? "Upper" : "Full"} · {formatDuration(action.durationMs)}
          </option>
        ))}
      </select>

      {reference && (
        <div className="reference-summary">
          <div>
            <span>模式</span>
            <strong>{reference.mode === "upper-body" ? "Upper Body" : "Full Body"}</strong>
          </div>
          <div>
            <span>总时长</span>
            <strong>{formatDuration(reference.durationMs)}</strong>
          </div>
          <div>
            <span>帧数</span>
            <strong>{reference.recording.totalFrames}</strong>
          </div>
          <div>
            <span>有效帧</span>
            <strong>{(reference.recording.validFrameRatio * 100).toFixed(0)}%</strong>
          </div>
          <div>
            <span>源画面</span>
            <strong>{reference.capture.videoWidth}×{reference.capture.videoHeight}</strong>
          </div>
          <div>
            <span>镜像</span>
            <strong>{reference.mirrored ? "是" : "否"}</strong>
          </div>
        </div>
      )}

      {!reference && (
        <div className="empty-hint">
          <InfoIcon />
          <span>先录制一段动作，或导入已有 Motion Ghost JSON。参考动作只包含关键点，不包含视频。</span>
        </div>
      )}

      {(importError || libraryError) && (
        <div className="inline-note note-warn">
          <WarningIcon />
          <span>{importError ?? libraryError}</span>
        </div>
      )}

      <div className="button-row reference-actions">
        <button className="btn btn-secondary btn-sm" onClick={onImport} disabled={disabled}>
          <UploadIcon />
          导入 JSON
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onExport}
          disabled={!reference}
        >
          <DownloadIcon />
          导出 JSON
        </button>
      </div>
      <button
        className="text-button danger-text"
        onClick={onDelete}
        disabled={!reference || disabled}
      >
        <TrashIcon /> 删除当前参考动作
      </button>

      <div className="control-footnote">
        <InfoIcon />
        <span>
          动作库保存在本机 localStorage，可导出为 JSON 长期保存；不会上传。
        </span>
      </div>
    </section>
  );
}
