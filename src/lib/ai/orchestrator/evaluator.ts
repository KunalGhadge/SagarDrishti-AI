import { ExecutionContext, SpecialistTaskResult } from "./types";

export interface EvaluationOutcome {
  isSufficient: boolean;
  reason: string;
  recommendedDeltaAction?: string;
}

export function evaluateExecutionResults(
  context: ExecutionContext,
  latestResults: SpecialistTaskResult[]
): EvaluationOutcome {
  // If we've reached max planning rounds, we must proceed to final synthesis
  if (context.round >= context.maxRounds) {
    return {
      isSufficient: true,
      reason: `Maximum planning rounds (${context.maxRounds}) reached. Proceeding to synthesis with available evidence.`,
    };
  }

  // Check for knowledge gap in multi-question queries (e.g. fish species or catching methods asked but not addressed)
  const queryLower = (context.userQuery || "").toLowerCase();
  const isSpeciesOrGearQuery = /species|fish type|what fish|which fish|catch type|gear|how to fish|how to catch|fishing method|net type/i.test(queryLower);
  const hasFisheriesEvidence = latestResults.some((r) =>
    r.taskId.includes("species") ||
    r.taskId.includes("fisheries") ||
    (typeof r.findings === "string" && /cmfri|icar|incois|species|pelagic|demersal|catch/i.test(r.findings))
  );

  if (isSpeciesOrGearQuery && !hasFisheriesEvidence && context.round === 1) {
    return {
      isSufficient: false,
      reason: "User query requested fish species/fishing method context not covered in primary oceanographic telemetry. Triggering authoritative fisheries knowledge research fallback.",
      recommendedDeltaAction: "fisheries_knowledge_fallback",
    };
  }

  // Count completed vs failed/unavailable
  const totalTasks = latestResults.length;
  const completedTasks = latestResults.filter((r) => r.status === "completed");
  const failedTasks = latestResults.filter((r) => r.status === "failed");

  // If at least half the specialist tasks succeeded with real evidence, we have sufficient basis for synthesis
  if (completedTasks.length > 0 && completedTasks.length >= totalTasks / 2) {
    return {
      isSufficient: true,
      reason: `Sufficient specialist evidence collected (${completedTasks.length}/${totalTasks} tasks completed).`,
    };
  }

  // If critical tasks failed on round 1 and we have rounds left, trigger re-evaluation
  if (context.round === 1 && failedTasks.length > 0) {
    return {
      isSufficient: false,
      reason: `Critical tasks failed: ${failedTasks.map((t) => t.taskId).join(", ")}. Triggering supplementary verification.`,
      recommendedDeltaAction: "fallback_verification",
    };
  }

  return {
    isSufficient: true,
    reason: "Evidence evaluated. Moving to final multi-agent synthesis.",
  };
}
