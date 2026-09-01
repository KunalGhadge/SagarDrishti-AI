import { tool as createTool } from "ai";
import { z } from "zod";

export const createMapViewTool = createTool({
  description:
    "Render an interactive coastal map view with georeferenced maritime markers and an optional direct bearing line using Leaflet and OpenStreetMap tiles. Strictly for PFZ location and SOS emergency safe harbor guidance.",
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
            .describe("Marker type classification"),
          isSimulated: z
            .boolean()
            .optional()
            .describe("Flag if coordinate is an oceanographic simulated baseline"),
        })
      )
      .describe("Array of georeferenced maritime markers"),
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
