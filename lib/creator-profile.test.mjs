import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
let server;
let profiles;
let providers;

before(async () => {
  server = await createServer({
    configFile: false,
    root: projectRoot,
    logLevel: "silent",
    resolve: { alias: { "@": projectRoot } },
    server: { middlewareMode: true },
  });
  profiles = await server.ssrLoadModule("/lib/creator-profile.ts");
  providers = await server.ssrLoadModule("/lib/provider-map.ts");
});

after(async () => {
  await server?.close();
});

function model(slug, {
  name = slug,
  creator = "lab",
  creatorName = creator.toUpperCase(),
  intelligence = null,
  price = null,
  speed = null,
  release = null,
  ...extra
} = {}) {
  return {
    id: slug,
    name,
    slug,
    release_date: release,
    model_creator: { id: creator, name: creatorName, slug: creator },
    evaluations: { artificial_analysis_intelligence_index: intelligence },
    pricing: { price_1m_blended_3_to_1: price, price_1m_input_tokens: null, price_1m_output_tokens: null },
    median_output_tokens_per_second: speed,
    median_time_to_first_token_seconds: null,
    output_modality_text: true,
    ...extra,
  };
}

test("profile slugs follow the shared creator identity", () => {
  assert.equal(providers.getCreatorProfileSlug("x-ai"), "xai");
  assert.equal(providers.getCreatorProfileSlug("aws"), "amazon");
  assert.equal(providers.getCreatorProfileSlug("qwen"), "alibaba");
  assert.equal(providers.getCreatorProfileSlug("stealth"), null);
  assert.equal(providers.getCreatorProfileSlug("bad/slug"), null);
  assert.equal(providers.creatorProfileHref("Google"), "/creators/google");
  assert.equal(providers.creatorProfileHref(""), null);
});

test("a creator absent from the catalogue has no profile", () => {
  assert.equal(profiles.creatorProfile([model("a")], "other"), null);
  assert.equal(profiles.creatorProfile([model("a", { creator: "stealth" })], "stealth"), null);
});

test("reasoning levels fold into one model while configurations are counted", () => {
  const catalogue = [
    model("alpha", { name: "Alpha (Reasoning)", intelligence: 60, release: "2026-01-10", reasoning_model: true }),
    model("alpha-non-reasoning", { name: "Alpha (Non-reasoning)", intelligence: 40, release: "2026-01-10" }),
    model("beta", { name: "Beta", intelligence: 50, release: "2025-03-01" }),
    model("rival", { creator: "other", intelligence: 70 }),
  ];
  const profile = profiles.creatorProfile(catalogue, "lab");
  assert.equal(profile.modelCount, 2);
  assert.equal(profile.variantCount, 3);
  const alpha = profile.models.find((entry) => entry.slug === "alpha");
  assert.equal(alpha.name, "Alpha");
  assert.equal(alpha.variants, 2);
  assert.equal(alpha.reasoning, true);
  assert.deepEqual(profile.releasesByYear, [{ key: "2026", count: 1 }, { key: "2025", count: 1 }]);
  assert.deepEqual(profile.firstRelease, { date: "2025-03-01", slug: "beta", name: "Beta" });
});

test("best scores carry the global rank, never a rank among the creator's own models", () => {
  const catalogue = [
    model("rival-top", { creator: "other", intelligence: 80, speed: 500, price: 0.1 }),
    model("lab-top", { intelligence: 60, speed: 100, price: 2 }),
    model("lab-cheap", { intelligence: 20, speed: 300, price: 0.5 }),
  ];
  const profile = profiles.creatorProfile(catalogue, "lab");
  const by = Object.fromEntries(profile.best.map((best) => [best.metric, best]));
  assert.equal(by.artificial_analysis_intelligence_index.slug, "lab-top");
  assert.deepEqual(by.artificial_analysis_intelligence_index.rank, { rank: 2, total: 3 });
  assert.equal(by.price.slug, "lab-cheap");
  assert.deepEqual(by.price.rank, { rank: 2, total: 3 });
  assert.equal(by.speed.slug, "lab-cheap");
  // No coding index is published: no entry rather than a zero.
  assert.equal(by.artificial_analysis_coding_index, undefined);
  assert.deepEqual(profile.models.find((entry) => entry.slug === "lab-top").intelligenceRank, { rank: 2, total: 3 });
});

test("unpublished values stay null", () => {
  const profile = profiles.creatorProfile([model("solo")], "lab");
  assert.equal(profile.pricing, null);
  assert.equal(profile.huggingFace, null);
  assert.equal(profile.openRouterRank, null);
  assert.equal(profile.latestRelease, null);
  assert.equal(profile.capabilities.toolCalling, null);
  assert.equal(profile.capabilities.structuredOutputs, null);
  assert.deepEqual(profile.best, []);
  assert.equal(profile.models[0].intelligence, null);
  assert.equal(profile.models[0].intelligenceRank, null);
});

test("prices, capabilities and Hugging Face repositories come from the models", () => {
  const catalogue = [
    model("a", { price: 1, openrouter_supported_parameters: ["tools", "response_format"], openrouter_weekly_rank: 12 }),
    model("b", { price: 3, openrouter_supported_parameters: [], openrouter_weekly_rank: 4, huggingface_official: true, huggingface_id: "lab-org/b", huggingface_license: "Apache-2.0", is_open_weights: true }),
    model("c", { price: 2, huggingface_official: true, huggingface_id: "lab-org/c", huggingface_license: "apache-2.0" }),
    // An unofficial match is evidence of nothing.
    model("d", { huggingface_official: false, huggingface_id: "someone/d" }),
  ];
  const profile = profiles.creatorProfile(catalogue, "lab");
  assert.deepEqual(profile.pricing, { measured: 3, min: 1, median: 2, max: 3 });
  assert.equal(profile.capabilities.toolCalling, 1);
  assert.equal(profile.capabilities.structuredOutputs, 1);
  assert.equal(profile.capabilities.openWeights, 2);
  assert.deepEqual(profile.openRouterRank, { rank: 4, slug: "b", name: "b" });
  assert.deepEqual(profile.huggingFace, {
    organizations: [{ id: "lab-org", url: "https://huggingface.co/lab-org", repositories: 2 }],
    repositories: 2,
    licenses: [{ key: "apache-2.0", count: 2 }],
  });
});

test("one company listed under two source slugs gets one profile named after its own slug", () => {
  const catalogue = [
    model("nova-pro", { creator: "aws", creatorName: "Amazon" }),
    model("polly", { creator: "amazon", creatorName: "Amazon" }),
    model("qwen3", { creator: "qwen", creatorName: "Qwen" }),
    model("qwen-max", { creator: "alibaba", creatorName: "Alibaba" }),
  ];
  const amazon = profiles.creatorProfile(catalogue, "aws");
  assert.equal(amazon.slug, "amazon");
  assert.deepEqual(amazon.sourceSlugs, ["amazon", "aws"]);
  assert.equal(amazon.modelCount, 2);
  const alibaba = profiles.creatorProfile(catalogue, "alibaba");
  assert.equal(alibaba.name, "Alibaba");
  assert.equal(alibaba.modelCount, 2);
  assert.deepEqual(
    profiles.creatorProfileIndex(catalogue).map((entry) => entry.slug).sort(),
    ["alibaba", "amazon"],
  );
});

test("sorting reorders models without touching their global rank", () => {
  const catalogue = [
    model("old-strong", { intelligence: 60, release: "2024-01-01" }),
    model("new-weak", { intelligence: 30, release: "2026-01-01" }),
    model("unscored", { release: "2025-01-01" }),
  ];
  const { models } = profiles.creatorProfile(catalogue, "lab");
  assert.deepEqual(models.map((entry) => entry.slug), ["old-strong", "new-weak", "unscored"]);
  const recent = profiles.sortCreatorModels(models, "recent");
  assert.deepEqual(recent.map((entry) => entry.slug), ["new-weak", "unscored", "old-strong"]);
  assert.deepEqual(recent[0].intelligenceRank, models[1].intelligenceRank);
  assert.deepEqual(profiles.parseCreatorSearch({ sort: "recent" }), { sort: "recent" });
  assert.deepEqual(profiles.parseCreatorSearch({ sort: "score" }), {});
  assert.deepEqual(profiles.parseCreatorSearch({ sort: ["recent"] }), {});
});
