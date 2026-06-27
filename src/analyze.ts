import type { McpTool, ToolCost, ToolsInput } from "./types.js";
import { countTokens, stableStringify } from "./tokenizer.js";

/** Normalize the many shapes a tools dump can take into a flat tool array. */
export function extractTools(input: ToolsInput): McpTool[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.tools)) return obj.tools as McpTool[];
    const result = obj.result as { tools?: McpTool[] } | undefined;
    if (result && Array.isArray(result.tools)) return result.tools;
  }
  throw new Error(
    "Could not find a tool list. Expected { tools: [...] }, a tools/list result, or a bare array."
  );
}

/** Compute the per-field and total token cost of one tool definition. */
export function costOfTool(tool: McpTool): ToolCost {
  const nameTokens = countTokens(tool.name ?? "");
  const descriptionTokens = countTokens(tool.description ?? "");
  const schemaTokens =
    countTokens(stableStringify(tool.inputSchema)) +
    countTokens(stableStringify(tool.outputSchema));
  const annotationTokens =
    countTokens(stableStringify(tool.annotations)) +
    countTokens(tool.title ?? "");

  // The model sees each tool as a JSON object; count the whole serialization as
  // the authoritative total so structural punctuation/keys are not undercounted.
  const totalTokens = countTokens(stableStringify(tool));

  return {
    name: tool.name ?? "(unnamed)",
    totalTokens,
    nameTokens,
    descriptionTokens,
    schemaTokens,
    annotationTokens,
  };
}

export function analyzeTools(tools: McpTool[]): ToolCost[] {
  return tools.map(costOfTool).sort((a, b) => b.totalTokens - a.totalTokens);
}
