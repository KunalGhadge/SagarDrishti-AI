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

export interface MapMarker {
  lat: number;
  lon: number;
  label: string;
  type: "current" | "hazard" | "safe_zone" | "pfz";
  isSimulated?: boolean;
}

export interface MapViewProps {
  title?: string;
  description?: string;
  markers: MapMarker[];
  path?: Array<{ lat: number; lon: number }>;
  pathLabel?: string;
}

export function MapView(props: MapViewProps) {
  const {
    title = "Coastal Maritime Tactical Map",
    description = "OpenStreetMap / Leaflet georeferenced maritime telemetry",
    markers = [],
    path,
    pathLabel = "Direct Bearing (Straight Line)",
  } = props;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      // Ensure leaflet CSS is loaded
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
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

      // Marker icon factory
      const getMarkerColor = (type: MapMarker["type"]) => {
        switch (type) {
          case "hazard":
            return "#ef4444"; // Red
          case "safe_zone":
            return "#10b981"; // Green
          case "pfz":
            return "#06b6d4"; // Cyan
          case "current":
          default:
            return "#3b82f6"; // Blue
        }
      };

      // Add markers
      markers.forEach((m) => {
        const color = getMarkerColor(m.type);
        const isSimulated = m.isSimulated;

        // Custom Leaflet DivIcon for modern glowing marker
        const iconHtml = `
          <div style="
            position: relative;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              position: absolute;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background-color: ${color};
              opacity: 0.3;
            "></div>
            <div style="
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background-color: ${color};
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "custom-leaflet-marker",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const popupContent = `
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #1e293b;">
            <div style="font-weight: 700; margin-bottom: 2px;">${m.label}</div>
            <div style="color: #64748b; font-size: 11px;">${m.lat.toFixed(4)}°N, ${m.lon.toFixed(4)}°E</div>
            <div style="margin-top: 4px; display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; background-color: ${
              isSimulated ? "#fef3c7" : "#dcfce7"
            }; color: ${isSimulated ? "#92400e" : "#166534"};">
              ${isSimulated ? "Simulated Baseline" : "Verified Real Position"}
            </div>
          </div>
        `;

        const marker = L.marker([m.lat, m.lon], { icon: customIcon }).addTo(map);
        marker.bindPopup(popupContent);
        bounds.extend([m.lat, m.lon]);
      });

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
          <div style="font-family: sans-serif; font-size: 11px; color: #1e293b;">
            <strong>${pathLabel}</strong><br/>
            Direct compass vector (not a navigation route).
          </div>
        `);

        polylineCoords.forEach((coord) => bounds.extend(coord));
      }

      // Auto fit map bounds if markers exist
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
      }
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [markers, path, pathLabel]);

  return (
    <Card className="w-full overflow-hidden border bg-card text-card-foreground shadow-sm">
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
            data={{ title, markers, path, pathLabel }}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={mapContainerRef}
          className="h-[320px] w-full bg-muted/40 relative z-0"
          style={{ minHeight: "320px" }}
        />
        {/* Minimal legend footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 px-3 bg-background/95 border-t text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500 inline-block" /> Safe Harbor
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-cyan-500 inline-block" /> PFZ Zone (simulated)
            </span>
            {path && path.length >= 2 && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500 inline-block" /> Direct Bearing Line
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/80">
            Open-source OpenStreetMap Cartography
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
