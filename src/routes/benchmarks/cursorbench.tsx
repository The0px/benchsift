import { useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchCursorBenchData } from "@/lib/server-fns";
import { parseCursorBenchSearch, type CursorBenchSearch } from "@/lib/cursorbench-data";
import { CursorBenchView, CURSORBENCH_SOURCE_URL } from "@/components/cursorbench/cursorbench-view";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { benchmarkHead } from "@/lib/route-seo";
import { cursorBenchSummary } from "@/lib/benchmark-summaries";
import { DataSummary } from "@/components/data-summary";

export const Route = createFileRoute("/benchmarks/cursorbench")({
  validateSearch: parseCursorBenchSearch,
  // The view state lives in the URL; changing it must not refetch the leaderboard.
  shouldReload: ({ cause }) => cause !== "stay",
  head: ({ match, loaderData }) =>
    benchmarkHead({
      lang: match.context.lang,
      key: "cursorbench",
      path: "/benchmarks/cursorbench",
      name: "CursorBench",
      summary: loaderData ? cursorBenchSummary(loaderData) : null,
      creator: { name: "Cursor", url: "https://cursor.com" },
      sourceUrl: CURSORBENCH_SOURCE_URL,
      measured: ["CursorBench score", "Average cost per task", "Tokens per task", "Agent steps per task"],
    }),
  loader: async () => fetchCursorBenchData(),
  component: CursorBenchPage,
});

function CursorBenchPage() {
  const data = Route.useLoaderData();
  const summary = useMemo(() => cursorBenchSummary(data), [data]);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const updateSearch = useCallback(
    (next: CursorBenchSearch) => void navigate({ search: next, replace: true, resetScroll: false }),
    [navigate],
  );
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <CursorBenchView data={data} summary={<DataSummary data={summary} />} search={search} onSearchChange={updateSearch} />
      </main>
      <SiteFooter />
    </div>
  );
}
