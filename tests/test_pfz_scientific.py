"""
Scientific Test Suite for SagarDrishti AI PFZ Engine v2.

Covers all required scientific benchmarks:
1. Chlorophyll strict inequality threshold (0.09, 0.10, 0.1001)
2. C + F + E co-occurrence matrix (0, 1, 2, 3)
3. Unknown eddy handling (coastal altimetry gap) -> NEVER false negative
4. Freshness rules (18h, 48h, >72h)
5. Cloud coverage NaN preservation (never treated as 0)
6. Relative wind vector subtraction and circular Ekman difference
7. Spatial distance constraints
8. FastAPI /health, /version, /analyze validation
"""

import math
import numpy as np
import pytest
from fastapi.testclient import TestClient

from pfz_engine.scoring import (
    evaluate_chlorophyll_criterion,
    classify_feature_co_occurrence,
)
from pfz_engine.config import CHL_HIGH_THRESHOLD
from pfz_engine.freshness import evaluate_freshness
from pfz_engine.relative_wind import compute_relative_wind
from pfz_engine.ekman import (
    compute_circular_angular_difference,
    evaluate_ekman_persistence,
)
from pfz_engine.spatial import haversine_distance_km, haversine_distance_nm
from pfz_engine.preprocessing import compute_3day_chlorophyll_composite
from pfz_engine.service import app


# =============================================================================
# 1. CHLOROPHYLL THRESHOLD TESTS (Sarangi et al. 2024: CHL > 0.1 mg/m³)
# =============================================================================

def test_chlorophyll_strict_inequality_threshold():
    """Verify strict CHL > 0.1 mg/m³ rule without altering to >="""
    assert evaluate_chlorophyll_criterion(0.09) is False, "0.09 must be False"
    assert evaluate_chlorophyll_criterion(0.10) is False, "0.10 must be False (strict >)"
    assert evaluate_chlorophyll_criterion(0.1001) is True, "0.1001 must be True"
    assert evaluate_chlorophyll_criterion(None) is False, "None must be False"
    assert evaluate_chlorophyll_criterion(0.0) is False, "0.0 must be False"
    assert evaluate_chlorophyll_criterion(1.5) is True, "1.5 must be True"


# =============================================================================
# 2. FEATURE CO-OCCURRENCE CLASSIFICATION TESTS (C + F + E)
# =============================================================================

def test_feature_co_occurrence_matrix_with_valid_eddy():
    """Verify standard 0, 1, 2, 3 co-occurrence when SLA eddy data is available"""
    # 0 features: No signal
    cls_0, count_0, _ = classify_feature_co_occurrence(
        high_chlorophyll=False, front_present=False, cyclonic_eddy=False, eddy_evidence_status="available"
    )
    assert cls_0 == "NO_SIGNAL"
    assert count_0 == 0

    # 1 feature: Low possibility
    cls_1, count_1, _ = classify_feature_co_occurrence(
        high_chlorophyll=True, front_present=False, cyclonic_eddy=False, eddy_evidence_status="available"
    )
    assert cls_1 == "LOW_POSSIBILITY"
    assert count_1 == 1

    # 2 features: Medium possibility
    cls_2, count_2, _ = classify_feature_co_occurrence(
        high_chlorophyll=True, front_present=True, cyclonic_eddy=False, eddy_evidence_status="available"
    )
    assert cls_2 == "MEDIUM_POSSIBILITY"
    assert count_2 == 2

    # 3 features: High possibility
    cls_3, count_3, _ = classify_feature_co_occurrence(
        high_chlorophyll=True, front_present=True, cyclonic_eddy=True, eddy_evidence_status="available"
    )
    assert cls_3 == "HIGH_POSSIBILITY"
    assert count_3 == 3


# =============================================================================
# 3. UNKNOWN EDDY HANDLING TESTS (Coastal Altimetry Gap)
# =============================================================================

def test_unknown_eddy_handling_prevents_false_negatives():
    """
    When SLA/SSH is unavailable (coastal gap):
    C=True, F=True, E=UNKNOWN
    Must produce MEDIUM_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE.
    Must NEVER become HIGH, and never plain MEDIUM as if E=False.
    """
    cls, count, exp = classify_feature_co_occurrence(
        high_chlorophyll=True, front_present=True, cyclonic_eddy=None, eddy_evidence_status="unavailable"
    )
    assert cls == "MEDIUM_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE"
    assert cls != "HIGH_POSSIBILITY"
    assert cls != "MEDIUM_POSSIBILITY"
    assert count == 2
    assert any("coastal satellite altimetry coverage limitation" in item for item in exp)

    # C=1, F=0, E=UNKNOWN
    cls_c1, _, _ = classify_feature_co_occurrence(
        high_chlorophyll=True, front_present=False, cyclonic_eddy=None, eddy_evidence_status="unavailable"
    )
    assert cls_c1 == "LOW_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE"

    # C=0, F=0, E=UNKNOWN
    cls_c0, _, _ = classify_feature_co_occurrence(
        high_chlorophyll=False, front_present=False, cyclonic_eddy=None, eddy_evidence_status="unavailable"
    )
    assert cls_c0 == "NO_SIGNAL"


# =============================================================================
# 4. FRESHNESS POLICIES TESTS
# =============================================================================

def test_freshness_classification_buckets():
    """Verify <24h FRESH, 24-72h PERSISTED, >72h INSUFFICIENT EVIDENCE"""
    meta_18 = evaluate_freshness(age_hours=18.0)
    assert meta_18.status == "FRESH"
    assert meta_18.age_hours == 18.0

    meta_48 = evaluate_freshness(age_hours=48.0)
    assert meta_48.status == "PERSISTED — 24–72h"

    meta_80 = evaluate_freshness(age_hours=80.0)
    assert meta_80.status == "INSUFFICIENT EVIDENCE"

    # Cloud affected overrides age to degraded/insufficient evidence
    meta_cloud = evaluate_freshness(age_hours=6.0, cloud_affected=True)
    assert meta_cloud.status == "INSUFFICIENT EVIDENCE"


# =============================================================================
# 5. CLOUD COVERAGE & NaN PRESERVATION TESTS
# =============================================================================

def test_cloud_coverage_never_converts_nan_to_zero():
    """Verify 3-day composite tracks NaNs and never treats missing data as 0.0"""
    # Create 3 days of grids: Day 1 cloud-masked (all NaNs), Day 2 partial, Day 3 clear
    day1 = np.full((3, 3), np.nan)
    day2 = np.array([[0.15, np.nan, 0.25], [np.nan, np.nan, 0.30], [0.12, 0.18, np.nan]])
    day3 = np.array([[0.20, 0.30, 0.40], [0.10, 0.15, 0.20], [0.18, 0.22, 0.25]])

    composite, meta = compute_3day_chlorophyll_composite([day1, day2, day3])

    # Where day 2 is 0.15 and day 3 is 0.20, composite mean should be 0.175 (NOT pulled down by day1 NaN as 0)
    assert math.isclose(composite[0, 0], 0.175, abs_tol=1e-4)

    # Pixel (1, 1): day1 NaN, day2 NaN, day3 0.15 -> mean must be exactly 0.15, not 0.05
    assert math.isclose(composite[1, 1], 0.15, abs_tol=1e-4)

    # Metadata checks
    assert meta["composite_window_days"] == 3
    assert meta["cloud_affected"] is False  # Clear enough overall


# =============================================================================
# 6. VECTOR MATH & CIRCULAR EKMAN PERSISTENCE TESTS
# =============================================================================

def test_relative_wind_vector_math():
    """Verify W_rel = W_wind - V_current"""
    u_w = np.array([[5.0]])
    v_w = np.array([[10.0]])
    u_c = np.array([[1.0]])
    v_c = np.array([[2.0]])

    u_rel, v_rel, speed, direction = compute_relative_wind(u_w, v_w, u_c, v_c)
    assert math.isclose(u_rel[0, 0], 4.0)
    assert math.isclose(v_rel[0, 0], 8.0)
    assert math.isclose(speed[0, 0], math.sqrt(16.0 + 64.0), abs_tol=1e-4)


def test_circular_angular_difference_handles_wraparound():
    """Verify circular difference handles 0°/360° discontinuity cleanly"""
    # 5° and 355° have difference of 10°, NOT 350°
    diff = compute_circular_angular_difference(5.0, 355.0)
    assert math.isclose(diff, 10.0, abs_tol=1e-4)

    # 10° and 190° has difference of 180°
    diff_180 = compute_circular_angular_difference(10.0, 190.0)
    assert math.isclose(diff_180, 180.0, abs_tol=1e-4)


def test_ekman_persistence_40_degree_threshold():
    """Verify MOSDAC operational 40° threshold"""
    # High persistence (alignment <= 40°)
    status, classification, angle, _ = evaluate_ekman_persistence(
        rel_wind_dir_deg=180.0, front_orientation_deg=90.0
    )
    assert status == "AVAILABLE"
    assert classification == "HIGH"
    assert angle is not None and angle <= 40.0

    # Low persistence (alignment > 40°)
    status_low, class_low, angle_low, _ = evaluate_ekman_persistence(
        rel_wind_dir_deg=180.0, front_orientation_deg=0.0
    )
    assert status_low == "AVAILABLE"
    assert class_low == "LOW"

    # Missing inputs -> UNAVAILABLE
    status_na, class_na, _, _ = evaluate_ekman_persistence(None, 45.0)
    assert status_na == "UNAVAILABLE"
    assert class_na == "UNAVAILABLE"


def test_ekman_northern_hemisphere_right_deflection():
    """
    Verify Northern Hemisphere right-of-wind convention:
    - Wind blowing from South (180°) -> vector points North (0°) -> Ekman points East (90°).
    - Wind blowing from West (270°) -> vector points East (90°) -> Ekman points South (180°).
    - Wind blowing from North (0°) -> vector points South (180°) -> Ekman points West (270°).
    """
    # Wind from South (180°)
    _, _, _, ekman_dir_s = evaluate_ekman_persistence(rel_wind_dir_deg=180.0, front_orientation_deg=90.0)
    assert math.isclose(ekman_dir_s, 90.0, abs_tol=1e-3), f"Expected 90.0° (East), got {ekman_dir_s}"

    # Wind from West (270°)
    _, _, _, ekman_dir_w = evaluate_ekman_persistence(rel_wind_dir_deg=270.0, front_orientation_deg=180.0)
    assert math.isclose(ekman_dir_w, 180.0, abs_tol=1e-3), f"Expected 180.0° (South), got {ekman_dir_w}"

    # Wind from North (0°)
    _, _, _, ekman_dir_n = evaluate_ekman_persistence(rel_wind_dir_deg=0.0, front_orientation_deg=270.0)
    assert math.isclose(ekman_dir_n, 270.0, abs_tol=1e-3), f"Expected 270.0° (West), got {ekman_dir_n}"


def test_derive_sla_from_absolute_ssh():
    """
    Verify explicit Sea Level Anomaly (SLA) derivation from absolute SSH (zos).
    SLA = SSH - <SSH>_regional
    """
    from pfz_engine.eddies import derive_sla_from_ssh

    # Uniform background of 0.30 m with a 0.08 m cyclonic depression in the center
    ssh = np.full((5, 5), 0.30)
    ssh[2, 2] = 0.22  # depression of -0.08 m

    sla, meta = derive_sla_from_ssh(ssh)
    assert sla is not None
    assert meta["input_variable"] == "zos (Sea Surface Height above Geoid)"
    assert meta["method"] == "spatial_mean_anomaly_subtraction"
    # Center pixel should have a negative anomaly (cyclonic core)
    assert sla[2, 2] < 0.0
    # Background pixels should have a slight positive anomaly relative to regional mean
    assert sla[0, 0] > 0.0



# =============================================================================
# 7. SPATIAL DISTANCE CONSTRAINTS TESTS
# =============================================================================

def test_haversine_distance():
    """Verify Haversine distance calculations"""
    # Mumbai (18.92°N, 72.83°E) to coastal sea point ~30 NM offshore
    dist_km = haversine_distance_km(18.92, 72.83, 18.74, 72.31)
    dist_nm = haversine_distance_nm(18.92, 72.83, 18.74, 72.31)
    assert 50.0 <= dist_km <= 70.0
    assert 25.0 <= dist_nm <= 40.0


# =============================================================================
# 8. FASTAPI API ENDPOINTS TESTS
# =============================================================================

client = TestClient(app)

def test_api_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["engine_version"] == "pfz-v2"
    # Ensure no credentials leaked
    assert "password" not in str(data).lower()
    assert "secret" not in str(data).lower()


def test_api_version_endpoint():
    response = client.get("/version")
    assert response.status_code == 200
    data = response.json()
    assert data["engine"] == "pfz-v2"
    assert data["version"] == "2.0.0"
    assert len(data["citations"]) >= 2
    assert "Sarangi et al. (2024)" in str(data["citations"])


def test_api_analyze_input_validation():
    # Invalid latitude
    resp_lat = client.post("/analyze", json={"latitude": 105.0, "longitude": 72.8, "radius_km": 50})
    assert resp_lat.status_code == 400

    # Invalid radius
    resp_rad = client.post("/analyze", json={"latitude": 18.9, "longitude": 72.8, "radius_km": -10})
    assert resp_rad.status_code == 400


def test_api_analyze_live_execution():
    # Legitimate coastal query off Mumbai
    response = client.post("/analyze", json={"latitude": 18.92, "longitude": 72.83, "radius_km": 60})
    assert response.status_code == 200
    data = response.json()
    assert data["engine_version"] == "pfz-v2"
    assert "results" in data
    assert isinstance(data["results"], list)

    for cand in data["results"]:
        # Verify no numerical probability hallucination
        assert "confidence_score" not in cand
        assert "confidence_percentage" not in cand
        assert cand["classification"] in [
            "NO_SIGNAL",
            "LOW_POSSIBILITY",
            "MEDIUM_POSSIBILITY",
            "HIGH_POSSIBILITY",
            "MEDIUM_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE",
            "LOW_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE",
        ]
        # Verify distance is within radius
        assert cand["distance_nm"] * 1.852 <= 65.0

        # Verify structured Evidence Quality layer exists and contains no fake percentage
        assert "evidence_quality" in cand
        eq = cand["evidence_quality"]
        assert eq["co_occurrence_tier"] in [
            "NO_SIGNAL",
            "LOW_POSSIBILITY",
            "MEDIUM_POSSIBILITY",
            "HIGH_POSSIBILITY",
            "MEDIUM_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE",
            "LOW_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE",
        ]
        assert eq["chl_status"] in ["AVAILABLE", "MISSING", "CLOUD-AFFECTED"]
        assert eq["sst_status"] in ["AVAILABLE", "MISSING"]
        assert eq["ssh_sla_status"] in ["AVAILABLE", "COASTAL GAP", "MISSING"]
        assert eq["wind_status"] in ["AVAILABLE", "MISSING"]
        assert eq["current_status"] in ["AVAILABLE", "MISSING"]
        assert eq["persistence_status"] in ["HIGH", "LOW", "UNAVAILABLE"]
        assert "honesty_declaration" in eq
        assert "%" not in str(eq)


# =============================================================================
# 9. DATASET VALIDATION & REJECTION TESTS
# =============================================================================

def test_bgc_optics_rejected_as_chlorophyll(tmp_path):
    """
    CRITICAL AUDIT CORRECTION:
    cmems_obs-oc_glo_bgc-optics_nrt_l3-multi-4km_P1D contains BBP and CDM, NOT CHL.
    Verify that an optics dataset is never parsed as Chlorophyll-a.
    """
    import xarray as xr
    from pfz_engine.engine import ScientificPfzEngine

    # Create synthetic optics dataset matching cmems_obs-oc_glo_bgc-optics
    optics_path = tmp_path / "cmems_obs-oc_glo_bgc-optics_nrt_l3-multi-4km_P1D.nc"
    ds_optics = xr.Dataset(
        data_vars={
            "BBP": (["latitude", "longitude"], np.ones((5, 5)) * 0.002),
            "CDM": (["latitude", "longitude"], np.ones((5, 5)) * 0.05),
            "flags": (["latitude", "longitude"], np.zeros((5, 5), dtype=int)),
        },
        coords={
            "latitude": np.linspace(18.5, 19.5, 5),
            "longitude": np.linspace(72.0, 73.0, 5),
        }
    )
    ds_optics.to_netcdf(str(optics_path))

    engine = ScientificPfzEngine(data_cache_dir=str(tmp_path))
    loaded = engine.load_regional_datasets(18.5, 19.5, 72.0, 73.0)

    # Must NOT have loaded any chlorophyll grids
    assert len(loaded["chl_grids"]) == 0, "Optics BBP/CDM must NEVER be parsed as Chlorophyll-a"


def test_bgc_plankton_accepted_with_correct_units(tmp_path):
    """
    Verify that cmems_obs-oc_glo_bgc-plankton_nrt_l3-multi-4km_P1D
    with variable CHL in mg/m³ is correctly loaded.
    """
    import xarray as xr
    from pfz_engine.engine import ScientificPfzEngine

    plankton_path = tmp_path / "cmems_obs-oc_glo_bgc-plankton_nrt_l3-multi-4km_P1D.nc"
    ds_plankton = xr.Dataset(
        data_vars={
            "CHL": (["latitude", "longitude"], np.ones((5, 5)) * 0.45, {"units": "milligram m-3"}),
        },
        coords={
            "latitude": np.linspace(18.5, 19.5, 5),
            "longitude": np.linspace(72.0, 73.0, 5),
        }
    )
    ds_plankton.to_netcdf(str(plankton_path))

    engine = ScientificPfzEngine(data_cache_dir=str(tmp_path))
    loaded = engine.load_regional_datasets(18.5, 19.5, 72.0, 73.0)

    assert len(loaded["chl_grids"]) == 1
    assert math.isclose(loaded["chl_grids"][0][0, 0], 0.45)


def test_sst_kelvin_to_celsius_conversion(tmp_path):
    """Verify OSTIA analyzed_sst in Kelvin is accurately converted to Celsius"""
    import xarray as xr
    from pfz_engine.engine import ScientificPfzEngine

    sst_path = tmp_path / "METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2.nc"
    ds_sst = xr.Dataset(
        data_vars={
            "analysed_sst": (["latitude", "longitude"], np.ones((5, 5)) * 301.15, {"units": "kelvin"}),
        },
        coords={
            "latitude": np.linspace(18.5, 19.5, 5),
            "longitude": np.linspace(72.0, 73.0, 5),
        }
    )
    ds_sst.to_netcdf(str(sst_path))

    engine = ScientificPfzEngine(data_cache_dir=str(tmp_path))
    loaded = engine.load_regional_datasets(18.5, 19.5, 72.0, 73.0)

    assert loaded["sst"] is not None
    # 301.15 K - 273.15 = 28.0 °C
    assert math.isclose(loaded["sst"][0, 0], 28.0, abs_tol=1e-3)


# =============================================================================
# 10. MISSING WIND & ZERO-WIND PROHIBITION TESTS
# =============================================================================

def test_missing_wind_evaluates_to_unavailable_never_zero():
    """
    CRITICAL AUDIT RULE:
    When atmospheric wind is missing, do NOT substitute 0.0 m/s.
    Relative wind and Ekman persistence must evaluate to UNAVAILABLE.
    """
    # When wind is None
    u_c = np.array([[0.2]])
    v_c = np.array([[0.1]])

    u_rel, v_rel, rel_speed, rel_dir = compute_relative_wind(
        u_wind_ms=None,
        v_wind_ms=None,
        u_current_ms=u_c,
        v_current_ms=v_c
    )
    assert np.all(np.isnan(u_rel))
    assert np.all(np.isnan(v_rel))
    assert np.all(np.isnan(rel_speed))
    assert np.all(np.isnan(rel_dir))

    # Ekman persistence with None relative wind must evaluate to UNAVAILABLE
    rel_dir_scalar = float(rel_dir[0, 0]) if not np.isnan(rel_dir[0, 0]) else None
    assert rel_dir_scalar is None
    status, p_class, angle, _ = evaluate_ekman_persistence(rel_dir_scalar, front_orientation_deg=45.0)
    assert status == "UNAVAILABLE"
    assert p_class == "UNAVAILABLE"
    assert angle is None


def test_api_analyze_with_live_wind_forwarding():
    """Verify POST /analyze receives and uses wind parameters"""
    response = client.post("/analyze", json={
        "latitude": 18.92,
        "longitude": 72.83,
        "radius_km": 60,
        "wind_speed_ms": 6.5,
        "wind_direction_deg": 240.0,
    })
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    for cand in data["results"]:
        eq = cand["evidence_quality"]
        assert eq["wind_status"] == "AVAILABLE"


# =============================================================================
# 11. RED-TEAM CORRECTION VALIDATION TESTS
# =============================================================================

def test_flat_water_rejected_by_chl_gradient_floor():
    """
    RED-TEAM P0 FIX:
    Quantile thresholding in uniform waters triggers false edges on sensor noise.
    Verify min_gradient_floor rejects flat water noise.
    """
    from pfz_engine.fronts import detect_chl_fronts
    # Uniform water of 0.25 mg/m³ with negligible variation (noise ~ 1e-4)
    rng = np.random.RandomState(42)
    flat_noise = 0.25 + rng.uniform(-0.0001, 0.0001, size=(25, 25))
    front_mask, grad = detect_chl_fronts(flat_noise)

    # Must produce NO edges
    assert np.sum(front_mask) == 0, f"Expected 0 edges on flat water, got {np.sum(front_mask)}"


def test_bimodal_sst_front_detection():
    """
    RED-TEAM P1 FIX:
    Cayula & Cornillon (1992) bimodal histogram separability (theta >= 0.65).
    Verify a clear thermal front separating 27.5°C and 29.0°C water masses is detected.
    """
    from pfz_engine.fronts import detect_sst_fronts
    # 25x25 grid with a sharp front at column 12
    sst = np.full((25, 25), 27.5)
    sst[:, 13:] = 29.0  # 1.5°C step front

    front_mask, grad, orient = detect_sst_fronts(sst, dx_km=4.0, dy_km=4.0)
    assert np.any(front_mask), "Bimodal step front must be detected"
    # Gradient in front area should exceed min_grad (0.5 °C / 5km)
    assert np.nanmax(grad) >= 0.5


def test_native_resolution_provenance_in_evidence_quality():
    """
    RED-TEAM P1 FIX:
    Verify that 4-km regridded output explicitly documents native sensor resolutions
    and includes anti-false-precision disclaimer.
    """
    response = client.post("/analyze", json={"latitude": 18.92, "longitude": 72.83, "radius_km": 60})
    assert response.status_code == 200
    data = response.json()
    for cand in data["results"]:
        eq = cand["evidence_quality"]
        assert "native_resolutions" in eq
        assert "sst" in eq["native_resolutions"]
        assert "chlorophyll" in eq["native_resolutions"]
        assert "atmospheric_wind" in eq["native_resolutions"]
        assert "ocean_physics" in eq["native_resolutions"]
        assert eq["common_grid_resolution_km"] == 4.0
        assert eq["limiting_resolution_km"] == 25.0
        assert "does not increase the native spatial resolution" in eq["resolution_limitation_note"].lower()


def test_bidirectional_front_orientation_handles_180_deg_ambiguity():
    """
    RED-TEAM SPECIFIC ATTACK FIX:
    A front line is bidirectional (axis along isotherm theta and theta + 180°).
    Verify that an Ekman direction of 200° relative to a front line at 20°
    is recognized as parallel (diff = 0.0°), NOT opposite (diff = 180.0°).
    """
    # Front at 20°, Ekman vector at 200° (parallel along reverse axis)
    # Wind from 290° -> towards 110° -> Ekman 90° right = 200°
    status, p_class, angle_diff, ekman_dir = evaluate_ekman_persistence(
        rel_wind_dir_deg=290.0, front_orientation_deg=20.0
    )
    assert status == "AVAILABLE"
    assert math.isclose(ekman_dir, 200.0, abs_tol=1e-2)
    assert math.isclose(angle_diff, 0.0, abs_tol=1e-2), f"Expected 0.0° parallel, got {angle_diff}"
    assert p_class == "HIGH"


def test_perpendicular_ekman_evaluated_as_low_persistence():
    """
    Verify that an Ekman direction perpendicular to the front line (diff = 90.0°)
    evaluates to LOW persistence (> 40.0°).
    """
    # Front at 20°, Ekman vector at 110° (perpendicular to 20° axis)
    # Wind from 200° -> towards 20° -> Ekman 90° right = 110°
    status, p_class, angle_diff, ekman_dir = evaluate_ekman_persistence(
        rel_wind_dir_deg=200.0, front_orientation_deg=20.0
    )
    assert status == "AVAILABLE"
    assert math.isclose(ekman_dir, 110.0, abs_tol=1e-2)
    assert math.isclose(angle_diff, 90.0, abs_tol=1e-2)
    assert p_class == "LOW"


def test_nearshore_optical_interpretation_caveat():
    """
    Verify that candidates nearshore (< 20 km) carry optical_interpretation_caveat
    flagging potential coastal turbidity and sediment plume contamination.
    """
    response = client.post("/analyze", json={"latitude": 18.92, "longitude": 72.83, "radius_km": 25})
    assert response.status_code == 200
    data = response.json()
    for cand in data["results"]:
        eq = cand["evidence_quality"]
        dist_km = cand["distance_nm"] * 1.852
        if dist_km < 20.0:
            assert eq["optical_interpretation_caveat"] is not None
            assert "turbidity" in eq["optical_interpretation_caveat"].lower()


# =============================================================================
# 12. FOUR-DIMENSION SCIENTIFIC HARDENING & HOSTILE JUDGE TESTS
# =============================================================================

def test_four_dimensions_and_traceability_present():
    """
    Verify the 4 distinct scientific dimensions are populated on every candidate:
    Dimension A: data_quality
    Dimension B: feature_strength
    Dimension C: algorithm_stability
    Dimension D: biological_validation
    Plus parameter traceability entries.
    """
    response = client.post("/analyze", json={"latitude": 18.92, "longitude": 72.83, "radius_km": 60})
    assert response.status_code == 200
    data = response.json()
    assert data["biological_validation_status"] == "BIOLOGICAL_VALIDATION_NOT_ESTABLISHED"

    for cand in data["results"]:
        # Dimension A: Data Quality
        assert "data_quality" in cand and cand["data_quality"] is not None
        dq = cand["data_quality"]
        assert dq["status"] in ["EXCELLENT", "GOOD", "LIMITED", "POOR", "INSUFFICIENT"]
        assert len(dq["reasons"]) > 0
        assert 0.0 <= dq["sensor_coverage_fraction"] <= 1.0

        # Dimension B: Feature Strength
        assert "feature_strength" in cand and cand["feature_strength"] is not None
        fs = cand["feature_strength"]
        assert fs["status"] in [
            "STRONG_MULTI_FACTOR_EVIDENCE",
            "MODERATE_MULTI_FACTOR_EVIDENCE",
            "LIMITED_EVIDENCE",
            "INSUFFICIENT_EVIDENCE",
        ]
        assert "chlorophyll" in fs["features"]
        assert "sst_front" in fs["features"]
        assert "eddy_like_anomaly" in fs["features"]
        assert "current_support" in fs["features"]
        assert "wind_support" in fs["features"]
        for feat, val in fs["features"].items():
            assert val in ["PRESENT", "ABSENT", "UNKNOWN"], f"Feature {feat} had invalid state {val}"

        # Dimension C: Algorithm Stability
        assert "algorithm_stability" in cand and cand["algorithm_stability"] is not None
        as_ = cand["algorithm_stability"]
        assert as_["status"] in ["STABLE", "ACCEPTABLE", "FRAGILE", "INSUFFICIENT_DATA"]
        assert len(as_["reasons"]) > 0

        # Dimension D: Biological Validation
        assert "biological_validation" in cand and cand["biological_validation"] is not None
        bv = cand["biological_validation"]
        assert bv["status"] == "BIOLOGICAL_VALIDATION_NOT_ESTABLISHED"
        assert bv["sample_count"] == 0
        assert "fish presence is not directly observed" in bv["disclaimer"].lower()

        # Parameter Traceability
        assert "traceability" in cand and isinstance(cand["traceability"], list)
        assert len(cand["traceability"]) >= 5
        for t in cand["traceability"]:
            assert t["threshold_type"] in ["LITERATURE_SUPPORTED", "OPERATIONAL_PROTOCOL", "ENGINEERING_CHOICE"]
            assert len(t["source_citation"]) > 0


def test_prohibition_of_fish_probability_and_percentages():
    """
    CRITICAL SCIENTIFIC DEFENSE RULE:
    No candidate may output fish probability, confidence percentages, or claim
    biological accuracy without ground-truth catch logs.
    """
    response = client.post("/analyze", json={
        "latitude": 18.92,
        "longitude": 72.83,
        "radius_km": 80,
        "wind_speed_ms": 7.0,
        "wind_direction_deg": 250.0,
    })
    assert response.status_code == 200
    data = response.json()
    resp_str = str(data).lower()

    # Must NOT contain phrases implying fish certainty
    forbidden = [
        "fish probability",
        "probability of fish",
        "fish confidence",
        "chance of fish",
        "guaranteed fishing zone",
        "predicted fish location",
    ]
    for phrase in forbidden:
        assert phrase not in resp_str, f"Forbidden phrase found in response: '{phrase}'"


def test_distinguish_unknown_from_absent_in_features():
    """
    Verify that when eddy SLA or wind is missing, the feature vector explicitly
    returns UNKNOWN rather than ABSENT.
    """
    # Query without providing wind
    response = client.post("/analyze", json={"latitude": 18.92, "longitude": 72.83, "radius_km": 60})
    assert response.status_code == 200
    data = response.json()
    for cand in data["results"]:
        fs = cand["feature_strength"]
        # Since wind was not provided, wind_support must evaluate to UNKNOWN, not ABSENT
        assert fs["features"]["wind_support"] == "UNKNOWN"
        # Persistence must be UNAVAILABLE
        assert fs["persistence_evaluation"] == "UNAVAILABLE"


def test_validation_protocol_schema():
    """
    Verify the biological validation schema and matching protocol function.
    Must handle forecast and observation matching deterministically.
    """
    from datetime import datetime, timezone
    from pfz_engine.validation import (
        FishingObservation,
        PfzForecastRecord,
        match_forecast_with_observations,
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    forecasts = [
        PfzForecastRecord(
            candidate_id="cand_1",
            forecast_timestamp_iso=now_iso,
            latitude=18.95,
            longitude=72.75,
            classification_tier="HIGH_POSSIBILITY",
            feature_strength="STRONG_MULTI_FACTOR_EVIDENCE",
            chlorophyll_mg_m3=0.45,
            sst_celsius=28.2,
        )
    ]
    observations = [
        FishingObservation(
            vessel_id="IND-MH-01-0023",
            timestamp_iso=now_iso,
            latitude=18.96,
            longitude=72.76,
            gear_type="trawl",
            target_species="Rastrelliger kanagurta",
            total_catch_kg=450.0,
            effort_hours=4.0,
            cpue_kg_per_hour=112.5,
            data_provider="State Fisheries Survey",
        )
    ]

    summary = match_forecast_with_observations(forecasts, observations, spatial_tolerance_km=15.0)
    assert summary.sample_count == 1
    assert summary.matched_hauls_count == 1
    assert summary.status == "BIOLOGICAL_VALIDATION_NOT_ESTABLISHED"
    assert summary.mean_cpue_in_pfz == 112.5






