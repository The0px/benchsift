import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

import {
  frontierMathSlugCandidates,
  parseCsv,
  parseEpochModelMetadata,
  parseFrontierMathCsv,
  parseFrontierMathSearch,
  selectFrontierMathRows,
  splitModelVersion,
} from "./frontiermath-data.ts";

const HEADER = "Model version,mean_score,Best score (across scorers),Release date,Organization,Country,Training compute (FLOP),Training compute notes,stderr,Log viewer,Logs,Started at,id";

test("CSV parsing keeps quoted commas, doubled quotes and line breaks inside a field", () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, ""y""","line\nbreak"\n'), [["a", "b"], ['x, "y"', "line\nbreak"]]);
});

test("FrontierMath rows need a valid version and a score in [0, 1]; zero is kept, order is by score", () => {
  const csv = [
    HEADER,
    'gpt-6.2-astra_max,0.9,0.92,2026-11-17,OpenAI,US,,"notes, with comma",0.015,,,2026-10-27T18:46:38.000Z,a',
    "claude-fable-5-2_max,1.0,1.0,2026-11-09,Anthropic,US,,,0.0,,,,b",
    "weak-model,0,0,not-a-date,Lab,US,,,,,,,c",
    "bad score,0.5,0.5,2026-01-01,Lab,US,,,,,,,d",
    "too-high_max,1.5,1.5,2026-01-01,Lab,US,,,,,,,e",
    "no-score_max,,,2026-01-01,Lab,US,,,,,,,f",
    "claude-fable-5-2_max,0.1,0.1,2026-11-09,Anthropic,US,,,,,,,g",
  ].join("\n");
  const metadata = parseEpochModelMetadata(
    "model_version,model_group,date,display_name,organization,country,accessibility,training_compute_flop\n,,,,,,,\n" +
    "gpt-6.2-astra_max,GPT-6.2 Astra,2026-11-17,GPT-6.2 Astra (max),OpenAI,US,API access,\n",
  );
  const rows = parseFrontierMathCsv(csv, metadata);
  assert.deepEqual(rows.map((row) => row.id), ["claude-fable-5-2_max", "gpt-6.2-astra_max", "weak-model"]);
  assert.equal(rows[0].score, 1);
  assert.equal(rows[0].stderr, 0);
  assert.equal(rows[1].score, 0.92, "the best score across scorers wins over the mean");
  assert.equal(rows[1].name, "GPT-6.2 Astra (max)");
  assert.equal(rows[1].group, "GPT-6.2 Astra");
  assert.equal(rows[1].effort, "max");
  assert.equal(rows[2].score, 0);
  assert.equal(rows[2].release_date, null);
  assert.equal(rows[2].stderr, null);
  assert.equal(rows[2].name, "weak-model");
});

test("model versions split into model and reasoning effort only when the suffix is an effort", () => {
  assert.deepEqual(splitModelVersion("gpt-6.2-astra_max"), { model: "gpt-6.2-astra", effort: "max", suffix: "max" });
  assert.deepEqual(splitModelVersion("claude-opus-4-5-20251101_32K"), { model: "claude-opus-4-5-20251101", effort: null, suffix: "32K" });
  assert.deepEqual(splitModelVersion("glm-5.1_none").effort, null);
  assert.deepEqual(splitModelVersion("qwen3.7-max"), { model: "qwen3.7-max", effort: null, suffix: null });
});

test("slug candidates turn dots into hyphens, drop release dates and keep hosting suffixes", () => {
  assert.deepEqual(frontierMathSlugCandidates({ model: "gpt-6.2-astra", group: "GPT-6.2 Astra" }), ["gpt-6-2-astra"]);
  assert.deepEqual(frontierMathSlugCandidates({ model: "gpt-5-2025-08-07", group: null }), ["gpt-5-2025-08-07", "gpt-5"]);
  assert.deepEqual(frontierMathSlugCandidates({ model: "claude-opus-4-5-20251101", group: null }), ["claude-opus-4-5-20251101", "claude-opus-4-5"]);
  assert.deepEqual(frontierMathSlugCandidates({ model: "kimi-k3.1-pro-together", group: "Kimi K3.1 Pro" }), ["kimi-k3-1-pro-together", "kimi-k3-1-pro"]);
});

test("search and release sort never mutate the ranked order", () => {
  const rows = [
    { id: "a_max", name: "Alpha (max)", group: "Alpha", organization: "Lab", release_date: "2026-01-01", score: 0.9 },
    { id: "b_max", name: "Beta (max)", group: "Beta", organization: "Other", release_date: null, score: 0.8 },
    { id: "c_max", name: "Gamma (max)", group: "Gamma", organization: "Lab", release_date: "2026-06-01", score: 0.7 },
  ];
  assert.deepEqual(selectFrontierMathRows(rows, { query: "lab", sort: "score" }).map((row) => row.id), ["a_max", "c_max"]);
  assert.deepEqual(selectFrontierMathRows(rows, { query: "", sort: "release" }).map((row) => row.id), ["c_max", "a_max", "b_max"]);
  assert.deepEqual(selectFrontierMathRows(rows, { query: "catalogue", sort: "score", searchText: (row) => row.id === "b_max" ? "Catalogue name" : "" }).map((row) => row.id), ["b_max"]);
  assert.deepEqual(rows.map((row) => row.id), ["a_max", "b_max", "c_max"]);
});

test("URL search omits defaults and rejects unknown values", () => {
  assert.deepEqual(parseFrontierMathSearch({ tier: "tiers_1_3", sort: "score", q: "  " }), {});
  assert.deepEqual(parseFrontierMathSearch({ tier: "tier_4", sort: "release", q: " gpt " }), { tier: "tier_4", sort: "release", q: "gpt" });
  assert.deepEqual(parseFrontierMathSearch({ tier: "tier_9", sort: "cost" }), {});
});

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
let server;
let catalog;

before(async () => {
  server = await createServer({
    configFile: false,
    root: projectRoot,
    logLevel: "silent",
    resolve: { alias: { "@": projectRoot } },
    server: { middlewareMode: true },
  });
  catalog = await server.ssrLoadModule("/lib/frontiermath-catalog.ts");
});

after(async () => {
  await server?.close();
});

function model(slug, name, creator = "openai") {
  return { id: slug, slug, name, model_creator: { id: creator, name: creator, slug: creator }, evaluations: {}, pricing: {}, provider_icon_url: null };
}

function row(id, score, group = null) {
  const at = id.lastIndexOf("_");
  const suffix = at > 0 ? id.slice(at + 1) : null;
  const effort = ["low", "medium", "high", "xhigh", "max"].includes(suffix) ? suffix : null;
  return { id, model: at > 0 ? id.slice(0, at) : id, effort, name: id, group, organization: null, release_date: null, score, stderr: null };
}

test("runs land on the catalogue configuration they ran, or on the family default", () => {
  const models = [
    model("gpt-6-2-astra", "GPT-6.2 Astra"),
    model("gpt-6-2-astra-high", "GPT-6.2 Astra (high)"),
    model("gpt-6-2-astra-low", "GPT-6.2 Astra (low)"),
    model("claude-fable-5-2", "Claude Fable 5.2 (Default Fallback)", "anthropic"),
    model("gpt-5-6-sol", "GPT-5.6 Sol (max)"),
    model("gpt-5-6-sol-medium", "GPT-5.6 Sol (medium)"),
  ];
  const matches = catalog.matchFrontierMathModels(models, [
    row("gpt-6.2-astra_high", 0.8),
    row("gpt-6.2-astra_max", 0.93),
    row("claude-fable-5-2_max", 0.95),
    row("gpt-5.6-sol_low", 0.5),
    row("unknown-model_max", 0.4),
  ]);
  assert.equal(matches["gpt-6.2-astra_high"].slug, "gpt-6-2-astra-high");
  assert.equal(matches["gpt-6.2-astra_max"].slug, "gpt-6-2-astra");
  assert.equal(matches["claude-fable-5-2_max"].slug, "claude-fable-5-2");
  assert.equal(matches["gpt-5.6-sol_low"], undefined, "every listed configuration is explicit, so an unlisted one stays unmatched");
  assert.equal(matches["unknown-model_max"], undefined);
});

test("merging writes each tier under its own key and prefers the listed configuration", () => {
  const models = [
    model("gpt-6-astra", "GPT-6 Astra"),
    model("gpt-6-astra-high", "GPT-6 Astra (high)"),
    model("gpt-6-astra-low", "GPT-6 Astra (low)"),
    model("other", "Other model"),
  ];
  const { models: merged, matched } = catalog.mergeFrontierMath(models, {
    tiers: {
      tiers_1_3: [row("gpt-6-astra_max", 0.94), row("gpt-6-astra_xhigh", 0.96), row("gpt-6-astra_high", 0.9), row("gpt-6-astra_low", 0)],
      tier_4: [row("gpt-6-astra_max", 0.976)],
    },
  });
  const bySlug = Object.fromEntries(merged.map((m) => [m.slug, m.evaluations]));
  assert.equal(matched, 3);
  assert.equal(bySlug["gpt-6-astra"].frontiermath_tiers_1_3, 0.96, "the default entry keeps the best unlisted setting");
  assert.equal(bySlug["gpt-6-astra"].frontiermath_tier_4, 0.976);
  assert.equal(bySlug["gpt-6-astra-high"].frontiermath_tiers_1_3, 0.9);
  assert.equal(bySlug["gpt-6-astra-low"].frontiermath_tiers_1_3, 0, "a measured zero is kept");
  assert.equal(bySlug["gpt-6-astra-low"].frontiermath_tier_4, undefined);
  assert.equal(bySlug.other.frontiermath_tiers_1_3, undefined);
  assert.equal(merged[3], models[3], "unmatched models are left untouched");
});
