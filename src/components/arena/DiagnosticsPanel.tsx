import { useState } from "react";
import type { ArenaScore } from "../../types/arena";
import type { ArenaScoreMode } from "../../lib/arena/scoring";
import type { GhostAction } from "../../types/ghost";
import type { CaptureMode } from "../../types/pose";

interface Props {
  actionA: GhostAction | null;
  actionB: GhostAction | null;
  score: ArenaScore | null;
  scoreMode: ArenaScoreMode;
  captureMode: CaptureMode;
  durationSec: number;
  recordingElapsedMs: number;
  recordingFrameCount: number;
  recordingValidFrames: number;
  refusalReason: string | null;
  refusalWarnings: string[];
}

function ActionStats({ action, label }: { action: GhostAction | null; label: string }) {
  if (!action) return <div className="diag-section"><h5>{label}</h5><span className="diag-na">无数据</span></div>;
  const dur = (action.durationMs / 1000).toFixed(1);
  const validPct = action.recording.totalFrames > 0
    ? ((action.recording.validFrames / action.recording.totalFrames) * 100).toFixed(0)
    : "0";
  const avgVis = action.frames.length > 0
    ? action.frames.reduce((s, f) => s + (f.quality.visibleKeyJoints || 0), 0) / action.frames.length
    : 0;

  return (
    <div className="diag-section">
      <h5>{label}</h5>
      <table className="diag-table">
        <tbody>
          <tr><td>时长</td><td>{dur}s（请求 {action.recording.requestedDurationMs / 1000}s）</td></tr>
          <tr><td>总帧数</td><td>{action.recording.totalFrames}</td></tr>
          <tr><td>有效帧</td><td>{action.recording.validFrames}（{validPct}%）</td></tr>
          <tr><td>实测FPS</td><td>{action.recording.measuredFps.toFixed(1)}</td></tr>
          <tr><td>关键关节可见(均值)</td><td>{avgVis.toFixed(1)}/8</td></tr>
          <tr><td>就绪分组</td><td>{action.frames[0]?.quality.readinessGroups ?? "?"} / {action.frames[0]?.quality.totalGroups ?? "?"}</td></tr>
          <tr><td>镜像</td><td>{action.mirrored ? "是" : "否"}</td></tr>
          <tr><td>摄像头分辨率</td><td>{action.capture.videoWidth}×{action.capture.videoHeight}</td></tr>
          <tr><td>宽高比</td><td>{action.capture.aspectRatio.toFixed(3)}</td></tr>
          <tr><td>委托</td><td>{action.capture.activeDelegate ?? "未知"}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export default function DiagnosticsPanel({
  actionA, actionB, score, scoreMode, captureMode, durationSec,
  recordingElapsedMs, recordingFrameCount, recordingValidFrames,
  refusalReason, refusalWarnings,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`diagnostics-panel ${open ? "is-open" : ""}`}>
      <button className="diag-toggle btn btn-sm btn-ghost" onClick={() => setOpen(!open)}>
        {open ? "▾" : "▸"} 诊断信息
      </button>

      {open && (
        <div className="diag-body">
          <div className="diag-section">
            <h5>录制状态</h5>
            <table className="diag-table"><tbody>
              <tr><td>当前采集模式</td><td>{captureMode}</td></tr>
              <tr><td>评分模式</td><td>{scoreMode === "casual" ? "娱乐" : "分析"}</td></tr>
              <tr><td>设定录制时长</td><td>{durationSec}s</td></tr>
              <tr><td>已录制时间</td><td>{(recordingElapsedMs / 1000).toFixed(1)}s</td></tr>
              <tr><td>当前帧数</td><td>{recordingFrameCount}</td></tr>
              <tr><td>当前有效帧</td><td>{recordingValidFrames}</td></tr>
            </tbody></table>
          </div>

          <ActionStats action={actionA} label="玩家 A · 参考动作" />
          <ActionStats action={actionB} label="玩家 B · 复刻动作" />

          {score && (
            <div className="diag-section">
              <h5>评分详情</h5>
              <table className="diag-table"><tbody>
                <tr><td>姿态相似度</td><td>{score.poseSimilarity}/100</td></tr>
                <tr><td>时间相似度</td><td>{score.timingSimilarity}/100</td></tr>
                <tr><td>综合匹配</td><td>{score.overallMatch}/100</td></tr>
                <tr><td>质量门</td><td>{score.quality.acceptable ? "通过 ✓" : `拒绝: ${score.quality.reasons.join("; ")}`}</td></tr>
                <tr><td>质量提示</td><td>{score.quality.reviewNotes.length > 0 ? score.quality.reviewNotes.join("; ") : "无"}</td></tr>
                <tr><td>关节差异数</td><td>{score.jointDifferences.length}</td></tr>
                <tr><td>差异时段</td><td>{score.keyMoments.length}</td></tr>
                <tr><td>解释</td><td className="diag-explain">{score.explanation}</td></tr>
              </tbody></table>
            </div>
          )}

          {refusalReason && (
            <div className="diag-section diag-warn">
              <h5>⚠ 评分问题</h5>
              <p>{refusalReason}</p>
            </div>
          )}
          {refusalWarnings.length > 0 && (
            <div className="diag-section diag-warn">
              <h5>⚠ 警告</h5>
              <ul>{refusalWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}