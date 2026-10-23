import { describe, expect, it } from "vitest";
import { MotionRecorder } from "../lib/ghost/recorder";
import { makeSample } from "../lib/ghost/testFixtures";

/**
 * Verify that the MotionRecorder accepts frames whose duration is measured
 * via performance.now()-style wall-clock logic.
 *
 * The actual useArenaSession hook requires a running MediaPipe pipeline and
 * is tested via manual end-to-end verification. These tests cover the
 * underlying recording / timing building blocks.
 */
describe("motion recorder basics (arena reliance)", () => {
  it("records frames with advancing manual timestamps", () => {
    const recorder = new MotionRecorder({
      requestedDurationMs: 5000,
      mode: "full-body",
      mirrored: false,
      targetFps: 12,
    });

    recorder.start();
    expect(recorder.isActive()).toBe(true);
    expect(recorder.snapshot().frameCount).toBe(0);

    // Feed frames at 100 ms intervals for 5 seconds
    for (let ms = 0; ms <= 5000; ms += 100) {
      const sample = makeSample(ms);
      const result = recorder.addFrame(sample);
      expect(result.accepted).toBe(true);
      if (ms >= 5000) {
        expect(result.reachedDuration).toBe(true);
        expect(recorder.isActive()).toBe(false);
      } else {
        expect(result.reachedDuration).toBe(false);
      }
    }

    expect(recorder.isActive()).toBe(false);
    const snapshot = recorder.snapshot();
    expect(snapshot.frameCount).toBeGreaterThan(0);
  });

  it("finishes recording even without detected poses", () => {
    const recorder = new MotionRecorder({
      requestedDurationMs: 3000,
      mode: "upper-body",
      mirrored: false,
      targetFps: 12,
    });
    recorder.start();

    // Feed frames with null landmarks — timestamps still advance
    for (let ms = 0; ms <= 3100; ms += 150) {
      const sample = makeSample(ms, { landmarks: null });
      const result = recorder.addFrame(sample);
      expect(result.accepted).toBe(true);
    }

    const action = recorder.stop();
    expect(action).not.toBeNull();
    expect(action!.frames.length).toBeGreaterThan(0);
    expect(action!.recording.validFrames).toBe(0);
    // Null-landmark frames are recorded but marked invalid
  });

  it("returns null from stop() when no frames were added", () => {
    const recorder = new MotionRecorder({
      requestedDurationMs: 2000,
      mode: "full-body",
      mirrored: false,
      targetFps: 12,
    });
    recorder.start();
    const action = recorder.stop();
    expect(action).toBeNull();
  });

  it("manual stop is idempotent", () => {
    const recorder = new MotionRecorder({
      requestedDurationMs: 10000,
      mode: "full-body",
      mirrored: false,
      targetFps: 12,
    });
    recorder.start();
    const sample = makeSample(0);
    recorder.addFrame(sample);

    const first = recorder.stop();
    expect(first).not.toBeNull();

    // Second stop returns the same action data (recorder has frames; stop() is
    // self-contained and always returns data when frames exist).
    const second = recorder.stop();
    expect(second).not.toBeNull();
  });

  it("rejects frames after manual stop", () => {
    const recorder = new MotionRecorder({
      requestedDurationMs: 5000,
      mode: "upper-body",
      mirrored: false,
      targetFps: 12,
    });
    recorder.start();
    recorder.addFrame(makeSample(0));
    recorder.stop();

    const result = recorder.addFrame(makeSample(1000));
    expect(result.accepted).toBe(false);
    expect(result.reachedDuration).toBe(false);
  });
});