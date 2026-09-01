/**
 * Marine Intent Classifier (Phase 1 Core Pipeline)
 * Maps any user query into strictly ONE of the 8 fixed ISRO PS categories or UNKNOWN.
 */

export type MarineIntentCategory =
  | "PFZ_LOCATION"
  | "VENTURE_SAFETY"
  | "SEA_CONDITIONS"
  | "ALERT_CHECK"
  | "CHLOROPHYLL_SST"
  | "ROUTE_SAFETY"
  | "PRODUCTIVITY_WHY"
  | "GEOFENCE_CHECK"
  | "UNKNOWN";

export function classifyIntent(query: string): MarineIntentCategory {
  const q = (query || "").toLowerCase().trim();

  // 1. GEOFENCE CHECK (IMBL, boundary, MPA, restricted area, sanctuary)
  if (
    /geofence|imbl|boundary|border|katchatheevu|sir creek|restricted|marine protected|mpa|sanctuary|prohibited zone/i.test(q) ||
    /border cross|pakistan border|sri lanka border|cross.*border/i.test(q)
  ) {
    return "GEOFENCE_CHECK";
  }

  // 2. ROUTE SAFETY (Safest route, navigation path, voyage, waypoint, course)
  if (
    /safest route|safe route|navigation route|route.*safety|which route|navigate from|voyage route|waypoint/i.test(q) ||
    /route.*considering|how to reach.*safely/i.test(q)
  ) {
    return "ROUTE_SAFETY";
  }

  // 3. PRODUCTIVITY DECLINE (Why fish declined, less catch, low productivity, fish depletion)
  if (
    /why.*declined|why.*fish|decline.*productivity|low catch|fish catch.*reduced|less fish|why.*less catch|productivity.*decline/i.test(q)
  ) {
    return "PRODUCTIVITY_WHY";
  }

  // 4. CHLOROPHYLL & SST (High chlorophyll, ocean color, thermal front, SST gradient)
  if (
    /chlorophyll|chlorophyll.*sst|ocean color|phytoplankton|thermal front|sst and chlorophyll|high chlorophyll/i.test(q)
  ) {
    return "CHLOROPHYLL_SST";
  }

  // 5. ALERT CHECK (Cyclone, lightning, storm warning, squall alert, gale)
  if (
    /alert|cyclone|lightning|storm|squall|thunderstorm|gale|warning.*alert|any warning|is there a cyclone/i.test(q)
  ) {
    return "ALERT_CHECK";
  }

  // 6. VENTURE SAFETY (Is it safe to go, should I venture, can I go fishing, sailing safety, safe tomorrow)
  if (
    /is it safe|safe to venture|can i go|should i go|venture.*safe|sailing safe|safe tomorrow|safe today|go for fishing/i.test(q) ||
    /safety.*venture|sea venture|fishing safety/i.test(q)
  ) {
    return "VENTURE_SAFETY";
  }

  // 7. PFZ LOCATION (Potential fishing zone, where is fish, nearest zone, tuna location, fishing ground)
  if (
    /pfz|potential fishing zone|where.*fish|nearest.*zone|fishing zone|fishing ground|where.*tuna|find fish|fish hotspot/i.test(q)
  ) {
    return "PFZ_LOCATION";
  }

  // 8. SEA CONDITIONS (Tide, weather, wave height, sea conditions, swell, currents, wind)
  if (
    /tide|sea condition|wave height|swell|ocean current|wind speed|weather condition|sea state|water temp/i.test(q)
  ) {
    return "SEA_CONDITIONS";
  }

  // Fallback
  return "UNKNOWN";
}
