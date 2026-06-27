import { countTokens as o200kCount } from "gpt-tokenizer/model/gpt-4o";

/**
 * Token counting is deterministic and runs with zero network calls and no API key.
 *
 * We count with the o200k_base encoding (GPT-4o family). No public, pure-JS
 * tokenizer exists for Claude, so this is used as a stable, reproducible *proxy*
 * for the context cost a tool definition imposes. Absolute counts will differ a
 * few percent from any given model, but the ranking, scoring, and shrink advice
 * are what matter and are model-agnostic.
 */
export const TOKENIZER_NAME = "o200k_base (gpt-4o, proxy)";

export function countTokens(text: string): number {
  if (!text) return 0;
  return o200kCount(text);
}

/** Stable JSON serialization so token counts are reproducible across runs. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return "";
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
