import { DBEdge, DBNode } from "app-types/workflow";
import { generateUUID } from "lib/utils";

const INPUT_ID = generateUUID();
const OUTPUT_ID = generateUUID();
const NOTE_ID = generateUUID();
const HTTP_ID = generateUUID();
const LLM_ID = generateUUID();
const SYNTHESIS_LLM_ID = generateUUID();

export const getWeatherNodes: Partial<DBNode>[] = [
  {
    id: INPUT_ID,
    kind: "input",
    name: "COASTAL_INPUT",
    description: "Collect coastal sector, fishing port, or sea zone from user",
    uiConfig: {
      position: { x: 0, y: 0 },
      type: "default",
    },
    nodeConfig: {
      kind: "input",
      outputSchema: {
        type: "object",
        properties: {
          coastal_zone: {
            type: "string",
            description: "Indian coastal zone or port (e.g. Veraval, Ratnagiri, Paradip)",
          },
        },
        required: ["coastal_zone"],
      },
    },
  },
  {
    id: LLM_ID,
    kind: "llm",
    name: "GEO_LOCATOR",
    description: "Extract marine coordinates and coastal region metadata",
    uiConfig: {
      position: { x: 400, y: 0 },
      type: "default",
    },
    nodeConfig: {
      kind: "llm",
      outputSchema: {
        type: "object",
        properties: {
          answer: {
            type: "object",
            properties: {
              latitude: {
                type: "number",
                description: "Nautical latitude in decimal degrees",
              },
              longitude: {
                type: "number",
                description: "Nautical longitude in decimal degrees",
              },
              port_name: {
                type: "string",
                description: "Standardized port name",
              },
            },
            required: ["latitude", "longitude", "port_name"],
          },
        },
      },
      messages: [
        {
          role: "user",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Identify the exact nautical offshore coordinates (latitude and longitude) and standardized port name for this coastal zone: ",
                  },
                  {
                    type: "mention",
                    attrs: {
                      id: "e8d2314a-f81b-41e3-91ff-f235486a62f3",
                      label: `{"nodeId":"${INPUT_ID}","path":["coastal_zone"]}`,
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
      model: { provider: "google", model: "gemini-2.5-flash" },
    },
  },
  {
    id: HTTP_ID,
    kind: "http",
    name: "OPEN_METEO_MARINE_API",
    description: "Fetch live wave heights, swell waves, ocean currents, and sea state physics",
    uiConfig: {
      position: { x: 800, y: 0 },
      type: "default",
    },
    nodeConfig: {
      kind: "http",
      outputSchema: {
        type: "object",
        properties: {
          response: {
            type: "object",
            properties: {
              status: { type: "number" },
              statusText: { type: "string" },
              ok: { type: "boolean" },
              headers: { type: "object" },
              body: { type: "string" },
              duration: { type: "number" },
              size: { type: "number" },
            },
          },
        },
      },
      method: "GET",
      headers: [],
      query: [
        {
          key: "current",
          value: "wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,ocean_current_velocity,ocean_current_direction",
        },
        {
          key: "hourly",
          value: "wave_height,wind_wave_height,ocean_current_velocity",
        },
        { key: "timezone", value: "auto" },
        {
          key: "latitude",
          value: { nodeId: LLM_ID, path: ["answer", "latitude"] },
        },
        {
          key: "longitude",
          value: { nodeId: LLM_ID, path: ["answer", "longitude"] },
        },
      ],
      timeout: 30000,
      url: "https://marine-api.open-meteo.com/v1/marine",
    },
  },
  {
    id: SYNTHESIS_LLM_ID,
    kind: "llm",
    name: "SAGARDRISHTI_SYNTHESIS",
    description: "Compute IMO FSA risk levels, sea state category, and fishing advisories",
    uiConfig: {
      position: { x: 1240, y: 0 },
      type: "default",
    },
    nodeConfig: {
      kind: "llm",
      outputSchema: {
        type: "object",
        properties: {
          answer: {
            type: "object",
            properties: {
              sea_state_category: { type: "string" },
              risk_level: { type: "string" },
              actionable_advisory: { type: "string" },
              scientific_summary: { type: "string" },
            },
          },
        },
      },
      messages: [
        {
          role: "user",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "You are the SagarDrishti Marine Intelligence Engine (Team WE# / ISRO PS 26176). Analyze the following live marine oceanographic telemetry and generate a strict IMO FSA Risk Assessment and Fishermen Safety Advisory:\n\nRaw Marine Telemetry: ",
                  },
                  {
                    type: "mention",
                    attrs: {
                      id: "b7e12d4a-9b1c-43f1-a1e4-d19837a28b12",
                      label: `{"nodeId":"${HTTP_ID}","path":["response","body"]}`,
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
      model: { provider: "google", model: "gemini-2.5-flash" },
    },
  },
  {
    id: NOTE_ID,
    kind: "note",
    name: "PIPELINE_ARCHITECTURE",
    description: `# 🌊 SagarDrishti Marine Physics & Sea State Ingestion Pipeline

This workflow ingests live oceanographic physics (wave heights, swell period, surface current velocity) from the Open-Meteo Marine Physics API, geocodes the nautical sector, and evaluates deterministic safety indices according to the IMO Formal Safety Assessment (FSA) and IMD Fishermen Warning criteria.

### ➡️ Execution Pipeline

1. **Target Coastal Sector**: User enters coastal landmark or fishing harbor (e.g. *"Veraval Port, Gujarat"*).
2. **Nautical Geocoder (LLM)**: Resolves coordinates into decimal nautical latitude & longitude.
3. **Open-Meteo Marine Physics API (HTTP)**: Ingests real-time wave heights, swell period, and current velocities.
4. **SagarDrishti Marine Synthesis (LLM)**: Computes Douglas Sea State category, Beaufort wind-wave force, and IMO FSA Risk Badges (CODE GREEN / YELLOW / ORANGE / RED).
5. **Output**: Transmits verified marine telemetry and tactical advisory to port authorities and fishing vessels.
`,
    uiConfig: {
      position: {
        x: 0,
        y: -480,
      },
      type: "default",
    },
    nodeConfig: {
      kind: "note",
      outputSchema: { type: "object", properties: {} },
    },
  },
  {
    id: OUTPUT_ID,
    kind: "output",
    name: "FINAL_ADVISORY",
    description: "Output structured maritime intelligence",
    uiConfig: {
      position: { x: 1680, y: 0 },
      type: "default",
    },

    nodeConfig: {
      kind: "output",
      outputSchema: { type: "object", properties: {} },
      outputData: [
        {
          key: "marine_intelligence_advisory",
          source: { nodeId: SYNTHESIS_LLM_ID, path: ["answer"] },
        },
        {
          key: "raw_ocean_telemetry",
          source: { nodeId: HTTP_ID, path: ["response", "body"] },
        },
      ],
    },
  },
];

export const getWeatherEdges: Partial<DBEdge>[] = [
  {
    source: INPUT_ID,
    target: LLM_ID,
    uiConfig: {},
  },
  {
    source: LLM_ID,
    target: HTTP_ID,
    uiConfig: {},
  },
  {
    source: HTTP_ID,
    target: SYNTHESIS_LLM_ID,
    uiConfig: {},
  },
  {
    source: SYNTHESIS_LLM_ID,
    target: OUTPUT_ID,
    uiConfig: {},
  },
];
