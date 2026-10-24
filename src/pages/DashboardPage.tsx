import { MotionFigure } from "../components/MotionFigure";
import {
  ArrowRightIcon,
  CameraIcon,
  GhostIcon,
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

export function DashboardPage({ onOpenCapture, onOpenGhost, onOpenArena }: DashboardPageProps) {
  return (
    <div className="dashboard page-enter">
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Your Moves.
            <br />
            <span className="text-gradient">Your Challenge.</span>
          </h1>
          <p className="hero-lead">
            录下一个动作，邀请朋友复刻，看看你们有多默契。
            浏览器本地 AI 分析姿态 —— 不上传视频，不依赖云端。
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={onOpenArena}>
              <SwordsIcon />
              开始双人挑战
              <ArrowRightIcon className="btn-arrow" />
            </button>
            <button className="btn btn-ghost btn-lg" onClick={onOpenGhost}>
              <GhostIcon />
              录制动作分身
            </button>
            <button className="btn btn-ghost btn-lg" onClick={onOpenCapture}>
              <CameraIcon />
              实时姿态捕捉
            </button>
          </div>
          <div className="hero-tags" aria-label="能力标签">
            <span><ShieldIcon /> 浏览器本地处理</span>
            <span><ScanIcon /> 33 点人体骨架</span>
            <span><CameraIcon /> 支持 iPhone 相机</span>
          </div>
        </div>
        <div className="hero-visual">
          <MotionFigure />
        </div>
      </section>

      <section className="how-it-works">
        <h2>三步开始</h2>
        <div className="steps-row">
          <div className="step-card">
            <span className="step-num">1</span>
            <h3>录制参考动作</h3>
            <p>玩家 A 在镜头前做出一个动作，系统自动记录 33 个身体关键点轨迹。</p>
          </div>
          <div className="step-card">
            <span className="step-num">2</span>
            <h3>朋友来复刻</h3>
            <p>玩家 B 观看回放后，在镜头前复刻同一动作，系统同步采集关键点数据。</p>
          </div>
          <div className="step-card">
            <span className="step-num">3</span>
            <h3>查看分析结果</h3>
            <p>AI 对齐两段动作的时间轴，对比姿态差异，定位最不一致的部位。</p>
          </div>
        </div>
        <p className="how-it-works-note">
          使用前请确保上半身完整入镜，光线充足。Mac 和 iPhone 连续互通相机均可使用。
        </p>
      </section>

      <section className="features-strip">
        <div className="feature">
          <ShieldIcon />
          <strong>隐私优先</strong>
          <span>所有数据在浏览器本地处理，视频不离开你的设备。</span>
        </div>
        <div className="feature">
          <ScanIcon />
          <strong>33 点追踪</strong>
          <span>MediaPipe 实时识别头、肩、肘、腕、髋、膝、踝。</span>
        </div>
        <div className="feature">
          <SwordsIcon />
          <strong>趣味竞技</strong>
          <span>DTW 时间对齐 + 多维度评分，看看谁是复刻大师。</span>
        </div>
      </section>

      <section className="boundary-note">
        <WarningIcon />
        <div>
          <strong>使用提示</strong>
          <p>
            本工具用于动作记录与趣味复刻挑战，不是医疗器械，不提供临床诊断。
            二维图像分析不能直接解释为三维解剖角度。
          </p>
        </div>
      </section>

      <footer className="site-footer">
        <span>SpineMotion — Your Moves. Your Challenge.</span>
        <span>本地推理 · 隐私优先 · 不上传视频</span>
      </footer>
    </div>
  );
}