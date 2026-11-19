import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cursorBenchSlugCandidates,
  parseCursorBench,
  parseCursorBenchSearch,
  selectCursorBenchRows,
  splitCursorBenchName,
} from "./cursorbench-data.ts";

const row = (cells) => `<tr>${cells.map((cell) => `<td><span>${cell}</span></td>`).join("")}</tr>`;

const PAGE = `<meta name="description" content="CursorBench 3.0 notes"/><h1 class="x">CursorBench <!-- -->4.1</h1>
<table><thead><tr><th>Model</th></tr></thead><tbody>
${row(["1", "Gemini 4 Neon Extra High", "65.4<!-- --> %", "$<!-- --> 10.67", "136,273", "73"])}
${row(["2", "Fable 5.2 Max", "61.3 %", "$ 48.11", "541,003", "295"])}
${row(["3", "Haiku 5.5 Medium", "70.0 %", "$ 0.17", "n/a", "41"])}
${row(["4", "Zero Model", "0 %", "", "", ""])}
${row(["5", "Bad Score", "n/a", "$ 1", "1", "1"])}
${row(["6", "Too High", "120 %", "$ 1", "1", "1"])}
${row(["7", "Fable 5.2 Max", "10 %", "$ 1", "1", "1"])}
${row(["8", "Muse &amp; Co", "20 %", "$ 1", "1", "1"])}
</tbody></table>
<table><tbody>${row(["1", "Hidden Copy", "99 %", "$ 1", "1", "1"])}</tbody></table>`;

test("CursorBench rows need a name and a score in [0, 100] %; zero is kept, order is by score", () => {
  const data = parseCursorBench(PAGE);
  assert.equal(data.version, "4.1");
  assert.deepEqual(data.rows.map((r) => r.id), ["Haiku 5.5 Medium", "Gemini 4 Neon Extra High", "Fable 5.2 Max", "Muse & Co", "Zero Model"]);
  const neon = data.rows[1];
  assert.deepEqual(neon, {
    id: "Gemini 4 Neon Extra High",
    model: "Gemini 4 Neon",
    effort: "xhigh",
    score: 0.654,
    cost_per_task_usd: 10.67,
    tokens_per_task: 136273,
    steps_per_task: 73,
  });
  assert.equal(data.rows[0].tokens_per_task, null);
  const zero = data.rows.at(-1);
  assert.equal(zero.score, 0);
  assert.equal(zero.cost_per_task_usd, null);
});

test("cell text keeps no markup, even nested or encoded", () => {
  const page = `<h1>CursorBench 4.1</h1><table><tbody>${row(["1", "<scr<script>ipt>Evil &lt;b&gt; Model<!-- <!-- x --> -->", "50 %", "$ 1", "1", "1"])}${row(["2", "Odd &#x110000; &#0; Name", "40 %", "", "", ""])}</tbody></table>`;
  const ids = parseCursorBench(page).rows.map((r) => r.id);
  assert.equal(ids.length, 2);
  for (const id of ids) assert.doesNotMatch(id, /[<>]/);
  assert.equal(ids[1], "Odd &#x110000; &#0; Name");
});

test("a page without a table yields no rows", () => {
  assert.deepEqual(parseCursorBench("<p>CursorBench</p>"), { rows: [], version: null });
});

test("names split into model and reasoning level; Claude families gain their brand", () => {
  assert.deepEqual(splitCursorBenchName("Opus 5.5 Extra High"), { model: "Opus 5.5", effort: "xhigh" });
  assert.deepEqual(splitCursorBenchName("Grok 4.7"), { model: "Grok 4.7", effort: null });
  assert.deepEqual(splitCursorBenchName("High"), { model: "High", effort: null });
  assert.deepEqual(cursorBenchSlugCandidates({ model: "Opus 5.5" }), ["claude-opus-5-5", "opus-5-5"]);
  assert.deepEqual(cursorBenchSlugCandidates({ model: "GPT-5.6 Sol" }), ["gpt-5-6-sol"]);
});

test("search filters without reordering; the cost sort puts a missing cost last", () => {
  const { rows } = parseCursorBench(PAGE);
  assert.deepEqual(selectCursorBenchRows(rows, { query: "fable", sort: "score" }).map((r) => r.id), ["Fable 5.2 Max"]);
  assert.deepEqual(
    selectCursorBenchRows(rows, { query: "gemini-alias", sort: "score", searchText: (r) => (r.model === "Gemini 4 Neon" ? "gemini-alias" : "") }).map((r) => r.id),
    ["Gemini 4 Neon Extra High"],
  );
  assert.deepEqual(selectCursorBenchRows(rows, { query: "", sort: "cost" }).map((r) => r.id), ["Haiku 5.5 Medium", "Muse & Co", "Gemini 4 Neon Extra High", "Fable 5.2 Max", "Zero Model"]);
});

test("URL search omits defaults and bounds the query", () => {
  assert.deepEqual(parseCursorBenchSearch({ sort: "score", q: "  " }), {});
  assert.deepEqual(parseCursorBenchSearch({ sort: "cost", q: " opus " }), { q: "opus", sort: "cost" });
  assert.equal(parseCursorBenchSearch({ q: "x".repeat(200) }).q.length, 80);
});
