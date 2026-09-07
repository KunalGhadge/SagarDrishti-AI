import { tool as createTool } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";
import { queryPfzV2Service } from "@/lib/ai/engines/pfz-v2-client";

export const pfzAnalysisQuerySchema: JSONSchema7 = {
  type: "object",
  properties: {
    latitude: {
      type: "number",
      description: "Latitude coordinate of maritime sector or reference port (e.g. 18.922 for Mumbai, 13.0827 for Chennai)",
    },
    longitude: {
      type: "number",
      description: "Longitude coordinate of maritime sector or reference port (e.g. 72.8346 for Mumbai, 80.2707 for Chennai)",
    },
    radiusKm: {
      type: "number",
      description: "Analysis radius in kilometers around the coordinate (default 80, range 10-300 km)",
      default: 80,
    },
    referencePortName: {
      type: "string",
      description: "Optional name of the nearest port or harbor (e.g. 'Mumbai Port', 'Chennai Harbor', 'Kochi Port')",
    },
    windSpeedMs: {
      type: "number",
      description: "Optional surface wind speed in m/s for relative wind and Ekman transport alignment analysis",
    },
    windDirectionDeg: {
      type: "number",
      description: "Optional meteorological wind direction in degrees (0-360°) from which wind blows",
    },
  },
  required: ["latitude", "longitude"],
};

export const pfzAnalysisTool = createTool({
  description:
    "Scientific Potential Fishing Zone (PFZ) Analysis Tool. Queries the SagarDrishti Python Ocean Feature Co-occurrence Engine (grounded in Sarangi et al. 2024 & Jishad et al. 2021). Evaluates Copernicus NetCDF Sea Surface Temperature (SST) thermal fronts (Cayula & Cornillon 1992), satellite Chlorophyll-a (>0.1 mg/m³ threshold), mesoscale cyclonic eddies (SLA altimetry), and Ekman transport persistence (≤40° front alignment). Returns structured candidates, 4-dimensional data quality ratings, and zero-hallucination scientific evidence.",
  inputSchema: jsonSchemaToZod(pfzAnalysisQuerySchema),
  execute: async ({
    latitude,
    longitude,
    radiusKm = 80,
    referencePortName,
    windSpeedMs,
    windDirectionDeg,
  }) => {
    return safe(async () => {
      const result = await queryPfzV2Service({
        latitude,
        longitude,
        radiusKm,
        referencePortName,
        windSpeedMs: windSpeedMs ?? null,
        windDirectionDeg: windDirectionDeg ?? null,
        timeoutMs: 25000,
      });

      if (result.status === "unavailable") {
        return {
          status: "unavailable",
          engine_version: result.engineVersion,
          candidates: [],
          error: result.error || "PFZ scientific service is currently unreachable.",
          message:
            "The scientific PFZ calculation engine is currently offline or unreachable. Disclosing unavailable status per zero-hallucination policy rather than fabricating fallback data.",
        };
      }

      return {
        status: "available",
        engine_version: result.engineVersion,
        user_location: result.userLocation,
        methodology: result.methodology || {
          framework: "Ocean Feature Co-occurrence Matrix (C + F + E)",
          citations: "Sarangi et al. (2024) [Env Monit Assess 196:98] & Jishad et al. (2021) [J Oper Oceanogr 14(1)]",
          biological_validation_policy: "Ground-truth trawling correlation required before asserting catch guarantees.",
        },
        candidates_count: result.candidates.length,
        candidates: result.candidates.map((c) => ({
          id: c.id,
          name: c.name,
          latitude: c.latitude,
          longitude: c.longitude,
          distance_nm: c.distance_nm,
          bearing: c.bearing,
          classification_tier: c.classification,
          feature_count: c.feature_count,
          features: {
            high_chlorophyll_present: c.features?.high_chlorophyll,
            sst_thermal_front_present: c.features?.sst_front,
            chlorophyll_front_present: c.features?.chl_front,
            cyclonic_upwelling_eddy: c.features?.cyclonic_eddy,
            eddy_evidence_status: c.features?.eddy_evidence_status,
          },
          freshness: {
            age_hours: c.freshness?.age_hours,
            status: c.freshness?.status,
            policy: c.freshness?.policy_citation,
          },
          persistence: {
            status: c.persistence?.classification,
            angle_to_front_deg: c.persistence?.angle_to_front_deg,
            ekman_direction_deg: c.persistence?.ekman_direction_deg,
            relative_wind_speed_ms: c.persistence?.relative_wind_speed_ms,
          },
          data_quality: c.data_quality,
          feature_strength: c.feature_strength,
          algorithm_stability: c.algorithm_stability,
          biological_validation: c.biological_validation,
          explanation: c.explanation,
        })),
      };
    });
  },
});
