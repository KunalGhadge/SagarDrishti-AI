import "server-only";

import { openai } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { xai } from "@ai-sdk/xai";
import { LanguageModelV2, openrouter } from "@openrouter/ai-sdk-provider";
import { createGroq } from "@ai-sdk/groq";
import { LanguageModel } from "ai";
import {
  createOpenAICompatibleModels,
  openaiCompatibleModelsSafeParse,
} from "./create-openai-compatiable";
import { ChatModel } from "app-types/chat";
import {
  DEFAULT_FILE_PART_MIME_TYPES,
  OPENAI_FILE_MIME_TYPES,
  GEMINI_FILE_MIME_TYPES,
  ANTHROPIC_FILE_MIME_TYPES,
  XAI_FILE_MIME_TYPES,
} from "./file-support";
import {
  keyPoolManager,
  GEMINI_CONFIGURED_NEW_MODEL,
  GEMINI_CONFIGURED_OLD_MODEL,
} from "./provider-config";
import globalLogger from "logger";
import { colorize } from "consola/utils";

const logger = globalLogger.withDefaults({
  message: colorize("magenta", `[ProviderModels]: `),
});

// ---------------------------------------------------------------------------
// 1. Multi-Key Gemini Fetch Interceptor (Zero Leakage, Seamless Failover)
// ---------------------------------------------------------------------------

const geminiFetch: typeof fetch = async (input, init) => {
  const totalKeys = keyPoolManager.getGeminiKeyCount();
  if (totalKeys === 0) {
    return fetch(input, init);
  }

  const baseHeaders = new Headers(init?.headers);
  const modelMatch = typeof input === "string" ? input.match(/models\/([^:?]+)/) : null;
  const requestedModel = modelMatch ? modelMatch[1] : undefined;

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const activeKeyInfo = keyPoolManager.getActiveGeminiKey(requestedModel);
    const activeKey = activeKeyInfo?.key;
    const maskedId = activeKeyInfo?.maskedId || `Gemini Key #${attempt + 1}`;

    const requestHeaders = new Headers(baseHeaders);
    if (activeKey) {
      requestHeaders.set("x-goog-api-key", activeKey);
    }

    let urlInput = input;
    if (typeof input === "string" && activeKey) {
      if (input.includes("key=")) {
        urlInput = input.replace(/([?&]key=)[^&]+/, `$1${activeKey}`);
      }
    }

    const response = await fetch(urlInput, {
      ...init,
      headers: requestHeaders,
    });

    // On 200 OK, record positive model access
    if (response.status === 200) {
      if (requestedModel) {
        keyPoolManager.recordModelOutcome(maskedId, requestedModel, {
          status: 200,
          message: "OK",
        });
      }
      return response;
    }

    // Detect 429 Rate Limit / Quota Exhaustion or 503 Overloaded
    if ((response.status === 429 || response.status === 503) && attempt < totalKeys - 1) {
      if (requestedModel) {
        keyPoolManager.recordModelOutcome(maskedId, requestedModel, {
          status: response.status,
          message: `HTTP ${response.status}`,
        });
      }
      const rotated = keyPoolManager.rotateGeminiKey(`HTTP ${response.status}`, requestedModel);
      logger.warn(
        `Gemini API returned ${response.status} for ${requestedModel || "request"}. Automatically failing over to ${rotated?.maskedId || "next key"} (attempt ${attempt + 1}/${totalKeys})`
      );
      continue;
    }

    // Detect 403 (Project Denied) or 404 (Model Not Found / Deprecated)
    if ((response.status === 403 || response.status === 404) && attempt < totalKeys - 1) {
      if (requestedModel) {
        keyPoolManager.recordModelOutcome(maskedId, requestedModel, {
          status: response.status,
          message: `HTTP ${response.status} on model ${requestedModel}`,
        });
      }
      const otherCompatible = requestedModel
        ? keyPoolManager.getCompatibleGeminiKeys(requestedModel)
        : [];
      if (otherCompatible.length > 0) {
        const rotated = keyPoolManager.rotateGeminiKey(`HTTP ${response.status}`, requestedModel);
        logger.warn(
          `Gemini API returned ${response.status} for ${requestedModel} on ${maskedId}. Trying alternate compatible key ${rotated?.maskedId || "next key"} (attempt ${attempt + 1}/${totalKeys})`
        );
        continue;
      }
    }

    return response;
  }

  return fetch(input, init);
};

const initialGeminiKey =
  keyPoolManager.getActiveGeminiKey()?.key ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  "dummy_gemini_key_for_init";

const google = createGoogleGenerativeAI({
  apiKey: initialGeminiKey,
  fetch: geminiFetch,
});

// ---------------------------------------------------------------------------
// 2. Multi-Key Groq Fetch Interceptor (Zero Leakage, Seamless Failover)
// ---------------------------------------------------------------------------

const groqFetch: typeof fetch = async (input, init) => {
  const totalKeys = keyPoolManager.getGroqKeyCount();
  if (totalKeys === 0) {
    return fetch(input, init);
  }

  const baseHeaders = new Headers(init?.headers);

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const activeKeyInfo = keyPoolManager.getActiveGroqKey();
    const activeKey = activeKeyInfo?.key;

    const requestHeaders = new Headers(baseHeaders);
    if (activeKey) {
      requestHeaders.set("Authorization", `Bearer ${activeKey}`);
    }

    const response = await fetch(input, {
      ...init,
      headers: requestHeaders,
    });

    // Only failover on genuine rate/quota exhaustion (HTTP 429) or service unavailable (HTTP 503)
    if ((response.status === 429 || response.status === 503) && attempt < totalKeys - 1) {
      const rotated = keyPoolManager.rotateGroqKey(`HTTP ${response.status}`);
      logger.warn(
        `Groq API returned ${response.status}. Automatically failing over to ${rotated?.maskedId || "next key"} (attempt ${attempt + 1}/${totalKeys})`
      );
      continue;
    }

    return response;
  }

  return fetch(input, init);
};

const initialGroqKey =
  keyPoolManager.getActiveGroqKey()?.key ||
  process.env.GROQ_API_KEY ||
  "dummy_groq_key_for_init";

const groq = createGroq({
  baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
  apiKey: initialGroqKey,
  fetch: groqFetch,
});

// ---------------------------------------------------------------------------
// 3. Static Models Definition (Including Old & New Gemini Models)
// ---------------------------------------------------------------------------

const staticModels = {
  openai: {
    "gpt-4.1": openai("gpt-4.1"),
    "gpt-4.1-mini": openai("gpt-4.1-mini"),
    "o4-mini": openai("o4-mini"),
    o3: openai("o3"),
    "gpt-5.1-chat": openai("gpt-5.1-chat-latest"),
    "gpt-5.1": openai("gpt-5.1"),
    "gpt-5.1-codex": openai("gpt-5.1-codex"),
    "gpt-5.1-codex-mini": openai("gpt-5.1-codex-mini"),
  },
  google: {
    // Newest Gemini Models (3.5 and 3.1 with active tool calling across all keys)
    "gemini-3.5-flash": google("gemini-3.5-flash"),
    "gemini-3.5-flash-lite": google("gemini-3.5-flash-lite"),
    "gemini-3.1-flash-lite": google("gemini-3.1-flash-lite"),

    // Stable 2.5 Gemini Models
    "gemini-2.5-flash": google("gemini-2.5-flash"),
    "gemini-2.5-flash-lite": google("gemini-2.5-flash-lite"),
    "gemini-2.5-pro": google("gemini-2.5-pro"),
    "gemini-2.0-flash": google("gemini-2.0-flash"),

    // Old Gemini Models (1.5 stable workhorses)
    "gemini-1.5-pro": google("gemini-1.5-pro"),
    "gemini-1.5-flash": google("gemini-1.5-flash"),

    // Configured Aliases for Dynamic Environment Selection (internal fallback routing)
    "gemini-new": google(GEMINI_CONFIGURED_NEW_MODEL),
    "gemini-old": google(GEMINI_CONFIGURED_OLD_MODEL),
  },
  anthropic: {
    "sonnet-4.5": anthropic("claude-sonnet-4-5"),
    "haiku-4.5": anthropic("claude-haiku-4-5"),
    "opus-4.5": anthropic("claude-opus-4-5"),
  },
  xai: {
    "grok-4-1-fast": xai("grok-4-1-fast-non-reasoning"),
    "grok-4-1": xai("grok-4-1"),
    "grok-3-mini": xai("grok-3-mini"),
  },
  groq: {
    "gpt-oss-120b": groq("openai/gpt-oss-120b"),
    "gpt-oss-20b": groq("openai/gpt-oss-20b"),
    "qwen3.6-27b": groq("qwen/qwen3.6-27b"),
  },
  openRouter: {
    "gpt-oss-20b:free": openrouter("openai/gpt-oss-20b:free"),
    "qwen3-8b:free": openrouter("qwen/qwen3-8b:free"),
    "qwen3-14b:free": openrouter("qwen/qwen3-14b:free"),
    "qwen3-coder:free": openrouter("qwen/qwen3-coder:free"),
    "deepseek-r1:free": openrouter("deepseek/deepseek-r1-0528:free"),
    "deepseek-v3:free": openrouter("deepseek/deepseek-chat-v3-0324:free"),
    "gemini-2.0-flash-exp:free": openrouter("google/gemini-2.0-flash-exp:free"),
  },
};

const staticUnsupportedModels = new Set([
  staticModels.openai["o4-mini"],
  staticModels.openRouter["gpt-oss-20b:free"],
  staticModels.openRouter["qwen3-8b:free"],
  staticModels.openRouter["qwen3-14b:free"],
  staticModels.openRouter["deepseek-r1:free"],
  staticModels.openRouter["gemini-2.0-flash-exp:free"],
  staticModels.groq["qwen3.6-27b"], // Gated from tool calling for stability
]);

const staticSupportImageInputModels = {
  ...staticModels.google,
  ...staticModels.xai,
  ...staticModels.openai,
  ...staticModels.anthropic,
};

const staticFilePartSupportByModel = new Map<
  LanguageModel,
  readonly string[]
>();

const registerFileSupport = (
  model: LanguageModel | undefined,
  mimeTypes: readonly string[] = DEFAULT_FILE_PART_MIME_TYPES,
) => {
  if (!model) return;
  staticFilePartSupportByModel.set(model, Array.from(mimeTypes));
};

registerFileSupport(staticModels.openai["gpt-4.1"], OPENAI_FILE_MIME_TYPES);
registerFileSupport(
  staticModels.openai["gpt-4.1-mini"],
  OPENAI_FILE_MIME_TYPES,
);

registerFileSupport(
  staticModels.google["gemini-3.5-flash"],
  GEMINI_FILE_MIME_TYPES,
);
registerFileSupport(
  staticModels.google["gemini-3.5-flash-lite"],
  GEMINI_FILE_MIME_TYPES,
);
registerFileSupport(
  staticModels.google["gemini-3.1-flash-lite"],
  GEMINI_FILE_MIME_TYPES,
);
registerFileSupport(
  staticModels.google["gemini-2.5-flash"],
  GEMINI_FILE_MIME_TYPES,
);
registerFileSupport(
  staticModels.google["gemini-2.5-flash-lite"],
  GEMINI_FILE_MIME_TYPES,
);
registerFileSupport(
  staticModels.google["gemini-2.5-pro"],
  GEMINI_FILE_MIME_TYPES,
);
registerFileSupport(
  staticModels.google["gemini-2.0-flash"],
  GEMINI_FILE_MIME_TYPES,
);
registerFileSupport(
  staticModels.google["gemini-1.5-pro"],
  GEMINI_FILE_MIME_TYPES,
);
registerFileSupport(
  staticModels.google["gemini-1.5-flash"],
  GEMINI_FILE_MIME_TYPES,
);
registerFileSupport(
  staticModels.google["gemini-new"],
  GEMINI_FILE_MIME_TYPES,
);
registerFileSupport(
  staticModels.google["gemini-old"],
  GEMINI_FILE_MIME_TYPES,
);

registerFileSupport(
  staticModels.anthropic["sonnet-4.5"],
  ANTHROPIC_FILE_MIME_TYPES,
);
registerFileSupport(
  staticModels.anthropic["opus-4.5"],
  ANTHROPIC_FILE_MIME_TYPES,
);

registerFileSupport(staticModels.xai["grok-4-1-fast"], XAI_FILE_MIME_TYPES);
registerFileSupport(staticModels.xai["grok-4-1"], XAI_FILE_MIME_TYPES);
registerFileSupport(staticModels.xai["grok-3-mini"], XAI_FILE_MIME_TYPES);
registerFileSupport(
  staticModels.openRouter["gemini-2.0-flash-exp:free"],
  GEMINI_FILE_MIME_TYPES,
);

const openaiCompatibleProviders = openaiCompatibleModelsSafeParse(
  process.env.OPENAI_COMPATIBLE_DATA,
);

const {
  providers: openaiCompatibleModels,
  unsupportedModels: openaiCompatibleUnsupportedModels,
} = createOpenAICompatibleModels(openaiCompatibleProviders);

const allModels = { ...openaiCompatibleModels, ...staticModels };

const allUnsupportedModels = new Set([
  ...openaiCompatibleUnsupportedModels,
  ...staticUnsupportedModels,
]);

export const isToolCallUnsupportedModel = (model: LanguageModel) => {
  return allUnsupportedModels.has(model);
};

const isImageInputUnsupportedModel = (model: LanguageModelV2) => {
  return !Object.values(staticSupportImageInputModels).includes(model);
};

export const getFilePartSupportedMimeTypes = (model: LanguageModel) => {
  return staticFilePartSupportByModel.get(model) ?? [];
};

function getFallbackModel(): LanguageModel {
  if (checkProviderAPIKey("google")) {
    const configuredNew = staticModels.google[GEMINI_CONFIGURED_NEW_MODEL as keyof typeof staticModels.google];
    if (configuredNew) return configuredNew;
    return (
      staticModels.google["gemini-3.1-flash-lite"] ||
      staticModels.google["gemini-3.5-flash"] ||
      staticModels.google["gemini-2.5-flash-lite"]
    );
  }
  if (checkProviderAPIKey("groq")) {
    return staticModels.groq["gpt-oss-120b"] || staticModels.groq["gpt-oss-20b"];
  }
  if (checkProviderAPIKey("openai")) {
    return staticModels.openai["gpt-4.1"];
  }
  if (checkProviderAPIKey("anthropic")) {
    return staticModels.anthropic["sonnet-4.5"];
  }
  return staticModels.google["gemini-3.1-flash-lite"] || staticModels.google["gemini-3.5-flash"];
}

/**
 * Generates user-friendly display labels dynamically reflecting the configured models.
 */
export function formatFriendlyModelName(provider: string, modelName: string): string {
  if (provider === "google") {
    if (modelName === "gemini-new") {
      modelName = GEMINI_CONFIGURED_NEW_MODEL;
    } else if (modelName === "gemini-old") {
      modelName = GEMINI_CONFIGURED_OLD_MODEL;
    }

    if (modelName === "gemini-3.1-flash-lite") return "Gemini 3.1 Flash Lite";
    if (modelName === "gemini-3.5-flash") return "Gemini 3.5 Flash";
    if (modelName === "gemini-3.5-flash-lite") return "Gemini 3.5 Flash Lite";
    if (modelName === "gemini-2.5-flash") return "Gemini 2.5 Flash";
    if (modelName === "gemini-2.5-flash-lite") return "Gemini 2.5 Flash Lite";
    if (modelName === "gemini-2.5-pro") return "Gemini 2.5 Pro";
    if (modelName === "gemini-2.0-flash") return "Gemini 2.0 Flash";
    if (modelName === "gemini-3.6-flash") return "Gemini 3.6 Flash";
    if (modelName === "gemini-1.5-flash") return "Gemini 1.5 Flash";
    if (modelName === "gemini-1.5-pro") return "Gemini 1.5 Pro";

    return modelName
      .replace(/^gemini-/, "Gemini ")
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  if (provider === "groq") {
    if (modelName === "gpt-oss-120b" || modelName === "openai/gpt-oss-120b") {
      return "Groq GPT-OSS 120B";
    }
    if (modelName === "gpt-oss-20b" || modelName === "openai/gpt-oss-20b") {
      return "Groq GPT-OSS 20B";
    }
    if (modelName === "qwen3.6-27b" || modelName === "qwen/qwen3.6-27b") {
      return "Groq Qwen 3.6 27B";
    }
  }

  return modelName;
}

export const customModelProvider = {
  modelsInfo: Object.entries(allModels)
    .filter(([provider]) => provider !== "ollama" && provider !== "local")
    .map(([provider, models]) => {
      // Exclude internal routing aliases (gemini-new, gemini-old) from user-facing dropdown list
      // The actual configured models (e.g. gemini-2.5-flash, gemini-2.5-flash-lite) are displayed directly
      const entries = Object.entries(models).filter(([name]) => {
        if (provider === "google" && (name === "gemini-new" || name === "gemini-old")) {
          return false;
        }
        return true;
      });

      return {
        provider,
        models: entries.map(([name, model]) => ({
          name,
          label: formatFriendlyModelName(provider, name),
          isToolCallUnsupported: isToolCallUnsupportedModel(model),
          isImageInputUnsupported: isImageInputUnsupportedModel(model),
          supportedFileMimeTypes: [...getFilePartSupportedMimeTypes(model)],
        })),
        hasAPIKey: checkProviderAPIKey(provider as keyof typeof staticModels),
      };
    }),
  getModel: (model?: ChatModel): LanguageModel => {
    const fallback = getFallbackModel();
    if (!model) return fallback;
    if (model.provider === "google") {
      if (model.model === "gemini-new") {
        return (
          allModels.google[GEMINI_CONFIGURED_NEW_MODEL] ||
          allModels.google["gemini-2.5-flash"] ||
          fallback
        );
      }
      if (model.model === "gemini-old") {
        return (
          allModels.google[GEMINI_CONFIGURED_OLD_MODEL] ||
          allModels.google["gemini-2.5-flash-lite"] ||
          fallback
        );
      }
    }
    return allModels[model.provider]?.[model.model] || fallback;
  },
};

export function checkProviderAPIKey(provider: keyof typeof staticModels) {
  let key: string | undefined;
  switch (provider) {
    case "openai":
      key = process.env.OPENAI_API_KEY;
      break;
    case "google":
      return keyPoolManager.getGeminiKeyCount() > 0;
    case "anthropic":
      key = process.env.ANTHROPIC_API_KEY;
      break;
    case "xai":
      key = process.env.XAI_API_KEY;
      break;
    case "groq":
      return keyPoolManager.getGroqKeyCount() > 0;
    case "openRouter":
      key = process.env.OPENROUTER_API_KEY;
      break;
    default:
      return true;
  }
  return !!key && key !== "****" && !key.startsWith("your_");
}
