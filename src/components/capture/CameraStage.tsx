import type { RefObject } from "react";
import {
  CameraIcon,
  CrosshairIcon,
  PauseIcon,
  PlayIcon,
  ScanIcon,
  StopIcon,
  WarningIcon,
} from "../Icons";
import type {
  CaptureError,
  CaptureMetrics,
  CapturePhase,
  DelegateInfo,
  LivePoseState,
  ModelStatus,
  VideoSize,
} from "../../types/pose";

interface CameraStageProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  phase: CapturePhase;
  modelStatus: ModelStatus;
  error: CaptureError | null;
  metrics: CaptureMetrics;
  live: LivePoseState;
  videoSize: VideoSize;
  delegateInfo: DelegateInfo;
  showSkeleton: boolean;
  showGrid: boolean;
  onToggleSkeleton: () => void;
  onToggleGrid: () => void;
  onStart: () => void;
  onResume: () => void;
  onStop: () => void;
}

function stageStatus(phase: CapturePhase): { label: string; tone: string } {
  if (phase === "running") return { label: "LIVE", tone: "live" };
  if (phase === "paused") return { label: "PAUSED", tone: "paused" };
  if (phase === "starting") return { label: "STARTING", tone: "starting" };
  if (phase === "error") return { label: "ERROR", tone: "error" };
  return { label: "STANDBY", tone: "idle" };
}

export function CameraStage({
  videoRef,
  canvasRef,
  phase,
  modelStatus,
  error,
  metrics,
  live,
  videoSize,
  delegateInfo,
  showSkeleton,
  showGrid,
  onToggleSkeleton,
  onToggleGrid,
  onStart,
  onResume,
  onStop,
}: CameraStageProps) {
  const status = stageStatus(phase);
  const active = phase !== "idle" && phase !== "error";
  const resolution =
    videoSize.width > 0
      ? `${videoSize.width} × ${videoSize.height}`
      : "等待画面";
  const aspect = videoSize.width > 0 ? `${videoSize.width} / ${videoSize.height}` : "16 / 9";
  const sourceAspect =
    videoSize.width > 0 && videoSize.height > 0
      ? `${(videoSize.width / videoSize.height).toFixed(2)} : 1`
      : "—";

  let warning: { tone: "danger" | "warn" | "neutral"; title: string; detail: string } | null = null;
  if (phase === "running") {
    if (live.signal === "lost") {
      warning = {
        tone: "danger",
        title: "未检测到人体",
        detail:
          "请让头、肩、髋与双踝进入镜头。若画面中已有上半身，请后退或调整摄像头角度；当前为完整原始画面，页面没有裁切。",
      };
    } else if (live.framing === "lower-cut") {
      warning = {
        tone: "warn",
        title: "未稳定检测到完整下肢",
        detail:
          "完整原始画面未裁切。可能原因：摄像头物理视野、站位距离，或下肢遮挡/可见性过低。若画面底部已截断脚踝，请后退 1–2 米、调整俯仰角或关闭 Center Stage / 人像模式。",
      };
    } else if (live.framing === "upper-cut") {
      warning = {
        tone: "warn",
        title: "未稳定检测到头部或肩部",
        detail:
          "完整原始画面未裁切。可能原因：摄像头物理视野、镜头高度，或上半身遮挡/可见性过低。若画面顶部已截断头部，请调整摄像头高度或俯仰角。",
      };
    } else if (live.signal === "partial") {
      warning = {
        tone: "warn",
        title: "关键关节可见性不足",
        detail: `仅 ${live.visibleKeyJoints}/8 个关键关节可见。避免宽松衣物或肢体互相遮挡。`,
      };
    } else if (live.signal === "none") {
      warning = {
        tone: "neutral",
        title: "正在识别姿态…",
        detail: "保持全身静止片刻，等待关键点稳定。",
      };
    }
  }

  return (
    <section className="camera-card" aria-label="摄像头实时画面">
      <div className="camera-toolbar">
        <div className="camera-title">
          <span className={`live-dot live-dot-${status.tone}`} />
          <strong>{status.label}</strong>
          <span className="toolbar-divider" />
          <span className="mono-muted">CAM_01 / SINGLE TARGET</span>
        </div>
        <div className="stage-toggles">
          <span
            className="frame-mode-chip"
            title="object-fit: contain，完整显示原始摄像头画面；不做数字缩放或裁切"
          >
            完整画面 · CONTAIN
          </span>
          <button
            className={`toggle ${showSkeleton ? "is-on" : ""}`}
            onClick={onToggleSkeleton}
            aria-pressed={showSkeleton}
          >
            骨架
          </button>
          <button
            className={`toggle ${showGrid ? "is-on" : ""}`}
            onClick={onToggleGrid}
            aria-pressed={showGrid}
          >
            校准网格
          </button>
        </div>
      </div>

      <div className="camera-stage" style={{ aspectRatio: aspect }}>
        <video
          ref={videoRef}
          className="camera-video"
          autoPlay
          muted
          playsInline
          aria-label="本地摄像头完整原始画面（contain、未镜像、未裁切）"
        />
        <canvas ref={canvasRef} className="pose-overlay" aria-hidden="true" />

        {phase === "idle" && (
          <div className="stage-overlay idle-overlay">
            <div className="idle-reticle">
              <CrosshairIcon />
            </div>
            <p className="overlay-kicker">CAMERA OFFLINE</p>
            <h3>准备采集你的动作</h3>
            <p className="overlay-copy">
              建议距离摄像头 2–4 米，保持头、肩、髋、膝与脚踝完整入镜。
              相机画面只在浏览器内存中处理。
            </p>
            <button className="btn btn-primary" onClick={onStart}>
              <CameraIcon />
              启动摄像头
            </button>
            <span className="overlay-footnote">
              首次启动需在 Chrome 与 macOS 中允许摄像头权限
            </span>
          </div>
        )}

        {phase === "starting" && (
          <div className="stage-overlay starting-overlay">
            <div className="scan-loader" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="overlay-kicker">INITIALIZING PIPELINE</p>
            <h3>正在启动摄像头与本地模型</h3>
            <p className="overlay-copy">
              {modelStatus === "loading"
                ? "首次加载需要解析 WASM 与 Pose Landmarker Lite 模型，请稍候。"
                : "正在等待摄像头授权与视频首帧。"}
            </p>
            <button className="btn btn-ghost btn-sm" onClick={onStop}>
              <StopIcon />
              取消启动
            </button>
          </div>
        )}

        {phase === "error" && error && (
          <div className="stage-overlay error-overlay">
            <div className="error-icon">
              <WarningIcon />
            </div>
            <p className="overlay-kicker">PIPELINE ERROR · {error.code}</p>
            <h3>{error.title}</h3>
            <p className="overlay-copy">{error.detail}</p>
            <div className="error-hint">{error.hint}</div>
            <div className="error-actions">
              <button className="btn btn-primary" onClick={onStart}>
                <CameraIcon />
                重新尝试
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onStop}>
                返回待机
              </button>
            </div>
          </div>
        )}

        {phase === "paused" && (
          <div className="paused-glass">
            <div className="paused-icon"><PauseIcon /></div>
            <div>
              <strong>分析已暂停</strong>
              <span>摄像头轨道已禁用，骨架与指标保持最后一帧</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={onResume}>
              <PlayIcon />
              继续
            </button>
          </div>
        )}

        {active && (
          <>
            <div className="stage-hud">
              <div className="hud-pill">
                <span className={`live-dot live-dot-${status.tone}`} />
                {status.label}
              </div>
              <div className="hud-pill hud-mono">
                {metrics.frames > 0 ? metrics.fps.toFixed(1) : "—"} FPS
              </div>
              <div className="hud-pill hud-mono">
                {metrics.frames > 0 ? metrics.inferenceMs.toFixed(1) : "—"} MS
              </div>
              <div className="hud-spacer" />
              <div className="hud-pill hud-delegate">
                {delegateInfo.active ? `${delegateInfo.active} DELEGATE` : "MODEL LOADING"}
              </div>
            </div>

            <div className="stage-footer-hud">
              <span className="mono-muted">{resolution}</span>
              <span className="hud-separator" />
              <span className="mono-muted">OVERLAY 1:1</span>
              <span className="hud-separator" />
              <span className="mono-muted">NOT MIRRORED</span>
              <span className="hud-spacer" />
              <span className={`pose-signal pose-signal-${live.signal}`}>
                {live.hasPose
                  ? `${live.visibleKeyJoints}/8 KEY JOINTS`
                  : "NO POSE"}
              </span>
            </div>

            {warning && (
              <div className={`stage-warning warning-${warning.tone}`}>
                <WarningIcon />
                <div>
                  <strong>{warning.title}</strong>
                  <span>{warning.detail}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="camera-meta">
        <span>
          源画面 <strong>{resolution}</strong>
        </span>
        <span>
          覆盖层{" "}
          <strong>
            {videoSize.width > 0 ? `${videoSize.width} × ${videoSize.height}` : "—"}
          </strong>
        </span>
        <span className="meta-grow" />
        <span>坐标按源分辨率 1:1 映射 · 单目标</span>
      </div>

      <div className="full-frame-contract">
        <span className="full-frame-icon"><ScanIcon /></span>
        <div>
          <strong>完整原始画面模式</strong>
          <span>
            object-fit: contain · 无数字放大 / 裁切 · 骨架映射 1:1。
            若此模式下仍看不到全身，属于摄像头物理视野或站位距离限制，不是页面裁切。
          </span>
        </div>
        <span className="full-frame-aspect">源宽高比 {sourceAspect}</span>
      </div>
    </section>
  );
}
