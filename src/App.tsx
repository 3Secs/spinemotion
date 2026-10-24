import { useEffect, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import {
  CameraIcon,
  GhostIcon,
  ShieldIcon,
} from "./components/Icons";
import { SwordsIcon } from "./components/arena/ArenaIcons";
import { CapturePage } from "./pages/CapturePage";
import { DashboardPage } from "./pages/DashboardPage";
import { MotionGhostPage } from "./pages/MotionGhostPage";
import { MotionArenaPage } from "./pages/MotionArenaPage";

type Route = "dashboard" | "capture" | "ghost" | "arena";

function readRoute(): Route {
  if (window.location.hash.startsWith("#/ghost")) return "ghost";
  if (window.location.hash.startsWith("#/arena")) return "arena";
  if (window.location.hash.startsWith("#/capture")) return "capture";
  return "dashboard";
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const handleHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    document.title =
      route === "capture"
        ? "实时姿态捕捉 · SpineMotion"
        : route === "ghost"
          ? "Motion Ghost · SpineMotion"
          : route === "arena"
            ? "Motion Arena · SpineMotion"
            : "SpineMotion — Human Motion Lab";
  }, [route]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand-link" href="#/dashboard" aria-label="SpineMotion 首页">
            <BrandMark className="brand-mark" />
            <span className="brand-text">
              <strong>SpineMotion</strong>
              <span>YOUR MOVES · YOUR CHALLENGE</span>
            </span>
          </a>

          <nav className="main-nav" aria-label="主导航">
            <a
              className={`nav-link ${route === "dashboard" ? "is-active" : ""}`}
              href="#/dashboard"
              aria-current={route === "dashboard" ? "page" : undefined}
            >
              首页
            </a>
            <a
              className={`nav-link ${route === "capture" ? "is-active" : ""}`}
              href="#/capture"
              aria-current={route === "capture" ? "page" : undefined}
            >
              <CameraIcon />
              实时捕捉
            </a>
            <a
              className={`nav-link ${route === "ghost" ? "is-active" : ""}`}
              href="#/ghost"
              aria-current={route === "ghost" ? "page" : undefined}
            >
              <GhostIcon />
              动作分身
            </a>
            <a
              className={`nav-link ${route === "arena" ? "is-active" : ""}`}
              href="#/arena"
              aria-current={route === "arena" ? "page" : undefined}
            >
              <SwordsIcon />
              双人竞技
            </a>
          </nav>

          <div className="topbar-meta">
            <span className="meta-dot" />
            <span className="meta-label">浏览器本地推理</span>
          </div>
        </div>
      </header>

      <main id="main-content" className="app-main">
        {route === "capture" ? (
          <CapturePage />
        ) : route === "ghost" ? (
          <MotionGhostPage />
        ) : route === "arena" ? (
          <MotionArenaPage />
        ) : (
          <DashboardPage
            onOpenCapture={() => { window.location.hash = "#/capture"; }}
            onOpenGhost={() => { window.location.hash = "#/ghost"; }}
            onOpenArena={() => { window.location.hash = "#/arena"; }}
          />
        )}
      </main>

      <div className="global-footnote">
        <ShieldIcon />
        <span>浏览器本地处理 · 不上传视频 · 非临床诊断工具</span>
      </div>
    </div>
  );
}
