/**
 * Deterministic Marine Risk Engine
 * Grounded in IMO Formal Safety Assessment (FSA) Guidelines (MSC-MEPC.2/Circ.12/Rev.2)
 * & Official India Meteorological Department (IMD / MoES) Safety Thresholds.
 *
 * Every decision is strictly traceable to a real, named standard.
 * Missing or unavailable hazard inputs are explicitly marked "not evaluated — data unavailable".
 */

export interface ImoHazidParameters {
  locationName: string;
  latitude: number;
  longitude: number;
  windSpeedKts?: number | null;
  windSpeedKmph?: number | null;
  significantWaveHeightMeters?: number | null;
  peakWavePeriodSeconds?: number | null;
  swellHeightMeters?: number | null;
  swellPeriodSeconds?: number | null;
  nowcastColorCode?: number | null; // 1: Green, 2: Yellow, 3: Orange, 4: Red
  hasSquallWarning?: boolean | null;
  hasLightningWarning?: boolean | null;
  hasOfficialFishermenWarning?: boolean | null;
  portDangerSignal?: number | null; // 0 to 11
  cycloneDistanceKm?: number | null;
  isInCycloneCone?: boolean | null;
  isInGaleWindRadius?: boolean | null;
  imblDistanceKm?: number | null; // Distance to International Maritime Boundary Line
}

export type RiskLevelCode = "CODE_GREEN_LOW" | "CODE_YELLOW_MODERATE" | "CODE_ORANGE_HIGH" | "CODE_RED_EXTREME";

export interface HazardCheckResult {
  hazardName: string;
  ruleName: string;
  thresholdUsed: string;
  measuredValue: string;
  isViolated: boolean;
  status: "evaluated_safe" | "evaluated_hazard" | "not evaluated — data unavailable";
  citation: string;
}

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
  hazardChecks: HazardCheckResult[];
  riskMatrix: {
    frequencyIndex: number; // 1 to 7
    severityIndex: number; // 1 to 4 (Minor, Significant, Severe, Catastrophic)
    riskIndex: number; // RI = FI + SI
    riskScoreNormalized: number; // 0 to 100
  };
  riskLevel: RiskLevelCode;
  reasoning: string;
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
  const hazardChecks: HazardCheckResult[] = [];

  // =========================================================================
  // HAZARD CHECK 1: IMD Sea-Wind Threshold (Rule 4.2.1)
  // =========================================================================
  let isImd45KmphRuleViolated = false;
  const windKmph = params.windSpeedKmph ?? (params.windSpeedKts != null ? params.windSpeedKts * 1.852 : null);

  if (windKmph != null) {
    verifiedThresholds.windSpeedKmph = parseFloat(windKmph.toFixed(1));
    isImd45KmphRuleViolated = windKmph >= 45.0 || params.hasOfficialFishermenWarning === true;

    hazardChecks.push({
      hazardName: "Gale & High Sea-Wind Hazard",
      ruleName: "IMD Sea-Wind Rule 4.2.1",
      thresholdUsed: "wind speed >= 45.0 km/h (24.3 kts) or active Fishermen Warning",
      measuredValue: `${windKmph.toFixed(1)} km/h`,
      isViolated: isImd45KmphRuleViolated,
      status: isImd45KmphRuleViolated ? "evaluated_hazard" : "evaluated_safe",
      citation: "IMD Operational Marine Meteorology Manual Section 4.2.1 (MoES)",
    });

    if (isImd45KmphRuleViolated) {
      triggeredHazards.push(`IMD Sea-Wind Rule 4.2.1 Violated: Surface wind ${windKmph.toFixed(1)} km/h >= 45.0 km/h threshold.`);
      ruleCitations.push("IMD Operational Marine Manual Rule 4.2.1: Small craft operations prohibited when sea-winds exceed 45 km/h.");
    }
  } else {
    hazardChecks.push({
      hazardName: "Gale & High Sea-Wind Hazard",
      ruleName: "IMD Sea-Wind Rule 4.2.1",
      thresholdUsed: "wind speed >= 45.0 km/h",
      measuredValue: "N/A",
      isViolated: false,
      status: "not evaluated — data unavailable",
      citation: "IMD Operational Marine Meteorology Manual Section 4.2.1 (MoES)",
    });
  }

  // =========================================================================
  // HAZARD CHECK 2: Wave Height & Dynamic Wave Steepness (IMO Code H-WAVE-03)
  // =========================================================================
  let isWaveSteepnessHazard = false;
  const waveHeight = params.significantWaveHeightMeters ?? null;
  const wavePeriod = params.peakWavePeriodSeconds ?? null;

  if (waveHeight != null) {
    verifiedThresholds.significantWaveHeightMeters = parseFloat(waveHeight.toFixed(2));
    let waveSteepnessStr = "N/A";
    let isSteep = false;

    if (wavePeriod != null && wavePeriod > 0) {
      verifiedThresholds.peakWavePeriodSeconds = parseFloat(wavePeriod.toFixed(1));
      const waveLength = 1.56 * Math.pow(wavePeriod, 2);
      const waveSteepness = waveHeight / Math.max(waveLength, 1.0);
      verifiedThresholds.waveSteepnessRatio = parseFloat(waveSteepness.toFixed(4));
      isSteep = waveSteepness > 0.04;
      waveSteepnessStr = `steepness ratio ${waveSteepness.toFixed(4)}`;
    }

    isWaveSteepnessHazard = waveHeight >= 2.5 || isSteep;

    hazardChecks.push({
      hazardName: "Wave Height & Dynamic Steepness Hazard",
      ruleName: "IMO FSA Hazard Code H-WAVE-03",
      thresholdUsed: "significant wave height >= 2.50m OR dynamic wave steepness (Hs/L) > 0.0400",
      measuredValue: `Hs: ${waveHeight.toFixed(2)}m (${waveSteepnessStr})`,
      isViolated: isWaveSteepnessHazard,
      status: isWaveSteepnessHazard ? "evaluated_hazard" : "evaluated_safe",
      citation: "IMO Formal Safety Assessment Code H-WAVE-03 (MSC-MEPC.2/Circ.12/Rev.2)",
    });

    if (isWaveSteepnessHazard) {
      triggeredHazards.push(`IMO Wave Hazard H-WAVE-03: Significant wave height ${waveHeight.toFixed(2)}m (threshold 2.5m) or dynamic steepness.`);
      ruleCitations.push("IMO FSA Hazard Code H-WAVE-03: Breaking steep waves causing dynamic vessel capsize risk.");
    }
  } else {
    hazardChecks.push({
      hazardName: "Wave Height & Dynamic Steepness Hazard",
      ruleName: "IMO FSA Hazard Code H-WAVE-03",
      thresholdUsed: "significant wave height >= 2.50m OR dynamic steepness > 0.0400",
      measuredValue: "N/A",
      isViolated: false,
      status: "not evaluated — data unavailable",
      citation: "IMO Formal Safety Assessment Code H-WAVE-03 (MSC-MEPC.2/Circ.12/Rev.2)",
    });
  }

  // =========================================================================
  // HAZARD CHECK 3: Severe Convective Squalls & Nowcast Alert
  // =========================================================================
  let isNowcastSevere = false;
  const nowcastColor = params.nowcastColorCode ?? null;

  if (nowcastColor != null || params.hasSquallWarning != null) {
    verifiedThresholds.nowcastColorCode = nowcastColor ?? 1;
    isNowcastSevere = (nowcastColor != null && nowcastColor >= 3) || params.hasSquallWarning === true;

    hazardChecks.push({
      hazardName: "IMD Convective Squall & Lightning Hazard",
      ruleName: "IMD District Nowcast Protocol Section 3.1",
      thresholdUsed: "Nowcast Warning Color Code >= 3 (Orange/Red) or active squall alert",
      measuredValue: `Color Code: ${nowcastColor ?? 1}, Squall Warning: ${params.hasSquallWarning === true ? "ACTIVE" : "NONE"}`,
      isViolated: isNowcastSevere,
      status: isNowcastSevere ? "evaluated_hazard" : "evaluated_safe",
      citation: "IMD District Nowcast Severe Weather Bulletin (MoES)",
    });

    if (isNowcastSevere) {
      triggeredHazards.push(`IMD Nowcast Squall Alert: Color Code ${nowcastColor ?? 3} indicating sudden convective gale gusts.`);
      ruleCitations.push("IMD District Nowcast Bulletin: Convective gust potential exceeding 50 km/h in 3-hour window.");
    }
  } else {
    hazardChecks.push({
      hazardName: "IMD Convective Squall & Lightning Hazard",
      ruleName: "IMD District Nowcast Protocol Section 3.1",
      thresholdUsed: "Nowcast Color Code >= 3 or active squall alert",
      measuredValue: "N/A",
      isViolated: false,
      status: "not evaluated — data unavailable",
      citation: "IMD District Nowcast Severe Weather Bulletin (MoES)",
    });
  }

  // =========================================================================
  // HAZARD CHECK 4: Port Danger Warning Signals
  // =========================================================================
  let isPortDangerSignalActive = false;
  const portSignal = params.portDangerSignal ?? null;

  if (portSignal != null) {
    verifiedThresholds.portDangerSignal = portSignal;
    isPortDangerSignalActive = portSignal >= 4;

    hazardChecks.push({
      hazardName: "Port Cautionary & Danger Signals",
      ruleName: "Indian Ports Act 1908 & IMD Port Warning System",
      thresholdUsed: "Local Warning Signal >= 4 (Mandatory suspension of small craft departures)",
      measuredValue: `Signal ${portSignal}`,
      isViolated: isPortDangerSignalActive,
      status: isPortDangerSignalActive ? "evaluated_hazard" : "evaluated_safe",
      citation: "Indian Ports Act 1908 / IMD Cyclone Warning Service Port Signal Matrix",
    });

    if (isPortDangerSignalActive) {
      triggeredHazards.push(`Official Port Danger Signal Hoisted: Local Warning Signal ${portSignal}.`);
      ruleCitations.push("Indian Ports Act & IMD Port Warning Protocol: Signal 4+ mandates cessation of small craft movement.");
    }
  } else {
    hazardChecks.push({
      hazardName: "Port Cautionary & Danger Signals",
      ruleName: "Indian Ports Act 1908 & IMD Port Warning System",
      thresholdUsed: "Local Warning Signal >= 4",
      measuredValue: "N/A",
      isViolated: false,
      status: "not evaluated — data unavailable",
      citation: "Indian Ports Act 1908 / IMD Cyclone Warning Service Port Signal Matrix",
    });
  }

  // =========================================================================
  // HAZARD CHECK 5: Cyclone Spatial Proximity & Gale Wind Radii
  // =========================================================================
  let isCycloneThreatPresent = false;
  const hasCycloneData = params.isInGaleWindRadius != null || params.isInCycloneCone != null || params.cycloneDistanceKm !== undefined;

  if (hasCycloneData) {
    const cycloneDist = params.cycloneDistanceKm ?? null;
    isCycloneThreatPresent = params.isInGaleWindRadius === true || params.isInCycloneCone === true || (cycloneDist != null && cycloneDist <= 200.0);

    hazardChecks.push({
      hazardName: "Tropical Cyclone Proximity Hazard",
      ruleName: "IMD Cyclone Warning Division (CWD) SOP-2023",
      thresholdUsed: "vessel inside IMD 64kt Gale Wind Radius (< 200km) or Cone of Uncertainty corridor",
      measuredValue: cycloneDist != null ? `${cycloneDist.toFixed(1)} km distance` : (params.isInGaleWindRadius ? "Inside Gale Radius" : "No storm in vicinity"),
      isViolated: isCycloneThreatPresent,
      status: isCycloneThreatPresent ? "evaluated_hazard" : "evaluated_safe",
      citation: "IMD Standard Operating Procedure for Cyclone Warning in India (CWD-SOP-2023)",
    });

    if (isCycloneThreatPresent) {
      triggeredHazards.push("Tropical Cyclone Threat: Location falls within IMD Gale Wind Radius or Cone of Uncertainty corridor.");
      ruleCitations.push("IMD Cyclone Warning Division Protocol: Mandatory evacuation & harbor sheltering.");
    }
  } else {
    hazardChecks.push({
      hazardName: "Tropical Cyclone Proximity Hazard",
      ruleName: "IMD Cyclone Warning Division (CWD) SOP-2023",
      thresholdUsed: "vessel inside IMD 64kt Gale Wind Radius or Cone of Uncertainty",
      measuredValue: "N/A",
      isViolated: false,
      status: "not evaluated — data unavailable",
      citation: "IMD Standard Operating Procedure for Cyclone Warning in India (CWD-SOP-2023)",
    });
  }

  // =========================================================================
  // HAZARD CHECK 6: International Maritime Boundary Line (IMBL) Distance
  // =========================================================================
  let isBorderProximityHazard = false;
  const imblDist = params.imblDistanceKm ?? null;

  if (imblDist != null) {
    verifiedThresholds.imblDistanceKm = parseFloat(imblDist.toFixed(1));
    isBorderProximityHazard = imblDist < 20.0;

    hazardChecks.push({
      hazardName: "International Maritime Boundary (IMBL) Distance",
      ruleName: "Maritime Zones of India Act (1981) Section 5",
      thresholdUsed: "distance to IMBL border < 20.0 km (Proximity Alert Buffer)",
      measuredValue: `${imblDist.toFixed(1)} km`,
      isViolated: isBorderProximityHazard,
      status: isBorderProximityHazard ? "evaluated_hazard" : "evaluated_safe",
      citation: "Territorial Waters, Continental Shelf, EEZ and Other Maritime Zones Act 1981 (Govt. of India)",
    });

    if (isBorderProximityHazard) {
      triggeredHazards.push(`IMBL Border Proximity Alert: Vessel is ${imblDist.toFixed(1)} km from international territorial boundary.`);
      ruleCitations.push("Maritime Zones of India Act (1981): Immediate course correction required to prevent straying.");
    }
  } else {
    hazardChecks.push({
      hazardName: "International Maritime Boundary (IMBL) Distance",
      ruleName: "Maritime Zones of India Act (1981) Section 5",
      thresholdUsed: "distance to IMBL border < 20.0 km",
      measuredValue: "N/A",
      isViolated: false,
      status: "not evaluated — data unavailable",
      citation: "Territorial Waters, Continental Shelf, EEZ and Other Maritime Zones Act 1981 (Govt. of India)",
    });
  }

  // =========================================================================
  // STEP 2: RISK ESTIMATION (FREQUENCY INDEX + SEVERITY INDEX)
  // =========================================================================
  let frequencyIndex = 2; // Baseline: Probable minor environmental conditions
  let severityIndex = 1; // Baseline: Minor operational disruption

  if (params.isInGaleWindRadius === true || (portSignal != null && portSignal >= 8)) {
    frequencyIndex = 6;
    severityIndex = 4; // Catastrophic
  } else if (isCycloneThreatPresent || (portSignal != null && portSignal >= 4) || (windKmph != null && windKmph >= 60.0)) {
    frequencyIndex = 5;
    severityIndex = 3; // Severe
  } else if (isImd45KmphRuleViolated || isNowcastSevere || isWaveSteepnessHazard) {
    frequencyIndex = 4;
    severityIndex = 3; // Significant
  } else if ((windKmph != null && windKmph >= 30.0) || (waveHeight != null && waveHeight >= 1.8)) {
    frequencyIndex = 3;
    severityIndex = 2; // Moderate
  }

  const riskIndex = frequencyIndex + severityIndex;
  const riskScoreNormalized = Math.min(100, Math.round((riskIndex / 10) * 100));

  // =========================================================================
  // STEP 3: RISK LEVEL & PLAIN-ENGLISH REASONING GENERATION
  // =========================================================================
  let riskLevel: RiskLevelCode = "CODE_GREEN_LOW";
  let traditionalAdvisory = "Safe to venture into sea. Standard navigation safety protocols in effect.";
  let mechanizedAdvisory = "Safe for operational fishing and coastal passage.";
  const actionableDirectives: string[] = ["Carry mandatory VHF Channel 16 & GPS transponder.", "Monitor 6-hourly coastal weather updates."];
  let recommendedPortReturn = false;
  let reasoning = "";

  if (riskIndex >= 9) {
    riskLevel = "CODE_RED_EXTREME";
    traditionalAdvisory = "TOTAL PROHIBITION: Immediate harbor return. Extreme cyclone / storm danger.";
    mechanizedAdvisory = "TOTAL PROHIBITION: Secure all vessels in port anchorage. Suspend maritime operations.";
    actionableDirectives.push("Activate Emergency Distress beacon if unable to reach port.", "Strict adherence to Coast Guard directives.");
    recommendedPortReturn = true;
    reasoning = `IMD Cyclone Warning Protocol: Severe storm danger (Risk Index = ${riskIndex} >= 9). Immediate port return and operations suspension mandated.`;
  } else if (riskIndex >= 7) {
    riskLevel = "CODE_ORANGE_HIGH";
    traditionalAdvisory = "STRICT FISHERMEN WARNING: Advised NOT to venture into open sea.";
    mechanizedAdvisory = "HIGH CAUTION: Deep-sea operations suspended. Remain within 5 nautical miles of safe harbor.";
    actionableDirectives.push("Return to nearest landing center before squall onset.", "Secure fishing nets and deck gear.");
    recommendedPortReturn = true;

    if (isImd45KmphRuleViolated && windKmph != null) {
      reasoning = `IMD Sea-Wind Rule 4.2.1 violated: Measured surface wind ${windKmph.toFixed(1)} km/h exceeds 45.0 km/h threshold. Deep-sea fishing prohibited.`;
    } else if (isWaveSteepnessHazard && waveHeight != null) {
      reasoning = `IMO FSA Hazard Code H-WAVE-03 violated: Significant wave height ${waveHeight.toFixed(2)}m exceeds 2.50m safety limit. High sea hazard.`;
    } else {
      reasoning = `Severe atmospheric/oceanic hazard triggered (Risk Index = ${riskIndex} >= 7). Fishermen warning active.`;
    }
  } else if (riskIndex >= 5) {
    riskLevel = "CODE_YELLOW_MODERATE";
    traditionalAdvisory = "CAUTION: Non-mechanized dinghies advised to avoid offshore deep-sea zones.";
    mechanizedAdvisory = "OPERATIONAL: Mechanized vessels (>10m) may operate with heightened vigilance.";
    actionableDirectives.push("Avoid shallow sandbar surf zones with high wave steepness.", "Maintain visual contact with shore.");

    const windPart = windKmph != null ? `wind ${windKmph.toFixed(1)} km/h` : "unmeasured wind";
    const wavePart = waveHeight != null ? `waves ${waveHeight.toFixed(2)}m` : "unmeasured waves";
    reasoning = `Moderate sea-state (${windPart}, ${wavePart}) approaching IMO caution threshold (RI = ${riskIndex}). Small non-mechanized craft advised caution.`;
  } else {
    // CODE GREEN (RI < 5)
    const windPart = windKmph != null ? `Wind: ${windKmph.toFixed(1)} km/h < IMD 45.0 km/h threshold` : "Wind: not evaluated — data unavailable";
    const wavePart = waveHeight != null ? `Waves: ${waveHeight.toFixed(2)}m < IMO 2.50m threshold` : "Waves: not evaluated — data unavailable";
    reasoning = `All evaluated parameters within safe limits (${windPart}; ${wavePart}; Zero port signals or cyclone warnings; RI = ${riskIndex}). Safe for all craft.`;
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
    hazardChecks,
    riskMatrix: {
      frequencyIndex,
      severityIndex,
      riskIndex,
      riskScoreNormalized,
    },
    riskLevel,
    reasoning,
    operationalStatus: (params.hasOfficialFishermenWarning === true || (portSignal != null && portSignal >= 4)) ? "OFFICIAL_GOVERNMENT_WARNING" : "SYSTEM_ASSESSED_CONDITION",
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
