"""
Ekman Transport and Feature Persistence Module for the Scientific PFZ Engine.

SCIENTIFIC PRINCIPLES & METHODOLOGY:
- Grounded in Jishad et al. (2019/2021) and INCOIS/MOSDAC Operational PFZ Advisory:
  * Ekman transport direction derived from surface relative wind.
  * In the Northern Hemisphere, net surface Ekman transport is directed 90° to the right of the wind vector.
  * Feature persistence evaluated by comparing Ekman transport direction with frontal orientation.
  * Alignment <= 40°: HIGH persistence.
  * Alignment > 40°: LOW persistence.
  * Missing input data: UNAVAILABLE. Never fabricated.
"""

from typing import Tuple, Optional, Union
import numpy as np
try:
    from .config import EKMAN_PERSISTENCE_ANGLE_MAX_DEG, EKMAN_DEFLECTION_NORTHERN_HEMISPHERE_DEG
except (ImportError, ValueError):
    from config import EKMAN_PERSISTENCE_ANGLE_MAX_DEG, EKMAN_DEFLECTION_NORTHERN_HEMISPHERE_DEG



def compute_circular_angular_difference(angle1_deg: float, angle2_deg: float) -> float:
    """
    Computes the smallest circular angular difference between two compass bearings in degrees.
    Always returns a value between 0.0° and 180.0°.
    Handles 0°/360° wraparound correctly.
    """
    if np.isnan(angle1_deg) or np.isnan(angle2_deg):
        return np.nan

    diff = abs((angle1_deg - angle2_deg) % 360.0)
    return min(diff, 360.0 - diff)


def evaluate_ekman_persistence(
    rel_wind_dir_deg: Optional[float],
    front_orientation_deg: Optional[float],
    max_angle_threshold: float = EKMAN_PERSISTENCE_ANGLE_MAX_DEG
) -> Tuple[str, str, Optional[float], Optional[float]]:
    """
    Evaluates Ekman transport direction and alignment relative to ocean front orientation.

    Parameters:
    - rel_wind_dir_deg: Meteorological wind direction (direction wind is blowing FROM)
    - front_orientation_deg: Frontal boundary orientation (0° to 360°)
    - max_angle_threshold: Threshold for high persistence (default 40.0° from MOSDAC operational spec)

    Returns:
    - status: "AVAILABLE" | "UNAVAILABLE"
    - classification: "HIGH" | "LOW" | "UNAVAILABLE"
    - angle_to_front_deg: Angular difference (0° to 180°) or None
    - ekman_direction_deg: Resulting Ekman transport direction (0° to 360°) or None
    """
    if rel_wind_dir_deg is None or front_orientation_deg is None:
        return "UNAVAILABLE", "UNAVAILABLE", None, None

    if np.isnan(rel_wind_dir_deg) or np.isnan(front_orientation_deg):
        return "UNAVAILABLE", "UNAVAILABLE", None, None

    # Meteorological direction is FROM which wind blows.
    # Wind vector points TOWARDS: (rel_wind_dir_deg + 180) % 360.
    # In Northern Hemisphere, surface Ekman drift is 90° to the RIGHT of wind vector:
    # ekman_dir = (wind_towards + 90) % 360 = (rel_wind_dir_deg + 270) % 360
    ekman_direction_deg = (rel_wind_dir_deg + 270.0) % 360.0

    # Front is bidirectional (an axis). Calculate smallest angle to front line
    # Front line has orientations theta and (theta + 180) % 360
    diff1 = compute_circular_angular_difference(ekman_direction_deg, front_orientation_deg)
    diff2 = compute_circular_angular_difference(ekman_direction_deg, (front_orientation_deg + 180.0) % 360.0)
    angle_to_front_deg = min(diff1, diff2)

    if angle_to_front_deg <= max_angle_threshold:
        classification = "HIGH"
    else:
        classification = "LOW"

    return "AVAILABLE", classification, round(float(angle_to_front_deg), 1), round(float(ekman_direction_deg), 1)
