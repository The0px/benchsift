import { createFileRoute } from "@tanstack/react-router";
import { localizedUrl } from "@/lib/seo";
import { LOCALES } from "@/lib/locale";
import { readModelsCacheSummary } from "@/lib/cron-cache";
import { getLLMModels, type LLMModel } from "@/lib/api";
import { creatorProfileIndex } from "@/lib/creator-profile";
import { getIndexableCatalogModels } from "@/lib/model-catalog";

interface SitemapEntry {
  /** Unprefixed page path; each language gets its own <url>. */
  path: string;
  changeFrequency: string;
  lastModified?: string;
  priority: number;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}

/** Day of the last successful catalogue refresh, the date its pages' data changed. */
async function catalogueDate(): Promise<string | undefined> {
  const summary = await readModelsCacheSummary().catch(() => null);
  return summary?.refreshedAtMs ? new Date(summary.refreshedAtMs).toISOString().slice(0, 10) : undefined;
}

/** Profiles of the creators with at least one indexed model page, the hubs that lead to them. */
function creatorPaths(models: LLMModel[]): string[] {
  return creatorProfileIndex(models).filter((creator) => creator.indexable).map((creator) => `/creators/${creator.slug}`);
}

/** The indexed model pages: the ones the /models catalogue lists, one variant per family. */
function modelPaths(models: LLMModel[]): string[] {
  return getIndexableCatalogModels(models).map((model) => `/models/${encodeURIComponent(model.slug)}`);
}

/** Each version lists every language version, itself included, and the x-default. */
function alternates(path: string): string {
  return [
    ...LOCALES.map((locale) => `\n    <xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(localizedUrl(path, locale))}"/>`),
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(localizedUrl(path, "en"))}"/>`,
  ].join("");
}

function renderSitemap(entries: SitemapEntry[]): string {
  const urls = entries
    .flatMap((e) => LOCALES.map((locale) =>
      `  <url>\n    <loc>${escapeXml(localizedUrl(e.path, locale))}</loc>${alternates(e.path)}${e.lastModified ? `\n    <lastmod>${e.lastModified}</lastmod>` : ""}\n    <changefreq>${e.changeFrequency}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
    ))
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [updated, models] = await Promise.all([catalogueDate(), getLLMModels().catch((): LLMModel[] => [])]);
        // Catalogue pages carry the refresh date. Pages fed by separate live
        // sources or static text have no tracked date, so they omit lastmod
        // rather than claim today.
        const catalogue = (path: string, priority: number, changeFrequency = "daily"): SitemapEntry => ({
          path,
          lastModified: updated,
          changeFrequency,
          priority,
        });
        const live = (path: string): SitemapEntry => ({ path, changeFrequency: "daily", priority: 0.8 });

        // Pillar pages, creator profiles and the indexed model pages, which
        // open on a summary written from their own measurements. Comparison
        // pairs and legal pages stay crawlable through internal links but are
        // left out, so the crawl budget goes to the pages that lead to them.
        const entries: SitemapEntry[] = [
          catalogue("/", 1),
          catalogue("/models", 0.9),
          { path: "/compare", changeFrequency: "monthly", priority: 0.8 },
          { path: "/about", changeFrequency: "monthly", priority: 0.6 },
          live("/agents/coding"),
          live("/benchmarks/deepswe"),
          live("/benchmarks/frontiercode"),
          live("/benchmarks/frontiermath"),
          live("/benchmarks/cursorbench"),
          live("/benchmarks/aa-3d"),
          live("/benchmarks/decision-index"),
          catalogue("/benchmarks/cyber", 0.8),
          live("/benchmarks/robotics"),
          live("/benchmarks/personality"),
          ...creatorPaths(models).map((path) => catalogue(path, 0.7)),
          ...modelPaths(models).map((path) => catalogue(path, 0.6)),
        ];

        return new Response(renderSitemap(entries), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
