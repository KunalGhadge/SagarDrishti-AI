"""
Data models and schemas for the Ocean Feature Co-occurrence PFZ Engine.
Strict Pydantic v2 data contracts enforcing scientific transparency.
"""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class FeatureDetectionResult(BaseModel):
    """
    Oceanographic feature detection flags evaluated at a specific grid cell.
    Maintains the raw scientific flags C, F (SST/CHL), and E.
    """
    high_chlorophyll: bool = Field(
        ...,
        description="True if Chlorophyll-a > 0.1 mg/m³ (Sarangi et al. 2024 threshold)"
    )
    sst_front: bool = Field(
        ...,
        description="True if Cayula & Cornillon thermal front detected in SST"
    )
    chl_front: bool = Field(
        ...,
        description="True if Canny edge front detected in 3-day chlorophyll composite"
    )
    front_present: bool = Field(
        ...,
        description="True if sst_front OR chl_front is detected"
    )
    cyclonic_eddy: Optional[bool] = Field(
        None,
        description="True if cyclonic upwelling eddy present; False if anti-cyclonic; None if altimetry/SLA data unavailable"
    )
    eddy_evidence_status: Literal["available", "unavailable", "invalid"] = Field(
        "available",
        description="Indicates whether SLA altimetry is valid, unavailable (e.g. coastal altimetry gap), or invalid"
    )


class DataEvidence(BaseModel):
    """
    Scientific evidence metadata tracking data sources, timestamps, and cloud masking.
    """
    sst_timestamp: Optional[str] = None
    chl_timestamp: Optional[str] = None
    sla_timestamp: Optional[str] = None
    wind_timestamp: Optional[str] = None
    current_timestamp: Optional[str] = None

    cloud_affected: bool = False
    eddy_data_available: bool = True
    composite_window_days: int = 3
    available_observations: int = 1
    missing_observations: int = 0


class FreshnessMetadata(BaseModel):
    """
    Freshness status evaluating data age against engineering policies.
    """
    age_hours: float
    status: Literal["FRESH", "PERSISTED — 24–72h", "INSUFFICIENT EVIDENCE"]
    policy_citation: str = "SagarDrishti Engineering Operational Policy: <24h Fresh, 24-72h Persisted, >72h Insufficient Evidence"


class PersistenceMetadata(BaseModel):
    """
    Persistence layer derived from Relative Wind and Ekman transport alignment with ocean fronts.
    """
    status: Literal["AVAILABLE", "UNAVAILABLE"]
    classification: Literal["HIGH", "LOW", "UNAVAILABLE"]
    angle_to_front_deg: Optional[float] = None
    ekman_direction_deg: Optional[float] = None
    relative_wind_speed_ms: Optional[float] = None
    relative_wind_dir_deg: Optional[float] = None
    derivation_lineage: str = "Operational Methodology Derived: INCOIS/MOSDAC 40° Ekman-Front Alignment Rule (Jishad et al. lineage)"


class DataQualityAssessment(BaseModel):
    """
    Dimension A: Observation Completeness and Trustworthiness.
    Answers: How complete and trustworthy are the physical observations available for this candidate?
    Deterministic categorical states: EXCELLENT | GOOD | LIMITED | POOR | INSUFFICIENT
    Derived ONLY from observable properties with explicit explanatory reasons.
    """
    status: Literal["EXCELLENT", "GOOD", "LIMITED", "POOR", "INSUFFICIENT"]
    reasons: List[str]
    sensor_coverage_fraction: float
    freshness_category: str
    limiting_resolution_km: float = 25.0
    optical_turbidity_risk: bool = False


class OceanographicFeatureStrength(BaseModel):
    """
    Dimension B: Detected Oceanographic Feature Strength.
    Answers: How many independent environmental signals were actually detected?
    Explicit deterministic evidence vector. Never probability or percentage.
    """
    status: Literal[
        "STRONG_MULTI_FACTOR_EVIDENCE",
        "MODERATE_MULTI_FACTOR_EVIDENCE",
        "LIMITED_EVIDENCE",
        "INSUFFICIENT_EVIDENCE"
    ]
    detected_count: int
    total_evaluated: int = 5
    features: Dict[str, Literal["PRESENT", "ABSENT", "UNKNOWN"]]
    persistence_evaluation: Literal["HIGH", "LOW", "UNAVAILABLE"]


class AlgorithmStability(BaseModel):
    """
    Dimension C: Computational & Algorithmic Stability.
    Answers: Did the deterministic algorithm produce a stable result from valid inputs?
    Status: STABLE | ACCEPTABLE | FRAGILE | INSUFFICIENT_DATA
    """
    status: Literal["STABLE", "ACCEPTABLE", "FRAGILE", "INSUFFICIENT_DATA"]
    reasons: List[str]
    otsu_bimodal_verified: bool = False
    gradient_floor_exceeded: bool = False
    missing_data_fraction: float = 0.0


class BiologicalValidationStatus(BaseModel):
    """
    Dimension D: Biological Validation Status.
    Strictly declared as BIOLOGICAL_VALIDATION_NOT_ESTABLISHED until independent,
    georeferenced fisheries catch logs or CPUE data are empirically verified.
    """
    status: Literal["BIOLOGICAL_VALIDATION_NOT_ESTABLISHED", "VALIDATED"] = "BIOLOGICAL_VALIDATION_NOT_ESTABLISHED"
    ground_truth_source: Optional[str] = None
    validation_period: Optional[str] = None
    validation_region: Optional[str] = None
    sample_count: int = 0
    methodology: Optional[str] = None
    disclaimer: str = (
        "Production biological validation requires independent georeferenced fisheries catch logs or CPUE data. "
        "The current system identifies oceanographic environmental suitability only; fish presence is not directly observed."
    )


class ParameterTraceability(BaseModel):
    """
    Audit trace linking an oceanographic parameter to peer-reviewed literature or operational protocol.
    """
    parameter: str
    threshold: str
    threshold_type: Literal["LITERATURE_SUPPORTED", "OPERATIONAL_PROTOCOL", "ENGINEERING_CHOICE"]
    source_citation: str


class EvidenceQuality(BaseModel):
    """
    Structured scientific evidence quality evaluation communicating confidence
    without arbitrary probability percentages across the 4 core dimensions.
    """
    co_occurrence_tier: Literal[
        "NO_SIGNAL",
        "LOW_POSSIBILITY",
        "MEDIUM_POSSIBILITY",
        "HIGH_POSSIBILITY",
        "MEDIUM_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE",
        "LOW_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE"
    ]
    chl_status: Literal["AVAILABLE", "MISSING", "CLOUD-AFFECTED"]
    sst_status: Literal["AVAILABLE", "MISSING"]
    ssh_sla_status: Literal["AVAILABLE", "COASTAL GAP", "MISSING"]
    wind_status: Literal["AVAILABLE", "MISSING"]
    current_status: Literal["AVAILABLE", "MISSING"]
    freshness_hours: Optional[float] = None
    freshness_status: Literal["FRESH", "PERSISTED — 24–72h", "INSUFFICIENT EVIDENCE"]
    persistence_status: Literal["HIGH", "LOW", "UNAVAILABLE"]
    source_datasets: Dict[str, str] = Field(
        default_factory=dict,
        description="Traceable mapping of observed variable to source Copernicus dataset ID"
    )
    native_resolutions: Dict[str, str] = Field(
        default_factory=lambda: {
            "sst": "~5 km (0.05°)",
            "chlorophyll": "~4 km (0.04°)",
            "ocean_physics": "~9 km (0.083°)",
            "atmospheric_wind": "~25 km (0.25°)"
        },
        description="Native spatial resolution of each underlying sensor or model dataset"
    )
    common_grid_resolution_km: float = Field(
        4.0,
        description="Co-registration grid cell spacing (km)"
    )
    limiting_resolution_km: float = Field(
        25.0,
        description="Physical spatial resolution limit imposed by coarsest input layer (atmospheric wind ~25 km)"
    )
    optical_interpretation_caveat: Optional[str] = Field(
        None,
        description="Caveat for nearshore turbidity, river discharge, sediment plumes, or optical contamination"
    )
    resolution_limitation_note: str = Field(
        "Output is co-registered onto a 4-km grid lattice. This does NOT increase the native spatial resolution of atmospheric wind (~25 km) or ocean physics (~9 km).",
        description="Explicit notice against false precision interpretation"
    )
    data_quality_assessment: Optional[DataQualityAssessment] = None
    feature_strength_assessment: Optional[OceanographicFeatureStrength] = None
    algorithm_stability: Optional[AlgorithmStability] = None
    biological_validation: BiologicalValidationStatus = Field(default_factory=BiologicalValidationStatus)
    honesty_declaration: str = "Evidence Quality is categorical and based on verified physical sensor observations. No statistical probability percentages. Assesses oceanographic suitability for pelagic aggregation, not fish presence."


class PfzCandidate(BaseModel):
    """
    Structured candidate potential fishing zone suitability output.
    Zero fake confidence percentages. Deterministic, traceable scientific reasoning.
    Indicates oceanographic conditions favorable for pelagic aggregation (C+F+E).
    """
    id: str
    name: str
    latitude: float
    longitude: float
    distance_nm: float
    bearing: str

    classification: Literal[
        "NO_SIGNAL",
        "LOW_POSSIBILITY",
        "MEDIUM_POSSIBILITY",
        "HIGH_POSSIBILITY",
        "MEDIUM_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE",
        "LOW_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE"
    ]
    feature_count: int

    features: FeatureDetectionResult
    data_evidence: DataEvidence
    freshness: FreshnessMetadata
    persistence: PersistenceMetadata
    evidence_quality: EvidenceQuality

    data_quality: Optional[DataQualityAssessment] = None
    feature_strength: Optional[OceanographicFeatureStrength] = None
    algorithm_stability: Optional[AlgorithmStability] = None
    biological_validation: BiologicalValidationStatus = Field(default_factory=BiologicalValidationStatus)
    traceability: List[ParameterTraceability] = Field(default_factory=list)

    explanation: List[str]

    sea_surface_temperature_c: Optional[float] = None
    chlorophyll_a_mg_m3: Optional[float] = None
    surface_current_speed_ms: Optional[float] = None
    surface_current_direction_deg: Optional[float] = None
    atmospheric_wind_speed_ms: Optional[float] = None
    atmospheric_wind_direction_deg: Optional[float] = None


class AnalyzeRequest(BaseModel):
    """Request payload for PFZ analysis around a user coordinate or port."""
    latitude: float
    longitude: float
    radius_km: float = 100.0
    target_date: Optional[str] = None
    reference_port_name: Optional[str] = None
    # Real atmospheric wind coupling (from live weather models / ECMWF IFS)
    wind_speed_ms: Optional[float] = Field(None, description="Surface wind speed in m/s")
    wind_direction_deg: Optional[float] = Field(None, description="Meteorological wind direction (from which wind blows, 0-360°)")
    u_wind_ms: Optional[float] = Field(None, description="Eastward surface wind component in m/s")
    v_wind_ms: Optional[float] = Field(None, description="Northward surface wind component in m/s")


class AnalyzeResponse(BaseModel):
    """Standardized response from the scientific PFZ engine."""
    engine_version: str = "pfz-v2"
    biological_validation_status: Literal["BIOLOGICAL_VALIDATION_NOT_ESTABLISHED", "VALIDATED"] = "BIOLOGICAL_VALIDATION_NOT_ESTABLISHED"
    methodology: Dict[str, str] = {
        "primary": "Sarangi et al. (2024), Environmental Monitoring and Assessment, 196:98",
        "supporting": "Jishad et al. (2019/2021), Journal of Operational Oceanography, 14(1), 59–70",
        "operational": "INCOIS / MOSDAC Potential Fishing Zone Advisory operational procedures",
        "honesty_declaration": "Classifications are categorical co-occurrences (C+F+E). No statistical percentages or ML predictions."
    }
    user_location: Dict[str, Any]
    results: List[PfzCandidate]
    count: int
    execution_time_ms: float

