import { useMemo } from "react";
import { BenchmarkDisclosure, StatTiles, type StatTile } from "@/components/benchmark-page";
import { Boxes, Brain, SlidersHorizontal, Trophy } from "@/components/icons";
import { InfoTip } from "@/components/info-tip";
import { Link } from "@/components/link";
import { RankNote } from "@/components/model-detail/detail-primitives";
import { ModelProviderIcon } from "@/components/model-provider-icon";
import { PageCat } from "@/components/pixel-art/page-cats";
import { SegmentedControl } from "@/components/segmented-control";
import { SourceLink } from "@/components/source-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  sortCreatorModels,
  type CreatorBest,
  type CreatorCount,
  type CreatorModelSort,
  type CreatorProfile,
  type CreatorSearch,
} from "@/lib/creator-profile";
import { formatDate, formatMoney, formatNumber, formatSpeed } from "@/lib/format";
import { useI18n, type Lang } from "@/lib/i18n";
import { getModelLogoKey, getProviderKey } from "@/lib/provider-map";
import type { RuneIcon } from "@/components/icons";

type Data = CreatorProfile & { updatedAt: string | null };

function bestValue(best: CreatorBest, lang: Lang): string {
  if (best.metric === "speed") return formatSpeed(best.value, lang);
  if (best.metric === "price") return formatMoney(best.value, lang);
  return formatNumber(best.value, lang);
}

function Section({ icon: Icon, title, hint, children, contentClassName }: {
  icon: RuneIcon;
  title: string;
  hint?: string;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2>{title}</h2>
        </CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

/** Labelled counts as a wrapping row of chips. */
function Counts({ title, counts, label }: { title: string; counts: CreatorCount[]; label: (key: string) => string }) {
  if (!counts.length) return null;
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {counts.map(({ key, count }) => (
          <li key={key}>
            <Badge variant="secondary" className="gap-1.5 font-normal">
              {label(key)}
              <span className="font-mono tabular-nums text-muted-foreground">{count}</span>
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CountRow({ label, count, total }: { label: string; count: number | null; total: number }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{count == null ? t.creator.stats.noValue : t.creator.countOf(count, total)}</span>
    </div>
  );
}

export function CreatorProfileView({
  data,
  search,
  onSearchChange,
}: {
  data: Data;
  search: CreatorSearch;
  onSearchChange: (next: CreatorSearch) => void;
}) {
  const { t, lang } = useI18n();
  const sort: CreatorModelSort = search.sort ?? "score";
  const models = useMemo(() => sortCreatorModels(data.models, sort), [data.models, sort]);
  const otherSlugs = data.sourceSlugs.filter((slug) => slug !== data.slug);
  const providerKey = getProviderKey(data.slug);
  const category = (key: string) => t.creator.categories[key as keyof typeof t.creator.categories] ?? key;
  const modality = (key: string) => t.creator.modalityLabels[key] ?? key;

  const tiles: StatTile[] = [
    {
      key: "models",
      label: t.creator.stats.models,
      value: formatNumber(data.modelCount, lang, 0),
      detail: data.variantCount !== data.modelCount ? t.creator.stats.modelsDetail(data.variantCount) : undefined,
    },
    {
      key: "open",
      label: t.creator.stats.openWeights,
      value: formatNumber(data.capabilities.openWeights, lang, 0),
      detail: t.creator.stats.openWeightsDetail(data.capabilities.openWeights, data.modelCount),
      hint: t.glossary.openWeights,
    },
    {
      key: "latest",
      label: t.creator.stats.latest,
      value: data.latestRelease ? formatDate(data.latestRelease.date, lang) : t.creator.stats.noValue,
      detail: data.latestRelease
        ? [data.latestRelease.name, data.firstRelease && data.firstRelease.date !== data.latestRelease.date ? t.creator.stats.first(formatDate(data.firstRelease.date, lang)) : null].filter(Boolean).join(" · ")
        : undefined,
    },
    {
      key: "price",
      label: t.creator.stats.medianPrice,
      value: data.pricing ? formatMoney(data.pricing.median, lang) : t.creator.stats.noValue,
      detail: data.pricing ? t.creator.stats.priceDetail(formatMoney(data.pricing.min, lang), formatMoney(data.pricing.max, lang), data.pricing.measured) : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="relative mt-3 flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <PageCat kind="detail" className="absolute bottom-[calc(100%+1px)] right-8 sm:right-12" />
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border bg-muted">
            <ModelProviderIcon provider={providerKey} size={44} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t.creator.eyebrow}</p>
            <h1 className="mt-0.5 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{data.name}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{t.creator.description(data.name)}</p>
            {(data.huggingFace?.organizations.length || otherSlugs.length > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {data.huggingFace?.organizations.map((organization) => (
                  <SourceLink key={organization.id} href={organization.url} label={`${t.card.huggingface} · ${organization.id}`} />
                ))}
                {otherSlugs.length > 0 && (
                  <span className="text-xs text-muted-foreground">{t.creator.alsoListedAs(otherSlugs.join(", "))}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="touch-target shrink-0 self-start">
          <Link href={`/?provider=${encodeURIComponent(data.slug)}`}>
            <SlidersHorizontal data-icon="inline-start" />
            {t.creator.exploreCatalog}
          </Link>
        </Button>
      </header>

      <StatTiles tiles={tiles} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={Trophy} title={t.creator.bestTitle} hint={t.creator.bestHint} contentClassName="divide-y">
          {data.best.length === 0 && <p className="py-2 text-sm text-muted-foreground">{t.creator.stats.noValue}</p>}
          {data.best.map((best) => (
            <div key={best.metric} className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-muted-foreground">{t.creator.metrics[best.metric]}</p>
                <Link
                  href={`/models/${best.slug}`}
                  className="block truncate rounded-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={best.name}
                >
                  {best.name}
                </Link>
              </div>
              <span className="flex shrink-0 flex-col items-end text-right">
                <span className="font-medium tabular-nums">{bestValue(best, lang)}</span>
                <RankNote rank={best.rank} />
              </span>
            </div>
          ))}
          {data.openRouterRank && (
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm last:pb-0">
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-muted-foreground">
                  {t.creator.openRouterRank}
                  <InfoTip label={`${t.glossary.infoLabel} · ${t.creator.openRouterRank}`} content={t.creator.openRouterRankHint} />
                </p>
                <Link
                  href={`/models/${data.openRouterRank.slug}`}
                  className="block truncate rounded-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={data.openRouterRank.name}
                >
                  {data.openRouterRank.name}
                </Link>
              </div>
              <span className="shrink-0 font-medium tabular-nums">#{data.openRouterRank.rank}</span>
            </div>
          )}
        </Section>

        <Section icon={Brain} title={t.creator.capabilitiesTitle} hint={t.creator.capabilitiesHint}>
          <div className="divide-y">
            <CountRow label={t.creator.capabilities.reasoning} count={data.capabilities.reasoning} total={data.modelCount} />
            <CountRow label={t.creator.capabilities.openWeights} count={data.capabilities.openWeights} total={data.modelCount} />
            <CountRow label={t.creator.capabilities.toolCalling} count={data.capabilities.toolCalling} total={data.modelCount} />
            <CountRow label={t.creator.capabilities.structuredOutputs} count={data.capabilities.structuredOutputs} total={data.modelCount} />
          </div>
          <div className="mt-3 divide-y border-t pt-3">
            <Counts title={t.creator.capabilities.input} counts={data.capabilities.input} label={modality} />
            <Counts title={t.creator.capabilities.output} counts={data.capabilities.output} label={modality} />
          </div>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={Boxes} title={t.creator.overviewTitle} contentClassName="divide-y">
          <Counts title={t.creator.categoriesTitle} counts={data.categories} label={category} />
          <Counts title={t.creator.releasesTitle} counts={data.releasesByYear} label={(key) => key} />
        </Section>
        {data.huggingFace && (
          <Section icon={Boxes} title={t.creator.huggingFaceTitle} hint={t.creator.huggingFaceHint} contentClassName="divide-y">
            <div className="py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-medium">{t.creator.repositories(data.huggingFace.repositories)}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {data.huggingFace.organizations.map((organization) => (
                  <li key={organization.id}>
                    <SourceLink href={organization.url} label={`${organization.id} · ${organization.repositories}`} />
                  </li>
                ))}
              </ul>
            </div>
            <Counts title={t.creator.licenses} counts={data.huggingFace.licenses} label={(key) => key} />
          </Section>
        )}
      </div>

      <section aria-labelledby="creator-models" className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="creator-models" className="text-base font-semibold">{t.creator.modelsTitle}</h2>
              <Badge variant="secondary" className="font-mono tabular-nums">{data.modelCount}</Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t.creator.modelsHint}</p>
          </div>
          <SegmentedControl
            value={sort}
            onChange={(next) => onSearchChange(next === "score" ? {} : { sort: next })}
            options={[
              { value: "score", label: t.creator.sort.score },
              { value: "recent", label: t.creator.sort.recent },
            ]}
            label={t.creator.sortLabel}
            className="shrink-0 self-start sm:self-auto"
          />
        </div>
        <div aria-hidden="true" className="hidden grid-cols-[2rem_minmax(0,1fr)_6rem_7rem_5.5rem_6rem] gap-x-3 border-b bg-muted/30 px-6 py-2 text-xs font-medium text-muted-foreground md:grid">
          <span />
          <span>{t.creator.headers.model}</span>
          <span>{t.creator.headers.released}</span>
          <span className="text-right">{t.creator.headers.intelligence}</span>
          <span className="text-right">{t.creator.headers.price}</span>
          <span className="text-right">{t.creator.headers.speed}</span>
        </div>
        <ul className="divide-y">
          {models.map((model) => {
            const released = model.releaseDate ? formatDate(model.releaseDate, lang) : null;
            const tags = [
              category(model.category),
              model.reasoning ? t.detail.reasoning : null,
              model.openWeights ? t.card.openWeightsBadge : null,
              model.variants > 1 ? t.creator.configurations(model.variants) : null,
            ].filter(Boolean).join(" · ");
            return (
              <li key={model.slug} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[2rem_minmax(0,1fr)_6rem_7rem_5.5rem_6rem] md:px-6">
                <ModelProviderIcon provider={getModelLogoKey(model.slug, model.creatorSlug)} iconUrl={model.providerIconUrl} size={28} />
                <div className="min-w-0">
                  <Link
                    href={`/models/${model.slug}`}
                    className="block truncate rounded-sm text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={model.name}
                  >
                    {model.name}
                  </Link>
                  <p className="text-xs leading-5 text-muted-foreground md:truncate">
                    {tags}
                    {/* Phones hide the extra columns, so their measured values join this line. */}
                    {[released, model.price == null ? null : formatMoney(model.price, lang), model.speed == null ? null : formatSpeed(model.speed, lang)]
                      .filter(Boolean)
                      .map((value) => <span key={value} className="md:hidden"> · {value}</span>)}
                  </p>
                </div>
                <span className="hidden text-sm tabular-nums text-muted-foreground md:block">
                  {model.releaseDate ? <time dateTime={model.releaseDate}>{released}</time> : "—"}
                </span>
                <span className="flex flex-col items-end text-right">
                  <span className="text-sm font-semibold tabular-nums">{formatNumber(model.intelligence, lang)}</span>
                  {model.intelligenceRank && (
                    <span className="text-[11px] tabular-nums text-muted-foreground" title={t.detail.rankHint}>
                      {t.creator.globalRank(model.intelligenceRank.rank, model.intelligenceRank.total)}
                    </span>
                  )}
                </span>
                <span className="hidden text-right text-sm tabular-nums text-muted-foreground md:block">{formatMoney(model.price, lang)}</span>
                <span className="hidden text-right text-sm tabular-nums text-muted-foreground md:block">{formatSpeed(model.speed, lang)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <BenchmarkDisclosure title={t.creator.methodTitle}>
        <p>{t.creator.methodBody}</p>
        <p className="mt-2">{t.creator.sourceNote}</p>
        {data.updatedAt && <p className="mt-2">{t.summary.updated(formatDate(data.updatedAt, lang))}</p>}
      </BenchmarkDisclosure>
    </div>
  );
}
