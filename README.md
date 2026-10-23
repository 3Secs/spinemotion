# SpineMotion 2.0 — 本地人体运动实验室

> **当前状态：Phase 1–3 已完成，Phase 4 / 5 已整合（MotionProof 质量反馈 + Motion Lab 分析报告）。**
> 适合 MoonStone 黑客松现场演示的双人动作竞技作品。

SpineMotion 2.0 是一个在浏览器本地运行的人体运动应用：

- **Phase 1 · 实时捕捉**：摄像头、MediaPipe Pose Landmarker Lite 单人推理、33 点 Canvas 骨架、真实 FPS / 推理耗时、完整的错误处理。
- **Phase 2 · Motion Ghost**：关键点动作录制、真实时间轴回放、倍速、半透明参考骨架叠加、本地 JSON 动作库。
- **Phase 3 · Motion Arena**：双人动作竞技。尺度归一化、DTW 时间对齐、可解释评分（娱乐 / 研究双模式）、双骨架同步回放、关节差异可视化。
- **Phase 4 / 5 · 已整合**：MotionProof 质量反馈（入镜 / 遮挡提示、质量门控）+ Motion Lab 分析报告（自然语言总结、关节中文名、JSON / CSV 导出）。

所有推理均在浏览器本地执行：**不上传视频，不调用云端 AI**。

---

## 1. 在 Mac 上启动

### 推荐：双击启动

1. 在 Finder 中打开项目目录 `/Users/liyahao/mpipe`。
2. 双击 **`start.command`**。
3. Chrome 自动打开 **<http://127.0.0.1:5173>**。
4. 进入 **Motion Arena** 或 **实时捕捉**，点击启动摄像头并允许权限。

`start.command` 优先使用项目内 `.tools/node` 的 Node.js。停止服务器在该终端按 `Control + C`。

### 终端启动（开发者）

```bash
cd /Users/liyahao/mpipe
export PATH="$PWD/.tools/node/bin:$PATH"
npm run dev        # 开发服务器
npm test           # Vitest 单元测试
npm run build      # tsc -b + Vite 生产构建
npm run preview    # 预览生产构建：http://127.0.0.1:4173
```

---

## 2. 功能一览

### Motion Arena（双人竞技）

- 完整流程：准备 → 玩家 A 录制 → 玩家 B 录制 → 分析 → 结果 → 再来一局。
- 3 秒倒计时，手动结束 / 自动到时结束。
- 质量门控：兼容性检查（模式 / 关键关节可见性 / 有效帧）。
- 娱乐 / 研究两种评分模式（娱乐默认，末端关节降权更友好）。
- 结果页：综合分 + 姿态分 + 时间分、自然语言总结、双骨架并排 / 重叠回放、关节差异排名（中文名）、差异时段时间轴、JSON / CSV 导出。
- 解剖标注：关键关节（肩 / 肘 / 腕 / 髋 / 膝 / 踝）中文标注，可在回放中开关。

### Motion Ghost（动作数字分身）

- 5–15 秒动作录制、3 秒倒计时、有效帧统计。
- 真实时间戳回放、0.5× / 1× / 1.5×、拖动定位。
- 半透明参考 Ghost 骨架 + 橙色实时骨架，自动身体对齐。
- 本地动作库、JSON 导入导出。

### 实时捕捉

- 摄像头设备选择（含 iPhone 连续互通相机）、热插拔刷新。
- Upper Body / Full Body 两种采集模式，入镜完整性实时判断。
- 骨架 / 网格 / 解剖标注开关、FPS / 推理耗时 HUD。
- GPU / CPU delegate 自动回退。

---

## 3. 隐私与离线

- **不保存原始视频**，不上传视频，摄像头帧只进入本地 `<video>` 与 WASM 推理。
- WASM 与模型都在 `public/` 内（`public/wasm/`、`public/models/pose_landmarker_lite.task`）。
- CSP 设置 `connect-src 'self' ws://127.0.0.1:* ws://localhost:*`，阻断第三方连接。
- 断网演示：保持 `npm run dev`，断开 Wi-Fi 后刷新页面即可。

---

## 4. 项目结构

```text
.
├── start.command
├── index.html
├── package.json / vite.config.ts / vitest.config.ts / tsconfig*.json
├── scripts/sync-mediapipe-assets.mjs
├── public/{favicon.svg, models/, wasm/}
├── src/
│   ├── App.tsx                 # 哈希路由与全局外壳
│   ├── main.tsx
│   ├── config/constants.ts     # 模型参数、关键点、连接、阈值、中文标签
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── CapturePage.tsx
│   │   ├── MotionGhostPage.tsx
│   │   └── MotionArenaPage.tsx
│   ├── components/
│   │   ├── arena/              # VisualComparison / DifferencePanel / DiagnosticsPanel / ArenaIcons
│   │   ├── capture/            # CameraStage / ControlPanel / KeypointPanel
│   │   ├── ghost/              # GhostCameraPanel / GhostPlaybackPanel / GhostRecordPanel / GhostReferencePanel
│   │   └── ...
│   ├── hooks/
│   │   ├── usePoseCapture.ts
│   │   ├── useGhostPlayback.ts
│   │   ├── useArenaSession.ts
│   │   └── useComparisonPlayback.ts
│   ├── lib/
│   │   ├── camera.ts / metrics.ts / pose.ts / poseLandmarker.ts / time.ts
│   │   ├── ghost/              # 录制 / 回放 / 渲染 / 库 / 变换
│   │   └── arena/              # 兼容性 / 归一化 / DTW / 差异 / 评分 / 回放引擎 / 导出
│   ├── styles/global.css
│   └── types/{pose,ghost,arena}.ts
└── README.md
```

### 坐标与时间戳约定

- MediaPipe 输出归一化坐标 `(x, y) ∈ [0,1]`。
- Canvas 像素坐标：`x_px = x * video.videoWidth`，`y_px = y * video.videoHeight`。
- 会话时间戳：`streamEpoch = performance.now() - video.currentTime * 1000`，保证严格递增。
- Motion Arena 归一化：髋部锚点 + 躯干 / 肩宽尺度，消除站位与镜头远近差异。

---

## 5. 测试

- `npm test`：**149 / 149 通过**（18 个测试文件，覆盖时间戳、FPS、姿态可见性、DTW、归一化、兼容性、差异、评分、系统验收、回放引擎）。
- `npm run build`：TypeScript 与 Vite 生产构建通过。

### 必须由你人工确认

自动化测试不能替代真实摄像头与真人骨架的现场验收。请重点确认：

1. Mac Chrome 开启摄像头 + iPhone 连续互通相机切换。
2. Upper / Full Body 模式入镜判断与骨架显示。
3. Motion Arena 完整流程（A → B → 评分 → 回放 → 再来一局）。
4. 质量不合格时拒绝评分并给出中文原因。
5. 双骨架回放、解剖标注、差异关节高亮、差异时段跳转。
6. 页面刷新、路由切换、录制中途退出、摄像头权限拒绝与恢复。
7. 持续运行的内存占用。

---

## 6. 已知限制

- 只支持单人；多人入镜可能造成关键点跳变。
- 仅使用图像平面二维投影，不计算真实三维脊柱运动或临床角度。
- 极暗环境、宽松衣物、严重遮挡、半身出镜会降低可见性。
- 真实 GPU 性能取决于 Chrome 版本、macOS、摄像头分辨率与后台负载。

---

## 7. 常见问题

**摄像头没有画面 / 权限被拒绝** — Chrome 地址栏左侧 → 网站设置 → 摄像头 → 允许；macOS 系统设置 → 隐私 → 摄像头 → 允许 Chrome。

**看不到 iPhone 连续互通相机** — iPhone 解锁、靠近 Mac、同 Apple ID、开 Wi-Fi / 蓝牙；首次授权后点“刷新设备”。

**提示设备被占用** — 退出 Zoom / Teams / QuickTime 等应用后重新启动摄像头。

**GPU 初始化失败** — 保持“自动”回退 CPU，或手动选择 CPU。

**端口 5173 被占用** — 停止占用进程或已运行窗口后重新双击 `start.command`。

**模型缺失** — 确认 `public/models/` 与 `public/wasm/` 存在，运行 `npm run sync:assets` 后重启。
