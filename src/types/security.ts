import { SafeHarborResult } from "@/lib/ai/engines/marine-geospatial-engine";

export type SecurityLevel = "SAFE" | "WARNING" | "CRITICAL";

export type GeofenceRiskStatus =
  | "SAFE"
  | "APPROACHING"
  | "CRITICAL_PROXIMITY"
  | "BREACH";

export interface VesselTelemetry {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speedKts: number | null;
  headingDegrees: number | null;
  headingCardinal: string | null;
  timestamp: number | null;
  trackingStatus: "LIVE_GNSS" | "CACHED_POSITION" | "UNAVAILABLE";
}

export interface GeofenceEvaluation {
  status: GeofenceRiskStatus;
  isInsideRestrictedZone: boolean;
  distanceToBoundaryKm: number | null;
  nearestZoneName: string;
  zoneType: "imbl" | "mpa" | "hazard" | "safe";
  closestBoundaryPoint: { lat: number; lon: number } | null;
  nearestSafeHarbor: SafeHarborResult;
  distanceToSafePortNM: number;
  returnBearing: string;
  recommendedAction: string;
}

export interface WeatherConditionState {
  status: "SAFE" | "WARNING" | "CRITICAL";
  windSpeedKmph: number | null;
  windGustsKmph: number | null;
  waveHeightMeters: number | null;
  wavePeriodSeconds: number | null;
  currentVelocityMs: number | null;
  seaStateCategory: string;
  isSteepChop: boolean;
  summary: string;
  lastUpdated: number | null;
  source: string;
}

export interface CycloneConditionState {
  status: "SAFE" | "WARNING" | "CRITICAL";
  hasActiveStorm: boolean;
  stormName: string | null;
  closestDistanceKm: number | null;
  inGaleRadius: boolean;
  summary: string;
  source: string;
}

export interface IncidentTimelineEntry {
  timestamp: string;
  event: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
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
  timeline: IncidentTimelineEntry[];
  emergencyChannels: {
    indianCoastGuardHelpline: string;
    marineVhfRadio: string;
    coastalPolice: string;
  };
}

export interface ActiveAlert {
  id: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  category: "GEOFENCE" | "WEATHER" | "INCIDENT" | "NAVIGATION";
  description: string;
  timestamp: number;
  timeAgo: string;
  source: string;
  affectedLocation: string;
}

export type AutonomousIncidentStage =
  | "IDLE"
  | "BREACH_COUNTDOWN"
  | "OPERATOR_CONFIRMED_INTENTIONAL"
  | "UNRESPONSIVE_ESCALATED"
  | "SOS_TRIGGERED";

export interface AutonomousIncidentWorkflow {
  isActive: boolean;
  incidentId: string | null;
  stage: AutonomousIncidentStage;
  countdownDeadline: number | null;
  zoneName: string;
  coordinates: { lat: number; lon: number };
  speedKts: number | null;
  headingDeg: number | null;
  nearestPort: string;
  portDistanceNM: number;
  returnBearing: string;
  weatherSummary: string;
  detectedAt: string;
  acknowledgedAt?: string;
  escalatedAt?: string;
  timeline: IncidentTimelineEntry[];
}

export interface OverallSecurityState {
  overallLevel: SecurityLevel;
  telemetry: VesselTelemetry;
  geofence: GeofenceEvaluation;
  weather: WeatherConditionState;
  cyclone: CycloneConditionState;
  incident: IncidentState;
  activeAlerts: ActiveAlert[];
  incidentWorkflow: AutonomousIncidentWorkflow;
}
