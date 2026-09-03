import "server-only";

import {
  generateText,
  stepCountIs,
  ModelMessage,
  Tool,
} from "ai";
import {
  keyPoolManager,
  getModelCapabilities,
  isRetryableProviderError,
  GEMINI_CONFIGURED_NEW_MODEL,
  GEMINI_CONFIGURED_OLD_MODEL,
  ModelCapability,
} from "./provider-config";
import { sanitizeToolsForGroq } from "./tool-repair";
import { customModelProvider } from "./models";
import globalLogger from "logger";
import { colorize } from "consola/utils";

const logger = globalLogger.withDefaults({
  message: colorize("cyan", `[ModelRouter]: `),
});

export interface ModelExecutionOptions {
  model?: { provider: string; model: string };
  system?: string;
  messages: ModelMessage[];
  prompt?: string;
  tools?: Record<string, Tool>;
  maxSteps?: number;
  abortSignal?: AbortSignal;
  requireTools?: boolean;
}

export interface RouterExecutionResult {
  text: string;
  toolCallsExecuted: Array<{ toolName: string; args: any; result: any }>;
  providerUsed: string;
  modelUsed: string;
  attemptsCount: number;
  keyMaskedId: string;
  warnings: string[];
}

/**
 * Builds the fallback candidate queue for a request.
 * Takes user preference into account, but prioritizes tool correctness.
 */
export function buildExecutionCandidates(
  requestedProvider?: string,
  requestedModel?: string,
  requiresTools = false,
): Array<{ provider: string; model: string; capability: ModelCapability }> {
  const candidates: Array<{ provider: string; model: string; capability: ModelCapability }> = [];
  const seen = new Set<string>();

  function addCandidate(provider: string, model: string) {
    const key = `${provider}:${model}`;
    if (seen.has(key)) return;
    const capability = getModelCapabilities(provider, model);

    // If request strictly requires tools, skip models marked without tool support
    if (requiresTools && !capability.supportsToolCalling) {
      return;
    }

    seen.add(key);
    candidates.push({ provider, model, capability });
  }

  // 1. First priority: The explicitly requested model (if compatible)
  if (requestedProvider && requestedModel) {
    addCandidate(requestedProvider, requestedModel);
  }

  // 2. Second priority: Gemini New Model (Configured: e.g. gemini-2.5-flash)
  addCandidate("google", GEMINI_CONFIGURED_NEW_MODEL);

  // 3. Third priority: Gemini Old Model (Configured: e.g. gemini-1.5-flash)
  addCandidate("google", GEMINI_CONFIGURED_OLD_MODEL);

  // 4. Fourth priority: Groq Compatible Fallback Model (e.g. gpt-oss-120b or llama-3.3-70b-versatile)
  addCandidate("groq", "gpt-oss-120b");
  addCandidate("groq", "openai/gpt-oss-120b");
  addCandidate("groq", "gpt-oss-20b");

  return candidates;
}

/**
 * Centralized Provider Generation Engine with Multi-Key Failover & Cross-Model Recovery.
 */
export async function generateWithProvider(
  options: ModelExecutionOptions,
): Promise<RouterExecutionResult> {
  const requiresTools = Boolean(
    options.requireTools ||
    (options.tools && Object.keys(options.tools).length > 0)
  );

  const candidates = buildExecutionCandidates(
    options.model?.provider,
    options.model?.model,
    requiresTools,
  );

  if (candidates.length === 0) {
    throw new Error(
      "No compatible model candidate available matching the required tool-calling capabilities."
    );
  }

  let totalAttempts = 0;
  const executionWarnings: string[] = [];

  for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
    const candidate = candidates[cIdx];
    const { provider, model, capability } = candidate;

    // Determine number of key attempts for this provider
    let maxKeyAttempts = 1;
    if (provider === "google") {
      maxKeyAttempts = Math.max(1, keyPoolManager.getGeminiKeyCount());
    } else if (provider === "groq") {
      maxKeyAttempts = Math.max(1, keyPoolManager.getGroqKeyCount());
    }

    for (let kAttempt = 0; kAttempt < maxKeyAttempts; kAttempt++) {
      totalAttempts++;

      let activeKeyInfo: { maskedId: string; key: string } | null = null;
      if (provider === "google") {
        const active = keyPoolManager.getActiveGeminiKey(model);
        activeKeyInfo = active ? { maskedId: active.maskedId, key: active.key } : null;
      } else if (provider === "groq") {
        const active = keyPoolManager.getActiveGroqKey();
        activeKeyInfo = active ? { maskedId: active.maskedId, key: active.key } : null;
      }

      if (!activeKeyInfo) {
        logger.info(
          `No active healthy keys for ${provider} on model ${model}. Advancing to next candidate.`
        );
        break;
      }

      const maskedKeyId = activeKeyInfo?.maskedId || `${provider} Key #1`;

      logger.info(
        `Attempt ${totalAttempts} | Provider: ${provider} | Model: ${model} | Key: ${maskedKeyId} | Tool Capable: ${capability.supportsToolCalling ? "YES" : "NO"}`
      );

      try {
        // Resolve LanguageModel instance from customModelProvider
        const resolvedModel = customModelProvider.getModel({
          provider,
          model,
        });

        // Defensive tool preparation: sanitize tools for Groq if provider is Groq
        const toolsToPass =
          options.tools && provider === "groq"
            ? sanitizeToolsForGroq(options.tools)
            : options.tools;

        const promptParams = options.prompt
          ? { prompt: options.prompt }
          : { messages: options.messages };

        // Perform LLM execution
        const response = await generateText({
          model: resolvedModel,
          system: options.system,
          ...promptParams,
          tools: toolsToPass,
          stopWhen: stepCountIs(options.maxSteps || 5),
          abortSignal: options.abortSignal,
        });

        // Collect executed tool calls
        const executedToolCalls: Array<{ toolName: string; args: any; result: any }> = [];
        if (response.steps) {
          for (const step of response.steps) {
            if (step.toolCalls && step.toolCalls.length > 0) {
              for (const tc of step.toolCalls) {
                const tcAny = tc as any;
                const matchingResult = step.toolResults?.find(
                  (tr: any) =>
                    tr.toolCallId === tcAny.toolCallId ||
                    tr.toolName === tcAny.toolName
                );
                const rawOutput = matchingResult
                  ? (matchingResult as any).result ??
                    (matchingResult as any).output ??
                    matchingResult
                  : null;

                executedToolCalls.push({
                  toolName: tcAny.toolName,
                  args: tcAny.args || tcAny.parameters || tcAny.input || {},
                  result: rawOutput,
                });
              }
            }
          }
        }

        logger.info(
          `Success on attempt ${totalAttempts} using ${provider}/${model} (${maskedKeyId})`
        );

        return {
          text: response.text,
          toolCallsExecuted: executedToolCalls,
          providerUsed: provider,
          modelUsed: model,
          attemptsCount: totalAttempts,
          keyMaskedId: maskedKeyId,
          warnings: executionWarnings,
        };
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const retryable = isRetryableProviderError(err);
        const errStatus =
          err?.status ||
          err?.statusCode ||
          (err?.response && err?.response.status) ||
          (errMsg.includes("403") ? 403 : errMsg.includes("404") ? 404 : errMsg.includes("429") ? 429 : undefined);

        logger.warn(
          `Attempt ${totalAttempts} failed on ${provider}/${model} (${maskedKeyId}): ${errMsg} | Retryable: ${retryable}`
        );

        executionWarnings.push(
          `Attempt ${totalAttempts} failed on ${provider}/${model} (${maskedKeyId})`
        );

        if (provider === "google") {
          keyPoolManager.recordModelOutcome(maskedKeyId, model, {
            status: errStatus || (retryable ? 429 : 404),
            message: errMsg,
          });

          // If this key failed with 403 or 404 for this model,
          // check if there is ANOTHER Gemini key in the pool that is compatible!
          if (errStatus === 403 || errStatus === 404) {
            const alternateKeys = keyPoolManager.getCompatibleGeminiKeys(model);
            if (alternateKeys.length > 0 && kAttempt < maxKeyAttempts - 1) {
              const rotated = keyPoolManager.rotateGeminiKey(`HTTP ${errStatus}`, model);
              logger.warn(
                `Model ${model} unavailable on ${maskedKeyId} (HTTP ${errStatus}). Trying alternate key ${rotated?.maskedId || "next key"} (attempt ${kAttempt + 1}/${maxKeyAttempts})`
              );
              continue;
            }
          }
        }

        if (retryable) {
          // Rotate key if more keys available for this provider
          if (provider === "google") {
            keyPoolManager.rotateGeminiKey(errMsg, model);
          } else if (provider === "groq") {
            keyPoolManager.rotateGroqKey(errMsg);
          }
          // Continue to next key attempt
          continue;
        } else {
          // Non-retryable error across all keys for this specific model candidate
          // Break key loop and try next model candidate in chain
          break;
        }
      }
    }
  }

  // All candidates and keys exhausted: return controlled, safe error
  logger.error(
    `All ${totalAttempts} execution attempts across ${candidates.length} candidate models failed.`
  );

  throw new Error(
    `SagarDrishti-AI: All AI model providers temporarily unavailable after ${totalAttempts} attempts. Please retry your request shortly.`
  );
}

/**
 * Isolated Gemini Generation Interface (Step 7)
 */
export async function generateWithGemini(options: {
  model?: string;
  system?: string;
  messages: ModelMessage[];
  prompt?: string;
  tools?: Record<string, Tool>;
  maxSteps?: number;
  abortSignal?: AbortSignal;
}): Promise<RouterExecutionResult> {
  const chosenModel = options.model || GEMINI_CONFIGURED_NEW_MODEL;
  return generateWithProvider({
    model: { provider: "google", model: chosenModel },
    system: options.system,
    messages: options.messages,
    prompt: options.prompt,
    tools: options.tools,
    maxSteps: options.maxSteps,
    abortSignal: options.abortSignal,
  });
}
