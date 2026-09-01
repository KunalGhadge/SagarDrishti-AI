import { tool as createTool } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";

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
    "Real-Time Coastal & Marine Weather Tool (Open-Meteo Global Forecasting API with ECMWF IFS model). Fetches real-time 10m Surface Wind Speed, Wind Gusts, Wind Direction, Atmospheric Pressure, 2m Air Temperature, and Precipitation.",
  inputSchema: jsonSchemaToZod(imdWeatherQuerySchema),
  execute: async ({ coastalRegion, districtName, latitude = 18.922, longitude = 72.8346 }) => {
    return safe(async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=wind_speed_10m,temperature_2m&models=ecmwf_ifs025,best_match&forecast_days=2`;

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);

      if (!res.ok) {
        throw new Error(`Open-Meteo weather service returned HTTP ${res.status}`);
      }

      const raw = await res.json();
      const current = raw.current || {};
      const timestamp = new Date().toISOString();

      const windKmph = current.wind_speed_10m != null ? parseFloat(current.wind_speed_10m.toFixed(1)) : null;
      const windGustsKmph = current.wind_gusts_10m != null ? parseFloat(current.wind_gusts_10m.toFixed(1)) : null;
      const pressureHpa = current.surface_pressure != null ? parseFloat(current.surface_pressure.toFixed(1)) : null;
      const airTempC = current.temperature_2m != null ? parseFloat(current.temperature_2m.toFixed(1)) : null;
      const windDirDeg = current.wind_direction_10m != null ? Math.round(current.wind_direction_10m) : null;
      const precipitationMm = current.precipitation != null ? parseFloat(current.precipitation.toFixed(1)) : null;

      // IMD 45 km/h Sea-Wind threshold evaluation
      const isImd45KmphViolated = windKmph != null && windKmph >= 45.0;

      return {
        success: true,
        source: "Open-Meteo Global Weather API (ECMWF IFS 0.25 model)",
        timestamp,
        coordinates: { latitude, longitude },
        location: {
          region: coastalRegion || "Indian Coastal Sector",
          district: districtName || "Coastal Station",
        },
        weather: {
          surfaceWindSpeedKmph: {
            value: windKmph,
            status: windKmph != null ? "live" : "unavailable",
            unit: "km/h",
          },
          windSpeedKnots: {
            value: windKmph != null ? parseFloat((windKmph / 1.852).toFixed(1)) : null,
            status: windKmph != null ? "derived" : "unavailable",
            unit: "knots",
          },
          windGustsKmph: {
            value: windGustsKmph,
            status: windGustsKmph != null ? "live" : "unavailable",
            unit: "km/h",
          },
          windDirectionDegrees: {
            value: windDirDeg,
            status: windDirDeg != null ? "live" : "unavailable",
            unit: "degrees",
          },
          airTemperatureCelsius: {
            value: airTempC,
            status: airTempC != null ? "live" : "unavailable",
            unit: "°C",
          },
          surfacePressureHpa: {
            value: pressureHpa,
            status: pressureHpa != null ? "live" : "unavailable",
            unit: "hPa",
          },
          precipitationMm: {
            value: precipitationMm,
            status: precipitationMm != null ? "live" : "unavailable",
            unit: "mm",
          },
          isHighWindWarning: isImd45KmphViolated,
          operationalAdvisory: isImd45KmphViolated
            ? "WARNING: Surface winds exceed IMD 45 km/h threshold (Rule 4.2.1). Small craft operations advised against."
            : windKmph != null
            ? "NORMAL: Surface wind conditions within safe operational envelope (< 45 km/h)."
            : "UNAVAILABLE: Surface wind observation unavailable.",
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
        source: "Open-Meteo Global Weather API (Request Failed / Data Unavailable)",
        timestamp: new Date().toISOString(),
        coordinates: { latitude, longitude },
        weather: {
          surfaceWindSpeedKmph: { value: null, status: "unavailable", unit: "km/h" },
          windSpeedKnots: { value: null, status: "unavailable", unit: "knots" },
          windGustsKmph: { value: null, status: "unavailable", unit: "km/h" },
          windDirectionDegrees: { value: null, status: "unavailable", unit: "degrees" },
          airTemperatureCelsius: { value: null, status: "unavailable", unit: "°C" },
          surfacePressureHpa: { value: null, status: "unavailable", unit: "hPa" },
          precipitationMm: { value: null, status: "unavailable", unit: "mm" },
          isHighWindWarning: false,
          operationalAdvisory: "UNAVAILABLE: Weather service unreachable.",
        },
      }))
      .unwrap();
  },
});
