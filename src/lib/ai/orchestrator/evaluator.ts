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
