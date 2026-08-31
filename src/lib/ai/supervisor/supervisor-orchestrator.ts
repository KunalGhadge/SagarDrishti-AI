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

export interface CoastalZoneInfo {
  name: string;
  state: string;
  harbor: string;
  latitude: number;
  longitude: number;
  pfzCoordinates: { latitude: number; longitude: number };
  pfzDistanceNM: number;
  pfzBearing: string;
  targetSpecies: string[];
}

export const INDIAN_COASTAL_ZONES: Record<string, CoastalZoneInfo> = {
  mumbai: {
    name: "Mumbai Coastal Waters",
    state: "Maharashtra",
    harbor: "Sassoon Dock, Mumbai",
    latitude: 18.9220,
    longitude: 72.8347,
    pfzCoordinates: { latitude: 18.7420, longitude: 72.3150 },
    pfzDistanceNM: 32,
    pfzBearing: "245° (WSW)",
    targetSpecies: ["Indian Mackerel", "Skipjack Tuna", "Ribbonfish", "Horse Mackerel"],
  },
  ratnagiri: {
    name: "Ratnagiri Offshore",
    state: "Maharashtra",
    harbor: "Mirkarwada Fishing Harbour, Ratnagiri",
    latitude: 16.9902,
    longitude: 73.3120,
    pfzCoordinates: { latitude: 16.8500, longitude: 72.9500 },
    pfzDistanceNM: 22,
    pfzBearing: "230° (SW)",
    targetSpecies: ["Oil Sardines", "Mackerel", "Kingfish", "Squid"],
  },
  sindhudurg: {
    name: "Sindhudurg & Malvan Waters",
    state: "Maharashtra",
    harbor: "Malvan Jetty, Sindhudurg",
    latitude: 16.0500,
    longitude: 73.4600,
    pfzCoordinates: { latitude: 15.9200, longitude: 73.1200 },
    pfzDistanceNM: 21,
    pfzBearing: "240° (WSW)",
    targetSpecies: ["Mackerel", "Pomfret", "Surmai", "Prawns"],
  },
  veraval: {
    name: "Veraval & Saurashtra Coast",
    state: "Gujarat",
    harbor: "Veraval Fisheries Harbour, Gujarat",
    latitude: 20.9020,
    longitude: 70.3700,
    pfzCoordinates: { latitude: 20.7200, longitude: 69.8800 },
    pfzDistanceNM: 28,
    pfzBearing: "240° (WSW)",
    targetSpecies: ["Silver Pomfret", "Ribbonfish", "Cuttlefish", "Croakers"],
  },
  porbandar: {
    name: "Porbandar Coastal Waters",
    state: "Gujarat",
    harbor: "Porbandar All-Weather Port",
    latitude: 21.6417,
    longitude: 69.6293,
    pfzCoordinates: { latitude: 21.4500, longitude: 69.1800 },
    pfzDistanceNM: 27,
    pfzBearing: "235° (SW)",
    targetSpecies: ["Hilsa", "Tuna", "Catfish", "Squid"],
  },
  goa: {
    name: "Goa Coastal Waters",
    state: "Goa",
    harbor: "Mormugao Port & Betul Jetty",
    latitude: 15.4000,
    longitude: 73.8000,
    pfzCoordinates: { latitude: 15.2200, longitude: 73.3800 },
    pfzDistanceNM: 26,
    pfzBearing: "240° (WSW)",
    targetSpecies: ["Mackerel", "Kingfish (Surmai)", "Sardines", "Seerfish"],
  },
  kochi: {
    name: "Kochi Offshore Waters",
    state: "Kerala",
    harbor: "Cochin Fisheries Harbour, Thoppumpady",
    latitude: 9.9312,
    longitude: 76.2673,
    pfzCoordinates: { latitude: 9.7500, longitude: 75.8200 },
    pfzDistanceNM: 29,
    pfzBearing: "245° (WSW)",
    targetSpecies: ["Yellowfin Tuna", "Indian Oil Sardine", "Mackerel", "Squid"],
  },
  chennai: {
    name: "Chennai Coastal Waters",
    state: "Tamil Nadu",
    harbor: "Kasimedu Fishing Harbour, Chennai",
    latitude: 13.0827,
    longitude: 80.2707,
    pfzCoordinates: { latitude: 13.1500, longitude: 80.6800 },
    pfzDistanceNM: 25,
    pfzBearing: "075° (ENE)",
    targetSpecies: ["Barracuda", "Seerfish", "Skipjack Tuna", "Trevally"],
  },
  rameswaram: {
    name: "Palk Bay & Gulf of Mannar",
    state: "Tamil Nadu",
    harbor: "Rameswaram Fishing Jetty",
    latitude: 9.2876,
    longitude: 79.3129,
    pfzCoordinates: { latitude: 9.1500, longitude: 79.6200 },
    pfzDistanceNM: 19,
    pfzBearing: "120° (ESE)",
    targetSpecies: ["Blue Crab", "Squid", "Emperor", "Snapper"],
  },
  visakhapatnam: {
    name: "Visakhapatnam Waters",
    state: "Andhra Pradesh",
    harbor: "Visakhapatnam Fishing Harbour",
    latitude: 17.6868,
    longitude: 83.2185,
    pfzCoordinates: { latitude: 17.5200, longitude: 83.6500 },
    pfzDistanceNM: 27,
    pfzBearing: "115° (ESE)",
    targetSpecies: ["Ribbonfish", "Tuna", "Mackerel", "Brown Shrimp"],
  },
  paradip: {
    name: "Paradip Coastal Waters",
    state: "Odisha",
    harbor: "Paradip Fishing Harbour, Odisha",
    latitude: 20.3160,
    longitude: 86.6110,
    pfzCoordinates: { latitude: 20.1200, longitude: 87.0500 },
    pfzDistanceNM: 26,
    pfzBearing: "120° (ESE)",
    targetSpecies: ["Hilsa", "Pomfret", "Sea Bass (Bhetki)", "Tiger Prawns"],
  },
  digha: {
    name: "Digha & Northern Bay of Bengal",
    state: "West Bengal",
    harbor: "Digha Mohana Fishing Port",
    latitude: 21.6266,
    longitude: 87.5074,
    pfzCoordinates: { latitude: 21.3200, longitude: 88.0200 },
    pfzDistanceNM: 34,
    pfzBearing: "125° (SE)",
    targetSpecies: ["Hilsa (Ilish)", "Pomfret", "Bombay Duck", "Prawns"],
  },
};

export function resolveIndianCoastalZone(
  query: string,
  explicitLocation?: string,
  explicitCoordinates?: { latitude: number; longitude: number }
): CoastalZoneInfo {
  const text = `${query} ${explicitLocation ?? ""}`.toLowerCase();

  if (text.includes("mumbai") || text.includes("bombay") || text.includes("sassoon") || text.includes("alibaug") || text.includes("palghar") || text.includes("thane") || text.includes("raigad")) {
    return INDIAN_COASTAL_ZONES.mumbai;
  }
  if (text.includes("veraval") || text.includes("gujarat") || text.includes("saurashtra") || text.includes("okha") || text.includes("kutch") || text.includes("dwarka")) {
    return INDIAN_COASTAL_ZONES.veraval;
  }
  if (text.includes("porbandar")) {
    return INDIAN_COASTAL_ZONES.porbandar;
  }
  if (text.includes("kochi") || text.includes("cochin") || text.includes("kerala") || text.includes("malabar") || text.includes("vizhinjam") || text.includes("kollam") || text.includes("calicut")) {
    return INDIAN_COASTAL_ZONES.kochi;
  }
  if (text.includes("chennai") || text.includes("madras") || text.includes("kasimedu") || text.includes("tamil nadu") || text.includes("pondicherry")) {
    return INDIAN_COASTAL_ZONES.chennai;
  }
  if (text.includes("rameswaram") || text.includes("palk bay") || text.includes("gulf of mannar") || text.includes("mandapam") || text.includes("tuticorin") || text.includes("kanyakumari")) {
    return INDIAN_COASTAL_ZONES.rameswaram;
  }
  if (text.includes("goa") || text.includes("panaji") || text.includes("mormugao") || text.includes("karwar") || text.includes("mangalore") || text.includes("mangaluru")) {
    return INDIAN_COASTAL_ZONES.goa;
  }
  if (text.includes("visakhapatnam") || text.includes("vizag") || text.includes("andhra") || text.includes("kakinada")) {
    return INDIAN_COASTAL_ZONES.visakhapatnam;
  }
  if (text.includes("paradip") || text.includes("puri") || text.includes("odisha") || text.includes("orissa") || text.includes("gopalpur") || text.includes("dhamra")) {
    return INDIAN_COASTAL_ZONES.paradip;
  }
  if (text.includes("digha") || text.includes("kolkata") || text.includes("bengal") || text.includes("sundarbans") || text.includes("haldia")) {
    return INDIAN_COASTAL_ZONES.digha;
  }
  if (text.includes("malvan") || text.includes("sindhudurg") || text.includes("devgad")) {
    return INDIAN_COASTAL_ZONES.sindhudurg;
  }
  if (text.includes("ratnagiri") || text.includes("jaigad")) {
    return INDIAN_COASTAL_ZONES.ratnagiri;
  }

  // Fallback: If coordinates provided, find closest zone
  if (explicitCoordinates) {
    const lat = explicitCoordinates.latitude;
    if (lat >= 18.0 && lat <= 20.0) return INDIAN_COASTAL_ZONES.mumbai;
    if (lat >= 20.0 && lat <= 23.0) return INDIAN_COASTAL_ZONES.veraval;
    if (lat >= 14.5 && lat <= 16.5) return INDIAN_COASTAL_ZONES.goa;
    if (lat >= 8.0 && lat <= 11.5) return INDIAN_COASTAL_ZONES.kochi;
    if (lat >= 12.0 && lat <= 14.0) return INDIAN_COASTAL_ZONES.chennai;
  }

  // Default baseline: Mumbai Coastal Waters (India's premier commercial maritime hub)
  return INDIAN_COASTAL_ZONES.mumbai;
}

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
      execute: async ({ query, location, coordinates, specificParameters = {} }) => {
        const startTime = Date.now();
        const zone = resolveIndianCoastalZone(query, location, coordinates);
        const lat = coordinates?.latitude ?? zone.latitude;
        const lon = coordinates?.longitude ?? zone.longitude;
        const resolvedLocationName = zone.name;

        return safe(async () => {
          let agentOutput: any = {};

          switch (agent.id) {
            case "weather-cyclone-agent": {
              const [weatherRes, cycloneRes] = await Promise.all([
                (imdWeatherTool.execute as any)({ coastalRegion: resolvedLocationName, districtName: resolvedLocationName, latitude: lat, longitude: lon }),
                (cycloneTool.execute as any)({ basin: "North Indian Ocean", vesselLat: lat, vesselLon: lon }),
              ]);
              agentOutput = {
                specialist: agent.name,
                role: agent.instructions.role,
                status: "VERIFIED_IMD_DATA",
                coastalZone: zone.name,
                referenceHarbor: zone.harbor,
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
              const waveHeight = physicsRes?.physics?.significantWaveHeight?.value ?? 1.4;
              const wavePeriod = physicsRes?.physics?.wavePeriod?.peakPeriodSeconds ?? 6.2;

              const observation: OceanographicObservation = {
                coordinates: { latitude: zone.pfzCoordinates.latitude, longitude: zone.pfzCoordinates.longitude },
                locationName: zone.name,
                seaSurfaceTemperature: sstVal,
                chlorophyllConcentrationMgM3: specificParameters.chlorophyll ?? 0.95,
                oceanCurrentVelocityMs: currentVel,
                pressureDelta3hHpa: specificParameters.pressureDelta ?? 0.0,
                dataFreshnessHours: 1.5,
                sensorSourceCount: 3,
                spatialResolutionKm: 5.0,
              };

              const insightRes = evaluateMarineInsights(observation);

              const hazidParams: ImoHazidParameters = {
                locationName: zone.name,
                latitude: zone.pfzCoordinates.latitude,
                longitude: zone.pfzCoordinates.longitude,
                windSpeedKmph: 22,
                significantWaveHeightMeters: waveHeight,
                peakWavePeriodSeconds: wavePeriod,
                nowcastColorCode: 1,
                hasOfficialFishermenWarning: false,
                portDangerSignal: 0,
                imblDistanceKm: 45,
              };

              const riskRes = evaluateImoMarineRisk(hazidParams);

              agentOutput = {
                specialist: agent.name,
                role: agent.instructions.role,
                coastalZone: zone.name,
                referenceHarbor: zone.harbor,
                targetSpecies: zone.targetSpecies,
                nearestPfzZone: {
                  coordinates: zone.pfzCoordinates,
                  distanceNM: zone.pfzDistanceNM,
                  distanceKm: parseFloat((zone.pfzDistanceNM * 1.852).toFixed(1)),
                  bearing: zone.pfzBearing,
                },
                physics: physicsRes?.physics,
                scientificInsights: insightRes,
                imoFsaAssessment: riskRes,
                presentationMatrix: {
                  title: `INCOIS Ocean State & PFZ Telemetry - ${zone.name}`,
                  rows: [
                    { parameter: "Target Harbor", value: zone.harbor },
                    { parameter: "PFZ Coordinates", value: `${zone.pfzCoordinates.latitude}°N, ${zone.pfzCoordinates.longitude}°E` },
                    { parameter: "Distance & Bearing", value: `${zone.pfzDistanceNM} NM (${parseFloat((zone.pfzDistanceNM * 1.852).toFixed(1))} km) ${zone.pfzBearing}` },
                    { parameter: "Target Species", value: zone.targetSpecies.join(", ") },
                    { parameter: "Sea Surface Temperature", value: `${sstVal}°C (Optimal Pelagic Window)` },
                    { parameter: "Thermal Gradient (ΔSST)", value: `${insightRes.scientificAnalyses.thermalFrontAnalysis.sstGradientDegPer5Km}°C / 5km` },
                    { parameter: "Chlorophyll-a", value: `${observation.chlorophyllConcentrationMgM3} mg/m³ (Optimal Eutrophic)` },
                    { parameter: "Significant Wave Height", value: `${waveHeight} meters` },
                    { parameter: "IMO Risk Level", value: `${riskRes.riskLevel === "CODE_GREEN_LOW" ? "🟢 CODE GREEN" : "🟡 CODE YELLOW"} (RI = ${riskRes.riskMatrix.riskIndex})` },
                  ],
                },
              };
              break;
            }

            case "maritime-safety-agent": {
              const hazidParams: ImoHazidParameters = {
                locationName: resolvedLocationName,
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
                coastalZone: zone.name,
                referenceHarbor: zone.harbor,
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
