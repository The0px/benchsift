import assert from "node:assert/strict";
import test from "node:test";
import { parseDecisionIndex, selectDecisionIndexRows } from "./decision-index-data.ts";

const contestant = (overrides) => ({
  slug: "typesafe_jev-1-13",
  kind: "decisionModel",
  name: "Jev 1.13",
  hostName: "TypeSafe",
  creatorName: "TypeSafe",
  creatorColor: "#E650BA",
  creatorLogo: "/img/logos/typesafe.svg",
  indexScore: 57.503981359365326,
  scores: {
    documentDecisionDecisionScore: 82.65382368308603,
    evalsafeOnetDecisionScore: 90.61940301580067,
    when2callDecisionScore: 84.33280017528483,
    omniscienceDecisionScore: 74.38826416666666,
    hleDecisionScore: 54.904319228191866,
    invarianceSymmetry: 72.43541666666667,
    documentDecisionAllPassRate: 92,
    omniscienceAccuracy: 57.2,
  },
  costPerTaskUsd: 0.00004152679077429984,
  timePerTaskMs: 127,
  calibrationBins: [],
  byDataset: {},
  ...overrides,
});

// Mirrors the Flight line that carries the leaderboard, with unrelated props around it.
const payload = (contestants) =>
  `4:["$","$L3e",null,{"contestants":${JSON.stringify(contestants)},"defaultSlugs":["typesafe_jev-1-13"],"children":"$L3f"}]\n`;

test("Decision Index reads AA's contestants with their scores, cost and time per task", () => {
  const rows = parseDecisionIndex(
    payload([
      contestant({}),
      contestant({
        slug: "anthropic_claude-haiku-5-5-high",
        kind: "llm",
        name: "Claude Haiku 5.5 (High)",
        hostName: "Anthropic",
        creatorName: "Anthropic",
        indexScore: 62.55462486332752,
        costPerTaskUsd: 0.00029217266886326197,
        timePerTaskMs: 1481,
      }),
    ]),
  );
  assert.deepEqual(rows.map((row) => [row.id, row.model_slug, row.kind]), [
    ["anthropic_claude-haiku-5-5-high", "claude-haiku-5-5-high", "llm"],
    ["typesafe_jev-1-13", "jev-1-13", "decision"],
  ]);
  const jev = rows[1];
  assert.equal(jev.host_name, "TypeSafe");
  assert.equal(jev.creator_slug, "typesafe");
  assert.equal(jev.scores.paperclip, 82.65382368308603);
  assert.equal(jev.scores.symmetry, 72.43541666666667);
  assert.equal(jev.scores.evalsafe_onet, 90.61940301580067);
  assert.equal(jev.cost_per_task_usd, 0.00004152679077429984);
  assert.equal(jev.time_per_task_seconds, 0.127);
});

// Scores are AA's published values for Claude Haiku 5.5 (Max) in v2.
test("Decision Index v2 index is AA's weighted average of its six Decision Scores", () => {
  const [row] = parseDecisionIndex(payload([contestant({ indexScore: 77.08153758405317 })]));
  const { paperclip, symmetry, omniscience, hle_multichoice, evalsafe_onet, when2call } = row.scores;
  const weighted = 0.3 * paperclip + 0.15 * (symmetry + omniscience + hle_multichoice + evalsafe_onet) + 0.1 * when2call;
  assert.ok(Math.abs(weighted - row.index) < 1e-9);
});

test("Decision Index keeps measured zeros and drops invalid, unknown and duplicate contestants", () => {
  const rows = parseDecisionIndex(
    payload([
      contestant({ slug: "a_zero", indexScore: 0, scores: { invarianceSymmetry: 0 } }),
      contestant({ slug: "no-host", indexScore: 50 }),
      contestant({ slug: "a_kind", kind: "router" }),
      contestant({ slug: "a_over", indexScore: 120 }),
      contestant({ slug: "a_missing", indexScore: null }),
      contestant({ slug: "a_nameless", name: " " }),
      contestant({ slug: "A_Upper" }),
      contestant({ slug: "a_zero", indexScore: 90 }),
      null,
      "$L12",
    ]),
  );
  assert.deepEqual(rows.map((row) => [row.id, row.index]), [["a_zero", 0]]);
  assert.equal(rows[0].scores.symmetry, 0);
  // Unpublished components stay null rather than reading as zero.
  assert.equal(rows[0].scores.when2call, null);
});

test("Decision Index leaves unpublished cost, time and creator null", () => {
  const [row] = parseDecisionIndex(
    payload([contestant({ costPerTaskUsd: null, timePerTaskMs: -1, creatorName: null, hostName: undefined, scores: null })]),
  );
  assert.equal(row.cost_per_task_usd, null);
  assert.equal(row.time_per_task_seconds, null);
  assert.equal(row.creator_slug, null);
  assert.equal(row.creator_name, null);
  assert.equal(row.host_name, null);
  assert.equal(row.scores.hle_multichoice, null);
});

test("Decision Index returns nothing without a contestant list", () => {
  assert.deepEqual(parseDecisionIndex(`4:["$","div",null,{"children":"$L3f"}]\n`), []);
  assert.deepEqual(parseDecisionIndex("not flight"), []);
});

test("Decision Index filters by kind and text without reordering", () => {
  const rows = parseDecisionIndex(
    payload([
      contestant({}),
      contestant({ slug: "openai_gpt-6-luna", kind: "llm", name: "GPT-6 Luna (Max)", hostName: "OpenAI", creatorName: "OpenAI", indexScore: 60 }),
      contestant({ slug: "cloudflare_clef", name: "Clef", hostName: "Cloudflare", creatorName: "Cloudflare", indexScore: 48 }),
    ]),
  );
  const ids = (selected) => selected.map((row) => row.id);
  assert.deepEqual(ids(selectDecisionIndexRows(rows, { query: "", kind: "all" })), ["openai_gpt-6-luna", "typesafe_jev-1-13", "cloudflare_clef"]);
  assert.deepEqual(ids(selectDecisionIndexRows(rows, { query: "", kind: "decision" })), ["typesafe_jev-1-13", "cloudflare_clef"]);
  assert.deepEqual(ids(selectDecisionIndexRows(rows, { query: "", kind: "llm" })), ["openai_gpt-6-luna"]);
  assert.deepEqual(ids(selectDecisionIndexRows(rows, { query: " cloudFLARE ", kind: "all" })), ["cloudflare_clef"]);
  assert.deepEqual(
    ids(selectDecisionIndexRows(rows, { query: "typesafe jev", kind: "all", searchText: (row) => (row.id === "typesafe_jev-1-13" ? "TypeSafe Jev" : "") })),
    ["typesafe_jev-1-13"],
  );
});
