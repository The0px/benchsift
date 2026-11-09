import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePersonality,
  parsePersonalitySearch,
  personalityElo,
  rankPersonalityRows,
} from "./aa-personality-data.ts";

const pooled = (overrides) => ({
  slug: "claude-sonnet-5-5",
  name: "Claude Sonnet 5.5 (Max, Default Fallback)",
  shortName: "Claude Sonnet 5.5 (max)",
  intelligenceIndex: 54.54,
  creator: { name: "Anthropic", color: "#cc785c", logo: "/img/logos/anthropic.svg" },
  scores: { eloquent: 1080.92, humorous: 1090.84, slop: 986.4 },
  zScores: { eloquent: 0.1, humorous: 0.4, slop: -0.3 },
  ...overrides,
});

// AA sends a charted model's scores on the chart's list and points to them from the pool.
const CHARTED = {
  id: "2f3c4dc9-a450-4303-8697-0237257cf08f",
  slug: "claude-opus-5-5",
  name: "Claude Opus 5.5 (Max, Default Fallback)",
  judged: { scores: { eloquent: 1289.5, humorous: 1352.97, slop: 1074.81 }, indexScores: { warmth: 82.675 } },
};
const REFERENCED = pooled({
  slug: "claude-opus-5-5",
  name: "Claude Opus 5.5 (Max, Default Fallback)",
  scores: "$24:props:children:0:props:children:props:initialModels:0:judged:scores",
});

const chip = (trait, label) => ["$", "span", trait, { className: "chip", children: label }];
const card = (index, chips) =>
  ["$", "$Lc", index, { href: `/evaluations/aa-personalitybench/indexes/${index}`, children: [["$", "div", null, { children: chips }]] }];

const INDEX_COPY = {
  expressiveness: { label: "Expressiveness", description: "Rich, varied, well-crafted language" },
  warmth: { label: "Warmth", description: "Friendly, humorous, sincere, emotionally attuned" },
  slop: { label: "Slop", description: "Use of filler and generic language" },
  conviction: { label: "Conviction", description: "Direct, confident positions and constructive pushback" },
};
const TRAIT_COPY = {
  eloquent: { label: "Eloquent", definition: 'Is the language "well-crafted" {and} memorable?' },
  humorous: { label: "Humorous", definition: "Does the model use humor?" },
  slop: { label: "Slop" },
};

// Mirrors the page: the trait copy sits in a record that follows a text row on the same line.
const payload = (pool, { traits = TRAIT_COPY } = {}) => [
  `24:["$","div",null,{"children":[["$","$L2a",null,{"children":["$","$L2b",null,{"initialModels":${JSON.stringify([CHARTED])},"judgedOnly":false}]}]]}]`,
  `27:["$","$L30",null,{"messages":{"indexes":${JSON.stringify(INDEX_COPY)}}}]`,
  `2c:${JSON.stringify(card("warmth", [chip("humorous", "Humorous")]))}`,
  `2d:${JSON.stringify(card("expressiveness", [chip("eloquent", "Eloquent")]))}`,
  `2e:${JSON.stringify(card("slop", [chip("slop", "Slop")]))}`,
  `33:["$","$L98",null,{"judgedPool":${JSON.stringify(pool)},"locale":"en","messages":{"shared":{"personalitybench":{"traits":"$35:props:messages:shared:personalitybench:traits"}}}}]`,
  `34:T1f,A sample answer with a brace } 35:["$","$L99",null,{"messages":{"shared":{"personalitybench":{"traits":${JSON.stringify(traits)}}}}}]`,
  "",
].join("\n");

test("AA-PersonalityBench reads every judged model, joining charted scores by slug", () => {
  const data = parsePersonality(payload([REFERENCED, pooled({})]));
  assert.deepEqual(data.rows, [
    {
      slug: "claude-opus-5-5",
      name: "Claude Opus 5.5 (Max, Default Fallback)",
      family_name: "Claude Opus 5.5",
      configuration: "Max, Default Fallback",
      creator_name: "Anthropic",
      scores: { eloquent: 1289.5, humorous: 1352.97, slop: 1074.81 },
    },
    {
      slug: "claude-sonnet-5-5",
      name: "Claude Sonnet 5.5 (Max, Default Fallback)",
      family_name: "Claude Sonnet 5.5",
      configuration: "Max, Default Fallback",
      creator_name: "Anthropic",
      scores: { eloquent: 1080.92, humorous: 1090.84, slop: 986.4 },
    },
  ]);
});

test("AA-PersonalityBench orders traits by AA's indexes and keeps its labels", () => {
  const data = parsePersonality(payload([pooled({})]));
  assert.deepEqual(data.indexes.map((index) => index.id), ["expressiveness", "warmth", "slop"]);
  assert.deepEqual(data.traits, [
    { id: "eloquent", label: "Eloquent", definition: 'Is the language "well-crafted" {and} memorable?', index: "expressiveness" },
    { id: "humorous", label: "Humorous", definition: "Does the model use humor?", index: "warmth" },
    { id: "slop", label: "Slop", definition: null, index: "slop" },
  ]);
});

test("AA-PersonalityBench keeps negative Elos and drops rows it cannot source", () => {
  const data = parsePersonality(
    payload([
      pooled({ slug: "gpt-35-turbo", name: "GPT-3.5 Turbo", scores: { eloquent: -206.96, humorous: 183.56, slop: "n/a", constructor: 900, __proto__: 1 } }),
      pooled({ slug: "gpt-35-turbo", name: "Duplicate" }),
      pooled({ slug: "unresolved", name: "Unresolved", scores: "$24:props:missing" }),
      pooled({ slug: "Bad Slug" }),
      pooled({ slug: "nameless", name: "  " }),
      pooled({ slug: "empty", scores: {} }),
      null,
      "$L12",
    ]),
  );
  assert.equal(data.rows.length, 1);
  const [row] = data.rows;
  assert.equal(row.family_name, "GPT-3.5 Turbo");
  assert.equal(row.configuration, null);
  assert.deepEqual(row.scores, { eloquent: -206.96, humorous: 183.56 });
  assert.equal(personalityElo(row, "eloquent"), -206.96);
  assert.equal(personalityElo(row, "slop"), null);
  assert.equal(personalityElo(row, "constructor"), null);
  assert.equal(personalityElo(row, "toString"), null);
  assert.deepEqual(data.traits.map((trait) => trait.id), ["eloquent", "humorous"]);
});

test("AA-PersonalityBench falls back to trait ids when AA's copy is missing or malformed", () => {
  const missing = parsePersonality(payload([pooled({})]).replace('"personalitybench":{"traits":{', '"personalitybench":{"other":{'));
  assert.deepEqual(missing.traits.map((trait) => [trait.label, trait.definition]), [["eloquent", null], ["humorous", null], ["slop", null]]);
  assert.equal(missing.rows.length, 1);

  const truncated = payload([pooled({})]);
  const cut = truncated.slice(0, truncated.indexOf('"personalitybench":{"traits":{"') + 60);
  assert.deepEqual(parsePersonality(cut).traits.map((trait) => trait.label), ["eloquent", "humorous", "slop"]);
});

test("AA-PersonalityBench returns nothing when the page has no judged models", () => {
  assert.deepEqual(parsePersonality('5:["$","div",null,{"children":"none"}]\n'), { rows: [], traits: [], indexes: [] });
  assert.deepEqual(parsePersonality(""), { rows: [], traits: [], indexes: [] });
});

test("a trait ranks only the models AA rated on it, most to least, ties in source order", () => {
  const { rows } = parsePersonality(
    payload([
      pooled({ slug: "a", name: "A", scores: { humorous: 1000 } }),
      pooled({ slug: "b", name: "B", scores: { humorous: 1400, eloquent: 900 } }),
      pooled({ slug: "c", name: "C", scores: { humorous: 1000 } }),
      pooled({ slug: "d", name: "D", scores: { eloquent: 1200 } }),
    ]),
  );
  assert.deepEqual(rankPersonalityRows(rows, "humorous").map((row) => row.slug), ["b", "a", "c"]);
  assert.deepEqual(rankPersonalityRows(rows, "eloquent").map((row) => row.slug), ["d", "b"]);
  assert.deepEqual(rankPersonalityRows(rows, "unknown"), []);
});

test("the trait in the URL must be a plain trait id", () => {
  assert.deepEqual(parsePersonalitySearch({ trait: "humorous" }), { trait: "humorous" });
  assert.deepEqual(parsePersonalitySearch({ trait: "emotionallyIntelligent", other: "x" }), { trait: "emotionallyIntelligent" });
  for (const trait of ["", "constructor", "__proto__", "a b", "../x", 12, null, ["humorous"]]) {
    assert.deepEqual(parsePersonalitySearch({ trait }), {});
  }
});
