import type { LLMModel } from "./model-types";
import { resolveModelSlug } from "./model-identity";
import { getModelReasoningFamily, type ReasoningEffort } from "./model-reasoning";

/*
 * Joins a third-party benchmark run, named by model and reasoning effort, to
 * the catalogue. Shared by the leaderboards that publish one row per
 * configuration (FrontierMath, CursorBench).
 */

export interface CatalogRunMatch {
  model: LLMModel;
  /** True when the catalogue lists the configuration the source ran, not only the model. */
  exact: boolean;
}

/** Catalogue identity of a benchmark row, for its name, logo and link. */
export interface CatalogRunInfo {
  slug: string;
  name: string;
  creatorSlug: string;
  creatorName: string;
  iconUrl: string | null;
}

/**
 * The first candidate slug found in the catalogue decides the model. The
 * effort opens the matching reasoning configuration; otherwise the run lands
 * on a model listed without configurations, or on the family's unqualified
 * default entry. A family whose listed configurations are all explicit and
 * none is the one the source ran stays unmatched, rather than borrowing
 * another configuration's identity.
 */
export function matchCatalogRun(
  models: LLMModel[],
  bySlug: ReadonlyMap<string, LLMModel>,
  run: { candidates: readonly string[]; effort: ReasoningEffort | null },
): CatalogRunMatch | null {
  for (const candidate of run.candidates) {
    const base = bySlug.get(resolveModelSlug(models, candidate));
    if (!base) continue;
    const variants = getModelReasoningFamily(models, base.slug)?.variants ?? [];
    if (variants.length <= 1) return { model: base, exact: true };
    if (run.effort) {
      const variant = variants.find(({ descriptor }) => descriptor.effort === run.effort);
      if (variant) return { model: variant.model, exact: true };
    }
    const fallback = variants.find(({ descriptor }) => !descriptor.explicit);
    return fallback ? { model: fallback.model, exact: false } : null;
  }
  return null;
}

function catalogRunInfo(model: LLMModel): CatalogRunInfo {
  return {
    slug: model.slug,
    name: model.name,
    creatorSlug: model.model_creator.slug,
    creatorName: model.model_creator.name,
    iconUrl: model.provider_icon_url ?? null,
  };
}

/** Matches every row once, keyed by the row's own id. */
export function matchCatalogRuns<Row>(
  models: LLMModel[],
  rows: readonly Row[],
  run: (row: Row) => { id: string; candidates: readonly string[]; effort: ReasoningEffort | null },
): Record<string, CatalogRunInfo> {
  const bySlug = new Map(models.map((model) => [model.slug, model]));
  const matches: Record<string, CatalogRunInfo> = {};
  for (const row of rows) {
    const { id, ...target } = run(row);
    if (id in matches) continue;
    const match = matchCatalogRun(models, bySlug, target);
    if (match) matches[id] = catalogRunInfo(match.model);
  }
  return matches;
}
