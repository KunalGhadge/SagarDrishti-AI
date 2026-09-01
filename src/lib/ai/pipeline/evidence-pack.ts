/**
 * Evidence Pack Data Schema (Phase 1 Core Pipeline)
 * Strictly tags EVERY single field as 'real' | 'simulated' | 'unavailable' with data source.
 */

export type DataFieldStatus = "real" | "simulated" | "unavailable";

export interface EvidenceField<T> {
  value: T;
  status: DataFieldStatus;
  source: string;
  unit?: string;
}

export interface EvidencePackLocation {
  coastalZone: EvidenceField<string>;
  harbor: EvidenceField<string>;
  latitude: EvidenceField<number>;
  longitude: EvidenceField<number>;
  distanceToShoreKm: EvidenceField<number>;
}

export interface EvidencePackWeather {
  surfaceWindSpeedKmph: EvidenceField<number | null>;
  windDirectionDegrees: EvidenceField<number | null>;
  airTemperatureCelsius: EvidenceField<number | null>;
  atmosphericPressureHpa: EvidenceField<number | null>;
  lightningRisk: EvidenceField<string | null>;
  activeCycloneAlert: EvidenceField<boolean>;
  cycloneName: EvidenceField<string | null>;
  galeWindRadiusKm: EvidenceField<number | null>;
}

export interface EvidencePackOceanPhysics {
  significantWaveHeightMeters: EvidenceField<number | null>;
  peakWavePeriodSeconds: EvidenceField<number | null>;
  waveSteepnessRatio: EvidenceField<number | null>;
  swellWaveHeightMeters: EvidenceField<number | null>;
  swellWavePeriodSeconds: EvidenceField<number | null>;
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
  targetCatchSpecies: EvidenceField<string[]>;
}

export interface EvidencePackGeospatialSafety {
  imblBoundaryName: EvidenceField<string | null>;
  distanceToImblKm: EvidenceField<number | null>;
  isApproachingBorderAlert: EvidenceField<boolean>;
  nearestMarineProtectedArea: EvidenceField<string | null>;
  distanceToMpaKm: EvidenceField<number | null>;
  isInsideRestrictedMpa: EvidenceField<boolean>;
  imoRiskIndex: EvidenceField<number>;
  imoSafetyBadge: EvidenceField<"CODE_GREEN" | "CODE_YELLOW" | "CODE_ORANGE" | "CODE_RED">;
  portDangerSignalHoisted: EvidenceField<number | null>;
  smallCraftAdvisory: EvidenceField<string>;
  mechanizedVesselAdvisory: EvidenceField<string>;
}

export interface EvidencePack {
  schemaVersion: "3.0.0-EVIDENCE-PACK";
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
    realFieldsCount: number;
    simulatedFieldsCount: number;
    unavailableFieldsCount: number;
    primaryRealApisUsed: string[];
  };
}
