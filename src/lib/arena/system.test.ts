import { describe, expect, it } from "vitest";
import { checkArenaCompatibility } from "./compatibility";
import { alignDtw } from "./dtw";
import { prepareArenaPair } from "./normalize";
import { computeArenaScore, type ArenaScoreMode } from "./scoring";
import { makeAction, makeLandmarks } from "../ghost/testFixtures";
import type { GhostAction, GhostFrame } from "../../types/ghost";
import type { PosePoint, CaptureMode } from "../../types/pose";

function buildAction(
  mode: CaptureMode,
  durationMs: number,
  nFrames: number,
  mutate?: (idx: number, landmarks: PosePoint[]) => PosePoint[],
  nullEvery?: number,
): GhostAction {
  const base = makeAction({ mode });
  const interval = durationMs / Math.max(1, nFrames - 1);
  const frames: GhostFrame[] = [];
  for (let i = 0; i < nFrames; i += 1) {
    const ts = Math.round(i * interval);
    let lm = makeLandmarks();
    if (mutate) lm = mutate(i, lm);
    if (nullEvery && i % nullEvery === 0) {
      frames.push({ timestampMs: ts, landmarks: null, quality: { valid: false, hasPose: false, visibleKeyJoints: 0, readinessGroups: 0, totalGroups: 5, missingGroups: ["全部"] } });
    } else {
      frames.push({ timestampMs: ts, landmarks: lm, quality: { valid: true, hasPose: true, visibleKeyJoints: 8, readinessGroups: 5, totalGroups: 5, missingGroups: [] } });
    }
  }
  return {
    ...base,
    durationMs,
    frames,
    recording: { ...base.recording, totalFrames: nFrames, validFrames: frames.filter(f => f.quality.valid).length, validFrameRatio: nFrames > 0 ? frames.filter(f => f.quality.valid).length / nFrames : 0, measuredFps: durationMs > 0 ? ((nFrames - 1) / durationMs) * 1000 : 0, requestedDurationMs: durationMs },
  };
}

function scorePair(a: GhostAction, b: GhostAction, mode: ArenaScoreMode) {
  const pair = prepareArenaPair(a, b, alignDtw);
  if (!pair) return null;
  return computeArenaScore(pair, mode);
}

describe("Arena system tests", () => {
  // ──── Self-comparison ────
  it("self-comparison scores near 100 (casual)", () => {
    const act = buildAction("full-body", 5000, 60);
    const s = scorePair(act, act, "casual");
    expect(s).not.toBeNull();
    expect(s!.overallMatch).toBeGreaterThanOrEqual(90);
    expect(s!.poseSimilarity).toBeGreaterThanOrEqual(95);
  });

  it("self-comparison scores near 100 (research)", () => {
    const act = buildAction("full-body", 5000, 60);
    const s = scorePair(act, act, "research");
    expect(s).not.toBeNull();
    expect(s!.overallMatch).toBeGreaterThanOrEqual(88);
  });

  // ──── Different speeds ────
  it("same action at different speed reduces timing score", () => {
    const slow = buildAction("full-body", 8000, 80);
    const fast = buildAction("full-body", 4000, 40);
    const s = scorePair(slow, fast, "research");
    expect(s).not.toBeNull();
    expect(s!.timingSimilarity).toBeLessThan(95);
  });

  it("casual mode is more lenient on timing than research", () => {
    const slow = buildAction("full-body", 8000, 60);
    const fast = buildAction("full-body", 4000, 30);
    const cs = scorePair(slow, fast, "casual");
    const rs = scorePair(slow, fast, "research");
    expect(cs).not.toBeNull();
    expect(rs).not.toBeNull();
    expect(cs!.overallMatch).toBeGreaterThanOrEqual(rs!.overallMatch - 5);
  });

  // ──── Different actions ────
  it("different actions (wrist shift) score lower than identical", () => {
    // Move only one wrist — this survives normalization which removes
    // global translation, keeping the local arm difference measurable.
    const shifted = buildAction("full-body", 5000, 60, (i, lm) => {
      if (i % 2 === 0) return lm; // leave every other frame unchanged
      return lm.map((p, idx) => (idx === 15 ? { ...p, x: p.x + 0.08, y: p.y - 0.06 } : p));
    });
    const orig = buildAction("full-body", 5000, 60);
    const same = scorePair(orig, orig, "research");
    const diff = scorePair(orig, shifted, "research");
    expect(same).not.toBeNull();
    expect(diff).not.toBeNull();
    // Different wrist poses should lower the pose score
    expect(diff!.poseSimilarity).toBeLessThan(same!.poseSimilarity);
  });

  // ──── Key joint missing ────
  it("upper-body mode rejects when shoulders + hips invisible", () => {
    const bad = buildAction("upper-body", 5000, 60, (_i, lm) =>
      lm.map((p, idx) => ([11, 12, 23, 24].includes(idx) ? { ...p, visibility: 0.1 } : p)),
    );
    const compat = checkArenaCompatibility(bad, bad);
    expect(compat.compatible).toBe(false);
  });

  it("full-body mode rejects when only upper body key joints visible", () => {
    // Full-body needs ≥5 key joints (min=5), so shoulders+hips alone (4) fails.
    const ub = buildAction("full-body", 5000, 60, (_i, lm) =>
      lm.map((p, idx) => (idx >= 25 ? { ...p, visibility: 0.1 } : p)),
    );
    const compat = checkArenaCompatibility(ub, ub);
    expect(compat.compatible).toBe(false);
  });

  // ──── Low motion amplitude ────
  it("static poses produce quality note about low amplitude", () => {
    const staticAct = buildAction("full-body", 3000, 30);
    const s = scorePair(staticAct, staticAct, "research");
    expect(s).not.toBeNull();
    const hasAmpNote = s!.quality.reviewNotes.some((n) => n.includes("运动幅度"));
    expect(hasAmpNote).toBe(true);
  });

  // ──── Frame gaps ────
  it("handles gaps (null frames) without crashing", () => {
    const gapped = buildAction("full-body", 5000, 60, undefined, 5);
    const normal = buildAction("full-body", 5000, 60);
    const s = scorePair(gapped, normal, "casual");
    expect(s).not.toBeNull();
    expect(s!.overallMatch).toBeGreaterThanOrEqual(0);
    expect(s!.overallMatch).toBeLessThanOrEqual(100);
  });

  // ──── Determinism ────
  it("produces consistent scores on repeated calls", () => {
    const a = buildAction("full-body", 5000, 30);
    const b = buildAction("full-body", 5000, 30);
    const s1 = scorePair(a, b, "research");
    const s2 = scorePair(a, b, "research");
    expect(s1?.overallMatch).toBe(s2?.overallMatch);
    expect(s1?.poseSimilarity).toBe(s2?.poseSimilarity);
  });

  // ──── Quality gate ────
  it("rejects pairs with zero valid frames", () => {
    const compat = checkArenaCompatibility(
      buildAction("full-body", 5000, 0),
      buildAction("full-body", 5000, 0),
    );
    expect(compat.compatible).toBe(false);
    expect(compat.reasons.some((r) => r.includes("有效帧"))).toBe(true);
  });

  it("quality gate passes for well-formed data", () => {
    const a = buildAction("full-body", 5000, 60);
    const s = scorePair(a, a, "research");
    expect(s).not.toBeNull();
    expect(s!.quality.acceptable).toBe(true);
  });
});