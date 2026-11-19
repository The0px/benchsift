import { useMemo, type ReactNode } from "react";
import { Blocks, Trophy } from "@/components/icons";
import { SearchField } from "@/components/search-field";
import { useUrlQuery } from "@/components/use-url-query";
import { Link } from "@/components/link";
import { BenchmarkDisclosure, BenchmarkHeader, ScoreBar, StatTiles } from "@/components/benchmark-page";
import { ModelProviderIcon } from "@/components/model-provider-icon";
import { SegmentedControl } from "@/components/segmented-control";
import { Badge } from "@/components/ui/badge";
import type { CatalogRunInfo } from "@/lib/benchmark-run-catalog";
import {
  parseCursorBenchSearch,
  selectCursorBenchRows,
  type CursorBenchData,
  type CursorBenchRow,
  type CursorBenchSearch,
} from "@/lib/cursorbench-data";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getModelLogoKey } from "@/lib/provider-map";

export const CURSORBENCH_SOURCE_URL = "https://cursor.com/cursorbench";

export type CursorBenchPageData = CursorBenchData & { catalog: Record<string, CatalogRunInfo> };

/**
 * Cursor's CursorBench leaderboard: headline figures, then a searchable
 * table. Ranks follow the score order, so a search or the cost sort never
 * renumbers them. Search and sort live in the URL.
 */
export function CursorBenchView({
  data,
  summary,
  search,
  onSearchChange,
}: {
  data: CursorBenchPageData;
  summary?: ReactNode;
  search: CursorBenchSearch;
  onSearchChange: (search: CursorBenchSearch) => void;
}) {
  const { t, lang } = useI18n();
  const copy = t.cursorBench;
  const colon = lang === "fr" ? " : " : ": ";
  const sort = search.sort ?? "score";
  const allRows = data.rows;

  const [query, setQuery] = useUrlQuery(search, onSearchChange, parseCursorBenchSearch);

  const ranks = useMemo(() => new Map(allRows.map((row, index) => [row, index + 1])), [allRows]);
  const rows = useMemo(
    () => selectCursorBenchRows(allRows, { query: search.q ?? "", sort, searchText: (row) => data.catalog[row.id]?.name ?? "" }),
    [allRows, search.q, sort, data.catalog],
  );

  const source = { href: CURSORBENCH_SOURCE_URL, label: copy.viewOnSource };
  const version = data.version ? `CursorBench ${data.version}` : copy.title;

  if (allRows.length === 0) {
    return (
      <div className="space-y-6">
        <BenchmarkHeader icon={Blocks} title={copy.title} description={copy.description} source={source} />
        <p role="status" className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{copy.empty}</p>
      </div>
    );
  }

  const top = allRows[0];
  const leaders = allRows.filter((row) => row.score === top.score).length;
  const cheapest = allRows.reduce<CursorBenchRow | null>(
    (best, row) => (row.cost_per_task_usd !== null && (best === null || row.cost_per_task_usd < best.cost_per_task_usd!) ? row : best),
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <BenchmarkHeader icon={Blocks} title={copy.title} description={copy.description} source={source} summary={summary} />

      <StatTiles
        tiles={[
          { key: "runs", label: copy.stats.runs, value: formatNumber(allRows.length, lang, 0), hint: copy.stats.runsHint },
          {
            key: "best",
            label: copy.stats.best,
            value: formatPercent(top.score, lang),
            detail: leaders > 1 ? copy.stats.tied(top.id, leaders - 1) : top.id,
            hint: copy.scoreHint,
          },
          {
            key: "cheapest",
            label: copy.stats.cheapest,
            value: cheapest ? formatMoney(cheapest.cost_per_task_usd, lang) : "—",
            detail: cheapest ? `${cheapest.id} · ${formatPercent(cheapest.score, lang)}` : undefined,
          },
          { key: "version", label: copy.stats.version, value: data.version ?? "—", detail: copy.stats.versionDetail },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField value={query} onChange={setQuery} placeholder={copy.search} clearLabel={t.compare.clear} className="flex-1" />
        <SegmentedControl
          value={sort}
          onChange={(value) => onSearchChange(parseCursorBenchSearch({ ...search, sort: value }))}
          label={copy.sortBy}
          options={[
            { value: "score", label: copy.headers.score },
            { value: "cost", label: copy.headers.cost },
          ]}
        />
        <p role="status" className="shrink-0 text-xs text-muted-foreground">
          {rows.length} / {allRows.length} {copy.runs}
        </p>
      </div>

      {rows.length === 0 ? (
        <p role="status" className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">{t.grid.noResults}</p>
      ) : (
        <>
          <ol className="grid grid-cols-1 gap-2 lg:hidden">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="w-7 shrink-0 pt-1 text-xs font-semibold tabular-nums text-muted-foreground">#{ranks.get(row)}</span>
                  <RowIcon row={row} info={data.catalog[row.id]} />
                  <div className="min-w-0 flex-1">
                    <ModelName row={row} info={data.catalog[row.id]} />
                    <p className="mt-0.5 text-xs text-muted-foreground">{data.catalog[row.id]?.creatorName ?? "—"}</p>
                  </div>
                  <ScoreBar value={row.score} label={formatPercent(row.score, lang)} className="w-20" />
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                  <span>{copy.headers.cost}{colon}<span className="font-medium tabular-nums text-foreground">{formatMoney(row.cost_per_task_usd, lang)}</span></span>
                  <span>{copy.headers.tokens}{colon}<span className="font-medium tabular-nums text-foreground">{formatCount(row.tokens_per_task, lang)}</span></span>
                  <span>{copy.headers.steps}{colon}<span className="font-medium tabular-nums text-foreground">{formatCount(row.steps_per_task, lang)}</span></span>
                </p>
              </li>
            ))}
          </ol>

          <div className="hidden overflow-clip rounded-xl border bg-card lg:block">
            <table className="w-full text-sm">
              <caption className="sr-only">{version}</caption>
              <thead className="model-table-head">
                <tr>
                  <th scope="col" className="w-12 px-4 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                  <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">{copy.headers.model}</th>
                  <th scope="col" aria-sort={sort === "score" ? "descending" : undefined} className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{copy.headers.score}</th>
                  <th scope="col" aria-sort={sort === "cost" ? "ascending" : undefined} className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{copy.headers.cost}</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{copy.headers.tokens}</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{copy.headers.steps}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b transition-colors duration-150 last:border-b-0 hover:bg-muted/40">
                    <td className="px-4 py-3 text-xs font-semibold tabular-nums text-muted-foreground">
                      {ranks.get(row) === 1 ? <Trophy aria-label="#1" className="size-4 text-foreground" /> : ranks.get(row)}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <RowIcon row={row} info={data.catalog[row.id]} />
                        <div className="min-w-0">
                          <ModelName row={row} info={data.catalog[row.id]} />
                          <p className="truncate text-xs text-muted-foreground">{data.catalog[row.id]?.creatorName ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className={cn("px-3 py-3 text-right", sort !== "score" && "text-muted-foreground")}>
                      <ScoreBar value={row.score} label={formatPercent(row.score, lang)} className="ml-auto w-24" />
                    </td>
                    <td className={cn("whitespace-nowrap px-3 py-3 text-right tabular-nums", sort === "cost" ? "font-semibold" : "text-muted-foreground")}>
                      {formatMoney(row.cost_per_task_usd, lang)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">{formatCount(row.tokens_per_task, lang)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">{formatCount(row.steps_per_task, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <BenchmarkDisclosure title={t.benchmarkUi.methodology}>
        <p>{copy.methodDescription}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-4">
          {Object.values(copy.method).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </BenchmarkDisclosure>
      <p className="text-xs text-muted-foreground">{copy.sourceNote(version)}</p>
    </div>
  );
}

function formatCount(value: number | null, lang: "en" | "fr"): string {
  return value === null ? "—" : formatNumber(value, lang, 0);
}

function RowIcon({ row, info }: { row: CursorBenchRow; info: CatalogRunInfo | undefined }) {
  return <ModelProviderIcon provider={getModelLogoKey(info?.slug ?? row.model, info?.creatorSlug ?? "")} iconUrl={info?.iconUrl} size={28} />;
}

function ModelName({ row, info }: { row: CursorBenchRow; info: CatalogRunInfo | undefined }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {info ? (
        <Link href={`/models/${encodeURIComponent(info.slug)}`} className="truncate rounded-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {row.model}
        </Link>
      ) : (
        <span className="truncate font-medium">{row.model}</span>
      )}
      {row.effort && <Badge variant="secondary" className="font-mono text-[10px] uppercase">{row.effort}</Badge>}
    </span>
  );
}
