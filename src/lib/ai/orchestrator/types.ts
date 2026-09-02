import { LanguageModel } from "ai";

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "unavailable"
  | "model_unavailable"
  | "skipped";

export interface PlannerTask {
  id: string;
  agentId: string;
  agentName: string;
  objective: string;
  dependsOn: string[];
  parameters?: Record<string, any>;
}

export interface ExecutionPlan {
  planId: string;
  goal: string;
  tasks: PlannerTask[];
  reasoning?: string;
  createdAt: string;
}

export interface SpecialistTaskResult {
  taskId: string;
  agentId: string;
  agentName: string;
  role: string;
  status: TaskStatus;
  objective: string;
  findings: string;
  toolCalls: Array<{
    toolName: string;
    args: any;
    result: any;
  }>;
  evidence?: any;
  sources: string[];
  errors?: string[];
  llmInvoked?: boolean;
  llmSteps?: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface ExecutionContext {
  executionId: string;
  userQuery: string;
  userLocation?: { latitude: number; longitude: number };
  locationName?: string;
  results: Map<string, SpecialistTaskResult>;
  planHistory: ExecutionPlan[];
  round: number;
  maxRounds: number;
}

export interface OrchestrationResult {
  executionId: string;
  status: "success" | "partial_success" | "failed";
  finalSynthesis: string;
  plan: ExecutionPlan;
  taskResults: SpecialistTaskResult[];
  missingInformation: string[];
  executionTimeMs: number;
}

export interface OrchestratorOptions {
  model?: LanguageModel;
  timeoutMs?: number;
  maxRetries?: number;
  maxPlanningRounds?: number;
  maxTasksPerPlan?: number;
  userLocation?: { latitude: number; longitude: number };
}
