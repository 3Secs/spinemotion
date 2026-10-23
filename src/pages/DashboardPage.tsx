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
    subtitle: "动作复刻挑战",
    description: "尺度归一化、DTW 时间对齐、可解释复刻评分与差异定位。",
    status: "available",
    icon: <SwordsIcon />,
  },
  {
    phase: "04",
    title: "MotionProof",
    subtitle: "测量质量审核",
    description: "完整入镜、遮挡、跳变、丢帧与可比性检查，拒绝无效评分。",
    status: "planned",
    icon: <ShieldIcon />,
  },
  {
    phase: "05",
    title: "Motion Lab",
    subtitle: "专业运动分析",
    description: "关节角度曲线、轨迹对比、时序差异、热区与 JSON / CSV 导出。",
    status: "planned",
    icon: <FlaskIcon />,
  },
  {
    phase: "06",
    title: "Delivery",
    subtitle: "优化与交付",
    description: "全站交互、性能复核、离线演示与完整研究文档。",
    status: "planned",
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
            SPINEMOTION 2.0 · PHASE 2 ONLINE
          </div>
          <h1>
            把人体动作，
            <br />
            变成<span className="text-gradient">可验证</span>的数字证据。
          </h1>
          <p className="hero-lead">
            一个在浏览器本地运行的人体运动实验室。实时捕捉姿态，记录动作数字分身，
            再用可解释的算法比较、分析与质控——不上传视频，不依赖云端 AI。
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={onOpenCapture}>
              <CameraIcon />
              启动实时捕捉
              <ArrowRightIcon className="btn-arrow" />
            </button>
            <button className="btn btn-ghost btn-lg" onClick={onOpenGhost}>
              <GhostIcon />
              打开 Motion Ghost
            </button>
            <button className="btn btn-ghost btn-lg" onClick={onOpenArena}>
              <SwordsIcon />
              Motion Arena
            </button>
            <button className="btn btn-ghost btn-lg" onClick={scrollToRoadmap}>
              查看开发路线
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
            CURRENTLY AVAILABLE
          </div>
          <h2>Phase 1–2 · 捕捉与动作分身已接通</h2>
          <p className="panel-lead">
            Phase 1 提供实时单人姿态捕捉；Phase 2 增加关键点动作录制、真实时间轴回放、
            本地 JSON 动作库，以及实时画面上的半透明 Ghost 骨架。
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
              className={`roadmap-card ${item.status === "available" ? "is-available" : "is-planned"}`}
              key={item.phase}
            >
              <div className="roadmap-top">
                <span className="roadmap-icon">{item.icon}</span>
                <span className="roadmap-phase">PHASE {item.phase}</span>
                <span className={`roadmap-state ${item.status}`}>
                  {item.status === "available" ? (
                    <><span className="status-dot status-dot-live" /> 可用</>
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
        <span>SpineMotion 2.0 · Interactive &amp; Trustworthy Human Motion Lab</span>
        <span>Phase 1–2 · Capture + Motion Ghost · Local-first</span>
      </footer>
    </div>
  );
}
