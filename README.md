# SpineMotion 2.0 — Interactive & Trustworthy Human Motion Lab

> **当前状态：Phase 1 已完成并通过构建 / 单元测试 / 浏览器烟雾测试。**
> Phase 2–6 尚未实现。仓库中不会用静态假页面冒充后续功能。

SpineMotion 2.0 是一个在浏览器本地运行的人体运动实验室。Phase 1 交付实时姿态捕捉引擎：摄像头画面、MediaPipe Pose Landmarker Lite 单人推理、33 点 Canvas 骨架、实际推理 FPS 与耗时、暂停/恢复/停止、明确的错误处理，以及按源分辨率精确映射的坐标覆盖层。

所有推理均由浏览器本地执行。默认不保存摄像头视频，不上传视频，不调用付费云端 AI API。

---

## 1. 在 Mac 上启动

### 推荐：双击启动

1. 在 Finder 中打开项目目录 `/Users/liyahao/mpipe`。
2. 双击 **`start.command`**。
3. Chrome 会自动打开：

   **<http://127.0.0.1:5173>**

   如果 Chrome 没有自动打开，请手动在 Chrome 地址栏输入该地址。
4. 进入顶部导航的 **实时捕捉**，点击 **启动摄像头**，允许 Chrome 与 macOS 的摄像头权限。

`start.command` 会优先使用项目内 `.tools/node` 的 Node.js；当前工作区已经装好。停止服务器请在该终端窗口按 `Control + C`。

> 若 macOS 第一次阻止 `start.command`：右键该文件 → 打开。也可以在终端运行 `./start.command`。

### 终端启动（开发者）

```bash
cd /Users/liyahao/mpipe
export PATH="$PWD/.tools/node/bin:$PATH"
npm run dev
```

打开 **<http://127.0.0.1:5173>**。

### 构建与测试

```bash
export PATH="$PWD/.tools/node/bin:$PATH"
npm test          # Vitest 单元测试
npm run build     # tsc -b + Vite 生产构建
npm run preview   # 预览生产构建：http://127.0.0.1:4173
```

---

## 2. Phase 1 实际功能

### 摄像头与画面

- 使用 `getUserMedia` 请求摄像头，首选 `1280×720 / 30fps`；浏览器可返回设备实际支持的尺寸。
- 使用 `HTMLVideoElement` 显示原始画面，`Canvas 2D` 作为透明覆盖层。
- 预览固定为 **完整原始画面模式**：`object-fit: contain`，`transform: none`、`scale: 1`，不使用 `cover`、数字放大、镜像或窗口裁切。舞台宽高比同步源画面。
- Canvas 内部尺寸严格等于 `video.videoWidth × video.videoHeight`；Canvas 显示区域与视频、舞台完全重合，归一化坐标乘以源像素尺寸绘制，骨架映射 1:1。
- 画面**不镜像**，方便核对坐标；界面上明确标注 `NOT MIRRORED`、`CONTAIN` 和源宽高比。
- 基于关键点进行上肢 / 下肢完整性判断。若完整画面模式下仍缺少头部或下肢，UI 会明确提示这是**摄像头物理视野或站位距离问题，不是页面裁切**，并建议后退、调整俯仰角或关闭 Center Stage / 人像模式。
- 支持骨架开关、校准网格开关、对应工具提示与状态 HUD。

### 姿态推理

- `@mediapipe/tasks-vision@1.1.1` + 官方 **Pose Landmarker Lite** 模型。
- `numPoses = 1`，只识别单个人。
- `runningMode = VIDEO`，使用视频实际 `currentTime` 映射的单调时间戳，不使用假定固定帧率。
- 推理循环使用 `setTimeout`，一次只执行一个同步 `detectForVideo`，与屏幕刷新解耦。
- 默认目标 12 FPS，可切换 10 / 12 / 15 FPS；实际 FPS 来自 1.5 秒滚动窗口，推理耗时为同步调用墙钟时间。
- 默认 `auto` delegate：优先 GPU，创建失败自动回退 CPU；也可手动选择 GPU 或 CPU（下次启动生效）。

### 录制与清理

- 开始 / 暂停 / 继续 / 停止完整状态机。
- 暂停时停止推理并禁用视频轨道；继续时恢复轨道与推理。
- 停止时停止所有 `MediaStreamTrack`、清空 `srcObject`、清空 Canvas 覆盖层与指标。
- 切换页面或组件卸载时同样释放轨道、关闭 Pose Landmarker。

### 错误与质量提示

- 摄像头权限拒绝、无设备、设备占用、约束不满足、非安全上下文。
- MediaPipe WASM / 模型加载失败。
- GPU 创建失败时 UI 显示回退原因。
- 无人体、关键关节可见性不足、模型推理中断。
- 33 个关键点中，实时展示 8 个关键关节可见性及 33 点平均可见性。
- 所有阈值集中在 `src/config/constants.ts`，并明确标记为工程启发式阈值。

---

## 3. 隐私与离线

- **不保存原始视频**（Phase 1 完全没有录制与 IndexedDB 写入）。
- **不上传视频**；摄像头帧只进入本地 `<video>` 与 WASM 推理。
- WASM 与模型都在 `public/` 内：
  - `public/wasm/*.wasm`, `public/wasm/*.js`
  - `public/models/pose_landmarker_lite.task`（5.5 MB）
- 页面 CSP 设置 `connect-src 'self' ws://127.0.0.1:* ws://localhost:*`，阻断第三方连接，包括 MediaPipe npm 包内置的 Google 遥测端点。
- 自动化测试确认：运行期间外部资源请求数为 0，向 `odml.pa.googleapis.com` 的请求被 CSP 阻断。
- 断网演示：保持 `npm run dev` 运行，断开 Wi‑Fi 后刷新页面即可（所有运行资产来自本地）。

### 模型来源

- MediaPipe Pose Landmarker Lite 官方模型：
  <https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task>
- SHA-256：
  `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`
- MediaPipe Tasks Vision 为 Apache-2.0 许可。模型与 WASM 仅随项目本地加载，无运行时 CDN 依赖。

---

## 4. 工程启发式阈值

| 参数 | 当前值 | 用途 |
|---|---:|---|
| `landmarkVisible` | 0.35 | 骨架绘制 / 点位可见性 |
| `keyJointVisible` | 0.50 | 8 个关键关节计数 |
| `minVisibleKeyJoints` | 5 / 8 | 实时“部分遮挡”提示 |
| `lostPoseGraceMs` | 600 ms | 避免瞬时丢失造成闪烁告警 |
| `uiUpdateIntervalMs` | 250 ms | React 指标采样节流 |
| `fpsWarmupMs` | 500 ms | 避免 FPS 启动瞬间抖动 |

**这些不是经过临床验证的标准，仅用于交互演示与测量质量控制原型。** 二维图像平面角度也不能直接解释为真实脊柱节段活动度；Phase 1 尚不计算角度或医学评分。

---

## 5. 项目结构

```text
.
├── start.command                  # macOS 一键启动（优先使用 .tools/node）
├── index.html                     # CSP、favicon、应用入口
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tsconfig*.json
├── scripts/
│   └── sync-mediapipe-assets.mjs  # 从 node_modules 复制 WASM 到 public/
├── public/
│   ├── favicon.svg
│   ├── models/
│   │   └── pose_landmarker_lite.task
│   └── wasm/                      # 6 个本地 MediaPipe 运行时文件
├── src/
│   ├── App.tsx                    # 哈希路由与全局外壳
│   ├── main.tsx
│   ├── config/constants.ts        # 模型参数、关键点、连接、阈值
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   └── CapturePage.tsx
│   ├── components/
│   │   ├── capture/CameraStage.tsx
│   │   ├── capture/ControlPanel.tsx
│   │   ├── capture/KeypointPanel.tsx
│   │   ├── BrandMark.tsx
│   │   ├── Icons.tsx
│   │   └── MotionFigure.tsx
│   ├── hooks/usePoseCapture.ts    # 摄像头 / 模型 / 推理 / 生命周期
│   ├── lib/
│   │   ├── camera.ts              # 摄像头错误映射与轨道释放
│   │   ├── metrics.ts             # FPS 滚动窗口 / EMA
│   │   ├── pose.ts                # 坐标映射、可见性、Canvas 骨架
│   │   ├── poseLandmarker.ts      # 本地 WASM + Lite 模型加载
│   │   ├── time.ts                # 单调时间戳
│   │   └── *.test.ts
│   ├── styles/global.css
│   └── types/pose.ts
└── PHASE1_REPORT.md               # 本轮验收记录
```

### 坐标与时间戳约定

- MediaPipe 输出归一化坐标 `(x, y) ∈ [0,1]`。
- Canvas 像素坐标：`x_px = x * video.videoWidth`，`y_px = y * video.videoHeight`。
- 会话时间戳：
  `streamEpoch = performance.now() - video.currentTime * 1000`
  `timestamp = nextMonotonicTimestamp(previous, streamEpoch + video.currentTime * 1000)`
- 即使浏览器时钟回退或视频重启，传给 MediaPipe 的 VIDEO 时间戳也保持严格递增。

---

## 6. 测试

### 已验证

- `npm test`：**26 / 26 通过**（时间戳单调性、媒体时间映射、FPS 滚动窗口、EMA、姿态可见性、关键点分类、坐标映射、全景/上下肢缺失判断）。
- `npm run build`：TypeScript 与 Vite 生产构建通过。
- 浏览器自动化（macOS 15.2 arm64，Chrome 155 headless，虚拟摄像头）：
  - 1280×720 输入：GPU 11.9 FPS / 14.8–18.9 ms；Canvas 1280×720。
  - 640×426 官方姿态测试图输入：GPU 11.8 FPS / 14.9 ms，检测到 8/8 关键关节，骨架实际绘制。
  - 完整画面校验：`object-fit=contain`、`transform=none`、`scale=1`；视频 / 舞台 / Canvas 边界误差均为 0px，Canvas 与舞台宽高比均为 1.502。
  - 原始画面下肢截断测试：正常显示 6/8 关键关节，并出现“未稳定检测到完整下肢”物理视野提示。
  - CPU delegate：11.9 FPS / 23.3 ms，8/8 关键关节。
  - 暂停后视频轨道 `enabled=false`；恢复后 `enabled=true` 且帧数继续增长；停止后 `srcObject=null`、轨道 `readyState=ended`。
  - 无外部资源请求；CSP 阻断 Google 遥测端点。

### 必须由你人工确认

自动化测试不能替代真实摄像头与真人骨架的现场验收。请按 [PHASE1_REPORT.md](./PHASE1_REPORT.md) 的清单逐项确认。

---

## 7. 已知限制（Phase 1）

- 只支持单人；多人入镜可能造成关键点跳变。
- 仅使用图像平面二维投影，不计算真实三维脊柱运动或临床角度。
- 尚未实现动作录制、回放、DTW、评分、质量分级与导出（Phase 2–5）。
- 极暗环境、宽松衣物、严重遮挡、半身出镜会降低可见性；UI 会提示但不阻止采集。
- 页面已确认不做裁切。若完整原始画面中仍缺头或脚，属于摄像头物理视野、站位距离或系统相机效果（如 Center Stage / 人像模式）限制，应用无法通过 CSS 增加原始视频未拍到的像素。
- 真实 GPU 性能取决于 Chrome 版本、macOS、摄像头分辨率与后台负载；10–15 FPS 为目标而非保证。
- 开发服务器 `npm run dev` 仍依赖本机 Node 进程；生产构建可用任意静态服务器托管。

---

## 8. 常见问题

**摄像头没有画面 / 权限被拒绝**

1. Chrome 地址栏左侧 → 网站设置 → 摄像头 → 允许。
2. macOS：系统设置 → 隐私与安全性 → 摄像头 → 允许 Google Chrome。
3. 刷新页面并重试。

**提示设备被占用**

退出 Zoom / Teams / QuickTime / 相机等应用，再点击“重新启动摄像头”。

**GPU 初始化失败**

保持“自动”会回退 CPU；也可先停止，选择 CPU，再启动。

**端口 5173 被占用**

项目设置为固定端口。停止占用该端口的进程，或关闭已运行的 SpineMotion 窗口后重新双击 `start.command`。

**模型缺失**

确认 `public/models/pose_landmarker_lite.task` 与 `public/wasm/` 存在；运行 `npm run sync:assets` 后重启。

---

## 9. 下一阶段（Phase 2 — Motion Ghost）

待 Phase 1 人工确认后开始：

- 5–10 秒姿态帧录制：`timestamp / landmarks / visibility`。
- 本地 JSON 保存与重新载入。
- 骨架回放、倍速、进度控制。
- 第二次启动摄像头时叠加半透明参考幽灵骨架。
- 保持默认不保存原始视频，并补充录制内存上限与隐私说明。

Phase 2 开始前不会提前生成后续模块代码。
