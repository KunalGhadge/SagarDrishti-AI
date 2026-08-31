import { DBWorkflow, DBNode, DBEdge } from "app-types/workflow";
import { GetWeather, BabyResearch } from "./workflow/examples";

const weatherFlow = GetWeather();
const researchFlow = BabyResearch();

export const SAGARDRISHTI_PRESEEDED_WORKFLOWS: (Omit<DBWorkflow, "createdAt" | "updatedAt"> & {
  nodes: Partial<DBNode>[];
  edges: Partial<DBEdge>[];
})[] = [
  {
    id: "sagar-drishti-coastal-weather",
    name: weatherFlow.workflow.name || "SagarDrishti Coastal Weather & Sea State Ingest",
    description: weatherFlow.workflow.description || "Automated Coastal Marine Meteorological & Sea State Ingestion Pipeline",
    icon: weatherFlow.workflow.icon as any,
    version: "1.0.0",
    isPublished: true,
    visibility: "public",
    userId: "system",
    nodes: weatherFlow.nodes,
    edges: weatherFlow.edges,
  },
  {
    id: "sagar-drishti-deep-research",
    name: researchFlow.workflow.name || "SagarDrishti Maritime Deep Research DAG",
    description: researchFlow.workflow.description || "Autonomous Maritime Deep Research DAG: Multi-layer ocean intelligence synthesis, geospatial vessel traffic, and IMO risk evaluation.",
    icon: researchFlow.workflow.icon as any,
    version: "1.0.0",
    isPublished: true,
    visibility: "public",
    userId: "system",
    nodes: researchFlow.nodes,
    edges: researchFlow.edges,
  },
];
