# SagarDrishti AI: Scientific Confidence & Evidence Model

## Executive Scientific Axiom
```
DATA QUALITY  ≠  ALGORITHM STABILITY  ≠  OCEANOGRAPHIC EVIDENCE  ≠  BIOLOGICAL VALIDATION  ≠  FISH PROBABILITY
```
In operational oceanography and fisheries science, conflating physical sensor evidence with biological presence or predictive probability is a fundamental methodological error. SagarDrishti AI strictly prohibits outputting arbitrary percentages (e.g., "82% chance of fish" or "85% confidence") because no calibrated, multi-season empirical catch-rate probability function exists for satellite multi-sensor co-occurrence in the Indian EEZ.

Instead, SagarDrishti AI decouples scientific confidence into **four independent, deterministic, auditable dimensions**.

---

## Dimension A: Data / Evidence Quality
**Core Question Answered**: *"How complete, fresh, and physically trustworthy are the observations available for this candidate location?"*

### State Space
Categorical and deterministic:
- `EXCELLENT`: All 5 primary observation layers (SST, Chlorophyll-a, Surface Currents, Atmospheric Wind, Altimetric SLA) are available, fresh (< 24 hours), cloud-free, and offshore.
- `GOOD`: $\ge 4$ observation layers available with verified freshness (< 72 hours) and minimal interpolation.
- `LIMITED`: 2 to 3 observation layers available (e.g., candidate is within the 35-km coastal altimetry gap where SLA is unavailable, or atmospheric wind coupling is absent).
- `POOR`: Only 1 physical layer available, or data age exceeds 72 hours (stale observations).
- `INSUFFICIENT`: Zero valid marine observation layers (e.g., total cloud masking across optical and thermal sensors).

### Observable Properties Evaluated
1. **Sensor Availability**: Explicit Boolean status for SST (OSTIA L4), Chlorophyll-a (GlobColour L3 Plankton), Ocean Physics ($u_o, v_o, z_{os}$), and Atmospheric Wind (ECMWF IFS).
2. **Freshness Window**: Evaluated against operational standards (<24h Fresh, 24–72h Persisted, >72h Insufficient Evidence).
3. **Cloud & Optical Masking**: Detects missing pixels and optical flags.
4. **Coastal Altimetry Degradation**: Flags candidates within 35 km of land where radar altimeter waveforms suffer land contamination.
5. **Nearshore Turbidity & River Plumes**: Explicit caveat when depth/distance < 20 km or optical chlorophyll exceeds 5.0 mg/m³, indicating suspended sediment rather than phytoplankton biomass.
6. **Resolution Provenance**: Propagates native sensor resolutions (SST ~5 km, CHL ~4 km, Physics ~9 km, Wind ~25 km) and enforces that 4-km co-registration does NOT imply 4-km predictive resolution.

---

## Dimension B: Oceanographic Feature Strength
**Core Question Answered**: *"How many independent environmental physical/biological boundary signals were detected co-occurring at this location?"*

### Evidence Vector
Features are evaluated strictly as `PRESENT`, `ABSENT`, or `UNKNOWN` (preserving observational uncertainty rather than assuming absence):
```yaml
features:
  chlorophyll: PRESENT | ABSENT | UNKNOWN
  sst_front: PRESENT | ABSENT | UNKNOWN
  eddy_like_anomaly: PRESENT | ABSENT | UNKNOWN
  current_support: PRESENT | ABSENT | UNKNOWN
  wind_support: PRESENT | ABSENT | UNKNOWN
persistence: HIGH | LOW | UNAVAILABLE
```

### Derived Categorical Classifications
- `STRONG_MULTI_FACTOR_EVIDENCE`: $\ge 3$ independent signals detected co-occurring (e.g., High Chlorophyll + Thermal Front + Cyclonic Eddy Anomaly) with persistence $\ne$ `LOW`.
- `MODERATE_MULTI_FACTOR_EVIDENCE`: 2 independent signals detected co-occurring (e.g., High Chlorophyll + Thermal Front, with eddy unknown due to coastal gap).
- `LIMITED_EVIDENCE`: Only 1 feature detected (e.g., isolated chlorophyll patch or isolated thermal gradient).
- `INSUFFICIENT_EVIDENCE`: Zero significant physical or optical boundaries detected.

---

## Dimension C: Algorithm / Computational Stability
**Core Question Answered**: *"Did the deterministic image processing and gradient algorithms produce a stable, noise-rejected mathematical result from the input arrays?"*

### Objective Algorithmic Criteria
1. **Otsu Bimodal Histogram Criterion**: For Cayula–Cornillon-inspired thermal front detection, between-class variance ratio $\theta = \frac{\sigma_B^2}{\sigma_T^2} \ge 0.65$. Rejects false fronts in unimodal water bodies.
2. **Canny Gradient Floor**: Minimum Chlorophyll gradient floor of $0.04\text{ mg/m}^3/\text{km}$ enforced to reject sensor noise in uniform oligotrophic waters.
3. **Local Neighborhood Missing Data Fraction**: Computes ratio of valid versus NaN pixels in the $3 \times 3$ grid cell neighborhood ($12 \times 12\text{ km}$).
4. **Front Bidirectional Axis Consistency**: Resolves 180° ambiguity for front lines, ensuring relative wind and Ekman transport calculate true parallel alignment.

### Categorical Status
- `STABLE`: Front criteria met with verified bimodal separation and $< 25\%$ missing data fraction in the local window.
- `ACCEPTABLE`: Valid observations processed with $< 50\%$ missing data fraction, but feature gradient is near threshold.
- `FRAGILE`: High missing data fraction ($50\%\text{--}75\%$) or borderline numerical edge detection.
- `INSUFFICIENT_DATA`: Missing data fraction $\ge 75\%$ or input array largely NaN.

---

## Dimension D: Biological Validation Status
**Core Question Answered**: *"Has the biological presence of pelagic fish been empirically verified at this specific zone using independent catch logs?"*

### Mandatory Engine Declaration
```yaml
biological_validation:
  status: BIOLOGICAL_VALIDATION_NOT_ESTABLISHED
  ground_truth_source: null
  validation_period: null
  validation_region: null
  sample_count: 0
  methodology: null
  disclaimer: >
    Production biological validation requires independent georeferenced fisheries catch logs
    or CPUE data. The current system identifies oceanographic environmental suitability only;
    fish presence is not directly observed.
```
This field **MUST** remain `BIOLOGICAL_VALIDATION_NOT_ESTABLISHED` until an empirical, multi-haul validation trial is conducted using georeferenced commercial or research catch logs (e.g. CMFRI / State Fisheries).

---

## Summary Matrix: Why Single Percentages Are Unscientific

| Metric Reported | Scientific Justification | Permitted in SagarDrishti AI? |
| :--- | :--- | :--- |
| **"82% Probability of Fish"** | **Unscientific fabrication.** No calibrated statistical distribution connects satellite SST/CHL directly to fish presence without continuous vessel catch data. | **STRICTLY PROHIBITED** |
| **"85% Model Confidence"** | **Misleading.** Conflates data freshness, algorithm convergence, and biological probability into a single opaque number. | **STRICTLY PROHIBITED** |
| **Data Quality: GOOD** | **Transparent & auditable.** Derived from 4/5 available sensor layers, fresh observations (<24h), and offshore placement. | **MANDATORY** |
| **Feature Strength: STRONG** | **Traceable.** Explicitly lists Chlorophyll=PRESENT, SST Front=PRESENT, Current Support=PRESENT. | **MANDATORY** |
| **Biological Validation: NOT ESTABLISHED** | **Scientifically honest.** Discloses that satellites observe water physics and ocean color, not underwater fish biomass. | **MANDATORY** |
