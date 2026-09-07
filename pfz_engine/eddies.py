"""
Mesoscale Eddy Detection Module for the Scientific PFZ Engine.

SCIENTIFIC PRINCIPLES & METHODOLOGY:
- Lineage: Chelton et al. (2011) / Mason et al. (2014) SSH/SLA mesoscale eddy tracking.
- Operational Criteria (MOSDAC / INCOIS PFZ Advisory):
  * Minimum amplitude >= 5 cm (0.05 m) SLA difference from background.
  * Maximum eddy radius <= 400 km.
  * Cyclonic (cold-core, negative SLA depression) -> Favorable nutrient upwelling (E = 1).
  * Anti-cyclonic (warm-core, positive SLA elevation) -> Downwelling (E = 0, unfavorable).

SCIENTIFIC TRANSFORMATION (SSH to SLA):
- Copernicus physics model (`cmems_mod_glo_phy_anfc_0.083deg_PT1H-m`) provides `zos`
  (Sea Surface Height above Geoid in meters, absolute SSH).
- To detect mesoscale eddies without a separate multi-year Mean Dynamic Topography (MDT)
  grid in near-real-time subsets, the Sea Level Anomaly (SLA) is derived via spatial
  mean-anomaly subtraction:
      SLA(x, y) = SSH(x, y) - <SSH>_regional
  where <SSH>_regional is the spatial mean over valid marine grid cells.
- This isolates mesoscale depressions (cyclonic) and elevations (anti-cyclonic) relative
  to the ambient sea surface slope.

CRITICAL COASTAL DATA RULE:
- Coarse satellite altimetry and ocean models have degraded accuracy near coastlines (< 25-50 km).
- When SLA/SSH is unavailable, missing, or in the coastal band (< 35 km):
  cyclonic_eddy = None (UNKNOWN)
  eddy_evidence_status = "unavailable"
- NEVER convert missing SLA into E = False or interpret missing observations as no eddy!
"""

from typing import Tuple, Optional, Dict, Any, List
import numpy as np
from scipy.ndimage import minimum_filter, maximum_filter
from .config import EDDY_CONFIG


def derive_sla_from_ssh(
    ssh_grid_meters: Optional[np.ndarray]
) -> Tuple[Optional[np.ndarray], Dict[str, Any]]:
    """
    Derives Sea Level Anomaly (SLA, meters) from absolute Sea Surface Height (SSH / zos, meters).

    Transformation:
        SLA(x, y) = SSH(x, y) - <SSH>_regional
    """
    if ssh_grid_meters is None or np.all(np.isnan(ssh_grid_meters)):
        return None, {"method": "none", "regional_mean_ssh_m": None}

    valid_mask = ~np.isnan(ssh_grid_meters)
    if not np.any(valid_mask):
        return None, {"method": "none", "regional_mean_ssh_m": None}

    regional_mean = float(np.nanmean(ssh_grid_meters))
    sla = np.full_like(ssh_grid_meters, np.nan, dtype=float)
    sla[valid_mask] = ssh_grid_meters[valid_mask] - regional_mean

    metadata = {
        "method": "spatial_mean_anomaly_subtraction",
        "input_variable": "zos (Sea Surface Height above Geoid)",
        "input_units": "meters",
        "regional_mean_ssh_m": round(regional_mean, 4),
        "sla_units": "meters",
    }
    return sla, metadata


def detect_mesoscale_eddies(
    ssh_or_sla_meters: Optional[np.ndarray],
    grid_lats: np.ndarray,
    grid_lons: np.ndarray,
    dx_km: float = 4.0,
    dy_km: float = 4.0,
    config: Dict[str, Any] = EDDY_CONFIG,
    is_absolute_ssh: bool = True
) -> Tuple[np.ndarray, np.ndarray, str]:
    """
    Detects cyclonic and anti-cyclonic mesoscale eddies using local extrema and closed SLA contours.

    If is_absolute_ssh is True, explicitly derives SLA by regional mean anomaly subtraction.

    Returns:
    - cyclonic_mask: 2D array of Optional[bool] represented as float/object:
      * 1.0 = Cyclonic eddy present (favorable)
      * 0.0 = Anti-cyclonic eddy present OR no eddy where data is valid
      * np.nan = UNKNOWN (SLA data unavailable or coastal gap)
    - eddy_types: 2D array of strings ("CYCLONIC", "ANTI_CYCLONIC", "NONE", "UNKNOWN")
    - overall_evidence_status: "available" | "unavailable" | "invalid"
    """
    ny, nx = grid_lats.shape

    if is_absolute_ssh:
        sla_grid_meters, _ = derive_sla_from_ssh(ssh_or_sla_meters)
    else:
        sla_grid_meters = ssh_or_sla_meters

    if sla_grid_meters is None or np.all(np.isnan(sla_grid_meters)):
        # SLA completely unavailable
        cyclonic_mask = np.full((ny, nx), np.nan, dtype=float)
        eddy_types = np.full((ny, nx), "UNKNOWN", dtype=object)
        return cyclonic_mask, eddy_types, "unavailable"

    valid_mask = ~np.isnan(sla_grid_meters)
    valid_fraction = float(np.sum(valid_mask) / (ny * nx))

    if valid_fraction < 0.10:
        # Insufficient spatial coverage (e.g. narrow coastal strip)
        cyclonic_mask = np.full((ny, nx), np.nan, dtype=float)
        eddy_types = np.full((ny, nx), "UNKNOWN", dtype=object)
        return cyclonic_mask, eddy_types, "unavailable"

    cyclonic_mask = np.full((ny, nx), np.nan, dtype=float)
    eddy_types = np.full((ny, nx), "UNKNOWN", dtype=object)

    # Where data is valid, default baseline is 0.0 (no eddy detected yet)
    cyclonic_mask[valid_mask] = 0.0
    eddy_types[valid_mask] = "NONE"

    min_amp_m = config["min_amplitude_cm"] / 100.0  # e.g. 0.05 meters
    max_radius_km = config["max_eddy_radius_km"]     # 400 km
    max_radius_pixels = int(max_radius_km / max(dx_km, 1.0))
    footprint_size = max(5, min(max_radius_pixels // 2, 21))

    # Local extrema filters
    footprint = np.ones((footprint_size, footprint_size), dtype=bool)

    # Infill NaNs for filter execution
    filled_sla = np.where(valid_mask, sla_grid_meters, np.nanmedian(sla_grid_meters))

    local_min = minimum_filter(filled_sla, footprint=footprint)
    local_max = maximum_filter(filled_sla, footprint=footprint)

    # 1. Cyclonic Eddies: Local minima with negative depression >= min_amplitude
    is_minima = (filled_sla == local_min) & valid_mask
    depression = local_max - filled_sla

    cyclonic_centers = is_minima & (depression >= min_amp_m) & (filled_sla < np.nanmean(sla_grid_meters))

    # 2. Anti-cyclonic Eddies: Local maxima with positive elevation >= min_amplitude
    is_maxima = (filled_sla == local_max) & valid_mask
    elevation = filled_sla - local_min

    anticyclonic_centers = is_maxima & (elevation >= min_amp_m) & (filled_sla > np.nanmean(sla_grid_meters))

    # Dilate eddy centers to their approximate mesoscale core radius (~25 km radius ≈ 6 pixels)
    core_radius_pixels = int(25.0 / dx_km)
    y_indices, x_indices = np.indices((ny, nx))

    # Mark cyclonic eddy influence zones
    cyc_r, cyc_c = np.where(cyclonic_centers)
    for r, c in zip(cyc_r, cyc_c):
        dist_sq = ((y_indices - r) * dy_km)**2 + ((x_indices - c) * dx_km)**2
        in_core = (dist_sq <= 35.0**2) & valid_mask
        cyclonic_mask[in_core] = 1.0
        eddy_types[in_core] = "CYCLONIC"

    # Mark anti-cyclonic eddy influence zones
    anti_r, anti_c = np.where(anticyclonic_centers)
    for r, c in zip(anti_r, anti_c):
        dist_sq = ((y_indices - r) * dy_km)**2 + ((x_indices - c) * dx_km)**2
        in_core = (dist_sq <= 35.0**2) & valid_mask
        # Do not overwrite cyclonic if overlapping
        anti_mask = in_core & (cyclonic_mask != 1.0)
        cyclonic_mask[anti_mask] = 0.0
        eddy_types[anti_mask] = "ANTI_CYCLONIC"

    return cyclonic_mask, eddy_types, "available"
