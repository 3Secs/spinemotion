# Phase 1 验收报告 — Capture Engine

**日期**：2026-10-23  
**阶段**：Phase 1 — 基础运行环境 / MediaPipe 接入 / 实时骨架  
**状态**：代码、单元测试、生产构建、浏览器自动化烟雾测试完成；真实摄像头与真人骨架等待人工验收。  
**Git 提交**：见 `git log -1 --oneline`（本报告随该提交一同入库）。

---

## 1. 实际环境

| 项目 | 实际值 |
|---|---|
| 机器 | Apple Silicon，`arm64` |
| macOS | 15.2（24C101） |
| Chrome | 155.0.8059.85 |
| Node.js | v24.22.1（项目内 `.tools/node` 便携版） |
| npm | 11.19.1 |
| React / React DOM | 19.3.1 |
| Vite | 8.3.5 |
| TypeScript | 5.9.3 |
| MediaPipe Tasks Vision | 1.1.1 |
| Vitest | 5.0.5 |
| 摄像头 | 自动化测试使用 Chrome 虚拟摄像头；真实摄像头待人工验收 |
| 测试图像 | MediaPipe 官方 `pose.jpg`（仅用于自动化验证，不进入项目） |

系统原本没有可用的全局 Node.js，且 `~/.npm` 缓存目录存在历史权限问题。本项目未修改工作区外的系统文件，而是使用项目内 `.tools/node`，并将 npm 缓存指向项目内 `.npm-cache/`。

---

## 2. 实际创建 / 修改的文件

### 工程与资源

- `package.json`, `package-lock.json`
- `index.html`（CSP、favicon、入口）
- `vite.config.ts`, `vitest.config.ts`
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- `.gitignore`, `.gitattributes`, `.npmrc`
- `start.command`（macOS 一键启动）
- `scripts/sync-mediapipe-assets.mjs`
- `public/favicon.svg`
- `public/models/pose_landmarker_lite.task`（5.5 MB）
- `public/wasm/`（MediaPipe SIMD / non-SIMD / module 运行时）
- `README.md`, `PHASE1_REPORT.md`

### 应用代码

- `src/App.tsx`, `src/main.tsx`, `src/vite-env.d.ts`
- `src/styles/global.css`
- `src/pages/DashboardPage.tsx`
- `src/pages/CapturePage.tsx`
- `src/components/BrandMark.tsx`
- `src/components/Icons.tsx`
- `src/components/MotionFigure.tsx`
- `src/components/capture/CameraStage.tsx`
- `src/components/capture/ControlPanel.tsx`
- `src/components/capture/KeypointPanel.tsx`
- `src/hooks/usePoseCapture.ts`
- `src/lib/camera.ts`
- `src/lib/metrics.ts`
- `src/lib/pose.ts`
- `src/lib/poseLandmarker.ts`
- `src/lib/time.ts`
- `src/config/constants.ts`
- `src/types/pose.ts`

### 测试

- `src/lib/time.test.ts`
- `src/lib/metrics.test.ts`
- `src/lib/pose.test.ts`

---

## 3. 已实现功能

1. **摄像头**
   - Chrome 获取权限；首选 1280×720 / 30fps。
   - 支持设备枚举与选择：Mac 内置、iPhone 连续互通、USB；支持 `devicechange` 热插拔刷新。
   - 采集中锁定设备选择；停止后可切换。用户显式选择时使用 `deviceId: { exact }`。
   - 摄像头轨道意外结束（USB 拔出 / 连续互通断开）时停止采集并显示明确错误。
   - 显示实际源分辨率；错误映射覆盖权限拒绝、无设备、占用、约束、非安全上下文。
   - 停止 / 暂停 / 切页 / 卸载时释放摄像头轨道。

2. **采集模式**
   - **Upper Body（默认）**：肩、肘、腕至少各一点稳定可见；髋部可见性展示但非必需；只绘制上半身骨架，供后续上半身 Motion Ghost / Motion Arena 使用。
   - **Full Body**：头、肩、髋、膝、踝/足均需稳定可见并位于原始画面内；缺项时列出具体缺少部位并提示调整站位。
   - 模式可在运行中切换，不影响摄像头流、原始画面尺寸或坐标映射。

3. **MediaPipe**
   - 官方 Lite 模型本地加载；WASM 本地加载。
   - 单人 `numPoses=1`，VIDEO 模式。
   - GPU 优先；`auto` 模式失败自动回退 CPU；可手动选 CPU。
   - 实际时间戳（视频 `currentTime` → 单调会话时间），不假定固定帧率。
   - 推理循环与屏幕刷新解耦，默认目标 12 FPS，可调 10 / 12 / 15。

4. **骨架与坐标**
   - 33 点关键点、分组配色、可见性过滤、关键关节强调。
   - Upper Body 模式只绘制上半身骨架；Full Body 模式绘制全身骨架。
   - Canvas 内部分辨率严格等于视频源分辨率；舞台宽高比随源画面变化。
   - 画面不镜像；底部明确标注 `OVERLAY 1:1`、`NOT MIRRORED`。
   - 骨架开关、三分法校准网格开关。

5. **指标**
   - 实际推理 FPS：1.5 秒滚动窗口。
   - 单帧推理耗时：同步 `detectForVideo` 墙钟 + EMA。
   - 已处理帧数、视频源时间。
   - React 状态更新节流至 250 ms，Canvas 绘制不依赖 React 重渲染。

6. **交互与提示**
   - 开始 / 取消启动 / 暂停 / 继续 / 停止 / 重新启动。
   - 启动中、暂停、待机、异常状态明确。
   - 无人体、模式质控未满足、模型/WASM 错误、GPU 回退、设备断开提示。
   - 模式化关键点可见性 + 核心组就绪状态 + 33 点平均可见性。
   - 设备选择、刷新设备、采集中锁定；单目标与隐私说明。

7. **隐私**
   - 不录制视频、不写 IndexedDB、不上传。
   - CSP 仅允许自身源连接，同时阻断 MediaPipe 包内遥测端点。
   - 实测外部资源请求为 0。

8. **界面**
   - 深色科研风 Dashboard + Capture。
   - 响应式布局：1440、1024、390 宽度检查；390px 无横向滚动。
   - 后续 Phase 仅以“计划中”路线图展示，不存在可点击的假功能页面。

---

## 4. 执行的测试与结果

### 4.1 单元测试

命令：

```bash
npm test
```

结果：**3 个测试文件，31 个测试全部通过。**

覆盖：

- 时间戳严格单调递增（时钟相同、回退、自定义步长、非法值）。
- 视频秒数 → 会话时间映射；负值钳制。
- FPS 滚动窗口、预热、过期样本移除。
- 推理耗时 EMA。
- 33 点姿态完整性校验；缺失 visibility 默认 0。
- 8 个关键关节可见性计数、平均值。
- `ok / partial / none / lost` 状态与 600 ms 宽限。
- 归一化坐标 → 源像素坐标映射。
- 完整原始画面的全身 / 上肢缺失 / 下肢缺失 / 未知判断。
- Upper Body 在下肢缺失时仍可就绪；缺少腕部时判定未就绪。
- Full Body 要求头、肩、髋、膝、踝/足全部满足；头部缺失或踝/足缺失时判定未就绪。

### 4.2 生产构建

命令：

```bash
npm run build
```

结果：**通过，无 TypeScript 错误、无 Vite 构建错误。** 构建产物包含本地 `wasm/` 与 `models/`。

### 4.3 浏览器自动化烟雾测试

方法：Chrome headless + CDP + `--use-fake-device-for-media-stream` / `--use-file-for-fake-video-capture`。分别输入绿色虚拟画面、1280×720 虚拟摄像头、640×426 官方姿态测试图。

| 场景 | 结果 |
|---|---|
| 1280×720 / GPU / 目标 12 FPS | 11.9 FPS，14.8–18.9 ms；Canvas 1280×720 |
| 640×426 / GPU / 官方姿态图 | 11.8 FPS，14.9 ms；TRACKING，8/8 关键关节，骨架实际绘制 |
| 640×426 / CPU / 官方姿态图 | 11.9 FPS，23.3 ms；TRACKING，8/8 关键关节 |
| 无人体的绿色虚拟画面 | 正常运行，600 ms 后提示“未检测到人体” |
| 暂停 | 状态“已暂停”；视频 `paused=true`；轨道 `enabled=false` |
| 继续 | 状态“运行中”；轨道恢复 `enabled=true`；帧数从 161 → 213 |
| 停止 | 状态“待机”；`srcObject=null`；轨道 `readyState=ended`；指标清空 |
| CSP / 隐私 | 外部资源请求 0；`odml.pa.googleapis.com` 请求被阻断 |
| 控制台 | 排除预期的 CSP 阻断记录后，无应用异常；无 404 |

### 4.4 构建验证期间发现并修复的问题

1. `CameraStage.tsx` 两处相对导入路径错误。
2. 缺少 `vite/client` 类型声明，导致 CSS 导入与 `import.meta.env` 报错。
3. FPS 过期样本测试的期望值写错（实现正确，测试修正为 10 FPS）。
4. 404 来自缺失 favicon；已加入本地 SVG favicon。
5. MediaPipe npm 包包含遥测外连；加入 CSP 并在浏览器中验证阻断。
6. 恢复失败路径未释放摄像头；已补 `detachStream()`。

### 4.5 完整原始画面修复验证（本轮）

排查结论：

- 原实现没有 `object-fit: cover`、CSS `transform: scale`、`zoom` 或容器最大高度裁切。
- 视频层原为 `object-fit: fill`；舞台比例跟随源视频，Canvas 与源视频同为 1280×720 / 640×426 等原始尺寸。
- 因此页面本身没有裁切；但原实现缺少“完整原始画面”的显式契约与物理视野诊断。

本轮修改：

- 视频层改为 `object-fit: contain`、`object-position: center`。
- 显式设置 `transform: none`、`scale: 1`，移除任何潜在数字放大。
- 舞台宽高比继续同步源视频，Canvas 与视频、舞台显示区域严格重合，骨架采用源像素 1:1 映射。
- 新增“完整画面 · CONTAIN”状态、源宽高比和“完整原始画面模式”说明。
- 新增基于 33 点的 `assessFraming()`：判断全身 / 下肢缺失 / 上肢缺失 / 未知。
- 若原始流缺少下肢，界面明确提示摄像头物理视野 / 站位距离问题，建议后退、调整俯仰角或关闭 Center Stage / 人像模式。
- 新增 4 个单元测试；单元测试总数从 22 增至 26。

自动化验证结果：

| 检查项 | 结果 |
|---|---|
| `getComputedStyle(video).objectFit` | `contain` |
| `getComputedStyle(video).objectPosition` | `50% 50%` |
| `transform` / `scale` | `none` / `1` |
| 视频、舞台、Canvas 边界误差 | 0 px / 0 px / 0 px |
| 舞台宽高比 vs 源宽高比 | 1.5024 vs 1.5023 |
| 官方全身姿态图 | 8/8 关键关节，骨架实际绘制，无视野告警 |
| 原始画面下肢截断测试 | 6/8 关键关节，出现“未稳定检测到完整下肢”物理视野告警 |
| 外部资源请求 | 0 |

### 4.6 设备选择与采集模式验证（当前）

新增：

- 摄像头设备枚举、选择、刷新和 `devicechange` 监听。
- 采集中锁定设备，停止后可切换；USB / 连续互通相机轨道结束时提示重新连接。
- Upper Body / Full Body 质控核心组。
- Upper Body 只绘制上半身骨架，Full Body 绘制全身骨架。
- 新增 5 个单元测试；当前测试总数 31。

浏览器验证（使用下半身被截断的官方姿态测试视频）：

| 场景 | 结果 |
|---|---|
| 设备枚举 | 检测到 1 个虚拟视频输入，并显示设备 ID / 名称 |
| 选中具体设备后启动 | 状态“运行中”，GPU 推理正常，无错误 |
| Upper Body（下肢不可见） | `READY`，核心组 3/3，无警告 |
| 切换 Full Body | 立即变为 `ADJUST`，核心组 4/5，提示缺少踝/足部 |
| 切回 Upper Body | 恢复 `READY`，警告消失 |
| 完整画面 | 两模式均为 `object-fit: contain`；视频 / 舞台 / Canvas 边界误差 0px |
| 模式骨架 | Upper Body Canvas 像素区域小于 Full Body，下半身骨架已过滤 |
| 控制台 / 外部请求 | 无异常；外部资源请求 0 |

---

## 5. Mac 本地运行方法

### 最简单

1. Finder 打开 `/Users/liyahao/mpipe`。
2. 双击 `start.command`。
3. 浏览器打开 **<http://127.0.0.1:5173>**。
4. 顶部导航 → **实时捕捉** → **启动摄像头**。

### 终端

```bash
cd /Users/liyahao/mpipe
export PATH="$PWD/.tools/node/bin:$PATH"
npm run dev
```

打开 **<http://127.0.0.1:5173>**。

构建：

```bash
npm run build
npm run preview   # http://127.0.0.1:4173
```

---

## 6. 需要你人工验证的操作

请按顺序确认并在回复中告知结果：

1. 用真实 Chrome 打开 <http://127.0.0.1:5173>，进入“实时捕捉”。
2. 先查看“摄像头设备”下拉框。若名称尚为空，启动一次并允许权限，再停止并点击“刷新设备”。
3. 分别确认能看到 Mac 内置摄像头、iPhone 连续互通相机（如已连接）和 USB 摄像头（如已连接）。选择其中一个并启动。
4. 确认采集中设备下拉框被锁定；停止后可以切换设备并再次启动。
5. 默认应为 **Upper Body**。确认状态为 `READY`，核心组为 3/3；画面只绘制上半身骨架。
6. 切换到 **Full Body**。若你的内置摄像头仍无法拍到下肢，应看到 `Full Body 采集条件未满足` 并列出缺少部位；这是物理视野限制，不是页面裁切。
7. 切回 **Upper Body**，确认警告消失且仍为 `READY`。本模式不要求下肢入镜。
8. 确认画面右上角显示 **“完整画面 · CONTAIN”**，画面下方说明两种模式共用完整原始视频；比较摄像头内容边界与舞台边界。
9. 确认骨架与肩、肘、腕、髋对齐；移动手臂时无明显整体偏移。
10. 确认顶部 HUD 实际 FPS 在目标 10–15 FPS 附近，并显示推理耗时；记录你的 Mac 上实际数值。
11. 打开“校准网格”，确认三分线与画面边缘对齐。
12. 点击“暂停”：画面冻结、指标停止增长；点击“继续”：恢复推理。
13. 点击“停止”：画面回到待机，Chrome 摄像头指示灯应熄灭（或不再采集）。
14. 可选：把推理设备切为 CPU，停止后重新启动，确认标签显示 CPU 且仍能运行。
15. 可选：在 Chrome 中拒绝摄像头权限，确认出现具体错误说明，而不是空白页面。
16. 可选：断网后保持开发服务器运行并刷新，确认页面与模型仍能加载。

**自动化测试使用的是 headless Chrome 与虚拟摄像头，不能替代以上真实设备验收。**

---

## 7. 当前限制

- 单目标；多人入镜可能丢失关键点。
- 页面已确认不做裁切；若完整原始画面仍缺头或脚，应用无法补充摄像头未拍到的像素，需调整物理视野、站位距离或系统相机效果。
- 在窄视角内置摄像头上，Full Body 可能无法满足；这是硬件视野限制。默认 Upper Body 是为该场景提供的可用降级路径。
- 设备名称在授权前可能被 Chrome 隐藏；需要刷新设备列表。
- 仅二维图像平面坐标，不能解释为真实脊柱节段活动度。
- 不提供诊断或医学评分。
- 10–15 FPS 是目标；真实性能取决于 Chrome / macOS / 摄像头和负载。
- 尚未实现 Phase 2–6 功能。
- 真实摄像头下的骨架稳定性、权限弹窗与摄像头指示灯需要人工确认。

---

## 8. 下一阶段计划（待你确认后开始）

**Phase 2 — Motion Ghost**

- 录制 5–10 秒关键点序列（时间戳、坐标、可见性）。
- 录制过程内存上限与质量提示。
- 本地 JSON 保存 / 导入。
- 骨架回放、播放速度、进度控制。
- 第二次启动摄像头时显示半透明参考幽灵骨架。
- 不保存原始视频；录制结束释放摄像头。
- 为后续 DTW 和 MotionProof 设计稳定的数据格式。
