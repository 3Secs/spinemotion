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
   - 显示实际源分辨率；错误映射覆盖权限拒绝、无设备、占用、约束、非安全上下文。
   - 停止 / 暂停 / 切页 / 卸载时释放摄像头轨道。

2. **MediaPipe**
   - 官方 Lite 模型本地加载；WASM 本地加载。
   - 单人 `numPoses=1`，VIDEO 模式。
   - GPU 优先；`auto` 模式失败自动回退 CPU；可手动选 CPU。
   - 实际时间戳（视频 `currentTime` → 单调会话时间），不假定固定帧率。
   - 推理循环与屏幕刷新解耦，默认目标 12 FPS，可调 10 / 12 / 15。

3. **骨架与坐标**
   - 33 点关键点、分组配色、可见性过滤、关键关节强调。
   - Canvas 内部分辨率严格等于视频源分辨率；舞台宽高比随源画面变化。
   - 画面不镜像；底部明确标注 `OVERLAY 1:1`、`NOT MIRRORED`。
   - 骨架开关、三分法校准网格开关。

4. **指标**
   - 实际推理 FPS：1.5 秒滚动窗口。
   - 单帧推理耗时：同步 `detectForVideo` 墙钟 + EMA。
   - 已处理帧数、视频源时间。
   - React 状态更新节流至 250 ms，Canvas 绘制不依赖 React 重渲染。

5. **交互与提示**
   - 开始 / 取消启动 / 暂停 / 继续 / 停止 / 重新启动。
   - 启动中、暂停、待机、异常状态明确。
   - 无人体、关键关节不足、模型/WASM 错误、GPU 回退原因提示。
   - 8 个关键关节可见性可视化 + 阈值标记 + 33 点平均可见性。
   - 单目标与隐私说明。

6. **隐私**
   - 不录制视频、不写 IndexedDB、不上传。
   - CSP 仅允许自身源连接，同时阻断 MediaPipe 包内遥测端点。
   - 实测外部资源请求为 0。

7. **界面**
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

结果：**3 个测试文件，22 个测试全部通过。**

覆盖：

- 时间戳严格单调递增（时钟相同、回退、自定义步长、非法值）。
- 视频秒数 → 会话时间映射；负值钳制。
- FPS 滚动窗口、预热、过期样本移除。
- 推理耗时 EMA。
- 33 点姿态完整性校验；缺失 visibility 默认 0。
- 8 个关键关节可见性计数、平均值。
- `ok / partial / none / lost` 状态与 600 ms 宽限。
- 归一化坐标 → 源像素坐标映射。

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
2. 点击“启动摄像头”，允许 Chrome 与 macOS 摄像头权限。
3. 确认看到实时画面、33 点骨架，骨架与你的肩、髋、膝、踝对齐；移动和蹲起时无明显整体偏移。
4. 确认顶部 HUD 实际 FPS 在目标 10–15 FPS 附近，并显示推理耗时；记录你的 Mac 上实际数值。
5. 打开“校准网格”，确认三分线与画面边缘对齐。
6. 点击“暂停”：画面冻结、指标停止增长；点击“继续”：恢复推理。
7. 点击“停止”：画面回到待机，Chrome 摄像头指示灯应熄灭（或不再采集）。
8. 可选：把推理设备切为 CPU，停止后重新启动，确认标签显示 CPU 且仍能运行。
9. 可选：在 Chrome 中拒绝摄像头权限，确认出现具体错误说明，而不是空白页面。
10. 可选：断网后保持开发服务器运行并刷新，确认页面与模型仍能加载。

**自动化测试使用的是 headless Chrome 与虚拟摄像头，不能替代以上真实设备验收。**

---

## 7. 当前限制

- 单目标；多人或半身出镜可能丢失关键点。
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
