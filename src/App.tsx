import { useEffect, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { CameraIcon, CpuIcon, ShieldIcon } from "./components/Icons";
import { CapturePage } from "./pages/CapturePage";
import { DashboardPage } from "./pages/DashboardPage";

type Route = "dashboard" | "capture";

function readRoute(): Route {
  return window.location.hash.startsWith("#/capture") ? "capture" : "dashboard";
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
        ? "实时姿态捕捉 · SpineMotion 2.0"
        : "SpineMotion 2.0 — Human Motion Lab";
  }, [route]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand-link" href="#/dashboard" aria-label="SpineMotion 2.0 首页">
            <BrandMark className="brand-mark" />
            <span className="brand-text">
              <strong>SpineMotion <em>2.0</em></strong>
              <span>HUMAN MOTION LAB</span>
            </span>
          </a>

          <nav className="main-nav" aria-label="主导航">
            <a
              className={`nav-link ${route === "dashboard" ? "is-active" : ""}`}
              href="#/dashboard"
              aria-current={route === "dashboard" ? "page" : undefined}
            >
              控制台
            </a>
            <a
              className={`nav-link ${route === "capture" ? "is-active" : ""}`}
              href="#/capture"
              aria-current={route === "capture" ? "page" : undefined}
            >
              <CameraIcon />
              实时捕捉
            </a>
            <span className="nav-link nav-disabled" aria-disabled="true">
              <CpuIcon />
              Ghost / Arena
              <small>PHASE 2+</small>
            </span>
          </nav>

          <div className="topbar-meta">
            <span className="meta-dot" />
            <span className="meta-label">LOCAL INFERENCE</span>
          </div>
        </div>
      </header>

      <main id="main-content" className="app-main">
        {route === "capture" ? (
          <CapturePage />
        ) : (
          <DashboardPage onOpenCapture={() => { window.location.hash = "#/capture"; }} />
        )}
      </main>

      <div className="global-footnote">
        <ShieldIcon />
        <span>浏览器本地处理 · 不上传视频 · 非临床诊断工具</span>
      </div>
    </div>
  );
}
