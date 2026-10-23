import {
  CAPTURE_MODES,
  LANDMARK_LABELS_ZH,
  QUALITY_THRESHOLDS,
} from "../../config/constants";
import { CrosshairIcon, WarningIcon } from "../../components/Icons";
import type {
  CaptureMode,
  CapturePhase,
  CaptureReadiness,
  LivePoseState,
} from "../../types/pose";

interface KeypointPanelProps {
  live: LivePoseState;
  phase: CapturePhase;
  captureMode: CaptureMode;
  readiness: CaptureReadiness;
}

export function KeypointPanel({
  live,
  phase,
  captureMode,
  readiness,
}: KeypointPanelProps) {
  const isPaused = phase === "paused";
  const hasPose = live.hasPose;
  const modeDefinition = CAPTURE_MODES[captureMode];
  const statusLabel = isPaused
    ? "PAUSED"
    : !hasPose
      ? live.signal === "lost"
        ? "LOST"
        : "SEARCHING"
      : readiness.ready
        ? "READY"
        : "ADJUST";
  const statusTone = isPaused
    ? "paused"
    : !hasPose
      ? live.signal === "lost"
        ? "lost"
        : "none"
      : readiness.ready
        ? "ok"
        : "partial";

  return (
    <section
      className="panel keypoint-panel"
      aria-label={`${modeDefinition.label} 关键点可见性`}
    >
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">
            {captureMode === "upper-body"
              ? "UPPER BODY LANDMARKS"
              : "FULL BODY LANDMARKS"}
          </span>
          <h2>{modeDefinition.label} 关键点</h2>
        </div>
        <span className={`signal-pill signal-${statusTone}`}>{statusLabel}</span>
      </div>

      <div className="visibility-summary">
        <div>
          <span>可见核心组</span>
          <strong>
            {hasPose ? readiness.visibleGroups : "—"}
            <small>/ {readiness.totalGroups}</small>
          </strong>
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

      <p className="keypoint-rule">{modeDefinition.rule}</p>

      <div className="joint-grid">
        {modeDefinition.displayIndices.map((index) => {
          const visibility = live.landmarks?.[index]?.visibility ?? 0;
          const visible =
            Boolean(live.landmarks) &&
            visibility >= QUALITY_THRESHOLDS.keyJointVisible;
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
          <span>
            启动摄像头后，这里会显示 {modeDefinition.label} 模式要求的实时可见性。
          </span>
        </div>
      )}

      {hasPose && !readiness.ready && (
        <div className="inline-note note-warn">
          <WarningIcon />
          <span>
            缺少稳定可见：{readiness.missingLabels.join("、") || "关键关节"}。
            {captureMode === "upper-body"
              ? " 本模式不要求下肢入镜。"
              : " Full Body 要求头、肩、髋、膝、踝均位于画面内。"}
            此提示用于采集质量提醒，不构成医学判断。
          </span>
        </div>
      )}
    </section>
  );
}
