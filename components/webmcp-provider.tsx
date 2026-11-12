"use client";

import { useEffect } from "react";

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
};

type WebMcpContext = {
  name: string;
  version: string;
  tools: WebMcpTool[];
};

declare global {
  interface Navigator {
    modelContext?: {
      provideContext: (
        context: WebMcpContext,
      ) => void | (() => void) | Promise<void | (() => void)>;
    };
  }
}

function modelLinks(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const anchors = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href^="/models/"]'),
  );

  return anchors
    .map((anchor) => ({
      title: anchor.textContent?.replace(/\s+/g, " ").trim() ?? "",
      url: new URL(anchor.getAttribute("href") ?? "", window.location.origin).href,
    }))
    .filter((item, index, items) => {
      if (!item.title || !item.url) return false;
      if (items.findIndex((candidate) => candidate.url === item.url) !== index) {
        return false;
      }
      return !normalizedQuery || item.title.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 10);
}

export function WebMcpProvider() {
  useEffect(() => {
    const modelContext = navigator.modelContext;
    if (!modelContext?.provideContext) return;

    let cleanup: void | (() => void);
    const tools: WebMcpTool[] = [
      {
        name: "search_visible_models",
        description:
          "Search model links currently visible on the BenchSift page and return matching URLs.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Model or provider text to search for.",
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
        execute: ({ query }) => ({
          results: modelLinks(typeof query === "string" ? query : ""),
        }),
      },
      {
        name: "open_creator_profile",
        description:
          "Open the BenchSift profile of an AI model creator: its models, best scores and ranks, prices, open-weights models and capabilities.",
        inputSchema: {
          type: "object",
          properties: {
            creator: {
              type: "string",
              description: "Creator slug as BenchSift lists it, for example google, openai or anthropic.",
              pattern: "^[a-z0-9][a-z0-9._-]{0,79}$",
            },
          },
          required: ["creator"],
          additionalProperties: false,
        },
        execute: ({ creator }) => {
          const slug = typeof creator === "string" ? creator.trim().toLowerCase() : "";
          if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(slug)) return { error: "invalid_creator" };
          const path = `/creators/${slug}`;
          window.location.assign(path);
          return { url: new URL(path, window.location.origin).href };
        },
      },
      {
        name: "open_benchsift_page",
        description:
          "Navigate to a primary BenchSift page for model discovery, comparison, coding benchmarks, AA-3D, the Decision Index, the Cyber Index, AA-Robotics, or AA-PersonalityBench.",
        inputSchema: {
          type: "object",
          properties: {
            page: {
              type: "string",
              enum: ["home", "compare", "coding_agents", "deepswe", "frontiercode", "aa_3d", "decision_index", "cyber", "robotics", "personality"],
            },
          },
          required: ["page"],
          additionalProperties: false,
        },
        execute: ({ page }) => {
          const paths: Record<string, string> = {
            home: "/",
            compare: "/compare",
            coding_agents: "/agents/coding",
            deepswe: "/benchmarks/deepswe",
            frontiercode: "/benchmarks/frontiercode",
            aa_3d: "/benchmarks/aa-3d",
            decision_index: "/benchmarks/decision-index",
            cyber: "/benchmarks/cyber",
            robotics: "/benchmarks/robotics",
            personality: "/benchmarks/personality",
          };
          const path = paths[typeof page === "string" ? page : ""] ?? "/";
          window.location.assign(path);
          return { url: new URL(path, window.location.origin).href };
        },
      },
    ];

    Promise.resolve(
      modelContext.provideContext({
        name: "BenchSift",
        version: "0.1.0",
        tools,
      }),
    )
      .then((result) => {
        cleanup = result;
      })
      .catch(() => {
        cleanup = undefined;
      });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return null;
}

