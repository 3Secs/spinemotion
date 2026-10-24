import type { ArenaScore } from "../../types/arena";
import type { GhostAction } from "../../types/ghost";

interface Props {
  score: ArenaScore | null;
  actionA: GhostAction | null;
  actionB: GhostAction | null;
  progress: number;
  selectedJoint: number | null;
  onSelectJoint: (idx: number | null) => void;
  onJumpMs: (ms: number) => void;
}

export default function DifferencePanel({
  score, actionA, actionB, progress, selectedJoint,
  onSelectJoint, onJumpMs,
}: Props) {
  if (!score) return null;

  const diffs = score.jointDifferences.slice(0, 3);
  const moments = score.keyMoments;
  const maxDurMs = actionA && actionB ? Math.max(actionA.durationMs, actionB.durationMs) : 1;
  // Normalized-space scale hint: mean distance is in normalized image units
  const maxDist = diffs.length > 0 ? diffs[0].meanDistance : 0;

  return (
    <div className="diff-panel">
      <h3 className="diff-heading">差异分析</h3>

      {/* Top differences (2–3 body parts, Chinese names only) */}
      <div className="diff-joints">
        {diffs.map((jd) => {
          const isSel = selectedJoint === jd.landmarkIndex;
          const pct = maxDist > 0 ? Math.round((jd.meanDistance / maxDist) * 100) : 0;
          return (
            <button
              key={jd.landmarkIndex}
              className={`diff-joint-chip ${isSel ? "is-selected" : ""}`}
              onClick={() => onSelectJoint(isSel ? null : jd.landmarkIndex)}
              title={`差异程度 ${pct}% · 点击在回放中定位该部位`}
            >
              <span className="diff-joint-name">{jd.labelZh}</span>
              <span className="diff-joint-bar">
                <span style={{ width: `${Math.max(4, pct)}%` }} />
              </span>
              <span className="diff-joint-val">{pct}%</span>
            </button>
          );
        })}
      </div>

      {/* Plain-language note: what the number means */}
      <p className="diff-note">
        差异值表示两段动作在该部位上的轨迹偏离程度（数值越大差异越明显），用于趣味对比，不代表角度或临床异常。
      </p>

      {/* Key moments timeline */}
      {moments.length > 0 && (
        <div className="diff-timeline">
          <div className="diff-timeline-bar">
            {/* Background */}
            <div className="diff-timeline-bg" />
            {/* Moments */}
            {moments.map((m, i) => {
              const leftPct = (m.startMs / maxDurMs) * 100;
              const widthPct = ((m.endMs - m.startMs) / maxDurMs) * 100;
              return (
                <button
                  key={i}
                  className="diff-moment-marker"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  onClick={() => onJumpMs(m.startMs)}
                  title={`${(m.startMs / 1000).toFixed(1)}s–${(m.endMs / 1000).toFixed(1)}s · 差异 ${(m.meanDistance * 100).toFixed(0)}%`}
                >
                  <span className="diff-moment-label">{`${(m.startMs / 1000).toFixed(1)}s`}</span>
                </button>
              );
            })}
            {/* Playhead */}
            <div className="diff-timeline-playhead" style={{ left: `${progress * 100}%` }} />
          </div>
          <div className="diff-timeline-labels">
            <span>0s</span>
            <span>{(maxDurMs / 1000).toFixed(1)}s</span>
          </div>
          <p className="diff-timeline-hint">点击深色区段可跳转到该时间的回放位置</p>
        </div>
      )}
    </div>
  );
}