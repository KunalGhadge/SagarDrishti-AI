import { tool as createTool } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";

export const noaaChlorophyllQuerySchema: JSONSchema7 = {
  type: "object",
  properties: {
    latitude: {
      type: "number",
      description: "Latitude coordinate of coastal or marine point (e.g. 19.0173 for Mumbai)",
    },
    longitude: {
      type: "number",
      description: "Longitude coordinate of coastal or marine point (e.g. 72.8121 for Mumbai)",
    },
  },
  required: ["latitude", "longitude"],
};

export const NOAA_ERDDAP_DATASET_ID = "nesdisVHNnoaaSNPPnoaa20NRTchlaGapfilledDaily";
export const NOAA_ERDDAP_BASE_URL = "https://coastwatch.pfeg.noaa.gov/erddap/griddap/nesdisVHNnoaaSNPPnoaa20NRTchlaGapfilledDaily";

export const noaaChlorophyllTool = createTool({
  description:
    "Real-Time Satellite Chlorophyll-a Tool (NOAA CoastWatch ERDDAP). Retrieves verified satellite bio-optical Chlorophyll-a concentrations (mg/m³) from NOAA-20 / S-NPP VIIRS Daily DINEOF Gap-filled Global 9km Level 3 imagery for any marine coordinate. Returns raw measurements without speculative inference.",
  inputSchema: jsonSchemaToZod(noaaChlorophyllQuerySchema),
  execute: async ({ latitude, longitude }) => {
    return safe(async () => {
      // Query 0.20 deg bounding box around coordinate to match nearest valid marine grid cell
      const minLat = (latitude - 0.20).toFixed(2);
      const maxLat = (latitude + 0.20).toFixed(2);
      const minLon = (longitude - 0.20).toFixed(2);
      const maxLon = (longitude + 0.20).toFixed(2);

      const requestUrl = `${NOAA_ERDDAP_BASE_URL}.json?chlor_a[(last)][(0.0)][(${minLat}):1:(${maxLat})][(${minLon}):1:(${maxLon})]`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(requestUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SagarDrishti/1.0",
          "Accept": "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`NOAA CoastWatch ERDDAP service returned HTTP ${res.status}`);
      }

      const raw = await res.json();
      const rows = raw?.table?.rows || [];

      // Find nearest valid non-null chlorophyll observation
      let closestCell: { time: string; lat: number; lon: number; value: number } | null = null;
      let minDistance = Infinity;

      for (const r of rows) {
        const time = r[0];
        const cellLat = r[2];
        const cellLon = r[3];
        const chla = r[4];

        if (chla != null && typeof chla === "number" && !isNaN(chla)) {
          const dist = Math.hypot(cellLat - latitude, cellLon - longitude);
          if (dist < minDistance) {
            minDistance = dist;
            closestCell = {
              time,
              lat: cellLat,
              lon: cellLon,
              value: parseFloat(chla.toFixed(4)),
            };
          }
        }
      }

      if (!closestCell) {
        return {
          parameter: "chlorophyll_a",
          value: null,
          unit: "mg/m³",
          latitude,
          longitude,
          timestamp: new Date().toISOString(),
          source: "NOAA CoastWatch ERDDAP",
          dataset: NOAA_ERDDAP_DATASET_ID,
          status: "unavailable",
          sourceUrl: `${NOAA_ERDDAP_BASE_URL}.html`,
        };
      }

      return {
        parameter: "chlorophyll_a",
        value: closestCell.value,
        unit: "mg/m³",
        latitude: closestCell.lat,
        longitude: closestCell.lon,
        timestamp: closestCell.time,
        source: "NOAA CoastWatch ERDDAP",
        dataset: NOAA_ERDDAP_DATASET_ID,
        status: "live",
        sourceUrl: `${NOAA_ERDDAP_BASE_URL}.html`,
      };
    })
      .ifFail(() => ({
        parameter: "chlorophyll_a",
        value: null,
        unit: "mg/m³",
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
        source: "NOAA CoastWatch ERDDAP",
        dataset: NOAA_ERDDAP_DATASET_ID,
        status: "unavailable",
        sourceUrl: `${NOAA_ERDDAP_BASE_URL}.html`,
      }))
      .unwrap();
  },
});
