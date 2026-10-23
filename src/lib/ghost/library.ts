import { GHOST_CONFIG } from "../../config/constants";
import type { GhostAction } from "../../types/ghost";
import {
  createGhostFileName,
  serializeGhostAction,
  validateGhostAction,
} from "./schema";

export const GHOST_LIBRARY_KEY = "spinemotion.ghost.library.v1";

export interface GhostStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface GhostLibraryLoadResult {
  actions: GhostAction[];
  error: string | null;
}

export interface GhostLibraryPersistResult {
  ok: boolean;
  error: string | null;
}

function defaultStorage(): GhostStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sortActions(actions: GhostAction[]): GhostAction[] {
  return [...actions].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function loadGhostLibrary(
  storage: GhostStorage | null = defaultStorage(),
): GhostLibraryLoadResult {
  if (!storage) {
    return {
      actions: [],
      error: "当前浏览器不可用 localStorage，动作库无法持久保存。",
    };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(GHOST_LIBRARY_KEY);
  } catch {
    return { actions: [], error: "读取本地动作库失败。" };
  }
  if (!raw) return { actions: [], error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { actions: [], error: "本地动作库 JSON 已损坏，未加载任何动作。" };
  }
  if (!Array.isArray(parsed)) {
    return { actions: [], error: "本地动作库格式无效。" };
  }

  const actions: GhostAction[] = [];
  let invalidCount = 0;
  for (const entry of parsed) {
    const result = validateGhostAction(entry);
    if (result.ok) actions.push(result.action);
    else invalidCount += 1;
  }

  return {
    actions: sortActions(actions).slice(0, GHOST_CONFIG.maxLibraryActions),
    error:
      invalidCount > 0
        ? `本地动作库中有 ${invalidCount} 条数据格式无效，已跳过。`
        : null,
  };
}

export function persistGhostLibrary(
  actions: readonly GhostAction[],
  storage: GhostStorage | null = defaultStorage(),
): GhostLibraryPersistResult {
  if (!storage) {
    return { ok: false, error: "当前浏览器不可用 localStorage。" };
  }
  try {
    storage.setItem(
      GHOST_LIBRARY_KEY,
      JSON.stringify(actions.slice(0, GHOST_CONFIG.maxLibraryActions)),
    );
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `写入本地动作库失败：${error.message}`
          : "写入本地动作库失败，可能已超出浏览器存储配额。",
    };
  }
}

export function upsertGhostAction(
  actions: readonly GhostAction[],
  action: GhostAction,
  maxActions: number = GHOST_CONFIG.maxLibraryActions,
): GhostAction[] {
  const withoutSame = actions.filter((item) => item.id !== action.id);
  return sortActions([action, ...withoutSame]).slice(0, maxActions);
}

export function removeGhostAction(
  actions: readonly GhostAction[],
  actionId: string,
): GhostAction[] {
  return actions.filter((item) => item.id !== actionId);
}

export function downloadGhostAction(action: GhostAction): void {
  const blob = new Blob([serializeGhostAction(action)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = createGhostFileName(action);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
