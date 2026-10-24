import { describe, expect, it } from "vitest";
import { buildResultSummary, describeSubScore } from "./summary";
import { makeAction } from "../ghost/testFixtures";
import type { ArenaScore } from "../../types/arena";
import type { GhostAction } from "../../types/ghost";

function baseScore(overrides: Partial<ArenaScore> = {}): ArenaScore {
  return {
    poseSimilarity: 71,
    timingSimilarity: 93,
    overallMatch: 77,
    jointDifferences: [
      { landmarkIndex: 15, label: "left_wrist", labelZh: "左手腕", meanDistance: 0.12, maxDistance: 0.3, sampleCount: 50 },
      { landmarkIndex: 14, label: "right_elbow", labelZh: "右肘", meanDistance: 0.09, maxDistance: 0.22, sampleCount: 50 },
      { landmarkIndex: 16, label: "right_wrist", labelZh: "右手腕", meanDistance: 0.08, maxDistance: 0.2, sampleCount: 50 },
    ],
    keyMoments: [{ startMs: 1800, endMs: 2600, meanDistance: 0.2, peakDistance: 0.42 }],
    quality: { acceptable: true, reasons: [], reviewNotes: [] },
    explanation: "技术说明",
    ...overrides,
  };
}

function makeActionWithDuration(durationMs: number): GhostAction {
  return { ...makeAction({ mode: "full-body" }), durationMs };
}

describe("buildResultSummary", () => {
  it("高分时间分不会输出负面节奏文案（时长与节律分离）", () => {
    const score = baseScore({ overallMatch: 77, poseSimilarity: 71, timingSimilarity: 93 });
    const a = makeActionWithDuration(8000);
    const b = makeActionWithDuration(8000);
    const text = buildResultSummary(score, a, b);
    // 总时长一致 + 高时间分 → 应为积极/中性文案
    expect(text).toContain("总用时几乎一致");
    expect(text).toContain("时间与节律表现很好");
    expect(text).not.toContain("差异较大");
    expect(text).not.toContain("速度");
  });

  it("时长相差明显时单独提示，不与高时间分冲突", () => {
    const score = baseScore({ timingSimilarity: 92, overallMatch: 74 });
    const a = makeActionWithDuration(7000);
    const b = makeActionWithDuration(8000);
    const text = buildResultSummary(score, a, b);
    expect(text).toContain("总用时只差 1.0 秒");
    expect(text).toContain("时间与节律表现很好");
  });

  it("低时间分才会提示节律差异大", () => {
    const score = baseScore({ timingSimilarity: 45, overallMatch: 50 });
    const a = makeActionWithDuration(5500);
    const b = makeActionWithDuration(8200);
    const text = buildResultSummary(score, a, b);
    expect(text).toContain("节律差异较大");
  });

  it("使用中文关节名而非编号", () => {
    const text = buildResultSummary(baseScore(), makeActionWithDuration(8000), makeActionWithDuration(8000));
    expect(text).toContain("左手腕");
    expect(text).not.toContain("#");
  });

  it("质量不合格时追加提示", () => {
    const score = baseScore();
    score.quality = { acceptable: false, reasons: ["可见性不足"], reviewNotes: [] };
    const text = buildResultSummary(score, makeActionWithDuration(8000), makeActionWithDuration(8000));
    expect(text).toContain("重新录制");
  });

  it("文案全部来自真实指标，不固定套用赞美", () => {
    const low = buildResultSummary(
      baseScore({ overallMatch: 30, poseSimilarity: 22, timingSimilarity: 18 }),
      makeActionWithDuration(8000),
      makeActionWithDuration(9800),
    );
    expect(low).toContain("差异较大");
    expect(low).not.toContain("几乎一致");
  });
});

describe("describeSubScore", () => {
  it("pose 档位文案", () => {
    expect(describeSubScore(92, "pose")).toBe("姿态几乎一致");
    expect(describeSubScore(76, "pose")).toBe("姿态比较接近");
    expect(describeSubScore(61, "pose")).toBe("姿态有些偏差");
    expect(describeSubScore(40, "pose")).toBe("姿态差异明显");
  });

  it("timing 档位文案", () => {
    expect(describeSubScore(92, "timing")).toBe("节奏非常同步");
    expect(describeSubScore(76, "timing")).toBe("节奏基本同步");
    expect(describeSubScore(61, "timing")).toBe("节奏略有出入");
    expect(describeSubScore(40, "timing")).toBe("节奏差异较大");
  });
});