"""
Biological Validation Protocol and Interface for SagarDrishti AI PFZ Engine.

SCIENTIFIC HONESTY & HOSTILE RED-TEAM RULE:
- Biological validation is NOT established in the current release because independent,
  georeferenced commercial vessel catch logs (CPUE) are not open-access across the Indian EEZ.
- The system MUST explicitly declare:
    status: "BIOLOGICAL_VALIDATION_NOT_ESTABLISHED"
- This module provides the formal validation data contract and matching protocol
  ready to ingest georeferenced catch logs (e.g. from CMFRI, State Fisheries, or
  vessel digital logbooks) without modifying the deterministic oceanographic engine.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import math
from datetime import datetime, timezone
try:
    from .spatial import haversine_distance_km
except (ImportError, ValueError):
    from spatial import haversine_distance_km



class FishingObservation(BaseModel):
    """
    Empirical ground-truth fishing observation record.
    Collected via onboard digital logbook or landing survey.
    """
    vessel_id: str
    latitude: float
    longitude: float
    timestamp_iso: str
    gear_type: str = "Trawl / Gillnet / Purse Seine"
    target_species: Optional[str] = None
    total_catch_kg: Optional[float] = None
    effort_hours: Optional[float] = None
    cpue_kg_per_hour: Optional[float] = None
    data_provider: str = "Unspecified / Vessel Logbook"


class PfzForecastRecord(BaseModel):
    """
    Historical PFZ engine candidate prediction record for validation comparison.
    """
    candidate_id: str
    latitude: float
    longitude: float
    forecast_timestamp_iso: str
    classification_tier: str
    feature_strength: str
    chlorophyll_mg_m3: Optional[float] = None
    sst_celsius: Optional[float] = None


class ValidationMatchPair(BaseModel):
    """
    Spatial and temporal co-location match between a PFZ candidate and a fishing haul.
    """
    forecast: PfzForecastRecord
    observation: FishingObservation
    spatial_distance_km: float
    temporal_delta_hours: float
    is_spatial_match: bool
    is_temporal_match: bool
    is_valid_pair: bool


class ValidationProtocolSummary(BaseModel):
    """
    Result of a biological validation experiment.
    """
    status: str = "BIOLOGICAL_VALIDATION_NOT_ESTABLISHED"
    sample_count: int = 0
    matched_hauls_count: int = 0
    spatial_tolerance_km: float = 15.0
    temporal_tolerance_hours: float = 24.0
    mean_cpue_in_pfz: Optional[float] = None
    mean_cpue_outside_pfz: Optional[float] = None
    cpue_ratio: Optional[float] = None
    hit_rate: Optional[float] = None
    false_alarm_rate: Optional[float] = None
    f1_score: Optional[float] = None
    disclaimer: str = (
        "Production biological validation requires independent georeferenced fisheries observations "
        "such as catch/CPUE or vessel observations. The current system does not possess sufficient "
        "ground-truth data to claim biological predictive accuracy."
    )


def match_forecast_with_observations(
    forecasts: List[PfzForecastRecord],
    observations: List[FishingObservation],
    spatial_tolerance_km: float = 15.0,
    temporal_tolerance_hours: float = 24.0
) -> ValidationProtocolSummary:
    """
    Executes spatio-temporal co-location matching between PFZ predictions
    and empirical vessel catch observations.
    """
    if not observations:
        return ValidationProtocolSummary(
            status="BIOLOGICAL_VALIDATION_NOT_ESTABLISHED",
            sample_count=0,
            matched_hauls_count=0,
            spatial_tolerance_km=spatial_tolerance_km,
            temporal_tolerance_hours=temporal_tolerance_hours
        )

    matched_pairs: List[ValidationMatchPair] = []

    for obs in observations:
        obs_dt = datetime.fromisoformat(obs.timestamp_iso.replace("Z", "")).replace(tzinfo=timezone.utc)
        best_dist = float("inf")
        best_pair = None

        for fc in forecasts:
            fc_dt = datetime.fromisoformat(fc.forecast_timestamp_iso.replace("Z", "")).replace(tzinfo=timezone.utc)
            delta_hours = abs((obs_dt - fc_dt).total_seconds()) / 3600.0
            dist_km = haversine_distance_km(fc.latitude, fc.longitude, obs.latitude, obs.longitude)

            is_spatial = dist_km <= spatial_tolerance_km
            is_temporal = delta_hours <= temporal_tolerance_hours

            if is_spatial and is_temporal and dist_km < best_dist:
                best_dist = dist_km
                best_pair = ValidationMatchPair(
                    forecast=fc,
                    observation=obs,
                    spatial_distance_km=round(dist_km, 2),
                    temporal_delta_hours=round(delta_hours, 1),
                    is_spatial_match=is_spatial,
                    is_temporal_match=is_temporal,
                    is_valid_pair=True
                )

        if best_pair is not None:
            matched_pairs.append(best_pair)

    if not matched_pairs:
        return ValidationProtocolSummary(
            status="BIOLOGICAL_VALIDATION_NOT_ESTABLISHED",
            sample_count=len(observations),
            matched_hauls_count=0,
            spatial_tolerance_km=spatial_tolerance_km,
            temporal_tolerance_hours=temporal_tolerance_hours
        )

    # Compute matched statistics if CPUE is recorded
    pfz_cpues = [
        p.observation.cpue_kg_per_hour
        for p in matched_pairs
        if p.observation.cpue_kg_per_hour is not None
    ]

    mean_cpue = float(sum(pfz_cpues) / len(pfz_cpues)) if pfz_cpues else None

    return ValidationProtocolSummary(
        status="VALIDATED" if len(matched_pairs) >= 30 else "BIOLOGICAL_VALIDATION_NOT_ESTABLISHED",
        sample_count=len(observations),
        matched_hauls_count=len(matched_pairs),
        spatial_tolerance_km=spatial_tolerance_km,
        temporal_tolerance_hours=temporal_tolerance_hours,
        mean_cpue_in_pfz=round(mean_cpue, 2) if mean_cpue is not None else None,
        disclaimer=(
            "Validation results reflect matched historical trials under specified tolerances. "
            "Ongoing validation across diverse seasons and fishing gears is required."
        ) if len(matched_pairs) >= 30 else (
            "Sample size insufficient (< 30 verified hauls). Production biological validation "
            "remains not established."
        )
    )
