import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "node_modules/@mediapipe/tasks-vision/wasm");
const destination = resolve(root, "public/wasm");
const model = resolve(root, "public/models/pose_landmarker_lite.task");

if (!existsSync(source)) {
  console.error(
    "[assets] MediaPipe wasm directory not found. Run `npm install` first.",
  );
  process.exit(1);
}

mkdirSync(destination, { recursive: true });
cpSync(source, destination, {
  recursive: true,
  filter: (path) => /\.(js|wasm)$/.test(path) || statSync(path).isDirectory(),
});

const files = readdirSync(destination).filter((file) => !file.startsWith("."));
console.log(`[assets] Synced ${files.length} MediaPipe runtime files -> public/wasm`);

if (!existsSync(model)) {
  console.warn(
    "[assets] Pose Landmarker Lite model is missing: public/models/pose_landmarker_lite.task",
  );
  console.warn(
    "[assets] Download it from the official MediaPipe model card before running the app.",
  );
} else {
  console.log("[assets] Local Pose Landmarker Lite model is present");
}
