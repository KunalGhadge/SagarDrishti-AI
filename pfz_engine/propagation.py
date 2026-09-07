"""
Feature Advection and Propagation Module for the Scientific PFZ Engine.

IMPORTANT SCIENTIFIC HONESTY DISCLAIMER:
- The exact mathematical propagation equations and drag/advection coefficients
  from Jishad et al. (2019/2021) are paywalled and not fully specified in the
  supplied literature extract.
- THEREFORE, any advective displacement implemented here is an:
  [ENGINEERING ASSUMPTION]
- Never claim this reproduces Jishad et al. verbatim.
- If current vectors or time intervals are unavailable, this module returns UNAVAILABLE.
"""

from typing import Tuple, Optional, Dict, Any
import numpy as np


def propagate_features(
    latitude: float,
    longitude: float,
    u_current_ms: Optional[float],
    v_current_ms: Optional[float],
    dt_hours: float
) -> Dict[str, Any]:
    """
    Computes a simplified Lagrangian advective displacement of a frontal candidate
    along surface ocean current vectors.

    Parameters:
    - latitude, longitude: Initial feature coordinates
    - u_current_ms: Eastward current velocity (m/s)
    - v_current_ms: Northward current velocity (m/s)
    - dt_hours: Forecast lookahead or elapsed time window (hours)

    Returns:
    - Structured dictionary with advection metadata or UNAVAILABLE status.
    """
    if u_current_ms is None or v_current_ms is None or np.isnan(u_current_ms) or np.isnan(v_current_ms):
        return {
            "propagation_status": "UNAVAILABLE",
            "reason": "Ocean surface current velocity vectors unavailable for advection",
            "displaced_latitude": latitude,
            "displaced_longitude": longitude,
            "drift_distance_km": 0.0,
            "lineage": "Engineering Assumption (Jishad mathematical formulation unavailable)"
        }

    dt_seconds = dt_hours * 3600.0

    # Spherical Earth displacement:
    # 1 deg latitude ≈ 110574 m
    # 1 deg longitude ≈ 111320 * cos(lat) m
    dy_meters = v_current_ms * dt_seconds
    dx_meters = u_current_ms * dt_seconds

    lat_rad = np.radians(latitude)
    d_lat = dy_meters / 110574.0
    d_lon = dx_meters / (111320.0 * max(0.01, np.cos(lat_rad)))

    drift_distance_km = np.sqrt(dx_meters**2 + dy_meters**2) / 1000.0

    return {
        "propagation_status": "AVAILABLE",
        "advected": True,
        "displaced_latitude": round(latitude + d_lat, 4),
        "displaced_longitude": round(longitude + d_lon, 4),
        "drift_distance_km": round(drift_distance_km, 2),
        "lookahead_hours": dt_hours,
        "lineage": "Engineering Assumption (First-order current vector advection; Jishad exact equation unavailable)"
    }
