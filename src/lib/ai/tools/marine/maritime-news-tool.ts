import { tool as createTool } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";

export const maritimeNewsQuerySchema: JSONSchema7 = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Search topic regarding maritime security, coastal regulations, fishing policy bans, or pirate alerts",
    },
    category: {
      type: "string",
      enum: ["policy", "security", "weather_disaster", "general_maritime"],
      description: "Category of maritime news",
      default: "general_maritime",
    },
    numResults: {
      type: "number",
      description: "Number of news articles/bulletins to retrieve",
      default: 3,
    },
  },
  required: ["query"],
};

export const maritimeNewsTool = createTool({
  description:
    "Real-Time Maritime Intelligence & Geopolitical Security News Tool (Exa AI Web Search). Searches live official maritime bulletins, gazettes, and security circulars. Returns unavailable if search engine is unconfigured or unreachable.",
  inputSchema: jsonSchemaToZod(maritimeNewsQuerySchema),
  execute: async ({ query, category = "general_maritime", numResults = 3 }) => {
    return safe(async () => {
      const exaApiKey = process.env.EXA_API_KEY;
      const timestamp = new Date().toISOString();

      if (!exaApiKey) {
        return {
          source: "Exa Maritime Search API",
          dataset: "EXA_LIVE_WEB_SEARCH",
          timestamp,
          status: "unavailable" as const,
          error: "EXA_API_KEY not configured in environment; live maritime web search is unavailable.",
          query,
          category,
          results: [],
        };
      }

      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": exaApiKey,
        },
        body: JSON.stringify({
          query: `maritime news ${query}`,
          numResults,
          useAutoprompt: true,
          contents: {
            text: { maxCharacters: 500 },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Exa search API returned HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        source: "Exa Maritime Search API",
        dataset: "EXA_LIVE_WEB_SEARCH",
        timestamp,
        status: "live" as const,
        query,
        category,
        results: (data.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          publishedDate: r.publishedDate || null,
          summary: r.text ? r.text.substring(0, 300) + "..." : null,
        })),
      };
    })
      .ifFail((err) => ({
        source: "Exa Maritime Search API",
        dataset: "EXA_LIVE_WEB_SEARCH",
        timestamp: new Date().toISOString(),
        status: "error" as const,
        error: err.message,
        query,
        category,
        results: [],
      }))
      .unwrap();
  },
});
