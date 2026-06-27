import type { Finding, McpTool } from "./types.js";
import { countTokens, stableStringify } from "./tokenizer.js";

// Thresholds (in tokens unless noted). Tuned to be conservative: a finding
// should represent a real, defensible win, not nitpicking.
const LONG_DESC_TOKENS = 100; // tool descriptions rarely need more
const TARGET_DESC_TOKENS = 60;
const LONG_PARAM_DESC_TOKENS = 40;
const TARGET_PARAM_DESC_TOKENS = 20;
const BIG_ENUM_ITEMS = 20;
const HEAVY_SCHEMA_TOKENS = 400;
const HEAVY_TOOL_TOKENS = 500;

function getProps(schema: unknown): Record<string, any> {
  if (schema && typeof schema === "object") {
    const p = (schema as any).properties;
    if (p && typeof p === "object") return p as Record<string, any>;
  }
  return {};
}

/** Walk a schema collecting every `enum` array, at any depth. */
function collectEnums(node: any, out: any[][] = []): any[][] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node.enum)) out.push(node.enum);
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (v && typeof v === "object") collectEnums(v, out);
  }
  return out;
}

export function findIssues(tools: McpTool[]): Finding[] {
  const findings: Finding[] = [];
  const seenNames = new Set<string>();

  for (const tool of tools) {
    const name = tool.name ?? "(unnamed)";

    if (!tool.name) {
      findings.push(rule(name, "missing-name", "error", 0,
        "Tool has no `name`."));
    } else if (seenNames.has(tool.name)) {
      findings.push(rule(name, "duplicate-name", "error", 0,
        `Duplicate tool name "${tool.name}" — clients may drop one.`));
    }
    if (tool.name) seenNames.add(tool.name);

    // Description hygiene + bloat.
    const desc = tool.description ?? "";
    const descTokens = countTokens(desc);
    if (!desc.trim()) {
      findings.push(rule(name, "missing-description", "warning", 0,
        "No description — the model cannot reliably choose this tool."));
    } else if (descTokens > LONG_DESC_TOKENS) {
      findings.push(rule(name, "verbose-description", "warning",
        Math.max(0, descTokens - TARGET_DESC_TOKENS),
        `Description is ${descTokens} tokens. Tighten to ~${TARGET_DESC_TOKENS}; lead with the one-line purpose and cut examples/preamble.`));
    }

    // Schema-level weight.
    const schema = tool.inputSchema;
    const schemaTokens = countTokens(stableStringify(schema));
    if (schemaTokens > HEAVY_SCHEMA_TOKENS) {
      findings.push(rule(name, "heavy-schema", "warning",
        Math.round(schemaTokens * 0.25),
        `inputSchema is ${schemaTokens} tokens. Flatten nesting, drop unused fields, and move rarely-used params behind a single object.`));
    }

    // Per-parameter verbose descriptions.
    const props = getProps(schema);
    for (const [propName, propDef] of Object.entries(props)) {
      const pDesc = (propDef && propDef.description) || "";
      const pTokens = countTokens(String(pDesc));
      if (pTokens > LONG_PARAM_DESC_TOKENS) {
        findings.push(rule(name, "verbose-param", "info",
          Math.max(0, pTokens - TARGET_PARAM_DESC_TOKENS),
          `Param "${propName}" description is ${pTokens} tokens — trim to ~${TARGET_PARAM_DESC_TOKENS}.`));
      }
    }

    // Oversized enums (e.g. dumping a country/timezone list inline).
    for (const en of collectEnums(schema)) {
      if (en.length > BIG_ENUM_ITEMS) {
        const enTokens = countTokens(stableStringify(en));
        findings.push(rule(name, "large-enum", "warning",
          Math.round(enTokens * 0.5),
          `An enum has ${en.length} values (${enTokens} tokens). Validate server-side or document the format instead of inlining every value.`));
      }
    }

    // Output schema is often redundant context the agent never needs upfront.
    const outTokens = countTokens(stableStringify(tool.outputSchema));
    if (outTokens > HEAVY_SCHEMA_TOKENS) {
      findings.push(rule(name, "heavy-output-schema", "info",
        Math.round(outTokens * 0.4),
        `outputSchema is ${outTokens} tokens — most clients don't need a full output schema upfront; consider trimming or omitting.`));
    }

    // Overall heaviness flag.
    const total = countTokens(stableStringify(tool));
    if (total > HEAVY_TOOL_TOKENS) {
      findings.push(rule(name, "heavy-tool", "info", 0,
        `Whole tool definition is ${total} tokens — among the heaviest. Split into smaller tools or trim the schema.`));
    }
  }

  return findings.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
}

function rule(
  tool: string, ruleName: string, severity: Finding["severity"],
  estimatedSavings: number, message: string
): Finding {
  return { tool, rule: ruleName, severity, estimatedSavings, message };
}
