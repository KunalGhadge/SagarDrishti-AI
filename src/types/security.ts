import { SafeHarborResult } from "@/lib/ai/engines/marine-geospatial-engine";

export type SecurityLevel = "SAFE" | "WARNING" | "CRITICAL";

export type GeofenceRiskStatus =
  | "SAFE"
  | "APPROACHING_RESTRICTED_ZONE"
  | "GEOFENCE_WARNING"
  | "OUTSIDE_PERMITTED_AREA"
  | "PERSISTENT_VIOLATION"
  | "POTENTIAL_INCIDENT";

export interface VesselTelemetry {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speedKts: number | null;
  headingDegrees: number | null;
  headingCardinal: string | null;
  timestamp: number | null;
  trackingStatus: "ACTIVE_GNSS" | "CACHED_POSITION" | "UNAVAILABLE";
}

export interface GeofenceEvaluation {
  status: GeofenceRiskStatus;
  isInsideRestrictedZone: boolean;
  distanceToBoundaryKm: number | null;
  nearestZoneName: string;
  zoneType: "imbl" | "mpa" | "hazard" | "safe";
  nearestSafeHarbor: SafeHarborResult;
  returnBearing: string;
}

export interface WeatherConditionState {
  status: "SAFE" | "WARNING" | "CRITICAL";
  windSpeedKmph: number | null;
  waveHeightMeters: number | null;
  seaStateCategory: string;
  isSteepChop: boolean;
  summary: string;
  lastUpdated: number | null;
}

export interface CycloneConditionState {
  status: "SAFE" | "WARNING" | "CRITICAL";
  hasActiveStorm: boolean;
  stormName: string | null;
  closestDistanceKm: number | null;
  inGaleRadius: boolean;
  summary: string;
}

export interface IncidentState {
  isIncident: boolean;
  incidentId: string | null;
  severity: "NONE" | "ELEVATED" | "CRITICAL_INCIDENT";
  title: string | null;
  description: string | null;
  detectionTimestamp: string | null;
  durationMinutes: number;
  breachCoordinates: { lat: number; lon: number } | null;
  violatedZone: string | null;
  recommendedAction: string | null;
  emergencyChannels: {
    indianCoastGuardHelpline: string;
    marineVhfRadio: string;
    coastalPolice: string;
  };
}

export interface OverallSecurityState {
  overallLevel: SecurityLevel;
  telemetry: VesselTelemetry;
  geofence: GeofenceEvaluation;
  weather: WeatherConditionState;
  cyclone: CycloneConditionState;
  incident: IncidentState;
}
