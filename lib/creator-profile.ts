import type { LLMModel } from "./model-types";
import { metricRank, rankedMetricValue, ranksLowerFirst, type MetricRank, type RankedMetric } from "./model-insights";
import {
  getPrimaryCategory,
  inputModalities,
  isOpenWeightsModel,
  outputModalities,
  shouldIndexModelPage,
  textMetricValue,
  type ModelPrimaryCategory,
} from "./model-metrics";
import { collapsedFamilyModel, reasoningFamilies, type ModelReasoningFamily } from "./model-reasoning";
import { getCanonicalCreatorSlug, getCreatorDisplayName, getCreatorProfileSlug } from "./provider-map";

/*
 * A creator's profile, aggregated from the catalogue alone: every figure is a
 * count, an extreme or a median of sourced values, and a value no model
 * carries stays null. Client-safe: the route loader builds it on the server,
 * the view only reads it.
 */

/** Metrics whose leader the profile shows, in display order. */
export const CREATOR_BEST_METRICS = [
  "artificial_analysis_intelligence_index",
  "artificial_analysis_coding_index",
  "artificial_analysis_math_index",
  "agentic_index",
  "speed",
  "price",
] as const satisfies readonly RankedMetric[];

export type CreatorBestMetric = (typeof CREATOR_BEST_METRICS)[number];

export type CreatorModelSort = "score" | "recent";

/** One model of the creator as the collapsed catalogue lists it: reasoning levels folded into one entry. */
export interface CreatorModelEntry {
  slug: string;
  name: string;
  creatorSlug: string;
  providerIconUrl: string | null;
  releaseDate: string | null;
  category: ModelPrimaryCategory;
  intelligence: number | null;
  /** Global rank on the Intelligence Index, among every measured catalogue model. */
  intelligenceRank: MetricRank | null;
  price: number | null;
  speed: number | null;
  openWeights: boolean;
  reasoning: boolean;
  variants: number;
}

/** The creator's best model on a metric, and where it stands in the whole catalogue. */
export interface CreatorBest {
  metric: CreatorBestMetric;
  slug: string;
  name: string;
  value: number;
  rank: MetricRank;
}

export interface CreatorRelease {
  date: string;
  slug: string;
  name: string;
}

export interface CreatorCount<K extends string = string> {
  key: K;
  count: number;
}

export interface CreatorPriceSummary {
  /** Models with a published blended price. */
  measured: number;
  min: number;
  median: number;
  max: number;
}

export interface CreatorHuggingFace {
  /** Organisations that host the creator's official repositories, most repositories first. */
  organizations: Array<{ id: string; url: string; repositories: number }>;
  repositories: number;
  licenses: CreatorCount[];
}

export interface CreatorCapabilities {
  reasoning: number;
  openWeights: number;
  /** Null when no model of the creator carries OpenRouter's supported parameters. */
  toolCalling: number | null;
  structuredOutputs: number | null;
  input: CreatorCount[];
  output: CreatorCount[];
}

export interface CreatorProfile {
  slug: string;
  name: string;
  /** Creator slugs the sources use for this company, the profile's own first. */
  sourceSlugs: string[];
  /** Catalogue entries, every reasoning level counted. */
  variantCount: number;
  /** Models once reasoning levels are folded, as the catalogue lists them. */
  modelCount: number;
  /** Models whose own page is indexed; the profile is indexed when one is. */
  indexableCount: number;
  categories: CreatorCount<ModelPrimaryCategory>[];
  firstRelease: CreatorRelease | null;
  latestRelease: CreatorRelease | null;
  releasesByYear: CreatorCount[];
  best: CreatorBest[];
  pricing: CreatorPriceSummary | null;
  capabilities: CreatorCapabilities;
  huggingFace: CreatorHuggingFace | null;
  /** The creator's best OpenRouter weekly Top Models position. */
  openRouterRank: { rank: number; slug: string; name: string } | null;
  models: CreatorModelEntry[];
}

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Calendar day of a model's release, when its source dates it. */
function releaseDay(model: LLMModel): string | null {
  const day = model.release_date ?? model.release_timestamp?.slice(0, 10) ?? null;
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00Z`)) ? day : null;
}

function counted<K extends string>(counts: Map<K, number>): CreatorCount<K>[] {
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function increment<K>(counts: Map<K, number>, key: K): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const groupedCatalogues = new WeakMap<LLMModel[], Map<string, ModelReasoningFamily[]>>();

/** Reasoning families of the catalogue keyed by creator profile, built once per snapshot. */
function familiesByCreator(models: LLMModel[]): Map<string, ModelReasoningFamily[]> {
  let grouped = groupedCatalogues.get(models);
  if (!grouped) {
    grouped = new Map();
    for (const family of reasoningFamilies(models)) {
      const slug = getCreatorProfileSlug(family.variants[0].model.model_creator.slug);
      if (!slug) continue;
      const list = grouped.get(slug) ?? [];
      list.push(family);
      grouped.set(slug, list);
    }
    groupedCatalogues.set(models, grouped);
  }
  return grouped;
}

/** Every creator profile of the catalogue, with how many models it lists. */
export function creatorProfileIndex(models: LLMModel[]): Array<{ slug: string; models: number; indexable: boolean }> {
  return [...familiesByCreator(models)]
    .map(([slug, families]) => ({
      slug,
      models: families.length,
      indexable: families.some((family) => shouldIndexModelPage(collapsedFamilyModel(family))),
    }))
    .sort((a, b) => b.models - a.models || a.slug.localeCompare(b.slug));
}

/** The name the sources give the company, most used first, through the shared display overrides. */
function profileName(slug: string, models: LLMModel[]): string {
  const own = models.filter((model) => getCanonicalCreatorSlug(model.model_creator.slug) === slug);
  const names = new Map<string, number>();
  for (const model of own.length ? own : models) {
    const name = model.model_creator.name.trim();
    if (name) increment(names, name);
  }
  const top = counted(names)[0]?.key ?? slug;
  return getCreatorDisplayName(slug, top);
}

/** Best of the creator's models on a metric; ties go to the most recent, then the name. */
function bestOn(models: LLMModel[], catalogue: LLMModel[], metric: CreatorBestMetric): CreatorBest | null {
  const lowerFirst = ranksLowerFirst(metric);
  let best: { model: LLMModel; value: number } | null = null;
  for (const model of models) {
    const value = rankedMetricValue(model, metric);
    if (value == null) continue;
    const better = !best
      || (lowerFirst ? value < best.value : value > best.value)
      || (value === best.value && ((releaseDay(model) ?? "") > (releaseDay(best.model) ?? "")
        || ((releaseDay(model) ?? "") === (releaseDay(best.model) ?? "") && model.name.localeCompare(best.model.name) < 0)));
    if (better) best = { model, value };
  }
  if (!best) return null;
  const rank = metricRank(catalogue, best.model, metric);
  return rank ? { metric, slug: best.model.slug, name: best.model.name, value: best.value, rank } : null;
}

function entryOf(family: ModelReasoningFamily, catalogue: LLMModel[]): CreatorModelEntry {
  const model = collapsedFamilyModel(family);
  const variants = family.variants.map((variant) => variant.model);
  const days = variants.map(releaseDay).filter((day): day is string => day != null).sort();
  return {
    slug: model.slug,
    name: model.name,
    creatorSlug: model.model_creator.slug,
    providerIconUrl: model.provider_icon_url ?? null,
    releaseDate: releaseDay(model) ?? days[0] ?? null,
    category: getPrimaryCategory(model),
    intelligence: textMetricValue(model, "artificial_analysis_intelligence_index"),
    intelligenceRank: metricRank(catalogue, model, "artificial_analysis_intelligence_index"),
    price: finite(model.pricing.price_1m_blended_3_to_1),
    speed: finite(model.median_output_tokens_per_second),
    openWeights: variants.some(isOpenWeightsModel),
    reasoning: variants.some((variant) => variant.reasoning_model === true),
    variants: variants.length,
  };
}

/** Score order: best Intelligence Index first, unmeasured models after, newest first among equals. */
export function sortCreatorModels(models: readonly CreatorModelEntry[], sort: CreatorModelSort): CreatorModelEntry[] {
  const byRecent = (a: CreatorModelEntry, b: CreatorModelEntry) =>
    (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "") || a.name.localeCompare(b.name);
  return [...models].sort(sort === "recent"
    ? byRecent
    : (a, b) => {
        if (a.intelligence == null || b.intelligence == null) {
          if (a.intelligence != null) return -1;
          if (b.intelligence != null) return 1;
          return byRecent(a, b);
        }
        return b.intelligence - a.intelligence || byRecent(a, b);
      });
}

export interface CreatorSearch {
  sort?: "recent";
}

/** The sort a profile address asks for; the default score order is left out of the URL. */
export function parseCreatorSearch(raw: Record<string, unknown>): CreatorSearch {
  return raw.sort === "recent" ? { sort: "recent" } : {};
}

const HF_ORGANIZATION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;

function huggingFaceOf(models: LLMModel[]): CreatorHuggingFace | null {
  const repositories = new Map<string, LLMModel>();
  for (const model of models) {
    const id = model.huggingface_id?.trim();
    if (model.huggingface_official !== true || !id || repositories.has(id.toLowerCase())) continue;
    repositories.set(id.toLowerCase(), model);
  }
  if (!repositories.size) return null;
  const organizations = new Map<string, number>();
  const licenses = new Map<string, number>();
  for (const model of repositories.values()) {
    const organization = model.huggingface_id!.trim().split("/")[0];
    if (HF_ORGANIZATION.test(organization)) increment(organizations, organization);
    const license = model.huggingface_license?.trim().toLowerCase();
    if (license) increment(licenses, license);
  }
  return {
    organizations: counted(organizations).map(({ key, count }) => ({
      id: key,
      url: `https://huggingface.co/${encodeURIComponent(key)}`,
      repositories: count,
    })),
    repositories: repositories.size,
    licenses: counted(licenses),
  };
}

function capabilitiesOf(families: ModelReasoningFamily[]): CreatorCapabilities {
  const input = new Map<string, number>();
  const output = new Map<string, number>();
  let reasoning = 0;
  let openWeights = 0;
  let toolCalling = 0;
  let structuredOutputs = 0;
  let withParameters = 0;
  for (const family of families) {
    const variants = family.variants.map((variant) => variant.model);
    const inputs = new Set(variants.flatMap((model) => [...inputModalities(model)]));
    const outputs = new Set(variants.flatMap((model) => [...outputModalities(model)]));
    for (const modality of inputs) increment(input, modality);
    for (const modality of outputs) increment(output, modality);
    if (variants.some((model) => model.reasoning_model === true)) reasoning += 1;
    if (variants.some(isOpenWeightsModel)) openWeights += 1;
    const parameters = variants.filter((model) => Array.isArray(model.openrouter_supported_parameters));
    if (!parameters.length) continue;
    withParameters += 1;
    const supported = new Set(parameters.flatMap((model) => model.openrouter_supported_parameters!));
    if (supported.has("tools")) toolCalling += 1;
    if (supported.has("structured_outputs") || supported.has("response_format")) structuredOutputs += 1;
  }
  return {
    reasoning,
    openWeights,
    toolCalling: withParameters ? toolCalling : null,
    structuredOutputs: withParameters ? structuredOutputs : null,
    input: counted(input),
    output: counted(output),
  };
}

/**
 * The profile of a creator from the catalogue, or null when no model of the
 * catalogue belongs to it. `slug` is a creator slug as any source spells it.
 */
export function creatorProfile(catalogue: LLMModel[], slug: string): CreatorProfile | null {
  const profileSlug = getCreatorProfileSlug(slug);
  if (!profileSlug) return null;
  const families = familiesByCreator(catalogue).get(profileSlug);
  if (!families?.length) return null;
  const models = families.flatMap((family) => family.variants.map((variant) => variant.model));

  const sourceSlugs = [...new Set(models.map((model) => getCanonicalCreatorSlug(model.model_creator.slug)))]
    .sort((a, b) => Number(b === profileSlug) - Number(a === profileSlug) || a.localeCompare(b));

  const entries = families.map((family) => entryOf(family, catalogue));

  const categories = new Map<ModelPrimaryCategory, number>();
  const years = new Map<string, number>();
  for (const entry of entries) {
    increment(categories, entry.category);
    if (entry.releaseDate) increment(years, entry.releaseDate.slice(0, 4));
  }

  const dated = models
    .map((model) => ({ model, day: releaseDay(model) }))
    .filter((item): item is { model: LLMModel; day: string } => item.day != null)
    .sort((a, b) => a.day.localeCompare(b.day) || a.model.name.localeCompare(b.model.name));
  const release = (item: { model: LLMModel; day: string } | undefined): CreatorRelease | null =>
    item ? { date: item.day, slug: item.model.slug, name: item.model.name } : null;
  const latest = dated.length
    ? dated.filter((item) => item.day === dated[dated.length - 1].day)[0]
    : undefined;

  const prices = entries.flatMap((entry) => (entry.price == null ? [] : [entry.price]));

  let openRouterRank: CreatorProfile["openRouterRank"] = null;
  for (const model of models) {
    const rank = finite(model.openrouter_weekly_rank);
    if (rank == null || rank < 1) continue;
    if (!openRouterRank || rank < openRouterRank.rank) openRouterRank = { rank, slug: model.slug, name: model.name };
  }

  return {
    slug: profileSlug,
    name: profileName(profileSlug, models),
    sourceSlugs,
    variantCount: models.length,
    modelCount: entries.length,
    indexableCount: families.filter((family) => shouldIndexModelPage(collapsedFamilyModel(family))).length,
    categories: counted(categories),
    firstRelease: release(dated[0]),
    latestRelease: release(latest),
    releasesByYear: [...years].map(([key, count]) => ({ key, count })).sort((a, b) => b.key.localeCompare(a.key)),
    best: CREATOR_BEST_METRICS.flatMap((metric) => bestOn(models, catalogue, metric) ?? []),
    pricing: prices.length
      ? { measured: prices.length, min: Math.min(...prices), median: median(prices), max: Math.max(...prices) }
      : null,
    capabilities: capabilitiesOf(families),
    huggingFace: huggingFaceOf(models),
    openRouterRank,
    models: sortCreatorModels(entries, "score"),
  };
}
