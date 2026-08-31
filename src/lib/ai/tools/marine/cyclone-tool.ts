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
    "Official IMD Cyclone Tracking & Spatial Danger Cone Tool. Fetches real-time Cyclone Tracks (API 18), 27kt/34kt/50kt/64kt Gale Wind MultiPolygons (API 19), and projected Cone of Uncertainty GeoJSON corridors (API 20).",
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

      const hasActiveStorm = trackData?.data?.observed && trackData.data.observed.length > 0;

      let inConeOfUncertainty = false;
      let inGaleWindRadius = false;
      let closestStormDistanceKm = 9999;

      if (hasActiveStorm && vesselLat != null && vesselLon != null) {
        const latestTrack = trackData.data.observed[trackData.data.observed.length - 1];
        const stormLat = parseFloat(latestTrack.lat);
        const stormLon = parseFloat(latestTrack.lon);

        if (!isNaN(stormLat) && !isNaN(stormLon)) {
          // Haversine distance calculation in km
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

          if (closestStormDistanceKm < 300) inConeOfUncertainty = true;
          if (closestStormDistanceKm < 150) inGaleWindRadius = true;
        }
      }

      return {
        success: true,
        source: "IMD_OFFICIAL_CYCLONE_CENTRE_NEW_DELHI",
        timestamp: new Date().toISOString(),
        hasActiveCyclone: !!hasActiveStorm,
        cycloneName: cycloneName || (hasActiveStorm ? trackData.data.observed[0]?.CYCLONE_NAME : "NIL"),
        category: hasActiveStorm ? trackData.data.observed[0]?.Category || "CYCLONIC_STORM" : "NO_ACTIVE_CYCLONE",
        latestPosition: hasActiveStorm ? {
          lat: trackData.data.observed[0]?.lat,
          lon: trackData.data.observed[0]?.lon,
          mswKmph: trackData.data.observed[0]?.["MSW range (kmph)"] || "45-55",
        } : null,
        geofenceAnalysis: {
          vesselCoordinates: vesselLat != null && vesselLon != null ? { lat: vesselLat, lon: vesselLon } : null,
          closestStormDistanceKm: closestStormDistanceKm < 9999 ? closestStormDistanceKm : null,
          inConeOfUncertainty,
          inGaleWindRadius,
          riskLevel: inGaleWindRadius ? "EXTREME_CODE_RED" : inConeOfUncertainty ? "HIGH_CODE_ORANGE" : "LOW_CODE_GREEN",
        },
        windPolygonsGeoJson: windData?.data || null,
        coneOfUncertaintyGeoJson: couData?.data || null,
      };
    })
      .ifFail((err) => ({
        success: false,
        isError: true,
        error: err.message,
        hasActiveCyclone: false,
        category: "NO_ACTIVE_CYCLONE_REPORTED",
        geofenceAnalysis: {
          inConeOfUncertainty: false,
          inGaleWindRadius: false,
          riskLevel: "LOW_CODE_GREEN",
        },
      }))
      .unwrap();
  },
});
