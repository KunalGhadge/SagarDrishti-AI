import { Agent, AgentSummary } from "app-types/agent";
import {
  ExecutionContext,
  ExecutionPlan,
  OrchestratorOptions,
  PlannerTask,
  SpecialistTaskResult,
  TaskStatus,
} from "./types";
import { executeSpecialistAgentLoop } from "../specialist/specialist-executor";

export const DEFAULT_TIMEOUT_MS = 15000;
export const DEFAULT_MAX_RETRIES = 1;

export async function executePlan(
  plan: ExecutionPlan,
  context: ExecutionContext,
  availableAgents: (Agent | AgentSummary)[],
  options: OrchestratorOptions = {}
): Promise<{
  taskResults: SpecialistTaskResult[];
  missingInformation: string[];
}> {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : DEFAULT_MAX_RETRIES;

  const agentMap = new Map<string, Agent | AgentSummary>();
  for (const agent of availableAgents) {
    agentMap.set(agent.id, agent);
  }

  const completedTaskIds = new Set<string>();
  const executedResults: SpecialistTaskResult[] = [];
  const missingInformation: string[] = [];

  const remainingTasks = new Map<string, PlannerTask>();
  for (const task of plan.tasks) {
    remainingTasks.set(task.id, task);
  }

  let waveNumber = 1;

  while (remainingTasks.size > 0) {
    // 1. Identify all tasks whose dependencies are met (or have no dependencies)
    const readyTasks: PlannerTask[] = [];
    for (const [, task] of remainingTasks.entries()) {
      const allDependenciesMet = (task.dependsOn || []).every((depId) =>
        completedTaskIds.has(depId)
      );
      if (allDependenciesMet) {
        readyTasks.push(task);
      }
    }

    if (readyTasks.length === 0) {
      // Unresolvable deadlock or broken dependency
      console.warn(
        `[ORCHESTRATOR] [${context.executionId}] Deadlock detected! Unresolved tasks:`,
        Array.from(remainingTasks.keys())
      );
      for (const [taskId, task] of remainingTasks.entries()) {
        const skippedResult: SpecialistTaskResult = {
          taskId,
          agentId: task.agentId,
          agentName: task.agentName,
          role: "Specialist",
          status: "skipped",
          objective: task.objective,
          findings: `Task skipped due to unresolved prerequisite dependencies: ${task.dependsOn.join(", ")}`,
          toolCalls: [],
          sources: [],
          errors: ["Prerequisite dependency failure"],
          llmInvoked: false,
          llmSteps: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
        };
        executedResults.push(skippedResult);
        context.results.set(taskId, skippedResult);
        completedTaskIds.add(taskId);
      }
      break;
    }

    console.log(
      `[ORCHESTRATOR] [${context.executionId}] Wave ${waveNumber}: Executing ${readyTasks.length} task(s) concurrently: [${readyTasks.map((t) => t.id).join(", ")}]`
    );

    // 2. Execute ready tasks concurrently
    const taskPromises = readyTasks.map(async (task) => {
      const agent = agentMap.get(task.agentId) || availableAgents.find((a) => a.name === task.agentName);
      if (!agent) {
        const missingAgentResult: SpecialistTaskResult = {
          taskId: task.id,
          agentId: task.agentId,
          agentName: task.agentName,
          role: "Unknown",
          status: "failed",
          objective: task.objective,
          findings: `Assigned agent [${task.agentId}] (${task.agentName}) is not present in PostgreSQL agent registry.`,
          toolCalls: [],
          sources: [],
          errors: ["Agent not found in database"],
          llmInvoked: false,
          llmSteps: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
        };
        missingInformation.push(`Agent for task ${task.id} (${task.agentName}) unavailable.`);
        return missingAgentResult;
      }

      // Collect context from completed prerequisite tasks
      const prerequisiteContextSnippets: string[] = [];
      for (const depId of task.dependsOn || []) {
        const prevRes = context.results.get(depId);
        if (prevRes) {
          prerequisiteContextSnippets.push(
            `[Prerequisite Task: ${prevRes.agentName} (${prevRes.status})]\n${prevRes.findings}`
          );
        }
      }

      const startedAt = new Date();
      let attempt = 0;
      let lastError: any = null;

      while (attempt <= maxRetries) {
        attempt++;
        try {
          // Timeout race wrapper
          const executionPromise = executeSpecialistAgentLoop({
            agent,
            task: task.objective,
            context: {
              location: task.parameters?.location || context.locationName,
              coordinates: task.parameters?.coordinates || context.userLocation,
              userLocation: context.userLocation,
              chatHistorySnippet: prerequisiteContextSnippets.join("\n\n"),
            },
            model: options.model,
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Specialist execution timed out after ${timeoutMs}ms`)),
              timeoutMs
            )
          );

          const specialistOutput = await Promise.race([executionPromise, timeoutPromise]);
          const completedAt = new Date();
          const durationMs = completedAt.getTime() - startedAt.getTime();

          const taskStatus: TaskStatus =
            specialistOutput.status === "success"
              ? "completed"
              : specialistOutput.status === "model_unavailable"
              ? "model_unavailable"
              : specialistOutput.status === "unavailable"
              ? "unavailable"
              : "failed";

          const sources: string[] = [];
          if (specialistOutput.toolCallsExecuted) {
            for (const tc of specialistOutput.toolCallsExecuted) {
              if (tc.result && typeof tc.result === "object" && tc.result.source) {
                sources.push(String(tc.result.source));
              }
            }
          }

          if (taskStatus === "unavailable" || taskStatus === "model_unavailable") {
            missingInformation.push(`Telemetry for ${task.agentName} was unavailable (${specialistOutput.findings}).`);
          }

          console.log(
            `[AGENT] [${context.executionId}] Task '${task.id}' (${task.agentName}) finished with status: ${taskStatus} (${durationMs}ms, ${specialistOutput.llmSteps} step(s))`
          );

          return {
            taskId: task.id,
            agentId: agent.id,
            agentName: agent.name,
            role: (agent as Agent).instructions?.role || agent.name,
            status: taskStatus,
            objective: task.objective,
            findings: specialistOutput.findings,
            toolCalls: specialistOutput.toolCallsExecuted || [],
            sources,
            errors: specialistOutput.warnings.length > 0 ? specialistOutput.warnings : undefined,
            llmInvoked: specialistOutput.llmInvoked,
            llmSteps: specialistOutput.llmSteps,
            startedAt: startedAt.toISOString(),
            completedAt: completedAt.toISOString(),
            durationMs,
          } as SpecialistTaskResult;
        } catch (err: any) {
          lastError = err;
          if (attempt <= maxRetries) {
            console.warn(`[ORCHESTRATOR] Retrying task '${task.id}' (Attempt ${attempt + 1})...`);
          }
        }
      }

      // Max retries exceeded
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      missingInformation.push(`Task ${task.id} failed after ${maxRetries + 1} attempt(s): ${lastError?.message}`);

      return {
        taskId: task.id,
        agentId: agent.id,
        agentName: agent.name,
        role: (agent as Agent).instructions?.role || agent.name,
        status: "failed",
        objective: task.objective,
        findings: `Execution failed: ${lastError?.message}`,
        toolCalls: [],
        sources: [],
        errors: [lastError?.message || "Unknown execution error"],
        llmInvoked: true,
        llmSteps: 0,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs,
      } as SpecialistTaskResult;
    });

    const waveResults = await Promise.all(taskPromises);

    // 3. Store results and advance wave
    for (const res of waveResults) {
      executedResults.push(res);
      context.results.set(res.taskId, res);
      completedTaskIds.add(res.taskId);
      remainingTasks.delete(res.taskId);
    }

    waveNumber++;
  }

  return {
    taskResults: executedResults,
    missingInformation,
  };
}
