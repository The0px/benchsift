import { useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchPersonalityData } from "@/lib/server-fns";
import { parsePersonalitySearch, type PersonalitySearch } from "@/lib/aa-personality-data";
import { PersonalityView } from "@/components/personality/personality-view";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { benchmarkHead, ARTIFICIAL_ANALYSIS } from "@/lib/route-seo";

export const Route = createFileRoute("/benchmarks/personality")({
  validateSearch: parsePersonalitySearch,
  // The selected trait lives in the URL; changing it must not refetch the results.
  shouldReload: ({ cause }) => cause !== "stay",
  head: ({ match }) =>
    benchmarkHead({
      lang: match.context.lang,
      key: "personality",
      path: "/benchmarks/personality",
      name: "AA-PersonalityBench",
      // A trait Elo ranks prominence, not quality, so the page has no leader to summarise.
      summary: null,
      creator: ARTIFICIAL_ANALYSIS,
      sourceUrl: "https://artificialanalysis.ai/evaluations/aa-personalitybench",
      measured: ["Personality trait Elo"],
    }),
  loader: async () => fetchPersonalityData(),
  component: PersonalityPage,
});

function PersonalityPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const updateSearch = useCallback(
    (next: PersonalitySearch) => void navigate({ search: next, replace: true, resetScroll: false }),
    [navigate],
  );
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <PersonalityView data={data} search={search} onSearchChange={updateSearch} />
      </main>
      <SiteFooter />
    </div>
  );
}
