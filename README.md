# mcp-tokenlint

**A Lighthouse score for your MCP server's context budget.** Find out how many tokens your tool schemas burn *before a single user prompt*, then get ranked, deterministic suggestions to shrink them.

[![CI-ready](https://img.shields.io/badge/CI-GitHub%20Action-purple)](#use-it-in-ci)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![run with npx](https://img.shields.io/badge/run-npx%20github%3Afernforge%2Fmcp--tokenlint-black)](#quick-start)

One-page overview: [fernforge.github.io/mcp-tokenlint](https://fernforge.github.io/mcp-tokenlint/).

```
  mcp-tokenlint — MCP token-budget report

  Score 41/100  (grade F)  ████████░░░░░░░░░░░░
  18,204 tokens across 37 tools · avg 492/tool

  Sub-scores
    budget          42  ██████░░░░░░░░
    toolCount        90 █████████████░
    perToolBloat     55 ███████░░░░░░░
    hygiene          30 ████░░░░░░░░░░

  Suggestions  (est. recoverable: ~6,300 tokens)
    ▲ search_documents  An enum has 51 values (103 tokens). Validate server-side instead…
    ▲ search_documents  Description is 108 tokens. Tighten to ~60; cut examples/preamble.
    ▲ create_report     inputSchema is 740 tokens. Flatten nesting, drop unused fields…
```

## Why this exists

Every tool your MCP server exposes is serialized into the model's context window on **every request**, before the user has typed anything. Authors rarely see this cost. It's large, and it compounds:

- A 5-server setup consumes **~55,000 tokens before any work begins**; tool-selection accuracy degrades once you cross **~30–50 tools**. ([Anthropic, *Advanced tool use*](https://www.anthropic.com/engineering/advanced-tool-use))
- Under prompt bloat, tool-selection accuracy collapses from **43% → 14%**. ([RAG-MCP, arXiv 2505.03275](https://arxiv.org/abs/2505.03275))
- An empirical study of 856 tools across 103 servers found **97.1% of tool descriptions have at least one "smell."** ([arXiv 2602.14878](https://arxiv.org/html/2602.14878v1))
- GitHub found unused/over-described MCP tools were the most common inefficiency in agentic workflows, with **19–62% token reductions** after pruning. ([GitHub blog](https://github.blog/ai-and-ml/github-copilot/improving-token-efficiency-in-github-agentic-workflows/))

Every existing fix (Tool Search, gateways, proxies, dynamic toolsets) is **consumer / runtime-side**. `mcp-tokenlint` is **shift-left**: it scores and shrinks your footprint *at publish time*, in your own repo, in CI.

## Quick start

No install required. Run it straight from this repo with `npx`:

```bash
# Lint a tools/list dump
npx github:fernforge/mcp-tokenlint tools.json

# Or point it at a live server over stdio — no dump needed
npx github:fernforge/mcp-tokenlint --cmd "npx -y @modelcontextprotocol/server-filesystem ."

# Pipe a dump in
curl -s https://example.com/tools.json | npx github:fernforge/mcp-tokenlint -
```

> Prefer a local clone? `git clone https://github.com/fernforge/mcp-tokenlint && cd mcp-tokenlint && npm install && node dist/cli.js tools.json`. A versioned npm release is coming.

Getting a `tools.json` is one call against your running server:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | your-server > tools.json
```

(or just use `--cmd` and let the linter do the handshake).

### Output formats

| Flag | Output |
|---|---|
| *(default)* | Colorized terminal report |
| `--json` | Full machine-readable report |
| `--markdown` / `--md` | Markdown (for PR comments / job summaries) |
| `--budget <n>` | Exit `1` if total tokens exceed `n` |
| `--min-score <n>` | Exit `1` if the score is below `n` |

## Use it in CI

Fail a PR that bloats your tool budget, and drop the report into the job summary:

```yaml
# .github/workflows/mcp-budget.yml
name: MCP token budget
on: [pull_request]
jobs:
  budget:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: fernforge/mcp-tokenlint@v0.1.1
        with:
          cmd: "node build/server.js"   # or: tools: tools.json
          min-score: 70
```

The action writes a Markdown report to the GitHub **job summary** and exposes `score` / `total-tokens` outputs you can gate on or post as a PR comment.

## Programmatic API

```ts
import { lint } from "mcp-tokenlint";

const report = lint({ tools: [/* ...your tools/list... */] });
console.log(report.score, report.grade);          // 41 'F'
console.log(report.estimatedSavings);             // ~6300
for (const f of report.findings) console.log(f.tool, f.message);
```

## Scoring methodology

The score is a weighted blend of four deterministic sub-scores (Lighthouse-style, 0–100, higher = leaner). Thresholds are grounded in the published findings above, and the curve is fully documented in [`src/score.ts`](./src/score.ts) — no black box, no LLM, no API key.

| Sub-score | Weight | What it measures |
|---|---:|---|
| **budget** | 40% | Total tokens all tool definitions inject into context |
| **toolCount** | 15% | Penalty as you approach/exceed the ~30–50-tool selection-degradation zone |
| **perToolBloat** | 25% | Average tokens per tool (heavy schemas, verbose descriptions) |
| **hygiene** | 20% | Density of structural smells (missing/duplicate names, missing descriptions, giant inline enums) |

Token counts use the **`o200k_base`** (GPT-4o) encoding as a stable, reproducible *proxy* for context cost. No public pure-JS tokenizer exists for Claude; absolute counts vary a few percent by model, but the rankings and advice are model-agnostic.

## What it flags

`missing-name` · `duplicate-name` · `missing-description` · `verbose-description` · `verbose-param` · `large-enum` · `heavy-schema` · `heavy-output-schema` · `heavy-tool`, each with a conservative estimate of recoverable tokens.

## How it compares

`mcp-tokenlint` is intentionally narrow: it is the **token-budget / cost** lens. If you need protocol conformance or security scanning, reach for [`@modelcontextprotocol/conformance`](https://github.com/modelcontextprotocol/conformance) or a runtime scanner. Use them together: this one keeps your context lean, those keep it correct and safe.

## License

MIT © fernforge. Contributions, issues, and "lint my server" reports welcome.
