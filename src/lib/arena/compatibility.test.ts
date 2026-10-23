import { describe, expect, it } from "vitest";
import { checkArenaCompatibility } from "./compatibility";
import { makeAction } from "../ghost/testFixtures";
import type { GhostAction } from "../../types/ghost";

describe("Arena compatibility check", () => {
  const ref = makeAction({ mode: "upper-body" });
  const imit = makeAction({ mode: "upper-body" });

  it("passes two compatible actions", () => {
    const result = checkArenaCompatibility(ref, imit);
    expect(result.compatible).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("rejects when modes differ", () => {
    const full = makeAction({ mode: "full-body" });
    const result = checkArenaCompatibility(ref, full);
    expect(result.compatible).toBe(false);
    expect(result.reasons.some((r) => r.includes("模式"))).toBe(true);
  });

  it("rejects when an action has zero valid frames", () => {
    const empty = makeAction();
    const zeroValid: GhostAction = {
      ...empty,
      recording: { ...empty.recording, validFrames: 0 },
      frames: empty.frames.map((f) => ({
        ...f,
        quality: { ...f.quality, valid: false },
      })),
    };
    const result = checkArenaCompatibility(zeroValid, imit);
    expect(result.compatible).toBe(false);
  });

  it("warns about mirror mismatch", () => {
    const mirrored = makeAction({ mirrored: true });
    const result = checkArenaCompatibility(ref, mirrored);
    expect(result.compatible).toBe(true);
    expect(result.warnings.some((w) => w.includes("镜像"))).toBe(true);
  });

  it("warns about large duration difference", () => {
    const short: GhostAction = {
      ...ref,
      durationMs: 1000,
      recording: { ...ref.recording, requestedDurationMs: 1000 },
      frames: [ref.frames[0]],
    };
    const long: GhostAction = {
      ...ref,
      durationMs: 10000,
      recording: { ...ref.recording, requestedDurationMs: 10000 },
    };
    const result = checkArenaCompatibility(short, long);
    expect(result.warnings.some((w) => w.includes("时长"))).toBe(true);
  });

  it("warns about large aspect ratio difference", () => {
    const wide: GhostAction = {
      ...ref,
      capture: { ...ref.capture, videoWidth: 1920, videoHeight: 1080, aspectRatio: 1920 / 1080 },
    };
    const tall: GhostAction = {
      ...ref,
      capture: { ...ref.capture, videoWidth: 480, videoHeight: 640, aspectRatio: 480 / 640 },
    };
    const result = checkArenaCompatibility(wide, tall);
    expect(result.warnings.some((w) => w.includes("宽高比"))).toBe(true);
  });

  it("allows upper-body mode without knee/ankle visibility (mode-aware key joints)", () => {
    const ub = makeAction({ mode: "upper-body" });
    const modified = {
      ...ub,
      frames: ub.frames.map((f) => ({
        ...f,
        quality: { ...f.quality, valid: true },
        landmarks: f.landmarks
          ? f.landmarks.map((p, idx) =>
              idx >= 25 ? { ...p, visibility: 0.1 } : p,
            )
          : null,
      })),
    };
    const result = checkArenaCompatibility(modified, modified);
    expect(result.compatible).toBe(true);
  });

  it("rejects when shoulders and hips are invisible even in upper-body", () => {
    const ub = makeAction({ mode: "upper-body" });
    const bad = {
      ...ub,
      frames: ub.frames.map((f) => ({
        ...f,
        quality: { ...f.quality, valid: true },
        landmarks: f.landmarks
          ? f.landmarks.map((p, idx) =>
              idx === 11 || idx === 12 || idx === 23 || idx === 24
                ? { ...p, visibility: 0.1 }
                : p,
            )
          : null,
      })),
    };
    const result = checkArenaCompatibility(bad, bad);
    expect(result.compatible).toBe(false);
  });
});