/**
 * Deterministic Marine Geofence & Boundary Engine
 * Pure mathematical ray-casting and geodesic distance calculation.
 * Zero LLM hallucination.
 */

import {
  calculateDistanceNM,
  resolveSafeHarbor,
} from "./marine-geospatial-engine";
import { GeofenceEvaluation, GeofenceRiskStatus } from "@/types/security";

export interface StatutoryGeofenceDefinition {
  id: string;
  name: string;
  type: "imbl" | "mpa" | "hazard";
  coordinates: Array<{ lat: number; lon: number }>;
  color: string;
  description: string;
}

/**
 * Authoritative Indian Coastal Geofences & Restricted Maritime Polygons
 */
export const STATUTORY_GEOFENCES: StatutoryGeofenceDefinition[] = [
  {
    id: "indo-pak-imbl-zone",
    name: "Indo-Pak International Maritime Boundary (Restricted Foreign Sector)",
    type: "imbl",
    color: "#ef4444",
    description: "Sir Creek / Gujarat international maritime boundary line",
    coordinates: [
      { lat: 23.65, lon: 67.80 },
      { lat: 24.30, lon: 66.20 },
      { lat: 22.40, lon: 66.20 },
      { lat: 22.80, lon: 68.20 },
      { lat: 23.00, lon: 67.80 },
      { lat: 23.40, lon: 67.50 },
    ],
  },
  {
    id: "gulf-of-kutch-mpa",
    name: "Marine National Park & Sanctuary (Gulf of Kutch MPA)",
    type: "mpa",
    color: "#f59e0b",
    description: "Strict marine wildlife sanctuary and coral conservation zone",
    coordinates: [
      { lat: 22.45, lon: 69.15 },
      { lat: 22.60, lon: 69.80 },
      { lat: 22.50, lon: 70.30 },
      { lat: 22.30, lon: 69.50 },
    ],
  },
  {
    id: "thane-creek-sanctuary",
    name: "Thane Creek Flamingo Sanctuary Waters",
    type: "mpa",
    color: "#f59e0b",
    description: "Restricted ecological mangrove and migratory bird sanctuary",
    coordinates: [
      { lat: 19.04, lon: 72.94 },
      { lat: 19.16, lon: 72.98 },
      { lat: 19.14, lon: 73.03 },
      { lat: 19.02, lon: 72.98 },
    ],
  },
  {
    id: "malvan-marine-sanctuary",
    name: "Malvan Marine Sanctuary (Sindhudurg Protected Zone)",
    type: "mpa",
    color: "#f59e0b",
    description: "Coral reef and fisheries habitat conservation reserve",
    coordinates: [
      { lat: 16.02, lon: 73.42 },
      { lat: 16.12, lon: 73.48 },
      { lat: 16.08, lon: 73.54 },
      { lat: 15.98, lon: 73.46 },
    ],
  },
  {
    id: "indo-sl-imbl-zone",
    name: "Indo-Sri Lanka IMBL (Palk Strait / Katchatheevu Restricted Sector)",
    type: "imbl",
    color: "#ef4444",
    description: "International boundary corridor established by 1974/1976 bilateral treaties",
    coordinates: [
      { lat: 10.08, lon: 79.86 },
      { lat: 10.20, lon: 80.40 },
      { lat: 8.85, lon: 80.20 },
      { lat: 9.00, lon: 79.55 },
      { lat: 9.35, lon: 79.38 },
      { lat: 9.68, lon: 79.52 },
    ],
  },
  {
    id: "gulf-of-mannar-mpa",
    name: "Gulf of Mannar Marine National Park (UNESCO Biosphere)",
    type: "mpa",
    color: "#f59e0b",
    description: "Protected coral atolls and sea cow (dugong) biosphere reserve",
    coordinates: [
      { lat: 9.25, lon: 79.15 },
      { lat: 9.15, lon: 79.45 },
      { lat: 8.80, lon: 78.90 },
      { lat: 9.00, lon: 78.70 },
    ],
  },
  {
    id: "gahirmatha-marine-sanctuary",
    name: "Gahirmatha Marine Sanctuary (Odisha Strict Exclusion)",
    type: "mpa",
    color: "#f59e0b",
    description: "World's largest Olive Ridley sea turtle mass nesting sanctuary",
    coordinates: [
      { lat: 20.45, lon: 86.85 },
      { lat: 20.75, lon: 87.10 },
      { lat: 20.50, lon: 87.25 },
      { lat: 20.25, lon: 86.95 },
    ],
  },
];

/**
 * Standard Ray-Casting Algorithm for Point-in-Polygon
 * Time complexity: O(n) where n is polygon vertices
 */
export function isPointInPolygon(
  point: { lat: number; lon: number },
  vs: Array<{ lat: number; lon: number }>
): boolean {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].lon;
    const yi = vs[i].lat;
    const xj = vs[j].lon;
    const yj = vs[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Geodesic distance from a point to a line segment in Kilometers with closest point coordinates
 */
export function distancePointToSegmentKm(
  p: { lat: number; lon: number },
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): { distKm: number; closestPoint: { lat: number; lon: number } } {
  // Convert to Cartesian approximation using Equirectangular projection centered at p
  const degToRad = Math.PI / 180;

  const x = (p.lon - a.lon) * Math.cos(((a.lat + p.lat) / 2) * degToRad);
  const y = p.lat - a.lat;

  const dx = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * degToRad);
  const dy = b.lat - a.lat;

  const dot = x * dx + y * dy;
  const lenSq = dx * dx + dy * dy;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let nearestLat: number;
  let nearestLon: number;

  if (param < 0) {
    nearestLat = a.lat;
    nearestLon = a.lon;
  } else if (param > 1) {
    nearestLat = b.lat;
    nearestLon = b.lon;
  } else {
    nearestLat = a.lat + param * (b.lat - a.lat);
    nearestLon = a.lon + param * (b.lon - a.lon);
  }

  // Exact Haversine distance in NM then converted to km
  const distNM = calculateDistanceNM(p.lat, p.lon, nearestLat, nearestLon);
  const distKm = parseFloat((distNM * 1.852).toFixed(1));

  return {
    distKm,
    closestPoint: {
      lat: parseFloat(nearestLat.toFixed(4)),
      lon: parseFloat(nearestLon.toFixed(4)),
    },
  };
}

/**
 * Calculates minimum distance from point to polygon boundary in kilometers with closest boundary coordinate
 */
export function distanceToPolygonBoundaryKm(
  p: { lat: number; lon: number },
  polygonCoords: Array<{ lat: number; lon: number }>
): { minDistanceKm: number; closestPoint: { lat: number; lon: number } } {
  let minDistanceKm = Infinity;
  let closestPoint = { lat: polygonCoords[0].lat, lon: polygonCoords[0].lon };

  for (let i = 0; i < polygonCoords.length; i++) {
    const a = polygonCoords[i];
    const b = polygonCoords[(i + 1) % polygonCoords.length];
    const result = distancePointToSegmentKm(p, a, b);
    if (result.distKm < minDistanceKm) {
      minDistanceKm = result.distKm;
      closestPoint = result.closestPoint;
    }
  }

  return {
    minDistanceKm: minDistanceKm === Infinity ? 999 : minDistanceKm,
    closestPoint,
  };
}

/**
 * Comprehensive Deterministic Geofence Evaluation
 * 4 Structured States: SAFE | APPROACHING | CRITICAL_PROXIMITY | BREACH
 */
export function evaluateGeofence(userLocation: {
  latitude: number;
  longitude: number;
}): GeofenceEvaluation {
  const p = { lat: userLocation.latitude, lon: userLocation.longitude };
  const safeHarbor = resolveSafeHarbor(userLocation);

  // 1. Check if inside any restricted polygon -> BREACH
  for (const fence of STATUTORY_GEOFENCES) {
    if (isPointInPolygon(p, fence.coordinates)) {
      return {
        status: "BREACH",
        isInsideRestrictedZone: true,
        distanceToBoundaryKm: 0,
        nearestZoneName: fence.name,
        zoneType: fence.type,
        closestBoundaryPoint: { lat: p.lat, lon: p.lon },
        nearestSafeHarbor: safeHarbor,
        distanceToSafePortNM: safeHarbor.distanceNM,
        returnBearing: safeHarbor.bearing,
        recommendedAction: `Execute immediate 180° heading reversal away from ${fence.name} toward ${safeHarbor.name}`,
      };
    }
  }

  // 2. If outside all polygons, calculate minimum distance to closest boundary
  let closestZone = STATUTORY_GEOFENCES[0];
  let minDistanceKm = Infinity;
  let closestBoundaryPoint: { lat: number; lon: number } | null = null;

  for (const fence of STATUTORY_GEOFENCES) {
    const res = distanceToPolygonBoundaryKm(p, fence.coordinates);
    if (res.minDistanceKm < minDistanceKm) {
      minDistanceKm = res.minDistanceKm;
      closestZone = fence;
      closestBoundaryPoint = res.closestPoint;
    }
  }

  let status: GeofenceRiskStatus = "SAFE";
  let recommendedAction = `Continue planned passage; authorized sailing waters clear (${minDistanceKm} km from nearest boundary)`;

  if (minDistanceKm <= 25.0) {
    status = "CRITICAL_PROXIMITY";
    recommendedAction = `Immediate navigational alert: within 25 km critical buffer of ${closestZone.name}. Prepare heading alteration to ${safeHarbor.bearing}`;
  } else if (minDistanceKm <= 50.0) {
    status = "APPROACHING";
    recommendedAction = `Maintain navigational caution; approaching statutory boundary corridor (${minDistanceKm} km from ${closestZone.name})`;
  }

  return {
    status,
    isInsideRestrictedZone: false,
    distanceToBoundaryKm: minDistanceKm,
    nearestZoneName: closestZone.name,
    zoneType: closestZone.type,
    closestBoundaryPoint,
    nearestSafeHarbor: safeHarbor,
    distanceToSafePortNM: safeHarbor.distanceNM,
    returnBearing: safeHarbor.bearing,
    recommendedAction,
  };
}
