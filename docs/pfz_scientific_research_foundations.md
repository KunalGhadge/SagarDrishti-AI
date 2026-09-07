# SagarDrishti AI — Scientific Foundations for PFZ Engine
*Compendium of Peer-Reviewed Literature, Methodological Formulations, and Implementation Directives*

---

## PAPER 1: Multi-Parameter Ocean Feature Co-Occurrence & Validation

**Citation:**  
Sarangi, R.K., Jishad, M., Sharma, R., Das, A., Mali, K., Ramalingam, L., Kizhakudan, S.J., Kumar, A.S., Samal, R.N., & Prakash, C. (2024).  
*Multiple ocean parameter-based potential fishing zone (PFZ) location generation and validation in the Western Bay of Bengal.*  
**Environmental Monitoring and Assessment**, 196:98. [https://doi.org/10.1007/s10661-023-12259-6](https://doi.org/10.1007/s10661-023-12259-6)  
*(Inherited base algorithmic framework: Jishad et al., 2021, Journal of Operational Oceanography)*

---

### 1. Research Objective & Paradigm Shift

* **Core Premise:** Moves beyond the conventional single/dual-parameter Indian operational approach (used by ESSO-INCOIS relying strictly on SST + Chlorophyll) by integrating **co-occurring mesoscale ocean features**:
  1. Satellite Chlorophyll concentration (food proxy / primary productivity).
  2. Sea Surface Temperature (SST) thermal fronts and horizontal gradients.
  3. Mesoscale cyclonic (cold-core) eddies (nutrient upwelling structures).
  4. Relative wind field and Ekman transport (governing feature advection/drift).
* **Dual Purpose:**
  1. Demonstrate that multi-feature co-occurrence ($C + F + E$) significantly correlates with higher fish catch (longline hook rate & trawl CPUE).
  2. Enable short-term feature persistence and advective forecasting for **2 to 3 days** during persistent cloud cover (a chronic obstacle in Indian coastal seas).
* **Validation Baseline:** Validated against Fishery Survey of India (FSI) 2016–2018 hindcast catch data (*Drishti* longliner and *Samudrika* trawler), plus real-time coastal trials with CMFRI (2018–2020).

---

### 2. Primary Input Parameters & Gridding

| Variable | Oceanographic Role | Native Resolution / Source | Common Grid / Processing |
| :--- | :--- | :--- | :--- |
| **Chlorophyll-a (CHL)** | Phytoplankton biomass / primary food proxy | 1 km MODIS ocean colour; daily | **3-day rolling composite** (cloud mitigation); resampled to 4 km |
| **Sea Surface Temp (SST)** | Thermal gradient / front extraction | 1 km MODIS | Bilinear interpolation to 4 km common grid |
| **Surface Wind Field** | Relative wind & Ekman drift | 6.25 km SCATSAT-1 scatterometer | Resampled to 4 km |
| **Surface Currents $(u, v)$** | Vector relative wind & advection | 9.1 km HYCOM model | Resampled to 4 km |
| **Sea Surface Height (SSH)** | Mesoscale eddy tracking | 25 km AVISO altimetry | Resampled to 4 km (deep water only) |

* **Study Domain:** Indian EEZ bounding box: Longitude 78°E–95°E, Latitude 5°N–23°N.

---

### 3. Step-by-Step Methodological Pipeline

#### Step 1: Ingestion & 3-Day Rolling Compositing
* Daily chlorophyll retrievals are composited over 3 consecutive days ($T_{-2}$ to $T_0$) by calculating the mean of cloud-free pixels:
  $$\text{CHL}_{\text{composite}}(x, y) = \frac{1}{N} \sum_{t=T-2}^{T_0} \text{CHL}(x, y, t)$$
* Mitigates daily cloud gaps while retaining mesoscale biological features.
* All layers are normalized onto a uniform 4-km grid using bilinear interpolation.

#### Step 2: SST Thermal Front Detection
* **Method:** Cayula & Cornillon (1992) edge-detection algorithm on SST fields (selected over Kostianoy gradient method based on Jishad & Agarwal, 2022).
* Extracts coherent thermal boundaries where warm and cool ocean water masses collide.

#### Step 3: Chlorophyll Front Detection
* **Method:** Canny (1986) edge-detection algorithm applied directly to the 3-day composited chlorophyll grid.
* Identifies sharp biological productivity boundaries and chlorophyll blooms.

#### Step 4: Mesoscale Cyclonic Eddy Identification
* **Method:** Chelton et al. (2011) / Mason et al. (2014) SSH contour tracking applied to altimetry data.
* **Tuning Parameters:**
  * Maximum eddy radius/size: **$\le 400\text{ km}$**
  * Minimum amplitude: **$\ge 5\text{ cm}$** (Jayan et al., 2023)
* **Crucial Directional Filter:** **Only cyclonic (cold-core) eddies are weighted favorably for PFZ.** Cyclonic eddies in the northern hemisphere cause divergence at the surface and active upwelling of cold, nutrient-rich deep water into the photic zone.
* *Coastal Caveat:* Coarse 25-km altimetry is invalid in shallow coastal waters ($< 100\text{ m}$ depth); eddy flags apply exclusively to deep-water/longline domains.

#### Step 5: Relative Wind & Ekman Transport
* Relative wind vector is computed by subtracting surface current vectors from atmospheric winds:
  $$\vec{W}_{\text{rel}} = \vec{W}_{\text{wind}} - \vec{V}_{\text{current}}$$
* Ekman transport derived from relative wind indicates surface convergence/divergence and the physical advective displacement of fronts.

#### Step 6: Categorical Feature Co-Occurrence Scoring
The algorithm converts continuous fields into three binary spatial flags per location/cell:
1. **$C$ Flag (High Chlorophyll):**
   $$C = \begin{cases} 1 & \text{if } \text{CHL} > 0.1\text{ mg/m}^3 \\ 0 & \text{otherwise} \end{cases}$$
2. **$F$ Flag (Front Present):**
   $$F = \begin{cases} 1 & \text{if SST Front is detected OR Chlorophyll Front is detected} \\ 0 & \text{otherwise} \end{cases}$$
3. **$E$ Flag (Cyclonic Eddy Present):**
   $$E = \begin{cases} 1 & \text{if cell lies within a verified cyclonic eddy boundary} \\ 0 & \text{otherwise} \end{cases}$$

**Possibility Classification Index:**
$$N_{\text{features}} = C + F + E$$
* **$N = 0$:** No PFZ Signal (unfavorable)
* **$N = 1$:** **Low Possibility** (marginal potential)
* **$N = 2$:** **Medium Possibility** (viable fishing ground)
* **$N = 3$:** **High Possibility** (prime potential; co-occurring food, thermal gradient, and upwelling)

*Note on Coastal Waters:* In nearshore waters ($< 120\text{ m}$) where altimetry cannot resolve eddies ($E = 0$), the engine runs on the 2-parameter formulation ($C + F$).

#### Step 7: Feature Persistence & Advective Propagation (Cloud-Gap Handling)
* During days when fresh optical observations are blocked by clouds, previously identified features are advected forward for **2 to 3 days** using surface current/relative wind fields:
  $$\vec{x}(t_0 + \Delta t) = \vec{x}(t_0) + \vec{V}_{\text{drift}} \cdot \Delta t$$
* After 72 hours without cloud clearance, feature confidence expires.

---

### 4. Validation Metrics & Empirical Findings

* **Catch Correlates (FSI Hindcast 2016–2018):**
  * Chlorophyll was the single strongest correlate with high catches (present in $170/293$ hook observations and $295/335$ trawl observations).
  * Thermal fronts were the second strongest correlate, followed by cyclonic eddies.
* **Catch Performance Metrics:**
  * **Trawl CPUE:** $\text{CPUE} = \frac{\text{Total Fish Catch (kg)}}{\text{Trawling Hours (h)}}$
  * **Longline Hook Rate (HR):** $\text{HR} = \frac{\text{Number of Fish Caught} \times 100}{\text{Total Hooks Deployed}}$
* **Empirical Multi-Regression Results:**
  * High-Catch Trawler ($\text{CPUE} > 50\text{ kg/h}$): $R = 0.498$
  * High-Catch Longline ($\text{HR} > 1.0$): $R = 0.608$
  * Low-Catch subsets yielded very poor correlation ($R = 0.071 - 0.118$), demonstrating that **the model is an effective classifier for identifying high-probability aggregations, not an exact linear predictor of low/zero catch**.
* **Controlled Near-Real-Time Sea Trials (8 March 2019, Chennai):**
  * **At Identified PFZ:** 16 species caught, **$224.9\text{ kg}$ total catch**, CPUE **$41.6\text{ kg/h}$**.
  * **At Paired Non-PFZ:** 6 species caught, **$97.83\text{ kg}$ total catch**, CPUE **$32.0\text{ kg/h}$** ($+30\%$ CPUE boost at PFZ).

---

## PAPER 2: Operational Formulation & Algorithmic Lineage (Jishad et al., 2019/2021 + INCOIS/MOSDAC Operational Spec)

**Citation:**  
Jishad, M., Sarangi, R.K., Ratheesh, S., Ali, S.M., & Sharma, R. (2019/2021).  
*Tracking fishing ground parameters in cloudy region using ocean colour and satellite-derived surface flow estimates: A study in the Bay of Bengal.*  
**Journal of Operational Oceanography**, 14(1), 59–70. DOI: [10.1080/1755876X.2019.1658566](https://doi.org/10.1080/1755876X.2019.1658566)  
*Secondary Operational Grounding:* Space Applications Centre (ISRO) & INCOIS/MOSDAC Operational Advisory Specification (*"Potential Fishing Zone Advisory"*, MOSDAC Technical Document).

---

### 1. Front Detection Heritage

* **SST Thermal Fronts:** Formulated via the **Cayula & Cornillon (1992)** edge-detection algorithm (*"Edge detection algorithm for SST images"*, J. Atmos. Oceanic Technol., 9(1), 67–80). Utilizes localized windowed histogram bimodality to extract coherent ocean temperature fronts rather than simple local gradients, which prevents false alarms from noisy sensor pixels.
* **Chlorophyll Fronts:** Formulated via the **Canny (1986)** edge-detection algorithm (*"A computational approach to edge detection"*, IEEE TPAMI). Applied to gridded chlorophyll fields to trace biomass boundary lines.

---

### 2. Relative Wind Field & Ekman Transport Decomposition

* **Relative Wind Definition:**
  $$\vec{W}_{\text{rel}} = \vec{W}_{\text{scatterometer}} - \vec{V}_{\text{surface\_current}}$$
  Computed as the vector difference between scatterometer atmospheric wind and surface ocean currents (acknowledging that wind stress acts on a moving boundary layer).
* **Frontal Alignment & Ekman Dynamics (Thomas & Lee, 2005):**
  * Ekman transport ($\vec{M}_E$) is decomposed relative to local front orientation:
    * **Upfront Wind Component:** Generates cross-frontal Ekman transport that can sharpen or destabilize the frontal boundary.
    * **Downfront Wind Component:** Induces surface boundary layer mixing, deepening, and destratification.
* **Operational Persistence Criterion (INCOIS/MOSDAC):**
  $$\theta = \angle(\vec{M}_E, \vec{D}_{\text{front}})$$
  * **High Persistence (Rank 2):** Assigned when Ekman transport direction is aligned within **$\le 40^\circ$** of the frontal direction ($\theta \le 40^\circ$). The front remains dynamically stable and coherent.
  * **Low Persistence (Rank 1):** Assigned when misalignment exceeds $40^\circ$ ($\theta > 40^\circ$), where cross-frontal advection rapidly disperses the gradient.

---

### 3. Mesoscale Eddy Tracking Specifications

* **Lineage:** Chelton, Schlax & Samelson (2011) and Mason, Pascual & McWilliams (2014) Sea Level Anomaly (SLA) closed-contour tracking (`py-eddy-tracker` architecture).
* **Operational Cutoffs (MOSDAC):**
  * Minimum eddy radius: **$400\text{ km}$** (or outer closed contour limit)
  * Minimum sea-surface amplitude: **$5\text{ cm}$**
* **Physical Mechanism:** Cyclonic eddies exhibit negative SLA at the core, dome the pycnocline upward, and drive active vertical transport of nutrients into the euphotic zone.

---

### 4. INCOIS/MOSDAC Operational PFZ Decision Matrix

MOSDAC defines a discrete, rule-based decision matrix rather than an arbitrary black-box regression:

| Operational Rank | Criteria | Oceanographic Rationale |
| :--- | :--- | :--- |
| **Rank 1 (Low)** | Thermal front **OR** Chlorophyll front present alone | Single physical or biological signal without confirmed coupling |
| **Rank 2 (Medium)** | Thermal front **+** Cyclonic Eddy, **OR** $\text{CHL} > 0.3\text{ mg/m}^3$ | Structural upwelling or elevated biological productivity confirmed |
| **Rank 3 (High)** | Thermal front **+** Cyclonic Eddy **+** $\text{CHL} > 0.3\text{ mg/m}^3$ | Co-occurring biological enrichment, thermal boundary, and upwelling |

* **Persistence Layer:** A secondary persistence tier is overlaid:
  * **High Persistence:** Ekman transport within $\le 40^\circ$ of front orientation.
  * **Standard Persistence:** Misaligned Ekman transport.

---

### 5. Kinematic Propagation / Advection Rule

* **Propagation Vector:** Identified PFZ locations are propagated along the current direction:
  $$\text{Bearing}_{\text{drift}} = \text{atan2}(u, v) \quad [\text{degrees}]$$
* **Forecast Horizon:** Provides short-term tactical persistence for **24 to 72 hours** (1 to 3 days), ensuring advisories remain usable during persistent monsoon cloud decks.

---

## 6. UNIFIED IMPLEMENTATION SPECIFICATION FOR SAGARDRISHTI AI

Combining the scientific rigor of **Sarangi et al. (2024)** with the operational clarity of **Jishad et al. (2019/2021) / MOSDAC**, here is the definitive engineering architecture for our PFZ Engine:

```mermaid
flowchart TD
    subgraph Data_Inputs [Copernicus Marine Verified Data Streams]
        SST_L4[OSTIA L4 SST 0.05° Gap-Free\nMETOFFICE-GLO-SST-L4-NRT-OBS-SST-V2]
        CHL_L3[Daily/3-Day L3 Ocean Optics 4km\ncmems_obs-oc_glo_bgc-optics_nrt_l3-multi-4km_P1D]
        CUR_PHY[Hourly Forecast Currents 0.083°\ncmems_mod_glo_phy_anfc_0.083deg_PT1H-m (uo, vo)]
        WIND_MET[ECMWF / Open-Meteo 10m Marine Wind]
    end

    subgraph Feature_Extraction [Stage 1: Ocean Feature Extraction]
        CHL_Comp[3-Day Rolling Compositor\nmean(CHL_t-2 ... CHL_t0)]
        SST_Grad[Thermal Front Detector\nSobel/Cayula Gradient |∇SST| ≥ 0.5°C / 5km]
        CHL_Front[Chlorophyll Front Detector\nCanny Edge / High-Gradient Boundary]
        Rel_Wind[Relative Wind Vector\nW_rel = W_wind - V_current]
    end

    subgraph Scoring_Advection [Stage 2: Scientific Scoring & Advection]
        CoOccur[Categorical Co-Occurrence Matrix\nC: CHL > 0.1 mg/m³\nF: SST or CHL Front Present\nE: Current Convergence / Cyclonic Eddy]
        Persistence[Ekman / Current Advection Engine\nDrift displacement: (u, v) * dt\nPersistence decay: 100% (<24h), 75% (48h), 50% (72h)]
    end

    subgraph Safety_Output [Stage 3: Decision Support & Delivery]
        SafetyGate[IMO FSA Sea State Safety Override\nWave Hs < 2.0m & Wind < 22 kts]
        PFZ_JSON[Standardized Sector JSON Payload\npublic/data/pfz_mumbai_live.json]
        LeafletUI[Leaflet MapView & Ocean Analytics Agent\nGlowing Cyan Markers + Feature Badges C/F/E]
    end

    SST_L4 --> SST_Grad
    CHL_L3 --> CHL_Comp --> CHL_Front
    CUR_PHY --> Rel_Wind
    WIND_MET --> Rel_Wind

    CHL_Comp --> CoOccur
    SST_Grad --> CoOccur
    CHL_Front --> CoOccur
    CUR_PHY --> CoOccur

    CoOccur --> Persistence
    Rel_Wind --> Persistence
    CUR_PHY --> Persistence

    Persistence --> SafetyGate
    SafetyGate --> PFZ_JSON
    PFZ_JSON --> LeafletUI
```

### Exact Parameter Formulations for SagarDrishti PFZ Engine

1. **Grid Standard:** 4-km spatial resolution across the target coastal sector (e.g. Maharashtra 18°N–20°N, 71°E–74°E).
2. **Biological Productivity Flag ($C$):**
   $$C = 1 \iff \text{CHL} \ge 0.10\text{ mg/m}^3 \quad (\text{or } BBP \ge 0.003\text{ m}^{-1})$$
3. **Thermal / Optical Front Flag ($F$):**
   $$F = 1 \iff |\nabla \text{SST}| \ge 0.5^\circ\text{C} / 5\text{km} \quad \text{OR} \quad |\nabla \text{CHL}| \text{ detected}$$
4. **Current Convergence / Upwelling Flag ($E$):**
   $$E = 1 \iff \nabla \cdot \vec{V} < -0.05\text{ day}^{-1} \quad \text{OR cyclonic eddy center within } 25\text{ km}$$
5. **Multi-Feature Ranking:**
   * **Score 0:** No Signal
   * **Score 1 (Low Potential):** Single parameter ($F$ or $C$ alone)
   * **Score 2 (Moderate Potential):** $C + F$ or $F + E$ (validated coastal standard)
   * **Score 3 (High Potential):** Co-occurring $C + F + E$
6. **Cloud-Cover Advection & Temporal Decay:**
   * If today's optical pass is cloud-masked, advect the last clear observation ($T_{-1}$ or $T_{-2}$) along Copernicus hourly currents:
     $$\Delta \text{lon} = \frac{u \cdot \Delta t}{111320 \cdot \cos(\text{lat})}, \quad \Delta \text{lat} = \frac{v \cdot \Delta t}{110540}$$
   * **Confidence factor:** $100\%$ ($<24\text{h}$), $75\%$ ($24–48\text{h}$), $50\%$ ($48–72\text{h}$), $0\%$ ($>72\text{h}$ $\to$ fallback to physical currents only).
7. **IMO FSA Sea State Gate:** If significant wave height $H_s \ge 2.5\text{ m}$ or wind speed $\ge 25\text{ kts}$, zone is tagged with an immediate warning: **"UNFAVORABLE / HAZARDOUS SEA STATE FOR SMALL CRAFT"**.

---

### What to Tell Judges (Verbatim 3-Sentence Defense)
> *"SagarDrishti AI implements the multi-parameter ocean-feature co-occurrence framework formulated by ISRO/INCOIS scientists in Jishad et al. (2021) and validated by Sarangi et al. (2024), combining satellite thermal fronts, chlorophyll blooms, and cyclonic upwelling. To solve the chronic monsoon cloud-cover problem, our engine utilizes a 3-day rolling composite and dynamically advects persistent fronts using Copernicus live forecast current vectors rather than inventing false coordinates. Every advisory is governed by a strict IMO sea-state safety filter, ensuring fishermen receive actionable, high-probability zones without compromising vessel safety."*

---

## Operational Copernicus Marine Datasets Specification & Ingestion

The live PFZ Engine operates directly on European Union Copernicus Marine Service (CMEMS) Earth Observation and numerical physical forecast datasets. Below are the exact dataset identifiers, variables, and ingestion signatures:

### 1. Sea Surface Temperature (SST) & Ice Analysis
* **Name:** Global Ocean OSTIA Sea Surface Temperature and Sea Ice Analysis
* **Product Form:** L4 Gap-Free Gridded Analysis (Daily, 0.05° resolution)
* **Temporal Coverage:** 17/01/2024 – Present (06/09/2026 operational test slice)
* **Dataset ID:** `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2`
* **Variables:**
  - `analysed_sst`: Sea Surface Foundation Temperature (Kelvin)
  - `analysis_error`: Estimated standard error of the SST analysis (Kelvin)
  - `mask`: Land / ocean / sea ice flag (0 = ocean, 1 = land)
  - `sea_ice_fraction`: Fractional sea ice concentration (0 to 1)

```python
import copernicusmarine

copernicusmarine.subset(
    dataset_id="METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2",
    variables=["analysed_sst", "analysis_error", "mask", "sea_ice_fraction"],
    minimum_longitude=-179.97500610351562,
    maximum_longitude=179.97500610351562,
    minimum_latitude=-89.9749984741211,
    maximum_latitude=89.9749984741211,
    start_datetime="2026-09-06T00:00:00",
    end_datetime="2026-09-06T00:00:00",
)
```

---

### 2. Ocean Colour & Bio-Geo-Chemistry (Optics / Chlorophyll)
* **Name:** Global Ocean Colour (Copernicus-GlobColour), Bio-Geo-Chemical, L3 (daily) from Satellite Observations (Near Real Time)
* **Product:** Optics, multi-sensor (4 km native resolution)
* **Temporal Coverage:** 21/08/2026 – 05/09/2026 (Rolling near-real-time daily)
* **Dataset ID:** `cmems_obs-oc_glo_bgc-optics_nrt_l3-multi-4km_P1D`
* **Variables:**
  - `BBP`: Particulate backscattering coefficient at 443 nm (m⁻¹, proxy for turbidity/biomass)
  - `BBP_uncertainty`: Uncertainty on particulate backscattering coefficient
  - `CDM`: Colored dissolved and detrital organic matter absorption at 443 nm (m⁻¹)
  - `CDM_uncertainty`: Uncertainty on CDM absorption
  - `flags`: Quality flags (cloud mask, land, ice, high glint)

```python
import copernicusmarine

copernicusmarine.subset(
    dataset_id="cmems_obs-oc_glo_bgc-optics_nrt_l3-multi-4km_P1D",
    variables=["BBP", "BBP_uncertainty", "CDM", "CDM_uncertainty", "flags"],
    minimum_longitude=-179.9791717529297,
    maximum_longitude=179.9791717529297,
    minimum_latitude=-89.97917175292969,
    maximum_latitude=89.97916412353516,
    start_datetime="2026-09-05T00:00:00",
    end_datetime="2026-09-05T00:00:00",
)
```

---

### 3. Global Ocean Physics Analysis and Forecast (Currents & SSH)
* **Name:** Global Ocean Physics Analysis and Forecast
* **Product:** Hourly / 6-hourly ocean physics analysis and 10-day forecast (1/12° ~ 8.3 km grid)
* **Temporal Coverage:** 01/06/2022 – 17/09/2026
* **Dataset IDs:**
  - `cmems_mod_glo_phy-cur_anfc_0.083deg_PT6H-i` (6-hourly currents)
  - `cmems_mod_glo_phy_anfc_0.083deg_PT1H-m` (Hourly physics: $u, v, T, S, \text{zos}$)
* **Variables:**
  - `uo`: Eastward sea water velocity (m/s)
  - `vo`: Northward sea water velocity (m/s)
  - `zos`: Sea surface height above geoid / sea level anomaly proxy (m)
  - `thetao`: Sea water potential temperature (°C)
  - `so`: Sea water salinity (psu)

```python
import copernicusmarine

copernicusmarine.subset(
    dataset_id="cmems_mod_glo_phy_anfc_0.083deg_PT1H-m",
    variables=["so", "thetao", "uo", "vo", "zos"],
    minimum_longitude=-180,
    maximum_longitude=179.91668701171875,
    minimum_latitude=-80,
    maximum_latitude=90,
    start_datetime="2026-09-16T23:00:00",
    end_datetime="2026-09-16T23:00:00",
    minimum_depth=0.49402499198913574,
    maximum_depth=0.49402499198913574,
)
```

---

### 4. Authentication Configuration
* In accordance with secure credential management standards, credentials are stored in local environment variables (`COPERNICUS_MARINE_USERNAME` and `COPERNICUS_MARINE_PASSWORD`) and registered in `~/.copernicusmarine/.copernicusmarine-credentials`.
* Verified Account: `kghadge` (validated on CMEMS API endpoints).

