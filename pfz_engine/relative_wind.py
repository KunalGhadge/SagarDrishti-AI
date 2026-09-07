"""
Relative Wind Computation Module for the Scientific PFZ Engine.

SCIENTIFIC PRINCIPLES:
- Grounded in Jishad et al. (2019/2021) and Sarangi et al. (2024).
- Surface wind over moving ocean water produces shear governed by RELATIVE wind:
  W_rel = W_wind - V_current
  u_rel = u_wind - u_current
  v_rel = v_wind - v_current
- Units must be strictly verified: both components in meters per second (m/s).
- Never use wind alone and label it relative wind.
"""

from typing import Tuple, Optional
import numpy as np


def compute_relative_wind(
    u_wind_ms: Optional[np.ndarray],
    v_wind_ms: Optional[np.ndarray],
    u_current_ms: Optional[np.ndarray],
    v_current_ms: Optional[np.ndarray]
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Computes relative wind vector components, magnitude, and meteorological direction.

    Returns:
    - u_rel (m/s): Eastward relative wind component
    - v_rel (m/s): Northward relative wind component
    - speed_rel (m/s): Magnitude of relative wind
    - direction_rel_deg: Meteorological direction (0° to 360°, direction from which wind blows)
    """
    if (
        u_wind_ms is None
        or v_wind_ms is None
        or u_current_ms is None
        or v_current_ms is None
    ):
        shape = (1, 1)
        for arr in [u_wind_ms, v_wind_ms, u_current_ms, v_current_ms]:
            if arr is not None:
                shape = arr.shape
                break
        return (
            np.full(shape, np.nan, dtype=float),
            np.full(shape, np.nan, dtype=float),
            np.full(shape, np.nan, dtype=float),
            np.full(shape, np.nan, dtype=float),
        )

    # Vector difference
    u_rel = u_wind_ms - u_current_ms
    v_rel = v_wind_ms - v_current_ms

    speed_rel = np.sqrt(u_rel**2 + v_rel**2)

    # Meteorological direction (direction from which the wind blows)
    # Math: atan2(-u, -v) converted to [0, 360)
    with np.errstate(invalid="ignore"):
        dir_rad = np.arctan2(-u_rel, -v_rel)
        direction_rel_deg = (np.degrees(dir_rad) + 360.0) % 360.0

    return u_rel, v_rel, speed_rel, direction_rel_deg
