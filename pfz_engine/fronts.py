"""
Ocean Front Detection Module for the Scientific PFZ Engine.

SCIENTIFIC PRINCIPLES:
- SST Thermal Fronts: Cayula & Cornillon (1992) lineage.
  Thermal gradient calculation normalized to °C / 5km.
- Chlorophyll Fronts: Canny edge detector applied to chlorophyll concentration gradient.
- Combined Front: front_present = sst_front OR chl_front.
  Retains underlying individual masks for full auditability.
"""

from typing import Tuple, Dict, Any
import numpy as np
from scipy.ndimage import gaussian_filter, sobel
from .config import CAYULA_CORNILLON_CONFIG, CANNY_CHL_CONFIG


def detect_sst_fronts(
    sst_grid_celsius: np.ndarray,
    dx_km: float = 4.0,
    dy_km: float = 4.0,
    config: Dict[str, Any] = CAYULA_CORNILLON_CONFIG
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Detects thermal fronts in sea surface temperature based on Cayula & Cornillon (1992)
    single-image edge detection principles.

    Outputs:
    - sst_front_mask: boolean 2D array indicating presence of thermal front.
    - sst_gradient_5km: float 2D array of horizontal temperature gradient (°C / 5km).
    - front_orientation_deg: float 2D array of frontal line orientation (0° to 360°).
    """
    ny, nx = sst_grid_celsius.shape
    valid_mask = ~np.isnan(sst_grid_celsius)

    # Initialize output arrays
    front_mask = np.zeros((ny, nx), dtype=bool)
    gradient_5km = np.full((ny, nx), np.nan, dtype=float)
    orientation_deg = np.full((ny, nx), np.nan, dtype=float)

    if np.sum(valid_mask) < config["min_population"]:
        return front_mask, gradient_5km, orientation_deg

    # Smooth SST slightly to suppress high-frequency noise, preserving land/cloud NaNs
    filled_sst = np.where(valid_mask, sst_grid_celsius, np.nanmean(sst_grid_celsius))
    smoothed_sst = gaussian_filter(filled_sst, sigma=1.0)

    # Compute spatial gradients using Sobel operators
    # gradient_y (north-south, along rows), gradient_x (east-west, along columns)
    grad_y = sobel(smoothed_sst, axis=0) / (8.0 * dy_km)  # °C / km
    grad_x = sobel(smoothed_sst, axis=1) / (8.0 * dx_km)  # °C / km

    # Calculate magnitude normalized to standard oceanographic 5km distance: °C / 5km
    grad_mag_per_km = np.sqrt(grad_x**2 + grad_y**2)
    grad_5km_field = grad_mag_per_km * 5.0

    # Front orientation: perpendicular to gradient direction (along the isotherm)
    # Gradient direction theta = atan2(grad_y, grad_x)
    grad_dir_deg = (np.degrees(np.arctan2(grad_y, grad_x)) + 360.0) % 360.0
    # Front is aligned along isotherm: gradient direction + 90°
    front_dir_deg = (grad_dir_deg + 90.0) % 360.0

    # Cayula-Cornillon thresholding
    min_grad = config["min_temperature_gradient"]  # Default 0.5 °C / 5km
    candidate_fronts = (grad_5km_field >= min_grad) & valid_mask

    # Windowed bimodal validation (Cayula & Cornillon 1992 histogram separation check)
    win = config["window_size_pixels"]
    half_win = win // 2
    theta_thresh = config.get("theta_threshold", 0.65)

    for r in range(half_win, ny - half_win):
        for c in range(half_win, nx - half_win):
            if not candidate_fronts[r, c]:
                continue

            sub_sst = sst_grid_celsius[r - half_win:r + half_win + 1, c - half_win:c + half_win + 1]
            sub_valid = sub_sst[~np.isnan(sub_sst)]

            if len(sub_valid) < config["min_population"]:
                continue

            # Check thermal spread across local window
            t_min = np.min(sub_valid)
            t_max = np.max(sub_valid)
            t_diff = t_max - t_min

            if t_diff < min_grad:
                continue

            # Compute Otsu / Fisher between-class variance ratio: theta = sigma_B^2 / sigma_T^2
            # Bimodal distribution check separating warm and cold water masses
            total_var = np.var(sub_valid)
            if total_var < 1e-6:
                continue

            # Fast histogram-based Otsu separation
            n_bins = config.get("temp_histogram_bins", 32)
            hist, bin_edges = np.histogram(sub_valid, bins=n_bins)
            bin_centers = 0.5 * (bin_edges[:-1] + bin_edges[1:])
            total_count = len(sub_valid)

            weight_0 = np.cumsum(hist) / total_count
            weight_1 = 1.0 - weight_0

            # Cumulative means
            cum_sum = np.cumsum(hist * bin_centers)
            total_mean = cum_sum[-1] / total_count

            # Avoid division by zero
            valid_idx = (weight_0 > 0.01) & (weight_1 > 0.01)
            if not np.any(valid_idx):
                continue

            mean_0 = cum_sum[valid_idx] / (weight_0[valid_idx] * total_count)
            mean_1 = (cum_sum[-1] - cum_sum[valid_idx]) / (weight_1[valid_idx] * total_count)

            between_class_var = weight_0[valid_idx] * weight_1[valid_idx] * (mean_0 - mean_1)**2
            max_theta = np.max(between_class_var) / total_var

            # Mark front if thermal difference is sufficient and histogram exhibits bimodal separation
            if max_theta >= theta_thresh:
                front_mask[r, c] = True

    # Assign values where valid
    gradient_5km[valid_mask] = grad_5km_field[valid_mask]
    orientation_deg[valid_mask] = front_dir_deg[valid_mask]

    return front_mask, gradient_5km, orientation_deg


def detect_chl_fronts(
    chl_grid_mg_m3: np.ndarray,
    dx_km: float = 4.0,
    dy_km: float = 4.0,
    config: Dict[str, Any] = CANNY_CHL_CONFIG
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Detects chlorophyll fronts using Canny-style edge detection on log-transformed chlorophyll.
    Chlorophyll varies log-normally in marine waters.

    Outputs:
    - chl_front_mask: boolean 2D array indicating presence of biological front.
    - chl_gradient: float 2D array of log10 chlorophyll spatial gradient magnitude.
    """
    ny, nx = chl_grid_mg_m3.shape
    valid_mask = (~np.isnan(chl_grid_mg_m3)) & (chl_grid_mg_m3 > 0.0)

    front_mask = np.zeros((ny, nx), dtype=bool)
    chl_grad_field = np.full((ny, nx), np.nan, dtype=float)

    if np.sum(valid_mask) < 10:
        return front_mask, chl_grad_field

    # Log-transform chlorophyll to normalize skewness
    log_chl = np.full((ny, nx), np.nan)
    log_chl[valid_mask] = np.log10(chl_grid_mg_m3[valid_mask])

    # Infill NaNs with local mean for smooth filter boundary
    mean_val = np.nanmean(log_chl)
    filled_log = np.where(valid_mask, log_chl, mean_val)

    smoothed = gaussian_filter(filled_log, sigma=config["gaussian_sigma"])

    # Gradients
    gy = sobel(smoothed, axis=0) / (8.0 * dy_km)
    gx = sobel(smoothed, axis=1) / (8.0 * dx_km)
    magnitude = np.sqrt(gx**2 + gy**2)

    valid_grads = magnitude[valid_mask]
    if len(valid_grads) > 0:
        low_t = float(np.quantile(valid_grads, config["low_threshold_quantile"]))
        high_t = float(np.quantile(valid_grads, config["high_threshold_quantile"]))
        min_floor = float(config.get("min_gradient_floor", 0.04))

        # Enforce absolute gradient floor: prevents flat-water sensor noise from being flagged as fronts
        high_t = max(high_t, min_floor)
        low_t = max(low_t, min_floor * 0.5)

        # Hysteresis thresholding
        strong_edges = (magnitude >= high_t) & valid_mask
        weak_edges = (magnitude >= low_t) & (magnitude < high_t) & valid_mask

        # Dilate strong edges into adjacent weak edges
        dilated = strong_edges.copy()
        for _ in range(2):
            for dr in [-1, 0, 1]:
                for dc in [-1, 0, 1]:
                    if dr == 0 and dc == 0:
                        continue
                    shifted = np.roll(np.roll(dilated, dr, axis=0), dc, axis=1)
                    dilated = dilated | (shifted & weak_edges)

        front_mask = dilated

    chl_grad_field[valid_mask] = magnitude[valid_mask]
    return front_mask, chl_grad_field


def combine_front_features(
    sst_front_mask: np.ndarray,
    chl_front_mask: np.ndarray
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Combines SST and Chlorophyll front features into unified front presence:
    front_present = sst_front OR chl_front

    Retains all underlying flags for scientific explainability.
    """
    combined = sst_front_mask | chl_front_mask
    return combined, sst_front_mask, chl_front_mask
