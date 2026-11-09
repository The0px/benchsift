import { useMemo, useState } from "react";
import { AudioLines } from "@/components/icons";
import { BenchmarkDisclosure, BenchmarkHeader, ScoreBar, StatTiles } from "@/components/benchmark-page";
import { CatalogSelect } from "@/components/catalog-select";
import { CreatorMark } from "@/components/creator-mark";
import { Link } from "@/components/link";
import { ModelProviderIcon } from "@/components/model-provider-icon";
import { SearchField } from "@/components/search-field";
import { Badge } from "@/components/ui/badge";
import {
  personalityElo,
  rankPersonalityRows,
  type PersonalityData,
  type PersonalityRow,
  type PersonalitySearch,
} from "@/lib/aa-personality-data";
import { personalityIndexText, personalityTraitText } from "@/lib/aa-personality-fr";
import type { FrontierCodeModelInfo } from "@/lib/frontiercode-catalog";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { getModelLogoKey, resolveCreatorFromModelSlug } from "@/lib/provider-map";

const SOURCE_URL = "https://artificialanalysis.ai/evaluations/aa-personalitybench";

/**
 * AA-PersonalityBench from Artificial Analysis: one trait at a time, ranked
 * from the model showing it most to the one showing it least. Ranks follow
 * every model rated on the trait, so the search never renumbers them.
 */
export function PersonalityView({
  data,
  search,
  onSearchChange,
}: {
  data: PersonalityData & { catalog: Record<string, FrontierCodeModelInfo> };
  search: PersonalitySearch;
  onSearchChange: (next: PersonalitySearch) => void;
}) {
  const { t, lang } = useI18n();
  const copy = t.personality;
  const [query, setQuery] = useState("");

  const trait = data.traits.find((entry) => entry.id === search.trait) ?? data.traits[0];
  const ranked = useMemo(() => (trait ? rankPersonalityRows(data.rows, trait.id) : []), [data.rows, trait]);
  const ranks = useMemo(() => new Map(ranked.map((row, index) => [row, index + 1])), [ranked]);

  const creatorOf = (row: PersonalityRow) =>
    data.catalog[row.slug]?.creatorSlug ?? resolveCreatorFromModelSlug(row.slug, row.slug.split("-")[0] ?? "");
  const creatorName = (row: PersonalityRow) => data.catalog[row.slug]?.creatorName ?? row.creator_name;

  const source = { href: SOURCE_URL, label: copy.viewOnSource };
  if (!trait || ranked.length === 0) {
    return (
      <div className="space-y-6">
        <BenchmarkHeader icon={AudioLines} title={copy.title} description={copy.description} source={source} />
        <p role="status" className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{copy.empty}</p>
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const rows = needle
    ? ranked.filter((row) => [row.name, row.slug, creatorName(row)].some((value) => value?.toLowerCase().includes(needle)))
    : ranked;

  const traitText = personalityTraitText(trait, lang);
  const index = data.indexes.find((entry) => entry.id === trait.index);
  const indexText = index ? personalityIndexText(index, lang) : null;
  const elo = (row: PersonalityRow) => personalityElo(row, trait.id)!;
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const low = elo(bottom);
  const span = elo(top) - low;
  const eloLabel = (row: PersonalityRow) => formatNumber(elo(row), lang, 0);

  const options = data.traits.map((entry) => {
    const group = data.indexes.find((candidate) => candidate.id === entry.index);
    return {
      value: entry.id,
      label: personalityTraitText(entry, lang).label,
      group: group ? personalityIndexText(group, lang).label : undefined,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <BenchmarkHeader icon={AudioLines} title={copy.title} description={copy.description} source={source} />

      <StatTiles
        tiles={[
          { key: "models", label: copy.stats.models, value: formatNumber(data.rows.length, lang, 0) },
          {
            key: "traits",
            label: copy.stats.traits,
            value: formatNumber(data.traits.length, lang, 0),
            detail: data.indexes.length ? copy.stats.traitsDetail(data.indexes.length) : undefined,
          },
          { key: "most", label: copy.stats.most, value: top.family_name, detail: `${traitText.label} · ${eloLabel(top)} Elo` },
          { key: "least", label: copy.stats.least, value: bottom.family_name, detail: `${traitText.label} · ${eloLabel(bottom)} Elo` },
        ]}
      />

      <section aria-labelledby="personality-ranking-title" className="min-w-0 rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 id="personality-ranking-title" className="text-base font-semibold">{copy.rankingTitle(traitText.label)}</h2>
            {traitText.definition && <p className="mt-1 max-w-2xl text-sm leading-6">{traitText.definition}</p>}
            {indexText && (
              <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
                {copy.indexLabel}{lang === "fr" ? " : " : ": "}
                <span className="font-medium text-foreground">{indexText.label}</span>
                {indexText.description && ` · ${indexText.description}`}
              </p>
            )}
            <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">{copy.rankingHint}</p>
          </div>
          <CatalogSelect
            value={trait.id}
            onChange={(next) => onSearchChange(next === data.traits[0].id ? {} : { trait: next })}
            options={options}
            label={copy.traitLabel}
            className="lg:w-64"
          />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField value={query} onChange={setQuery} placeholder={copy.search} clearLabel={t.compare.clear} className="flex-1" />
        <p role="status" className="shrink-0 text-xs text-muted-foreground">
          {rows.length} / {ranked.length} {copy.models}
        </p>
      </div>

      {rows.length === 0 ? (
        <p role="status" className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">{t.grid.noResults}</p>
      ) : (
        <ol aria-labelledby="personality-ranking-title" className="overflow-clip rounded-xl border bg-card">
          {rows.map((row) => {
            const info = data.catalog[row.slug];
            return (
              <li key={row.slug} className="flex items-center gap-3 border-b px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-muted/40">
                <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">#{ranks.get(row)}</span>
                <ModelProviderIcon provider={getModelLogoKey(info?.slug ?? row.slug, creatorOf(row))} iconUrl={info?.iconUrl} size={28} />
                <div className="min-w-0 flex-1">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    {info ? (
                      <Link href={`/models/${info.slug}`} className="truncate rounded-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {row.family_name}
                      </Link>
                    ) : (
                      <span className="truncate font-medium" title={row.name}>{row.family_name}</span>
                    )}
                    {row.configuration && <Badge variant="secondary" className="font-mono text-[10px] uppercase">{row.configuration}</Badge>}
                  </span>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    <CreatorMark slug={creatorName(row) ? creatorOf(row) : null} />{creatorName(row) ?? "—"}
                  </p>
                </div>
                <ScoreBar
                  value={span > 0 ? (elo(row) - low) / span : 1}
                  label={<>{eloLabel(row)} <span className="text-xs font-normal text-muted-foreground">{copy.headers.elo}</span></>}
                  className="w-24 shrink-0 sm:w-40"
                />
              </li>
            );
          })}
        </ol>
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
