# SagarDrishti AI: PFZ Biological Validation Protocol & Empirical Schema

## 1. Scientific Status Statement
```
CURRENT STATUS: BIOLOGICAL_VALIDATION_NOT_ESTABLISHED
```
SagarDrishti AI identifies **favorable oceanographic conditions historically correlated with pelagic aggregation**. The system does not directly observe fish biomass via satellite. Declaring operational biological predictive accuracy requires empirical co-location with georeferenced vessel catch logs (CPUE) collected across multiple seasons and gear types.

This document defines the formal protocol, data contract, and statistical thresholds necessary to transition the system from `BIOLOGICAL_VALIDATION_NOT_ESTABLISHED` to `VALIDATED`.

---

## 2. Validation Architecture & Schema

The engine defines a decoupled validation interface in `pfz_engine/validation.py`.

### A. Fishing Haul Observation Schema (`FishingObservation`)
Collected via vessel electronic logbooks (e.g., SagarDrishti onboard logger, CMFRI marine fish landings survey, or State Fisheries digital receipts):
```python
class FishingObservation(BaseModel):
    vessel_id: str                      # Registered marine vessel ID
    latitude: float                     # GPS latitude of fishing haul (-90 to 90)
    longitude: float                    # GPS longitude of fishing haul (-180 to 180)
    timestamp_iso: str                  # Haul start timestamp (UTC ISO-8601)
    gear_type: str                      # Trawl / Ring Seine / Gillnet / Hook & Line
    target_species: Optional[str]       # Scientific or commercial species name (e.g., Rastrelliger kanagurta)
    total_catch_kg: Optional[float]     # Total landed catch weight (kg)
    effort_hours: Optional[float]       # Trawling/soaking duration in hours
    cpue_kg_per_hour: Optional[float]   # Catch Per Unit Effort (kg/hour)
    data_provider: str                  # CMFRI / State Fisheries / Cooperative
```

### B. Forecast Candidate Record (`PfzForecastRecord`)
Logged at the time of advisory generation:
```python
class PfzForecastRecord(BaseModel):
    candidate_id: str                   # Unique forecast identifier
    latitude: float                     # Predicted zone centroid latitude
    longitude: float                    # Predicted zone centroid longitude
    forecast_timestamp_iso: str         # Advisory release timestamp (UTC ISO-8601)
    classification_tier: str            # HIGH_POSSIBILITY / MEDIUM_POSSIBILITY
    feature_strength: str               # STRONG_MULTI_FACTOR_EVIDENCE / MODERATE
    chlorophyll_mg_m3: Optional[float]  # Satellite Chlorophyll-a observation
    sst_celsius: Optional[float]        # Satellite SST observation
```

---

## 3. Spatio-Temporal Matching Protocol

To establish whether an empirical fishing haul occurred within an active PFZ:

1. **Spatial Tolerance Radius**: $\Delta r \le 15.0\text{ km}$ ($\approx 8.1\text{ NM}$).
   - Rationale: Accounts for 4-km co-registration grid spacing, spatial extent of ocean fronts (typically 5–15 km width), and vessel drift during gear deployment.
2. **Temporal Tolerance Window**: $\Delta t \le 24.0\text{ hours}$.
   - Rationale: Mesoscale features and thermal fronts persist over 24 to 72 hours under favorable Ekman transport alignment. Matches exceeding 24 hours are rejected from primary validation.
3. **Control (Non-PFZ) Sampling**: Hauls occurring $> 30\text{ km}$ away from any detected front or eddy during the same 24-hour window are categorized as control hauls (outside PFZ).

---

## 4. Required Statistical Metrics for Scientific Defensibility

To satisfy peer-review and fisheries research scrutiny, the following metrics must be evaluated:

### 1. CPUE Ratio ($\text{CPUE}_\text{ratio}$)
$$\text{CPUE}_\text{ratio} = \frac{\overline{\text{CPUE}}_{\text{PFZ}}}{\overline{\text{CPUE}}_{\text{Non-PFZ}}}$$
- **Benchmark in Literature**: INCOIS operational studies report typical CPUE ratios of **$2.0\times$ to $3.8\times$** for pelagic schooling fishes (e.g. Indian mackerel, oil sardine, skipjack tuna).
- **Threshold for SagarDrishti Validation**: $\text{CPUE}_\text{ratio} \ge 1.5$ with statistical significance ($p < 0.05$ via two-tailed Student's $t$-test or Mann–Whitney $U$-test).

### 2. Sample Size Minimum ($N$)
- **P0 Rule**: A validation status of `VALIDATED` requires a minimum of **$N \ge 30$ independent, verified fishing hauls** across at least 2 distinct monsoon/inter-monsoon seasons.
- If $N < 30$, the system automatically reports:
  `VALIDATION_DATA_RECORDED_PENDING_STATISTICAL_POWER` (or `BIOLOGICAL_VALIDATION_NOT_ESTABLISHED`).

### 3. Hit Rate & Reliability Index
- **Hit Rate**: Fraction of advised PFZ zones that yielded above-median CPUE when fished:
  $$\text{Hit Rate} = \frac{\text{True Positives}}{\text{True Positives} + \text{False Positives}}$$

---

## 5. Summary: Path to Production Validation

| Stage | Data Required | Engine Status |
| :--- | :--- | :--- |
| **Current (Release v2)** | Real Copernicus SST, CHL, Physics + live ECMWF wind | `BIOLOGICAL_VALIDATION_NOT_ESTABLISHED` |
| **Stage 1: Pilot Logger** | 1–29 onboard digital hauls with GPS & catch weight | `BIOLOGICAL_VALIDATION_NOT_ESTABLISHED (Data Logged: N/30)` |
| **Stage 2: Multi-Season Trial** | $\ge 30$ hauls matched across pre- and post-monsoon | `VALIDATED (CPUE Ratio = X.X, p < 0.05)` |
