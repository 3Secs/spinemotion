import {
  KEY_JOINT_INDICES,
  LANDMARK_LABELS_ZH,
  QUALITY_THRESHOLDS,
} from "../../config/constants";
import { CrosshairIcon, WarningIcon } from "../../components/Icons";
import type { CapturePhase, LivePoseState } from "../../types/pose";

interface KeypointPanelProps {
  live: LivePoseState;
  phase: CapturePhase;
}

export function KeypointPanel({ live, phase }: KeypointPanelProps) {
  const isPaused = phase === "paused";
  const hasPose = live.hasPose;

  return (
    <section className="panel keypoint-panel" aria-label="关键点可见性">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">LANDMARK VISIBILITY</span>
          <h2>关键关节可见性</h2>
        </div>
        <span className={`signal-pill signal-${isPaused ? "paused" : live.signal}`}>
          {isPaused
            ? "PAUSED"
            : live.signal === "ok"
              ? "TRACKING"
              : live.signal === "partial"
                ? "PARTIAL"
                : live.signal === "lost"
                  ? "LOST"
                  : "SEARCHING"}
        </span>
      </div>

      <div className="visibility-summary">
        <div>
          <span>可见关键关节</span>
          <strong>{hasPose ? live.visibleKeyJoints : "—"}<small>/ 8</small></strong>
        </div>
        <div>
          <span>33 点平均可见性</span>
          <strong>{hasPose ? `${(live.visibilityAverage * 100).toFixed(0)}%` : "—"}</strong>
        </div>
        <div>
          <span>判定阈值</span>
          <strong>{QUALITY_THRESHOLDS.keyJointVisible.toFixed(2)}</strong>
        </div>
      </div>

      <div className="joint-grid">
        {KEY_JOINT_INDICES.map((index) => {
          const visibility = live.landmarks?.[index]?.visibility ?? 0;
          const visible = Boolean(live.landmarks) && visibility >= QUALITY_THRESHOLDS.keyJointVisible;
          return (
            <div className={`joint-row ${visible ? "is-visible" : ""}`} key={index}>
              <div className="joint-meta">
                <span className="joint-name">{LANDMARK_LABELS_ZH[index]}</span>
                <span className="joint-index">#{index.toString().padStart(2, "0")}</span>
                <span className="joint-value">
                  {live.landmarks ? visibility.toFixed(2) : "—"}
                </span>
              </div>
              <div className="visibility-track">
                <span style={{ width: `${Math.min(1, visibility) * 100}%` }} />
                <i
                  className="threshold-marker"
                  style={{ left: `${QUALITY_THRESHOLDS.keyJointVisible * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {!hasPose && (
        <div className="empty-hint">
          <CrosshairIcon />
          <span>启动摄像头并站入画面后，这里会显示实时可见性。</span>
        </div>
      )}

      {hasPose && live.signal === "partial" && (
        <div className="inline-note note-warn">
          <WarningIcon />
          <span>
            部分关键关节低于可见性阈值。此提示用于测量质量提醒，不构成医学判断。
          </span>
        </div>
      )}
    </section>
  );
}
