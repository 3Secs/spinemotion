import { useState } from "react";
import { CameraStage } from "../components/capture/CameraStage";
import { ControlPanel } from "../components/capture/ControlPanel";
import { KeypointPanel } from "../components/capture/KeypointPanel";
import {
  ActivityIcon,
  CameraIcon,
  CpuIcon,
  InfoIcon,
  ShieldIcon,
} from "../components/Icons";
import { CAPTURE_CONFIG, ENGINEERING_NOTE } from "../config/constants";
import { usePoseCapture } from "../hooks/usePoseCapture";
import type { DelegateMode } from "../types/pose";

export function CapturePage() {
  const [targetFps, setTargetFps] = useState<number>(CAPTURE_CONFIG.defaultTargetFps);
  const [delegateMode, setDelegateMode] = useState<DelegateMode>("auto");
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showGrid, setShowGrid] = useState(false);

  const capture = usePoseCapture({
    targetFps,
    delegateMode,
    showSkeleton,
    showGrid,
  });

  return (
    <div className="capture-page page-enter">
      <header className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            PHASE 1 · POSE CAPTURE ENGINE
          </div>
          <h1>实时姿态捕捉</h1>
          <p>
            MediaPipe Pose Landmarker Lite 在你的 Mac 浏览器内完成单人姿态推理，
            Canvas 2D 按源分辨率叠加 33 点骨架。所有指标均来自当前会话。
          </p>
        </div>
        <div className="heading-chips">
          <span className="heading-chip"><CpuIcon /> LOCAL WASM</span>
          <span className="heading-chip"><ActivityIcon /> SINGLE POSE</span>
          <span className="heading-chip"><ShieldIcon /> NO UPLOAD</span>
        </div>
      </header>

      <div className="capture-layout">
        <div className="capture-primary">
          <CameraStage
            videoRef={capture.videoRef}
            canvasRef={capture.canvasRef}
            phase={capture.phase}
            modelStatus={capture.modelStatus}
            error={capture.error}
            metrics={capture.metrics}
            live={capture.live}
            videoSize={capture.videoSize}
            delegateInfo={capture.delegateInfo}
            showSkeleton={showSkeleton}
            showGrid={showGrid}
            onToggleSkeleton={() => setShowSkeleton((value) => !value)}
            onToggleGrid={() => setShowGrid((value) => !value)}
            onStart={capture.start}
            onResume={capture.resume}
            onStop={capture.stop}
          />

          <div className="capture-secondary">
            <KeypointPanel live={capture.live} phase={capture.phase} />
            <section className="panel method-panel">
              <div className="panel-kicker">
                <InfoIcon />
                PIPELINE NOTES
              </div>
              <h2>这一版实际做了什么</h2>
              <ul className="method-list">
                <li>
                  <CameraIcon />
                  <div>
                    <strong>采集</strong>
                    <span>首选取 1280×720 / 30fps，浏览器可返回设备实际支持的分辨率。</span>
                  </div>
                </li>
                <li>
                  <ActivityIcon />
                  <div>
                    <strong>时间戳</strong>
                    <span>以视频实际 currentTime 映射到单调会话时间，不使用假定固定帧率。</span>
                  </div>
                </li>
                <li>
                  <CpuIcon />
                  <div>
                    <strong>推理</strong>
                    <span>Lite 模型、单目标；定时循环一次只执行一个同步推理任务。</span>
                  </div>
                </li>
                <li>
                  <ShieldIcon />
                  <div>
                    <strong>清理</strong>
                    <span>停止、切页与组件卸载都会停止 MediaStream 轨道并关闭模型。</span>
                  </div>
                </li>
              </ul>
              <p className="fine-print">{ENGINEERING_NOTE}</p>
            </section>
          </div>
        </div>

        <aside className="capture-side">
          <ControlPanel
            phase={capture.phase}
            modelStatus={capture.modelStatus}
            metrics={capture.metrics}
            delegateInfo={capture.delegateInfo}
            targetFps={targetFps}
            delegateMode={delegateMode}
            onTargetFpsChange={setTargetFps}
            onDelegateModeChange={setDelegateMode}
            onStart={capture.start}
            onPause={capture.pause}
            onResume={capture.resume}
            onStop={capture.stop}
          />

          <section className="panel privacy-panel">
            <div className="panel-kicker">
              <ShieldIcon />
              LOCAL PROCESSING
            </div>
            <h2>画面不离开本机</h2>
            <p>
              Phase 1 不录制视频、不写 IndexedDB、不上传服务器。关闭摄像头后，
              MediaStream 轨道会立即停止。
            </p>
            <div className="privacy-diagram" aria-hidden="true">
              <span>CAM</span>
              <i />
              <span>WASM</span>
              <i />
              <span>CANVAS</span>
            </div>
            <div className="privacy-footer">
              <span className="status-dot status-dot-live" />
              设计上无外部推理请求
            </div>
          </section>

          <section className="panel troubleshoot-panel">
            <div className="panel-kicker">
              <InfoIcon />
              TROUBLESHOOTING
            </div>
            <h2>现场排查</h2>
            <ol>
              <li>
                <strong>没有画面</strong>
                <span>检查 Chrome 地址栏摄像头权限与 macOS 隐私设置，刷新后重试。</span>
              </li>
              <li>
                <strong>FPS 偏低</strong>
                <span>切换为 CPU 或把目标频率降到 10 FPS；关闭其他占用摄像头/GPU 的应用。</span>
              </li>
              <li>
                <strong>骨架抖动或丢失</strong>
                <span>改善正面光照，避免宽松衣物；确保全身完整入镜且只有一人。</span>
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
