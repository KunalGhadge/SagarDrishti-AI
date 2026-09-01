import { z } from "zod";
import { tool as createTool, Tool, UIMessageStreamWriter } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";
import { Agent, AgentSummary } from "app-types/agent";
import { executeMarineCorePipeline } from "../pipeline/marine-pipeline";
import { SAGARDRISHTI_PRESEEDED_AGENTS } from "lib/ai/marine-agents-seed";

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

export interface CoastalZoneInfo {
  name: string;
  state: string;
  harbor: string;
  latitude: number;
  longitude: number;
  pfzCoordinates: { latitude: number; longitude: number };
  pfzDistanceNM: number;
  pfzBearing: string;
}

export function createMarineSupervisorTools(
  dataStream?: UIMessageStreamWriter,
  userLocation?: { latitude: number; longitude: number },
  configuredAgents?: (Agent | AgentSummary)[]
): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  // 1. Live Device GPS Location Tool
  tools["get_device_gps_location"] = createTool({
    description: "Retrieves the user's real-time live GPS device coordinates from the browser geolocation sensor.",
    inputSchema: z.object({}),
    execute: async () => {
      if (userLocation) {
        return {
          status: "success",
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          source: "Live Browser Geolocation API (Permission Granted)",
          isLive: true,
        };
      }
      return {
        status: "prompt_required",
        message: "Device GPS coordinates not yet shared. Please grant browser location access or provide nearest port.",
        isLive: false,
      };
    },
  });

  // 2. Resolve dynamic agent list (from database passed agents or preseeded fallback)
  const agentList = (configuredAgents && configuredAgents.length > 0)
    ? configuredAgents
    : SAGARDRISHTI_PRESEEDED_AGENTS;

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
          const pipelineResult = await executeMarineCorePipeline(query, location, effectiveCoords);
          const ep = pipelineResult.evidencePack;

          // Dynamically format specialist response based on agent profile
          const normalizedName = agent.name.toLowerCase();
          let domainPayload: any = {};

          if (normalizedName.includes("weather") || normalizedName.includes("cyclone")) {
            domainPayload = {
              weather: {
                surfaceWindSpeed: `${ep.weather.surfaceWindSpeedKmph.value} km/h (${ep.weather.surfaceWindSpeedKmph.status})`,
                windDirection: `${ep.weather.windDirectionDegrees.value}°`,
                airTemperature: `${ep.weather.airTemperatureCelsius.value} °C (${ep.weather.airTemperatureCelsius.status})`,
                atmosphericPressure: `${ep.weather.atmosphericPressureHpa.value} hPa (${ep.weather.atmosphericPressureHpa.status})`,
                lightningRisk: ep.weather.lightningRisk.value,
                activeCycloneAlert: ep.weather.activeCycloneAlert.value,
              },
              oceanState: {
                significantWaveHeight: `${ep.oceanPhysics.significantWaveHeightMeters.value} m (${ep.oceanPhysics.significantWaveHeightMeters.status})`,
                peakWavePeriod: `${ep.oceanPhysics.peakWavePeriodSeconds.value} s`,
                waveSteepnessRatio: ep.oceanPhysics.waveSteepnessRatio.value,
              },
              safetySummary: {
                riskIndex: ep.geospatialSafety.imoRiskIndex.value,
                safetyBadge: ep.geospatialSafety.imoSafetyBadge.value,
                smallCraftAdvisory: ep.geospatialSafety.smallCraftAdvisory.value,
                reasoning: ep.geospatialSafety.riskReasoning.value,
                hazardAuditTrail: ep.geospatialSafety.hazardAuditTrail.value,
              },
            };
          } else if (normalizedName.includes("ocean") || normalizedName.includes("analytics") || normalizedName.includes("earth") || normalizedName.includes("pfz")) {
            domainPayload = {
              bioOptics: {
                nearestPfzZone: {
                  coordinates: ep.bioOptics.nearestPfzCoordinates.value,
                  distanceNM: ep.bioOptics.nearestPfzDistanceNM.value,
                  bearing: ep.bioOptics.nearestPfzBearing.value,
                  status: ep.bioOptics.nearestPfzCoordinates.status,
                },
                seaSurfaceTemperature: `${ep.oceanPhysics.seaSurfaceTemperatureCelsius.value} °C (${ep.oceanPhysics.seaSurfaceTemperatureCelsius.status})`,
                thermalGradientDegPer5Km: `${ep.bioOptics.horizontalSstGradientDegPer5Km.value} °C / 5km (${ep.bioOptics.horizontalSstGradientDegPer5Km.status})`,
                chlorophyllConcentration: `${ep.bioOptics.chlorophyllConcentrationMgM3.value} mg/m³ (${ep.bioOptics.chlorophyllConcentrationMgM3.status})`,
                isThermalFrontActive: ep.bioOptics.isThermalFrontActive.value,
                reasoning: ep.bioOptics.insightReasoning.value,
              },
              oceanPhysics: {
                significantWaveHeight: `${ep.oceanPhysics.significantWaveHeightMeters.value} m (${ep.oceanPhysics.significantWaveHeightMeters.status})`,
                currentVelocity: `${ep.oceanPhysics.oceanCurrentVelocityMs.value} m/s (${ep.oceanPhysics.oceanCurrentVelocityMs.status})`,
                currentDirection: `${ep.oceanPhysics.oceanCurrentDirectionDegrees.value}°`,
              },
            };
          } else if (normalizedName.includes("safety") || normalizedName.includes("geospatial") || normalizedName.includes("enforcement")) {
            domainPayload = {
              geofencing: {
                nearestImblName: ep.geospatialSafety.imblBoundaryName.value,
                distanceToImblKm: `${ep.geospatialSafety.distanceToImblKm.value} km (${ep.geospatialSafety.distanceToImblKm.status})`,
                isApproachingBorderAlert: ep.geospatialSafety.isApproachingBorderAlert.value,
                nearestMpaName: ep.geospatialSafety.nearestMarineProtectedArea.value,
                distanceToMpaKm: `${ep.geospatialSafety.distanceToMpaKm.value} km (${ep.geospatialSafety.distanceToMpaKm.status})`,
                isInsideRestrictedMpa: ep.geospatialSafety.isInsideRestrictedMpa.value,
              },
              imoFsaAssessment: {
                riskIndex: ep.geospatialSafety.imoRiskIndex.value,
                safetyBadge: ep.geospatialSafety.imoSafetyBadge.value,
                smallCraftAdvisory: ep.geospatialSafety.smallCraftAdvisory.value,
                reasoning: ep.geospatialSafety.riskReasoning.value,
                hazardAuditTrail: ep.geospatialSafety.hazardAuditTrail.value,
              },
            };
          } else if (normalizedName.includes("emergency") || normalizedName.includes("sos") || normalizedName.includes("sar") || normalizedName.includes("rescue")) {
            domainPayload = {
              directSosResponse: pipelineResult.directSosResponse,
              emergencyStatus: {
                alertLevel: "🔴 CODE RED (CRITICAL MARITIME DISTRESS)",
                icgHelpline: "1554 (Toll-Free, 24x7)",
                vhfChannel: "Channel 16 (156.800 MHz)",
                nearestSafeHarbor: ep.location.harbor.value,
                coordinates: `${ep.location.latitude.value}°N, ${ep.location.longitude.value}°E`,
              },
              weather: {
                windSpeed: `${ep.weather.surfaceWindSpeedKmph.value} km/h`,
                waveHeight: `${ep.oceanPhysics.significantWaveHeightMeters.value} m`,
              },
            };
          } else {
            domainPayload = {
              primarySummary: {
                verdict: `${ep.geospatialSafety.imoSafetyBadge.value} (RI = ${ep.geospatialSafety.imoRiskIndex.value})`,
                waveHeight: `${ep.oceanPhysics.significantWaveHeightMeters.value} m`,
                windSpeed: `${ep.weather.surfaceWindSpeedKmph.value} km/h`,
                harbor: ep.location.harbor.value,
              },
            };
          }

          return {
            specialist: agent.name,
            agentId: agent.id,
            role: agentRole,
            intentCategory: pipelineResult.intent,
            location: {
              zone: ep.location.coastalZone.value,
              harbor: ep.location.harbor.value,
              coordinates: `${ep.location.latitude.value}°N, ${ep.location.longitude.value}°E`,
            },
            ...domainPayload,
            evidencePack: ep,
          };
        })
          .ifFail((err) => ({
            specialist: agent.name,
            agentId: agent.id,
            error: err.message,
            status: "error" as const,
          }))
          .unwrap();
      },
    });
  }

  return tools;
}
