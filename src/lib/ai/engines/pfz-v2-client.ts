/**
 * Client adapter for SagarDrishti Scientific PFZ Engine v2 (FastAPI Service).
 *
 * SAFETY PRINCIPLES:
 * - Robust timeout handling (defaults to 5000ms).
 * - Graceful degradation: If Python service is temporarily offline or unavailable,
 *   returns an explicit status="unavailable" rather than crashing or faking data.
 * - Never leaks credentials or secrets.
 * - Feature flag controlled via process.env.PFZ_ENGINE_V2 === "true".
 */

export interface PfzV2FeatureFlags {
  high_chlorophyll: boolean;
  sst_front: boolean;
  chl_front: boolean;
  front_present: boolean;
  cyclonic_eddy: boolean | null;
  eddy_evidence_status: "available" | "unavailable" | "invalid";
}

export interface PfzV2DataEvidence {
  sst_timestamp: string | null;
  chl_timestamp: string | null;
  sla_timestamp: string | null;
  current_timestamp: string | null;
  cloud_affected: boolean;
  eddy_data_available: boolean;
  composite_window_days: number;
}

export interface PfzV2Freshness {
  age_hours: number;
  status: "FRESH" | "PERSISTED — 24–72h" | "INSUFFICIENT EVIDENCE";
  policy_citation: string;
}

export interface PfzV2Persistence {
  status: "AVAILABLE" | "UNAVAILABLE";
  classification: "HIGH" | "LOW" | "UNAVAILABLE";
  angle_to_front_deg: number | null;
  ekman_direction_deg?: number | null;
  relative_wind_speed_ms: number | null;
  relative_wind_dir_deg: number | null;
}

export interface PfzV2DataQualityAssessment {
  status: "EXCELLENT" | "GOOD" | "LIMITED" | "POOR" | "INSUFFICIENT";
  reasons: string[];
  sensor_coverage_fraction: number;
  freshness_category: string;
  limiting_resolution_km: number;
  optical_turbidity_risk: boolean;
}

export interface PfzV2OceanographicFeatureStrength {
  status:
    | "STRONG_MULTI_FACTOR_EVIDENCE"
    | "MODERATE_MULTI_FACTOR_EVIDENCE"
    | "LIMITED_EVIDENCE"
    | "INSUFFICIENT_EVIDENCE";
  detected_count: number;
  total_evaluated: number;
  features: Record<string, "PRESENT" | "ABSENT" | "UNKNOWN">;
  persistence_evaluation: "HIGH" | "LOW" | "UNAVAILABLE";
}

export interface PfzV2AlgorithmStability {
  status: "STABLE" | "ACCEPTABLE" | "FRAGILE" | "INSUFFICIENT_DATA";
  reasons: string[];
  otsu_bimodal_verified: boolean;
  gradient_floor_exceeded: boolean;
  missing_data_fraction: number;
}

export interface PfzV2BiologicalValidationStatus {
  status: "BIOLOGICAL_VALIDATION_NOT_ESTABLISHED" | "VALIDATED";
  ground_truth_source: string | null;
  validation_period: string | null;
  validation_region: string | null;
  sample_count: number;
  methodology: string | null;
  disclaimer: string;
}

export interface PfzV2ParameterTraceability {
  parameter: string;
  threshold: string;
  threshold_type: "LITERATURE_SUPPORTED" | "OPERATIONAL_PROTOCOL" | "ENGINEERING_CHOICE";
  source_citation: string;
}

export interface PfzV2EvidenceQuality {
  co_occurrence_tier:
    | "NO_SIGNAL"
    | "LOW_POSSIBILITY"
    | "MEDIUM_POSSIBILITY"
    | "HIGH_POSSIBILITY"
    | "MEDIUM_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE"
    | "LOW_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE";
  chl_status: "AVAILABLE" | "MISSING" | "CLOUD-AFFECTED";
  sst_status: "AVAILABLE" | "MISSING";
  ssh_sla_status: "AVAILABLE" | "COASTAL GAP" | "MISSING";
  wind_status: "AVAILABLE" | "MISSING";
  current_status: "AVAILABLE" | "MISSING";
  freshness_hours: number | null;
  freshness_status: "FRESH" | "PERSISTED — 24–72h" | "INSUFFICIENT EVIDENCE";
  persistence_status: "HIGH" | "LOW" | "UNAVAILABLE";
  source_datasets: Record<string, string>;
  native_resolutions?: Record<string, string>;
  common_grid_resolution_km?: number;
  limiting_resolution_km?: number;
  optical_interpretation_caveat?: string | null;
  resolution_limitation_note?: string;
  data_quality_assessment?: PfzV2DataQualityAssessment;
  feature_strength_assessment?: PfzV2OceanographicFeatureStrength;
  algorithm_stability?: PfzV2AlgorithmStability;
  biological_validation?: PfzV2BiologicalValidationStatus;
  honesty_declaration: string;
}

export interface PfzV2Candidate {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance_nm: number;
  bearing: string;
  classification:
    | "NO_SIGNAL"
    | "LOW_POSSIBILITY"
    | "MEDIUM_POSSIBILITY"
    | "HIGH_POSSIBILITY"
    | "MEDIUM_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE"
    | "LOW_POSSIBILITY_WITH_INCOMPLETE_EDDY_EVIDENCE";
  feature_count: number;
  features: PfzV2FeatureFlags;
  data_evidence: PfzV2DataEvidence;
  freshness: PfzV2Freshness;
  persistence: PfzV2Persistence;
  evidence_quality?: PfzV2EvidenceQuality;
  data_quality?: PfzV2DataQualityAssessment;
  feature_strength?: PfzV2OceanographicFeatureStrength;
  algorithm_stability?: PfzV2AlgorithmStability;
  biological_validation?: PfzV2BiologicalValidationStatus;
  traceability?: PfzV2ParameterTraceability[];
  explanation: string[];
  sea_surface_temperature_c?: number | null;
  chlorophyll_a_mg_m3?: number | null;
  surface_current_speed_ms?: number | null;
  surface_current_direction_deg?: number | null;
  atmospheric_wind_speed_ms?: number | null;
  atmospheric_wind_direction_deg?: number | null;
}

export interface PfzV2AnalyzeResult {
  status: "available" | "unavailable";
  engineVersion: string;
  biologicalValidationStatus?: "BIOLOGICAL_VALIDATION_NOT_ESTABLISHED" | "VALIDATED";
  methodology?: Record<string, string>;
  userLocation?: {
    latitude: number;
    longitude: number;
    radius_km: number;
  };
  candidates: PfzV2Candidate[];
  error?: string;
}


export async function queryPfzV2Service(params: {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  referencePortName?: string;
  windSpeedMs?: number | null;
  windDirectionDeg?: number | null;
  uWindMs?: number | null;
  vWindMs?: number | null;
  timeoutMs?: number;
}): Promise<PfzV2AnalyzeResult> {
  const serviceUrl = process.env.PFZ_SERVICE_URL || "http://127.0.0.1:8000";
  const timeoutMs = params.timeoutMs || 15000;
  const radiusKm = params.radiusKm || 100;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${serviceUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: params.latitude,
        longitude: params.longitude,
        radius_km: radiusKm,
        reference_port_name: params.referencePortName,
        wind_speed_ms: params.windSpeedMs ?? null,
        wind_direction_deg: params.windDirectionDeg ?? null,
        u_wind_ms: params.uWindMs ?? null,
        v_wind_ms: params.vWindMs ?? null,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        status: "unavailable",
        engineVersion: "pfz-v2",
        candidates: [],
        error: `Python PFZ service HTTP ${res.status}: ${errText.slice(0, 100)}`,
      };
    }

    const data = await res.json();
    return {
      status: "available",
      engineVersion: data.engine_version || "pfz-v2",
      methodology: data.methodology,
      userLocation: data.user_location,
      candidates: data.results || [],
    };
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError" || err?.message?.includes("aborted");
    return {
      status: "unavailable",
      engineVersion: "pfz-v2",
      candidates: [],
      error: isTimeout
        ? `PFZ scientific service request timed out after ${timeoutMs}ms`
        : `PFZ scientific service unreachable at ${serviceUrl}: ${err?.message || "connection failed"}`,
    };
  }
}
