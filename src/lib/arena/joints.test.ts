import { describe, expect, it } from "vitest";
import { JOINT_GROUPS, jointGroupsForMode, jointIndicesForMode, groupForIndex } from "./joints";

describe("joint groups", () => {
  it("upper-body mode includes shoulders, elbows, wrists, hips", () => {
    const groups = jointGroupsForMode("upper-body");
    expect(groups.map((g) => g.label)).toEqual(["shoulder", "elbow", "wrist", "hip"]);
  });

  it("full-body mode includes all 6 groups", () => {
    const groups = jointGroupsForMode("full-body");
    expect(groups).toHaveLength(6);
  });

  it("upper-body indices include 11,12,13,14,15,16,23,24", () => {
    const indices = jointIndicesForMode("upper-body");
    expect(indices.sort((a, b) => a - b)).toEqual([11, 12, 13, 14, 15, 16, 23, 24]);
  });

  it("groupForIndex returns correct group", () => {
    expect(groupForIndex(11)?.label).toBe("shoulder");
    expect(groupForIndex(25)?.label).toBe("knee");
    expect(groupForIndex(0)).toBeNull();
    expect(groupForIndex(33)).toBeNull();
  });

  it("JOINT_GROUPS has 6 anatomical groups", () => {
    expect(JOINT_GROUPS).toHaveLength(6);
  });
});