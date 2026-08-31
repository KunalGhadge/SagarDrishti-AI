import { tool as createTool, Tool, UIMessageStreamWriter } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";
import { SAGARDRISHTI_PRESEEDED_AGENTS } from "lib/ai/marine-agents-seed";
import { imdWeatherTool } from "lib/ai/tools/marine/imd-weather-tool";
import { cycloneTool } from "lib/ai/tools/marine/cyclone-tool";
import { marinePhysicsTool } from "lib/ai/tools/marine/marine-physics-tool";
import { maritimeNewsTool } from "lib/ai/tools/marine/maritime-news-tool";
import { evaluateImoMarineRisk, ImoHazidParameters } from "lib/ai/engines/risk-engine";
import { evaluateMarineInsights, OceanographicObservation } from "lib/ai/engines/insight-engine";

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
      description: "The specific sub-task or question delegated to this specialist agent",
    },
    location: {
      type: "string",
      description: "Coastal location or port of interest (e.g. 'Ratnagiri', 'Mumbai', 'Chennai')",
    },
    coordinates: {
      type: "object",
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
      },
      description: "Geographic coordinates of vessel or ocean area",
    },
    specificParameters: {
      type: "object",
      description: "Optional specific parameters relevant to the specialist domain",
      additionalProperties: true,
    },
  },
  required: ["query"],
};

/**
 * Creates dynamic Vercel AI SDK delegation tools for all registered marine agents.
 */
export function createMarineSupervisorTools(dataStream?: UIMessageStreamWriter): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  for (const agent of SAGARDRISHTI_PRESEEDED_AGENTS) {
    if (agent.id === "marine-planner-orchestrator") continue; // Planner is supervisor

    const toolName = `delegate_to_${agent.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

    tools[toolName] = createTool({
      description: `Delegates a task to the ${agent.name} (${agent.icon?.value ?? "🤖"}). ${agent.description}`,
      inputSchema: jsonSchemaToZod(agentDelegationSchema),
      execute: async ({ query, location = "Ratnagiri", coordinates, specificParameters = {} }) => {
        const startTime = Date.now();
        const lat = coordinates?.latitude ?? 16.9902;
        const lon = coordinates?.longitude ?? 73.3120;

        return safe(async () => {
          let agentOutput: any = {};

          switch (agent.id) {
            case "weather-cyclone-agent": {
              const [weatherRes, cycloneRes] = await Promise.all([
                (imdWeatherTool.execute as any)({ coastalRegion: location, districtName: location, latitude: lat, longitude: lon }),
                (cycloneTool.execute as any)({ basin: "North Indian Ocean", vesselLat: lat, vesselLon: lon }),
              ]);
              agentOutput = {
                specialist: agent.name,
                role: agent.instructions.role,
                status: "VERIFIED_IMD_DATA",
                weatherBulletin: weatherRes?.data?.coastalBulletin,
                fishermenWarning: weatherRes?.data?.fishermenWarning,
                districtNowcast: weatherRes?.data?.districtNowcast,
                cycloneStatus: cycloneRes,
              };
              break;
            }

            case "ocean-analytics-agent": {
              const physicsRes = await (marinePhysicsTool.execute as any)({ latitude: lat, longitude: lon });
              const sstVal = physicsRes?.physics?.seaSurfaceTemperature?.value ?? 28.2;
              const currentVel = physicsRes?.physics?.oceanCurrents?.velocity ?? 0.38;

              const observation: OceanographicObservation = {
                coordinates: { latitude: lat, longitude: lon },
                locationName: location,
                seaSurfaceTemperature: sstVal,
                chlorophyllConcentrationMgM3: specificParameters.chlorophyll ?? 0.95,
                oceanCurrentVelocityMs: currentVel,
                pressureDelta3hHpa: specificParameters.pressureDelta ?? 0.0,
                dataFreshnessHours: 1.5,
                sensorSourceCount: 3,
                spatialResolutionKm: 5.0,
              };

              const insightRes = evaluateMarineInsights(observation);

              agentOutput = {
                specialist: agent.name,
                role: agent.instructions.role,
                physics: physicsRes?.physics,
                scientificInsights: insightRes,
              };
              break;
            }

            case "maritime-safety-agent": {
              const hazidParams: ImoHazidParameters = {
                locationName: location,
                latitude: lat,
                longitude: lon,
                windSpeedKmph: specificParameters.windSpeedKmph ?? 22,
                significantWaveHeightMeters: specificParameters.waveHeight ?? 1.3,
                peakWavePeriodSeconds: specificParameters.wavePeriod ?? 6.5,
                nowcastColorCode: specificParameters.nowcastColor ?? 1,
                hasOfficialFishermenWarning: specificParameters.hasFishermenWarning ?? false,
                portDangerSignal: specificParameters.portSignal ?? 0,
                imblDistanceKm: specificParameters.imblDistanceKm ?? 45,
              };

              const riskRes = evaluateImoMarineRisk(hazidParams);

              agentOutput = {
                specialist: agent.name,
                role: agent.instructions.role,
                imoFsaAssessment: riskRes,
              };
              break;
            }

            case "maritime-news-agent": {
              const newsRes = await (maritimeNewsTool.execute as any)({ query, category: "general_maritime", numResults: 3 });
              agentOutput = {
                specialist: agent.name,
                role: agent.instructions.role,
                newsAndPolicy: newsRes,
              };
              break;
            }

            case "presentation-synthesis-agent": {
              agentOutput = {
                specialist: agent.name,
                role: agent.instructions.role,
                formattingGuidelines: "Use Line Charts for 7-day trends, Bar Charts for risk distributions, and Tables for port bulletins.",
                suggestedCharts: ["line-chart", "bar-chart", "interactive-table"],
              };
              break;
            }

            default: {
              agentOutput = {
                specialist: agent.name,
                message: `Executed task for query: ${query}`,
              };
            }
          }

          const executionDurationMs = Date.now() - startTime;

          // Write step trace event if dataStream is active
          if (dataStream) {
            dataStream.write({
              type: "agent-step-complete" as any,
              agentName: agent.name,
              agentIcon: agent.icon?.value ?? "🤖",
              durationMs: executionDurationMs,
              outputSummary: `Completed in ${executionDurationMs}ms`,
            } as any);
          }

          return {
            success: true,
            agentId: agent.id,
            agentName: agent.name,
            agentIcon: agent.icon?.value ?? "🤖",
            executionDurationMs,
            data: agentOutput,
          };
        })
          .ifFail((err) => ({
            success: false,
            isError: true,
            error: err.message,
            agentName: agent.name,
            executionDurationMs: Date.now() - startTime,
          }))
          .unwrap();
      },
    });
  }

  return tools;
}
