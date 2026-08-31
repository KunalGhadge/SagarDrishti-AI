# 🌊 SagarDrishti AI (ORCA)
### Autonomous Marine Intelligence & Decision Support Platform
**Smart India Hackathon (SIH 2026)** | **ISRO / Department of Space (Problem Statement 26176)**  
**Developed by Team WE#**

---

## 🧭 Executive Overview

**SagarDrishti AI** is an enterprise-grade, autonomous multi-agent marine intelligence platform designed to empower artisanal fishermen, oceanographic researchers, merchant mariners, and port authorities with verified, zero-hallucination decision support across the Indian Exclusive Economic Zone (EEZ).

By harmonizing satellite Earth Observation (EO) data from **ISRO MOSDAC** (Oceansat-3, INSAT-3DR), live coastal atmospheric bulletins from the **India Meteorological Department (IMD)**, Potential Fishing Zone (PFZ) advisories from **INCOIS**, and real-time Automatic Identification System (**AIS**) vessel traffic, SagarDrishti AI delivers actionable tactical recommendations while strictly adhering to the **IMO Formal Safety Assessment (FSA)**.

---

## 🌟 Core System Capabilities

```
+-----------------------------------------------------------------------------+
|                      SAGARDRISHTI AI MULTI-AGENT DAG                        |
+-----------------------------------------------------------------------------+
|                                                                             |
|                     [ 🎯 Master Marine Orchestrator ]                       |
|                                    |                                        |
|         +--------------------------+--------------------------+             |
|         |                          |                          |             |
|         v                          v                          v             |
|  [ 🌪️ IMD Weather ]       [ 🛰️ INCOIS PFZ ]         [ ⚓ Geospatial ]       |
|    Cyclone Track             Thermal Fronts            IMO FSA Risk         |
|    Gale Wind GeoJSON         Chlorophyll-a             IMBL Boundary        |
|    Port Warnings             Fuel Waypoints            SOS Protocol         |
|         |                          |                          |             |
|         +--------------------------+--------------------------+             |
|                                    |                                        |
|                                    v                                        |
|                  [ 📊 Marine Presentation & Synthesis ]                     |
|                   Interactive Tables & Regional Output                      |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### 1. 🤖 Autonomous Multi-Agent Hierarchy
* **🎯 Master Marine Orchestrator (Planner)**: Analyzes nautical inquiries, classifies operational intent, and delegates tasks to specialized autonomous agents with evidence gating.
* **🌪️ Weather & Cyclone Intelligence Agent**: Ingests official IMD Coastal Bulletins, Gale Wind Radii GeoJSON, District Nowcasts, and Port Danger Signals (Signals 1–11).
* **🛰️ Ocean & Earth-Observation Analytics Agent**: Evaluates Sea Surface Temperature (SST) gradients ($\Delta SST \ge 0.5^\circ\text{C}/5\text{km}$ in the $26.5^\circ\text{C}\text{--}29.2^\circ\text{C}$ pelagic window) and Chlorophyll bio-optics ($0.2\text{--}2.0\,\text{mg/m}^3$) for high-probability PFZ waypoints.
* **⚓ Geospatial & Maritime Safety Agent**: Deterministic risk calculator under IMO FSA guidelines (`CODE GREEN / YELLOW / ORANGE / RED`) with real-time proximity alerts for the International Maritime Boundary Line (IMBL).
* **📰 Maritime Intelligence & Geopolitical News Agent**: Live crawler for Ministry of Fisheries circulars, seasonal fishing bans, and Indian Coast Guard security alerts.
* **📊 Marine Presentation & Synthesis Agent**: Transforms complex multi-dimensional telemetry into interactive charts, tables, and multilingual regional advisories.

### 2. ⚡ Autonomous Workflow Studio (Visual DAGs)
* **Coastal Weather & Sea State Ingestion Pipeline**: Ingests real-time wave heights, swell wave periods, and ocean current velocities from the Open-Meteo Marine Physics API, runs Douglas Sea State classifications, and generates actionable harbor return advisories.
* **Maritime Deep Research DAG**: Autonomous multi-step research on maritime security, PFZ bio-optics, and IMD storm bulletins with live Exa web retrieval.

### 3. 🛰️ SagarDrishti Marine Model Context Protocol (MCP) Hub
Connects external oceanographic tools and database streams via the open Model Context Protocol (MCP):
* **ISRO MOSDAC Satellite Connector**: Oceansat-3 & INSAT-3DR ocean color and thermal feeds.
* **IMD Coastal Cyclone Connector**: Severe weather bulletins and Gale wind radius GeoJSON.
* **INCOIS PFZ Connector**: High wave alerts, PFZ boundary vectors, and tidal forecasts.
* **AIS Real-Time Vessel Traffic Connector**: MMSI vessel tracking and boundary monitoring.
* **Open-Meteo Marine Physics Connector**: Wave physics and sea-state current vectors.
* **IMO Formal Safety Assessment (FSA) Connector**: 5-step quantitative risk matrices.
* **Indian Coast Guard & Fisheries Policy Connector**: Live regulatory gazette ingestion.
* **GEBCO Bathymetry Connector**: High-resolution coastal seabed depth contours.

### 4. 🌐 Multilingual Indian Regional Language Support
* Full native support for **10 Indian regional languages**: English, Hindi (हिन्दी), Marathi (मराठी), Gujarati (ગુજરાતી), Tamil (தமிழ்), Telugu (తెలుగు), Malayalam (മലയാളം), Bengali (বাংলা), Odia (ଓଡ଼ିଆ), and Kannada (ಕನ್ನಡ).

---

## 🛠️ Technology Stack

* **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, Radix UI, Lucide Icons
* **Multi-Agent Runtime**: Vercel AI SDK, Google Gemini (`gemini-3.6-flash` / `gemini-3.6-pro` / `gemini-2.5-flash`), Anthropic Claude, OpenAI
* **Database & Vector Storage**: Supabase PostgreSQL / Drizzle ORM
* **Authentication**: Better Auth with PostgreSQL session management
* **Protocols**: Model Context Protocol (MCP), Server-Sent Events (SSE), Open-Meteo Marine API, Exa AI Semantic Search

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/KunalGhadge/SagarDrishti-AI.git
cd SagarDrishti-AI
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your credentials:
```env
# Google Gemini API Key (Required for primary multi-agent engine)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here

# PostgreSQL Database Connection URL
POSTGRES_URL=postgresql://postgres:...@aws-0-ap-south-1.pooler.supabase.com:6543/postgres

# Better Auth Secret
BETTER_AUTH_SECRET=your_auth_secret_here
BETTER_AUTH_URL=http://localhost:3000

# Exa AI Search Key (Optional for maritime live search)
EXA_API_KEY=your_exa_api_key_here
```

### 4. Run Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to access **SagarDrishti AI**.

---

## 🏆 Smart India Hackathon 2026
* **Problem Statement ID**: 26176
* **Organization**: Indian Space Research Organisation (ISRO) / Department of Space
* **Team**: **Team WE#**
* **Repository**: [github.com/KunalGhadge/SagarDrishti-AI](https://github.com/KunalGhadge/SagarDrishti-AI)

<!-- cache-bust -->