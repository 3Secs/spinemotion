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

  const diffs = score.jointDifferences.slice(0, 6);
  const moments = score.keyMoments;
  const maxDurMs = actionA && actionB ? Math.max(actionA.durationMs, actionB.durationMs) : 1;

  return (
    <div className="diff-panel">
      <h3 className="diff-heading">差异分析</h3>

      {/* Joint ranking */}
      <div className="diff-joints">
        {diffs.map((jd) => {
          const isSel = selectedJoint === jd.landmarkIndex;
          return (
            <button
              key={jd.landmarkIndex}
              className={`diff-joint-chip ${isSel ? "is-selected" : ""}`}
              onClick={() => onSelectJoint(isSel ? null : jd.landmarkIndex)}
              title={`均值 ${jd.meanDistance.toFixed(4)} 峰值 ${jd.maxDistance.toFixed(4)}`}
            >
              <span className="diff-joint-idx">#{jd.landmarkIndex}</span>
              <span className="diff-joint-name">{jd.labelZh}</span>
              <span className="diff-joint-val" style={{ opacity: Math.min(1, jd.meanDistance * 5 + 0.4) }}>
                {jd.meanDistance.toFixed(3)}
              </span>
            </button>
          );
        })}
      </div>

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
                  title={`${(m.startMs / 1000).toFixed(1)}s–${(m.endMs / 1000).toFixed(1)}s · 差异 ${m.meanDistance.toFixed(3)}`}
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
        </div>
      )}

      {/* Explanation */}
      <div className="diff-explanation">
        <p>{score.explanation}</p>
      </div>
    </div>
  );
}