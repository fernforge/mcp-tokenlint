# MCP token-budget scorecard

Real `mcp-tokenlint` scores for popular MCP servers, measured live over stdio
(`mcp-tokenlint --cmd "<server>"`). Token counts use the `o200k_base` encoding
as a deterministic proxy. Re-run any row yourself — the methodology is in the README.

_Last measured: 2026-06-27 · mcp-tokenlint v0.1.0_

| Server | Tools | Tokens (pre-prompt) | Score | Grade |
|---|---:|---:|---:|:--:|
| `@modelcontextprotocol/server-everything` | 13 | 1,423 | 99 | A |
| `@modelcontextprotocol/server-filesystem` | 14 | 2,741 | 94 | A |
| `@modelcontextprotocol/server-memory` | 9 | 2,230 | 94 | A |
| `@modelcontextprotocol/server-sequential-thinking` | 1 | 942 | 73 | C |

## Takeaways

- **The official reference servers are lean.** They're well-curated, so a single
  one rarely hurts. The context problem is **cumulative**: stack 4–5 third-party
  servers and you cross the ~30–50-tool / ~55k-token degradation zone fast.
- **One fat tool can sink a whole server.** `sequential-thinking` exposes a
  *single* tool — but its description alone is **566 tokens** (~506 recoverable),
  dragging it to a C. Token cost is per-definition, not per-server.
- **The cheapest win is almost always the description**, then inlined enums, then
  over-nested input schemas.

Want your server added? Open an issue with its `npx`/run command.
