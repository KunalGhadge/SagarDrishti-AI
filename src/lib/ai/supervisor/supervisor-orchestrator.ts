import { z } from "zod";
import { tool as createTool, Tool, UIMessageStreamWriter } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";
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
  },
  jakhau: {
    name: "Kutch & Sir Creek Sector",
    state: "Gujarat",
    harbor: "Jakhau Fishery Port, Kutch",
    latitude: 23.2370,
    longitude: 68.6180,
    pfzCoordinates: { latitude: 23.1000, longitude: 68.2500 },
    pfzDistanceNM: 24,
    pfzBearing: "245° (WSW)",
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
  },
};

export function resolveIndianCoastalZone(
  query: string,
  explicitLocation?: string,
  explicitCoordinates?: { latitude: number; longitude: number }
): CoastalZoneInfo {
  const text = `${query} ${explicitLocation ?? ""}`.toLowerCase();

  if (text.includes("imbl") || text.includes("border") || text.includes("pakistan") || text.includes("jakhau") || text.includes("sir creek")) {
    return INDIAN_COASTAL_ZONES.jakhau;
  }
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
import { executeMarineCorePipeline } from "../pipeline/marine-pipeline";

export function createMarineSupervisorTools(
  dataStream?: UIMessageStreamWriter,
  userLocation?: { latitude: number; longitude: number }
): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

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

  for (const agent of SAGARDRISHTI_PRESEEDED_AGENTS) {
    if (agent.id === "marine-planner-orchestrator") continue; // Planner is supervisor

    const toolName = `delegate_to_${agent.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

    tools[toolName] = createTool({
      description: `Delegates a task to the ${agent.name} (${agent.icon?.value ?? "🤖"}). ${agent.description}`,
      inputSchema: jsonSchemaToZod(agentDelegationSchema),
      execute: async ({ query, location, coordinates, specificParameters = {} }) => {
        const startTime = Date.now();

        return safe(async () => {
          // Pass effective coordinates (user device GPS fallback if coordinates not explicitly typed)
          const effectiveCoords = coordinates || userLocation;
          // Execute Core Forced Pipeline to generate Evidence Pack
          const pipelineResult = await executeMarineCorePipeline(query, location, effectiveCoords);
          const ep = pipelineResult.evidencePack;

          let agentOutput: any = {};

          switch (agent.id) {
            case "weather-cyclone-agent": {
              agentOutput = {
                specialist: agent.name,
                role: agent.instructions.role,
                intentCategory: pipelineResult.intent,
                location: {
                  zone: ep.location.coastalZone.value,
                  harbor: ep.location.harbor.value,
                  coordinates: `${ep.location.latitude.value}°N, ${ep.location.longitude.value}°E`,
                },
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
                },
                evidencePack: ep,
              };
              break;
            }

            case "ocean-analytics-agent": {
              agentOutput = {
                specialist: agent.name,
                role: agent.instructions.role,
                intentCategory: pipelineResult.intent,
                location: {
                  zone: ep.location.coastalZone.value,
                  harbor: ep.location.harbor.value,
                  coordinates: `${ep.location.latitude.value}°N, ${ep.location.longitude.value}°E`,
                },
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
                },
                oceanPhysics: {
                  significantWaveHeight: `${ep.oceanPhysics.significantWaveHeightMeters.value} m (${ep.oceanPhysics.significantWaveHeightMeters.status})`,
                  currentVelocity: `${ep.oceanPhysics.oceanCurrentVelocityMs.value} m/s (${ep.oceanPhysics.oceanCurrentVelocityMs.status})`,
                  currentDirection: `${ep.oceanPhysics.oceanCurrentDirectionDegrees.value}°`,
                },
                safetyAssessment: {
                  riskIndex: ep.geospatialSafety.imoRiskIndex.value,
                  safetyBadge: ep.geospatialSafety.imoSafetyBadge.value,
                },
                evidencePack: ep,
              };
              break;
            }

            case "maritime-safety-agent": {
              agentOutput = {
                specialist: agent.name,
                role: agent.instructions.role,
                intentCategory: pipelineResult.intent,
                location: {
                  zone: ep.location.coastalZone.value,
                  harbor: ep.location.harbor.value,
                },
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
                  mechanizedVesselAdvisory: ep.geospatialSafety.mechanizedVesselAdvisory.value,
                },
                evidencePack: ep,
              };
              break;
            }

            case "presentation-synthesis-agent": {
              let rows: Array<{ parameter: string; value: string; status?: string }> = [];

              if (pipelineResult.intent === "VENTURE_SAFETY") {
                rows = [
                  { parameter: "Operational Safety Verdict", value: `${ep.geospatialSafety.imoSafetyBadge.value} (RI = ${ep.geospatialSafety.imoRiskIndex.value})`, status: ep.geospatialSafety.imoRiskIndex.status },
                  { parameter: "Significant Wave Height", value: `${ep.oceanPhysics.significantWaveHeightMeters.value} m`, status: ep.oceanPhysics.significantWaveHeightMeters.status },
                  { parameter: "Surface Wind Speed", value: `${ep.weather.surfaceWindSpeedKmph.value} km/h`, status: ep.weather.surfaceWindSpeedKmph.status },
                  { parameter: "Small Craft Advisory", value: ep.geospatialSafety.smallCraftAdvisory.value, status: ep.geospatialSafety.smallCraftAdvisory.status },
                ];
              } else if (pipelineResult.intent === "PFZ_LOCATION") {
                rows = [
                  { parameter: "Nearest PFZ Coordinate", value: `${ep.bioOptics.nearestPfzCoordinates.value?.latitude}°N, ${ep.bioOptics.nearestPfzCoordinates.value?.longitude}°E`, status: ep.bioOptics.nearestPfzCoordinates.status },
                  { parameter: "Distance & Bearing", value: `${ep.bioOptics.nearestPfzDistanceNM.value} NM (${ep.bioOptics.nearestPfzBearing.value})`, status: ep.bioOptics.nearestPfzDistanceNM.status },
                  { parameter: "Sea Surface Temp (SST)", value: `${ep.oceanPhysics.seaSurfaceTemperatureCelsius.value} °C (simulated baseline)`, status: ep.oceanPhysics.seaSurfaceTemperatureCelsius.status },
                  { parameter: "IMO Risk Level", value: `${ep.geospatialSafety.imoSafetyBadge.value} (RI = ${ep.geospatialSafety.imoRiskIndex.value})`, status: ep.geospatialSafety.imoRiskIndex.status },
                ];
              } else if (pipelineResult.intent === "ALERT_CHECK") {
                rows = [
                  { parameter: "Active Cyclone Alert", value: ep.weather.activeCycloneAlert.value ? "ACTIVE" : "NIL (No storm)", status: ep.weather.activeCycloneAlert.status },
                  { parameter: "Surface Wind Speed", value: `${ep.weather.surfaceWindSpeedKmph.value} km/h`, status: ep.weather.surfaceWindSpeedKmph.status },
                  { parameter: "Lightning / Squall Risk", value: `${ep.weather.lightningRisk.value} (simulated baseline)`, status: ep.weather.lightningRisk.status },
                  { parameter: "IMO Safety Badge", value: ep.geospatialSafety.imoSafetyBadge.value, status: ep.geospatialSafety.imoSafetyBadge.status },
                ];
              } else if (pipelineResult.intent === "GEOFENCE_CHECK") {
                rows = [
                  { parameter: "Nearest Maritime Boundary", value: `${ep.geospatialSafety.imblBoundaryName.value} (${ep.geospatialSafety.distanceToImblKm.value} km)`, status: ep.geospatialSafety.distanceToImblKm.status },
                  { parameter: "Nearest Protected Area", value: `${ep.geospatialSafety.nearestMarineProtectedArea.value} (${ep.geospatialSafety.distanceToMpaKm.value} km)`, status: ep.geospatialSafety.distanceToMpaKm.status },
                  { parameter: "Border Proximity Warning", value: ep.geospatialSafety.isApproachingBorderAlert.value ? "WARNING: < 20 km" : "CLEAR: Safe distance", status: ep.geospatialSafety.isApproachingBorderAlert.status },
                ];
              } else {
                rows = [
                  { parameter: "Target Harbor", value: ep.location.harbor.value, status: ep.location.harbor.status },
                  { parameter: "Significant Wave Height", value: `${ep.oceanPhysics.significantWaveHeightMeters.value} m`, status: ep.oceanPhysics.significantWaveHeightMeters.status },
                  { parameter: "Surface Wind Speed", value: `${ep.weather.surfaceWindSpeedKmph.value} km/h`, status: ep.weather.surfaceWindSpeedKmph.status },
                  { parameter: "IMO Risk Level", value: `${ep.geospatialSafety.imoSafetyBadge.value} (RI = ${ep.geospatialSafety.imoRiskIndex.value})`, status: ep.geospatialSafety.imoRiskIndex.status },
                ];
              }

              let mapView: any = undefined;

              if (pipelineResult.intent === "PFZ_LOCATION" && ep.bioOptics.nearestPfzCoordinates.value) {
                mapView = {
                  title: `Potential Fishing Zone (PFZ) Map - ${ep.location.coastalZone.value}`,
                  markers: [
                    {
                      lat: ep.location.latitude.value,
                      lon: ep.location.longitude.value,
                      label: `${ep.location.harbor.value} (Departure Port)`,
                      type: "safe_zone" as const,
                      isSimulated: false,
                    },
                    {
                      lat: ep.bioOptics.nearestPfzCoordinates.value.latitude,
                      lon: ep.bioOptics.nearestPfzCoordinates.value.longitude,
                      label: `Nearest PFZ (${ep.bioOptics.nearestPfzDistanceNM.value} NM, ${ep.bioOptics.nearestPfzBearing.value})`,
                      type: "pfz" as const,
                      isSimulated: true,
                    },
                  ],
                };
              } else if (pipelineResult.intent === "ALERT_CHECK") {
                const hasExactUserCoords =
                  ep.location.latitude.source.includes("User Device GPS") ||
                  ep.location.latitude.source.includes("Parsed Numeric GPS");

                const coastalZone =
                  Object.values(INDIAN_COASTAL_ZONES).find(
                    (z) => z.harbor === ep.location.harbor.value || z.name === ep.location.coastalZone.value
                  ) || INDIAN_COASTAL_ZONES.mumbai;

                if (hasExactUserCoords) {
                  // User provided exact coordinates -> show distress pin + safe harbor pin + direct bearing line
                  mapView = {
                    title: `Emergency Safe Harbor Direct Bearing - ${ep.location.coastalZone.value}`,
                    markers: [
                      {
                        lat: ep.location.latitude.value,
                        lon: ep.location.longitude.value,
                        label: `Vessel Distress Position (${ep.location.latitude.value.toFixed(4)}°N, ${ep.location.longitude.value.toFixed(4)}°E)`,
                        type: "hazard" as const,
                        isSimulated: false,
                      },
                      {
                        lat: coastalZone.latitude,
                        lon: coastalZone.longitude,
                        label: `Nearest Safe Harbor: ${ep.location.harbor.value}`,
                        type: "safe_zone" as const,
                        isSimulated: false,
                      },
                    ],
                    path: [
                      { lat: ep.location.latitude.value, lon: ep.location.longitude.value },
                      { lat: coastalZone.latitude, lon: coastalZone.longitude },
                    ],
                    pathLabel: "Direct Bearing (Straight Line — Not a Navigation Route)",
                  };
                } else {
                  // Place name matched registry only (no vessel coordinates provided) -> show harbor pin ONLY, no fake pin and no fake line
                  mapView = {
                    title: `Safe Harbor Registry Location - ${ep.location.coastalZone.value}`,
                    markers: [
                      {
                        lat: coastalZone.latitude,
                        lon: coastalZone.longitude,
                        label: `Nearest Safe Harbor: ${ep.location.harbor.value}`,
                        type: "safe_zone" as const,
                        isSimulated: false,
                      },
                    ],
                  };
                }
              }

              agentOutput = {
                specialist: agent.name,
                role: agent.instructions.role,
                intentCategory: pipelineResult.intent,
                directSosResponse: pipelineResult.directSosResponse,
                presentationMatrix: {
                  title: `Marine Decision Matrix - ${ep.location.coastalZone.value}`,
                  rows,
                },
                mapView,
                evidencePack: ep,
              };
              break;
            }

            default: {
              agentOutput = {
                specialist: agent.name,
                evidencePack: ep,
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
