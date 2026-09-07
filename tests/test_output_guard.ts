import {
  classifyQueryIntent,
  sanitizeTextContent,
  enforceOutputGuard,
} from "../src/lib/ai/guard/output-guard";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[TEST FAILED] ${message}`);
  }
}

console.log("=== RUNNING OUTPUT GUARD DETERMINISTIC TEST SUITE ===");

// Test 1: Query-focused intent classification
{
  assert(classifyQueryIntent("Is there a PFZ near Mumbai?") === "PFZ_PRESENCE", "Failed Test 1.1: PFZ intent");
  assert(classifyQueryIntent("Is it safe to go fishing tomorrow?") === "VENTURE_SAFETY", "Failed Test 1.2: Safety intent");
  assert(classifyQueryIntent("What is the chlorophyll level?") === "CHLOROPHYLL_LEVEL", "Failed Test 1.3: Chlorophyll intent");
  assert(classifyQueryIntent("Is there an eddy supporting this PFZ?") === "EDDY_UPWELLING", "Failed Test 1.4: Eddy intent");
  assert(classifyQueryIntent("MAYDAY vessel sinking near Mumbai") === "EMERGENCY_SOS", "Failed Test 1.5: SOS intent");
  console.log("✅ Test 1 Passed: Query-focused intent classification");
}

// Test 2: Fish probability percentage claims are blocked
{
  const input = "The analysis shows an 87% chance of fish in this zone.";
  const { sanitized, violations } = sanitizeTextContent(input);
  assert(!sanitized.includes("87% chance of fish"), "Failed Test 2: 87% chance of fish was not stripped");
  assert(violations.some((v) => v.includes("percentage")), "Failed Test 2: Violation not recorded");
  console.log("✅ Test 2 Passed: Fish probability percentage claims are blocked");
}

// Test 3: Fish presence & abundance claims are blocked
{
  const input = "Yes, this is a high-productivity fishing zone and fish are likely to be abundant. You will find fish here.";
  const { sanitized, violations } = sanitizeTextContent(input);
  assert(!sanitized.includes("fish are likely to be abundant"), "Failed Test 3.1: 'fish are abundant' not blocked");
  assert(!sanitized.includes("You will find fish here"), "Failed Test 3.2: 'you will find fish here' not blocked");
  assert(violations.length >= 2, "Failed Test 3.3: Biological violations count");
  console.log("✅ Test 3 Passed: Fish presence & abundance claims blocked");
}

// Test 4: "Safe to proceed" and unconditional safety guarantees are blocked
{
  const input = "Yes, it is safe to conduct a fishing voyage tomorrow. It is guaranteed safe with no danger.";
  const { sanitized, violations } = sanitizeTextContent(input);
  assert(violations.length > 0, "Failed Test 4.0: Violations should be recorded");
  assert(!sanitized.includes("it is safe to conduct a fishing voyage"), "Failed Test 4.1: 'safe to conduct voyage' not blocked");
  assert(!sanitized.includes("guaranteed safe"), "Failed Test 4.2: 'guaranteed safe' not blocked");
  assert(!sanitized.includes("no danger"), "Failed Test 4.3: 'no danger' not blocked");
  assert(sanitized.includes("environmental risk"), "Failed Test 4.4: Risk assessment language missing");
  console.log("✅ Test 4 Passed: 'Safe to proceed' claims blocked and replaced with risk language");
}

// Test 5: UNKNOWN is preserved (Never replaced with ABSENT)
{
  const input = "Altimetry data near coast shows no eddy is present.";
  const { sanitized, violations } = sanitizeTextContent(input);
  assert(violations.length > 0, "Failed Test 5.0: Violations should be recorded");
  assert(!sanitized.includes("no eddy is present"), "Failed Test 5.1: 'no eddy is present' not blocked");
  assert(sanitized.includes("Eddy evidence is unavailable/unknown"), "Failed Test 5.2: UNKNOWN state not preserved");
  console.log("✅ Test 5 Passed: UNKNOWN state preserved (never replaced with 'no eddy present')");
}

// Test 6: UNAVAILABLE states are preserved
{
  const result = enforceOutputGuard("Wind data is unavailable, so Ekman persistence could not be evaluated.", {
    userQuery: "What is the Ekman transport?",
    windStatus: "UNAVAILABLE",
  });
  assert(result.guardedText.includes("Ekman persistence could not be evaluated"), "Failed Test 6: UNAVAILABLE wind not handled");
  console.log("✅ Test 6 Passed: UNAVAILABLE states preserved");
}

// Test 7: Missing data is not invented
{
  const input = "Chlorophyll is not available from the current data.";
  const { sanitized } = sanitizeTextContent(input);
  assert(sanitized.includes("not available from the current data"), "Failed Test 7: Missing data statement distorted");
  console.log("✅ Test 7 Passed: Missing data is not invented");
}

// Test 8: Biological validation disclaimer appears when required
{
  const input = "Detected multi-factor PFZ candidate offshore Mumbai (18.98°N, 72.85°E) with CHL > 0.1 mg/m³.";
  const result = enforceOutputGuard(input, { userQuery: "Is there a PFZ near Mumbai?" });
  assert(result.guardedText.includes("Scientific Disclaimer:"), "Failed Test 8.1: Disclaimer missing");
  assert(result.guardedText.includes("biological validation is not established"), "Failed Test 8.2: Validation text missing");
  console.log("✅ Test 8 Passed: Biological validation disclaimer appended");
}

// Test 9: Environmental suitability wording is allowed and preserved
{
  const input = "The analysis identified an environmentally suitable PFZ candidate based on multi-factor oceanographic indicators.";
  const { sanitized } = sanitizeTextContent(input);
  assert(sanitized.includes("environmentally suitable PFZ candidate"), "Failed Test 9: Valid suitability wording stripped");
  console.log("✅ Test 9 Passed: Environmental suitability wording preserved");
}

// Test 10: Existing valid scientific evidence (SST, wave height, chlorophyll) is preserved
{
  const input = "Measured SST = 28.7°C, Significant Wave Height = 0.42 m, Chlorophyll-a = 3.07 mg/m³.";
  const { sanitized } = sanitizeTextContent(input);
  assert(sanitized.includes("28.7°C") && sanitized.includes("0.42 m") && sanitized.includes("3.07 mg/m³"), "Failed Test 10: Scientific values altered");
  console.log("✅ Test 10 Passed: Measured scientific values preserved unaltered");
}

// Test 11: Navigation safety notice appended on safety queries
{
  const input = "Current environmental risk is evaluated as LOW (IMO Risk Index = 2).";
  const result = enforceOutputGuard(input, { userQuery: "Is it safe to go fishing tomorrow?" });
  assert(result.guardedText.includes("Operational Notice:"), "Failed Test 11.1: Safety notice missing");
  assert(result.guardedText.includes("not statutory navigation clearance"), "Failed Test 11.2: Statutory clearance note missing");
  console.log("✅ Test 11 Passed: Navigation safety notice appended on safety queries");
}

// Test 12: No fake percentage catch likelihoods survive output guard
{
  const input = "We predict an 80% probability of catch in this sector.";
  const result = enforceOutputGuard(input, { userQuery: "Will I catch fish here?" });
  assert(!result.guardedText.includes("80% probability of catch"), "Failed Test 12.1: 80% catch probability not eliminated");
  assert(result.guardedText.includes("biological validation is not established"), "Failed Test 12.2: Disclaimer missing on catch query");
  console.log("✅ Test 12 Passed: No fake percentage catch likelihoods survive output guard");
}

console.log("\n=======================================================");
console.log("🎉 ALL 12 OUTPUT GUARD TESTS PASSED SUCCESSFULLY!");
console.log("=======================================================\n");
