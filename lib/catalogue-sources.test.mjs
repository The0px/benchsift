import assert from "node:assert/strict";
import { test } from "node:test";

import { carriedRankingDates, datedSourceStats, isSourcedRanking } from "./catalogue-sources.ts";

const JULY = Date.parse("2026-07-17T12:00:00Z");
const NOW = Date.parse("2026-11-19T09:00:00Z");

test("a source that answered is dated now; one that failed keeps its last date", () => {
  const stats = datedSourceStats(NOW, { coding: true, math: false, cyber: false }, {
    indexV5FetchedAt: JULY,
    frontierMathFetchedAt: JULY,
    cyberIndexFetchedAt: 0,
  });
  assert.deepEqual(stats, { sourcesFetchedAt: NOW, indexV5FetchedAt: NOW, frontierMathFetchedAt: JULY });
});

test("only rankings whose scores predate the latest fetch are dated", () => {
  assert.deepEqual(
    carriedRankingDates({ sourcesFetchedAt: NOW, indexV5FetchedAt: NOW, frontierMathFetchedAt: JULY }),
    { math: "2026-07-17T12:00:00.000Z" },
  );
  // A catalogue written before these stats existed says nothing.
  assert.deepEqual(carriedRankingDates({ apiModels: 700 }), {});
  assert.deepEqual(carriedRankingDates(undefined), {});
});

test("only rankings backed by an optional source are dated", () => {
  assert.equal(isSourcedRanking("math"), true);
  assert.equal(isSourcedRanking("intelligence"), false);
  assert.equal(isSourcedRanking("toString"), false);
});
