import type {
  DtwResult,
  DtwStep,
  NormalizedFrame,
} from "../../types/arena";
import { QUALITY_THRESHOLDS } from "../../config/constants";

/**
 * Distance between two normalized frames, averaged over the 33 landmarks.
 *
 * Only landmarks that are visible in BOTH frames contribute; the average is
 * taken over the contributing landmarks so missing points do not silently
 * shrink the distance.
 */
export function frameDistance(
  a: NormalizedFrame,
  b: NormalizedFrame,
): number {
  const pa = a.landmarks;
  const pb = b.landmarks;
  if (!pa || !pb) {
    // A null frame against anything is maximally distant.
    return 1;
  }

  const threshold = QUALITY_THRESHOLDS.landmarkVisible;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < pa.length; i += 1) {
    const va = pa[i];
    const vb = pb[i];
    if (!va || !vb) continue;
    if (va.visibility < threshold || vb.visibility < threshold) continue;

    const dx = va.nx - vb.nx;
    const dy = va.ny - vb.ny;
    // Depth contributes weakly since MediaPipe z is only relative.
    const dz = (va.z - vb.z) * 0.5;

    sum += Math.sqrt(dx * dx + dy * dy + dz * dz);
    count += 1;
  }

  if (count === 0) return 1;
  return sum / count;
}

/**
 * Classic DTW with Euclidean distance and no slope constraints.
 *
 * The cost matrix has shape (n+1) × (m+1); the first row/column are +∞ except
 * the origin (0,0) which is 0. Backtracking from (n,m) recovers the optimal
 * alignment path.
 */
export function alignDtw(
  a: readonly NormalizedFrame[],
  b: readonly NormalizedFrame[],
): DtwResult {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) {
    return { path: [], normalizedCost: 0, pathLength: 0 };
  }

  const INF = Number.POSITIVE_INFINITY;
  const cost = new Float64Array((n + 1) * (m + 1)).fill(INF);
  cost[0] = 0;

  const index = (i: number, j: number) => i * (m + 1) + j;

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const d = frameDistance(a[i - 1], b[j - 1]);
      const up = cost[index(i - 1, j)];
      const left = cost[index(i, j - 1)];
      const diag = cost[index(i - 1, j - 1)];
      cost[index(i, j)] = d + Math.min(diag, up, left);
    }
  }

  // Backtrack
  const path: DtwStep[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    path.push({ i: i - 1, j: j - 1 });
    const diag = cost[index(i - 1, j - 1)];
    const up = cost[index(i - 1, j)];
    const left = cost[index(i, j - 1)];
    if (diag <= up && diag <= left) {
      i -= 1;
      j -= 1;
    } else if (up <= left) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  while (i > 0) {
    path.push({ i: i - 1, j: 0 });
    i -= 1;
  }
  while (j > 0) {
    path.push({ i: 0, j: j - 1 });
    j -= 1;
  }
  path.reverse();

  const totalCost = cost[index(n, m)];
  return {
    path,
    normalizedCost: path.length > 0 ? totalCost / path.length : 0,
    pathLength: path.length,
  };
}

/**
 * Align two normalized sequences. Alias kept for readability in callers.
 */
export const runDtw = alignDtw;