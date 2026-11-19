import type { LLMModel } from "./model-types";
import { matchCatalogRuns, type CatalogRunInfo } from "./benchmark-run-catalog";
import { cursorBenchSlugCandidates, type CursorBenchRow } from "./cursorbench-data";

export function matchCursorBenchModels(models: LLMModel[], rows: readonly CursorBenchRow[]): Record<string, CatalogRunInfo> {
  return matchCatalogRuns(models, rows, (row) => ({ id: row.id, candidates: cursorBenchSlugCandidates(row), effort: row.effort }));
}
