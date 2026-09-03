/**
 * Deterministic Marine Geofence & Boundary Engine
 * Pure mathematical ray-casting and geodesic distance calculation.
 * Zero LLM hallucination.
 * Strictly Evidence-Based: Only VERIFIED_AUTHORITATIVE and VERIFIED_GOVERNMENT
 * boundaries can trigger autonomous incident escalation.
 */

import {
  calculateDistanceNM,
  resolveSafeHarbor,
} from "./marine-geospatial-engine";
import {
  AUTHORITATIVE_STATUTORY_GEOFENCES,
} from "./authoritative-maritime-data";
import {
  GeofenceEvaluation,
  GeofenceRiskStatus,
  StatutoryGeofenceDefinition,
} from "@/types/security";

export const STATUTORY_GEOFENCES: StatutoryGeofenceDefinition[] = AUTHORITATIVE_STATUTORY_GEOFENCES;

/**
 * Standard Ray-Casting Algorithm for Point-in-Polygon
 * Time complexity: O(n) where n is polygon vertices
 */
export function isPointInPolygon(
  point: { lat: number; lon: number },
  vs: Array<{ lat: number; lon: number }>
): boolean {
  if (!vs || vs.length < 3) return false;
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
  if (!polygonCoords || polygonCoords.length < 2) {
    return { minDistanceKm: Infinity, closestPoint: p };
  }

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
 * STRICT PROVENANCE ENFORCEMENT:
 * - Only verified government/authoritative boundaries with canTriggerAutonomousBoundaryIncident=true can return BREACH.
 * - Unverified or missing geometries are explicitly prevented from triggering breaches.
 */
export function evaluateGeofence(userLocation: {
  latitude: number;
  longitude: number;
}): GeofenceEvaluation {
  const p = { lat: userLocation.latitude, lon: userLocation.longitude };
  const safeHarbor = resolveSafeHarbor(userLocation);

  // Filter polygons that have valid geometries
  const validFences = STATUTORY_GEOFENCES.filter((f) => f.coordinates && f.coordinates.length >= 3);

  // 1. Check if inside any verified restricted polygon -> BREACH
  for (const fence of validFences) {
    if (isPointInPolygon(p, fence.coordinates)) {
      const isAuthoritative =
        fence.provenance.verificationStatus === "VERIFIED_AUTHORITATIVE" ||
        fence.provenance.verificationStatus === "VERIFIED_GOVERNMENT";
      const canTrigger = isAuthoritative && fence.provenance.canTriggerAutonomousBoundaryIncident;

      if (canTrigger) {
        return {
          status: "BREACH",
          isInsideRestrictedZone: true,
          distanceToBoundaryKm: 0,
          nearestZoneName: fence.name,
          zoneType: fence.type,
          category: fence.category,
          bufferClassification: "BREACH",
          closestBoundaryPoint: { lat: p.lat, lon: p.lon },
          nearestSafeHarbor: safeHarbor,
          distanceToSafePortNM: safeHarbor.distanceNM,
          returnBearing: safeHarbor.bearing,
          recommendedAction: `Execute immediate heading reversal to ${safeHarbor.bearing} toward ${safeHarbor.name}. Vessel has crossed statutory ${fence.name}.`,
          provenance: fence.provenance,
          canTriggerAutonomousBreach: true,
        };
      } else {
        // Unverified or disputed boundary (e.g. Indo-Pak un-demarcated line)
        // Hard safety rule: CANNOT trigger breach
        return {
          status: "SAFE",
          isInsideRestrictedZone: false,
          distanceToBoundaryKm: 0,
          nearestZoneName: fence.name,
          zoneType: fence.type,
          category: fence.category,
          bufferClassification: "NORMAL",
          closestBoundaryPoint: { lat: p.lat, lon: p.lon },
          nearestSafeHarbor: safeHarbor,
          distanceToSafePortNM: safeHarbor.distanceNM,
          returnBearing: safeHarbor.bearing,
          recommendedAction: `Navigational advisory for ${fence.name}. Autonomous breach escalation disabled: ${fence.provenance.notes || "Geometry unverified under UNCLOS"}.`,
          provenance: fence.provenance,
          canTriggerAutonomousBreach: false,
          integrityNote: "Unverified / Disputed sector: Autonomous breach disabled",
        };
      }
    }
  }

  // 2. If outside all polygons, calculate minimum distance to closest boundary
  let closestZone = validFences[0] || STATUTORY_GEOFENCES[0];
  let minDistanceKm = Infinity;
  let closestBoundaryPoint: { lat: number; lon: number } | null = null;

  for (const fence of validFences) {
    const res = distanceToPolygonBoundaryKm(p, fence.coordinates);
    if (res.minDistanceKm < minDistanceKm) {
      minDistanceKm = res.minDistanceKm;
      closestZone = fence;
      closestBoundaryPoint = res.closestPoint;
    }
  }

  let status: GeofenceRiskStatus = "SAFE";
  let bufferClassification: "NORMAL" | "SYSTEM_SAFETY_BUFFER_APPROACHING" | "SYSTEM_SAFETY_BUFFER_CRITICAL" = "NORMAL";
  let recommendedAction = `Continue planned passage; authorized sailing waters clear (${minDistanceKm} km from ${closestZone.name})`;

  // System Safety Buffers (Operational settings, clearly labeled)
  if (minDistanceKm <= 25.0) {
    status = "CRITICAL_PROXIMITY";
    bufferClassification = "SYSTEM_SAFETY_BUFFER_CRITICAL";
    recommendedAction = `System Safety Buffer Warning: within 25 km operational buffer of ${closestZone.name}. Maintain heading alteration readiness toward ${safeHarbor.name} (${safeHarbor.bearing})`;
  } else if (minDistanceKm <= 50.0) {
    status = "APPROACHING";
    bufferClassification = "SYSTEM_SAFETY_BUFFER_APPROACHING";
    recommendedAction = `System Safety Buffer Advisory: approaching within 50 km operational buffer of ${closestZone.name} (${minDistanceKm} km)`;
  }

  return {
    status,
    isInsideRestrictedZone: false,
    distanceToBoundaryKm: minDistanceKm,
    nearestZoneName: closestZone.name,
    zoneType: closestZone.type,
    category: closestZone.category,
    bufferClassification,
    closestBoundaryPoint,
    nearestSafeHarbor: safeHarbor,
    distanceToSafePortNM: safeHarbor.distanceNM,
    returnBearing: safeHarbor.bearing,
    recommendedAction,
    provenance: closestZone.provenance,
    canTriggerAutonomousBreach: closestZone.provenance.canTriggerAutonomousBoundaryIncident,
  };
}
