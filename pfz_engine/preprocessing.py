"""
Preprocessing and Regridding Module for the Scientific PFZ Engine.

SCIENTIFIC PRINCIPLES:
- Common 4-km grid resampling using bilinear interpolation where appropriate.
- Missing values (cloud masks, sensor dropouts) MUST remain NaN; never treated as zero.
- Preserves ocean/land masks. Never creates artificial values from land pixels.
- 3-day rolling composite for chlorophyll (Sarangi et al. 2024 / Jishad et al. 2021).
"""

from typing import Tuple, Optional, Dict, Any, List
import numpy as np
from scipy.interpolate import RegularGridInterpolator
from .config import (
    COMMON_GRID_RESOLUTION_KM,
    COMMON_GRID_INTERPOLATION_METHOD,
    CHL_COMPOSITE_WINDOW_DAYS,
    CHL_MIN_VALID_OBSERVATION_RATIO,
)


def create_common_grid(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    resolution_km: float = COMMON_GRID_RESOLUTION_KM
) -> Tuple[np.ndarray, np.ndarray, float, float]:
    """
    Constructs a regular lat/lon meshgrid at approximately 4-km spatial resolution.
    1 degree latitude ≈ 111.13 km.
    1 degree longitude ≈ 111.32 km * cos(mean_latitude).
    """
    mean_lat_rad = np.radians((min_lat + max_lat) / 2.0)
    lat_step = resolution_km / 111.13
    lon_step = resolution_km / (111.32 * np.cos(mean_lat_rad))

    lats = np.arange(min_lat, max_lat + lat_step * 0.5, lat_step)
    lons = np.arange(min_lon, max_lon + lon_step * 0.5, lon_step)

    grid_lons, grid_lats = np.meshgrid(lons, lats)
    return grid_lats, grid_lons, lat_step, lon_step


def resample_to_grid(
    src_lats: np.ndarray,
    src_lons: np.ndarray,
    src_data: np.ndarray,
    target_lats: np.ndarray,
    target_lons: np.ndarray,
    method: str = COMMON_GRID_INTERPOLATION_METHOD,
    fill_value: float = np.nan
) -> np.ndarray:
    """
    Resamples a 2D source scalar field onto the target regular grid.
    Preserves NaNs. Bilinear interpolation will not interpolate across large gaps.
    """
    # Ensure source coordinate arrays are strictly ascending
    lat_indices = np.argsort(src_lats)
    lon_indices = np.argsort(src_lons)

    sorted_lats = src_lats[lat_indices]
    sorted_lons = src_lons[lon_indices]
    sorted_data = src_data[np.ix_(lat_indices, lon_indices)]

    # Use RegularGridInterpolator with bounds_error=False
    interpolator = RegularGridInterpolator(
        (sorted_lats, sorted_lons),
        sorted_data,
        method=method if method in ["linear", "nearest"] else "linear",
        bounds_error=False,
        fill_value=fill_value
    )

    # Flatten target grid coordinates for interpolation query
    target_points = np.stack([target_lats.ravel(), target_lons.ravel()], axis=-1)
    resampled_flat = interpolator(target_points)

    return resampled_flat.reshape(target_lats.shape)


def compute_3day_chlorophyll_composite(
    chl_daily_grids: List[np.ndarray],
    min_ratio: float = CHL_MIN_VALID_OBSERVATION_RATIO
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Computes a 3-day rolling composite of satellite chlorophyll:
    chl_composite = nanmean(chl[t-2], chl[t-1], chl[t])

    CRITICAL SCIENTIFIC INTEGRITY:
    - Never treats missing/cloud observations as zero.
    - Tracks available observations, missing observations, and cloud coverage percentage.
    - If valid observations < min_ratio threshold, marks composite as insufficient evidence.
    """
    if not chl_daily_grids:
        raise ValueError("At least one daily chlorophyll grid must be provided.")

    stack = np.array(chl_daily_grids)  # Shape: (days, ny, nx)
    days_count, ny, nx = stack.shape

    # Calculate valid observation counts per pixel
    valid_mask = ~np.isnan(stack)
    obs_count = np.sum(valid_mask, axis=0)  # Shape: (ny, nx)

    # Compute mean ignoring NaNs
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        composite = np.nanmean(stack, axis=0)

    # Where observation count is 0, composite is strictly NaN
    composite[obs_count == 0] = np.nan

    total_pixels = ny * nx
    total_valid_pixels = int(np.sum(~np.isnan(composite)))
    cloud_masked_pixels = total_pixels - total_valid_pixels
    cloud_fraction = float(cloud_masked_pixels / total_pixels) if total_pixels > 0 else 1.0

    metadata = {
        "composite_window_days": days_count,
        "total_pixels": total_pixels,
        "valid_pixels": total_valid_pixels,
        "cloud_fraction": round(cloud_fraction, 4),
        "cloud_affected": cloud_fraction > 0.50,
        "sufficient_evidence": total_valid_pixels > 0 and (total_valid_pixels / total_pixels) >= min_ratio,
        "mean_observations_per_pixel": float(np.mean(obs_count)),
        "max_observations_per_pixel": int(np.max(obs_count)),
    }

    return composite, metadata
