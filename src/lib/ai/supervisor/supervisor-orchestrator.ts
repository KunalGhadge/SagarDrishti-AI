import { z } from "zod";
import { tool as createTool, Tool, UIMessageStreamWriter } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";
import { Agent, AgentSummary } from "app-types/agent";
import {
  SAGARDRISHTI_PRESEEDED_AGENTS,
  SLUG_TO_UUID_MAP,
} from "lib/ai/marine-agents-seed";
import { executeSpecialistAgentLoop, SpecialistExecutionResult } from "../specialist/specialist-executor";
import { runOrchestratedWorkflow } from "../orchestrator";

export interface DynamicAgentDelegationParams {
  query: string;
  location?: string;
  coordinates?: { latitude: number; longitude: number };
  specificParameters?: Record<string, any>;
}

export const agentDelegationSchema: JSONSchema7 = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Direct specific instruction for the specialist agent to execute",
    },
    location: {
      type: "string",
      description: "Target maritime harbor, port, or coastal zone",
    },
    coordinates: {
      type: "object",
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
      },
      required: ["latitude", "longitude"],
      description: "Precise latitude and longitude of the operation sector",
    },
    specificParameters: {
      type: "object",
      description: "Specialized context parameters",
    },
  },
  required: ["query"],
};

export function createMarineSupervisorTools(
  dataStream?: UIMessageStreamWriter,
  userLocation?: { latitude: number; longitude: number },
  configuredAgents?: (Agent | AgentSummary)[],
  model?: any
): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  // 1. Device Location Tool
  tools["get_device_live_location"] = createTool({
    description:
      "Retrieves the live GPS coordinates (latitude, longitude, coastal harbor) from the user's connected vessel or client device.",
    inputSchema: z.object({}),
    execute: async () => {
      if (userLocation) {
        return {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          status: "connected",
          isLive: true,
        };
      }
      return {
        latitude: null,
        longitude: null,
        status: "disconnected",
        message: "Device GPS coordinates not yet shared. Please grant browser location access or provide nearest port.",
        isLive: false,
      };
    },
  });

  // 2. Resolve dynamic agent list (always ensuring canonical codebase instructions & tools for system agents)
  const agentList = (configuredAgents && configuredAgents.length > 0)
    ? configuredAgents.map((a) => {
        const canonical = SAGARDRISHTI_PRESEEDED_AGENTS.find(
          (seed) => seed.id === a.id || SLUG_TO_UUID_MAP[seed.id] === a.id
        );
        if (canonical && canonical.instructions) {
          return {
            ...a,
            instructions: {
              ...(a as Agent).instructions,
              systemPrompt: canonical.instructions.systemPrompt,
              mentions: canonical.instructions.mentions,
            },
          };
        }
        return a;
      })
    : SAGARDRISHTI_PRESEEDED_AGENTS;

  // 3. Master Multi-Agent Planner & Orchestrator Tool
  tools["execute_orchestrated_marine_plan"] = createTool({
    description:
      "INTERNAL BATCH ENGINE ONLY: Headless automated DAG runner. In interactive chat, DO NOT call this tool; instead, invoke the specific specialist agent tools (delegate_to_...) step-by-step to demonstrate observable multi-agent collaboration cards to the user.",
    inputSchema: z.object({
      query: z.string().describe("User's maritime, fishing, weather, or navigational query"),
      location: z.string().optional().describe("Target coastal city, harbor, or sector"),
      coordinates: z
        .object({
          latitude: z.number(),
          longitude: z.number(),
        })
        .optional()
        .describe("Target geographic coordinates"),
    }),
    execute: async ({ query, location, coordinates }) => {
      const effectiveCoords = coordinates || userLocation;
      const result = await runOrchestratedWorkflow(
        query,
        agentList as (Agent | AgentSummary)[],
        {
          userLocation: effectiveCoords,
          model,
        }
      );
      return result;
    },
  });

  // 4. Individual Dynamic Specialist Delegation Tools
  for (const agent of agentList) {
    // Exclude top-level orchestrator from delegation tools
    if (
      agent.id === "marine-planner-orchestrator" ||
      agent.id === "10000000-0000-4000-8000-000000000001" ||
      agent.name.toLowerCase().includes("planner") ||
      agent.name.toLowerCase().includes("orchestrator")
    ) {
      continue;
    }

    const safeToolKey = `delegate_to_${agent.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    const agentRole = (agent as Agent).instructions?.role || agent.name;
    const agentDesc = agent.description || `Specialist agent for ${agentRole}`;

    tools[safeToolKey] = createTool({
      description: `Delegates a task to the ${agent.name} (${(agent.icon as any)?.value ?? "🤖"}). ${agentDesc}`,
      inputSchema: jsonSchemaToZod(agentDelegationSchema),
      execute: async ({ query, location, coordinates, specificParameters = {} }) => {
        return safe(async () => {
          const effectiveCoords = coordinates || userLocation;
          const specialistResult: SpecialistExecutionResult = await executeSpecialistAgentLoop({
            agent,
            task: query,
            context: {
              location,
              coordinates: effectiveCoords,
              userLocation,
            },
            model,
            dataStream,
          });

          return specialistResult;
        })
          .ifFail((err) => ({
            agentId: agent.id,
            specialistName: agent.name,
            role: agentRole,
            status: "error" as const,
            task: query,
            findings: `Specialist execution failed: ${err.message}`,
            toolCallsExecuted: [],
            mountedTools: [],
            unmountedConfiguredTools: [],
            warnings: [err.message],
          }))
          .unwrap();
      },
    });
  }

  return tools;
}

export const buildSupervisorTools = createMarineSupervisorTools;
