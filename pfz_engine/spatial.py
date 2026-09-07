"""
Spatial Utilities and Geographic Candidate Ranking Module for the Scientific PFZ Engine.

SCIENTIFIC PRINCIPLES:
- Evaluates real grid points across user-requested maritime radius.
- Replaces legacy static port offset math (+/- 0.12°, 0.28°) with genuine scientific grid cells.
- Ranks candidates by:
  1. Categorical PFZ classification tier
  2. Proximity to user (Haversine distance in Nautical Miles)
  3. Evidence completeness / data freshness
"""

from typing import Tuple, List, Dict, Any, Optional
import math
import numpy as np


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates in kilometers."""
    r = 6371.0  # Earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def haversine_distance_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance in Nautical Miles (1 NM = 1.852 km)."""
    return haversine_distance_km(lat1, lon1, lat2, lon2) / 1.852


def calculate_compass_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    """
    Computes initial compass bearing from (lat1, lon1) to (lat2, lon2).
    Returns formatted string with degrees and 16-point cardinal compass rose.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    bearing_deg = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0

    directions = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
    ]
    idx = int((bearing_deg + 11.25) / 22.5) % 16
    return f"{int(round(bearing_deg)):03d}° ({directions[idx]})"


def get_bounding_box_for_radius(
    center_lat: float,
    center_lon: float,
    radius_km: float
) -> Tuple[float, float, float, float]:
    """
    Computes [min_lat, max_lat, min_lon, max_lon] covering a given radius in km.
    """
    lat_delta = radius_km / 110.574
    # Buffer longitude with margin for safe latitude bounds
    cos_lat = max(0.1, math.cos(math.radians(center_lat)))
    lon_delta = radius_km / (111.320 * cos_lat)

    return (
        round(center_lat - lat_delta, 4),
        round(center_lat + lat_delta, 4),
        round(center_lon - lon_delta, 4),
        round(center_lon + lon_delta, 4)
    )


# Classification ranking hierarchy (strictly categorical)
TIER_PRIORITY: Dict[str, int] = {
    "HIGH_POSSIBILITY": 5,
    "MEDIUM_POSSIBILITY": 4,
    "MEDIUM_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE": 3,
    "LOW_POSSIBILITY": 2,
    "LOW_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE": 1,
    "NO_SIGNAL": 0
}


def rank_pfz_candidates(
    candidates: List[Dict[str, Any]],
    max_return_count: int = 5
) -> List[Dict[str, Any]]:
    """
    Ranks candidate potential fishing zones:
    1. Primary key: Classification tier priority descending
    2. Secondary key: Feature count descending
    3. Tertiary key: Distance ascending (closer to fisherman is better)
    """
    def sort_key(cand: Dict[str, Any]):
        classification = cand.get("classification", "NO_SIGNAL")
        tier_prio = TIER_PRIORITY.get(classification, 0)
        feature_cnt = cand.get("feature_count", 0)
        dist_nm = cand.get("distance_nm", 999.0)
        # Negative for descending sort, positive for ascending sort
        return (-tier_prio, -feature_cnt, dist_nm)

    sorted_candidates = sorted(candidates, key=sort_key)
    return sorted_candidates[:max_return_count]
