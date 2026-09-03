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

export type ModelAccessStatus =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "DENIED"
  | "QUOTA_EXHAUSTED"
  | "UNKNOWN";

export interface ModelAccessRecord {
  status: ModelAccessStatus;
  checkedAt: number;
  ttlMs: number;
  errorStatus?: number;
  errorMessage?: string;
  supportsToolCalling?: boolean;
}

export interface KeyPoolItem {
  key: string;
  maskedId: string; // e.g. "Gemini Key #1 (...abcd)"
  provider: "google" | "groq";
  failureCount: number;
  lastFailureTime?: number;
  cooldownUntil?: number;
  exhausted: boolean;
  lastError?: {
    status?: number;
    message: string;
    timestamp: number;
  };
  modelAccess: Map<string, ModelAccessRecord>;
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
      const trimmed = item.key.trim();
      seen.add(trimmed);
      const last4 = trimmed.slice(-4);
      pool.push({
        key: trimmed,
        maskedId: `Gemini Key #${index++} (...${last4})`,
        provider: "google",
        failureCount: 0,
        exhausted: false,
        modelAccess: new Map(),
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
      const trimmed = item.key.trim();
      seen.add(trimmed);
      const last4 = trimmed.slice(-4);
      pool.push({
        key: trimmed,
        maskedId: `Groq Key #${index++} (...${last4})`,
        provider: "groq",
        failureCount: 0,
        exhausted: false,
        modelAccess: new Map(),
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
    const existingGeminiMap = new Map<string, KeyPoolItem>();
    for (const item of this.geminiPool) {
      existingGeminiMap.set(item.key, item);
    }
    const existingGroqMap = new Map<string, KeyPoolItem>();
    for (const item of this.groqPool) {
      existingGroqMap.set(item.key, item);
    }

    const newGemini = loadGeminiKeys();
    const newGroq = loadGroqKeys();

    // Preserve runtime error and model access history for existing keys
    this.geminiPool = newGemini.map((item) => {
      const existing = existingGeminiMap.get(item.key);
      if (existing) {
        return {
          ...item,
          failureCount: existing.failureCount,
          lastFailureTime: existing.lastFailureTime,
          cooldownUntil: existing.cooldownUntil,
          exhausted: existing.exhausted,
          lastError: existing.lastError,
          modelAccess: existing.modelAccess,
        };
      }
      return item;
    });

    this.groqPool = newGroq.map((item) => {
      const existing = existingGroqMap.get(item.key);
      if (existing) {
        return {
          ...item,
          failureCount: existing.failureCount,
          lastFailureTime: existing.lastFailureTime,
          cooldownUntil: existing.cooldownUntil,
          exhausted: existing.exhausted,
          lastError: existing.lastError,
          modelAccess: existing.modelAccess,
        };
      }
      return item;
    });
  }

  public getGeminiKeyCount(): number {
    return this.geminiPool.length;
  }

  public getGroqKeyCount(): number {
    return this.groqPool.length;
  }

  /**
   * Checks if a key can use a given model (or if access is unknown/not yet denied).
   */
  public isKeyCompatibleWithModel(keyItem: KeyPoolItem, modelName: string): boolean {
    if (keyItem.exhausted) return false;
    const now = Date.now();
    if (keyItem.cooldownUntil && keyItem.cooldownUntil > now) return false;

    const record = keyItem.modelAccess.get(modelName);
    if (!record) return true; // Unknown: assume potentially compatible until checked

    // Check TTL
    if (now - record.checkedAt > record.ttlMs) {
      keyItem.modelAccess.delete(modelName);
      return true; // Expired cache: allow re-test
    }

    // Denied (403), Unavailable/Deprecated (404), or Quota Exhausted (429)
    if (
      record.status === "DENIED" ||
      record.status === "UNAVAILABLE" ||
      record.status === "QUOTA_EXHAUSTED"
    ) {
      return false;
    }

    return true;
  }

  /**
   * Returns all Gemini keys in the pool that are currently healthy and compatible with a model.
   */
  public getCompatibleGeminiKeys(modelName: string): KeyPoolItem[] {
    return this.geminiPool.filter((k) => this.isKeyCompatibleWithModel(k, modelName));
  }

  /**
   * Returns the active Gemini key, prioritizing keys compatible with the requested model.
   */
  public getActiveGeminiKey(modelName?: string): { key: string; maskedId: string; index: number } | null {
    if (this.geminiPool.length === 0) {
      this.refreshPools();
      if (this.geminiPool.length === 0) return null;
    }
    const now = Date.now();

    // 1. If modelName is provided, find a key compatible with this model
    if (modelName) {
      const compatibleIdx = this.geminiPool.findIndex(
        (k) => this.isKeyCompatibleWithModel(k, modelName)
      );
      if (compatibleIdx !== -1) {
        this.currentGeminiIndex = compatibleIdx;
        const item = this.geminiPool[compatibleIdx];
        return {
          key: item.key,
          maskedId: item.maskedId,
          index: compatibleIdx,
        };
      }
      return null;
    }

    // 2. Otherwise prioritize any healthy key not in cooldown
    const healthyIndex = this.geminiPool.findIndex(
      (k) => !k.exhausted && (!k.cooldownUntil || k.cooldownUntil <= now)
    );
    if (healthyIndex !== -1) {
      this.currentGeminiIndex = healthyIndex;
      const item = this.geminiPool[healthyIndex];
      return {
        key: item.key,
        maskedId: item.maskedId,
        index: healthyIndex,
      };
    }

    return null;
  }

  public getActiveGroqKey(): { key: string; maskedId: string; index: number } | null {
    if (this.groqPool.length === 0) {
      this.refreshPools();
      if (this.groqPool.length === 0) return null;
    }
    const now = Date.now();
    const healthyIndex = this.groqPool.findIndex(
      (k) => !k.exhausted && (!k.cooldownUntil || k.cooldownUntil <= now)
    );
    if (healthyIndex !== -1) {
      this.currentGroqIndex = healthyIndex;
      const item = this.groqPool[healthyIndex];
      return {
        key: item.key,
        maskedId: item.maskedId,
        index: healthyIndex,
      };
    }
    return null;
  }

  /**
   * Rotates to next key when rate limit / quota exhaustion / 503 is encountered.
   * If forModel is provided, rotates to a key compatible with that model.
   */
  public rotateGeminiKey(reason = "Quota/rate-limit", forModel?: string): { maskedId: string; key: string } | null {
    if (this.geminiPool.length <= 1) {
      const single = this.geminiPool[0];
      if (single) {
        single.failureCount++;
        single.lastFailureTime = Date.now();
        single.cooldownUntil = Date.now() + 60000;
      }
      return this.getActiveGeminiKey(forModel);
    }

    const prev = this.geminiPool[this.currentGeminiIndex % this.geminiPool.length];
    prev.failureCount++;
    prev.lastFailureTime = Date.now();
    prev.cooldownUntil = Date.now() + 60000; // 60s cooldown

    // If forModel is provided, look for another key compatible with forModel
    if (forModel) {
      for (let i = 1; i < this.geminiPool.length; i++) {
        const candidateIdx = (this.currentGeminiIndex + i) % this.geminiPool.length;
        const candidate = this.geminiPool[candidateIdx];
        if (this.isKeyCompatibleWithModel(candidate, forModel)) {
          this.currentGeminiIndex = candidateIdx;
          return { maskedId: candidate.maskedId, key: candidate.key };
        }
      }
    }

    // Default sequential rotation
    this.currentGeminiIndex = (this.currentGeminiIndex + 1) % this.geminiPool.length;
    const next = this.geminiPool[this.currentGeminiIndex];
    return { maskedId: next.maskedId, key: next.key };
  }

  public rotateGroqKey(reason = "Quota/rate-limit"): { maskedId: string; key: string } | null {
    if (this.groqPool.length <= 1) {
      const single = this.groqPool[0];
      if (single) {
        single.failureCount++;
        single.lastFailureTime = Date.now();
        single.cooldownUntil = Date.now() + 60000;
      }
      return this.getActiveGroqKey();
    }
    const prev = this.groqPool[this.currentGroqIndex % this.groqPool.length];
    prev.failureCount++;
    prev.lastFailureTime = Date.now();
    prev.cooldownUntil = Date.now() + 60000;

    this.currentGroqIndex = (this.currentGroqIndex + 1) % this.groqPool.length;
    const next = this.groqPool[this.currentGroqIndex];
    return { maskedId: next.maskedId, key: next.key };
  }

  /**
   * Records model access outcome for a specific key and model.
   */
  public recordModelOutcome(
    keyOrMaskedId: string,
    modelName: string,
    outcome: {
      status: number;
      message: string;
    }
  ): void {
    const item =
      this.geminiPool.find((k) => k.maskedId === keyOrMaskedId || k.key === keyOrMaskedId) ||
      this.groqPool.find((k) => k.maskedId === keyOrMaskedId || k.key === keyOrMaskedId);

    if (!item) return;

    const now = Date.now();
    item.lastError = { status: outcome.status, message: outcome.message, timestamp: now };

    if (outcome.status === 401) {
      // Permanent key failure (invalid API key)
      item.exhausted = true;
      item.cooldownUntil = now + 24 * 3600 * 1000;
    } else if (outcome.status === 403) {
      // Project denied access to this specific model
      item.modelAccess.set(modelName, {
        status: "DENIED",
        checkedAt: now,
        ttlMs: 30 * 60 * 1000, // 30 mins TTL
        errorStatus: 403,
        errorMessage: outcome.message,
      });
    } else if (outcome.status === 404) {
      // Model deprecated or not found for this API key/project
      item.modelAccess.set(modelName, {
        status: "UNAVAILABLE",
        checkedAt: now,
        ttlMs: 60 * 60 * 1000, // 60 mins TTL
        errorStatus: 404,
        errorMessage: outcome.message,
      });
    } else if (outcome.status === 429) {
      // Rate limit / Quota exceeded on this key
      item.failureCount++;
      item.lastFailureTime = now;
      item.cooldownUntil = now + 60 * 1000; // 60s cooldown
      item.modelAccess.set(modelName, {
        status: "QUOTA_EXHAUSTED",
        checkedAt: now,
        ttlMs: 60 * 1000,
        errorStatus: 429,
        errorMessage: outcome.message,
      });
    } else if (outcome.status >= 500) {
      // Temporary provider outage
      item.failureCount++;
      item.lastFailureTime = now;
      item.cooldownUntil = now + 30 * 1000; // 30s cooldown
    } else if (outcome.status === 200) {
      // Successful execution!
      item.failureCount = 0;
      item.cooldownUntil = undefined;
      item.modelAccess.set(modelName, {
        status: "AVAILABLE",
        checkedAt: now,
        ttlMs: 60 * 60 * 1000, // 1 hour TTL
      });
    }
  }

  public markKeyUnhealthy(maskedId: string, cooldownMs = 60000) {
    const all = [...this.geminiPool, ...this.groqPool];
    const target = all.find((k) => k.maskedId === maskedId);
    if (target) {
      target.failureCount++;
      target.lastFailureTime = Date.now();
      target.cooldownUntil = Date.now() + cooldownMs;
    }
  }

  public markKeyHealthy(maskedId: string) {
    const all = [...this.geminiPool, ...this.groqPool];
    const target = all.find((k) => k.maskedId === maskedId);
    if (target) {
      target.failureCount = 0;
      target.cooldownUntil = undefined;
      target.exhausted = false;
    }
  }

  public getAllGeminiKeys(): KeyPoolItem[] {
    return [...this.geminiPool];
  }

  public getAllGroqKeys(): KeyPoolItem[] {
    return [...this.groqPool];
  }

  public getDiagnostics() {
    const now = Date.now();
    return {
      geminiKeys: this.geminiPool.map((k, idx) => ({
        index: idx + 1,
        maskedId: k.maskedId,
        exhausted: k.exhausted,
        isHealthy: !k.exhausted && (!k.cooldownUntil || k.cooldownUntil <= now),
        cooldownRemainingMs: k.cooldownUntil && k.cooldownUntil > now ? k.cooldownUntil - now : 0,
        failureCount: k.failureCount,
        lastError: k.lastError ? `HTTP ${k.lastError.status}: ${k.lastError.message.slice(0, 60)}` : undefined,
        cachedModels: Object.fromEntries(
          Array.from(k.modelAccess.entries()).map(([m, rec]) => [m, rec.status])
        ),
      })),
      groqKeys: this.groqPool.map((k, idx) => ({
        index: idx + 1,
        maskedId: k.maskedId,
        exhausted: k.exhausted,
        isHealthy: !k.exhausted && (!k.cooldownUntil || k.cooldownUntil <= now),
        cooldownRemainingMs: k.cooldownUntil && k.cooldownUntil > now ? k.cooldownUntil - now : 0,
        failureCount: k.failureCount,
      })),
    };
  }
}

export const keyPoolManager = new KeyPoolManager();

// ---------------------------------------------------------------------------
// 2. Model Capabilities & Tier Matrix
// ---------------------------------------------------------------------------

export const GEMINI_CONFIGURED_OLD_MODEL =
  process.env.GEMINI_OLD_MODEL || "gemini-3.5-flash-lite";

export const GEMINI_CONFIGURED_NEW_MODEL =
  process.env.GEMINI_NEW_MODEL || "gemini-3.5-flash";

export const MODEL_CAPABILITIES_REGISTRY: Record<string, ModelCapability> = {
  // --- Google / Gemini Models (Old + New) ---
  "gemini-3.5-flash": {
    provider: "google",
    modelName: "gemini-3.5-flash",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    isThinkingModel: true,
    tier: "new",
    description: "Gemini 3.5 Flash: Next-generation fast multimodal model with internal reasoning and verified tool calling across all active keys.",
  },
  "gemini-3.5-flash-lite": {
    provider: "google",
    modelName: "gemini-3.5-flash-lite",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    isThinkingModel: false,
    tier: "old",
    description: "Gemini 3.5 Flash Lite: High-throughput lightweight model with verified function calling.",
  },
  "gemini-3.1-flash-lite": {
    provider: "google",
    modelName: "gemini-3.1-flash-lite",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    isThinkingModel: false,
    tier: "old",
    description: "Gemini 3.1 Flash Lite: High-efficiency lightweight model with verified function calling.",
  },
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
  "gemini-2.5-flash-lite": {
    provider: "google",
    modelName: "gemini-2.5-flash-lite",
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    isThinkingModel: false,
    tier: "old",
    description: "Gemini 2.5 Flash Lite: High-speed lightweight model with verified function calling.",
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
  "gemini-new": {
    provider: "google",
    modelName: GEMINI_CONFIGURED_NEW_MODEL,
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    isThinkingModel: GEMINI_CONFIGURED_NEW_MODEL.includes("2.5"),
    tier: "new",
    description: `Dynamic primary Gemini model configured via GEMINI_NEW_MODEL (${GEMINI_CONFIGURED_NEW_MODEL}).`,
  },
  "gemini-old": {
    provider: "google",
    modelName: GEMINI_CONFIGURED_OLD_MODEL,
    supportsToolCalling: true,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    isThinkingModel: false,
    tier: "old",
    description: `Dynamic compatibility Gemini model configured via GEMINI_OLD_MODEL (${GEMINI_CONFIGURED_OLD_MODEL}).`,
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
