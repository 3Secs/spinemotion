#!/usr/bin/env node
/* Measure layout of the app via Chrome DevTools Protocol and dump JSON.
   Usage: node scripts/layout-check.mjs <url> <selector...> */
import { spawn } from "node:child_process";

const url = process.argv[2];
const selectors = process.argv.slice(3);
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9333;
const width = Number(process.env.VW || 1440);
const height = Number(process.env.VH || 900);

const chrome = spawn(chromePath, [
  "--headless=new", "--disable-gpu", "--no-sandbox",
  `--remote-debugging-port=${port}`,
  `--window-size=${width},${height}`,
  "--user-data-dir=/tmp/spine-chrome-profile",
  url,
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return res.json();
}

async function main() {
  // Wait for CDP to be ready
  let targets = null;
  for (let i = 0; i < 40; i += 1) {
    try {
      targets = await getJson("/json/list");
      if (targets && targets.length > 0) break;
    } catch { /* retry */ }
    await sleep(250);
  }
  if (!targets || targets.length === 0) {
    console.error("No CDP target found");
    chrome.kill();
    process.exit(1);
  }
  const page = targets.find((t) => t.type === "page") ?? targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
  };
  await new Promise((r) => (ws.onopen = r));

  // Force the viewport size (window-size flag is not always honoured in headless)
  await send("Emulation.setDeviceMetricsOverride", {
    width, height,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Wait until stylesheets are loaded and layout is done
  for (let i = 0; i < 30; i += 1) {
    const ready = await send("Runtime.evaluate", {
      expression: `document.readyState === "complete" && document.styleSheets.length > 0 && !!document.querySelector('.vc-side')`,
      returnByValue: true,
    });
    if (ready.result?.value === true) break;
    await sleep(300);
  }
  await sleep(1500);

  const expr = `
    (() => {
      const out = {};
      const viewport = { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio };
      out.viewport = viewport;
      const sel = ${JSON.stringify(selectors)};
      for (const s of sel) {
        const el = document.querySelector(s);
        if (!el) { out[s] = null; continue; }
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        out[s] = {
          x: Math.round(r.x), y: Math.round(r.y),
          w: Math.round(r.width), h: Math.round(r.height),
          display: style.display,
          gridCols: style.gridTemplateColumns,
        };
      }
      // Two canvases side-by-side check
      const cvs = Array.from(document.querySelectorAll('.vc-canvas'));
      if (cvs.length >= 2) {
        const r0 = cvs[0].getBoundingClientRect();
        const r1 = cvs[1].getBoundingClientRect();
        out.sideBySide = {
          sameRow: Math.abs(r0.y - r1.y) < 2,
          equalWidth: Math.abs(r0.width - r1.width) < 2,
          sameHeight: Math.abs(r0.height - r1.height) < 2,
          w0: Math.round(r0.width), w1: Math.round(r1.width),
          h0: Math.round(r0.height), h1: Math.round(r1.height),
        };
      }
      // Overflow check
      const doc = document.documentElement;
      out.overflow = { scrollW: doc.scrollWidth, clientW: doc.clientWidth };
      return JSON.stringify(out);
    })()
  `;
  const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  console.log(res.result.value);
  ws.close();
  chrome.kill();
}

main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
