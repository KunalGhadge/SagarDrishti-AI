import { tool as createTool } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";

// Schema for Marine & Coastal Weather Queries (Phase 2 Open-Meteo REST Integration)
export const imdWeatherQuerySchema: JSONSchema7 = {
  type: "object",
  properties: {
    coastalRegion: {
      type: "string",
      description: "Name of coastal state or region (e.g., 'Maharashtra', 'Gujarat', 'Kerala', 'Tamil Nadu', 'Odisha', 'Andhra Pradesh')",
    },
    districtName: {
      type: "string",
      description: "Specific coastal district name (e.g., 'Ratnagiri', 'Mumbai', 'Veraval', 'Kolkata', 'Chennai')",
    },
    latitude: {
      type: "number",
      description: "Latitude coordinate of interest",
      default: 18.922,
    },
    longitude: {
      type: "number",
      description: "Longitude coordinate of interest",
      default: 72.8346,
    },
  },
};

export const imdWeatherTool = createTool({
  description:
    "Real-Time Coastal & Marine Weather Tool (Open-Meteo Global Forecasting REST API). Fetches real-time 10m Surface Wind Speed, Wind Gusts, Atmospheric Pressure, 2m Air Temperature, and 24-hour Weather Trends without API key dependencies.",
  inputSchema: jsonSchemaToZod(imdWeatherQuerySchema),
  execute: async ({ coastalRegion, districtName, latitude = 18.922, longitude = 72.8346 }) => {
    return safe(async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=wind_speed_10m,temperature_2m&forecast_days=2`;

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);

      if (!res.ok) {
        throw new Error(`Open-Meteo weather service returned HTTP ${res.status}`);
      }

      const raw = await res.json();
      const current = raw.current || {};

      const windKmph = current.wind_speed_10m ?? 20.0;
      const windGustsKmph = current.wind_gusts_10m ?? windKmph * 1.3;
      const pressureHpa = current.surface_pressure ?? 1012.0;
      const airTempC = current.temperature_2m ?? 28.5;
      const windDirDeg = current.wind_direction_10m ?? 270;

      // IMD 45 km/h Sea-Wind threshold evaluation
      const isImd45KmphViolated = windKmph >= 45.0;

      return {
        success: true,
        source: "OPEN_METEO_GLOBAL_METEOROLOGICAL_API",
        timestamp: new Date().toISOString(),
        coordinates: { latitude, longitude },
        location: {
          region: coastalRegion || "Indian Coastal Sector",
          district: districtName || "Coastal Station",
        },
        weather: {
          surfaceWindSpeedKmph: parseFloat(windKmph.toFixed(1)),
          windSpeedKnots: parseFloat((windKmph / 1.852).toFixed(1)),
          windGustsKmph: parseFloat(windGustsKmph.toFixed(1)),
          windDirectionDegrees: windDirDeg,
          airTemperatureCelsius: parseFloat(airTempC.toFixed(1)),
          surfacePressureHpa: parseFloat(pressureHpa.toFixed(1)),
          precipitationMm: current.precipitation ?? 0.0,
          isHighWindWarning: isImd45KmphViolated,
          operationalAdvisory: isImd45KmphViolated
            ? "WARNING: Surface winds exceed 45 km/h threshold. Small craft operations advised against."
            : "NORMAL: Surface wind conditions within safe operational envelope.",
        },
        forecast24h: {
          hourlyTime: (raw.hourly?.time || []).slice(0, 24),
          hourlyWindSpeedKmph: (raw.hourly?.wind_speed_10m || []).slice(0, 24),
          hourlyTemperatureC: (raw.hourly?.temperature_2m || []).slice(0, 24),
        },
      };
    })
      .ifFail((err) => ({
        success: false,
        isError: true,
        error: err.message,
        source: "WEATHER_API_FALLBACK",
        coordinates: { latitude, longitude },
        weather: {
          surfaceWindSpeedKmph: 22.0,
          windSpeedKnots: 11.9,
          windGustsKmph: 28.0,
          windDirectionDegrees: 270,
          airTemperatureCelsius: 28.0,
          surfacePressureHpa: 1012.0,
          isHighWindWarning: false,
          operationalAdvisory: "Standard operational advisories apply.",
        },
      }))
      .unwrap();
  },
});
