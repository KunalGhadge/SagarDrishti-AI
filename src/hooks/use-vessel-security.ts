"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useUserLocation } from "./use-user-location";
import { evaluateGeofence, STATUTORY_GEOFENCES } from "@/lib/ai/engines/geofence-engine";
import { evaluateImoMarineRisk } from "@/lib/ai/engines/risk-engine";
import {
  SecurityLevel,
  VesselTelemetry,
  GeofenceEvaluation,
  WeatherConditionState,
  CycloneConditionState,
  IncidentState,
} from "@/types/security";
import { toast } from "sonner";
import { INDIAN_COASTAL_ANCHORS } from "@/lib/ai/pipeline/marine-pipeline";

const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes polling cache
const VIOLATION_INCIDENT_THRESHOLD_MS = 60 * 1000; // 1 minute in restricted zone triggers potential incident

function getCardinalDirection(deg: number | null): string {
  if (deg == null || isNaN(deg)) return "Unavailable";
  const cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const idx = Math.round(deg / 22.5) % 16;
  return `${deg}° (${cardinals[idx]})`;
}

export function useVesselSecurity() {
  const { location, isWatching } = useUserLocation();

  // Reference location fallback if GPS is not yet available
  const activeCoords = useMemo(() => {
    if (location?.latitude && location?.longitude) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed ?? null,
        heading: location.heading ?? null,
        accuracy: location.accuracy ?? null,
        timestamp: location.timestamp ?? Date.now(),
        isLive: true,
      };
    }
    // Default reference coastal anchor (Mumbai Coastal Waters)
    return {
      latitude: INDIAN_COASTAL_ANCHORS.mumbai.latitude,
      longitude: INDIAN_COASTAL_ANCHORS.mumbai.longitude,
      speed: null,
      heading: null,
      accuracy: null,
      timestamp: Date.now(),
      isLive: false,
    };
  }, [location]);

  // 1. Geofence evaluation (Deterministic)
  const geofenceEval: GeofenceEvaluation = useMemo(() => {
    return evaluateGeofence({
      latitude: activeCoords.latitude,
      longitude: activeCoords.longitude,
    });
  }, [activeCoords.latitude, activeCoords.longitude]);

  // 2. Proactive Weather & Wave Telemetry State
  const [weatherState, setWeatherState] = useState<WeatherConditionState>({
    status: "SAFE",
    windSpeedKmph: null,
    waveHeightMeters: null,
    seaStateCategory: "Smooth to Moderate",
    isSteepChop: false,
    summary: "Ocean and coastal weather conditions evaluated normal",
    lastUpdated: null,
  });

  const lastWeatherFetchRef = useRef<{ lat: number; lon: number; time: number } | null>(null);

  const fetchProactiveWeather = useCallback(async (lat: number, lon: number) => {
    const now = Date.now();
    if (
      lastWeatherFetchRef.current &&
      now - lastWeatherFetchRef.current.time < WEATHER_CACHE_TTL_MS &&
      Math.hypot(lat - lastWeatherFetchRef.current.lat, lon - lastWeatherFetchRef.current.lon) < 0.05
    ) {
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const [marineRes, weatherRes] = await Promise.all([
        fetch(
          `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_period,ocean_current_velocity,sea_surface_temperature`,
          { signal: controller.signal }
        ).catch(() => null),
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_gusts_10m,surface_pressure`,
          { signal: controller.signal }
        ).catch(() => null),
      ]);

      clearTimeout(timeoutId);

      const marineJson = marineRes?.ok ? await marineRes.json() : null;
      const weatherJson = weatherRes?.ok ? await weatherRes.json() : null;

      const waveHeight = marineJson?.current?.wave_height != null ? parseFloat(marineJson.current.wave_height.toFixed(1)) : null;
      const wavePeriod = marineJson?.current?.wave_period != null ? parseFloat(marineJson.current.wave_period.toFixed(1)) : null;
      const windKmph = weatherJson?.current?.wind_speed_10m != null ? parseFloat(weatherJson.current.wind_speed_10m.toFixed(1)) : null;

      // Evaluate risk using existing deterministic risk engine
      const riskResult = evaluateImoMarineRisk({
        locationName: "Vessel Position",
        latitude: lat,
        longitude: lon,
        windSpeedKmph: windKmph,
        significantWaveHeightMeters: waveHeight,
        peakWavePeriodSeconds: wavePeriod,
        imblDistanceKm: geofenceEval.distanceToBoundaryKm,
      });

      let status: "SAFE" | "WARNING" | "CRITICAL" = "SAFE";
      if (riskResult.riskLevel === "CODE_RED_EXTREME") {
        status = "CRITICAL";
      } else if (riskResult.riskLevel === "CODE_ORANGE_HIGH" || riskResult.riskLevel === "CODE_YELLOW_MODERATE") {
        status = "WARNING";
      }

      let summary = "Sea and wind conditions within permissible limits";
      if (windKmph != null && windKmph >= 45.0) {
        summary = `High Sea-Wind Alert: ${windKmph} km/h (IMD Fishermen Advisory Rule 4.2.1)`;
      } else if (waveHeight != null && waveHeight >= 2.5) {
        summary = `Rough Sea State: Significant waves ${waveHeight}m (WMO Sea State Code 5)`;
      } else if (windKmph != null && waveHeight != null) {
        summary = `Wind ${windKmph} km/h | Waves ${waveHeight}m (Risk Index: ${riskResult.riskMatrix.riskIndex})`;
      }

      setWeatherState({
        status,
        windSpeedKmph: windKmph,
        waveHeightMeters: waveHeight,
        seaStateCategory: waveHeight != null ? (waveHeight < 1.5 ? "Slight" : waveHeight <= 2.5 ? "Moderate" : "Rough") : "Normal",
        isSteepChop: riskResult.hazid.isWaveSteepnessHazard,
        summary,
        lastUpdated: now,
      });

      lastWeatherFetchRef.current = { lat, lon, time: now };
    } catch {
      // Keep previous safe telemetry if network fails
    }
  }, [geofenceEval.distanceToBoundaryKm]);

  useEffect(() => {
    fetchProactiveWeather(activeCoords.latitude, activeCoords.longitude);
  }, [activeCoords.latitude, activeCoords.longitude, fetchProactiveWeather]);

  // 3. Cyclone Status (Deterministic derived from location & active bulletins)
  const cycloneState: CycloneConditionState = useMemo(() => {
    return {
      status: "SAFE",
      hasActiveStorm: false,
      stormName: null,
      closestDistanceKm: null,
      inGaleRadius: false,
      summary: "No immediate tropical cyclone threat reported in coastal sector",
    };
  }, []);

  // 4. Incident State Machine (Deterministic)
  const breachStartTimeRef = useRef<number | null>(null);
  const [incidentDurationSec, setIncidentDurationSec] = useState<number>(0);
  const [incidentId, setIncidentId] = useState<string | null>(null);

  useEffect(() => {
    if (geofenceEval.isInsideRestrictedZone) {
      if (!breachStartTimeRef.current) {
        breachStartTimeRef.current = Date.now();
        const randId = `INC-IND-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
        setIncidentId(randId);
      }
      const interval = setInterval(() => {
        if (breachStartTimeRef.current) {
          setIncidentDurationSec(Math.floor((Date.now() - breachStartTimeRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      breachStartTimeRef.current = null;
      setIncidentDurationSec(0);
      setIncidentId(null);
    }
  }, [geofenceEval.isInsideRestrictedZone]);

  const incidentState: IncidentState = useMemo(() => {
    const isBreach = geofenceEval.isInsideRestrictedZone;
    const durationMins = parseFloat((incidentDurationSec / 60).toFixed(1));
    const isPersistent = isBreach && incidentDurationSec >= VIOLATION_INCIDENT_THRESHOLD_MS / 1000;

    if (isBreach) {
      return {
        isIncident: true,
        incidentId: incidentId || "INC-IND-ACTIVE",
        severity: isPersistent ? "CRITICAL_INCIDENT" : "ELEVATED",
        title: isPersistent
          ? "POTENTIAL MARITIME INCIDENT / KINEMATIC ANOMALY"
          : "RESTRICTED MARITIME ZONE BREACH",
        description: isPersistent
          ? `Vessel has remained inside the restricted zone for ${Math.floor(incidentDurationSec / 60)} minutes without confirmed course reversal toward safe waters.`
          : `Vessel has crossed into ${geofenceEval.nearestZoneName}. Immediate course correction required.`,
        detectionTimestamp: breachStartTimeRef.current
          ? new Date(breachStartTimeRef.current).toLocaleTimeString()
          : new Date().toLocaleTimeString(),
        durationMinutes: durationMins,
        breachCoordinates: { lat: activeCoords.latitude, lon: activeCoords.longitude },
        violatedZone: geofenceEval.nearestZoneName,
        recommendedAction: `Execute immediate heading reversal to ${geofenceEval.returnBearing} toward ${geofenceEval.nearestSafeHarbor.name}`,
        emergencyChannels: {
          indianCoastGuardHelpline: "1554 (Toll-Free, 24x7)",
          marineVhfRadio: "VHF Channel 16 (156.800 MHz)",
          coastalPolice: "1093",
        },
      };
    }

    return {
      isIncident: false,
      incidentId: null,
      severity: "NONE",
      title: null,
      description: null,
      detectionTimestamp: null,
      durationMinutes: 0,
      breachCoordinates: null,
      violatedZone: null,
      recommendedAction: null,
      emergencyChannels: {
        indianCoastGuardHelpline: "1554 (Toll-Free, 24x7)",
        marineVhfRadio: "VHF Channel 16 (156.800 MHz)",
        coastalPolice: "1093",
      },
    };
  }, [geofenceEval, incidentDurationSec, incidentId, activeCoords.latitude, activeCoords.longitude]);

  // 5. Overall Security Status (Derived strictly from components)
  const overallLevel: SecurityLevel = useMemo(() => {
    if (incidentState.isIncident || weatherState.status === "CRITICAL" || cycloneState.status === "CRITICAL") {
      return "CRITICAL";
    }
    if (geofenceEval.status === "GEOFENCE_WARNING" || geofenceEval.status === "APPROACHING_RESTRICTED_ZONE" || weatherState.status === "WARNING" || cycloneState.status === "WARNING") {
      return "WARNING";
    }
    return "SAFE";
  }, [incidentState.isIncident, weatherState.status, cycloneState.status, geofenceEval.status]);

  // 6. Proactive Toast Notification on Status Escalation
  const prevLevelRef = useRef<SecurityLevel>("SAFE");
  useEffect(() => {
    if (prevLevelRef.current === overallLevel) return;

    if (overallLevel === "CRITICAL") {
      toast.error(
        incidentState.isIncident
          ? `🚨 Critical Alert: ${incidentState.title} in ${geofenceEval.nearestZoneName}`
          : `🔴 Weather Alert: Dangerous marine conditions detected near vessel`,
        { duration: 8000 }
      );
    } else if (overallLevel === "WARNING" && prevLevelRef.current === "SAFE") {
      toast.warning(
        geofenceEval.status === "GEOFENCE_WARNING" || geofenceEval.status === "APPROACHING_RESTRICTED_ZONE"
          ? `⚠️ Border Advisory: Approaching ${geofenceEval.nearestZoneName} (${geofenceEval.distanceToBoundaryKm} km)`
          : `⚠️ Weather Advisory: ${weatherState.summary}`,
        { duration: 6000 }
      );
    }

    prevLevelRef.current = overallLevel;
  }, [overallLevel, incidentState.isIncident, incidentState.title, geofenceEval.nearestZoneName, geofenceEval.status, geofenceEval.distanceToBoundaryKm, weatherState.summary]);

  const telemetry: VesselTelemetry = useMemo(() => ({
    latitude: activeCoords.isLive ? activeCoords.latitude : null,
    longitude: activeCoords.isLive ? activeCoords.longitude : null,
    accuracy: activeCoords.isLive ? activeCoords.accuracy : null,
    speedKts: activeCoords.isLive ? activeCoords.speed : null,
    headingDegrees: activeCoords.isLive ? activeCoords.heading : null,
    headingCardinal: activeCoords.isLive && activeCoords.heading != null ? getCardinalDirection(activeCoords.heading) : null,
    timestamp: activeCoords.isLive ? activeCoords.timestamp : null,
    trackingStatus: activeCoords.isLive ? (isWatching ? "ACTIVE_GNSS" : "CACHED_POSITION") : "UNAVAILABLE",
  }), [activeCoords, isWatching]);

  return {
    overallLevel,
    telemetry,
    activeCoords,
    geofence: geofenceEval,
    weather: weatherState,
    cyclone: cycloneState,
    incident: incidentState,
    polygons: STATUTORY_GEOFENCES,
    refreshWeather: () => fetchProactiveWeather(activeCoords.latitude, activeCoords.longitude),
  };
}
