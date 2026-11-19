import { catalogSlug } from "./catalog-slug";

/*
 * Cursor's CursorBench leaderboard, read from the server-rendered table of
 * https://cursor.com/cursorbench. Cursor names each row by model and
 * reasoning level ("Gemini 4 Neon Extra High") and publishes the score, the
 * average cost, tokens and agent steps per task. The page's own heading
 * names the version ("CursorBench 4.1").
 */

const EFFORT_SUFFIXES = [
  ["Extra High", "xhigh"],
  ["Max", "max"],
  ["High", "high"],
  ["Medium", "medium"],
  ["Low", "low"],
  ["Minimal", "minimal"],
] as const;
export type CursorBenchEffort = (typeof EFFORT_SUFFIXES)[number][1];

/** Cursor drops the brand of Anthropic's families ("Opus 5.5"); the catalogue keeps it. */
const CLAUDE_FAMILIES = /^(?:fable|opus|sonnet|haiku)\b/i;

export interface CursorBenchRow {
  /** Cursor's row name, unique within the table, e.g. "Gemini 4 Neon Extra High". */
  id: string;
  /** Model part of the name, e.g. "Gemini 4 Neon". */
  model: string;
  effort: CursorBenchEffort | null;
  /** Share of tasks solved, 0–1. */
  score: number;
  cost_per_task_usd: number | null;
  tokens_per_task: number | null;
  steps_per_task: number | null;
}

export interface CursorBenchData {
  rows: CursorBenchRow[];
  /** Version the source page names, e.g. "4.1". */
  version: string | null;
  /** When BenchSift retrieved this snapshot from the source (ISO 8601). */
  fetched_at?: string;
}

export type CursorBenchSort = "score" | "cost";

export interface CursorBenchSearch {
  q?: string;
  sort?: Exclude<CursorBenchSort, "score">;
}

const MAX_NAME_LENGTH = 120;
const MAX_QUERY_LENGTH = 80;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function cellText(html: string): string {
  return html
    .replace(/<!--.*?-->/gs, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
      return ENTITIES[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function number(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Splits "Gemini 4 Neon Extra High" into the model and its reasoning level. */
export function splitCursorBenchName(name: string): { model: string; effort: CursorBenchEffort | null } {
  for (const [suffix, effort] of EFFORT_SUFFIXES) {
    if (name.length > suffix.length + 1 && name.toLowerCase().endsWith(` ${suffix.toLowerCase()}`)) {
      return { model: name.slice(0, -suffix.length - 1).trim(), effort };
    }
  }
  return { model: name, effort: null };
}

/** Catalogue slugs a row may correspond to, most specific first. */
export function cursorBenchSlugCandidates(row: Pick<CursorBenchRow, "model">): string[] {
  const base = catalogSlug(row.model);
  return CLAUDE_FAMILIES.test(row.model) ? [`claude-${base}`, base] : [base];
}

/**
 * Parses the first leaderboard table of the page. A row needs a name and a
 * score in [0, 100] %; a measured zero is kept, an unreadable figure is null.
 * Duplicate names keep their first occurrence; rows are ordered by score,
 * ties in source order.
 */
export function parseCursorBench(html: string): CursorBenchData {
  // The heading names the current version; the page also lists older ones in its changelog.
  const heading = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(([, inner]) => cellText(inner)).find((text) => /CursorBench/i.test(text));
  const version = heading?.match(/CursorBench\s*(\d+(?:\.\d+){0,2})\b/i)?.[1] ?? null;
  const table = html.match(/<table\b[\s\S]*?<\/table>/i)?.[0];
  const body = table?.match(/<tbody\b[\s\S]*?<\/tbody>/i)?.[0];
  if (!body) return { rows: [], version };
  const seen = new Set<string>();
  const rows = [...body.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].flatMap(([tr]): CursorBenchRow[] => {
    const cells = [...tr.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, cell]) => cellText(cell));
    if (cells.length < 3) return [];
    const [, name, scoreText, costText, tokensText, stepsText] = cells;
    if (!name || name.length > MAX_NAME_LENGTH || seen.has(name)) return [];
    const percent = number(scoreText, /^(\d+(?:\.\d+)?)\s*%$/);
    if (percent === null || percent > 100) return [];
    seen.add(name);
    return [{
      id: name,
      ...splitCursorBenchName(name),
      score: percent / 100,
      cost_per_task_usd: number(costText ?? "", /^\$\s*([\d,]+(?:\.\d+)?)$/),
      tokens_per_task: number(tokensText ?? "", /^([\d,]+)$/),
      steps_per_task: number(stepsText ?? "", /^([\d,]+)$/),
    }];
  });
  return {
    version,
    rows: rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => b.row.score - a.row.score || a.index - b.index)
      .map(({ row }) => row),
  };
}

/**
 * Filters and orders rows for display. `searchText` adds text to match, such
 * as a catalogue name; a missing cost sorts last.
 */
export function selectCursorBenchRows(
  rows: readonly CursorBenchRow[],
  options: { query: string; sort: CursorBenchSort; searchText?: (row: CursorBenchRow) => string },
): CursorBenchRow[] {
  const query = options.query.trim().toLowerCase();
  const selected = query
    ? rows.filter((row) => [row.id, options.searchText?.(row)].some((value) => value?.toLowerCase().includes(query)))
    : [...rows];
  if (options.sort === "cost") {
    return selected
      .map((row, index) => ({ row, index }))
      .sort((a, b) => (a.row.cost_per_task_usd ?? Number.POSITIVE_INFINITY) - (b.row.cost_per_task_usd ?? Number.POSITIVE_INFINITY) || a.index - b.index)
      .map(({ row }) => row);
  }
  return selected;
}

/** URL state of the page; default values are omitted. */
export function parseCursorBenchSearch(raw: Record<string, unknown>): CursorBenchSearch {
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, MAX_QUERY_LENGTH) : "";
  return {
    ...(q ? { q } : {}),
    ...(raw.sort === "cost" ? { sort: "cost" as const } : {}),
  };
}
