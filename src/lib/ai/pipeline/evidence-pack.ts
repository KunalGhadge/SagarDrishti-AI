/**
 * Evidence Pack Data Schema (Strict Data Integrity)
 * Every single field carries value, status ("live" | "unavailable" | "statutory" | "derived"),
 * explicit source, retrieval timestamp, and unit.
 * ZERO fabricated fallback numbers allowed.
 */

export type DataFieldStatus = "live" | "unavailable" | "statutory" | "derived";

export interface EvidenceField<T> {
  value: T;
  status: DataFieldStatus;
  source: string;
  timestamp: string;
  unit?: string;
}

export interface EvidencePackLocation {
  coastalZone: EvidenceField<string>;
  harbor: EvidenceField<string>;
  latitude: EvidenceField<number>;
  longitude: EvidenceField<number>;
  distanceToShoreKm: EvidenceField<number | null>;
}

export interface EvidencePackWeather {
  surfaceWindSpeedKmph: EvidenceField<number | null>;
  windDirectionDegrees: EvidenceField<number | null>;
  airTemperatureCelsius: EvidenceField<number | null>;
  atmosphericPressureHpa: EvidenceField<number | null>;
  lightningRisk: EvidenceField<string | null>;
  activeCycloneAlert: EvidenceField<boolean | null>;
  cycloneName: EvidenceField<string | null>;
  galeWindRadiusKm: EvidenceField<number | null>;
}

export interface EvidencePackOceanPhysics {
  significantWaveHeightMeters: EvidenceField<number | null>;
  peakWavePeriodSeconds: EvidenceField<number | null>;
  waveDirectionDegrees: EvidenceField<number | null>;
  windWaveHeightMeters: EvidenceField<number | null>;
  windWaveDirectionDegrees: EvidenceField<number | null>;
  swellWaveHeightMeters: EvidenceField<number | null>;
  swellWavePeriodSeconds: EvidenceField<number | null>;
  swellWaveDirectionDegrees: EvidenceField<number | null>;
  waveSteepnessRatio: EvidenceField<number | null>;
  oceanCurrentVelocityMs: EvidenceField<number | null>;
  oceanCurrentDirectionDegrees: EvidenceField<number | null>;
  seaSurfaceTemperatureCelsius: EvidenceField<number | null>;
}

export interface EvidencePackBioOptics {
  chlorophyllConcentrationMgM3: EvidenceField<number | null>;
  horizontalSstGradientDegPer5Km: EvidenceField<number | null>;
  isThermalFrontActive: EvidenceField<boolean>;
  isUpwellingPresent: EvidenceField<boolean>;
  nearestPfzCoordinates: EvidenceField<{ latitude: number; longitude: number } | null>;
  nearestPfzDistanceNM: EvidenceField<number | null>;
  nearestPfzBearing: EvidenceField<string | null>;
  insightReasoning: EvidenceField<string>;
}

export interface EvidencePackGeospatialSafety {
  imblBoundaryName: EvidenceField<string | null>;
  distanceToImblKm: EvidenceField<number | null>;
  isApproachingBorderAlert: EvidenceField<boolean>;
  nearestMarineProtectedArea: EvidenceField<string | null>;
  distanceToMpaKm: EvidenceField<number | null>;
  isInsideRestrictedMpa: EvidenceField<boolean>;
  zoneWarning: EvidenceField<string | null>;
  imoRiskIndex: EvidenceField<number>;
  imoSafetyBadge: EvidenceField<"CODE_GREEN" | "CODE_YELLOW" | "CODE_ORANGE" | "CODE_RED">;
  portDangerSignalHoisted: EvidenceField<number | null>;
  smallCraftAdvisory: EvidenceField<string>;
  mechanizedVesselAdvisory: EvidenceField<string>;
  riskReasoning: EvidenceField<string>;
  hazardAuditTrail: EvidenceField<Array<{
    hazard: string;
    rule: string;
    threshold: string;
    measured: string;
    status: string;
  }>>;
}

export interface EvidencePack {
  schemaVersion: "4.0.0-EVIDENCE-PACK-STRICT-INTEGRITY";
  timestamp: string;
  intentCategory: string;
  userQuery: string;
  location: EvidencePackLocation;
  weather: EvidencePackWeather;
  oceanPhysics: EvidencePackOceanPhysics;
  bioOptics: EvidencePackBioOptics;
  geospatialSafety: EvidencePackGeospatialSafety;
  auditSummary: {
    totalFieldsCount: number;
    liveFieldsCount: number;
    statutoryFieldsCount: number;
    derivedFieldsCount: number;
    unavailableFieldsCount: number;
    activeApisUsed: string[];
  };
}
