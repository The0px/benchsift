/*
 * Epoch AI FrontierMath results, read from the CSV files of Epoch's public
 * benchmark archive (CC BY 4.0). Epoch names each run by a model version
 * such as `gpt-6.2-astra_max`: the model, then the reasoning setting it ran
 * with. Scores are fractions of the private problem set solved.
 */

export const FRONTIERMATH_TIERS = ["tiers_1_3", "tier_4"] as const;
export type FrontierMathTier = (typeof FRONTIERMATH_TIERS)[number];
/** Tiers 1–3 is the default view and the catalogue's Math ranking: more problems, less saturated. */
export const DEFAULT_FRONTIERMATH_TIER: FrontierMathTier = "tiers_1_3";

/** Archive file of each tier, as listed in Epoch's `benchmark_metadata.csv`. */
export const FRONTIERMATH_FILES: Record<FrontierMathTier, string> = {
  tiers_1_3: "frontiermath_tiers_1_3_v2.csv",
  tier_4: "frontiermath_tier_4_v2.csv",
};
export const EPOCH_MODEL_METADATA_FILE = "model_metadata.csv";

/** Evaluation key each tier writes on a catalogue model, as a 0–1 fraction. */
export const FRONTIERMATH_EVALUATION_KEYS = {
  tiers_1_3: "frontiermath_tiers_1_3",
  tier_4: "frontiermath_tier_4",
} as const satisfies Record<FrontierMathTier, string>;

import { catalogSlug } from "./catalog-slug";

const EFFORTS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type FrontierMathEffort = (typeof EFFORTS)[number];

export interface FrontierMathRow {
  /** Epoch model version, e.g. `gpt-6.2-astra_max`; unique within a tier. */
  id: string;
  /** Model part of the version, e.g. `gpt-6.2-astra`. */
  model: string;
  /** Reasoning effort when the version suffix names one. */
  effort: FrontierMathEffort | null;
  /** Epoch display name, e.g. "GPT-6.2 Astra (max)", or the version itself. */
  name: string;
  /** Epoch model group without the setting, e.g. "GPT-6.2 Astra". */
  group: string | null;
  organization: string | null;
  release_date: string | null;
  /** Share of problems solved, 0–1. */
  score: number;
  /** Standard error of the score, 0–1. */
  stderr: number | null;
}

export interface FrontierMathData {
  tiers: Record<FrontierMathTier, FrontierMathRow[]>;
  /** When BenchSift retrieved this snapshot from the source (ISO 8601). */
  fetched_at?: string;
}

export interface EpochModelMetadata {
  display_name: string | null;
  model_group: string | null;
}

export type FrontierMathSort = "score" | "release";

export interface FrontierMathSearch {
  tier?: Exclude<FrontierMathTier, typeof DEFAULT_FRONTIERMATH_TIER>;
  q?: string;
  sort?: Exclude<FrontierMathSort, "score">;
}

const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUERY_LENGTH = 80;

/** RFC 4180 CSV: quoted fields may hold commas, doubled quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function records(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ""));
  if (!header) return [];
  return rows.map((cells) => Object.fromEntries(header.map((name, index) => [name.trim(), cells[index]?.trim() ?? ""])));
}

function text(value: string | undefined): string | null {
  return value ? value : null;
}

function fraction(value: string | undefined): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

/** Epoch's model metadata, keyed by model version. */
export function parseEpochModelMetadata(csv: string): Map<string, EpochModelMetadata> {
  const metadata = new Map<string, EpochModelMetadata>();
  for (const row of records(csv)) {
    const version = row.model_version;
    if (!version || !VERSION_PATTERN.test(version) || metadata.has(version)) continue;
    metadata.set(version, { display_name: text(row.display_name), model_group: text(row.model_group) });
  }
  return metadata;
}

/** Splits `model_effort`; a suffix that is not a reasoning effort (`32K`, `none`) leaves the effort unknown. */
export function splitModelVersion(version: string): { model: string; effort: FrontierMathEffort | null; suffix: string | null } {
  const at = version.lastIndexOf("_");
  if (at <= 0) return { model: version, effort: null, suffix: null };
  const suffix = version.slice(at + 1);
  const effort = (EFFORTS as readonly string[]).includes(suffix.toLowerCase()) ? (suffix.toLowerCase() as FrontierMathEffort) : null;
  return { model: version.slice(0, at), effort, suffix };
}

/**
 * Parses one tier. A row needs a valid model version and a score in [0, 1]
 * (Epoch's best score across scorers, else its mean); a measured zero is
 * kept. Duplicates keep their first occurrence; rows are ordered by score,
 * ties in source order.
 */
export function parseFrontierMathCsv(csv: string, metadata: ReadonlyMap<string, EpochModelMetadata> = new Map()): FrontierMathRow[] {
  const seen = new Set<string>();
  const rows = records(csv).flatMap((row): FrontierMathRow[] => {
    const id = row["Model version"];
    if (!id || !VERSION_PATTERN.test(id) || seen.has(id)) return [];
    const score = fraction(row["Best score (across scorers)"]) ?? fraction(row.mean_score);
    if (score === null) return [];
    seen.add(id);
    const { model, effort } = splitModelVersion(id);
    const meta = metadata.get(id);
    const release = row["Release date"];
    return [{
      id,
      model,
      effort,
      name: meta?.display_name ?? id,
      group: meta?.model_group ?? null,
      organization: text(row.Organization),
      release_date: release && DATE_PATTERN.test(release) ? release : null,
      score,
      stderr: fraction(row.stderr),
    }];
  });
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => b.row.score - a.row.score || a.index - b.index)
    .map(({ row }) => row);
}

/**
 * Catalogue slugs a row may correspond to, most specific first: Epoch's model
 * id with dots as hyphens and any release-date suffix removed, then its model
 * group name. Hosting suffixes (`-together`) are left alone: a host is not
 * the model.
 */
export function frontierMathSlugCandidates(row: Pick<FrontierMathRow, "model" | "group">): string[] {
  const base = catalogSlug(row.model);
  const undated = base.replace(/-(?:\d{4}-\d{2}-\d{2}|\d{8})$/, "");
  return [...new Set([base, undated, row.group ? catalogSlug(row.group) : ""].filter(Boolean))];
}

function releaseTime(row: FrontierMathRow): number {
  const time = row.release_date ? Date.parse(row.release_date) : Number.NaN;
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/**
 * Filters and orders rows for display. `searchText` adds text to match, such
 * as a catalogue name; a missing release date sorts last.
 */
export function selectFrontierMathRows(
  rows: readonly FrontierMathRow[],
  options: { query: string; sort: FrontierMathSort; searchText?: (row: FrontierMathRow) => string },
): FrontierMathRow[] {
  const query = options.query.trim().toLowerCase();
  const selected = query
    ? rows.filter((row) => [row.name, row.id, row.group, row.organization, options.searchText?.(row)]
      .some((value) => value?.toLowerCase().includes(query)))
    : [...rows];
  if (options.sort === "release") {
    return selected
      .map((row, index) => ({ row, index }))
      .sort((a, b) => releaseTime(b.row) - releaseTime(a.row) || a.index - b.index)
      .map(({ row }) => row);
  }
  return selected;
}

/** URL state of the page; default values are omitted. */
export function parseFrontierMathSearch(raw: Record<string, unknown>): FrontierMathSearch {
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, MAX_QUERY_LENGTH) : "";
  return {
    ...(raw.tier === "tier_4" ? { tier: "tier_4" as const } : {}),
    ...(q ? { q } : {}),
    ...(raw.sort === "release" ? { sort: "release" as const } : {}),
  };
}
