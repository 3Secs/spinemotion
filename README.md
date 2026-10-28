# SpineMotion — 本地人体运动实验室

> 适合 MoonStone DreamUp 黑客松现场演示的双人动作竞技作品。
> 全程浏览器本地推理：**不上传视频，不调用云端 AI**。

SpineMotion 是一个在浏览器本地运行的人体运动应用，围绕"记录 → 复刻 → 解释"设计：

- **实时捕捉**：摄像头、MediaPipe Pose Landmarker Lite 单人推理、33 点 Canvas 骨架、真实 FPS / 推理耗时、完整错误处理。
- **Motion Ghost（动作数字分身）**：关键点动作录制、真实时间轴回放、倍速、半透明参考骨架叠加、本地 JSON 动作库。
- **Motion Arena（动作竞技场）**：双人动作竞技。尺度归一化、DTW 时间对齐、可解释评分（娱乐 / 研究双模式）、双骨架同步回放、关节差异可视化、质量反馈与门控、JSON / CSV 导出。

---

## 1. 在 Mac 上启动

### 方式一：双击启动（推荐演示）

1. 在 Finder 中打开项目目录。
2. 双击 **`start.command`**（首次运行会自动安装依赖）。
3. Chrome 自动打开 **<http://127.0.0.1:5173>**。
4. 进入 **双人竞技 / 动作分身 / 实时捕捉**，点击启动摄像头并允许权限。

`start.command` 优先使用项目目录内 `.tools/node` 的 Node.js。停止服务器：在该终端按 `Control + C`。

### 方式二：终端启动（开发者）

```bash
cd <项目目录>
export PATH="$PWD/.tools/node/bin:$PATH"   # 已装 Node ≥20 可省略
npm install
npm run dev          # 开发服务器 → http://127.0.0.1:5173
npm test             # Vitest 单元测试
npm run build        # tsc -b + Vite 生产构建
npm run preview      # 预览生产构建 → http://127.0.0.1:4173
```

> `package.json` 实际脚本：`dev` / `build` / `preview` / `test` / `sync:assets` / `postinstall`。
> 安装依赖后 `postinstall` 会自动同步 MediaPipe WASM 与模型到 `public/`；缺失时手动执行 `npm run sync:assets`。

---

## 2. 功能一览（真实已实现）

### Motion Arena（双人竞技）

- 完整流程：准备 → 玩家 A 录制 → 玩家 B 录制 → 分析 → 结果 → 再来一局。
- 3 秒倒计时；手动结束 / 自动到时结束。
- 质量门控：兼容性检查（采集模式 / 关键关节可见性 / 有效帧），不合格时拒绝评分并给出中文原因。
- 娱乐 / 研究两种评分模式（娱乐默认，末端关节降权更友好）。
- 结果页：综合分 + 姿态分 + 时间分、自然语言总结、双骨架并排 / 重叠回放、关节差异排名（中文名）、差异时段时间轴跳转、JSON / CSV 导出。
- 解剖标注：肩 / 肘 / 腕 / 髋 / 膝 / 踝 中文标注，可在回放中开关。

### Motion Ghost（动作数字分身）

- 5–15 秒动作录制、3 秒倒计时、有效帧统计。
- 真实时间戳回放、0.5× / 1× / 1.5× 倍速、拖动定位。
- 半透明参考 Ghost 骨架 + 实时骨架，自动身体对齐。
- 本地动作库、JSON 导入导出。

### 实时捕捉

- 摄像头设备选择（含 iPhone 连续互通相机）、热插拔刷新。
- Upper Body / Full Body 两种采集模式，入镜完整性实时判断。
- 骨架 / 网格 / 解剖标注开关、FPS / 推理耗时 HUD。
- GPU / CPU delegate 自动回退。

---

## 3. 摄像头使用说明（Chrome）

1. 首次点击"启动摄像头"时，Chrome 会请求摄像头权限，选择 **允许**。
2. 如误选"阻止"：地址栏左侧图标 → 网站设置 → 摄像头 → 允许，然后刷新页面。
3. macOS 还需：系统设置 → 隐私与安全性 → 摄像头 → 勾选 Chrome。
4. 摄像头被占用（Zoom / Teams / QuickTime 等）时提示"设备被占用"：关闭其他程序后点击"刷新设备"或重启摄像头。

### （可选）iPhone 连续互通相机

1. iPhone 解锁且靠近 Mac，打开 Wi-Fi / 蓝牙，登录同一 Apple ID。
2. Chrome 设备列表中会出现 iPhone 名称的摄像头，选择即可。
3. 首次未出现时开启摄像头后点"刷新设备"。

---

## 4. 隐私与离线

- **不保存原始视频**，不上传视频；摄像头帧只进入本地 `<video>` 与 WASM 推理。
- WASM 与模型在 `public/` 内（`public/wasm/`、`public/models/pose_landmarker_lite.task`）。
- CSP 设置 `connect-src 'self' ws://127.0.0.1:* ws://localhost:*`，阻断第三方连接。
- 断网演示：保持 `npm run dev` 运行，断开 Wi-Fi 后刷新页面即可（模型已在本机）。

---

## 5. 技术架构与开源依赖

| 层 | 技术 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite |
| 姿态推理 | MediaPipe Tasks Vision（Pose Landmarker Lite），GPU / CPU delegate 自动回退 |
| 对齐 | DTW 时间对齐 + 髋部锚点 / 肩宽尺度归一化 |
| 测试 | Vitest（无摄像头依赖的单元与算法测试） |
| 运行时 | 浏览器本地 WASM，无后端服务 |

开源依赖：`@mediapipe/tasks-vision`、`react`、`react-dom`（见 `package.json`）。模型文件来自 Google MediaPipe 开源项目（`pose_landmarker_lite.task`）。

### 项目结构（概要）

```text
.
├── start.command            # macOS 双击启动
├── index.html / package.json / vite.config.ts / vitest.config.ts
├── scripts/sync-mediapipe-assets.mjs
├── public/{models/, wasm/}
├── src/
│   ├── App.tsx              # 哈希路由与全局外壳
│   ├── pages/               # Dashboard / Capture / MotionGhost / MotionArena
│   ├── components/          # arena / capture / ghost 组件
│   ├── hooks/               # usePoseCapture / useGhostPlayback / useArenaSession / useComparisonPlayback
│   ├── lib/                 # 相机、指标、姿态推理、ghost 录制/回放、arena 归一化/DTW/评分/导出
│   ├── styles/global.css
│   └── types/
└── README.md
```

---

## 6. Demo 操作流程（现场 3 分钟）

1. 打开双人竞技页，确认摄像头画面与骨架。
2. 娱乐模式、录制时长 8s → 玩家 A 录一个舒展动作（如挥臂下蹲）。
3. 确认后玩家 B 复刻同一动作。
4. 观看评分：得分卡 + 双骨架并排回放 + 差异关节排名。
5. 点击差异关节/时间轴跳转，体验"哪里不像"。
6. 再来一局，或导出 JSON / CSV。

---

## 7. 测试

- `npm test`：**157 / 157 通过**（19 个测试文件，覆盖时间戳、FPS、姿态可见性、DTW、归一化、兼容性、差异、评分、摘要、系统验收、回放引擎）。
- `npm run build`：TypeScript 与 Vite 生产构建通过。

---

## 8. 已知限制

- 只支持单人；多人入镜可能造成关键点跳变。
- 仅使用图像平面二维投影，不计算真实三维脊柱运动或临床角度。
- 极暗环境、宽松衣物、严重遮挡、半身出镜会降低可见性。
- 实际性能取决于 Chrome / macOS / 摄像头分辨率与后台负载。

**本应用不是医疗器械，不提供临床诊断。** 运动分析结果仅作展示与娱乐参考，不替代专业评估。

---

## 9. 团队

-算法 / 工程：李亚浩
-设计 / 交互：施佳

**MoonStone DreamUp · 提交材料清单：README / 代码仓库 / 本地 Demo / 一页作品介绍（docs/作品.html）**
