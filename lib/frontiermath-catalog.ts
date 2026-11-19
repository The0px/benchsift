import type { LLMModel } from "./model-types";
import { matchCatalogRun, matchCatalogRuns, type CatalogRunInfo } from "./benchmark-run-catalog";
import {
  FRONTIERMATH_EVALUATION_KEYS,
  FRONTIERMATH_TIERS,
  frontierMathSlugCandidates,
  type FrontierMathData,
  type FrontierMathRow,
} from "./frontiermath-data";

/** Catalogue identity of a FrontierMath row, for its name, logo and link. */
export type FrontierMathModelInfo = CatalogRunInfo;

function target(row: FrontierMathRow) {
  return { id: row.id, candidates: frontierMathSlugCandidates(row), effort: row.effort };
}

export function matchFrontierMathModels(
  models: LLMModel[],
  rows: readonly FrontierMathRow[],
): Record<string, FrontierMathModelInfo> {
  return matchCatalogRuns(models, rows, target);
}

/**
 * Writes each tier's score on its catalogue model, as a 0–1 fraction under
 * its own key. When several Epoch runs land on one model, the run of the
 * configuration the catalogue lists wins, then the higher score: a default
 * entry carries the best setting Epoch measured for it.
 */
export function mergeFrontierMath(
  models: LLMModel[],
  data: FrontierMathData,
): { models: LLMModel[]; matched: number } {
  const bySlug = new Map(models.map((model) => [model.slug, model]));
  const scores = new Map<LLMModel, Record<string, { score: number; exact: boolean }>>();
  for (const tier of FRONTIERMATH_TIERS) {
    const key = FRONTIERMATH_EVALUATION_KEYS[tier];
    for (const row of data.tiers[tier] ?? []) {
      const match = matchCatalogRun(models, bySlug, target(row));
      if (!match) continue;
      const entry = scores.get(match.model) ?? {};
      const previous = entry[key];
      if (!previous || (match.exact && !previous.exact) || (match.exact === previous.exact && row.score > previous.score)) {
        entry[key] = { score: row.score, exact: match.exact };
      }
      scores.set(match.model, entry);
    }
  }
  return {
    matched: scores.size,
    models: models.map((model) => {
      const entry = scores.get(model);
      if (!entry) return model;
      const evaluations = { ...model.evaluations };
      for (const [key, { score }] of Object.entries(entry)) evaluations[key] = score;
      return { ...model, evaluations };
    }),
  };
}
