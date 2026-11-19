import { useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchFrontierMathData } from "@/lib/server-fns";
import { parseFrontierMathSearch, type FrontierMathSearch } from "@/lib/frontiermath-data";
import { FrontierMathView, FRONTIERMATH_SOURCE_URL } from "@/components/frontiermath/frontiermath-view";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { benchmarkHead } from "@/lib/route-seo";
import { frontierMathSummary } from "@/lib/benchmark-summaries";
import { DataSummary } from "@/components/data-summary";
import { RelatedBenchmarks } from "@/components/benchmark-page";

export const Route = createFileRoute("/benchmarks/frontiermath")({
  validateSearch: parseFrontierMathSearch,
  // The view state lives in the URL; changing it must not refetch the leaderboard.
  shouldReload: ({ cause }) => cause !== "stay",
  head: ({ match, loaderData }) =>
    benchmarkHead({
      lang: match.context.lang,
      key: "frontiermath",
      path: "/benchmarks/frontiermath",
      name: "FrontierMath",
      summary: loaderData ? frontierMathSummary(loaderData) : null,
      creator: { name: "Epoch AI", url: "https://epoch.ai" },
      sourceUrl: FRONTIERMATH_SOURCE_URL,
      measured: ["FrontierMath Tiers 1-3 v2 score", "FrontierMath Tier 4 v2 score", "Standard error"],
    }),
  loader: async () => fetchFrontierMathData(),
  component: FrontierMathPage,
});

function FrontierMathPage() {
  const data = Route.useLoaderData();
  const summary = useMemo(() => frontierMathSummary(data), [data]);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const updateSearch = useCallback(
    (next: FrontierMathSearch) => void navigate({ search: next, replace: true, resetScroll: false }),
    [navigate],
  );
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <FrontierMathView data={data} summary={<DataSummary data={summary} />} search={search} onSearchChange={updateSearch} />
        <RelatedBenchmarks current="/benchmarks/frontiermath" />
      </main>
      <SiteFooter />
    </div>
  );
}
