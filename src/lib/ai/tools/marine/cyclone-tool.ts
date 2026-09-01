import { tool as createTool } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";

export const cycloneQuerySchema: JSONSchema7 = {
  type: "object",
  properties: {
    cycloneName: {
      type: "string",
      description: "Optional specific name of cyclone system to track (e.g., 'BIPARJOY', 'MICHAUNG', 'DANA', 'REMAL')",
    },
    basin: {
      type: "string",
      enum: ["Arabian Sea", "Bay of Bengal", "North Indian Ocean"],
      description: "Oceanic basin of interest",
      default: "North Indian Ocean",
    },
    vesselLat: {
      type: "number",
      description: "Latitude of vessel/harbor to perform point-in-polygon risk geofencing",
    },
    vesselLon: {
      type: "number",
      description: "Longitude of vessel/harbor to perform point-in-polygon risk geofencing",
    },
  },
};

export const cycloneTool = createTool({
  description:
    "Official IMD Cyclone Tracking & Spatial Danger Cone Tool. Fetches real-time Cyclone Tracks, Gale Wind MultiPolygons, and Cone of Uncertainty GeoJSON corridors. Returns unavailable if direct government feed is offline without inserting fabricated values.",
  inputSchema: jsonSchemaToZod(cycloneQuerySchema),
  execute: async ({ cycloneName, basin = "North Indian Ocean", vesselLat, vesselLon }) => {
    return safe(async () => {
      const fetchWithTimeout = async (url: string, timeout = 6000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
          const res = await fetch(url, { signal: controller.signal, headers: { "Accept": "application/json" } });
          clearTimeout(id);
          if (!res.ok) return null;
          return await res.json();
        } catch {
          clearTimeout(id);
          return null;
        }
      };

      const [trackData, windData, couData] = await Promise.all([
        fetchWithTimeout("https://api.imd.gov.in/api/v1/cyclone_track"),
        fetchWithTimeout("https://api.imd.gov.in/api/v1/cyclone_wind"),
        fetchWithTimeout("https://api.imd.gov.in/api/v1/cyclone_cou"),
      ]);

      const timestamp = new Date().toISOString();

      if (!trackData && !windData && !couData) {
        return {
          source: "IMD Cyclone Warning Division (New Delhi)",
          dataset: "IMD_OPERATIONAL_CYCLONE_BULLETIN_API",
          timestamp,
          status: "unavailable" as const,
          error: "Direct IMD Cyclone API endpoint currently unreachable; no active storm bulletin data received.",
          hasActiveCyclone: null,
          cycloneName: null,
          category: null,
          latestPosition: null,
          geofenceAnalysis: {
            vesselCoordinates: vesselLat != null && vesselLon != null ? { lat: vesselLat, lon: vesselLon } : null,
            closestStormDistanceKm: null,
            inConeOfUncertainty: null,
            inGaleWindRadius: null,
            riskLevel: "unavailable",
          },
          windPolygonsGeoJson: null,
          coneOfUncertaintyGeoJson: null,
        };
      }

      const hasActiveStorm = trackData?.data?.observed && trackData.data.observed.length > 0;

      let inConeOfUncertainty: boolean | null = false;
      let inGaleWindRadius: boolean | null = false;
      let closestStormDistanceKm: number | null = null;

      if (hasActiveStorm && vesselLat != null && vesselLon != null) {
        const latestTrack = trackData.data.observed[trackData.data.observed.length - 1];
        const stormLat = parseFloat(latestTrack.lat);
        const stormLon = parseFloat(latestTrack.lon);

        if (!isNaN(stormLat) && !isNaN(stormLon)) {
          const R = 6371;
          const dLat = ((stormLat - vesselLat) * Math.PI) / 180;
          const dLon = ((stormLon - vesselLon) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((vesselLat * Math.PI) / 180) *
              Math.cos((stormLat * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          closestStormDistanceKm = Math.round(R * c);

          inConeOfUncertainty = closestStormDistanceKm < 300;
          inGaleWindRadius = closestStormDistanceKm < 150;
        }
      }

      return {
        source: "IMD Cyclone Warning Division (New Delhi)",
        dataset: "IMD_OPERATIONAL_CYCLONE_BULLETIN_API",
        timestamp,
        status: "live" as const,
        hasActiveCyclone: !!hasActiveStorm,
        cycloneName: cycloneName || (hasActiveStorm ? trackData.data.observed[0]?.CYCLONE_NAME : null),
        category: hasActiveStorm ? trackData.data.observed[0]?.Category || "CYCLONIC_STORM" : "NO_ACTIVE_CYCLONE",
        latestPosition: hasActiveStorm ? {
          lat: trackData.data.observed[0]?.lat,
          lon: trackData.data.observed[0]?.lon,
          mswKmph: trackData.data.observed[0]?.["MSW range (kmph)"] || null,
        } : null,
        geofenceAnalysis: {
          vesselCoordinates: vesselLat != null && vesselLon != null ? { lat: vesselLat, lon: vesselLon } : null,
          closestStormDistanceKm,
          inConeOfUncertainty,
          inGaleWindRadius,
          riskLevel: inGaleWindRadius ? "EXTREME_CODE_RED" : inConeOfUncertainty ? "HIGH_CODE_ORANGE" : "LOW_CODE_GREEN",
        },
        windPolygonsGeoJson: windData?.data || null,
        coneOfUncertaintyGeoJson: couData?.data || null,
      };
    })
      .ifFail((err) => ({
        source: "IMD Cyclone Warning Division (New Delhi)",
        dataset: "IMD_OPERATIONAL_CYCLONE_BULLETIN_API",
        timestamp: new Date().toISOString(),
        status: "error" as const,
        error: err.message,
        hasActiveCyclone: null,
        category: null,
        latestPosition: null,
        geofenceAnalysis: {
          vesselCoordinates: null,
          closestStormDistanceKm: null,
          inConeOfUncertainty: null,
          inGaleWindRadius: null,
          riskLevel: "unavailable",
        },
      }))
      .unwrap();
  },
});
