import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lint, countTokens } from "../dist/index.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/bloated-tools.json", import.meta.url)));

test("tokenizer counts deterministically", () => {
  assert.equal(countTokens("hello world"), countTokens("hello world"));
  assert.ok(countTokens("a longer string with several words") > 3);
  assert.equal(countTokens(""), 0);
});

test("lint produces a complete report", () => {
  const r = lint(fixture);
  assert.equal(r.toolCount, 3);
  assert.ok(r.totalTokens > 0);
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.match(r.grade, /^[A-F]$/);
  assert.equal(r.avgTokensPerTool, Math.round(r.totalTokens / 3));
});

test("heaviest tool is search_documents and tools are sorted desc", () => {
  const r = lint(fixture);
  assert.equal(r.tools[0].name, "search_documents");
  for (let i = 1; i < r.tools.length; i++) {
    assert.ok(r.tools[i - 1].totalTokens >= r.tools[i].totalTokens);
  }
});

test("detects the planted smells", () => {
  const r = lint(fixture);
  const rules = new Set(r.findings.map((f) => f.rule));
  assert.ok(rules.has("verbose-description"), "long description flagged");
  assert.ok(rules.has("large-enum"), "country enum flagged");
  assert.ok(rules.has("missing-description"), "do_thing has no description");
  assert.ok(r.estimatedSavings > 0);
});

test("accepts a bare tool array and a tools/list result shape", () => {
  const bare = lint(fixture.tools);
  assert.equal(bare.toolCount, 3);
  const wrapped = lint({ result: { tools: fixture.tools } });
  assert.equal(wrapped.toolCount, 3);
});

test("a lean tool set scores higher than a bloated one", () => {
  const lean = lint([{ name: "ping", description: "Check liveness.", inputSchema: { type: "object", properties: {} } }]);
  const bloated = lint(fixture);
  assert.ok(lean.score > bloated.score);
});

test("throws on unrecognized input", () => {
  assert.throws(() => lint({ nope: true }));
});
