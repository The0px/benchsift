import { useMemo, type ReactNode } from "react";
import { Brain, Trophy } from "@/components/icons";
import { SearchField } from "@/components/search-field";
import { useUrlQuery } from "@/components/use-url-query";
import { Link } from "@/components/link";
import { BenchmarkDisclosure, BenchmarkHeader, ScoreBar, StatTiles } from "@/components/benchmark-page";
import { ModelProviderIcon } from "@/components/model-provider-icon";
import { SegmentedControl } from "@/components/segmented-control";
import { Badge } from "@/components/ui/badge";
import type { FrontierMathModelInfo } from "@/lib/frontiermath-catalog";
import {
  DEFAULT_FRONTIERMATH_TIER,
  parseFrontierMathSearch,
  selectFrontierMathRows,
  type FrontierMathData,
  type FrontierMathRow,
  type FrontierMathSearch,
  type FrontierMathTier,
} from "@/lib/frontiermath-data";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getModelLogoKey } from "@/lib/provider-map";

export const FRONTIERMATH_SOURCE_URL = "https://epoch.ai/frontiermath/tiers-1-4";

export type FrontierMathPageData = FrontierMathData & { catalog: Record<string, FrontierMathModelInfo> };

/**
 * Epoch AI FrontierMath leaderboard for one tier: headline figures, then a
 * searchable table. Ranks follow the tier's full order, so a search never
 * renumbers them. Tier, search and sort live in the URL.
 */
export function FrontierMathView({
  data,
  summary,
  search,
  onSearchChange,
}: {
  data: FrontierMathPageData;
  summary?: ReactNode;
  search: FrontierMathSearch;
  onSearchChange: (search: FrontierMathSearch) => void;
}) {
  const { t, lang } = useI18n();
  const copy = t.frontierMath;
  const colon = lang === "fr" ? " : " : ": ";
  const tier: FrontierMathTier = search.tier ?? DEFAULT_FRONTIERMATH_TIER;
  const sort = search.sort ?? "score";
  const allRows = data.tiers[tier];

  const [query, setQuery] = useUrlQuery(search, onSearchChange, parseFrontierMathSearch);
  const update = (patch: Partial<Record<keyof FrontierMathSearch, string | undefined>>) =>
    onSearchChange(parseFrontierMathSearch({ ...search, ...patch }));

  const ranks = useMemo(() => new Map(allRows.map((row, index) => [row, index + 1])), [allRows]);
  const rows = useMemo(
    () => selectFrontierMathRows(allRows, { query: search.q ?? "", sort, searchText: (row) => data.catalog[row.id]?.name ?? "" }),
    [allRows, search.q, sort, data.catalog],
  );

  const source = { href: FRONTIERMATH_SOURCE_URL, label: copy.viewOnSource };
  const tierControl = (
    <SegmentedControl
      value={tier}
      onChange={(value) => update({ tier: value })}
      label={copy.tierLabel}
      options={[
        { value: "tiers_1_3", label: copy.tiers.tiers_1_3 },
        { value: "tier_4", label: copy.tiers.tier_4 },
      ]}
    />
  );

  if (allRows.length === 0) {
    return (
      <div className="space-y-6">
        <BenchmarkHeader icon={Brain} title={copy.title} description={copy.description} source={source} />
        {data.tiers.tiers_1_3.length + data.tiers.tier_4.length > 0 && tierControl}
        <p role="status" className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{copy.empty}</p>
      </div>
    );
  }

  const top = allRows[0];
  const newest = allRows.reduce<FrontierMathRow | null>((best, row) => {
    const time = row.release_date ? Date.parse(row.release_date) : Number.NaN;
    if (Number.isNaN(time)) return best;
    return best === null || time > Date.parse(best.release_date!) ? row : best;
  }, null);
  const leaders = allRows.filter((row) => row.score === top.score).length;
  const name = (row: FrontierMathRow) => data.catalog[row.id]?.name ?? row.name;

  return (
    <div className="flex flex-col gap-6">
      <BenchmarkHeader icon={Brain} title={copy.title} description={copy.description} source={source} summary={summary} />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">{copy.tierLabel}</span>
        {tierControl}
        <p className="max-w-3xl text-xs leading-5 text-muted-foreground">{copy.tierHint[tier]}</p>
      </div>

      <StatTiles
        tiles={[
          { key: "models", label: copy.stats.runs, value: formatNumber(allRows.length, lang, 0), hint: copy.stats.runsHint },
          {
            key: "best",
            label: copy.stats.best,
            value: formatPercent(top.score, lang),
            detail: leaders > 1 ? copy.stats.tied(name(top), leaders - 1) : name(top),
            hint: copy.scoreHint,
          },
          {
            key: "newest",
            label: copy.stats.newest,
            value: newest ? name(newest) : "—",
            detail: newest ? `${formatDate(newest.release_date, lang)} · ${formatPercent(newest.score, lang)}` : undefined,
          },
          { key: "version", label: copy.stats.version, value: "v2", detail: copy.stats.versionDetail },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField value={query} onChange={setQuery} placeholder={copy.search} clearLabel={t.compare.clear} className="flex-1" />
        <SegmentedControl
          value={sort}
          onChange={(value) => update({ sort: value })}
          label={copy.sortBy}
          options={[
            { value: "score", label: copy.headers.score },
            { value: "release", label: copy.headers.release },
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
                  <ModelProviderIcon provider={getModelLogoKey(data.catalog[row.id]?.slug ?? row.model, data.catalog[row.id]?.creatorSlug ?? "")} iconUrl={data.catalog[row.id]?.iconUrl} size={28} />
                  <div className="min-w-0 flex-1">
                    <ModelName row={row} info={data.catalog[row.id]} />
                    <p className="mt-0.5 text-xs text-muted-foreground">{data.catalog[row.id]?.creatorName ?? row.organization ?? "—"}</p>
                  </div>
                  <ScoreBar value={row.score} label={formatPercent(row.score, lang)} interval={interval(row)} className="w-20" />
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                  <span>{copy.headers.release}{colon}<span className="font-medium tabular-nums text-foreground">{formatDate(row.release_date, lang)}</span></span>
                  <span>{copy.headers.stderr}{colon}<span className="font-medium tabular-nums text-foreground">{stderrLabel(row, lang)}</span></span>
                </p>
              </li>
            ))}
          </ol>

          <div className="hidden overflow-clip rounded-xl border bg-card lg:block">
            <table className="w-full text-sm">
              <caption className="sr-only">{`${copy.title} · ${copy.tiers[tier]}`}</caption>
              <thead className="model-table-head">
                <tr>
                  <th scope="col" className="w-12 px-4 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                  <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">{copy.headers.model}</th>
                  <th scope="col" aria-sort={sort === "score" ? "descending" : undefined} className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{copy.headers.score}</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{copy.headers.stderr}</th>
                  <th scope="col" aria-sort={sort === "release" ? "descending" : undefined} className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{copy.headers.release}</th>
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
                        <ModelProviderIcon provider={getModelLogoKey(data.catalog[row.id]?.slug ?? row.model, data.catalog[row.id]?.creatorSlug ?? "")} iconUrl={data.catalog[row.id]?.iconUrl} size={28} />
                        <div className="min-w-0">
                          <ModelName row={row} info={data.catalog[row.id]} />
                          <p className="truncate text-xs text-muted-foreground">{data.catalog[row.id]?.creatorName ?? row.organization ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className={cn("px-3 py-3 text-right", sort !== "score" && "text-muted-foreground")}>
                      <ScoreBar value={row.score} label={formatPercent(row.score, lang)} interval={interval(row)} className="ml-auto w-24" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">{stderrLabel(row, lang)}</td>
                    <td className={cn("whitespace-nowrap px-3 py-3 text-right tabular-nums", sort === "release" ? "font-semibold" : "text-muted-foreground")}>
                      {formatDate(row.release_date, lang)}
                    </td>
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
      <p className="text-xs text-muted-foreground">{copy.sourceNote}</p>
    </div>
  );
}

/** 95% interval from Epoch's standard error, when it publishes one. */
function interval(row: FrontierMathRow): { low: number; high: number } | null {
  if (row.stderr === null || row.stderr === 0) return null;
  return { low: Math.max(0, row.score - 1.96 * row.stderr), high: Math.min(1, row.score + 1.96 * row.stderr) };
}

function stderrLabel(row: FrontierMathRow, lang: "en" | "fr"): string {
  return row.stderr === null ? "—" : `± ${formatPercent(row.stderr, lang)}`;
}

function ModelName({ row, info }: { row: FrontierMathRow; info: FrontierMathModelInfo | undefined }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {info ? (
        <Link href={`/models/${encodeURIComponent(info.slug)}`} className="truncate rounded-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {row.group ?? row.name}
        </Link>
      ) : (
        <span className="truncate font-medium" title={row.id}>{row.group ?? row.name}</span>
      )}
      {row.effort && <Badge variant="secondary" className="font-mono text-[10px] uppercase">{row.effort}</Badge>}
    </span>
  );
}
