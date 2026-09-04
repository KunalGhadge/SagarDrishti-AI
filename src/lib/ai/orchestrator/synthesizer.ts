import { ExecutionPlan, SpecialistTaskResult } from "./types";

export function synthesizeOrchestrationResponse(
  userQuery: string,
  plan: ExecutionPlan,
  results: SpecialistTaskResult[],
  missingInformation: string[]
): string {
  const completedResults = results.filter((r) => r.status === "completed");
  const unavailableResults = results.filter((r) => r.status === "unavailable");

  // Extract EvidencePack if available from any specialist
  let primaryEvidence: any = null;
  for (const r of completedResults) {
    if (r.evidence) {
      primaryEvidence = r.evidence;
      break;
    }
  }

  const sections: string[] = [];

  // 1. Executive Summary & Operational Verdict
  if (primaryEvidence) {
    const verdict = primaryEvidence.geospatialSafety?.imoSafetyBadge?.value || "ASSESSED";
    const riskIndex = primaryEvidence.geospatialSafety?.imoRiskIndex?.value || "N/A";
    const harbor = primaryEvidence.location?.harbor?.value || "Coastal Sector";

    sections.push(`### ⚓ Operational Marine Intelligence Assessment: **${harbor}**`);
    sections.push(`**Verdict:** **${verdict}** (IMO Risk Index = ${riskIndex})`);
    if (primaryEvidence.geospatialSafety?.smallCraftAdvisory?.value) {
      sections.push(`- **Advisory:** ${primaryEvidence.geospatialSafety.smallCraftAdvisory.value}`);
    }
  } else {
    sections.push(`### ⚓ Multi-Agent Marine Intelligence Synthesis`);
  }

  // 2. Multi-Specialist Evidence Breakdown
  sections.push(`\n#### 🔬 Specialist Findings & Evidence Traces:`);
  for (const r of results) {
    const statusIcon = r.status === "completed" ? "✅" : r.status === "unavailable" ? "⚠️" : "❌";
    sections.push(`- ${statusIcon} **${r.agentName}** (${r.role}): ${r.findings}`);
  }

  // 3. Telemetry Parameter Audit
  if (primaryEvidence) {
    sections.push(`\n#### 📊 Telemetry & Ocean State Parameters:`);
    sections.push(`| Parameter | Live Value | Status | Official Source |`);
    sections.push(`| :--- | :--- | :---: | :--- |`);
    sections.push(`| Significant Wave Height | ${primaryEvidence.oceanPhysics?.significantWaveHeightMeters?.value} m | ${primaryEvidence.oceanPhysics?.significantWaveHeightMeters?.status} | Copernicus Marine CMEMS |`);
    sections.push(`| Surface Wind Speed | ${primaryEvidence.weather?.surfaceWindSpeedKmph?.value} km/h | ${primaryEvidence.weather?.surfaceWindSpeedKmph?.status} | ECMWF IFS / IMD |`);
    sections.push(`| Sea Surface Temp (SST) | ${primaryEvidence.oceanPhysics?.seaSurfaceTemperatureCelsius?.value} °C | ${primaryEvidence.oceanPhysics?.seaSurfaceTemperatureCelsius?.status} | Copernicus Marine |`);
    sections.push(`| Chlorophyll Concentration | ${primaryEvidence.bioOptics?.chlorophyllConcentrationMgM3?.value} mg/m³ | ${primaryEvidence.bioOptics?.chlorophyllConcentrationMgM3?.status} | NOAA CoastWatch VIIRS |`);
    sections.push(`| Distance to IMBL Border | ${primaryEvidence.geospatialSafety?.distanceToImblKm?.value} km | ${primaryEvidence.geospatialSafety?.distanceToImblKm?.status} | Official Maritime Boundary Database |`);
  }

  // 4. Regional Fisheries & Species Distribution (Authoritative Research Fallback)
  const fisheriesResult = completedResults.find(
    (r) =>
      r.taskId.includes("species") ||
      r.taskId.includes("fisheries") ||
      (typeof r.findings === "string" && /cmfri|icar|incois|species|pelagic|demersal|trawl|gillnet/i.test(r.findings))
  );

  if (fisheriesResult) {
    sections.push(`\n#### 🐟 Regional Fisheries & Species Distribution (Authoritative Research):`);
    sections.push(`> *"Our available marine datasets do not directly provide species-level catch data for this location, so I researched authoritative fisheries sources to identify species commonly reported in this region."*\n`);
    sections.push(`${fisheriesResult.findings}`);
    if (fisheriesResult.sources && fisheriesResult.sources.length > 0) {
      sections.push(`\n**Sources & Authoritative Citations:** ${fisheriesResult.sources.join(", ")}`);
    }
    sections.push(`\n*Note: Historical regional catch distributions represent ecological likelihoods based on authoritative fisheries records (ICAR-CMFRI). Species presence is not guaranteed at any specific coordinate.*`);
  }

  // 5. Missing Information / Zero-Fabrication Disclaimer
  if (missingInformation.length > 0 || unavailableResults.length > 0) {
    sections.push(`\n> [!NOTE]`);
    sections.push(`> **Telemetry Integrity & Provenance Notes:**`);
    if (unavailableResults.length > 0) {
      for (const un of unavailableResults) {
        sections.push(`> - **${un.agentName}**: ${un.findings}`);
      }
    }
    for (const info of missingInformation) {
      sections.push(`> - ${info}`);
    }
  }

  return sections.join("\n");
}
