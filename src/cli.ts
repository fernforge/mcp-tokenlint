#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { lint } from "./index.js";
import { renderTerminal, renderMarkdown } from "./report.js";
import { fetchToolsViaStdio } from "./mcpClient.js";
import type { ToolsInput } from "./types.js";

const VERSION = "0.1.0";

const HELP = `mcp-tokenlint v${VERSION} — Lighthouse-style token-budget linter for MCP servers

USAGE
  mcp-tokenlint <tools.json>           Lint a tools/list dump (or a bare tool array)
  mcp-tokenlint -                      Read the JSON dump from stdin
  mcp-tokenlint --cmd "node srv.js"    Spawn a live MCP server over stdio and lint it

OPTIONS
  --json                Emit the full report as JSON
  --markdown, --md      Emit a Markdown report (for PR comments)
  --budget <tokens>     Exit 1 if total token cost exceeds this
  --min-score <0-100>   Exit 1 if the score is below this
  --no-color            Disable ANSI colors
  -h, --help            Show this help
  -v, --version         Show version

EXAMPLES
  npx mcp-tokenlint tools.json
  npx mcp-tokenlint --cmd "npx -y @modelcontextprotocol/server-filesystem ." --min-score 70
  curl -s .../tools.json | npx mcp-tokenlint - --markdown

Counts are deterministic, offline, and need no API key.
Docs & scoring methodology: https://github.com/fernforge/mcp-tokenlint`;

interface Args {
  file?: string;
  cmd?: string;
  json: boolean;
  markdown: boolean;
  color: boolean;
  budget?: number;
  minScore?: number;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { json: false, markdown: false, color: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "-h": case "--help": printHelpAndExit(); break;
      case "-v": case "--version": console.log(VERSION); process.exit(0); break;
      case "--json": a.json = true; break;
      case "--markdown": case "--md": a.markdown = true; break;
      case "--no-color": a.color = false; break;
      case "--cmd": a.cmd = argv[++i]; break;
      case "--budget": a.budget = Number(argv[++i]); break;
      case "--min-score": a.minScore = Number(argv[++i]); break;
      default:
        if (arg.startsWith("-") && arg !== "-") {
          console.error(`Unknown option: ${arg}`); process.exit(2);
        }
        a.file = arg;
    }
  }
  return a;
}

function printHelpAndExit(): never {
  console.log(HELP);
  process.exit(0);
}

function readInput(args: Args): Promise<ToolsInput> {
  if (args.cmd) {
    const parts = args.cmd.split(/\s+/);
    return fetchToolsViaStdio(parts[0], parts.slice(1)).then((tools) => ({ tools }));
  }
  let raw: string;
  if (!args.file || args.file === "-") {
    raw = readFileSync(0, "utf8");
  } else {
    raw = readFileSync(args.file, "utf8");
  }
  return Promise.resolve(JSON.parse(raw) as ToolsInput);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file && !args.cmd && process.stdin.isTTY) printHelpAndExit();

  let input: ToolsInput;
  try {
    input = await readInput(args);
  } catch (e) {
    console.error(`mcp-tokenlint: ${(e as Error).message}`);
    process.exit(2);
  }

  const report = lint(input);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (args.markdown) {
    console.log(renderMarkdown(report));
  } else {
    console.log(renderTerminal(report, args.color && process.stdout.isTTY !== false));
  }

  if (args.budget !== undefined && report.totalTokens > args.budget) {
    console.error(`\n✖ Over budget: ${report.totalTokens} tokens > ${args.budget}`);
    process.exit(1);
  }
  if (args.minScore !== undefined && report.score < args.minScore) {
    console.error(`\n✖ Score ${report.score} is below the minimum ${args.minScore}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`mcp-tokenlint: ${(e as Error).message}`);
  process.exit(2);
});
