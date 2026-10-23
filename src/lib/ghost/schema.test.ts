import { describe, expect, it } from "vitest";
import { makeAction, makeFrame, makeLandmarks } from "./testFixtures";
import {
  createGhostFileName,
  parseGhostActionJson,
  serializeGhostAction,
  validateGhostAction,
} from "./schema";

describe("GhostAction v1 schema", () => {
  it("round-trips a valid action through JSON", () => {
    const action = makeAction();
    const serialized = serializeGhostAction(action);
    const parsed = parseGhostActionJson(serialized);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.action).toEqual(action);
      expect(parsed.action.frames).toHaveLength(3);
      expect(parsed.action.frames[0].landmarks?.[11].presence).toBe(0.9);
      expect(parsed.action.recording.validFrameRatio).toBe(1);
    }
  });

  it("rejects an unsupported schema version", () => {
    const action = makeAction();
    const result = validateGhostAction({ ...action, version: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("版本");
  });

  it("rejects the wrong schema id and coordinate space", () => {
    const action = makeAction();
    expect(validateGhostAction({ ...action, schema: "other" }).ok).toBe(false);
    expect(validateGhostAction({ ...action, coordinateSpace: "pixels" }).ok).toBe(false);
  });

  it("rejects frames with missing or extra landmarks", () => {
    const action = makeAction();
    const landmarks = makeLandmarks().slice(0, 32);
    const frames = [makeFrame(0, landmarks)];
    const result = validateGhostAction({
      ...action,
      frames,
      durationMs: 0,
      recording: {
        ...action.recording,
        totalFrames: 1,
        validFrames: 1,
        validFrameRatio: 1,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("33");
  });

  it("rejects non-monotonic frame timestamps", () => {
    const action = makeAction();
    const frames = [makeFrame(100), makeFrame(100)];
    const result = validateGhostAction({
      ...action,
      frames,
      durationMs: 100,
      recording: {
        ...action.recording,
        totalFrames: 2,
        validFrames: 2,
        validFrameRatio: 1,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("递增");
  });

  it("rejects a duration that does not match the last frame", () => {
    const action = makeAction();
    const result = validateGhostAction({ ...action, durationMs: 999 });
    expect(result.ok).toBe(false);
  });

  it("rejects malformed JSON", () => {
    const result = parseGhostActionJson("{not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("JSON");
  });

  it("creates a filesystem-safe file name", () => {
    const action = makeAction();
    const name = createGhostFileName({ ...action, name: "测试 / Upper Body: 01" });
    expect(name).toMatch(/\.json$/);
    expect(name).not.toContain("/");
    expect(name).not.toContain(":");
  });
});
