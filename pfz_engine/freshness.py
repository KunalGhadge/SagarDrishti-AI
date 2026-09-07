"""
Data Freshness and Evidence Evaluation Module for the Scientific PFZ Engine.

SCIENTIFIC & POLICY PRINCIPLES:
- Freshness describes the physical age of the underlying satellite/model observation.
- Boundaries:
  * < 24 hours: FRESH
  * 24 to 72 hours: PERSISTED — 24–72h
  * > 72 hours: INSUFFICIENT EVIDENCE
- If satellite data is cloud-affected or masked:
  * Status set to INSUFFICIENT EVIDENCE or degraded, never falsely claimed as fresh.
- Explicitly documented as SagarDrishti Engineering Operational Policy.
"""

from typing import Tuple, Optional
from datetime import datetime, timezone
from .config import FRESHNESS_FRESH_MAX_HOURS, FRESHNESS_PERSISTED_MAX_HOURS
from .models import FreshnessMetadata


def calculate_data_age_hours(observation_timestamp_iso: Optional[str]) -> float:
    """
    Computes data age in hours from an ISO 8601 timestamp string relative to current time.
    """
    if not observation_timestamp_iso:
        return 999.0

    try:
        clean_ts = observation_timestamp_iso.replace("Z", "").split(".")[0]
        dt = datetime.fromisoformat(clean_ts).replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        diff = (now - dt).total_seconds() / 3600.0
        return max(0.0, diff)
    except Exception:
        return 999.0


def evaluate_freshness(
    age_hours: float,
    cloud_affected: bool = False
) -> FreshnessMetadata:
    """
    Categorizes data freshness into standard explainable buckets.

    Parameters:
    - age_hours: Elapsed hours since satellite acquisition
    - cloud_affected: Whether optical sensor view was degraded by cloud mask

    Returns:
    - FreshnessMetadata Pydantic object
    """
    if cloud_affected or age_hours > FRESHNESS_PERSISTED_MAX_HOURS:
        status = "INSUFFICIENT EVIDENCE"
    elif age_hours <= FRESHNESS_FRESH_MAX_HOURS:
        status = "FRESH"
    else:
        status = "PERSISTED — 24–72h"

    return FreshnessMetadata(
        age_hours=round(float(age_hours), 1),
        status=status,
        policy_citation="SagarDrishti Engineering Policy: <24h Fresh, 24-72h Persisted, >72h Insufficient Evidence"
    )
