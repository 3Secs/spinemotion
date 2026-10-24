import { useState } from "react";
import { CameraStage } from "../components/capture/CameraStage";
import { GhostCameraPanel } from "../components/ghost/GhostCameraPanel";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  RecordIcon,
  RotateIcon,
  ShieldIcon,
  SparkIcon,
  StopIcon,
  WarningIcon,
} from "../components/Icons";
import { UserIcon, SwordsIcon, TargetIcon } from "../components/arena/ArenaIcons";
import { GHOST_CONFIG } from "../config/constants";
import { useArenaSession } from "../hooks/useArenaSession";
import { assessCaptureReadiness } from "../lib/pose";
import type { ArenaScore } from "../types/arena";
import type { GhostAction } from "../types/ghost";
import VisualComparison from "../components/arena/VisualComparison";
import DifferencePanel from "../components/arena/DifferencePanel";
import DiagnosticsPanel from "../components/arena/DiagnosticsPanel";
import { useComparisonPlayback } from "../hooks/useComparisonPlayback";
import { buildResultSummary } from "../lib/arena/summary";
import { buildExportData, downloadArenaResult, downloadArenaResultCSV } from "../lib/arena/export";

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00.0";
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function MotionArenaPage() {
  const session = useArenaSession();
  const { step, actionA, actionB, countdown, error, notice, score, refusalReason, refusalWarnings, capture } = session;

  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showGrid, setShowGrid] = useState(false);

  const readiness = assessCaptureReadiness(capture.live.landmarks, session.captureMode);

  const cameraReady = capture.phase === "running";
  const isConfirming = step === "confirm-a" || step === "confirm-b";
  const isResults = step === "results";

  const playerLabelText = step.startsWith("player-a") || step === "confirm-a" ? "玩家 A" : "玩家 B";

  const systemOverlay = (
    <>
      {countdown !== null && (
        <div className="countdown-overlay">
          <span className="countdown-kicker">即将开始录制</span>
          <strong>{countdown}</strong>
          <span>准备录制 · 让身体完整进入画面</span>
        </div>
      )}
      {session.isRecording && countdown === null && (
        <div className="countdown-overlay is-go" style={{ opacity: 0.7 }}>
          <span className="countdown-kicker">REC · {playerLabelText}</span>
          <strong>{formatMs(session.recordingElapsedMs)}</strong>
          <span>{session.recordingFrameCount} 帧 · 有效 {session.recordingValidFrames}</span>
        </div>
      )}
    </>
  );

  return (
    <div className="arena-page page-enter">
      <header className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            双人动作竞技
          </div>
          <h1>动作复刻竞技场</h1>
          <p>
            双人依次录制动作，自动比对姿态与节奏，生成可解释的趣味评分。
            全程在浏览器本地计算，不保存原始视频。
          </p>
        </div>
        <div className="heading-chips">
          <span className="heading-chip"><SwordsIcon /> 两人对战</span>
          <span className="heading-chip"><TargetIcon /> 时间对齐</span>
          <span className="heading-chip"><ShieldIcon /> 本地评分</span>
        </div>
      </header>

      {notice && (
        <div className="ghost-notice" role="status">
          <CheckIcon />
          <span>{notice}</span>
          <button className="text-button" onClick={session.dismissNotice}>关闭</button>
        </div>
      )}

      {error && (
        <div className="ghost-notice" role="alert" style={{ background: "var(--caution-bg)", color: "var(--caution-text)" }}>
          <WarningIcon />
          <span>{error}</span>
          <button className="text-button" onClick={session.dismissError}>关闭</button>
        </div>
      )}

      {/* Step indicator */}
      <div className="arena-steps" role="tablist" aria-label="竞技流程">
        {[
          { key: "setup", label: "准备", sub: "模式与摄像头" },
          { key: "player-a", label: "玩家 A 录制", sub: `${session.captureMode === "upper-body" ? "上半身" : "全身"} · ${session.durationSec}s` },
          { key: "player-b", label: "玩家 B 录制", sub: "复刻相同动作" },
          { key: "results", label: "竞技结果", sub: "评分报告" },
        ].map((s, idx) => {
          const active =
            (s.key === "setup" && (step === "setup")) ||
            (s.key === "player-a" && (step === "player-a" || step === "confirm-a")) ||
            (s.key === "player-b" && (step === "player-b" || step === "confirm-b" || step === "analyzing")) ||
            (s.key === "results" && step === "results");
          const done =
            (s.key === "setup" && step !== "setup") ||
            (s.key === "player-a" && (step === "player-b" || step === "confirm-b" || step === "analyzing" || step === "results")) ||
            (s.key === "player-b" && (step === "analyzing" || step === "results"));
          return (
            <div key={s.key} className={`arena-step ${active ? "is-active" : ""} ${done ? "is-done" : ""}`} role="tab" aria-selected={active}>
              <span className="arena-step-num">{done ? <CheckIcon /> : idx + 1}</span>
              <span className="arena-step-label">{s.label}</span>
              <span className="arena-step-sub">{s.sub}</span>
            </div>
          );
        })}
      </div>

      <div className="arena-layout">
        <div className="arena-main">
          {/* Camera stage shared across all steps */}
          <CameraStage
            videoRef={capture.videoRef}
            canvasRef={capture.canvasRef}
            systemOverlay={systemOverlay}
            phase={capture.phase}
            modelStatus={capture.modelStatus}
            error={capture.error}
            metrics={capture.metrics}
            live={capture.live}
            videoSize={capture.videoSize}
            delegateInfo={capture.delegateInfo}
            captureMode={session.captureMode}
            readiness={readiness}
            showSkeleton={showSkeleton}
            showGrid={showGrid}
            onToggleSkeleton={() => setShowSkeleton((v) => !v)}
            onToggleGrid={() => setShowGrid((v) => !v)}
            onStart={capture.start}
            onResume={capture.resume}
            onStop={capture.stop}
          />

          {/* Results panel */}
          {isResults && (
            <ArenaResultPanel
              score={score}
              refusalReason={refusalReason}
              refusalWarnings={refusalWarnings}
              actionA={actionA}
              actionB={actionB}
              captureMode={session.captureMode}
              onReset={session.resetSession}
            />
          )}
        </div>

        <aside className="arena-sidebar">
          {/* Camera panel */}
          <GhostCameraPanel
            phase={capture.phase}
            modelStatus={capture.modelStatus}
            metrics={capture.metrics}
            delegateInfo={capture.delegateInfo}
            videoSize={capture.videoSize}
            cameraDevices={capture.cameraDevices}
            selectedDeviceId={capture.selectedDeviceId}
            devicesLoading={capture.devicesLoading}
            devicesError={capture.devicesError}
            captureMode={session.captureMode}
            locked={session.isRecording}
            onStart={capture.start}
            onStop={capture.stop}
            onRefreshDevices={() => { void capture.refreshDevices(); }}
            onSelectDevice={capture.selectDevice}
            onCaptureModeChange={session.setCaptureMode}
          />

          {/* Score mode selector */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker"><TargetIcon /> 评分模式</span>
                <h2>评分模式</h2>
              </div>
            </div>
            <div className="mode-switch-row">
              <button
                className={`btn btn-sm ${session.scoreMode === "casual" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => session.setScoreMode("casual")}
                disabled={isResults || session.isRecording}
              >
                娱乐
              </button>
              <button
                className={`btn btn-sm ${session.scoreMode === "research" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => session.setScoreMode("research")}
                disabled={isResults || session.isRecording}
              >
                分析
              </button>
            </div>
            <p className="mode-hint">
              {session.scoreMode === "casual"
                ? "末端关节降权，分数更友好。"
                : "原始测量指标，严格评分。"}
            </p>
          </section>

          {/* Duration selector */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker"><ClockIcon /> 录制时长</span>
                <h2>录制时长</h2>
              </div>
            </div>
            <input
              className="range-input"
              type="range"
              min={GHOST_CONFIG.minDurationSec}
              max={GHOST_CONFIG.maxDurationSec}
              step={1}
              value={session.durationSec}
              disabled={session.isRecording || isConfirming || isResults}
              onChange={(e) => session.setDurationSec(Number(e.target.value))}
            />
            <div className="range-labels">
              <span>5s</span>
              <span>{session.durationSec}s</span>
              <span>15s</span>
            </div>
          </section>

          {/* Player status */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker"><UserIcon /> 玩家</span>
                <h2>选手状态</h2>
              </div>
            </div>
            <div className="arena-player-cards">
              <div className={`arena-player-card ${actionA ? "is-done" : ""}`}>
                <div className="player-badge">A</div>
                <div>
                  <strong>玩家 A · 参考动作</strong>
                  <span>{actionA ? `已录制 · ${formatSeconds(actionA.durationMs)} · ${actionA.recording.totalFrames} 帧` : "待录制"}</span>
                </div>
              </div>
              <div className={`arena-player-card ${actionB ? "is-done" : ""}`}>
                <div className="player-badge">B</div>
                <div>
                  <strong>玩家 B · 复刻动作</strong>
                  <span>{actionB ? `已录制 · ${formatSeconds(actionB.durationMs)} · ${actionB.recording.totalFrames} 帧` : "待录制"}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Action buttons based on step */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker"><SwordsIcon /> 操作</span>
                <h2>操作</h2>
              </div>
            </div>

            <div className="control-actions">
              {/* Step "player-b" idle (not recording yet) — show start button */}
              {step === "player-b" && !session.isRecording && countdown === null && (
                <button className="btn btn-primary btn-block" onClick={session.startPlayerB} disabled={!cameraReady}>
                  <RecordIcon /> 玩家 B 开始录制 ({session.durationSec}s)
                </button>
              )}

              {step === "setup" && (
                <button className="btn btn-primary btn-block" onClick={session.startPlayerA} disabled={!cameraReady}>
                  <RecordIcon /> 玩家 A 开始录制 ({session.durationSec}s)
                </button>
              )}

              {session.isRecording && countdown === null && (
                <button className="btn btn-danger-soft btn-block" onClick={session.stopRecording}>
                  <StopIcon /> 结束录制
                </button>
              )}

              {session.isRecording && countdown !== null && (
                <button className="btn btn-secondary btn-block" disabled>
                  <ClockIcon /> 倒计时 {countdown}
                </button>
              )}

              {step === "confirm-a" && (
                <div>
                  <button className="btn btn-primary btn-block" onClick={session.confirmA}>
                    <ArrowRightIcon /> 确认 · 进入玩家 B 录制
                  </button>
                  <button className="btn btn-ghost btn-block" onClick={session.reRecordA}>
                    <RotateIcon /> 重新录制玩家 A
                  </button>
                </div>
              )}

              {step === "confirm-b" && (
                <div>
                  <button className="btn btn-primary btn-block" onClick={session.confirmB}>
                    <TargetIcon /> 开始评分分析
                  </button>
                  <button className="btn btn-ghost btn-block" onClick={session.reRecordB}>
                    <RotateIcon /> 重新录制玩家 B
                  </button>
                </div>
              )}

              {step === "analyzing" && (
                <div className="analyzing-hint">
                  <SparkIcon />
                  <span>正在分析动作…</span>
                </div>
              )}

              {step === "results" && (
                <button className="btn btn-primary btn-block" onClick={session.resetSession}>
                  <RotateIcon /> 新一轮对战
                </button>
              )}
            </div>
          </section>

          {/* Diagnostics */}
          <DiagnosticsPanel
            actionA={actionA}
            actionB={actionB}
            score={score}
            scoreMode={session.scoreMode}
            captureMode={session.captureMode}
            durationSec={session.durationSec}
            recordingElapsedMs={session.recordingElapsedMs}
            recordingFrameCount={session.recordingFrameCount}
            recordingValidFrames={session.recordingValidFrames}
            refusalReason={refusalReason}
            refusalWarnings={refusalWarnings}
          />
        </aside>
      </div>
    </div>
  );
}

function ArenaResultPanel({
  score,
  refusalReason,
  refusalWarnings,
  actionA,
  actionB,
  captureMode,
  onReset,
}: {
  score: ArenaScore | null;
  refusalReason: string | null;
  refusalWarnings: string[];
  actionA: GhostAction | null;
  actionB: GhostAction | null;
  captureMode: "upper-body" | "full-body";
  onReset: () => void;
}) {
  const scoringRefused = refusalReason && !score;
  const pb = useComparisonPlayback(actionA, actionB);

  return (
    <section className="arena-results">
      {refusalReason && (
        <div className={`result-notice ${scoringRefused ? "result-notice-warn" : "result-notice-info"}`}>
          <WarningIcon />
          <div>
            <strong>{scoringRefused ? "评分被拒绝" : "质量提示"}</strong>
            <span>{refusalReason}</span>
          </div>
        </div>
      )}

      {refusalWarnings.length > 0 && !scoringRefused && (
        <div className="result-notice result-notice-info">
          <WarningIcon />
          <span>{refusalWarnings.join("；")}</span>
        </div>
      )}

      {score && (
        <div className="result-hero">
          <div className="result-score-big">
            <span className="result-score-number">{score.overallMatch}</span>
            <span className="result-score-label">综合匹配</span>
          </div>
          <div className="result-bars">
            <div className="result-bar">
              <div className="result-bar-header">
                <span>姿态匹配</span>
                <strong>{score.poseSimilarity}</strong>
              </div>
              <div className="bar-track">
                <div className="bar-fill bar-fill-pose" style={{ width: `${score.poseSimilarity}%` }} />
              </div>
            </div>
            <div className="result-bar">
              <div className="result-bar-header">
                <span>时间与节律</span>
                <strong>{score.timingSimilarity}</strong>
              </div>
              <div className="bar-track">
                <div className="bar-fill bar-fill-timing" style={{ width: `${score.timingSimilarity}%` }} />
              </div>
            </div>
            <div className="result-status-chip">
              <span className={`status-dot ${score.quality.acceptable ? "status-dot-ok" : "status-dot-warn"}`} />
              {score.quality.acceptable ? "采集质量合格" : "采集质量不足"}
            </div>
          </div>
        </div>
      )}

      {/* 一句话评价 */}
      {score && actionA && actionB && (
        <div className="result-summary">
          <p>{buildResultSummary(score, actionA, actionB)}</p>
        </div>
      )}

      {score && actionA && actionB && (
        <VisualComparison actionA={actionA} actionB={actionB} captureMode={captureMode} />
      )}

      {score && actionA && actionB && (
        <DifferencePanel
          score={score}
          actionA={actionA}
          actionB={actionB}
          progress={pb.progress}
          selectedJoint={pb.selectedJoint}
          onSelectJoint={pb.setSelectedJoint}
          onJumpMs={pb.jumpToMoment}
        />
      )}

      {score && actionA && actionB && (
        <div className="duration-cards">
          <div className="duration-card">
            <span className="duration-label">参考动作</span>
            <strong>{formatSeconds(actionA.durationMs)}</strong>
          </div>
          <div className="duration-card">
            <span className="duration-label">复刻动作</span>
            <strong>{formatSeconds(actionB.durationMs)}</strong>
          </div>
          <div className="duration-card">
            <span className="duration-label">时间差</span>
            <strong>{formatSeconds(Math.abs(actionA.durationMs - actionB.durationMs))}</strong>
          </div>
        </div>
      )}

      {score && (
        <details className="result-tech">
          <summary>技术详情</summary>
          <p className="result-tech-text">{score.explanation}</p>
          {actionA && actionB && (
            <div className="result-tech-exports">
              <button className="btn btn-sm btn-ghost" onClick={() => downloadArenaResult(buildExportData(score, actionA, actionB))}>
                📥 导出 JSON
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => downloadArenaResultCSV(buildExportData(score, actionA, actionB))}>
                📊 导出 CSV
              </button>
            </div>
          )}
        </details>
      )}

      <div className="result-actions">
        <button className="btn btn-primary btn-lg" onClick={onReset}>
          <RotateIcon /> 再来一局
        </button>
        <a className="btn btn-ghost" href="#/dashboard">返回首页</a>
      </div>
    </section>
  );
}