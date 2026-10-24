import { useMemo, useState } from "react";
import { CameraStage } from "../components/capture/CameraStage";
import { ControlPanel } from "../components/capture/ControlPanel";
import { KeypointPanel } from "../components/capture/KeypointPanel";
import {
  ActivityIcon,
  CameraIcon,
  CpuIcon,
  InfoIcon,
  ScanIcon,
  ShieldIcon,
} from "../components/Icons";
import {
  CAPTURE_CONFIG,
  DEFAULT_CAPTURE_MODE,
  ENGINEERING_NOTE,
} from "../config/constants";
import { usePoseCapture } from "../hooks/usePoseCapture";
import { assessCaptureReadiness } from "../lib/pose";
import type { CaptureMode, DelegateMode } from "../types/pose";

export function CapturePage() {
  const [targetFps, setTargetFps] = useState<number>(CAPTURE_CONFIG.defaultTargetFps);
  const [delegateMode, setDelegateMode] = useState<DelegateMode>("auto");
  const [captureMode, setCaptureMode] = useState<CaptureMode>(DEFAULT_CAPTURE_MODE);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showGrid, setShowGrid] = useState(false);

  const capture = usePoseCapture({
    targetFps,
    delegateMode,
    captureMode,
    showSkeleton,
    showGrid,
    showLabels: false,
  });
  const readiness = useMemo(
    () => assessCaptureReadiness(capture.live.landmarks, captureMode),
    [capture.live.landmarks, captureMode],
  );

  return (
    <div className="capture-page page-enter">
      <header className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            实时姿态捕捉
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
            captureMode={captureMode}
            readiness={readiness}
            showSkeleton={showSkeleton}
            showGrid={showGrid}
            onToggleSkeleton={() => setShowSkeleton((value) => !value)}
            onToggleGrid={() => setShowGrid((value) => !value)}
            onStart={capture.start}
            onResume={capture.resume}
            onStop={capture.stop}
          />

          <div className="capture-secondary">
            <KeypointPanel
              live={capture.live}
              phase={capture.phase}
              captureMode={captureMode}
              readiness={readiness}
            />
            <section className="panel method-panel">
              <div className="panel-kicker">
                <InfoIcon />
                技术说明
              </div>
              <h2>这一版实际做了什么</h2>
              <ul className="method-list">
                <li>
                  <CameraIcon />
                  <div>
                    <strong>设备</strong>
                    <span>
                      支持 Mac 内置摄像头、iPhone 连续互通相机和 USB 摄像头。
                      首选取 1280×720 / 30fps，停止后可切换设备。
                    </span>
                  </div>
                </li>
                <li>
                  <ScanIcon />
                  <div>
                    <strong>采集模式</strong>
                    <span>
                      Upper Body 只要求肩、肘、腕与可见躯干关键点；Full Body
                      额外检查头部、髋、膝、踝是否全部入镜。模式只改变质控规则，
                      不改变摄像头视野。
                    </span>
                  </div>
                </li>
                <li>
                  <ScanIcon />
                  <div>
                    <strong>完整画面</strong>
                    <span>
                      两种模式均使用 object-fit: contain 的完整原始画面，不放大、不裁切。
                      若所需部位仍无法入镜，属于摄像头物理视野或站位距离限制。
                    </span>
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
            captureMode={captureMode}
            cameraDevices={capture.cameraDevices}
            selectedDeviceId={capture.selectedDeviceId}
            devicesLoading={capture.devicesLoading}
            devicesError={capture.devicesError}
            targetFps={targetFps}
            delegateMode={delegateMode}
            onCaptureModeChange={setCaptureMode}
            onSelectDevice={capture.selectDevice}
            onRefreshDevices={() => { void capture.refreshDevices(); }}
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
              本地处理
            </div>
            <h2>画面不离开本机</h2>
            <p>
              本页不录制视频、不写 IndexedDB、不上传服务器。关闭摄像头后，
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
              现场排查
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
                <span>
                  改善正面光照，避免宽松衣物；确保只有一人。若完整画面仍缺下肢，
                  请后退或关闭 Center Stage / 人像模式。
                </span>
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
