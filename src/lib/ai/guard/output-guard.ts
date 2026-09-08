/**
 * Output Guard / Evidence-to-Answer Synthesis Layer for SagarDrishti AI.
 *
 * MANDATE & CONSTRAINTS:
 * - OUTPUT-ONLY hardening layer.
 * - Does NOT calculate new scientific results.
 * - Enforces the 4-Level Evidence Hierarchy:
 *     Level 1: Measured/Returned Data
 *     Level 2: Deterministic Scientific Engine Interpretation (C+F+E, Ekman persistence, quality)
 *     Level 3: Scientific Contextual Interpretation (clearly framed)
 *     Level 4: Biological Claims (PROHIBITED unless ground-truth CPUE validation exists)
 * - Prohibits unsupported fish presence/catch claims and fake percentage probabilities.
 * - Prohibits unconditional navigation/voyage safety guarantees ("safe to proceed").
 * - Preserves UNKNOWN and UNAVAILABLE states (never converts them to ABSENT).
 * - Enforces Query-First, Evidence-Second, Limitations-Third structure.
 */

export type QueryIntent =
  | "PFZ_PRESENCE"
  | "VENTURE_SAFETY"
  | "CHLOROPHYLL_LEVEL"
  | "EDDY_UPWELLING"
  | "SPECIES_RESEARCH"
  | "ROUTE_NAVIGATION"
  | "EMERGENCY_SOS"
  | "COMPREHENSIVE_ANALYSIS";

export interface OutputGuardContext {
  userQuery?: string;
  biologicalValidationStatus?: "BIOLOGICAL_VALIDATION_NOT_ESTABLISHED" | "VALIDATED";
  eddyStatus?: "AVAILABLE" | "COASTAL_GAP" | "UNKNOWN" | "UNAVAILABLE" | "NONE_DETECTED";
  windStatus?: "AVAILABLE" | "UNAVAILABLE" | "MISSING";
  sstStatus?: "AVAILABLE" | "CLOUD_COVERED" | "MISSING";
  operationalRiskLevel?: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
}

export interface OutputGuardResult {
  guardedText: string;
  intent: QueryIntent;
  violationsDetected: string[];
  disclaimersAppended: string[];
}

/**
 * Classifies the primary intent of the user's maritime query.
 */
export function classifyQueryIntent(query: string): QueryIntent {
  const q = (query || "").toLowerCase();

  if (/mayday|distress|sinking|sos|emergency|engine failure|taking on water/i.test(q)) {
    return "EMERGENCY_SOS";
  }
  if (/^what is the chlorophyll|^chlorophyll level|^chlorophyll value|^show chlorophyll/i.test(q)) {
    return "CHLOROPHYLL_LEVEL";
  }
  if (/eddy|upwelling|cyclonic|altimetry|sla/i.test(q) && !/voyage|departing|comprehensive/i.test(q)) {
    return "EDDY_UPWELLING";
  }
  if (/species|what fish|which fish|catch type|gear|how to catch/i.test(q)) {
    return "SPECIES_RESEARCH";
  }
  if (/^is it safe|^can i go fishing|^is it safe to fish|^safety status|^sailing risk|^is it safe tomorrow/i.test(q)) {
    return "VENTURE_SAFETY";
  }
  if (/^is there a pfz|^is there any pfz|^find pfz|^pfz near|^potential fishing zone/i.test(q) && !/weather|wave|safety|route/i.test(q)) {
    return "PFZ_PRESENCE";
  }
  if (/route|waypoint|passage|course|bearing to port/i.test(q)) {
    return "ROUTE_NAVIGATION";
  }
  return "COMPREHENSIVE_ANALYSIS";
}

/**
 * Cleanse forbidden safety and biological phrases while enforcing the evidence hierarchy.
 */
export function sanitizeTextContent(text: string, context?: OutputGuardContext): {
  sanitized: string;
  violations: string[];
} {
  let result = text;
  const violations: string[] = [];

  // =========================================================================
  // 1. HARD SAFETY CLAIM BLOCK
  // Prohibit: "safe to proceed", "it is safe to fish", "guaranteed safe", "no danger", "safe voyage"
  // =========================================================================
  const safetyReplacements: Array<[RegExp, string, string]> = [
    [
      /(?:yes,?\s+)?it is safe to (?:proceed with|conduct) (?:a|your) fishing voyage[^\n.]*/gi,
      "Environmental conditions currently indicate LOW operational risk based on available weather and sea-state telemetry. (This assessment is an environmental risk evaluation, not navigation clearance or a guarantee of voyage safety.)",
      "Hard Safety Claim: 'it is safe to conduct a fishing voyage'",
    ],
    [
      /(?:yes,?\s+)?(?:it is|it's) safe to (?:go )?fish(?:ing)?[^\n.]*/gi,
      "Current environmental risk is evaluated as LOW based on live meteorological and oceanographic data (this is an environmental risk assessment, not navigation clearance).",
      "Hard Safety Claim: 'it is safe to fish'",
    ],
    [
      /\b(?:yes,?\s+)?(?:it is|it's) safe to proceed\b/gi,
      "Environmental risk is currently assessed as LOW based on available sea-state data",
      "Hard Safety Claim: 'safe to proceed'",
    ],
    [
      /\bguaranteed safe\b/gi,
      "evaluated as low operational risk",
      "Hard Safety Claim: 'guaranteed safe'",
    ],
    [
      /\bno danger\b/gi,
      "no severe weather advisories active",
      "Hard Safety Claim: 'no danger'",
    ],
    [
      /\boptimal for fishing\b/gi,
      "oceanographically favorable for environmental feature aggregation",
      "Biological Overclaim: 'optimal for fishing'",
    ],
    [
      /\bviable sector for fishing operations under safe\b/gi,
      "sector exhibiting oceanographic convergence under low environmental risk",
      "Hard Safety Claim: 'viable sector under safe'",
    ],
  ];

  for (const [regex, replacement, violationName] of safetyReplacements) {
    if (regex.test(result)) {
      violations.push(violationName);
      result = result.replace(regex, replacement);
    }
  }

  // =========================================================================
  // 2. HARD BIOLOGICAL CLAIM BLOCK
  // Prohibit asserting fish presence, abundance, catch probabilities, or percentage likelihoods
  // =========================================================================
  const biologicalReplacements: Array<[RegExp, string, string]> = [
    [
      /\b\d{1,3}%\s*(?:chance|probability|likelihood)\s*of\s*(?:fish|catch|finding fish)\b/gi,
      "environmental suitability tier (biological catch probabilities are not calculated)",
      "Prohibited fish probability percentage",
    ],
    [
      /\bhigh[- ]productivity fishing zone suitable for operations\b/gi,
      "environmentally suitable PFZ indicator based on multi-factor oceanographic evidence",
      "Biological Overclaim: 'high-productivity fishing zone suitable for operations'",
    ],
    [
      /\bhigh probability of fish (?:presence|aggregation)\b/gi,
      "strong multi-factor oceanographic PFZ indicator",
      "Biological Overclaim: 'high probability of fish'",
    ],
    [
      /\bconfirmed (?:potential )?fishing zone\b/gi,
      "identified oceanographic PFZ candidate",
      "Biological Overclaim: 'confirmed fishing zone'",
    ],
    [
      /\bfish are (?:likely to be )?abundant\b/gi,
      "oceanographic conditions are favorable for biological primary productivity",
      "Biological Overclaim: 'fish are abundant'",
    ],
    [
      /\byou will (?:find|catch) fish here\b/gi,
      "this sector exhibits multi-parameter environmental co-occurrence",
      "Biological Overclaim: 'you will catch fish here'",
    ],
  ];

  for (const [regex, replacement, violationName] of biologicalReplacements) {
    if (regex.test(result)) {
      violations.push(violationName);
      result = result.replace(regex, replacement);
    }
  }

  // =========================================================================
  // 3. PRESERVE UNKNOWN & UNAVAILABLE (Never replace with ABSENT)
  // =========================================================================
  const stateReplacements: Array<[RegExp, string, string]> = [
    [
      /\b(?:no eddy exists|no eddy is present)\b/gi,
      "Eddy evidence is unavailable/unknown in this area due to coastal satellite gap",
      "State Distortion: Replaced UNKNOWN eddy with 'no eddy present'",
    ],
  ];

  for (const [regex, replacement, violationName] of stateReplacements) {
    if (regex.test(result)) {
      violations.push(violationName);
      result = result.replace(regex, replacement);
    }
  }

  // =========================================================================
  // 4. STRIP REDUNDANT MAP VIEW PLACEHOLDER TEXT
  // Remove dangling "### 🗺️ Map View\n(Interactive map provided...)" artifacts
  // =========================================================================
  result = result
    .replace(/(?:###\s*)?🗺️\s*(?:\*\*)?Map View(?:\*\*)?:?\s*\n*\s*(?:\([^\)]*interactive map[^\)]*\)|\*[^\*]*interactive map[^\*]*\*)/gi, "")
    .replace(/(?:###\s*)?🗺️\s*(?:\*\*)?Map View(?:\*\*)?:?\s*\(Interactive map provided in the adjacent card\)/gi, "")
    .replace(/\n{3,}/g, "\n\n");

  return { sanitized: result, violations };
}

/**
 * Main Output Guard function executing after all agent tools finish and before returning to user.
 */
export function enforceOutputGuard(
  rawResponseText: string,
  context?: OutputGuardContext
): OutputGuardResult {
  const query = context?.userQuery || "";
  const intent = classifyQueryIntent(query);
  const { sanitized, violations } = sanitizeTextContent(rawResponseText, context);

  let finalOutput = sanitized;
  const disclaimers: string[] = [];

  // 1. Enforce Biological Validation Disclaimer if PFZ is evaluated
  const discussesPfz =
    intent === "PFZ_PRESENCE" ||
    intent === "COMPREHENSIVE_ANALYSIS" ||
    /pfz|potential fishing zone|chlorophyll|thermal front|sarangi/i.test(finalOutput);

  if (discussesPfz && !/biological validation/i.test(finalOutput)) {
    const disclaimer =
      "\n\n> ⚠️ **Scientific Disclaimer:** This advisory identifies environmental suitability indicators (ocean feature co-occurrence). It does not confirm fish presence or catch probability because biological validation is not established.";
    finalOutput += disclaimer;
    disclaimers.push("Biological Validation Disclaimer appended");
  }

  // 2. Enforce Environmental Risk Disclaimer if Safety / Voyage is evaluated
  const discussesSafety =
    intent === "VENTURE_SAFETY" ||
    intent === "COMPREHENSIVE_ANALYSIS" ||
    /code green|code yellow|code orange|code red|risk index|safe/i.test(finalOutput);

  if (discussesSafety && !/navigation clearance/i.test(finalOutput)) {
    const safetyNote =
      "\n\n> ℹ️ **Operational Notice:** Environmental risk assessments are based on available weather and wave telemetry. This is an advisory assessment, not statutory navigation clearance or a guarantee of voyage safety.";
    finalOutput += safetyNote;
    disclaimers.push("Navigation Safety Disclaimer appended");
  }

  return {
    guardedText: finalOutput,
    intent,
    violationsDetected: violations,
    disclaimersAppended: disclaimers,
  };
}
