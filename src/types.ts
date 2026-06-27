/** A single MCP tool definition, as returned by a server's `tools/list`. */
export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  [key: string]: unknown;
}

/** A `tools/list` result, a bare array of tools, or a server.json-ish wrapper. */
export type ToolsInput =
  | { tools: McpTool[] }
  | { result: { tools: McpTool[] } }
  | McpTool[];

export interface ToolCost {
  name: string;
  /** Total tokens this tool's definition injects into the model context. */
  totalTokens: number;
  nameTokens: number;
  descriptionTokens: number;
  schemaTokens: number;
  annotationTokens: number;
}

export type Severity = "error" | "warning" | "info";

export interface Finding {
  tool: string;
  rule: string;
  severity: Severity;
  message: string;
  /** Conservative estimate of tokens recoverable if addressed. 0 = correctness-only. */
  estimatedSavings: number;
}

export interface SubScores {
  budget: number;
  toolCount: number;
  perToolBloat: number;
  hygiene: number;
}

export interface Report {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  totalTokens: number;
  toolCount: number;
  avgTokensPerTool: number;
  subScores: SubScores;
  tools: ToolCost[];
  findings: Finding[];
  estimatedSavings: number;
  /** Tokenizer model used for counting (a deterministic proxy for context cost). */
  tokenizer: string;
}
