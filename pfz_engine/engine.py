"""
Master Orchestrator for the Scientific PFZ Engine v2.

SCIENTIFIC WORKFLOW:
1. Spatial Subsetting: Construct bounding box around user GPS / port.
2. Common Grid (4 km): Regular coordinate meshgrid.
3. Ingestion & Preprocessing:
   - Sea Surface Temperature (OSTIA L4 0.05° -> 4km)
   - 3-Day Chlorophyll-a composite (4km L3 -> 4km)
   - Surface Ocean Physics (uo, vo, zos from CMEMS physics -> 4km)
4. Scientific Feature Detectors:
   - SST Thermal Fronts (Cayula & Cornillon 1992 lineage)
   - Chlorophyll Fronts (Canny edge detection)
   - Combined Front Flag (SST front OR CHL front)
   - Mesoscale Cyclonic Eddies (SLA extrema & contours; UNKNOWN in coastal altimetry gap)
   - Relative Wind Vector (W_wind - V_current)
   - Ekman Transport Persistence (<= 40° alignment to front)
5. Multi-Parameter Feature Co-occurrence Classification (C + F + E)
6. Freshness & Evidence Layer
7. Geographic Candidate Ranking
"""

import time
import os
import glob
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
import numpy as np
import xarray as xr

from .models import (
    AnalyzeRequest,
    AnalyzeResponse,
    PfzCandidate,
    FeatureDetectionResult,
    DataEvidence,
    FreshnessMetadata,
    PersistenceMetadata,
    EvidenceQuality,
    DataQualityAssessment,
    OceanographicFeatureStrength,
    AlgorithmStability,
    BiologicalValidationStatus,
    ParameterTraceability,
)

STANDARD_PARAMETER_TRACEABILITY = [
    ParameterTraceability(
        parameter="chlorophyll_threshold",
        threshold="0.1 mg/m³",
        threshold_type="LITERATURE_SUPPORTED",
        source_citation="Sarangi et al. (2024), Table 2 / Section 3.2",
    ),
    ParameterTraceability(
        parameter="sst_thermal_front",
        threshold="0.5 °C / 5 km + Otsu bimodal theta >= 0.65",
        threshold_type="LITERATURE_SUPPORTED",
        source_citation="Cayula & Cornillon (1992), J. Atmos. Oceanic Technol., 9(1) [Cayula-Cornillon-inspired adaptation]",
    ),
    ParameterTraceability(
        parameter="cyclonic_eddy_anomaly",
        threshold="Negative SLA anomaly < -0.05 m",
        threshold_type="LITERATURE_SUPPORTED",
        source_citation="Chelton et al. (2011), Science, 334(6054) & Sarangi et al. (2024)",
    ),
    ParameterTraceability(
        parameter="ekman_front_alignment",
        threshold="Angle diff <= 40° for high persistence",
        threshold_type="OPERATIONAL_PROTOCOL",
        source_citation="INCOIS / MOSDAC Operational Advisory Protocol; Jishad et al. (2021)",
    ),
    ParameterTraceability(
        parameter="data_freshness_window",
        threshold="<24h Fresh, 24-72h Persisted, >72h Stale",
        threshold_type="ENGINEERING_CHOICE",
        source_citation="SagarDrishti Operational Protocol for NRT Satellite Ingestion",
    ),
    ParameterTraceability(
        parameter="co_registration_grid",
        threshold="4.0 km spatial lattice",
        threshold_type="ENGINEERING_CHOICE",
        source_citation="Co-registration lattice matching GlobColour CHL L3; does not enhance 25 km wind resolution.",
    ),
]

from .config import (
    CHL_HIGH_THRESHOLD,
    COMMON_GRID_RESOLUTION_KM,
    FRESHNESS_FRESH_MAX_HOURS,
    FRESHNESS_PERSISTED_MAX_HOURS,
)
from .preprocessing import (
    create_common_grid,
    resample_to_grid,
    compute_3day_chlorophyll_composite,
)
from .fronts import (
    detect_sst_fronts,
    detect_chl_fronts,
    combine_front_features,
)
from .eddies import detect_mesoscale_eddies
from .relative_wind import compute_relative_wind
from .ekman import evaluate_ekman_persistence
from .scoring import (
    evaluate_chlorophyll_criterion,
    classify_feature_co_occurrence,
)
from .freshness import calculate_data_age_hours, evaluate_freshness
from .spatial import (
    get_bounding_box_for_radius,
    haversine_distance_nm,
    calculate_compass_bearing,
    rank_pfz_candidates,
)


class ScientificPfzEngine:
    """
    Main engine orchestrator implementing the Sarangi et al. (2024) / Jishad et al. (2021)
    ocean feature co-occurrence framework.
    """

    def __init__(self, data_cache_dir: Optional[str] = None):
        # Local data directory for cached Copernicus NetCDF files
        if data_cache_dir:
            self.data_cache_dir = data_cache_dir
        else:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.data_cache_dir = os.path.join(base_dir, "scratch", "copernicus_test", "downloads")

    def load_regional_datasets(
        self,
        min_lat: float,
        max_lat: float,
        min_lon: float,
        max_lon: float,
        target_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Loads scientific NetCDF data arrays for the requested region.
        First attempts to load cached/downloaded slices from Copernicus Marine.
        """
        loaded: Dict[str, Any] = {
            "sst": None,
            "sst_lats": None,
            "sst_lons": None,
            "sst_timestamp": None,
            "sst_mask": None,

            "chl_grids": [],
            "chl_lats": None,
            "chl_lons": None,
            "chl_timestamp": None,

            "uo": None,
            "vo": None,
            "zos": None,
            "phy_lats": None,
            "phy_lons": None,
            "phy_timestamp": None,
        }

        # Look for available NetCDF files in data cache dir
        if not os.path.exists(self.data_cache_dir):
            return loaded

        nc_files = glob.glob(os.path.join(self.data_cache_dir, "*.nc"))

        for filepath in nc_files:
            filename = os.path.basename(filepath).lower()
            try:
                ds = xr.open_dataset(filepath)

                # 1. Sea Surface Temperature (OSTIA L4)
                if "sst" in filename or "analysed_sst" in ds.data_vars:
                    if loaded["sst"] is None:
                        # Extract 2D slice
                        sst_raw = ds["analysed_sst"].values
                        if sst_raw.ndim > 2:
                            sst_raw = sst_raw[0]
                        # Units conversion: Kelvin -> Celsius
                        if ds["analysed_sst"].attrs.get("units", "").lower() == "kelvin":
                            loaded["sst"] = sst_raw - 273.15
                        else:
                            loaded["sst"] = sst_raw

                        loaded["sst_lats"] = ds["latitude"].values
                        loaded["sst_lons"] = ds["longitude"].values
                        if "mask" in ds.data_vars:
                            mask_val = ds["mask"].values
                            loaded["sst_mask"] = mask_val[0] if mask_val.ndim > 2 else mask_val
                        if "time" in ds.coords:
                            loaded["sst_timestamp"] = str(ds["time"].values[0])

                # 2. Chlorophyll-a / Plankton L3 (cmems_obs-oc_glo_bgc-plankton_nrt_l3-multi-4km_P1D)
                # STRICT RULE: Must be Plankton CHL (mg/m³), NOT Optics BBP/CDM
                elif ("plankton" in filename or "CHL" in ds.data_vars) and "optics" not in filename:
                    if "CHL" in ds.data_vars:
                        da = ds["CHL"]
                        units = str(da.attrs.get("units", "")).lower()
                        # Strict unit verification: mg/m³ or milligram m-3
                        if "milligram" in units or "mg" in units or "m-3" in units:
                            chl_raw = da.values
                            if chl_raw.ndim > 2:
                                chl_raw = chl_raw[0]
                            loaded["chl_grids"].append(chl_raw)
                            if loaded["chl_lats"] is None:
                                loaded["chl_lats"] = ds["latitude"].values
                                loaded["chl_lons"] = ds["longitude"].values
                            if "time" in ds.coords and loaded["chl_timestamp"] is None:
                                loaded["chl_timestamp"] = str(ds["time"].values[0])

                # 3. Ocean Physics / Currents / SSH (uo, vo, zos)
                elif "current" in filename or "phy" in filename or ("uo" in ds.data_vars and "vo" in ds.data_vars):
                    if loaded["uo"] is None:
                        uo_raw = ds["uo"].values
                        vo_raw = ds["vo"].values
                        # Squeeze out extra time/depth dimensions
                        while uo_raw.ndim > 2:
                            uo_raw = uo_raw[0]
                        while vo_raw.ndim > 2:
                            vo_raw = vo_raw[0]

                        loaded["uo"] = uo_raw
                        loaded["vo"] = vo_raw

                        if "zos" in ds.data_vars:
                            zos_raw = ds["zos"].values
                            while zos_raw.ndim > 2:
                                zos_raw = zos_raw[0]
                            loaded["zos"] = zos_raw

                        loaded["phy_lats"] = ds["latitude"].values
                        loaded["phy_lons"] = ds["longitude"].values
                        if "time" in ds.coords:
                            loaded["phy_timestamp"] = str(ds["time"].values[0])

                ds.close()
            except Exception as e:
                # Log error and proceed to next dataset without crashing
                continue

        return loaded

    def analyze(self, request: AnalyzeRequest) -> AnalyzeResponse:
        """
        Executes full scientific PFZ pipeline around requested location.
        """
        start_time = time.time()

        # 1. Determine bounding box for requested radius
        min_lat, max_lat, min_lon, max_lon = get_bounding_box_for_radius(
            request.latitude, request.longitude, request.radius_km
        )

        # 2. Build common 4-km grid
        grid_lats, grid_lons, lat_step, lon_step = create_common_grid(
            min_lat, max_lat, min_lon, max_lon, resolution_km=COMMON_GRID_RESOLUTION_KM
        )
        ny, nx = grid_lats.shape

        # 3. Ingest scientific data layers
        datasets = self.load_regional_datasets(
            min_lat, max_lat, min_lon, max_lon, target_date=request.target_date
        )

        # 4. Regrid available datasets to common 4-km grid
        # --- SST ---
        if datasets["sst"] is not None and datasets["sst_lats"] is not None:
            sst_4km = resample_to_grid(
                datasets["sst_lats"], datasets["sst_lons"], datasets["sst"],
                grid_lats, grid_lons
            )
            sst_timestamp = datasets["sst_timestamp"]
        else:
            sst_4km = np.full((ny, nx), np.nan)
            sst_timestamp = None

        # --- Chlorophyll 3-day composite ---
        if datasets["chl_grids"] and datasets["chl_lats"] is not None:
            regridded_chls = [
                resample_to_grid(
                    datasets["chl_lats"], datasets["chl_lons"], g,
                    grid_lats, grid_lons
                )
                for g in datasets["chl_grids"]
            ]
            chl_composite_4km, chl_meta = compute_3day_chlorophyll_composite(regridded_chls)
            chl_timestamp = datasets["chl_timestamp"]
            cloud_affected = chl_meta["cloud_affected"]
        else:
            chl_composite_4km = np.full((ny, nx), np.nan)
            chl_timestamp = None
            cloud_affected = True
            chl_meta = {"cloud_affected": True, "composite_window_days": 3}

        # --- Physics (uo, vo, zos) ---
        if datasets["uo"] is not None and datasets["phy_lats"] is not None:
            uo_4km = resample_to_grid(
                datasets["phy_lats"], datasets["phy_lons"], datasets["uo"],
                grid_lats, grid_lons
            )
            vo_4km = resample_to_grid(
                datasets["phy_lats"], datasets["phy_lons"], datasets["vo"],
                grid_lats, grid_lons
            )
            if datasets["zos"] is not None:
                zos_4km = resample_to_grid(
                    datasets["phy_lats"], datasets["phy_lons"], datasets["zos"],
                    grid_lats, grid_lons
                )
            else:
                zos_4km = None
            phy_timestamp = datasets["phy_timestamp"]
        else:
            uo_4km = np.full((ny, nx), np.nan)
            vo_4km = np.full((ny, nx), np.nan)
            zos_4km = None
            phy_timestamp = None

        # 5. Scientific Feature Detectors
        # A. SST Thermal Fronts (Cayula & Cornillon)
        sst_front_mask, sst_grad, front_orientation = detect_sst_fronts(
            sst_4km, dx_km=COMMON_GRID_RESOLUTION_KM, dy_km=COMMON_GRID_RESOLUTION_KM
        )

        # B. Chlorophyll Fronts (Canny)
        chl_front_mask, chl_grad = detect_chl_fronts(
            chl_composite_4km, dx_km=COMMON_GRID_RESOLUTION_KM, dy_km=COMMON_GRID_RESOLUTION_KM
        )

        # C. Combined Front Flag
        front_present_mask, _, _ = combine_front_features(sst_front_mask, chl_front_mask)

        # D. Mesoscale Cyclonic Eddies (SLA/SSH)
        cyclonic_mask, eddy_types, eddy_status = detect_mesoscale_eddies(
            zos_4km, grid_lats, grid_lons,
            dx_km=COMMON_GRID_RESOLUTION_KM, dy_km=COMMON_GRID_RESOLUTION_KM
        )

        # E. Relative Wind & Ekman Persistence
        # Real atmospheric wind processing (Open-Meteo ECMWF IFS / marine pipeline coupling)
        u_wind_grid = None
        v_wind_grid = None
        wind_provided = False

        if request.u_wind_ms is not None and request.v_wind_ms is not None:
            u_wind_grid = np.full((ny, nx), float(request.u_wind_ms), dtype=float)
            v_wind_grid = np.full((ny, nx), float(request.v_wind_ms), dtype=float)
            wind_provided = True
        elif request.wind_speed_ms is not None and request.wind_direction_deg is not None:
            s = float(request.wind_speed_ms)
            dir_from = float(request.wind_direction_deg)
            # Meteorological direction: direction FROM which wind blows
            # Vector points towards: (dir_from + 180) % 360
            # Eastward u = -s * sin(radians(dir_from))
            # Northward v = -s * cos(radians(dir_from))
            u_val = -s * np.sin(np.radians(dir_from))
            v_val = -s * np.cos(np.radians(dir_from))
            u_wind_grid = np.full((ny, nx), u_val, dtype=float)
            v_wind_grid = np.full((ny, nx), v_val, dtype=float)
            wind_provided = True

        # STRICT SCIENTIFIC HONESTY: When atmospheric wind is unavailable,
        # DO NOT substitute 0.0 m/s. Relative wind & persistence must evaluate to UNAVAILABLE.
        if wind_provided and u_wind_grid is not None and v_wind_grid is not None:
            u_rel, v_rel, rel_speed, rel_dir = compute_relative_wind(
                u_wind_ms=u_wind_grid,
                v_wind_ms=v_wind_grid,
                u_current_ms=uo_4km,
                v_current_ms=vo_4km
            )
        else:
            u_rel, v_rel, rel_speed, rel_dir = compute_relative_wind(
                u_wind_ms=None,
                v_wind_ms=None,
                u_current_ms=uo_4km,
                v_current_ms=vo_4km
            )

        # 6. Evaluate Candidate Zones across Marine Grid
        candidates_raw: List[Dict[str, Any]] = []

        # Stride sampling across the 4-km grid to select candidate zones (e.g. step of 3 pixels ≈ 12 km)
        stride = max(1, ny // 10)
        cand_id = 1

        for r in range(0, ny, stride):
            for c in range(0, nx, stride):
                lat = float(grid_lats[r, c])
                lon = float(grid_lons[r, c])

                # Check if point is strictly within requested radius
                dist_nm = haversine_distance_nm(request.latitude, request.longitude, lat, lon)
                dist_km = dist_nm * 1.852
                if dist_km > request.radius_km:
                    continue

                sst_val = float(sst_4km[r, c]) if not np.isnan(sst_4km[r, c]) else None
                chl_val = float(chl_composite_4km[r, c]) if not np.isnan(chl_composite_4km[r, c]) else None

                # Strict land check: Exclude terrestrial grid cells where all marine observation layers are NaN
                is_marine_pixel = (sst_val is not None) or (chl_val is not None) or (uo_4km is not None and not np.isnan(uo_4km[r, c]))
                if not is_marine_pixel:
                    continue

                # Optical interpretation caveat for nearshore turbidity, river discharge, or sediment plumes
                opt_caveat: Optional[str] = None
                if dist_km < 20.0 or (chl_val is not None and chl_val > 5.0):
                    opt_caveat = "Nearshore waters: High turbidity, riverine discharge, or suspended sediment may contribute to elevated optical chlorophyll values."

                # Feature Flags
                high_chl = evaluate_chlorophyll_criterion(chl_val)
                has_sst_front = bool(sst_front_mask[r, c])
                has_chl_front = bool(chl_front_mask[r, c])
                has_front = bool(front_present_mask[r, c])

                # Eddy Flag (1.0 = Cyclonic, 0.0 = Anti/Neutral, NaN = Unknown)
                raw_eddy = cyclonic_mask[r, c]
                if np.isnan(raw_eddy):
                    is_cyclonic = None
                else:
                    is_cyclonic = bool(raw_eddy == 1.0)

                # Ekman Persistence
                front_dir = float(front_orientation[r, c]) if not np.isnan(front_orientation[r, c]) else None
                w_dir = float(rel_dir[r, c]) if not np.isnan(rel_dir[r, c]) else None
                p_status, p_class, angle_diff, ekman_dir = evaluate_ekman_persistence(w_dir, front_dir)

                # Ocean Current vector at candidate point
                cur_u = float(uo_4km[r, c]) if not np.isnan(uo_4km[r, c]) else None
                cur_v = float(vo_4km[r, c]) if not np.isnan(vo_4km[r, c]) else None
                if cur_u is not None and cur_v is not None:
                    cur_speed = round(float(np.sqrt(cur_u**2 + cur_v**2)), 3)
                    cur_dir = round(float((np.degrees(np.arctan2(cur_u, cur_v)) + 360.0) % 360.0), 1)
                else:
                    cur_speed = None
                    cur_dir = None

                cand_wind_spd = round(float(request.wind_speed_ms), 2) if request.wind_speed_ms is not None else None
                cand_wind_dir = round(float(request.wind_direction_deg), 1) if request.wind_direction_deg is not None else None

                # Categorical Classification
                classification, feature_count, explanation = classify_feature_co_occurrence(
                    high_chlorophyll=high_chl,
                    front_present=has_front,
                    cyclonic_eddy=is_cyclonic,
                    eddy_evidence_status=eddy_status
                )

                # Freshness
                age_hours = calculate_data_age_hours(sst_timestamp or chl_timestamp)
                freshness = evaluate_freshness(age_hours, cloud_affected=cloud_affected)

                bearing = calculate_compass_bearing(request.latitude, request.longitude, lat, lon)

                # Evidence Quality Construction (No fake percentage probabilities)
                chl_status = (
                    "MISSING" if chl_val is None or chl_meta.get("valid_pixels", 0) == 0
                    else ("CLOUD-AFFECTED" if cloud_affected or np.isnan(chl_val) else "AVAILABLE")
                )
                sst_status = "AVAILABLE" if sst_val is not None else "MISSING"

                if is_cyclonic is not None and eddy_status == "available":
                    ssh_status = "AVAILABLE"
                elif eddy_status == "unavailable" or dist_km < 35.0:
                    ssh_status = "COASTAL GAP"
                else:
                    ssh_status = "MISSING"

                wind_status = "AVAILABLE" if wind_provided else "MISSING"
                current_status = "AVAILABLE" if (uo_4km is not None and not np.all(np.isnan(uo_4km))) else "MISSING"

                # --- DIMENSION A: Data / Evidence Quality ---
                dq_reasons = []
                avail_layers = 0

                if sst_val is not None:
                    avail_layers += 1
                    dq_reasons.append("SST observation available from UK Met Office OSTIA L4 (~5 km)")
                else:
                    dq_reasons.append("SST observation missing")

                if chl_val is not None and chl_status != "MISSING":
                    avail_layers += 1
                    if cloud_affected:
                        dq_reasons.append("Chlorophyll-a composite available (~4 km) but partially degraded by cloud cover")
                    else:
                        dq_reasons.append("Chlorophyll-a composite available and clear from GlobColour L3 (~4 km)")
                else:
                    dq_reasons.append("Chlorophyll-a observation missing or obscured by overcast cloud cover")

                if cur_speed is not None:
                    avail_layers += 1
                    dq_reasons.append("Ocean surface current vectors available from CMEMS Global Physics (~9 km)")
                else:
                    dq_reasons.append("Ocean surface current observations missing")

                if wind_provided:
                    avail_layers += 1
                    dq_reasons.append("Atmospheric wind vectors coupled from ECMWF IFS model (~25 km)")
                else:
                    dq_reasons.append("Atmospheric wind vector unavailable; Ekman persistence set to UNAVAILABLE")

                if is_cyclonic is not None and eddy_status == "available":
                    avail_layers += 1
                    dq_reasons.append("Altimetric SLA available from CMEMS Global Physics (~9 km)")
                elif eddy_status == "unavailable" or dist_km < 35.0:
                    dq_reasons.append("Eddy evidence unavailable because candidate is inside 35-km coastal altimetry gap")
                else:
                    dq_reasons.append("Altimetric SLA observation missing")

                if opt_caveat is not None:
                    dq_reasons.append(f"Nearshore optical caveat: {opt_caveat}")

                if avail_layers == 5 and freshness.status == "FRESH":
                    dq_status = "EXCELLENT"
                elif avail_layers >= 4 and freshness.status in ["FRESH", "PERSISTED — 24–72h"]:
                    dq_status = "GOOD"
                elif avail_layers >= 2:
                    dq_status = "LIMITED"
                elif avail_layers == 1:
                    dq_status = "POOR"
                else:
                    dq_status = "INSUFFICIENT"

                data_quality = DataQualityAssessment(
                    status=dq_status,
                    reasons=dq_reasons,
                    sensor_coverage_fraction=round(avail_layers / 5.0, 2),
                    freshness_category=freshness.status,
                    limiting_resolution_km=25.0 if wind_provided else 9.0,
                    optical_turbidity_risk=(opt_caveat is not None)
                )

                # --- DIMENSION B: Oceanographic Feature Strength ---
                feat_dict = {
                    "chlorophyll": "PRESENT" if high_chl else ("UNKNOWN" if chl_val is None else "ABSENT"),
                    "sst_front": "PRESENT" if has_sst_front else ("UNKNOWN" if sst_val is None else "ABSENT"),
                    "eddy_like_anomaly": "PRESENT" if is_cyclonic is True else ("UNKNOWN" if is_cyclonic is None else "ABSENT"),
                    "current_support": "PRESENT" if (cur_speed is not None and cur_speed >= 0.1) else ("UNKNOWN" if cur_speed is None else "ABSENT"),
                    "wind_support": "PRESENT" if (cand_wind_spd is not None and 2.0 <= cand_wind_spd <= 15.0) else ("UNKNOWN" if cand_wind_spd is None else "ABSENT"),
                }
                detected_feats = sum(1 for v in feat_dict.values() if v == "PRESENT")

                if detected_feats >= 3 and p_class != "LOW":
                    feat_status = "STRONG_MULTI_FACTOR_EVIDENCE"
                elif detected_feats == 2:
                    feat_status = "MODERATE_MULTI_FACTOR_EVIDENCE"
                elif detected_feats == 1:
                    feat_status = "LIMITED_EVIDENCE"
                else:
                    feat_status = "INSUFFICIENT_EVIDENCE"

                feature_strength = OceanographicFeatureStrength(
                    status=feat_status,
                    detected_count=detected_feats,
                    total_evaluated=5,
                    features=feat_dict, # type: ignore
                    persistence_evaluation=p_class
                )

                # --- DIMENSION C: Algorithm / Computational Stability ---
                algo_reasons = []
                r_min, r_max = max(0, r - 1), min(ny, r + 2)
                c_min, c_max = max(0, c - 1), min(nx, c + 2)
                local_patch = sst_4km[r_min:r_max, c_min:c_max]
                missing_frac = round(float(np.isnan(local_patch).mean()), 2)

                if has_sst_front:
                    algo_reasons.append("Cayula-Cornillon-inspired thermal front detected with Otsu bimodal between-class variance ratio >= 0.65")
                else:
                    algo_reasons.append("Thermal front not detected or local histogram unimodal")

                if has_chl_front:
                    algo_reasons.append("Chlorophyll gradient exceeds Canny floor (0.04 mg/m³/km)")
                else:
                    algo_reasons.append("Chlorophyll gradient below noise rejection floor")

                algo_reasons.append(f"Local neighborhood missing data fraction: {missing_frac:.2f} ratio")

                if (has_sst_front or has_chl_front or high_chl) and missing_frac < 0.25:
                    algo_status = "STABLE"
                elif missing_frac < 0.5:
                    algo_status = "ACCEPTABLE"
                elif missing_frac < 0.75:
                    algo_status = "FRAGILE"
                else:
                    algo_status = "INSUFFICIENT_DATA"

                algorithm_stability = AlgorithmStability(
                    status=algo_status,
                    reasons=algo_reasons,
                    otsu_bimodal_verified=has_sst_front,
                    gradient_floor_exceeded=(has_sst_front or has_chl_front),
                    missing_data_fraction=missing_frac
                )

                # --- DIMENSION D: Biological Validation Status ---
                biological_validation = BiologicalValidationStatus(
                    status="BIOLOGICAL_VALIDATION_NOT_ESTABLISHED",
                    ground_truth_source=None,
                    validation_period=None,
                    validation_region=None,
                    sample_count=0,
                    methodology=None,
                    disclaimer=(
                        "Production biological validation requires independent georeferenced fisheries catch logs or CPUE data. "
                        "The current system identifies oceanographic environmental suitability only; fish presence is not directly observed."
                    )
                )

                evidence_quality = EvidenceQuality(
                    co_occurrence_tier=classification,
                    chl_status=chl_status,
                    sst_status=sst_status,
                    ssh_sla_status=ssh_status,
                    wind_status=wind_status,
                    current_status=current_status,
                    freshness_hours=freshness.age_hours if freshness.age_hours < 900 else None,
                    freshness_status=freshness.status,
                    persistence_status=p_class,
                    source_datasets={
                        "sst": "METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2",
                        "chlorophyll": "cmems_obs-oc_glo_bgc-plankton_nrt_l3-multi-4km_P1D",
                        "ocean_physics": "cmems_mod_glo_phy_anfc_0.083deg_PT1H-m",
                        "atmospheric_wind": "Open-Meteo ECMWF IFS 0.25° Model" if wind_provided else "UNAVAILABLE",
                    },
                    limiting_resolution_km=25.0,
                    optical_interpretation_caveat=opt_caveat,
                    data_quality_assessment=data_quality,
                    feature_strength_assessment=feature_strength,
                    algorithm_stability=algorithm_stability,
                    biological_validation=biological_validation,
                    honesty_declaration="Evidence Quality is categorical and based on verified physical sensor observations. No statistical probability percentages. Assesses oceanographic suitability for pelagic aggregation, not fish presence."
                )

                # Construct PfzCandidate dictionary
                cand_dict = {
                    "id": f"pfz_cand_{cand_id}",
                    "name": f"Offshore Sector {cand_id} ({lat:.2f}°N, {lon:.2f}°E)",
                    "latitude": round(lat, 4),
                    "longitude": round(lon, 4),
                    "distance_nm": round(dist_nm, 1),
                    "bearing": bearing,
                    "classification": classification,
                    "feature_count": feature_count,
                    "features": FeatureDetectionResult(
                        high_chlorophyll=high_chl,
                        sst_front=has_sst_front,
                        chl_front=has_chl_front,
                        front_present=has_front,
                        cyclonic_eddy=is_cyclonic,
                        eddy_evidence_status=eddy_status if is_cyclonic is not None else "unavailable"
                    ),
                    "data_evidence": DataEvidence(
                        sst_timestamp=sst_timestamp,
                        chl_timestamp=chl_timestamp,
                        sla_timestamp=phy_timestamp,
                        current_timestamp=phy_timestamp,
                        cloud_affected=cloud_affected,
                        eddy_data_available=(eddy_status == "available"),
                        composite_window_days=chl_meta.get("composite_window_days", 3)
                    ),
                    "freshness": freshness,
                    "persistence": PersistenceMetadata(
                        status=p_status, # type: ignore
                        classification=p_class, # type: ignore
                        angle_to_front_deg=angle_diff,
                        ekman_direction_deg=ekman_dir,
                        relative_wind_speed_ms=float(rel_speed[r, c]) if not np.isnan(rel_speed[r, c]) else None,
                        relative_wind_dir_deg=w_dir
                    ),
                    "evidence_quality": evidence_quality,
                    "data_quality": data_quality,
                    "feature_strength": feature_strength,
                    "algorithm_stability": algorithm_stability,
                    "biological_validation": biological_validation,
                    "traceability": STANDARD_PARAMETER_TRACEABILITY,
                    "explanation": explanation,
                    "sea_surface_temperature_c": round(sst_val, 2) if sst_val is not None else None,
                    "chlorophyll_a_mg_m3": round(chl_val, 4) if chl_val is not None else None,
                    "surface_current_speed_ms": cur_speed,
                    "surface_current_direction_deg": cur_dir,
                    "atmospheric_wind_speed_ms": cand_wind_spd,
                    "atmospheric_wind_direction_deg": cand_wind_dir,
                }

                candidates_raw.append(cand_dict)
                cand_id += 1

        # 7. Spatial Ranking
        ranked = rank_pfz_candidates(candidates_raw, max_return_count=5)

        # Convert to Pydantic objects
        final_candidates: List[PfzCandidate] = []
        for c in ranked:
            final_candidates.append(PfzCandidate(**c))

        execution_ms = round((time.time() - start_time) * 1000.0, 1)

        return AnalyzeResponse(
            engine_version="pfz-v2",
            biological_validation_status="BIOLOGICAL_VALIDATION_NOT_ESTABLISHED",
            methodology={
                "primary": "Sarangi et al. (2024), Environmental Monitoring and Assessment, 196:98",
                "supporting": "Jishad et al. (2019/2021), Journal of Operational Oceanography, 14(1), 59–70",
                "operational": "INCOIS / MOSDAC Potential Fishing Zone Advisory operational procedures",
                "classification_rule": "Deterministic co-occurrence of High Chlorophyll (C), Ocean Front (F), and Cyclonic Eddy (E)."
            },
            user_location={
                "latitude": request.latitude,
                "longitude": request.longitude,
                "radius_km": request.radius_km,
                "reference_port": request.reference_port_name
            },
            results=final_candidates,
            count=len(final_candidates),
            execution_time_ms=execution_ms
        )

