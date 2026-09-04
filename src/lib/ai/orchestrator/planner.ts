import { generateText, LanguageModel } from "ai";
import { Agent, AgentSummary } from "app-types/agent";
import { ExecutionPlan, PlannerTask, SpecialistTaskResult } from "./types";
import { generateUUID } from "lib/utils";
import { customModelProvider } from "../models";

export const MAX_TASKS_PER_PLAN = 8;
export const MAX_PLANNING_ROUNDS = 3;

export function detectCircularDependencies(tasks: PlannerTask[]): boolean {
  const graph = new Map<string, string[]>();
  for (const task of tasks) {
    graph.set(task.id, task.dependsOn || []);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(node: string): boolean {
    visited.add(node);
    recStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      if (hasCycle(task.id)) return true;
    }
  }

  return false;
}

export function findBestMatchingAgent(
  capabilityKeyword: string,
  availableAgents: (Agent | AgentSummary)[]
): (Agent | AgentSummary) | null {
  const kw = capabilityKeyword.toLowerCase();

  let bestAgent: (Agent | AgentSummary) | null = null;
  let highestScore = 0;

  for (const agent of availableAgents) {
    if (
      agent.id === "10000000-0000-4000-8000-000000000001" ||
      agent.name.toLowerCase().includes("planner") ||
      agent.name.toLowerCase().includes("orchestrator")
    ) {
      continue;
    }

    let score = 0;
    const name = agent.name.toLowerCase();
    const desc = (agent.description || "").toLowerCase();
    const role = ((agent as Agent).instructions?.role || "").toLowerCase();
    const mentions = (agent as Agent).instructions?.mentions || [];

    if (name.includes(kw)) score += 10;
    if (role.includes(kw)) score += 8;
    if (desc.includes(kw)) score += 5;

    for (const m of mentions) {
      const toolName = (m.name || "").toLowerCase();
      if (toolName.includes(kw)) score += 6;
      if (kw === "weather" && (toolName.includes("imd") || toolName.includes("weather"))) score += 7;
      if (kw === "ocean" && (toolName.includes("marine") || toolName.includes("physics"))) score += 7;
      if (kw === "chlorophyll" && toolName.includes("chlorophyll")) score += 10;
      if (kw === "cyclone" && toolName.includes("cyclone")) score += 10;
      if (kw === "safety" && (toolName.includes("map") || toolName.includes("safety"))) score += 6;
      if (kw === "emergency" && (toolName.includes("sos") || toolName.includes("emergency"))) score += 10;
      if (kw === "presentation" && (toolName.includes("table") || toolName.includes("chart"))) score += 6;
    }

    if (score > highestScore) {
      highestScore = score;
      bestAgent = agent;
    }
  }

  return bestAgent || (availableAgents.length > 0 ? availableAgents[0] : null);
}

export async function generateExecutionPlan(
  userQuery: string,
  availableAgents: (Agent | AgentSummary)[],
  context?: { location?: string; coordinates?: { latitude: number; longitude: number } },
  previousResults?: SpecialistTaskResult[],
  modelOverride?: LanguageModel
): Promise<ExecutionPlan> {
  const eligibleAgents = availableAgents.filter(
    (a) =>
      a.id !== "10000000-0000-4000-8000-000000000001" &&
      !a.name.toLowerCase().includes("planner") &&
      !a.name.toLowerCase().includes("orchestrator")
  );

  let model: LanguageModel | null = null;
  try {
    model = modelOverride || customModelProvider.getModel();
  } catch {
    model = null;
  }

  // 1. If LLM is available, attempt real Model-Driven Planning
  if (model && eligibleAgents.length > 0) {
    try {
      const agentCatalog = eligibleAgents.map((a) => {
        const mentions = (a as Agent).instructions?.mentions?.map((m) => m.name).join(", ") || "none";
        return `- Agent ID: "${a.id}", Name: "${a.name}", Role: "${(a as Agent).instructions?.role || a.name}", Description: "${a.description}", Tools: [${mentions}]`;
      }).join("\n");

      const plannerSystemPrompt = `You are the Master Maritime Planner Agent in the SagarDrishti-AI multi-agent platform.
Your job is to decompose the user's maritime/oceanographic query into a Directed Acyclic Graph (DAG) of specialist tasks.
You must choose ONLY from the available database agents catalog below.

AVAILABLE AGENTS CATALOG:
${agentCatalog}

RULES:
1. Break down the user request into logical sub-tasks.
2. Independent tasks (e.g. weather data, ocean physics data, cyclone checks) should have dependsOn: [] so they execute concurrently.
3. Downstream tasks (e.g. safety risk assessment, final synthesis) must list prerequisite task IDs in dependsOn: [...].
4. Multi-Question Queries: If the user asks for multiple outputs (e.g., fishing zones, productivity ranking, fish species / catch types, catching methods/gear, map views, route navigation/safety), create dedicated specialist tasks for each aspect without dropping any part.
5. Fish Species & Catch Methods: Satellite/ocean sensors do not conduct physical fish censuses. When species or gear are requested, assign a research task to the Ocean Analytics specialist or Supervisor using webSearch (Exa) prioritizing authoritative institutional sources (CMFRI, ICAR, INCOIS, Department of Fisheries, MPEDA, NIO, FAO).
6. Do NOT create circular dependencies.
7. Limit total tasks to at most 6.
8. Return ONLY a valid JSON object matching this schema:
{
  "goal": "...",
  "reasoning": "...",
  "tasks": [
    {
      "id": "unique_short_task_id",
      "agentId": "exact_agent_id_from_catalog",
      "agentName": "exact_agent_name",
      "objective": "specific task prompt for specialist",
      "dependsOn": []
    }
  ]
}`;

      const plannerUserPrompt = `USER QUERY: "${userQuery}"
CONTEXT: Location: ${context?.location || "Not specified"}, Coordinates: ${context?.coordinates ? `${context.coordinates.latitude}°N, ${context.coordinates.longitude}°E` : "Not specified"}
${previousResults && previousResults.length > 0 ? `PREVIOUS ROUND FINDINGS:\n${JSON.stringify(previousResults.map(r => ({ task: r.taskId, status: r.status, findings: r.findings })))}` : ""}

Generate the structured JSON execution plan now.`;

      const response = await generateText({
        model,
        system: plannerSystemPrompt,
        prompt: plannerUserPrompt,
      });

      // Extract JSON from response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
          const validatedTasks: PlannerTask[] = [];
          for (const rawTask of parsed.tasks) {
            const matchedAgent = eligibleAgents.find(
              (a) => a.id === rawTask.agentId || a.name.toLowerCase() === (rawTask.agentName || "").toLowerCase()
            );
            if (matchedAgent) {
              validatedTasks.push({
                id: String(rawTask.id),
                agentId: matchedAgent.id,
                agentName: matchedAgent.name,
                objective: String(rawTask.objective || `Execute analysis for ${matchedAgent.name}`),
                dependsOn: Array.isArray(rawTask.dependsOn) ? rawTask.dependsOn.map(String) : [],
                parameters: { location: context?.location, coordinates: context?.coordinates },
              });
            }
          }

          if (validatedTasks.length > 0 && !detectCircularDependencies(validatedTasks)) {
            return {
              planId: `plan_${generateUUID()}`,
              goal: parsed.goal || `Evaluate maritime intelligence for query: "${userQuery}"`,
              tasks: validatedTasks.slice(0, MAX_TASKS_PER_PLAN),
              reasoning: parsed.reasoning || "Generated by LLM Master Planner.",
              createdAt: new Date().toISOString(),
            };
          }
        }
      }
    } catch (llmPlanErr: any) {
      console.warn(`[PLANNER] LLM planning failed (${llmPlanErr.message}). Using capability graph generator.`);
    }
  }

  // 2. Capability Graph Generator (when LLM is not active or during capability tests)
  const queryLower = userQuery.toLowerCase();
  const tasks: PlannerTask[] = [];

  const isEmergency = /sos|distress|mayday|sinking|under attack|man overboard|emergency/i.test(queryLower);
  const isPfzQuery = /pfz|fishing zone|catch|tuna|productivity|chlorophyll|thermal front/i.test(queryLower);
  const isSpeciesOrGearQuery = /species|fish type|what fish|which fish|catch type|gear|how to fish|how to catch|fishing method|net type/i.test(queryLower);
  const isWeatherOnly = /weather|wind|rain|squall|barometer|temperature|humidity/i.test(queryLower) && !/wave|swell|tide/i.test(queryLower);
  const isOceanOnly = /wave|swell|sea state|current|sst|ocean/i.test(queryLower) && !/wind|cyclone/i.test(queryLower);

  if (isEmergency) {
    const emergencyAgent = findBestMatchingAgent("emergency", eligibleAgents) || eligibleAgents[0];
    const safetyAgent = findBestMatchingAgent("safety", eligibleAgents) || eligibleAgents[0];

    tasks.push({
      id: "emergency_distress_task",
      agentId: emergencyAgent.id,
      agentName: emergencyAgent.name,
      objective: "Initiate SOLAS emergency rescue protocol and identify nearest safe harbor",
      dependsOn: [],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });

    tasks.push({
      id: "emergency_geospatial_task",
      agentId: safetyAgent.id,
      agentName: safetyAgent.name,
      objective: "Plot distress location on tactical marine map and compute nearest coast guard station",
      dependsOn: ["emergency_distress_task"],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });

    const presAgent = findBestMatchingAgent("presentation", eligibleAgents) || eligibleAgents[0];
    tasks.push({
      id: "presentation_synthesis_task",
      agentId: presAgent.id,
      agentName: presAgent.name,
      objective: "Render tactical distress map (createMapView) with vessel coordinates and safe harbor bearing line, and provide Coast Guard MRCC 1554 rescue channels",
      dependsOn: ["emergency_geospatial_task"],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });
  } else if (isPfzQuery) {
    const oceanAgent = findBestMatchingAgent("ocean", eligibleAgents) || eligibleAgents[0];
    const weatherAgent = findBestMatchingAgent("weather", eligibleAgents) || eligibleAgents[0];
    const safetyAgent = findBestMatchingAgent("safety", eligibleAgents) || eligibleAgents[0];
    const presAgent = findBestMatchingAgent("presentation", eligibleAgents) || eligibleAgents[0];

    tasks.push({
      id: "ocean_bio_optics_task",
      agentId: oceanAgent.id,
      agentName: oceanAgent.name,
      objective: "Retrieve Sea Surface Temperature, NOAA Chlorophyll-a, and identify high-gradient thermal front PFZ coordinates",
      dependsOn: [],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });

    tasks.push({
      id: "weather_environmental_task",
      agentId: weatherAgent.id,
      agentName: weatherAgent.name,
      objective: "Verify sea-surface wind speed, visibility, and squall conditions at target fishing sector",
      dependsOn: [],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });

    tasks.push({
      id: "safety_fsa_task",
      agentId: safetyAgent.id,
      agentName: safetyAgent.name,
      objective: "Calculate IMO Formal Safety Assessment risk index and check distance to International Maritime Boundary Line",
      dependsOn: ["ocean_bio_optics_task", "weather_environmental_task"],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });

    if (isSpeciesOrGearQuery) {
      tasks.push({
        id: "fisheries_species_research_task",
        agentId: oceanAgent.id,
        agentName: oceanAgent.name,
        objective: `Research authoritative historical fisheries catch data and species distribution (CMFRI, ICAR, INCOIS, MPEDA) for ${context?.location || "target coastal sector"} and identify recommended fishing methods/gear. Note that real-time sensor censuses do not exist and species presence is not guaranteed.`,
        dependsOn: ["ocean_bio_optics_task"],
        parameters: { location: context?.location, coordinates: context?.coordinates },
      });
    }

    const presDepends = isSpeciesOrGearQuery
      ? ["safety_fsa_task", "fisheries_species_research_task"]
      : ["safety_fsa_task"];

    tasks.push({
      id: "presentation_synthesis_task",
      agentId: presAgent.id,
      agentName: presAgent.name,
      objective: "Synthesize PFZ coordinates, bearing, distance in NM, researched regional fisheries species, and interactive navigation map for fishermen",
      dependsOn: presDepends,
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });
  } else if (isWeatherOnly) {
    const weatherAgent = findBestMatchingAgent("weather", eligibleAgents) || eligibleAgents[0];
    const cycloneAgent = findBestMatchingAgent("cyclone", eligibleAgents) || weatherAgent;

    tasks.push({
      id: "weather_task",
      agentId: weatherAgent.id,
      agentName: weatherAgent.name,
      objective: "Assess coastal wind speed, gust velocities, atmospheric pressure, and squall nowcasts",
      dependsOn: [],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });

    tasks.push({
      id: "cyclone_check_task",
      agentId: cycloneAgent.id,
      agentName: cycloneAgent.name,
      objective: "Inspect active IMD storm bulletins and cyclone danger radii",
      dependsOn: [],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });
  } else if (isOceanOnly) {
    const oceanAgent = findBestMatchingAgent("ocean", eligibleAgents) || eligibleAgents[0];
    tasks.push({
      id: "ocean_state_task",
      agentId: oceanAgent.id,
      agentName: oceanAgent.name,
      objective: "Evaluate significant wave height, peak wave period, wave steepness, and ocean surface current velocity",
      dependsOn: [],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });
  } else {
    const weatherAgent = findBestMatchingAgent("weather", eligibleAgents) || eligibleAgents[0];
    const oceanAgent = findBestMatchingAgent("ocean", eligibleAgents) || eligibleAgents[0];
    const cycloneAgent = findBestMatchingAgent("cyclone", eligibleAgents) || weatherAgent;
    const safetyAgent = findBestMatchingAgent("safety", eligibleAgents) || eligibleAgents[0];
    const presAgent = findBestMatchingAgent("presentation", eligibleAgents) || eligibleAgents[0];

    tasks.push({
      id: "weather_assessment",
      agentId: weatherAgent.id,
      agentName: weatherAgent.name,
      objective: "Assess coastal surface wind speed, gust velocity, and barometric pressure trends",
      dependsOn: [],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });

    tasks.push({
      id: "ocean_state",
      agentId: oceanAgent.id,
      agentName: oceanAgent.name,
      objective: "Assess significant wave height, swell wave direction, and surface current velocities",
      dependsOn: [],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });

    tasks.push({
      id: "cyclone_check",
      agentId: cycloneAgent.id,
      agentName: cycloneAgent.name,
      objective: "Check official IMD cyclone tracks, gale radii, and active depression alerts",
      dependsOn: [],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });

    tasks.push({
      id: "geospatial_safety",
      agentId: safetyAgent.id,
      agentName: safetyAgent.name,
      objective: "Execute IMO Formal Safety Assessment risk matrix, check IMBL border distance and MPA restrictions",
      dependsOn: ["weather_assessment", "ocean_state", "cyclone_check"],
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });

    if (isSpeciesOrGearQuery) {
      tasks.push({
        id: "fisheries_species_research_task",
        agentId: oceanAgent.id,
        agentName: oceanAgent.name,
        objective: `Research authoritative historical fisheries catch data and species distribution (CMFRI, ICAR, INCOIS, MPEDA) for ${context?.location || "target coastal sector"} and identify recommended fishing methods/gear. Note that real-time sensor censuses do not exist and species presence is not guaranteed.`,
        dependsOn: ["ocean_state"],
        parameters: { location: context?.location, coordinates: context?.coordinates },
      });
    }

    const presDepends = isSpeciesOrGearQuery
      ? ["geospatial_safety", "fisheries_species_research_task"]
      : ["geospatial_safety"];

    tasks.push({
      id: "presentation_synthesis",
      agentId: presAgent.id,
      agentName: presAgent.name,
      objective: "Synthesize operational venture verdict (CODE GREEN/YELLOW/RED), small craft advisory, researched fisheries context, and parameter audit table",
      dependsOn: presDepends,
      parameters: { location: context?.location, coordinates: context?.coordinates },
    });
  }

  const boundedTasks = tasks.slice(0, MAX_TASKS_PER_PLAN);

  if (detectCircularDependencies(boundedTasks)) {
    throw new Error("Invalid plan generated: Circular task dependency detected!");
  }

  return {
    planId: `plan_${generateUUID()}`,
    goal: `Evaluate maritime intelligence and operational safety for user query: "${userQuery}"`,
    tasks: boundedTasks,
    reasoning: `Selected ${boundedTasks.length} specialist tasks dynamically based on agent capability registry in PostgreSQL.`,
    createdAt: new Date().toISOString(),
  };
}
