import "server-only";

/**
 * SagarDrishti-AI Provider & Key Pool Management
 * 
 * Provides:
 * 1. Multi-key rotation for Gemini (GEMINI_API_KEY_1..5, GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY)
 * 2. Multi-key rotation for Groq (GROQ_API_KEY_1..5, GROQ_API_KEY)
 * 3. Old vs New Gemini model configuration (GEMINI_OLD_MODEL, GEMINI_NEW_MODEL)
 * 4. Model capability matrix (tool calling, streaming, structured output, vision, thinking)
 * 5. Safe observability (masked key identifiers, no credential leaks)
 */

export interface ModelCapability {
  provider: "google" | "groq" | "openai" | "anthropic" | "xai" | "openRouter";
  modelName: string;
  supportsToolCalling: boolean;
  supportsStreaming: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  isThinkingModel?: boolean;
  tier: "new" | "old" | "fallback" | "standard";
  description?: string;
}

export interface KeyPoolItem {
  key: string;
  maskedId: string; // e.g. "Gemini Key #1"
  provider: "google" | "groq";
  failureCount: number;
  lastFailureTime?: number;
  exhausted: boolean;
}

// ---------------------------------------------------------------------------
// 1. API Key Pools (Server-Side Only - Strictly Never Exposed)
// ---------------------------------------------------------------------------

function loadGeminiKeys(): KeyPoolItem[] {
  const candidates: Array<{ key: string | undefined; label: string }> = [
    { key: process.env.GEMINI_API_KEY_1, label: "Gemini Key #1" },
    { key: process.env.GEMINI_API_KEY_2, label: "Gemini Key #2" },
    { key: process.env.GEMINI_API_KEY_3, label: "Gemini Key #3" },
    { key: process.env.GEMINI_API_KEY_4, label: "Gemini Key #4" },
    { key: process.env.GEMINI_API_KEY_5, label: "Gemini Key #5" },
    { key: process.env.GEMINI_API_KEY, label: "Gemini Default Key" },
    { key: process.env.GOOGLE_GENERATIVE_AI_API_KEY, label: "Google GenAI Key" },
  ];

  const seen = new Set<string>();
  const pool: KeyPoolItem[] = [];

  let index = 1;
  for (const item of candidates) {
    if (
      item.key &&
      typeof item.key === "string" &&
      item.key.trim().length > 5 &&
      item.key !== "****" &&
      !item.key.startsWith("your_") &&
      !seen.has(item.key.trim())
    ) {
      seen.add(item.key.trim());
      pool.push({
        key: item.key.trim(),
        maskedId: `Gemini Key #${index++}`,
        provider: "google",
        failureCount: 0,
        exhausted: false,
      });
    }
  }

  return pool;
}

function loadGroqKeys(): KeyPoolItem[] {
  const candidates: Array<{ key: string | undefined; label: string }> = [
    { key: process.env.GROQ_API_KEY_1, label: "Groq Key #1" },
    { key: process.env.GROQ_API_KEY, label: "Groq Default Key" },
    { key: process.env.GROQ_API_KEY_2, label: "Groq Key #2" },
    { key: process.env.GROQ_API_KEY_3, label: "Groq Key #3" },
    { key: process.env.GROQ_API_KEY_4, label: "Groq Key #4" },
    { key: process.env.GROQ_API_KEY_5, label: "Groq Key #5" },
  ];

  const seen = new Set<string>();
  const pool: KeyPoolItem[] = [];

  let index = 1;
  for (const item of candidates) {
    if (
      item.key &&
      typeof item.key === "string" &&
      item.key.trim().length > 5 &&
      item.key !== "****" &&
      !item.key.startsWith("your_") &&
      !seen.has(item.key.trim())
    ) {
      seen.add(item.key.trim());
      pool.push({
        key: item.key.trim(),
        maskedId: `Groq Key #${index++}`,
        provider: "groq",
        failureCount: 0,
        exhausted: false,
      });
    }
  }

  return pool;
}

export class KeyPoolManager {
  private geminiPool: KeyPoolItem[] = [];
  private groqPool: KeyPoolItem[] = [];
  private currentGeminiIndex = 0;
  private currentGroqIndex = 0;

  constructor() {
    this.refreshPools();
  }

  public refreshPools() {
    this.geminiPool = loadGeminiKeys();
    this.groqPool = loadGroqKeys();
  }

  public getGeminiKeyCount(): number {
    return this.geminiPool.length;
  }

  public getGroqKeyCount(): number {
    return this.groqPool.length;
  }

  /**
   * Returns an active key along with its masked identifier.
   */
  public getActiveGeminiKey(): { key: string; maskedId: string; index: number } | null {
    if (this.geminiPool.length === 0) {
      this.refreshPools();
      if (this.geminiPool.length === 0) return null;
    }
    const item = this.geminiPool[this.currentGeminiIndex % this.geminiPool.length];
    return {
      key: item.key,
      maskedId: item.maskedId,
      index: this.currentGeminiIndex % this.geminiPool.length,
    };
  }

  public getActiveGroqKey(): { key: string; maskedId: string; index: number } | null {
    if (this.groqPool.length === 0) {
      this.refreshPools();
      if (this.groqPool.length === 0) return null;
    }
    const item = this.groqPool[this.currentGroqIndex % this.groqPool.length];
    return {
      key: item.key,
      maskedId: item.maskedId,
      index: this.currentGroqIndex % this.groqPool.length,
    };
  }

  /**
   * Rotates to next key when rate limit / quota exhaustion / 503 is encountered.
   */
  public rotateGeminiKey(reason = "Quota/rate-limit"): { maskedId: string; key: string } | null {
    if (this.geminiPool.length <= 1) {
      return this.getActiveGeminiKey();
    }
    const prev = this.geminiPool[this.currentGeminiIndex % this.geminiPool.length];
    prev.failureCount++;
    prev.lastFailureTime = Date.now();

    this.currentGeminiIndex = (this.currentGeminiIndex + 1) % this.geminiPool.length;
    const next = this.geminiPool[this.currentGeminiIndex];
    return { maskedId: next.maskedId, key: next.key };
  }

  public rotateGroqKey(reason = "Quota/rate-limit"): { maskedId: string; key: string } | null {
    if (this.groqPool.length <= 1) {
      return this.getActiveGroqKey();
    }
    const prev = this.groqPool[this.currentGroqIndex % this.groqPool.length];
    prev.failureCount++;
    prev.lastFailureTime = Date.now();

    this.currentGroqIndex = (this.currentGroqIndex + 1) % this.groqPool.length;
    const next = this.groqPool[this.currentGroqIndex];
    return { maskedId: next.maskedId, key: next.key };
  }

  public getAllGeminiKeys(): KeyPoolItem[] {
    return [...this.geminiPool];
  }

  public getAllGroqKeys(): KeyPoolItem[] {
    return [...this.groqPool];
  }
}

export const keyPoolManager = new KeyPoolManager();

// ---------------------------------------------------------------------------
// 2. Model Capabilities & Tier Matrix
// ---------------------------------------------------------------------------

export const GEMINI_CONFIGURED_OLD_MODEL =
  process.env.GEMINI_OLD_MODEL || "gemini-1.5-flash";

export const GEMINI_CONFIGURED_NEW_MODEL =
  process.env.GEMINI_NEW_MODEL || "gemini-2.5-flash";

export const MODEL_CAPABILITIES_REGISTRY: Record<string, ModelCapability> = {
  // --- Google / Gemini Models (Old + New) ---
  "gemini-2.5-flash": {
    provider: "google",
    modelName: "gemini-2.5-flash",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    isThinkingModel: true,
    tier: "new",
    description: "Gemini 2.5 Flash: State-of-the-art fast multimodal model with internal reasoning and reliable tool calling.",
  },
  "gemini-2.5-pro": {
    provider: "google",
    modelName: "gemini-2.5-pro",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    isThinkingModel: true,
    tier: "new",
    description: "Gemini 2.5 Pro: High-capacity reasoning model with multi-turn tool calling and code execution.",
  },
  "gemini-2.0-flash": {
    provider: "google",
    modelName: "gemini-2.0-flash",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    isThinkingModel: false,
    tier: "new",
    description: "Gemini 2.0 Flash: Next-gen standard model with fast response latency and structured outputs.",
  },
  "gemini-1.5-pro": {
    provider: "google",
    modelName: "gemini-1.5-pro",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    isThinkingModel: false,
    tier: "old",
    description: "Gemini 1.5 Pro: Proven legacy workhorse model with massive 2M context window.",
  },
  "gemini-1.5-flash": {
    provider: "google",
    modelName: "gemini-1.5-flash",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    isThinkingModel: false,
    tier: "old",
    description: "Gemini 1.5 Flash: Proven lightweight model, highly resilient for high-throughput operational tasks.",
  },

  // --- Groq Models ---
  "openai/gpt-oss-120b": {
    provider: "groq",
    modelName: "openai/gpt-oss-120b",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    isThinkingModel: false,
    tier: "fallback",
    description: "Groq GPT-OSS 120B: High-speed open-weight inference with validated function calling.",
  },
  "openai/gpt-oss-20b": {
    provider: "groq",
    modelName: "openai/gpt-oss-20b",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    isThinkingModel: false,
    tier: "fallback",
    description: "Groq GPT-OSS 20B: Ultra low-latency conversational model for fast responses.",
  },
  "qwen/qwen3.6-27b": {
    provider: "groq",
    modelName: "qwen/qwen3.6-27b",
    supportsToolCalling: false, // Explicitly gated: does not support reliable multi-turn schema tool calling
    supportsStreaming: true,
    supportsStructuredOutput: false,
    supportsVision: false,
    isThinkingModel: false,
    tier: "standard",
    description: "Groq Qwen 3.6 27B: General text chat model (tool calling disabled for safety).",
  },
  "llama-3.3-70b-versatile": {
    provider: "groq",
    modelName: "llama-3.3-70b-versatile",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    isThinkingModel: false,
    tier: "fallback",
    description: "Groq Llama 3.3 70B: Powerful open model with fast tool calling support.",
  },

  // --- OpenAI ---
  "gpt-4.1": {
    provider: "openai",
    modelName: "gpt-4.1",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    tier: "standard",
  },
  "gpt-4.1-mini": {
    provider: "openai",
    modelName: "gpt-4.1-mini",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    tier: "standard",
  },

  // --- Anthropic ---
  "sonnet-4.5": {
    provider: "anthropic",
    modelName: "claude-sonnet-4-5",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    tier: "standard",
  },
};

/**
 * Retrieves the capability profile for a given provider and model name.
 */
export function getModelCapabilities(
  provider: string,
  modelName: string,
): ModelCapability {
  const directMatch = MODEL_CAPABILITIES_REGISTRY[modelName];
  if (directMatch) return directMatch;

  // Key matching by partial name
  for (const [key, cap] of Object.entries(MODEL_CAPABILITIES_REGISTRY)) {
    if (modelName.includes(key) || key.includes(modelName)) {
      return cap;
    }
  }

  // Sensible default based on provider
  if (provider === "google") {
    const isNew = modelName.includes("2.5") || modelName.includes("2.0");
    return {
      provider: "google",
      modelName,
      supportsToolCalling: true,
      supportsStreaming: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      isThinkingModel: modelName.includes("2.5"),
      tier: isNew ? "new" : "old",
    };
  }

  if (provider === "groq") {
    // Check if model is known to fail tools
    const toolUnfriendly = modelName.includes("qwen") || modelName.includes("free");
    return {
      provider: "groq",
      modelName,
      supportsToolCalling: !toolUnfriendly,
      supportsStreaming: true,
      supportsStructuredOutput: !toolUnfriendly,
      supportsVision: false,
      tier: "fallback",
    };
  }

  return {
    provider: provider as any,
    modelName,
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    tier: "standard",
  };
}

/**
 * Checks if an error is a candidate for API key rotation / model failover.
 */
export function isRetryableProviderError(error: any): boolean {
  if (!error) return false;
  const message = String(error.message || error).toLowerCase();
  const status = error.status || error.statusCode || (error.response && error.response.status);

  // HTTP 429 Too Many Requests, Resource Exhausted, Quota Exceeded
  if (status === 429) return true;
  if (message.includes("429") || message.includes("quota") || message.includes("resource_exhausted") || message.includes("rate limit") || message.includes("too many requests")) {
    return true;
  }

  // HTTP 503 Service Unavailable, Overloaded, 502 Bad Gateway
  if (status === 503 || status === 502 || status === 504) return true;
  if (message.includes("503") || message.includes("overloaded") || message.includes("service unavailable") || message.includes("high demand")) {
    return true;
  }

  // Network / timeout transients
  if (message.includes("etimedout") || message.includes("econnreset") || message.includes("fetch failed") || message.includes("network error")) {
    return true;
  }

  // Groq tool call format rejection (e.g. tool_use_failed, failed_generation)
  if (message.includes("tool_use_failed") || message.includes("failed_generation") || message.includes("tool_calls")) {
    return true;
  }

  return false;
}
