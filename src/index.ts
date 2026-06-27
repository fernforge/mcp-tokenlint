import type { Report, ToolsInput } from "./types.js";
import { analyzeTools, extractTools } from "./analyze.js";
import { computeSubScores, overallScore, gradeFor } from "./score.js";
import { findIssues } from "./suggest.js";
import { TOKENIZER_NAME } from "./tokenizer.js";

export * from "./types.js";
export { extractTools, costOfTool } from "./analyze.js";
export { TOKENIZER_NAME, countTokens } from "./tokenizer.js";

/**
 * Lint an MCP tool set and produce a token-budget report.
 *
 * Deterministic, offline, no API key. Accepts a `tools/list` result, a bare
 * tool array, or any object with a `tools` field.
 */
export function lint(input: ToolsInput): Report {
  const rawTools = extractTools(input);
  const tools = analyzeTools(rawTools);
  const totalTokens = tools.reduce((s, t) => s + t.totalTokens, 0);
  const findings = findIssues(rawTools);

  // Hygiene penalizes correctness/structural smells, not the bloat findings
  // already captured by the budget/per-tool sub-scores.
  const smellCount = findings.filter(
    (f) => f.severity === "error" || f.severity === "warning"
  ).length;

  const subScores = computeSubScores(tools, totalTokens, smellCount);
  const score = overallScore(subScores);
  const estimatedSavings = findings.reduce((s, f) => s + f.estimatedSavings, 0);

  return {
    score,
    grade: gradeFor(score),
    totalTokens,
    toolCount: tools.length,
    avgTokensPerTool: tools.length ? Math.round(totalTokens / tools.length) : 0,
    subScores,
    tools,
    findings,
    estimatedSavings,
    tokenizer: TOKENIZER_NAME,
  };
}
