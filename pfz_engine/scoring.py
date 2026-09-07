"""
Feature Co-occurrence PFZ Classification Engine.

SCIENTIFIC PRINCIPLES:
- Grounded strictly in Sarangi et al. (2024), Environmental Monitoring and Assessment, 196:98.
- Multi-parameter feature co-occurrence:
  C = High chlorophyll (CHL > 0.1 mg/m³)
  F = Front present (SST thermal front OR CHL front)
  E = Favorable mesoscale cyclonic eddy present (from SLA altimetry)

SCIENTIFIC HONESTY & COASTAL RULES:
- Categorical classification ONLY: NO synthetic percentages, NO invented machine learning probabilities.
- When E is UNKNOWN (coarse coastal altimetry limitation):
  * C=1, F=1 -> MEDIUM_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE
  * Never classified as HIGH, and never as plain MEDIUM without explicit evidence notation.
"""

from typing import Tuple, List, Optional
try:
    from .config import CHL_HIGH_THRESHOLD
    from .models import FeatureDetectionResult
except (ImportError, ValueError):
    from config import CHL_HIGH_THRESHOLD
    from models import FeatureDetectionResult



def evaluate_chlorophyll_criterion(chl_mg_m3: Optional[float]) -> bool:
    """
    Evaluates Sarangi et al. (2024) high-productivity biological threshold.
    CRITICAL RULE:
    CHL > 0.1 mg/m³
    0.09 -> False
    0.10 -> False
    0.1001 -> True
    """
    if chl_mg_m3 is None:
        return False
    # Strict inequality as formulated in Sarangi et al. (2024)
    return float(chl_mg_m3) > CHL_HIGH_THRESHOLD


def classify_feature_co_occurrence(
    high_chlorophyll: bool,
    front_present: bool,
    cyclonic_eddy: Optional[bool],
    eddy_evidence_status: str = "available"
) -> Tuple[str, int, List[str]]:
    """
    Computes deterministic categorical PFZ classification and explanation.

    Parameters:
    - high_chlorophyll: C in {True, False}
    - front_present: F in {True, False}
    - cyclonic_eddy: E in {True (cyclonic), False (anti-cyclonic or absent), None (UNKNOWN)}
    - eddy_evidence_status: "available" | "unavailable" | "invalid"

    Returns:
    - classification: Categorical classification string
    - feature_count: Sum of verified positive features
    - explanation: Traceable list of scientific reasons
    """
    c_val = 1 if high_chlorophyll else 0
    f_val = 1 if front_present else 0

    explanation: List[str] = []

    if high_chlorophyll:
        explanation.append(f"High chlorophyll biomass detected (> {CHL_HIGH_THRESHOLD} mg/m³)")
    else:
        explanation.append(f"Chlorophyll biomass below productive threshold (≤ {CHL_HIGH_THRESHOLD} mg/m³)")

    if front_present:
        explanation.append("Oceanographic front detected (thermal gradient or chlorophyll boundary)")
    else:
        explanation.append("No coherent thermal or optical front detected")

    # Case A: Eddy evidence is genuinely available
    if cyclonic_eddy is not None and eddy_evidence_status == "available":
        e_val = 1 if cyclonic_eddy else 0
        if cyclonic_eddy:
            explanation.append("Favorable cyclonic mesoscale eddy detected (upwelling depression)")
        else:
            explanation.append("No favorable cyclonic eddy present (anti-cyclonic downwelling or neutral SLA)")

        feature_count = c_val + f_val + e_val

        if feature_count == 3:
            classification = "HIGH_POSSIBILITY"
        elif feature_count == 2:
            classification = "MEDIUM_POSSIBILITY"
        elif feature_count == 1:
            classification = "LOW_POSSIBILITY"
        else:
            classification = "NO_SIGNAL"

        return classification, feature_count, explanation

    # Case B: Eddy evidence is UNKNOWN / UNAVAILABLE (e.g. coastal altimetry gap)
    explanation.append("Mesoscale eddy evidence unavailable (coastal satellite altimetry coverage limitation)")
    feature_count = c_val + f_val

    if c_val == 1 and f_val == 1:
        classification = "MEDIUM_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE"
    elif c_val == 1 or f_val == 1:
        classification = "LOW_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE"
    else:
        classification = "NO_SIGNAL"

    return classification, feature_count, explanation
