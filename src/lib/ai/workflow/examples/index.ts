import { DBEdge, DBNode, DBWorkflow } from "app-types/workflow";
import { generateUUID } from "lib/utils";
import { babyResearchEdges, babyResearchNodes } from "./baby-research";
import { getWeatherEdges, getWeatherNodes } from "./get-weather";

export const GetWeather = (): {
  workflow: Partial<DBWorkflow>;
  nodes: Partial<DBNode>[];
  edges: Partial<DBEdge>[];
} => {
  return {
    workflow: {
      description: "SagarDrishti Automated Coastal Marine Meteorological & Sea State Ingestion Pipeline",
      name: "SagarDrishti Coastal Weather & Sea State Ingest",
      isPublished: true,
      visibility: "private",
      icon: {
        type: "emoji",
        value: "🌊",
        style: {
          backgroundColor: "rgb(14, 165, 233)",
        },
      },
    },
    nodes: getWeatherNodes,
    edges: getWeatherEdges.map((edge) => ({
      ...edge,
      id: generateUUID(),
    })),
  };
};

export const BabyResearch = (): {
  workflow: Partial<DBWorkflow>;
  nodes: Partial<DBNode>[];
  edges: Partial<DBEdge>[];
} => {
  return {
    workflow: {
      description:
        "SagarDrishti Autonomous Maritime Deep Research DAG: Multi-layer ocean intelligence synthesis, geospatial vessel traffic, and IMO risk evaluation.",
      name: "SagarDrishti Maritime Deep Research DAG",
      isPublished: true,
      visibility: "private",
      icon: {
        type: "emoji",
        value: "🚢",
        style: {
          backgroundColor: "rgb(59, 130, 246)",
        },
      },
    },

    nodes: babyResearchNodes,
    edges: babyResearchEdges.map((edge) => ({
      ...edge,
      id: generateUUID(),
    })),
  };
};
