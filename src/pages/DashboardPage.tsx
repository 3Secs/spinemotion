import { MotionFigure } from "../components/MotionFigure";
import {
  ActivityIcon,
  ArrowRightIcon,
  CameraIcon,
  CheckIcon,
  CpuIcon,
  FlaskIcon,
  GhostIcon,
  LockIcon,
  ScanIcon,
  ShieldIcon,
  WarningIcon,
} from "../components/Icons";

import { SwordsIcon } from "../components/arena/ArenaIcons";

interface DashboardPageProps {
  onOpenCapture: () => void;
  onOpenGhost: () => void;
  onOpenArena: () => void;
}

const roadmap = [
  {
    phase: "01",
    title: "Capture Engine",
    subtitle: "实时姿态捕捉",
    description: "摄像头、33 点骨架、FPS / 推理耗时、本地模型与错误处理。",
    status: "available",
    icon: <ScanIcon />,
  },
  {
    phase: "02",
    title: "Motion Ghost",
    subtitle: "动作数字分身",
    description: "关键点录制、时间戳、骨架回放、倍速与半透明幽灵参考。",
    status: "available",
    icon: <GhostIcon />,
  },
  {
    phase: "03",
    title: "Motion Arena",
    subtitle: "双人动作竞技",
    description: "尺度归一化、DTW 时间对齐、可解释评分、双骨架对比回放。",
    status: "available",
    icon: <SwordsIcon />,
  },
  {
    phase: "04",
    title: "MotionProof",
    subtitle: "质量反馈",
    description: "入镜检查、遮挡提示、录制状态反馈 — 已整合至录制与结果页。",
    status: "integrated",
    icon: <ShieldIcon />,
  },
  {
    phase: "05",
    title: "Motion Lab",
    subtitle: "动作分析报告",
    description: "自然语言总结、关节差异排名、动作时段分析、JSON/CSV 导出。",
    status: "integrated",
    icon: <FlaskIcon />,
  },
  {
    phase: "06",
    title: "Delivery",
    subtitle: "优化与交付",
    description: "全站 UI 优化、性能复核、离线演示与完整文档。",
    status: "available",
    icon: <CpuIcon />,
  },
];

export function DashboardPage({ onOpenCapture, onOpenGhost, onOpenArena }: DashboardPageProps) {
  const scrollToRoadmap = () => {
    document.getElementById("roadmap")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="dashboard page-enter">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            SPINEMOTION 2.0 · PHASE 3 ONLINE
          </div>
          <h1>
            双人动作竞技，
            <br />
            谁的<span className="text-gradient">动作</span>更接近原版？
          </h1>
          <p className="hero-lead">
            录制你的动作，与朋友一较高下。浏览器本地 AI 分析姿态，
            用 DTW 对齐时间、找出差异关节 —— 不上传视频，不依赖云端。
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={onOpenArena}>
              <SwordsIcon />
              开始挑战
              <ArrowRightIcon className="btn-arrow" />
            </button>
            <button className="btn btn-ghost btn-lg" onClick={onOpenCapture}>
              <CameraIcon />
              实时捕捉
            </button>
            <button className="btn btn-ghost btn-lg" onClick={onOpenGhost}>
              <GhostIcon />
              个人练习
            </button>
            <button className="btn btn-ghost btn-lg" onClick={scrollToRoadmap}>
              查看路线
            </button>
          </div>
          <div className="hero-tags" aria-label="Phase 1–2 能力标签">
            <span><CpuIcon /> 本地 MediaPipe Lite</span>
            <span><ScanIcon /> 33 关键点 / 单目标</span>
            <span><ShieldIcon /> 视频不出本机</span>
          </div>
        </div>

        <div className="hero-visual">
          <MotionFigure />
        </div>
      </section>

      <section className="fact-strip" aria-label="Phase 1–2 关键参数">
        <div className="fact">
          <span className="fact-value">33</span>
          <span className="fact-label">COCO 姿态关键点</span>
        </div>
        <div className="fact">
          <span className="fact-value">10–15</span>
          <span className="fact-label">目标推理 FPS（非测量值）</span>
        </div>
        <div className="fact">
          <span className="fact-value">0</span>
          <span className="fact-label">视频上传 / 云端存储</span>
        </div>
        <div className="fact">
          <span className="fact-value">100%</span>
          <span className="fact-label">浏览器本地推理</span>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel available-panel">
          <div className="panel-kicker">
            <span className="status-dot status-dot-live" />
            PHASE 1–3 COMPLETE · ARENA ONLINE
          </div>
          <h2>捕捉 · 录制 · 竞技</h2>
          <p className="panel-lead">
            Phase 1 实时捕捉 33 点人体骨架；Phase 2 录制动作数字分身；
            Phase 3 双人竞技：DTW 对齐、关节差异排序、双骨架同步回放。
          </p>
          <ul className="check-list">
            <li><CheckIcon /> 摄像头设备选择与 Upper / Full Body 两种模式</li>
            <li><CheckIcon /> 5–15 秒动作录制、3 秒倒计时、有效帧质量统计</li>
            <li><CheckIcon /> 真实时间戳回放、0.5× / 1× / 1.5× 与拖动定位</li>
            <li><CheckIcon /> 青蓝参考 Ghost + 橙色实时骨架，自动身体对齐</li>
            <li><CheckIcon /> 本地动作库、JSON 导入导出；不保存原始视频</li>
          </ul>
          <div className="button-row">
            <button className="btn btn-primary" onClick={onOpenGhost}>
              <GhostIcon />
              进入 Motion Ghost
            </button>
            <button className="btn btn-ghost" onClick={onOpenCapture}>
              进入 Capture
              <ArrowRightIcon className="btn-arrow" />
            </button>
          </div>
        </article>

        <aside className="panel trust-panel">
          <div className="panel-kicker">
            <ShieldIcon />
            PRIVACY BY DESIGN
          </div>
          <h2>默认不保存视频</h2>
          <p>
            摄像头画面仅进入当前页面的视频元素和本地推理管线。Motion Ghost
            仅把关键点序列写入本机动作库或下载 JSON，不保存、不上传原始视频。
          </p>
          <div className="trust-callout">
            <LockIcon />
            <div>
              <strong>研究边界</strong>
              <span>
                SpineMotion 不是临床诊断系统，不提供疾病诊断或已验证的医学评分。
              </span>
            </div>
          </div>
          <div className="signal-line">
            <ActivityIcon />
            <span>单目标追踪</span>
            <span className="signal-code">NUM_POSES = 1</span>
          </div>
        </aside>
      </section>

      <section className="roadmap-section" id="roadmap">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              BUILD ROADMAP
            </div>
            <h2>六个阶段，逐步交付真实功能</h2>
          </div>
          <p>
            当前只实现 Phase 1。后续模块按验收结果逐阶段开放，不会用不可用的页面冒充完成。
          </p>
        </div>

        <div className="roadmap-grid">
          {roadmap.map((item) => (
            <article
              className={`roadmap-card ${item.status === "available" ? "is-available" : item.status === "integrated" ? "is-integrated" : "is-planned"}`}
              key={item.phase}
            >
              <div className="roadmap-top">
                <span className="roadmap-icon">{item.icon}</span>
                <span className="roadmap-phase">PHASE {item.phase}</span>
                <span className={`roadmap-state ${item.status}`}>
                  {item.status === "available" ? (
                    <><span className="status-dot status-dot-live" /> 可用</>
                  ) : item.status === "integrated" ? (
                    <><CheckIcon /> 已整合</>
                  ) : (
                    <><LockIcon /> 计划中</>
                  )}
                </span>
              </div>
              <h3>{item.title}</h3>
              <span className="roadmap-subtitle">{item.subtitle}</span>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="boundary-note">
        <WarningIcon />
        <div>
          <strong>医学研究边界</strong>
          <p>
            本工具用于动作记录、复刻游戏、二维运动学演示与测量质量研究。
            二维图像平面角度不能直接解释为真实脊柱节段活动度，任何结果都不构成临床结论。
          </p>
        </div>
      </section>

      <footer className="site-footer">
        <span>SpineMotion 2.0 · Interactive Motion Lab · Phase 3</span>
        <span>Capture + Ghost + Arena · Local-first</span>
      </footer>
    </div>
  );
}
