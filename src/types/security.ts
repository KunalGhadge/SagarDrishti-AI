/**
 * SagarDrishti-AI Maritime Security, Geospatial & Data Provenance Types
 * Strictly Evidence-Based Architecture (UNCLOS, NHO, MoPSW, MoEFCC, WGS84)
 * ZERO Fabricated Data Policy
 */

export type SecurityLevel = "SAFE" | "WARNING" | "CRITICAL";

export type GeofenceRiskStatus =
  | "SAFE"
  | "APPROACHING"
  | "CRITICAL_PROXIMITY"
  | "BREACH";

export type VerificationStatus =
  | "VERIFIED_AUTHORITATIVE"
  | "VERIFIED_GOVERNMENT"
  | "VERIFIED_REFERENCE"
  | "UNVERIFIED"
  | "UNAVAILABLE";

export type MaritimeZoneCategory =
  | "LEGAL_MARITIME_ZONE"
  | "INTERNATIONAL_MARITIME_BOUNDARY"
  | "PORT_HARBOUR_LIMIT"
  | "RESTRICTED_AREA"
  | "MARINE_PROTECTED_AREA"
  | "SYSTEM_SAFETY_BUFFER";

export interface GeospatialProvenance {
  id: string;
  name: string;
  type: MaritimeZoneCategory;
  sourceName: string;
  sourceOrganization: string;
  sourceDocument: string;
  sourceUrl: string;
  sourceVersion?: string;
  sourceDate: string;
  coordinateReferenceSystem: string; // e.g. "EPSG:4326 (WGS84)"
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string;
  canTriggerAutonomousBoundaryIncident: boolean;
  legalBasis?: string;
  notes?: string;
}

export interface StatutoryGeofenceDefinition {
  id: string;
  name: string;
  type: "imbl" | "mpa" | "hazard" | "legal_zone";
  category: MaritimeZoneCategory;
  color: string;
  description: string;
  coordinates: Array<{ lat: number; lon: number }>;
  provenance: GeospatialProvenance;
}

export interface VerifiedPort {
  id: string;
  officialName: string;
  state: string;
  authority: string;
  latitude: number;
  longitude: number;
  portType: "MAJOR_PORT" | "NON_MAJOR_PORT" | "FISHERIES_HARBOUR";
  sourceName: string;
  sourceOrganization: string;
  sourceDocument: string;
  sourceUrl: string;
  sourceDate: string;
  coordinateReferenceSystem: string;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string;
  assignedMrcc: string;
  statutoryHelpline: string;
  vhfDistressChannel: string;
}

export interface VerifiedPortResult {
  name: string;
  state: string;
  authority: string;
  latitude: number;
  longitude: number;
  distanceNM: number;
  distanceKm: number;
  bearing: string;
  assignedMrcc: string;
  verificationStatus: VerificationStatus;
  sourceDocument: string;
  navigationDisclaimer: string;
}

export interface VesselTelemetry {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speedKts: number | null;
  headingDegrees: number | null;
  headingCardinal: string | null;
  timestamp: number | null;
  trackingStatus: "LIVE_GNSS" | "CACHED_POSITION" | "UNAVAILABLE";
  isSimulated?: boolean;
}

export interface GeofenceEvaluation {
  status: GeofenceRiskStatus;
  isInsideRestrictedZone: boolean;
  distanceToBoundaryKm: number | null;
  nearestZoneName: string;
  zoneType: "imbl" | "mpa" | "hazard" | "legal_zone" | "safe";
  category: MaritimeZoneCategory;
  bufferClassification: "NORMAL" | "SYSTEM_SAFETY_BUFFER_APPROACHING" | "SYSTEM_SAFETY_BUFFER_CRITICAL" | "BREACH";
  closestBoundaryPoint: { lat: number; lon: number } | null;
  nearestSafeHarbor: VerifiedPortResult; // Backward-compatible name, verified port object
  distanceToSafePortNM: number;
  returnBearing: string;
  recommendedAction: string;
  provenance: GeospatialProvenance | null;
  canTriggerAutonomousBreach: boolean;
  integrityNote?: string;
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
  dataType: "NUMERICAL_MODEL_FORECAST" | "IN_SITU_SENSOR_OBSERVATION";
  forecastModel: string;
  queryCoordinates: { lat: number; lon: number } | null;
}

export interface CycloneConditionState {
  status: "SAFE" | "WARNING" | "CRITICAL";
  hasActiveStorm: boolean;
  stormName: string | null;
  closestDistanceKm: number | null;
  inGaleRadius: boolean;
  summary: string;
  source: string;
  dataType: "NUMERICAL_MODEL_FORECAST" | "IN_SITU_SENSOR_OBSERVATION";
}

export interface IncidentTimelineEntry {
  timestamp: string;
  event: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  provenanceSource?: string;
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
  provenance: GeospatialProvenance | null;
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
  provenance?: GeospatialProvenance;
  dataType?: "OBSERVATION" | "NUMERICAL_FORECAST_MODEL" | "OFFICIAL_STATUTORY_RECORD";
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
  provenance: GeospatialProvenance | null;
}

export interface OfficialWarningState {
  source: string;
  sourceType: "official" | "derived";
  issuedAt: string | null;
  fetchedAt: string;
  area: string;
  status: "NO_ACTIVE_WARNING" | "ACTIVE_WARNING" | "WARNING_DATA_UNAVAILABLE";
  verified: boolean;
  warningLevel: string;
  bulletinTitle?: string;
  advisoryText?: string;
  officialBulletinUrl?: string | null;
  officialGraphicUrl?: string | null;
}

export interface SagarDrishtiRiskAssessment {
  level: "CODE_GREEN" | "CODE_YELLOW" | "CODE_ORANGE" | "CODE_RED";
  badge: string;
  riskIndex: number;
  riskScore: number;
  reasoning: string;
  basis: string[];
  source: string;
  timestamp: number;
}

export interface DataQualityIntegrity {
  gnssStatus: "LIVE" | "UNAVAILABLE";
  boundaryDataStatus: "VERIFIED" | "LIMITED";
  portDataStatus: "VERIFIED" | "UNVERIFIED";
  weatherDataStatus: "LIVE_MODEL_STREAM" | "STALE" | "UNAVAILABLE";
  autonomousMode: "ENABLED" | "LIMITED";
  gatingReason?: string;
  lastAuditTimestamp: string;
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
  dataIntegrity: DataQualityIntegrity;
  officialWarning?: OfficialWarningState;
  riskAssessment?: SagarDrishtiRiskAssessment;
}

