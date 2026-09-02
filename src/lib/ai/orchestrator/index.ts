import { Agent, AgentSummary } from "app-types/agent";
import {
  ExecutionContext,
  ExecutionPlan,
  OrchestrationResult,
  OrchestratorOptions,
  SpecialistTaskResult,
} from "./types";
import { generateExecutionPlan, MAX_PLANNING_ROUNDS } from "./planner";
import { executePlan } from "./orchestrator";
import { evaluateExecutionResults } from "./evaluator";
import { synthesizeOrchestrationResponse } from "./synthesizer";
import { generateUUID } from "lib/utils";

export * from "./types";
export * from "./planner";
export * from "./orchestrator";
export * from "./evaluator";
export * from "./synthesizer";

export async function runOrchestratedWorkflow(
  userQuery: string,
  availableAgents: (Agent | AgentSummary)[],
  options: OrchestratorOptions = {}
): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const executionId = `exec_${generateUUID()}`;
  const maxRounds = options.maxPlanningRounds || MAX_PLANNING_ROUNDS;

  console.log(`[ORCHESTRATOR] [${executionId}] Execution started for query: "${userQuery}"`);

  const context: ExecutionContext = {
    executionId,
    userQuery,
    userLocation: options.userLocation,
    results: new Map<string, SpecialistTaskResult>(),
    planHistory: [],
    round: 1,
    maxRounds,
  };

  const allTaskResults: SpecialistTaskResult[] = [];
  const allMissingInfo: string[] = [];

  // Round 1: Generate & Execute Initial Plan
  let currentPlan: ExecutionPlan = await generateExecutionPlan(
    userQuery,
    availableAgents,
    { coordinates: options.userLocation },
    undefined,
    options.model
  );
  context.planHistory.push(currentPlan);

  console.log(
    `[PLANNER] [${executionId}] Initial plan '${currentPlan.planId}' generated with ${currentPlan.tasks.length} task(s): [${currentPlan.tasks.map((t) => t.id).join(", ")}]`
  );

  while (context.round <= maxRounds) {
    console.log(`[ORCHESTRATOR] [${executionId}] Starting Round ${context.round} execution...`);

    const { taskResults, missingInformation } = await executePlan(
      currentPlan,
      context,
      availableAgents,
      options
    );

    allTaskResults.push(...taskResults);
    allMissingInfo.push(...missingInformation);

    const evaluation = evaluateExecutionResults(context, taskResults);
    console.log(
      `[PLANNER] [${executionId}] Round ${context.round} evaluation: ${evaluation.reason} (Sufficient: ${evaluation.isSufficient})`
    );

    if (evaluation.isSufficient || context.round >= maxRounds) {
      break;
    }

    // Generate delta re-evaluation plan
    context.round++;
    currentPlan = await generateExecutionPlan(
      userQuery,
      availableAgents,
      { coordinates: options.userLocation },
      allTaskResults,
      options.model
    );
    context.planHistory.push(currentPlan);
    console.log(
      `[PLANNER] [${executionId}] Delta re-evaluation plan generated for Round ${context.round} with ${currentPlan.tasks.length} task(s)`
    );
  }

  // Final Multi-Agent Synthesis
  console.log(`[SYNTHESIS] [${executionId}] Synthesizing final multi-agent response...`);
  const finalSynthesis = synthesizeOrchestrationResponse(
    userQuery,
    context.planHistory[0],
    allTaskResults,
    allMissingInfo
  );

  const totalDurationMs = Date.now() - startTime;
  console.log(`[ORCHESTRATOR] [${executionId}] Execution completed in ${totalDurationMs}ms.`);

  const hasSuccess = allTaskResults.some((r) => r.status === "completed");
  const hasFailure = allTaskResults.some((r) => r.status === "failed" || r.status === "model_unavailable");

  return {
    executionId,
    status: hasSuccess && !hasFailure ? "success" : hasSuccess ? "partial_success" : "failed",
    finalSynthesis,
    plan: context.planHistory[0],
    taskResults: allTaskResults,
    missingInformation: Array.from(new Set(allMissingInfo)),
    executionTimeMs: totalDurationMs,
  };
}
