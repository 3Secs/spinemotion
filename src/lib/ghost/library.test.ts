import { describe, expect, it } from "vitest";
import {
  GHOST_LIBRARY_KEY,
  loadGhostLibrary,
  persistGhostLibrary,
  removeGhostAction,
  upsertGhostAction,
  type GhostStorage,
} from "./library";
import { makeAction } from "./testFixtures";

class MemoryStorage implements GhostStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  raw(): string | null {
    return this.getItem(GHOST_LIBRARY_KEY);
  }
}

describe("local Ghost action library", () => {
  it("persists and reloads a valid action", () => {
    const storage = new MemoryStorage();
    const action = makeAction();
    const persisted = persistGhostLibrary([action], storage);
    expect(persisted.ok).toBe(true);
    const loaded = loadGhostLibrary(storage);
    expect(loaded.error).toBeNull();
    expect(loaded.actions).toHaveLength(1);
    expect(loaded.actions[0].id).toBe(action.id);
  });

  it("skips invalid entries instead of crashing", () => {
    const storage = new MemoryStorage();
    const valid = makeAction();
    storage.setItem(
      GHOST_LIBRARY_KEY,
      JSON.stringify([valid, { schema: "bad", version: 1 }]),
    );
    const loaded = loadGhostLibrary(storage);
    expect(loaded.actions).toHaveLength(1);
    expect(loaded.error).toContain("1 条");
  });

  it("replaces an action with the same id and caps the library", () => {
    const actions = [
      makeAction(),
      { ...makeAction(), id: "two", createdAt: "2026-10-23T07:01:00.000Z" },
      { ...makeAction(), id: "three", createdAt: "2026-10-23T07:02:00.000Z" },
    ];
    const updated = upsertGhostAction(
      [actions[0]],
      { ...actions[0], name: "Updated" },
      2,
    );
    expect(updated).toHaveLength(1);
    expect(updated[0].name).toBe("Updated");

    const capped = upsertGhostAction(actions.slice(0, 1), actions[2], 2);
    expect(capped).toHaveLength(2);
    expect(capped[0].id).toBe("three");
  });

  it("removes an action by id", () => {
    expect(removeGhostAction([makeAction()], "test-action")).toHaveLength(0);
    expect(removeGhostAction([makeAction()], "missing")).toHaveLength(1);
  });

  it("returns an actionable error when storage quota is exceeded", () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    const result = persistGhostLibrary([makeAction()], storage);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("失败");
  });

  it("returns an empty library when raw data is corrupt", () => {
    const storage = new MemoryStorage();
    storage.setItem(GHOST_LIBRARY_KEY, "{bad json");
    const loaded = loadGhostLibrary(storage);
    expect(loaded.actions).toHaveLength(0);
    expect(loaded.error).toContain("损坏");
  });
});
