import { createFileRoute } from "@tanstack/react-router";
import { llmsTxt, markdownTokenEstimate } from "@/lib/agent-discovery";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(llmsTxt, {
          headers: {
            "content-type": "text/markdown; charset=utf-8",
            "cache-control": "public, max-age=3600, s-maxage=3600",
            "content-signal": "search=yes, ai-input=yes, ai-train=no",
            "x-markdown-tokens": markdownTokenEstimate(llmsTxt),
          },
        }),
    },
  },
});
