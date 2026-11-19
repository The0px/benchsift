import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchCodingAgents } from "@/lib/server-fns";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CodingAgentsView } from "@/components/coding-agents/coding-agents-view";
import { DataSummary } from "@/components/data-summary";
import { codingAgentsSummary } from "@/lib/benchmark-summaries";
import { benchmarkHead, ARTIFICIAL_ANALYSIS } from "@/lib/route-seo";
import { RelatedBenchmarks } from "@/components/benchmark-page";

export const Route = createFileRoute("/agents/coding")({
  head: ({ match, loaderData }) =>
    benchmarkHead({
      lang: match.context.lang,
      key: "agentsCoding",
      path: "/agents/coding",
      name: "Coding Agents",
      summary: loaderData ? codingAgentsSummary(loaderData) : null,
      creator: ARTIFICIAL_ANALYSIS,
      sourceUrl: "https://artificialanalysis.ai/agents/coding-agents",
      measured: ["Coding Agent Index", "Cost per task (USD)", "Time per task (s)"],
    }),
  loader: async () => fetchCodingAgents(),
  component: CodingAgentsPage,
});

function CodingAgentsPage() {
  const agents = Route.useLoaderData();
  const summary = useMemo(() => codingAgentsSummary(agents), [agents]);
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <CodingAgentsView agents={agents} summary={<DataSummary data={summary} />} />
        <RelatedBenchmarks current="/agents/coding" />
      </main>
      <SiteFooter />
    </div>
  );
}
