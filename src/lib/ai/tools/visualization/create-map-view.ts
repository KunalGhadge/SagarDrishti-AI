import { tool as createTool } from "ai";
import { z } from "zod";

export const createMapViewTool = createTool({
  description:
    "Render an interactive coastal map view with georeferenced maritime markers, safe harbors, PFZ candidate zones, geofence polygons, and direct bearing lines using Leaflet and OpenStreetMap tiles. Call this whenever the user asks for a map, fishing zones, navigation points, coordinates, routes, or safe harbors.",
  inputSchema: z.object({
    title: z.string().optional().describe("Title for the map view card"),
    markers: z
      .array(
        z.object({
          lat: z.number().describe("Latitude coordinate"),
          lon: z.number().describe("Longitude coordinate"),
          label: z.string().describe("Marker popup label"),
          type: z
            .enum(["current", "hazard", "safe_zone", "pfz"])
            .describe("Marker type classification: 'current' (user/vessel location), 'hazard' (danger/squall), 'safe_zone' (safe harbor), 'pfz' (verified potential fishing zone candidate)"),
          classification: z.string().optional().describe("PFZ categorical classification (HIGH, MEDIUM, LOW, NO SIGNAL, INCOMPLETE EDDY EVIDENCE)"),
          featureCount: z.number().optional().describe("Count of verified oceanographic features (0-3)"),
          features: z
            .object({
              high_chlorophyll: z.boolean().optional(),
              sst_front: z.boolean().optional(),
              chl_front: z.boolean().optional(),
              front_present: z.boolean().optional(),
              cyclonic_eddy: z.boolean().nullable().optional(),
              eddy_evidence_status: z.string().optional(),
            })
            .optional()
            .describe("Detected ocean feature flags"),
          dataAgeHours: z.number().optional().describe("Observation age in hours"),
          freshnessStatus: z.string().optional().describe("Freshness evaluation (FRESH, PERSISTED, INSUFFICIENT EVIDENCE)"),
          persistenceStatus: z.string().optional().describe("Ekman persistence status"),
          evidenceQuality: z
            .object({
              chl_status: z.string().optional(),
              sst_status: z.string().optional(),
              ssh_sla_status: z.string().optional(),
              wind_status: z.string().optional(),
              current_status: z.string().optional(),
            })
            .optional()
            .describe("Categorical sensor completeness and evidence quality"),
        })
      )
      .describe("Array of georeferenced maritime markers"),
    polygons: z
      .array(
        z.object({
          name: z.string().describe("Name of the geofence zone"),
          type: z.enum(["imbl", "mpa", "hazard", "safe"]).describe("Zone category"),
          coordinates: z.array(
            z.object({
              lat: z.number(),
              lon: z.number(),
            })
          ).describe("Array of polygon vertices"),
          color: z.string().optional().describe("Optional hex color code"),
        })
      )
      .optional()
      .describe("Optional geofenced polygons or maritime boundaries"),
    path: z
      .array(
        z.object({
          lat: z.number().describe("Waypoint latitude"),
          lon: z.number().describe("Waypoint longitude"),
        })
      )
      .optional()
      .describe("Optional straight-line direct bearing path between points"),
    pathLabel: z
      .string()
      .optional()
      .default("Direct Bearing")
      .describe("Label for the line (direct bearing, not navigation route)"),
  }),
  execute: async () => {
    return "Success";
  },
});
