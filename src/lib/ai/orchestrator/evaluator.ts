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

  // Check for multi-part query completion: all meaningful sub-questions must be answered or attempted
  const queryLower = (context.userQuery || "").toLowerCase();
  const isPortQuery = /port|harbor|dock|jetty|haven|anchorage/i.test(queryLower);
  const isSafetyQuery = /safe|safety|go there|venture|risk|caution/i.test(queryLower);
  const isSpeciesOrGearQuery = /species|fish type|what fish|which fish|catch type|gear|how to fish|how to catch|fishing method|net type/i.test(queryLower);
  const isRouteOrMapQuery = /map|route|heading|bearing|navigation|waypoint|passage|course/i.test(queryLower);

  const completedResults = latestResults.filter((r) => r.status === "completed");

  const hasPortEvidence = completedResults.some(
    (r) =>
      r.taskId.includes("port") ||
      r.taskId.includes("harbor") ||
      (typeof r.findings === "string" && /port|harbor|dock|deendayal|mumbai port|jnpa|mormugao/i.test(r.findings))
  );

  const hasSafetyEvidence = completedResults.some(
    (r) =>
      r.taskId.includes("safe") ||
      r.taskId.includes("risk") ||
      (typeof r.findings === "string" && /code green|code yellow|code orange|code red|risk index|advisory/i.test(r.findings))
  );

  const hasFisheriesEvidence = completedResults.some(
    (r) =>
      r.taskId.includes("species") ||
      r.taskId.includes("fisheries") ||
      (typeof r.findings === "string" && /cmfri|icar|mpeda|species reported|dominant catch/i.test(r.findings))
  );

  const hasRouteOrMapEvidence = completedResults.some(
    (r) =>
      r.taskId.includes("route") ||
      r.taskId.includes("map") ||
      r.taskId.includes("synthesis") ||
      r.toolCalls?.some((tc: any) => tc.toolName === "createMapView") ||
      (typeof r.findings === "string" && /route|bearing|heading|map/i.test(r.findings))
  );

  if (context.round === 1) {
    if (isPortQuery && !hasPortEvidence) {
      return {
        isSufficient: false,
        reason: "Port information requested but not yet covered. Triggering port navigation discovery.",
        recommendedDeltaAction: "port_discovery",
      };
    }

    if (isSafetyQuery && !hasSafetyEvidence) {
      return {
        isSufficient: false,
        reason: "Maritime safety verdict requested but not yet completed. Triggering IMO Formal Safety Assessment.",
        recommendedDeltaAction: "safety_evaluation",
      };
    }

    if (isSpeciesOrGearQuery && !hasFisheriesEvidence) {
      return {
        isSufficient: false,
        reason: "User query requested fish species/fishing method context not covered in primary oceanographic telemetry. Triggering authoritative fisheries knowledge research fallback.",
        recommendedDeltaAction: "fisheries_knowledge_fallback",
      };
    }

    if (isRouteOrMapQuery && !hasRouteOrMapEvidence) {
      return {
        isSufficient: false,
        reason: "Route or map visualization requested but not yet synthesized. Triggering route navigation synthesis.",
        recommendedDeltaAction: "route_synthesis",
      };
    }
  }

  // Count completed vs failed/unavailable
  const totalTasks = latestResults.length;
  const completedTasks = latestResults.filter((r) => r.status === "completed");
  const failedTasks = latestResults.filter((r) => r.status === "failed");

  // If critical tasks failed on round 1 and we have rounds left, trigger re-evaluation
  if (context.round === 1 && failedTasks.length > 0 && completedTasks.length < totalTasks / 2) {
    return {
      isSufficient: false,
      reason: `Critical tasks failed: ${failedTasks.map((t) => t.taskId).join(", ")}. Triggering supplementary verification.`,
      recommendedDeltaAction: "fallback_verification",
    };
  }

  return {
    isSufficient: true,
    reason: `Sufficient multi-agent evidence collected (${completedTasks.length}/${totalTasks} tasks completed). Moving to final synthesis.`,
  };
}
