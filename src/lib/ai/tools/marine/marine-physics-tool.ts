import { tool as createTool } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";

export const marinePhysicsQuerySchema: JSONSchema7 = {
  type: "object",
  properties: {
    latitude: {
      type: "number",
      description: "Latitude coordinate of coastal or deep-sea point (e.g., 18.922 for Mumbai)",
    },
    longitude: {
      type: "number",
      description: "Longitude coordinate of coastal or deep-sea point (e.g., 72.8346 for Mumbai)",
    },
    includeHourlyHistory: {
      type: "boolean",
      description: "Whether to fetch 24-hour historical progression",
      default: true,
    },
  },
  required: ["latitude", "longitude"],
};

export const marinePhysicsTool = createTool({
  description:
    "Live Ocean Physics & Satellite SST Tool (Open-Meteo Copernicus Marine Model). Fetches real-time Sea Surface Temperature (SST), Significant Wave Height (Hs), Wave Direction, Peak Wave Period (Tp), Wind Wave Height/Direction, Swell Wave Height/Direction/Period, and Ocean Current Velocity/Direction vectors.",
  inputSchema: jsonSchemaToZod(marinePhysicsQuerySchema),
  execute: async ({ latitude, longitude, includeHourlyHistory = true }) => {
    return safe(async () => {
      const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&current=wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature&hourly=wave_height,wave_period,ocean_current_velocity,sea_surface_temperature&past_days=1&forecast_days=2`;

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);

      if (!res.ok) {
        throw new Error(`Open-Meteo marine service returned HTTP ${res.status}`);
      }

      const raw = await res.json();
      const current = raw.current || {};
      const timestamp = new Date().toISOString();

      const waveHeight = current.wave_height != null ? parseFloat(current.wave_height.toFixed(2)) : null;
      const wavePeriod = current.wave_period != null ? parseFloat(current.wave_period.toFixed(1)) : null;
      const waveDirection = current.wave_direction != null ? Math.round(current.wave_direction) : null;
      const windWaveHeight = current.wind_wave_height != null ? parseFloat(current.wind_wave_height.toFixed(2)) : null;
      const windWaveDirection = current.wind_wave_direction != null ? Math.round(current.wind_wave_direction) : null;
      const swellHeight = current.swell_wave_height != null ? parseFloat(current.swell_wave_height.toFixed(2)) : null;
      const swellDirection = current.swell_wave_direction != null ? Math.round(current.swell_wave_direction) : null;
      const swellPeriod = current.swell_wave_period != null ? parseFloat(current.swell_wave_period.toFixed(1)) : null;
      const currentVelocity = current.ocean_current_velocity != null ? parseFloat(current.ocean_current_velocity.toFixed(2)) : null;
      const currentDirection = current.ocean_current_direction != null ? Math.round(current.ocean_current_direction) : null;
      const sst = current.sea_surface_temperature != null ? parseFloat(current.sea_surface_temperature.toFixed(1)) : null;

      // Compute Wave Steepness if both height and period are available
      let waveSteepness: number | null = null;
      let isSteepChop = false;
      if (waveHeight != null && wavePeriod != null && wavePeriod > 0) {
        const waveLength = 1.56 * Math.pow(wavePeriod, 2);
        waveSteepness = parseFloat((waveHeight / Math.max(waveLength, 1)).toFixed(4));
        isSteepChop = waveSteepness > 0.04;
      }

      return {
        success: true,
        source: "Open-Meteo Marine API (Copernicus Marine model)",
        timestamp,
        coordinates: { latitude, longitude },
        physics: {
          seaSurfaceTemperature: {
            value: sst,
            status: sst != null ? "live" : "unavailable",
            unit: "°C",
            source: sst != null ? "Open-Meteo Marine API (Copernicus Marine model)" : "Data unavailable",
            isOptimalPelagicWindow: sst != null ? (sst >= 26.5 && sst <= 29.2) : false,
          },
          significantWaveHeight: {
            value: waveHeight,
            status: waveHeight != null ? "live" : "unavailable",
            unit: "meters",
            category: waveHeight != null ? (waveHeight < 1.5 ? "Smooth to Slight" : waveHeight <= 2.5 ? "Moderate" : "Rough") : "unavailable",
          },
          waveDirection: {
            value: waveDirection,
            status: waveDirection != null ? "live" : "unavailable",
            unit: "degrees",
          },
          wavePeriod: {
            value: wavePeriod,
            status: wavePeriod != null ? "live" : "unavailable",
            unit: "seconds",
          },
          windWaves: {
            heightMeters: windWaveHeight,
            directionDegrees: windWaveDirection,
            status: windWaveHeight != null ? "live" : "unavailable",
          },
          swellWaves: {
            heightMeters: swellHeight,
            directionDegrees: swellDirection,
            periodSeconds: swellPeriod,
            status: swellHeight != null ? "live" : "unavailable",
            isKallakkadalAlert: swellHeight != null && swellPeriod != null ? (swellHeight > 2.0 && swellPeriod > 14.0) : false,
          },
          waveSteepness: {
            value: waveSteepness,
            status: waveSteepness != null ? "derived" : "unavailable",
            isSteepChop,
          },
          oceanCurrents: {
            velocity: currentVelocity,
            directionDegrees: currentDirection,
            status: currentVelocity != null ? "live" : "unavailable",
            unit: "m/s",
            isConvergenceZone: currentVelocity != null ? (currentVelocity >= 0.25 && currentVelocity <= 0.75) : false,
          },
        },
      };
    })
      .ifFail((err) => ({
        success: false,
        isError: true,
        error: err.message,
        source: "Open-Meteo Marine API (Request Failed / Data Unavailable)",
        timestamp: new Date().toISOString(),
        coordinates: { latitude, longitude },
        physics: {
          seaSurfaceTemperature: { value: null, status: "unavailable", unit: "°C" },
          significantWaveHeight: { value: null, status: "unavailable", unit: "meters" },
          waveDirection: { value: null, status: "unavailable", unit: "degrees" },
          wavePeriod: { value: null, status: "unavailable", unit: "seconds" },
          windWaves: { heightMeters: null, directionDegrees: null, status: "unavailable" },
          swellWaves: { heightMeters: null, directionDegrees: null, periodSeconds: null, status: "unavailable" },
          waveSteepness: { value: null, status: "unavailable", isSteepChop: false },
          oceanCurrents: { velocity: null, directionDegrees: null, status: "unavailable" },
        },
      }))
      .unwrap();
  },
});
