import type { LLMModel } from "@/lib/api";

export type ReasoningMode =
  | "default"
  | "non-reasoning"
  | "reasoning"
  | "adaptive-reasoning"
  | "thinking";

export type ReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export interface ReasoningVariantDescriptor {
  familyKey: string;
  familyName: string;
  mode: ReasoningMode;
  effort: ReasoningEffort | null;
  explicit: boolean;
}

export interface ModelReasoningVariant {
  model: LLMModel;
  descriptor: ReasoningVariantDescriptor;
}

export interface ModelReasoningFamily {
  familyKey: string;
  familyName: string;
  variants: ModelReasoningVariant[];
}

export interface ModelReasoningVariantOption {
  slug: string;
  name: string;
  mode: ReasoningMode;
  effort: ReasoningEffort | null;
}

export interface ModelDetailData {
  model: LLMModel;
  familyName: string;
  variants: ModelReasoningVariantOption[];
}

type ReasoningModelIdentity = Pick<LLMModel, "name" | "slug" | "model_creator">;

const EFFORTS: ReasoningEffort[] = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

const EFFORT_RANK = new Map<ReasoningEffort, number>(
  EFFORTS.map((effort, index) => [effort, index]),
);

const REASONING_QUALIFIER =
  /(?:non[-\s]?reasoning|adaptive\s+reasoning|reasoning|thinking|\beffort\b|^\s*(?:minimal|low|medium|high|xhigh|max)\s*$)/i;

function cleanName(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,)])/g, "$1")
    .replace(/([(])\s+/g, "$1")
    .trim();
}

function normaliseFamilyName(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseEffort(value: string): ReasoningEffort | null {
  const normalised = value.toLowerCase().replace(/[\s_-]+/g, "");
  if (normalised.includes("xhigh") || normalised.includes("extrahigh")) return "xhigh";
  if (normalised.includes("maximum") || normalised.includes("max")) return "max";
  if (normalised.includes("minimal")) return "minimal";
  if (normalised.includes("low")) return "low";
  if (normalised.includes("medium")) return "medium";
  if (normalised.includes("high")) return "high";
  return null;
}

function parseMode(value: string): ReasoningMode | null {
  if (/non[-\s]?reasoning/i.test(value)) return "non-reasoning";
  if (/adaptive\s+reasoning/i.test(value)) return "adaptive-reasoning";
  if (/thinking/i.test(value)) return "thinking";
  if (/reasoning/i.test(value)) return "reasoning";
  return null;
}

function stripTrailingReasoningWord(value: string): {
  familyName: string;
  mode: ReasoningMode | null;
} {
  const trailingContext = value.match(/(\s+\([^()]+\))\s*$/)?.[1] ?? "";
  const prefix = trailingContext
    ? value.slice(0, value.length - trailingContext.length)
    : value;
  const match = prefix.match(
    /^(.*?)(?:[-\s]+)(non[-\s]?reasoning|adaptive\s+reasoning|thinking|reasoning|think)\s*$/i,
  );
  if (!match) return { familyName: value, mode: null };

  const token = match[2];
  const mode = /non/i.test(token)
    ? "non-reasoning"
    : /adaptive/i.test(token)
      ? "adaptive-reasoning"
      : /think/i.test(token)
        ? "thinking"
        : "reasoning";

  return {
    familyName: cleanName(`${match[1]}${trailingContext}`),
    mode,
  };
}

export function describeReasoningVariant(
  model: ReasoningModelIdentity,
): ReasoningVariantDescriptor {
  let familyName = cleanName(model.name);
  let mode: ReasoningMode = "default";
  let effort: ReasoningEffort | null = null;
  let explicit = false;

  const parenthetical = familyName.match(/\s*\(([^()]*)\)\s*$/);
  // "(Max, Default Fallback)" carries the effort in one of its comma parts.
  if (parenthetical && parenthetical[1].split(/\s*,\s*/).some((part) => REASONING_QUALIFIER.test(part))) {
    const qualifier = parenthetical[1];
    const preservedParts = qualifier
      .split(/\s*,\s*/)
      .filter((part) => !REASONING_QUALIFIER.test(part));

    familyName = cleanName(
      `${familyName.slice(0, parenthetical.index)}${
        preservedParts.length > 0 ? ` (${preservedParts.join(", ")})` : ""
      }`,
    );
    mode = parseMode(qualifier) ?? "reasoning";
    effort = parseEffort(qualifier);
    explicit = true;
  }

  const suffix = stripTrailingReasoningWord(familyName);
  if (suffix.mode) {
    familyName = suffix.familyName;
    if (mode === "default" || mode === "reasoning") mode = suffix.mode;
    explicit = true;
  }

  const familyKey = `${model.model_creator.slug.toLowerCase()}:${normaliseFamilyName(familyName)}`;
  return { familyKey, familyName, mode, effort, explicit };
}

function sortVariants(a: ModelReasoningVariant, b: ModelReasoningVariant): number {
  const modeRank = (mode: ReasoningMode) => {
    if (mode === "non-reasoning") return 0;
    if (mode === "default") return 1;
    return 2;
  };
  return (
    modeRank(a.descriptor.mode) - modeRank(b.descriptor.mode) ||
    (a.descriptor.effort ? EFFORT_RANK.get(a.descriptor.effort)! + 1 : 0) -
      (b.descriptor.effort ? EFFORT_RANK.get(b.descriptor.effort)! + 1 : 0) ||
    a.model.name.localeCompare(b.model.name)
  );
}

export function getModelReasoningFamily(
  models: LLMModel[],
  slug: string,
): ModelReasoningFamily | null {
  const selected = models.find((model) => model.slug === slug);
  if (!selected) return null;

  const selectedDescriptor = describeReasoningVariant(selected);
  const variants = models
    .map((model) => ({ model, descriptor: describeReasoningVariant(model) }))
    .filter((entry) => entry.descriptor.familyKey === selectedDescriptor.familyKey);
  const isReasoningFamily =
    variants.length > 1 && variants.some((entry) => entry.descriptor.explicit);

  if (!isReasoningFamily) {
    return {
      familyKey: selectedDescriptor.familyKey,
      familyName: selected.name,
      variants: [{ model: selected, descriptor: selectedDescriptor }],
    };
  }

  return {
    familyKey: selectedDescriptor.familyKey,
    familyName: selectedDescriptor.familyName,
    variants: variants.sort(sortVariants),
  };
}

function compareCanonicalSlugs(a: string, b: string): number {
  return a.length - b.length || a.localeCompare(b);
}

function getCanonicalReasoningVariant(
  family: ModelReasoningFamily,
): ModelReasoningVariant {
  return [...family.variants].sort((a, b) => compareCanonicalSlugs(a.model.slug, b.model.slug))[0];
}

/**
 * The slug a collapsed catalogue lists for a family: its shortest variant
 * slug. The other reasoning levels are views of the same model page.
 */
export function canonicalVariantSlug(slugs: readonly string[]): string | null {
  return [...slugs].sort(compareCanonicalSlugs)[0] ?? null;
}

export function toModelDetailData(
  family: ModelReasoningFamily,
  selectedSlug: string,
): ModelDetailData | null {
  const selected = family.variants.find(({ model }) => model.slug === selectedSlug);
  if (!selected) return null;
  return {
    model: selected.model,
    familyName: family.familyName,
    variants: family.variants.map(({ model, descriptor }) => ({
      slug: model.slug,
      name: model.name,
      mode: descriptor.mode,
      effort: descriptor.effort,
    })),
  };
}

/**
 * The catalogue grouped as the collapsed views list it: one entry per
 * reasoning family, every variant kept, in the order of first appearance.
 */
export function reasoningFamilies(models: LLMModel[]): ModelReasoningFamily[] {
  const groups = new Map<string, ModelReasoningVariant[]>();
  for (const model of models) {
    const descriptor = describeReasoningVariant(model);
    const group = groups.get(descriptor.familyKey) ?? [];
    group.push({ model, descriptor });
    groups.set(descriptor.familyKey, group);
  }

  const families: Array<{ family: ModelReasoningFamily; index: number }> = [];
  const position = new Map(models.map((model, index) => [model, index]));
  for (const group of groups.values()) {
    const isReasoningFamily =
      group.length > 1 && group.some((entry) => entry.descriptor.explicit);
    if (!isReasoningFamily) {
      for (const entry of group) {
        families.push({
          index: position.get(entry.model)!,
          family: { familyKey: entry.descriptor.familyKey, familyName: entry.model.name, variants: [entry] },
        });
      }
      continue;
    }
    families.push({
      index: Math.min(...group.map((entry) => position.get(entry.model)!)),
      family: { familyKey: group[0].descriptor.familyKey, familyName: group[0].descriptor.familyName, variants: group },
    });
  }

  return families.sort((a, b) => a.index - b.index).map(({ family }) => family);
}

/** The model a collapsed view lists for a family, named after the family. */
export function collapsedFamilyModel(family: ModelReasoningFamily): LLMModel {
  if (family.variants.length === 1) return family.variants[0].model;
  return { ...getCanonicalReasoningVariant(family).model, name: family.familyName };
}

export function collapseReasoningVariants(models: LLMModel[]): LLMModel[] {
  return reasoningFamilies(models).map(collapsedFamilyModel);
}
