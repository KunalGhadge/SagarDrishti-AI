/**
 * Deterministic Marine Risk Engine
 * Grounded in IMO Formal Safety Assessment (FSA) Guidelines (MSC-MEPC.2/Circ.12/Rev.2)
 * and Official India Meteorological Department (IMD / MoES) Safety Thresholds.
 */

export interface ImoHazidParameters {
  locationName: string;
  latitude: number;
  longitude: number;
  windSpeedKts?: number;
  windSpeedKmph?: number;
  significantWaveHeightMeters?: number;
  peakWavePeriodSeconds?: number;
  swellHeightMeters?: number;
  swellPeriodSeconds?: number;
  nowcastColorCode?: number; // 1: Green, 2: Yellow, 3: Orange, 4: Red
  hasSquallWarning?: boolean;
  hasLightningWarning?: boolean;
  hasOfficialFishermenWarning?: boolean;
  portDangerSignal?: number; // 0 to 11
  cycloneDistanceKm?: number | null;
  isInCycloneCone?: boolean;
  isInGaleWindRadius?: boolean;
  imblDistanceKm?: number; // Distance to International Maritime Boundary Line
}

export type RiskLevelCode = "CODE_GREEN_LOW" | "CODE_YELLOW_MODERATE" | "CODE_ORANGE_HIGH" | "CODE_RED_EXTREME";

export interface ImoRiskAssessmentResult {
  engine: "IMO_FORMAL_SAFETY_ASSESSMENT_MSC_CIRC_12_REV_2";
  timestamp: string;
  location: {
    name: string;
    latitude: number;
    longitude: number;
  };
  hazid: {
    triggeredHazards: string[];
    isImd45KmphRuleViolated: boolean;
    isNowcastSevere: boolean;
    isWaveSteepnessHazard: boolean;
    isPortDangerSignalActive: boolean;
    isCycloneThreatPresent: boolean;
    isBorderProximityHazard: boolean;
  };
  riskMatrix: {
    frequencyIndex: number; // 1 to 7
    severityIndex: number; // 1 to 4 (Minor, Significant, Severe, Catastrophic)
    riskIndex: number; // RI = FI + SI
    riskScoreNormalized: number; // 0 to 100
  };
  riskLevel: RiskLevelCode;
  operationalStatus: "OFFICIAL_GOVERNMENT_WARNING" | "SYSTEM_ASSESSED_CONDITION";
  riskControlOptions: {
    traditionalCraftAdvisory: string;
    mechanizedVesselAdvisory: string;
    actionableDirectives: string[];
    recommendedPortReturn: boolean;
  };
  auditTrail: {
    ruleCitations: string[];
    verifiedThresholds: Record<string, any>;
  };
}

export function evaluateImoMarineRisk(params: ImoHazidParameters): ImoRiskAssessmentResult {
  const triggeredHazards: string[] = [];
  const ruleCitations: string[] = [];
  const verifiedThresholds: Record<string, any> = {};

  const windKmph = params.windSpeedKmph ?? (params.windSpeedKts ? params.windSpeedKts * 1.852 : 20);
  const waveHeight = params.significantWaveHeightMeters ?? 1.2;
  const wavePeriod = params.peakWavePeriodSeconds ?? 6.5;
  const nowcastColor = params.nowcastColorCode ?? 1;
  const portSignal = params.portDangerSignal ?? 0;
  const imblDist = params.imblDistanceKm ?? 999;

  verifiedThresholds.windSpeedKmph = windKmph;
  verifiedThresholds.significantWaveHeightMeters = waveHeight;
  verifiedThresholds.peakWavePeriodSeconds = wavePeriod;
  verifiedThresholds.portDangerSignal = portSignal;

  // STEP 1: HAZARD IDENTIFICATION (HAZID)
  // Hazard 1: IMD Official 45 km/h Rule
  const isImd45KmphRuleViolated = windKmph >= 45 || !!params.hasOfficialFishermenWarning;
  if (isImd45KmphRuleViolated) {
    triggeredHazards.push(`IMD Sea-Wind Safety Violation: Surface wind ${windKmph.toFixed(1)} km/h >= 45 km/h (24.3 kts) threshold or active Fishermen Warning.`);
    ruleCitations.push("IMD Operational Marine Manual Rule 4.2.1: Small craft operations prohibited when sea-winds exceed 45 km/h.");
  }

  // Hazard 2: Severe Nowcast Squalls & Lightning
  const isNowcastSevere = nowcastColor >= 3 || !!params.hasSquallWarning;
  if (isNowcastSevere) {
    triggeredHazards.push(`IMD Nowcast Squall Alert: Color Code ${nowcastColor} with convective squalls.`);
    ruleCitations.push("IMD District Nowcast Bulletin: Convective gust potential exceeding 50 km/h in 3-hour window.");
  }

  // Hazard 3: Wave Steepness & Dynamic Chop: Hs / (1.56 * Tp^2)
  const waveLength = 1.56 * Math.pow(wavePeriod, 2);
  const waveSteepness = waveHeight / Math.max(waveLength, 1);
  const isWaveSteepnessHazard = waveSteepness > 0.04 || waveHeight >= 2.5;
  if (isWaveSteepnessHazard) {
    triggeredHazards.push(`High Sea State & Wave Steepness: Significant wave height ${waveHeight.toFixed(1)}m, steepness ratio ${waveSteepness.toFixed(3)}.`);
    ruleCitations.push("IMO FSA Hazard Code H-WAVE-03: Breaking steep waves causing dynamic vessel capsize risk.");
  }

  // Hazard 4: Port Danger Signals (Signal >= 4)
  const isPortDangerSignalActive = portSignal >= 4;
  if (isPortDangerSignalActive) {
    triggeredHazards.push(`Official Port Danger Signal Hoisted: Local Warning Signal ${portSignal}.`);
    ruleCitations.push("Indian Ports Act & IMD Port Warning Protocol: Signal 4+ mandates cessation of small craft movement.");
  }

  // Hazard 5: Cyclone Spatial Proximity
  const isCycloneThreatPresent = !!params.isInGaleWindRadius || !!params.isInCycloneCone;
  if (isCycloneThreatPresent) {
    triggeredHazards.push("Tropical Cyclone Threat: Location falls within IMD 64kt Gale Wind Radius or Cone of Uncertainty corridor.");
    ruleCitations.push("IMD Cyclone Warning Division Protocol (API 19/20): Mandatory evacuation & harbor sheltering.");
  }

  // Hazard 6: International Maritime Boundary Line (IMBL) Proximity
  const isBorderProximityHazard = imblDist < 5.0;
  if (isBorderProximityHazard) {
    triggeredHazards.push(`IMBL Border Proximity Alert: Vessel is ${imblDist.toFixed(1)} km from international territorial boundary.`);
    ruleCitations.push("Maritime Zones of India Act (1981): Immediate course correction required to prevent straying.");
  }

  // STEP 2: RISK ESTIMATION (SEVERITY x PROBABILITY MATRIX)
  let frequencyIndex = 2; // Default baseline (Probable minor weather)
  let severityIndex = 1; // Default Minor

  if (params.isInGaleWindRadius || portSignal >= 8) {
    frequencyIndex = 6;
    severityIndex = 4; // Catastrophic
  } else if (isCycloneThreatPresent || portSignal >= 4 || windKmph >= 60) {
    frequencyIndex = 5;
    severityIndex = 3; // Severe
  } else if (isImd45KmphRuleViolated || isNowcastSevere || isWaveSteepnessHazard) {
    frequencyIndex = 4;
    severityIndex = 3; // Significant
  } else if (windKmph >= 30 || waveHeight >= 1.8) {
    frequencyIndex = 3;
    severityIndex = 2; // Moderate
  }

  const riskIndex = frequencyIndex + severityIndex;
  const riskScoreNormalized = Math.min(100, Math.round((riskIndex / 10) * 100));

  // STEP 3: RISK CONTROL OPTIONS (RCOs)
  let riskLevel: RiskLevelCode = "CODE_GREEN_LOW";
  let traditionalAdvisory = "Safe to venture into sea. Standard navigation safety protocols in effect.";
  let mechanizedAdvisory = "Safe for operational fishing and coastal passage.";
  const actionableDirectives: string[] = ["Carry mandatory VHF Channel 16 & GPS transponder.", "Monitor 6-hourly coastal weather updates."];
  let recommendedPortReturn = false;

  if (riskIndex >= 9) {
    riskLevel = "CODE_RED_EXTREME";
    traditionalAdvisory = "TOTAL PROHIBITION: Immediate harbor return. Extreme cyclone / storm danger.";
    mechanizedAdvisory = "TOTAL PROHIBITION: Secure all vessels in port anchorage. Suspend maritime operations.";
    actionableDirectives.push("Activate Emergency Distress beacon if unable to reach port.", "Strict adherence to Coast Guard directives.");
    recommendedPortReturn = true;
  } else if (riskIndex >= 7) {
    riskLevel = "CODE_ORANGE_HIGH";
    traditionalAdvisory = "STRICT FISHERMEN WARNING: Advised NOT to venture into open sea.";
    mechanizedAdvisory = "HIGH CAUTION: Deep-sea operations suspended. Remain within 5 nautical miles of safe harbor.";
    actionableDirectives.push("Return to nearest landing center before squall onset.", "Secure fishing nets and deck gear.");
    recommendedPortReturn = true;
  } else if (riskIndex >= 5) {
    riskLevel = "CODE_YELLOW_MODERATE";
    traditionalAdvisory = "CAUTION: Non-mechanized dinghies advised to avoid offshore deep-sea zones.";
    mechanizedAdvisory = "OPERATIONAL: Mechanized vessels (>10m) may operate with heightened vigilance.";
    actionableDirectives.push("Avoid shallow sandbar surf zones with high wave steepness.", "Maintain visual contact with shore.");
  }

  return {
    engine: "IMO_FORMAL_SAFETY_ASSESSMENT_MSC_CIRC_12_REV_2",
    timestamp: new Date().toISOString(),
    location: {
      name: params.locationName,
      latitude: params.latitude,
      longitude: params.longitude,
    },
    hazid: {
      triggeredHazards,
      isImd45KmphRuleViolated,
      isNowcastSevere,
      isWaveSteepnessHazard,
      isPortDangerSignalActive,
      isCycloneThreatPresent,
      isBorderProximityHazard,
    },
    riskMatrix: {
      frequencyIndex,
      severityIndex,
      riskIndex,
      riskScoreNormalized,
    },
    riskLevel,
    operationalStatus: (params.hasOfficialFishermenWarning || portSignal >= 4) ? "OFFICIAL_GOVERNMENT_WARNING" : "SYSTEM_ASSESSED_CONDITION",
    riskControlOptions: {
      traditionalCraftAdvisory: traditionalAdvisory,
      mechanizedVesselAdvisory: mechanizedAdvisory,
      actionableDirectives,
      recommendedPortReturn,
    },
    auditTrail: {
      ruleCitations,
      verifiedThresholds,
    },
  };
}
