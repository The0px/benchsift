import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";

const API_CATALOG_PATH = "/.well-known/api-catalog";
const OPENAPI_PATH = "/.well-known/openapi.json";
const AGENT_SKILLS_INDEX_PATH = "/.well-known/agent-skills/index.json";
const MCP_SERVER_CARD_PATH = "/.well-known/mcp/server-card.json";
const API_DOCS_PATH = "/docs/api";
const AUTH_MD_PATH = "/auth.md";
export const LLMS_TXT_PATH = "/llms.txt";
export const LLMS_FULL_TXT_PATH = "/llms-full.txt";

/** The site's main pages, as agents and language models are told about them. */
export const SITE_PAGES: ReadonlyArray<{ path: string; title: string; description: string }> = [
  { path: "/", title: "AI model ranking", description: "Every catalogue model ranked by the Artificial Analysis Intelligence Index, with price, output speed, latency and context window." },
  { path: "/models", title: "All models", description: "Directory of the indexed model pages, grouped by creator." },
  { path: "/compare", title: "Compare models", description: "Up to four models side by side: benchmarks, prices, speed, latency, context window and capabilities." },
  { path: "/agents/coding", title: "Coding agents", description: "Artificial Analysis Coding Agent Index: agent and model configurations by score, cost and time per task." },
  { path: "/benchmarks/deepswe", title: "DeepSWE", description: "Datacurve's long software engineering tasks with program-based verifiers: pass@1, cost and duration per task." },
  { path: "/benchmarks/frontiercode", title: "FrontierCode", description: "Agentic coding in real open-source repositories, scored on whether a maintainer would accept the change." },
  { path: "/benchmarks/frontiermath", title: "FrontierMath", description: "Epoch AI's unpublished, research-level mathematics problems: FrontierMath v2 scores for Tiers 1–3 and Tier 4, with standard errors." },
  { path: "/benchmarks/cursorbench", title: "CursorBench", description: "Cursor's ambiguous, multi-file coding tasks from real Cursor sessions: score, cost, tokens and agent steps per task." },
  { path: "/benchmarks/aa-3d", title: "AA-3D", description: "Interactive three.js scenes ranked by an Elo from blind human votes, with cost per scene." },
  { path: "/benchmarks/decision-index", title: "Decision Index", description: "Decision models and language models on document reading, consistency, tool calling, knowledge and reasoning." },
  { path: "/benchmarks/cyber", title: "Cyber Index", description: "Cybersecurity tasks: successes, safety blocks, failures and cost per task, with trusted-access models marked." },
  { path: "/benchmarks/robotics", title: "AA-Robotics", description: "Language models driving a robot arm on tabletop tasks, compared with a human baseline." },
  { path: "/benchmarks/personality", title: "AA-PersonalityBench", description: "30 personality traits rated with an Elo per model; an Elo measures how strongly a trait shows, not quality." },
  { path: "/about", title: "About and data sources", description: "Where the data comes from and how BenchSift relates to Artificial Analysis." },
];

interface LinkHeaderItem {
  path: string;
  rel: string;
  type: string;
  title?: string;
}

const discoveryLinks: LinkHeaderItem[] = [
  {
    path: LLMS_TXT_PATH,
    rel: "describedby",
    type: "text/markdown",
    title: "BenchSift for language models",
  },
  {
    path: API_CATALOG_PATH,
    rel: "api-catalog",
    type: "application/linkset+json",
    title: "BenchSift API catalog",
  },
  {
    path: OPENAPI_PATH,
    rel: "service-desc",
    type: "application/openapi+json",
    title: "BenchSift OpenAPI description",
  },
  {
    path: API_DOCS_PATH,
    rel: "service-doc",
    type: "text/markdown",
    title: "BenchSift API documentation",
  },
  {
    path: AGENT_SKILLS_INDEX_PATH,
    rel: "service-desc",
    type: "application/json",
    title: "BenchSift agent skills index",
  },
  {
    path: MCP_SERVER_CARD_PATH,
    rel: "service-desc",
    type: "application/json",
    title: "BenchSift MCP server card",
  },
  {
    path: AUTH_MD_PATH,
    rel: "service-doc",
    type: "text/markdown",
    title: "BenchSift agent authentication notes",
  },
];

function quoteHeaderValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function agentDiscoveryLinkHeader(): string {
  return discoveryLinks
    .map((link) => {
      const params = [
        `rel="${quoteHeaderValue(link.rel)}"`,
        `type="${quoteHeaderValue(link.type)}"`,
      ];
      if (link.title) params.push(`title="${quoteHeaderValue(link.title)}"`);
      return `<${link.path}>; ${params.join("; ")}`;
    })
    .join(", ");
}

export function apiCatalogLinkset() {
  return {
    linkset: [
      {
        anchor: absoluteUrl("/"),
        "api-catalog": [
          {
            href: absoluteUrl(API_CATALOG_PATH),
            type: "application/linkset+json",
          },
        ],
        "service-desc": [
          {
            href: absoluteUrl(OPENAPI_PATH),
            type: "application/openapi+json",
            title: "OpenAPI description",
          },
        ],
        "service-doc": [
          {
            href: absoluteUrl(API_DOCS_PATH),
            type: "text/markdown",
            title: "API documentation",
          },
          {
            href: absoluteUrl(AUTH_MD_PATH),
            type: "text/markdown",
            title: "Agent authentication notes",
          },
        ],
        status: [
          {
            href: absoluteUrl("/health"),
            type: "application/json",
            title: "Service health",
          },
        ],
      },
    ],
  };
}

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: `${SITE_NAME} operational API`,
      version: "0.1.0",
      description:
        "Operational endpoints exposed by BenchSift. The public website is browsable without API authentication; cron endpoints are private deployment operations.",
    },
    servers: [{ url: SITE_URL }],
    paths: {
      "/health": {
        get: {
          operationId: "getHealth",
          summary: "Check service health",
          responses: {
            "200": {
              description:
                "The service is live. Catalog status can be healthy or degraded.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", const: true },
                      status: {
                        type: "string",
                        enum: ["healthy", "degraded"],
                      },
                      service: { type: "string", const: "benchsift" },
                      observedAt: { type: "string", format: "date-time" },
                      catalog: {
                        type: "object",
                        properties: {
                          status: {
                            type: "string",
                            enum: ["ready", "stale", "unavailable"],
                          },
                          models: { type: "integer", minimum: 0 },
                          refreshedAt: {
                            type: ["string", "null"],
                            format: "date-time",
                          },
                          ageSeconds: {
                            type: ["integer", "null"],
                            minimum: 0,
                          },
                        },
                        required: ["status", "models", "refreshedAt", "ageSeconds"],
                      },
                    },
                    required: ["ok", "status", "service", "observedAt", "catalog"],
                  },
                },
              },
            },
          },
        },
      },
      "/api/cron/status": {
        get: {
          operationId: "getCronCacheStatus",
          summary: "Read the private model-cache refresh status",
          security: [{ cronBearer: [] }],
          responses: {
            "200": { description: "Cache status." },
            "401": { description: "Missing or invalid CRON_SECRET bearer token." },
          },
        },
      },
      "/api/cron/refresh": {
        post: {
          operationId: "refreshModelCache",
          summary: "Trigger a private model-cache refresh",
          security: [{ cronBearer: [] }],
          responses: {
            "200": { description: "Refresh completed." },
            "401": { description: "Missing or invalid CRON_SECRET bearer token." },
            "405": { description: "Method not allowed." },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        cronBearer: {
          type: "http",
          scheme: "bearer",
          description:
            "Private deployment secret configured as CRON_SECRET. This is not an OAuth token and is not issued to third-party agents.",
        },
      },
    },
  };
}

export function mcpServerCard() {
  return {
    serverInfo: {
      name: SITE_NAME,
      version: "0.1.0",
    },
    description:
      "BenchSift exposes browser-side WebMCP tools for model discovery and navigation. It does not currently expose a remote MCP protocol endpoint.",
    transport: {
      type: "webmcp",
      endpoint: absoluteUrl("/"),
    },
    capabilities: {
      tools: [
        {
          name: "search_visible_models",
          description:
            "Search model links currently visible on the BenchSift page and return matching URLs.",
        },
        {
          name: "open_benchsift_page",
          description:
            "Navigate to a primary BenchSift page for model discovery, comparison, or coding benchmarks.",
        },
      ],
      resources: [
        {
          name: "api-catalog",
          url: absoluteUrl(API_CATALOG_PATH),
        },
        {
          name: "agent-skills",
          url: absoluteUrl(AGENT_SKILLS_INDEX_PATH),
        },
      ],
    },
  };
}

export const apiDocsMarkdown = `# ${SITE_NAME} API

${DEFAULT_DESCRIPTION}

## Discovery

- For language models: ${absoluteUrl(LLMS_TXT_PATH)} and ${absoluteUrl(LLMS_FULL_TXT_PATH)}
- API catalog: ${absoluteUrl(API_CATALOG_PATH)}
- OpenAPI description: ${absoluteUrl(OPENAPI_PATH)}
- Agent skills index: ${absoluteUrl(AGENT_SKILLS_INDEX_PATH)}
- MCP server card: ${absoluteUrl(MCP_SERVER_CARD_PATH)}
- Authentication notes: ${absoluteUrl(AUTH_MD_PATH)}

## Public endpoints

### GET /health

Returns service health:

\`\`\`json
{
  "ok": true,
  "status": "healthy",
  "catalog": {
    "status": "ready",
    "models": 1024,
    "refreshedAt": "2026-07-24T08:00:00.000Z",
    "ageSeconds": 3600
  }
}
\`\`\`

The endpoint remains a liveness probe with HTTP 200. A stale or unavailable
catalog is reported as \`status: "degraded"\` without exposing private cache
paths, credentials, or internal error messages.

## Private operational endpoints

The cron endpoints are for the deployment operator only. They require:

\`\`\`http
Authorization: Bearer <CRON_SECRET>
\`\`\`

These endpoints are not part of a public OAuth/OIDC flow and should not be used by third-party agents.

- \`GET /api/cron/status\` reads the persisted model-cache status.
- \`POST /api/cron/refresh\` refreshes cached model data.
`;

export const authMarkdown = `# ${SITE_NAME} agent authentication

BenchSift's public pages, benchmark pages, API catalog, OpenAPI description, and agent skill documents are available without authentication.

BenchSift does not currently offer public agent registration, OAuth/OIDC login, dynamic client registration, or third-party API tokens.

The \`/api/cron/*\` endpoints are private deployment operations protected by a non-delegable \`CRON_SECRET\` bearer token. They are intended only for the site operator and are not available to external agents.
`;

export const homepageMarkdown = `# ${SITE_NAME}

${DEFAULT_DESCRIPTION}

BenchSift helps compare AI models by intelligence, coding, math, speed, latency, context windows, pricing, and modality support.

## Main pages

${SITE_PAGES.map((page) => `- ${page.title}: ${absoluteUrl(page.path)}`).join("\n")}
- Creator profiles: ${absoluteUrl("/creators/{slug}")} (for example ${absoluteUrl("/creators/google")})

## Agent discovery

- API catalog: ${absoluteUrl(API_CATALOG_PATH)}
- OpenAPI description: ${absoluteUrl(OPENAPI_PATH)}
- API documentation: ${absoluteUrl(API_DOCS_PATH)}
- Agent skills index: ${absoluteUrl(AGENT_SKILLS_INDEX_PATH)}
- MCP server card: ${absoluteUrl(MCP_SERVER_CARD_PATH)}
- Authentication notes: ${absoluteUrl(AUTH_MD_PATH)}

## Authentication

Public model and benchmark pages do not require authentication. Private cron endpoints are reserved for the site operator and require \`CRON_SECRET\`.
`;

/**
 * /llms.txt, following llmstxt.org: what the site is, how its data may be
 * read, then its pages in both languages.
 */
export const llmsTxt = `# ${SITE_NAME}

> Independent, evidence-first catalogue for finding and comparing AI models, in English and French. It combines Artificial Analysis benchmarks (intelligence, coding, math, speed, latency), OpenRouter prices, capabilities and usage rankings, Models.dev specifications and Hugging Face open-weights evidence.

How to read the data:

- Every value comes from a named source and links back to it. A metric no source publishes is left empty; it is never estimated, and zero is a real measurement.
- Artificial Analysis owns model identity, benchmarks, speed, latency and its published prices; OpenRouter adds capabilities, pricing detail and models Artificial Analysis does not cover; Models.dev fills missing specifications; Hugging Face supplies open-weights evidence.
- Prices are USD per million tokens, blended 3:1 input/output unless a page says otherwise. Benchmark pages state their own unit (pass@1, Elo, index score).
- The catalogue is refreshed on a schedule and pages show the date of their data; benchmark pages keep an upstream snapshot for at most six hours.

## Pages

${SITE_PAGES.map((page) => `- [${page.title}](${absoluteUrl(page.path)}): ${page.description}`).join("\n")}
- [Model pages](${absoluteUrl("/models/{slug}")}): one page per model with its Intelligence Index rank, closest peers, benchmarks, prices, speed and capabilities.
- [Creator profiles](${absoluteUrl("/creators/{slug}")}): every model of a creator with its best scores and ranks.
- [Comparison pages](${absoluteUrl("/compare/{a}-vs-{b}")}): two models side by side, for example the most used models of the week.

## Français

Every page has a French version under /fr, for example ${absoluteUrl("/fr")}, ${absoluteUrl("/fr/models")} and ${absoluteUrl("/fr/compare")}.

## Data

- [Model list](${absoluteUrl(LLMS_FULL_TXT_PATH)}): the indexed models with their sourced key figures, in plain text.
- [Sitemap](${absoluteUrl("/sitemap.xml")}): every indexed page in both languages.
- [OpenAPI description](${absoluteUrl(OPENAPI_PATH)}) and [API documentation](${absoluteUrl(API_DOCS_PATH)}).

## Optional

- [Agent skills](${absoluteUrl(AGENT_SKILLS_INDEX_PATH)}): navigation guides for agents.
- [MCP server card](${absoluteUrl(MCP_SERVER_CARD_PATH)}).
- [Source code](https://github.com/The0px/benchsift).
`;

export function markdownTokenEstimate(markdown: string): string {
  return Math.ceil(markdown.trim().split(/\s+/).length * 1.35).toString();
}

export interface AgentSkill {
  slug: string;
  name: string;
  type: "navigation" | "information";
  description: string;
  content: string;
}

export const agentSkills: AgentSkill[] = [
  {
    slug: "search-models",
    name: "Search AI models",
    type: "navigation",
    description:
      "Find AI model pages on BenchSift by model name, provider, or visible benchmark metadata.",
    content: `# Search AI models

Use BenchSift's homepage search to find model cards by model name, provider, context, speed, pricing, or visible benchmark metadata.

Useful entrypoints:

- Homepage: ${absoluteUrl("/")}
- Compare models: ${absoluteUrl("/compare")}

Suggested agent flow:

1. Open the homepage.
2. Search for the model or provider.
3. Follow the matching \`/models/{slug}\` link for detailed pricing, speed, benchmark, and capability data.
4. Follow a creator name to its \`/creators/{slug}\` profile for all of that creator's models, best scores and ranks, prices, and open-weights models.
`,
  },
  {
    slug: "compare-models",
    name: "Compare models",
    type: "navigation",
    description:
      "Open the comparison workspace for side-by-side AI model evaluation.",
    content: `# Compare models

BenchSift exposes a comparison workspace for side-by-side model evaluation.

Entrypoint: ${absoluteUrl("/compare")}

Use this when an agent needs to compare pricing, speed, latency, context windows, and benchmark scores across multiple AI models.
`,
  },
  {
    slug: "coding-benchmarks",
    name: "Inspect coding benchmarks",
    type: "information",
    description:
      "Inspect coding-agent, DeepSWE and FrontierCode benchmark leaderboards exposed by BenchSift.",
    content: `# Inspect coding benchmarks

BenchSift exposes coding-oriented benchmark pages for agent and software-engineering model evaluation.

Entrypoints:

- Coding agents: ${absoluteUrl("/agents/coding")}
- DeepSWE: ${absoluteUrl("/benchmarks/deepswe")}
- FrontierCode: ${absoluteUrl("/benchmarks/frontiercode")}
- FrontierMath: ${absoluteUrl("/benchmarks/frontiermath")}
- CursorBench: ${absoluteUrl("/benchmarks/cursorbench")}

Use these pages when an agent needs coding-specific rankings rather than general model rankings.
`,
  },
];

export function getAgentSkill(slug: string): AgentSkill | undefined {
  return agentSkills.find((skill) => skill.slug === slug);
}
