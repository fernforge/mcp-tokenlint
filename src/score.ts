import type { ToolCost, SubScores } from "./types.js";

/** Piecewise-linear interpolation between (input -> score) anchor points. */
function interpolate(anchors: [number, number][], x: number): number {
  if (x <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

// Anchors are grounded in published MCP findings: a 5-server / ~40-tool setup
// burning ~55k tokens before any prompt is "bad"; tool-selection accuracy
// degrades above ~30-50 tools. Documented in README "Scoring methodology".
const BUDGET_ANCHORS: [number, number][] = [
  [0, 100], [2000, 100], [5000, 85], [10000, 65],
  [20000, 40], [40000, 15], [80000, 0],
];
const TOOLCOUNT_ANCHORS: [number, number][] = [
  [0, 100], [20, 100], [30, 90], [50, 65], [80, 35], [150, 0],
];
const AVGTOOL_ANCHORS: [number, number][] = [
  [50, 100], [150, 90], [300, 70], [600, 40], [1200, 10], [2500, 0],
];
const SMELL_DENSITY_ANCHORS: [number, number][] = [
  [0, 100], [0.5, 80], [1, 60], [2, 30], [4, 0],
];

const WEIGHTS = { budget: 0.4, toolCount: 0.15, perToolBloat: 0.25, hygiene: 0.2 };

export function computeSubScores(
  tools: ToolCost[],
  totalTokens: number,
  smellCount: number
): SubScores {
  const count = tools.length;
  const avg = count ? totalTokens / count : 0;
  const smellDensity = count ? smellCount / count : 0;
  return {
    budget: Math.round(interpolate(BUDGET_ANCHORS, totalTokens)),
    toolCount: Math.round(interpolate(TOOLCOUNT_ANCHORS, count)),
    perToolBloat: Math.round(interpolate(AVGTOOL_ANCHORS, avg)),
    hygiene: Math.round(interpolate(SMELL_DENSITY_ANCHORS, smellDensity)),
  };
}

export function overallScore(sub: SubScores): number {
  const s =
    sub.budget * WEIGHTS.budget +
    sub.toolCount * WEIGHTS.toolCount +
    sub.perToolBloat * WEIGHTS.perToolBloat +
    sub.hygiene * WEIGHTS.hygiene;
  return Math.round(s);
}

export function gradeFor(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
