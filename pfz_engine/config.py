"""
Configuration and Scientific Thresholds for SagarDrishti PFZ Engine v2.

SCIENTIFIC HONESTY RULES:
- Every parameter is clearly marked as either:
  * [RESEARCH-DERIVED] : Directly grounded in Sarangi et al. (2024) or Jishad et al. (2019/2021).
  * [OPERATIONAL-METHODOLOGY-DERIVED] : Attributed to INCOIS/MOSDAC Potential Fishing Zone Advisory documentation.
  * [ENGINEERING ASSUMPTION] : Necessary for numerical execution, not claimed as paper-exact.
"""

# =============================================================================
# 1. BIOLOGICAL PRODUCTIVITY (CHLOROPHYLL-A)
# =============================================================================

# [RESEARCH-DERIVED] Sarangi et al. (2024), Environmental Monitoring and Assessment, 196:98.
# High chlorophyll productivity threshold for potential fishing zone formation in the Bay of Bengal / Indian Seas.
CHL_HIGH_THRESHOLD: float = 0.1  # mg/m³

# [RESEARCH-DERIVED] Jishad et al. (2021) / Sarangi et al. (2024)
# Multi-day composite window to mitigate persistent monsoon cloud coverage.
CHL_COMPOSITE_WINDOW_DAYS: int = 3

# [ENGINEERING ASSUMPTION]
# Minimum non-null pixel fraction across the 3-day window required to declare chlorophyll valid.
CHL_MIN_VALID_OBSERVATION_RATIO: float = 0.33

# =============================================================================
# 2. SST THERMAL FRONT DETECTION (CAYULA & CORNILLON LINEAGE)
# =============================================================================

# [ENGINEERING ASSUMPTION]
# Cayula & Cornillon (1992) single-image edge detection parameters.
# Tuning parameters are NOT specified in Sarangi (2024) or Jishad (2021); hence documented as engineering values.
CAYULA_CORNILLON_CONFIG = {
    "window_size_pixels": 16,        # Local sliding analysis window (~64 km at 4km res)
    "min_population": 8,            # Minimum valid marine pixels in window
    "temp_histogram_bins": 32,      # Bins for histogram bi-modality test
    "min_temperature_gradient": 0.5, # Minimum SST difference across front (°C / 5km)
    "theta_threshold": 0.65,        # Fisher's bimodal separability metric threshold
    "weak_gradient_cutoff": 0.25    # Gradients below this are ignored as background noise
}

# =============================================================================
# 3. CHLOROPHYLL FRONT DETECTION (CANNY EDGE DETECTOR)
# =============================================================================

# [ENGINEERING ASSUMPTION]
# Canny edge detector applied to log-transformed chlorophyll-a field.
# Exact sigma and hysteresis thresholds were not specified in Jishad/Sarangi text.
CANNY_CHL_CONFIG = {
    "gaussian_sigma": 1.2,          # Smoothing kernel size
    "low_threshold_quantile": 0.65,  # Hysteresis lower threshold quantile
    "high_threshold_quantile": 0.85, # Hysteresis upper threshold quantile
    "min_gradient_floor": 0.04,     # [ENGINEERING ASSUMPTION] Absolute minimum log10 CHL gradient to prevent noise triggering in flat water
    "use_log_transform": True       # Ocean color log10 distribution transformation
}

# =============================================================================
# 4. MESOSCALE EDDY DETECTION (SLA / SSH ALTIMETRY)
# =============================================================================

# [OPERATIONAL-METHODOLOGY-DERIVED]
# Identified from the official INCOIS/MOSDAC operational procedure document citing Jishad et al. lineage.
# Chelton et al. (2011) and Mason et al. (2014) geometric contours.
EDDY_CONFIG = {
    "max_eddy_radius_km": 400.0,    # Maximum radius for mesoscale eddy (MOSDAC)
    "min_eddy_radius_km": 25.0,     # Minimum radius to resolve on satellite grid
    "min_amplitude_cm": 5.0,        # Minimum sea-level anomaly depression/elevation (5 cm)
    "contour_interval_cm": 1.0,     # SLA contouring step
    "coastal_distance_cutoff_km": 25.0 # Coastal altimetry gap threshold (SLA unreliable closer)
}

# =============================================================================
# 5. RELATIVE WIND & EKMAN TRANSPORT PERSISTENCE
# =============================================================================

# [OPERATIONAL-METHODOLOGY-DERIVED]
# MOSDAC Operational PFZ Advisory: Ekman transport alignment within 40° of front orientation.
EKMAN_PERSISTENCE_ANGLE_MAX_DEG: float = 40.0  # Angle <= 40° -> HIGH persistence, otherwise LOW

# [ENGINEERING ASSUMPTION]
# Northern hemisphere Coriolis deflection for surface Ekman transport
EKMAN_DEFLECTION_NORTHERN_HEMISPHERE_DEG: float = 90.0

# =============================================================================
# 6. COMMON GRIDDING & INTERPOLATION
# =============================================================================

# [RESEARCH-DERIVED] Sarangi et al. (2024) / Jishad et al. (2021)
# 4-km uniform spatial grid standard for multi-parameter feature co-occurrence.
COMMON_GRID_RESOLUTION_KM: float = 4.0
COMMON_GRID_INTERPOLATION_METHOD: str = "bilinear"

# =============================================================================
# 7. DATA FRESHNESS POLICIES
# =============================================================================

# [ENGINEERING ASSUMPTION]
# SagarDrishti operational age boundaries for satellite marine observations.
FRESHNESS_FRESH_MAX_HOURS: float = 24.0       # < 24 hours: FRESH
FRESHNESS_PERSISTED_MAX_HOURS: float = 72.0   # 24 to 72 hours: PERSISTED
# > 72 hours: INSUFFICIENT EVIDENCE
