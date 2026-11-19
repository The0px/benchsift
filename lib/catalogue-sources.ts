/*
 * Optional catalogue sources behind a home ranking. When one fails during a
 * refresh, the catalogue keeps the scores of the previous one (see
 * `mergeHistoricalModelData` in `lib/api.ts`); these dates let the ranking say
 * how old those scores are, without reporting the failure itself.
 */

/** Refresh stat holding when each ranking's source last answered, in ms. */
export const RANKING_SOURCE_STATS = {
  coding: "indexV5FetchedAt",
  math: "frontierMathFetchedAt",
  cyber: "cyberIndexFetchedAt",
} as const;
export type SourcedRanking = keyof typeof RANKING_SOURCE_STATS;

export function isSourcedRanking(ranking: string): ranking is SourcedRanking {
  return Object.hasOwn(RANKING_SOURCE_STATS, ranking);
}

/** Refresh stat holding when this refresh fetched its sources, in ms. */
export const SOURCES_FETCHED_AT_STAT = "sourcesFetchedAt";

/**
 * Stats of a refresh: a source that answered is dated `fetchedAt`; one that
 * returned nothing keeps the date of its last answer, when there was one.
 */
export function datedSourceStats(
  fetchedAt: number,
  answered: Record<SourcedRanking, boolean>,
  previous: Record<string, number> | undefined,
): Record<string, number> {
  const stats: Record<string, number> = { [SOURCES_FETCHED_AT_STAT]: fetchedAt };
  for (const [ranking, key] of Object.entries(RANKING_SOURCE_STATS) as [SourcedRanking, string][]) {
    const last = previous?.[key];
    if (answered[ranking]) stats[key] = fetchedAt;
    else if (typeof last === "number" && Number.isFinite(last) && last > 0) stats[key] = last;
  }
  return stats;
}

/**
 * Rankings whose scores come from an earlier refresh than the latest one,
 * with the date of those scores (ISO 8601). A source that never answered has
 * no scores to date.
 */
export function carriedRankingDates(
  stats: Record<string, number> | undefined,
): Partial<Record<SourcedRanking, string>> {
  const fetchedAt = stats?.[SOURCES_FETCHED_AT_STAT];
  if (typeof fetchedAt !== "number" || !Number.isFinite(fetchedAt)) return {};
  const dates: Partial<Record<SourcedRanking, string>> = {};
  for (const [ranking, key] of Object.entries(RANKING_SOURCE_STATS) as [SourcedRanking, string][]) {
    const last = stats?.[key];
    if (typeof last === "number" && Number.isFinite(last) && last > 0 && last < fetchedAt) {
      dates[ranking] = new Date(last).toISOString();
    }
  }
  return dates;
}
