import { findFlightElementProps, parseFlightRecords } from "./aa-flight";

/*
 * Artificial Analysis AA-PersonalityBench, read from the
 * `/evaluations/aa-personalitybench` RSC payload. AA publishes one Elo per
 * model and trait: how strongly the model shows the trait, not how good it is.
 * The eight personality indexes are published for the charted models only and
 * rest on a percentile rank across every model, so they are not reproduced.
 */

export interface PersonalityTrait {
  id: string;
  /** AA's English label and definition; a definition can be missing. */
  label: string;
  definition: string | null;
  /** The personality index AA files the trait under, when its page says so. */
  index: string | null;
}

export interface PersonalityIndex {
  id: string;
  label: string;
  description: string | null;
}

export interface PersonalityRow {
  /** AA model slug, also the catalogue join key. */
  slug: string;
  /** Full AA name, including the configuration. */
  name: string;
  /** Name without the configuration, e.g. "Claude Opus 5.5". */
  family_name: string;
  /** AA configuration, e.g. "Max, Default Fallback". */
  configuration: string | null;
  creator_name: string | null;
  /** Elo per trait id. */
  scores: Record<string, number>;
}

export interface PersonalityData {
  rows: PersonalityRow[];
  /** Traits in AA's order, grouped by index. */
  traits: PersonalityTrait[];
  indexes: PersonalityIndex[];
  /** When BenchSift retrieved this snapshot from the source (ISO 8601). */
  fetched_at?: string;
}

export interface PersonalitySearch {
  trait?: string;
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,119}$/;
const ID_PATTERN = /^[a-z][a-zA-Z0-9]{0,63}$/;
const RESERVED_IDS = new Set(["constructor", "prototype"]);
const INDEX_HREF = /^\/evaluations\/aa-personalitybench\/indexes\/([a-z][a-zA-Z0-9]{0,63})$/;

type Props = Record<string, unknown>;

function isProps(value: unknown): value is Props {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isId(value: string): boolean {
  return ID_PATTERN.test(value) && !RESERVED_IDS.has(value);
}

function eloScores(value: unknown): Record<string, number> | null {
  if (!isProps(value)) return null;
  const scores: Record<string, number> = {};
  for (const [trait, elo] of Object.entries(value)) {
    // A Bradley-Terry Elo anchored at 1,000 can be negative.
    if (isId(trait) && typeof elo === "number" && Number.isFinite(elo)) scores[trait] = elo;
  }
  return Object.keys(scores).length ? scores : null;
}

/** AA writes the configuration as a trailing parenthesis: "Name (Max, Default Fallback)". */
function splitName(name: string): Pick<PersonalityRow, "family_name" | "configuration"> {
  const match = /^(.+?) \(([^()]+)\)$/.exec(name);
  return match ? { family_name: match[1], configuration: match[2] } : { family_name: name, configuration: null };
}

function path(value: unknown, keys: readonly string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!isProps(current) || !Object.hasOwn(current, key)) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * The trait labels and definitions. Their record follows length-prefixed text
 * rows (sample answers) on the same line, so the line reader never sees it:
 * the object is read from the payload text by matching its braces.
 */
function traitMessages(payload: string): Props {
  const marker = '"personalitybench":{"traits":{';
  const start = payload.indexOf(marker);
  if (start < 0) return {};
  const open = start + marker.length - 1;
  let depth = 0;
  let inString = false;
  for (let position = open; position < payload.length && position < open + 200_000; position += 1) {
    const char = payload[position];
    if (inString) {
      if (char === "\\") position += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) {
      try {
        const parsed: unknown = JSON.parse(payload.slice(open, position + 1));
        return isProps(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
  }
  return {};
}

/**
 * Trait ids under each index, from the index cards of the page: a link to the
 * index holding one chip per trait.
 */
function indexTraits(records: ReadonlyMap<string, unknown>): Map<string, string> {
  const traitIndex = new Map<string, string>();
  const collect = (node: unknown, index: string, depth: number): void => {
    if (depth > 24 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      if (node[0] === "$" && node[1] === "span" && typeof node[2] === "string" && isId(node[2]) && !traitIndex.has(node[2]))
        traitIndex.set(node[2], index);
      for (const child of node) collect(child, index, depth + 1);
      return;
    }
    for (const child of Object.values(node)) collect(child, index, depth + 1);
  };
  const walk = (node: unknown, depth: number): void => {
    if (depth > 48 || !node || typeof node !== "object") return;
    if (Array.isArray(node) && node[0] === "$" && isProps(node[3])) {
      const index = INDEX_HREF.exec(text(node[3].href) ?? "")?.[1];
      if (index && isId(index)) return collect(node[3].children, index, 0);
    }
    for (const child of Array.isArray(node) ? node : Object.values(node)) walk(child, depth + 1);
  };
  for (const record of records.values()) walk(record, 0);
  return traitIndex;
}

/**
 * Parses the judged models, the traits and their indexes. A row needs a valid
 * slug, a name and at least one Elo; duplicates keep their first occurrence.
 * AA sends the scores of its charted models once, on the chart's own list, and
 * points to them from the full list: they are joined back by slug.
 */
export function parsePersonality(payload: string): Omit<PersonalityData, "fetched_at"> {
  const records = parseFlightRecords(payload);
  const [pool] = findFlightElementProps(records, (props) => Array.isArray(props.judgedPool));
  if (!pool) return { rows: [], traits: [], indexes: [] };

  const charted = new Map<string, Record<string, number>>();
  for (const props of findFlightElementProps(records, (props) => Array.isArray(props.initialModels))) {
    for (const model of props.initialModels as unknown[]) {
      const slug = isProps(model) ? text(model.slug) : null;
      const scores = isProps(model) ? eloScores(path(model, ["judged", "scores"])) : null;
      if (slug && scores && !charted.has(slug)) charted.set(slug, scores);
    }
  }

  const seen = new Set<string>();
  const rows = (pool.judgedPool as unknown[]).flatMap((model): PersonalityRow[] => {
    if (!isProps(model)) return [];
    const slug = text(model.slug);
    const name = text(model.name);
    if (!slug || !SLUG_PATTERN.test(slug) || !name || seen.has(slug)) return [];
    const scores = eloScores(model.scores) ?? charted.get(slug);
    if (!scores) return [];
    seen.add(slug);
    return [{
      slug,
      name,
      ...splitName(name),
      creator_name: isProps(model.creator) ? text(model.creator.name) : null,
      scores,
    }];
  });

  const traitCopy = traitMessages(payload);
  const [indexCopy] = findFlightElementProps(records, (props) => isProps(path(props, ["messages", "indexes"])));
  const indexMessages = (indexCopy ? path(indexCopy, ["messages", "indexes"]) : {}) as Props;

  const indexes = Object.entries(indexMessages).flatMap(([id, copy]): PersonalityIndex[] => {
    const label = isProps(copy) ? text(copy.label) : null;
    return isId(id) && label ? [{ id, label, description: isProps(copy) ? text(copy.description) : null }] : [];
  });
  const indexOrder = new Map(indexes.map((index, position) => [index.id, position]));
  const traitIndex = indexTraits(records);

  const measured = new Set(rows.flatMap((row) => Object.keys(row.scores)));
  const traits = [...measured]
    .map((id, position): PersonalityTrait & { position: number } => {
      const copy = Object.hasOwn(traitCopy, id) ? traitCopy[id] : null;
      const index = traitIndex.get(id);
      return {
        id,
        label: (isProps(copy) ? text(copy.label) : null) ?? id,
        definition: isProps(copy) ? text(copy.definition) : null,
        index: index !== undefined && indexOrder.has(index) ? index : null,
        position,
      };
    })
    .sort((a, b) =>
      (a.index ? indexOrder.get(a.index)! : indexes.length) - (b.index ? indexOrder.get(b.index)! : indexes.length)
      || a.position - b.position)
    .map(({ position: _position, ...trait }) => trait);

  return { rows, traits, indexes: indexes.filter((index) => traits.some((trait) => trait.index === index.id)) };
}

/** A trait's Elo for a row, or null when AA did not rate it. */
export function personalityElo(row: PersonalityRow, trait: string): number | null {
  return Object.hasOwn(row.scores, trait) ? row.scores[trait] : null;
}

/** Rows rated on a trait, from the model showing it most to the one showing it least; ties keep source order. */
export function rankPersonalityRows(rows: readonly PersonalityRow[], trait: string): PersonalityRow[] {
  return rows
    .map((row, position) => ({ row, position, elo: personalityElo(row, trait) }))
    .filter((entry): entry is typeof entry & { elo: number } => entry.elo !== null)
    .sort((a, b) => b.elo - a.elo || a.position - b.position)
    .map(({ row }) => row);
}

export function parsePersonalitySearch(raw: Record<string, unknown>): PersonalitySearch {
  return typeof raw.trait === "string" && isId(raw.trait) ? { trait: raw.trait } : {};
}
