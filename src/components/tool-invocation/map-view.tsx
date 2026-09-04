"use client";

import { useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Compass } from "lucide-react";
import { JsonViewPopup } from "../json-view-popup";
import { cn } from "lib/utils";

export interface MapMarker {
  lat: number;
  lon: number;
  label: string;
  type: "current" | "hazard" | "safe_zone" | "pfz";
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
}

export interface MapPolygon {
  name: string;
  type: "imbl" | "mpa" | "hazard" | "safe" | "legal_zone";
  category?: string;
  coordinates: Array<{ lat: number; lon: number }>;
  color?: string;
  provenance?: {
    sourceName?: string;
    sourceDocument?: string;
    verificationStatus?: string;
    canTriggerAutonomousBoundaryIncident?: boolean;
  };
}

export interface MapViewProps {
  title?: string;
  description?: string;
  markers: MapMarker[];
  polygons?: MapPolygon[];
  path?: Array<{ lat: number; lon: number }>;
  pathLabel?: string;
  track?: Array<{ lat: number; lon: number }>;
  hudOverlay?: React.ReactNode;
  className?: string;
  mapHeight?: string;
}

export function MapView(props: MapViewProps) {
  const {
    title = "Coastal Maritime Tactical Map",
    description = "OpenStreetMap / Leaflet georeferenced maritime telemetry",
    markers = [],
    polygons = [],
    path,
    pathLabel = "Direct Bearing (Straight Line)",
    track,
    hudOverlay,
    className,
    mapHeight,
  } = props;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      // Dynamically import Leaflet and leaflet CSS
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Inject custom marker styles
      if (!document.getElementById("leaflet-custom-marker-style")) {
        const style = document.createElement("style");
        style.id = "leaflet-custom-marker-style";
        style.textContent = `
          .custom-leaflet-marker {
            background: transparent !important;
            border: none !important;
          }
          .leaflet-popup-content-wrapper {
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 2px;
          }
          .leaflet-popup-content {
            margin: 10px 12px;
            line-height: 1.4;
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.35; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.35); }
          }
        `;
        document.head.appendChild(style);
      }

      const L = await import("leaflet");

      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous instance if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Default center
      const defaultCenter: [number, number] =
        markers.length > 0 ? [markers[0].lat, markers[0].lon] : [18.922, 72.8347];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 8,
        zoomControl: true,
        attributionControl: true,
      });

      mapInstanceRef.current = map;

      // OpenStreetMap free tile server
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      const bounds = L.latLngBounds([]);

      // Marker color palette
      const getMarkerColor = (type: MapMarker["type"]) => {
        switch (type) {
          case "hazard":
            return "#ef4444"; // Red
          case "safe_zone":
            return "#10b981"; // Emerald Green
          case "pfz":
            return "#06b6d4"; // Cyan / Ocean Blue
          case "current":
          default:
            return "#3b82f6"; // Primary Blue
        }
      };

      // Add markers
      markers.forEach((m) => {
        const color = getMarkerColor(m.type);

        const typeLabel =
          m.type === "current"
            ? "Vessel Live Position"
            : m.type === "pfz"
            ? "Potential Fishing Zone Candidate"
            : m.type === "safe_zone"
            ? "Designated Safe Harbor"
            : "Maritime Exclusion / Hazard";

        // Heading rotation arrow HTML if heading is available
        const headingArrowHtml =
          m.type === "current" && m.heading != null
            ? `
            <div style="
              position: absolute;
              top: -6px;
              width: 0;
              height: 0;
              border-left: 4px solid transparent;
              border-right: 4px solid transparent;
              border-bottom: 8px solid white;
              transform: rotate(${m.heading}deg);
              transform-origin: center 20px;
            "></div>
          `
            : "";

        // Custom Leaflet DivIcon for modern glowing marker
        const iconHtml = `
          <div style="
            position: relative;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              position: absolute;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              background-color: ${color};
              opacity: 0.35;
              animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            "></div>
            <div style="
              position: relative;
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background-color: ${color};
              border: 2px solid white;
              box-shadow: 0 2px 5px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              ${headingArrowHtml}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "custom-leaflet-marker",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const popupContent = `
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #1e293b;">
            <div style="font-weight: 700; margin-bottom: 2px;">${m.label}</div>
            <div style="color: #64748b; font-size: 11px;">${m.lat.toFixed(4)}°N, ${m.lon.toFixed(4)}°E</div>
            ${m.speed != null ? `<div style="color: #334155; font-size: 11px; margin-top: 2px;">Speed: <strong>${m.speed} kts</strong></div>` : ""}
            ${m.heading != null ? `<div style="color: #334155; font-size: 11px;">Heading: <strong>${m.heading}°</strong></div>` : ""}
            <div style="margin-top: 4px; display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; background-color: #f1f5f9; color: #334155;">
              ${typeLabel}
            </div>
          </div>
        `;

        const marker = L.marker([m.lat, m.lon], { icon: customIcon }).addTo(map);
        marker.bindPopup(popupContent);
        bounds.extend([m.lat, m.lon]);
      });

      // Add recent breadcrumb track if provided
      if (track && track.length > 1) {
        const trackCoords = track.map((p) => [p.lat, p.lon] as [number, number]);
        L.polyline(trackCoords, {
          color: "#3b82f6",
          weight: 2,
          dashArray: "3, 6",
          opacity: 0.7,
        }).addTo(map);
      }

      // Add Geofenced Polygons if provided
      if (polygons && polygons.length > 0) {
        polygons.forEach((poly) => {
          const polyCoords = poly.coordinates.map((c) => [c.lat, c.lon] as [number, number]);
          if (polyCoords.length >= 3) {
            const isImbl = poly.type === "imbl" || poly.type === "hazard";
            const polyColor =
              poly.color ||
              (isImbl
                ? "#ef4444"
                : poly.type === "mpa"
                ? "#f59e0b"
                : "#10b981");

            const polygonLayer = L.polygon(polyCoords, {
              color: polyColor,
              weight: isImbl ? 2.5 : 1.5,
              fillColor: polyColor,
              fillOpacity: isImbl ? 0.22 : 0.15,
            }).addTo(map);

            polygonLayer.bindPopup(`
              <div style="font-family: sans-serif; font-size: 12px; color: #1e293b;">
                <strong style="color: ${polyColor};">${poly.name}</strong><br/>
                <span style="font-size: 11px; text-transform: uppercase; font-weight: 600;">
                  Classification: ${poly.category || (poly.type === "imbl" ? "International Maritime Boundary" : poly.type === "mpa" ? "Marine Protected Area / Sanctuary" : "Restricted Zone")}
                </span><br/>
                ${poly.provenance?.sourceDocument ? `<span style="font-size: 10px; color: #64748b;">Source: ${poly.provenance.sourceDocument}</span><br/>` : `<span style="font-size: 10px; color: #64748b;">Statutory Maritime Delimitation</span><br/>`}
                ${poly.provenance?.verificationStatus ? `<span style="font-size: 10px; font-weight: bold; color: ${poly.provenance.canTriggerAutonomousBoundaryIncident ? '#16a34a' : '#ea580c'};">Status: ${poly.provenance.verificationStatus}</span>` : ""}
              </div>
            `);

            polygonLayer.bindTooltip(poly.name, {
              sticky: true,
              direction: "top",
              className: "leaflet-polygon-tooltip text-xs font-semibold",
            });

            polyCoords.forEach((coord) => bounds.extend(coord));
          }
        });
      }

      // Add direct straight-line bearing path if provided
      if (path && path.length >= 2) {
        const polylineCoords = path.map((p) => [p.lat, p.lon] as [number, number]);
        const polyline = L.polyline(polylineCoords, {
          color: "#f59e0b",
          weight: 3,
          dashArray: "6, 8",
          opacity: 0.9,
        }).addTo(map);

        polyline.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; color: #1e293b;">
            <strong>Emergency Escape Vector</strong><br/>
            <span style="font-size: 11px; color: #d97706;">${pathLabel}</span>
          </div>
        `);
      }

      // Fit map to markers and boundaries
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 11 });
      }

      // Ensure proper sizing when rendered inside drawers or dynamic containers
      setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [markers, polygons, path, pathLabel, track]);

  return (
    <Card className={cn("w-full overflow-hidden border bg-card text-card-foreground shadow-sm relative", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-muted/20">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Compass className="size-4 text-primary" />
            {title}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {description}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-normal border-primary/40 text-primary">
            Leaflet / OSM
          </Badge>
          <JsonViewPopup
            data={{ title, markers, polygons, path, pathLabel }}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0 relative">
        {/* Floating Maritime Tactical HUD Overlay if provided */}
        {hudOverlay && (
          <div className="absolute top-2 left-2 right-2 z-10 pointer-events-none">
            <div className="pointer-events-auto">
              {hudOverlay}
            </div>
          </div>
        )}

        <div
          ref={mapContainerRef}
          className="w-full bg-muted/40 relative z-0"
          style={{ minHeight: mapHeight || "340px", height: mapHeight || "340px" }}
        />

        {/* Tactical Map Footer Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 px-3 bg-background/95 border-t text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-blue-500 inline-block" /> Live Vessel
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500 inline-block" /> Safe Harbor
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-red-500 inline-block" /> IMBL Border
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-500 inline-block" /> Sanctuary / MPA
            </span>
            {path && path.length >= 2 && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500 inline-block" /> Escape Vector
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/80 hidden sm:inline">
            Autonomous Maritime Geofence Engine
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
