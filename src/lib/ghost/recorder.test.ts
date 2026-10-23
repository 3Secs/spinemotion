import { describe, expect, it } from "vitest";
import { MotionRecorder } from "./recorder";
import { makeSample } from "./testFixtures";

function recorder(mode: "upper-body" | "full-body" = "full-body") {
  return new MotionRecorder({
    requestedDurationMs: 8000,
    mode,
    mirrored: false,
    targetFps: 12,
    activeDelegate: "GPU",
    cameraLabel: "Test Camera",
  });
}

describe("MotionRecorder", () => {
  it("records an 8 second action with real timestamps and quality stats", () => {
    const instance = recorder();
    instance.start();
    let lastResult = { accepted: false, reachedDuration: false };
    for (let time = 0; time <= 8000; time += 80) {
      const landmarks = time === 800 || time === 1600 ? null : undefined;
      lastResult = instance.addFrame(
        makeSample(time, { landmarks }),
      );
    }
    expect(lastResult.reachedDuration).toBe(true);
    expect(instance.isActive()).toBe(false);

    const action = instance.stop("Eight seconds");
    expect(action).not.toBeNull();
    if (!action) return;
    expect(action.name).toBe("Eight seconds");
    expect(action.mode).toBe("full-body");
    expect(action.durationMs).toBe(8000);
    expect(action.frames).toHaveLength(101);
    expect(action.frames[0].timestampMs).toBe(0);
    expect(action.frames[10].landmarks).toBeNull();
    expect(action.frames[10].quality.hasPose).toBe(false);
    expect(action.recording.totalFrames).toBe(101);
    expect(action.recording.validFrames).toBe(99);
    expect(action.recording.validFrameRatio).toBeCloseTo(99 / 101, 5);
    expect(action.recording.measuredFps).toBeCloseTo(12.5, 3);
    expect(action.capture.videoWidth).toBe(1280);
    expect(action.capture.aspectRatio).toBeCloseTo(16 / 9, 5);
    expect(action.frames[0].landmarks?.[11].presence).toBe(0.9);
  });

  it("finalizes a partial recording when stopped early", () => {
    const instance = recorder("upper-body");
    instance.start();
    for (let time = 0; time <= 720; time += 80) {
      instance.addFrame(makeSample(time, { mode: "upper-body" }));
    }
    const action = instance.stop();
    expect(action).not.toBeNull();
    if (!action) return;
    expect(action.durationMs).toBe(720);
    expect(action.mode).toBe("upper-body");
    expect(action.recording.totalFrames).toBe(10);
    expect(action.recording.validFrames).toBe(10);
  });

  it("returns null when stopped without frames", () => {
    const instance = recorder();
    instance.start();
    expect(instance.stop()).toBeNull();
  });

  it("does not fabricate landmarks for missing poses", () => {
    const instance = recorder();
    instance.start();
    instance.addFrame(makeSample(0, { landmarks: null }));
    instance.addFrame(makeSample(80, { landmarks: null }));
    const action = instance.stop();
    expect(action).not.toBeNull();
    if (!action) return;
    expect(action.frames).toHaveLength(2);
    expect(action.frames.every((frame) => frame.landmarks === null)).toBe(true);
    expect(action.frames.every((frame) => frame.quality.valid === false)).toBe(true);
    expect(action.recording.validFrames).toBe(0);
  });

  it("ignores duplicate timestamps and malformed landmark counts", () => {
    const instance = recorder();
    instance.start();
    instance.addFrame(makeSample(100));
    const duplicate = instance.addFrame(makeSample(100));
    expect(duplicate.accepted).toBe(false);
    const malformed = instance.addFrame(
      makeSample(180, { landmarks: makeSample(0).landmarks?.slice(0, 32) ?? null }),
    );
    expect(malformed.accepted).toBe(false);
    const action = instance.stop();
    expect(action?.frames).toHaveLength(1);
  });
});
