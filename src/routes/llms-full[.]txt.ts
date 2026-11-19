import { createFileRoute } from "@tanstack/react-router";
import { getLLMModels, type LLMModel } from "@/lib/api";
import { markdownTokenEstimate } from "@/lib/agent-discovery";
import { readModelsCacheSummary } from "@/lib/cron-cache";
import { llmsFullTxt } from "@/lib/llms-full";

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async () => {
        const [models, summary] = await Promise.all([
          getLLMModels().catch((): LLMModel[] => []),
          readModelsCacheSummary().catch(() => null),
        ]);
        const body = llmsFullTxt(models, summary?.refreshedAtMs ? new Date(summary.refreshedAtMs).toISOString() : null);
        return new Response(body, {
          headers: {
            "content-type": "text/markdown; charset=utf-8",
            // An unavailable catalogue must not be cached as the document.
            "cache-control": models.length ? "public, max-age=3600, s-maxage=3600" : "no-store",
            "content-signal": "search=yes, ai-input=yes, ai-train=no",
            "x-markdown-tokens": markdownTokenEstimate(body),
          },
        });
      },
    },
  },
});
