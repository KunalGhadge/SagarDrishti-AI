import { generateText, stepCountIs, LanguageModel, UIMessageStreamWriter } from "ai";
import { Agent, AgentSummary } from "app-types/agent";
import { resolveToolsForAgent } from "../tools/tool-kit";
import { customModelProvider } from "../models";
import { safeParseToolArguments } from "../tool-repair";
import { generateWithProvider } from "../central-model-router";
import { resolveNearbyVerifiedPorts } from "../engines/marine-geospatial-engine";

export interface SpecialistExecutionInput {
  agent: Agent | AgentSummary | any;
  task: string;
  context?: {
    location?: string;
    coordinates?: { latitude: number; longitude: number };
    userLocation?: { latitude: number; longitude: number };
    chatHistorySnippet?: string;
  };
  model?: LanguageModel;
  dataStream?: UIMessageStreamWriter;
  maxSteps?: number;
}

export interface SpecialistExecutionResult {
  agentId: string;
  specialistName: string;
  role: string;
  status: "success" | "unavailable" | "error" | "model_unavailable";
  task: string;
  findings: string;
  toolCallsExecuted: Array<{
    toolName: string;
    args: any;
    result: any;
  }>;
  mountedTools: string[];
  unmountedConfiguredTools: string[];
  llmInvoked: boolean;
  llmSteps: number;
  warnings: string[];
  executionDurationMs?: number;
  agentIcon?: string;
}

export async function executeSpecialistAgentLoop(
  input: SpecialistExecutionInput
): Promise<SpecialistExecutionResult> {
  const startTime = Date.now();
  const { agent, task, context, maxSteps = 5 } = input;
  const agentInstructions = (agent as Agent).instructions;
  const agentRole = agentInstructions?.role || agent.name;
  const systemPrompt =
    agentInstructions?.systemPrompt ||
    `You are the ${agent.name} (${agentRole}), an autonomous specialist in the SagarDrishti-AI marine intelligence platform.
Your mandate is to analyze marine, meteorological, oceanographic, and geospatial data with zero fabrication.
Always base conclusions strictly on real tool outputs. If a data source is unavailable, explicitly state that it is unavailable.`;

  // 1. Dynamically resolve tools assigned to this agent in PostgreSQL
  const { mountedTools, mountedToolNames, unmountedConfiguredTools } =
    resolveToolsForAgent(agentInstructions?.mentions);

  const effectiveCoords = context?.coordinates || context?.userLocation;
  const locationContextStr = effectiveCoords
    ? `Target coordinates: ${effectiveCoords.latitude.toFixed(4)}°N, ${effectiveCoords.longitude.toFixed(4)}°E.`
    : context?.location
    ? `Target coastal zone / harbor: ${context.location}.`
    : "No explicit location provided. Use device GPS or target coastal harbor if required.";

  let portContextStr = "";
  if (
    effectiveCoords &&
    (task.toLowerCase().includes("port") ||
      task.toLowerCase().includes("harbor") ||
      task.toLowerCase().includes("dock") ||
      task.toLowerCase().includes("safe") ||
      agentRole.toLowerCase().includes("safety") ||
      agentRole.toLowerCase().includes("rescue"))
  ) {
    const nearbyPorts = resolveNearbyVerifiedPorts(effectiveCoords, 3);
    portContextStr =
      `\nOfficial Verified Indian Major Ports (Ministry of Ports, Shipping and Waterways):\n` +
      nearbyPorts
        .map(
          (p, idx) =>
            `${idx + 1}. ${p.name} (${p.state}) — Distance: ${p.distanceNM} NM (${p.distanceKm} km), Bearing: ${p.bearing}, Authority: ${p.authority}, MRCC: ${p.assignedMrcc}`
        )
        .join("\n");
  }

  const fullUserPrompt = `TASK FROM SUPERVISOR / PLANNER:
"${task}"

CONTEXT:
${locationContextStr}
${portContextStr}
${context?.chatHistorySnippet ? `Previous Upstream Findings:\n${context.chatHistorySnippet}` : ""}

Please use your dynamically mounted tools to retrieve necessary data, perform analysis, and synthesize your specialist findings.`;

  const warnings: string[] = [];
  if (unmountedConfiguredTools.length > 0) {
    warnings.push(
      `The following configured tools are unavailable in the runtime registry: ${unmountedConfiguredTools.join(", ")}`
    );
  }

  // 2. Resolve active LanguageModel
  let model: LanguageModel | null = null;
  try {
    model = input.model || customModelProvider.getModel();
  } catch (err: any) {
    warnings.push(`Model provider resolution error: ${err.message}`);
  }

  if (!model) {
    return {
      agentId: agent.id,
      specialistName: agent.name,
      role: agentRole,
      status: "model_unavailable",
      task,
      findings: "Specialist execution halted: No active LanguageModel could be resolved.",
      toolCallsExecuted: [],
      mountedTools: mountedToolNames,
      unmountedConfiguredTools,
      llmInvoked: false,
      llmSteps: 0,
      warnings: [...warnings, "No active LanguageModel resolved"],
    };
  }

  // 3. Execute Real Autonomous LLM Tool Loop
  try {
    const llmResult = await generateText({
      model,
      system: systemPrompt,
      prompt: fullUserPrompt,
      tools: mountedTools,
      stopWhen: stepCountIs(maxSteps),
    });

    const executedToolCalls: Array<{ toolName: string; args: any; result: any }> = [];
    if (llmResult.steps) {
      for (const step of llmResult.steps) {
        if (step.toolCalls && step.toolCalls.length > 0) {
          for (const tc of step.toolCalls) {
            const tcAny = tc as any;
            const matchingResult = step.toolResults?.find(
              (tr: any) => tr.toolCallId === tcAny.toolCallId || tr.toolName === tcAny.toolName
            );
            const rawOutput = matchingResult
              ? (matchingResult as any).result ?? (matchingResult as any).output ?? matchingResult
              : null;

            executedToolCalls.push({
              toolName: tcAny.toolName,
              args: safeParseToolArguments(tcAny.args || tcAny.parameters || tcAny.input || {}),
              result: rawOutput,
            });
          }
        }
      }
    }

    return {
      agentId: agent.id,
      specialistName: agent.name,
      role: agentRole,
      status: "success",
      task,
      findings: llmResult.text || "Specialist analysis completed.",
      toolCallsExecuted: executedToolCalls,
      mountedTools: mountedToolNames,
      unmountedConfiguredTools,
      llmInvoked: true,
      llmSteps: llmResult.steps?.length || 1,
      warnings,
      executionDurationMs: Date.now() - startTime,
      agentIcon: (agent.icon as any)?.value ?? "🤖",
    };
  } catch (llmError: any) {
    console.warn(`[SPECIALIST AGENT WARN] [${agent.name}]: Primary generation failed (${llmError.message}). Attempting centralized failover.`);
    try {
      const failoverResult = await generateWithProvider({
        system: systemPrompt,
        prompt: fullUserPrompt,
        messages: [{ role: "user", content: fullUserPrompt }],
        tools: mountedTools,
        maxSteps,
        requireTools: Object.keys(mountedTools).length > 0,
      });

      return {
        agentId: agent.id,
        specialistName: agent.name,
        role: agentRole,
        status: "success",
        task,
        findings: failoverResult.text || "Specialist analysis completed via failover router.",
        toolCallsExecuted: failoverResult.toolCallsExecuted,
        mountedTools: mountedToolNames,
        unmountedConfiguredTools,
        llmInvoked: true,
        llmSteps: failoverResult.toolCallsExecuted.length + 1,
        warnings: [...warnings, ...failoverResult.warnings],
        executionDurationMs: Date.now() - startTime,
        agentIcon: (agent.icon as any)?.value ?? "🤖",
      };
    } catch (fallbackError: any) {
      console.error(`[SPECIALIST AGENT ERROR] [${agent.name}]: All model attempts failed:`, fallbackError.message);
      return {
        agentId: agent.id,
        specialistName: agent.name,
        role: agentRole,
        status: "error",
        task,
        findings: `Specialist LLM execution failed: ${fallbackError.message}`,
        toolCallsExecuted: [],
        mountedTools: mountedToolNames,
        unmountedConfiguredTools,
        llmInvoked: true,
        llmSteps: 0,
        warnings: [...warnings, fallbackError.message],
        executionDurationMs: Date.now() - startTime,
        agentIcon: (agent.icon as any)?.value ?? "🤖",
      };
    }
  }
}
