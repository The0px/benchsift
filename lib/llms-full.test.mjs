import assert from "node:assert/strict";
import test from "node:test";
import { llmsFullTxt } from "./llms-full.ts";

function model(slug, intelligence, overrides = {}) {
  return {
    id: slug,
    slug,
    name: slug.toUpperCase(),
    model_creator: { id: "c", name: "Creator", slug: "creator" },
    release_date: null,
    evaluations: { artificial_analysis_intelligence_index: intelligence },
    pricing: { price_1m_blended_3_to_1: 2 },
    median_output_tokens_per_second: 100,
    median_time_to_first_token_seconds: 1,
    input_modalities: ["text"],
    output_modalities: ["text"],
    ...overrides,
  };
}

test("llms-full lists indexed models best score first and leaves unpublished figures out", () => {
  const text = llmsFullTxt([
    model("low", 20, { context_window_tokens: 128000, release_date: "2026-01-02" }),
    model("high", 60),
    model("unscored", null),
  ], "2026-11-19T00:00:00.000Z");
  const lines = text.split("\n").filter((line) => line.startsWith("- ["));
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^- \[HIGH\]\(https:\/\/benchsift\.nxtaigen\.com\/models\/high\): Creator; Intelligence Index 60 \(1 of 2 listed\); \$2 per 1M tokens/);
  assert.doesNotMatch(lines[0], /context|released|open weights/);
  assert.match(lines[1], /128,000-token context; released 2026-01-02$/);
  assert.match(text, /Catalogue refreshed: 2026-11-19/);
});

test("llms-full says so when the catalogue is empty", () => {
  assert.match(llmsFullTxt([], null), /catalogue is unavailable/);
});
