"use client";

import { appStore } from "@/app/store";
import { cn } from "lib/utils";
import { useState } from "react";
import { Button } from "ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "ui/drawer";
import { Badge } from "ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "ui/card";
import { ScrollArea } from "ui/scroll-area";
import { Separator } from "ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Maximize2,
  Minimize2,
  X,
  Radio,
  Navigation,
  Copy,
  Check,
  PhoneCall,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useShallow } from "zustand/shallow";
import { useVesselSecurity } from "@/hooks/use-vessel-security";
import { MapView } from "@/components/tool-invocation/map-view";
import { toast } from "sonner";

export function VesselSecurityPanel() {
  const [securityPanel, appStoreMutate] = appStore(
    useShallow((state) => [state.securityPanel, state.mutate])
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const {
    overallLevel,
    telemetry,
    activeCoords,
    geofence,
    weather,
    cyclone,
    incident,
    polygons,
    refreshWeather,
  } = useVesselSecurity();

  const setOpen = (bool: boolean) => {
    appStoreMutate({
      securityPanel: {
        isOpen: bool,
      },
    });
  };

  // Build tactical map markers from live security state
  const mapMarkers = [
    {
      lat: activeCoords.latitude,
      lon: activeCoords.longitude,
      label: incident.isIncident
        ? `🚨 RESTRICTED ZONE BREACH (${activeCoords.latitude.toFixed(4)}°N, ${activeCoords.longitude.toFixed(4)}°E)`
        : `📍 Vessel Position (${activeCoords.latitude.toFixed(4)}°N, ${activeCoords.longitude.toFixed(4)}°E)`,
      type: (incident.isIncident ? "hazard" : "current") as "hazard" | "current",
    },
    ...(geofence.nearestSafeHarbor
      ? [
          {
            lat: geofence.nearestSafeHarbor.latitude,
            lon: geofence.nearestSafeHarbor.longitude,
            label: `⚓ Safe Harbor: ${geofence.nearestSafeHarbor.name} (${geofence.nearestSafeHarbor.distanceNM} NM, ${geofence.nearestSafeHarbor.bearing})`,
            type: "safe_zone" as const,
          },
        ]
      : []),
  ];

  const mapPath = geofence.nearestSafeHarbor
    ? [
        { lat: activeCoords.latitude, lon: activeCoords.longitude },
        { lat: geofence.nearestSafeHarbor.latitude, lon: geofence.nearestSafeHarbor.longitude },
      ]
    : undefined;

  const copyDistressReport = () => {
    const report = `========================================
SOLAS MARITIME INCIDENT DISPATCH REPORT
SAGARDRISHTI-AI VESSEL SAFETY OPS
========================================
INCIDENT ID: ${incident.incidentId || "INC-IND-MANUAL"}
TIMESTAMP: ${new Date().toISOString()}
VESSEL STATUS: ${incident.severity} - ${incident.title || "OPERATIONAL ALERT"}
VIOLATED ZONE: ${incident.violatedZone || "N/A"}
DURATION IN ZONE: ${incident.durationMinutes} minutes

CURRENT GNSS TELEMETRY:
- Latitude: ${activeCoords.latitude.toFixed(4)}°N
- Longitude: ${activeCoords.longitude.toFixed(4)}°E
- Speed Over Ground: ${telemetry.speedKts != null ? `${telemetry.speedKts} kts` : "Unavailable"}
- Compass Heading: ${telemetry.headingCardinal || "Unavailable"}

SAFETY & RESCUE DIRECTIVE:
- Nearest Safe Harbor: ${geofence.nearestSafeHarbor.name} (${geofence.nearestSafeHarbor.state})
- Distance to Safe Harbor: ${geofence.nearestSafeHarbor.distanceNM} NM (${geofence.nearestSafeHarbor.distanceKm} km)
- Emergency Heading Azimuth: ${geofence.returnBearing}
- Assigned SAR Station: ${geofence.nearestSafeHarbor.coastGuardStation}

EMERGENCY CONTACT CHANNELS:
- Indian Coast Guard MRCC: 1554
- International VHF Calling & Distress: VHF Ch 16 (156.800 MHz)
- Coastal Marine Police: 1093
========================================`;

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    toast.success("Official Incident Report copied to clipboard");
    setTimeout(() => setCopiedReport(false), 2500);
  };

  return (
    <Drawer
      handleOnly
      direction="right"
      open={securityPanel?.isOpen ?? false}
      onOpenChange={setOpen}
    >
      <DrawerContent
        style={{ userSelect: "text" }}
        className={cn(
          "px-4 flex flex-col transition-all duration-300 z-50",
          isFullscreen
            ? "w-screen max-w-none h-full rounded-none inset-0"
            : "w-full md:w-[720px] lg:w-[820px] h-full"
        )}
      >
        {/* Panel Header */}
        <DrawerHeader className="px-0 py-3 border-b border-border/40 mb-2">
          <DrawerTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "size-8 rounded-lg flex items-center justify-center transition-colors",
                  overallLevel === "CRITICAL"
                    ? "bg-red-500/15 text-red-500 border border-red-500/30"
                    : overallLevel === "WARNING"
                    ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                )}
              >
                {overallLevel === "CRITICAL" ? (
                  <ShieldAlert className="size-4 animate-pulse" />
                ) : overallLevel === "WARNING" ? (
                  <ShieldAlert className="size-4" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm sm:text-base">
                    Vessel Safety & Security
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5",
                      overallLevel === "CRITICAL"
                        ? "bg-red-500/15 text-red-500 border-red-500/30 animate-pulse"
                        : overallLevel === "WARNING"
                        ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    )}
                  >
                    {overallLevel}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">
                  Live GNSS Geofence, IMO Risk Standards & Kinetic Incident Operations
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Fullscreen Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full size-8"
                    onClick={() => setIsFullscreen((prev) => !prev)}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="size-4" />
                    ) : (
                      <Maximize2 className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen Panel"}
                </TooltipContent>
              </Tooltip>

              {/* Close Drawer */}
              <DrawerClose asChild>
                <Button
                  variant="secondary"
                  className="flex items-center gap-1 rounded-full h-8 px-3"
                >
                  <X className="size-4" />
                  <Separator orientation="vertical" className="h-3" />
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ESC
                  </span>
                </Button>
              </DrawerClose>
            </div>
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Vessel Safety and Security Operations Monitor
          </DrawerDescription>
        </DrawerHeader>

        {/* Panel Body Scroll Area */}
        <ScrollArea className="flex-1 -mx-4 px-4 pr-3.5 pb-6">
          <div className="flex flex-col gap-4">
            {/* INCIDENT ALERT CARD (Visible when violation or incident is active) */}
            {incident.isIncident && (
              <Card className="border-red-500/40 bg-red-500/10 shadow-xs">
                <CardHeader className="pb-2 pt-3 px-3.5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertTriangle className="size-4 animate-ping" />
                      {incident.title}
                    </CardTitle>
                    <Badge variant="destructive" className="text-[10px] uppercase font-mono">
                      {incident.incidentId}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-3.5 pb-3.5 text-xs flex flex-col gap-2.5">
                  <p className="text-foreground/90 font-medium leading-relaxed">
                    {incident.description}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1.5 px-2.5 rounded-lg bg-background/60 border border-red-500/20 font-mono text-[11px]">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Zone Breached</span>
                      <span className="font-semibold text-red-500 truncate block">
                        {incident.violatedZone}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Duration in Zone</span>
                      <span className="font-semibold">{incident.durationMinutes} min</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Breach Coords</span>
                      <span className="font-semibold">
                        {activeCoords.latitude.toFixed(3)}°N, {activeCoords.longitude.toFixed(3)}°E
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Escape Heading</span>
                      <span className="font-semibold text-emerald-500">{geofence.returnBearing}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-foreground">
                        Recommended Directive:
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {incident.recommendedAction}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="shrink-0 h-7 text-xs font-semibold gap-1.5"
                      onClick={copyDistressReport}
                    >
                      {copiedReport ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copiedReport ? "Copied" : "Copy Distress Report"}
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <PhoneCall className="size-3 text-red-500" /> Statutory Emergency Contacts:
                    </span>
                    <a href="tel:1554" className="hover:text-foreground font-mono underline decoration-dotted">
                      Coast Guard: 1554
                    </a>
                    <span className="font-mono">VHF: Ch 16 (156.8 MHz)</span>
                    <a href="tel:1093" className="hover:text-foreground font-mono underline decoration-dotted">
                      Coastal Police: 1093
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SECTION 1 — LIVE VESSEL TELEMETRY */}
            <Card className="border-border/60 shadow-2xs">
              <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <Radio className="size-3.5 text-primary" />
                    Live Vessel Telemetry
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-mono font-medium tracking-tight flex items-center gap-1"
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        telemetry.trackingStatus === "ACTIVE_GNSS"
                          ? "bg-emerald-500 animate-pulse"
                          : telemetry.trackingStatus === "CACHED_POSITION"
                          ? "bg-amber-500"
                          : "bg-muted-foreground"
                      )}
                    />
                    {telemetry.trackingStatus}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Latitude</span>
                    <span className="font-mono font-semibold text-foreground">
                      {telemetry.latitude != null ? `${telemetry.latitude.toFixed(4)}°N` : "Unavailable"}
                    </span>
                  </div>
                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Longitude</span>
                    <span className="font-mono font-semibold text-foreground">
                      {telemetry.longitude != null ? `${telemetry.longitude.toFixed(4)}°E` : "Unavailable"}
                    </span>
                  </div>
                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Speed Over Ground</span>
                    <span className="font-mono font-semibold text-foreground">
                      {telemetry.speedKts != null ? `${telemetry.speedKts} kts` : "Unavailable"}
                    </span>
                  </div>
                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Compass Heading</span>
                    <span className="font-mono font-semibold text-foreground truncate block">
                      {telemetry.headingCardinal || "Unavailable"}
                    </span>
                  </div>
                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">GPS Accuracy</span>
                    <span className="font-mono font-semibold text-foreground">
                      {telemetry.accuracy != null ? `±${telemetry.accuracy}m` : "Unavailable"}
                    </span>
                  </div>
                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Last Position Update</span>
                    <span className="font-mono font-semibold text-foreground">
                      {telemetry.timestamp ? new Date(telemetry.timestamp).toLocaleTimeString() : "Unavailable"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 2 — LIVE TACTICAL MAP */}
            <div className="w-full">
              <MapView
                title="Vessel Tactical Position & Geofence Map"
                description="Live GNSS position overlaid with statutory international borders & marine protected sanctuaries"
                markers={mapMarkers}
                polygons={polygons}
                path={mapPath}
                pathLabel={
                  geofence.nearestSafeHarbor
                    ? `Escape Vector to ${geofence.nearestSafeHarbor.name} (${geofence.returnBearing})`
                    : undefined
                }
                mapHeight="340px"
              />
            </div>

            {/* SECTION 3 — SECURITY CONDITIONS */}
            <Card className="border-border/60 shadow-2xs">
              <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <Shield className="size-3.5 text-primary" />
                    Security & Environmental Conditions
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={refreshWeather}
                  >
                    <RefreshCw className="size-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 flex flex-col gap-2">
                {/* 1. GNSS Tracking Condition */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/25 border border-border/40 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        telemetry.trackingStatus === "ACTIVE_GNSS"
                          ? "bg-emerald-500"
                          : telemetry.trackingStatus === "CACHED_POSITION"
                          ? "bg-amber-500"
                          : "bg-red-500"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">Continuous GPS Tracking</span>
                      <span className="text-[11px] text-muted-foreground">
                        {telemetry.trackingStatus === "ACTIVE_GNSS"
                          ? `Device hardware GNSS streaming active (Accuracy: ±${telemetry.accuracy || 10}m)`
                          : telemetry.trackingStatus === "CACHED_POSITION"
                          ? "Using cached device coordinates; continuous streaming standby"
                          : "Device GPS unavailable; coastal anchor reference loaded"}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono",
                      telemetry.trackingStatus === "ACTIVE_GNSS"
                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-500/40 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {telemetry.trackingStatus === "ACTIVE_GNSS" ? "ACTIVE" : "STANDBY"}
                  </Badge>
                </div>

                {/* 2. Geofence Condition */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/25 border border-border/40 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        geofence.status === "OUTSIDE_PERMITTED_AREA"
                          ? "bg-red-500 animate-pulse"
                          : geofence.status === "GEOFENCE_WARNING"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">
                        Geofence & Boundary Proximity
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {geofence.isInsideRestrictedZone
                          ? `BREACH: Inside ${geofence.nearestZoneName}`
                          : geofence.distanceToBoundaryKm != null
                          ? `${geofence.distanceToBoundaryKm} km from ${geofence.nearestZoneName}`
                          : "Within authorized coastal sailing waters"}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono",
                      geofence.status === "OUTSIDE_PERMITTED_AREA"
                        ? "border-red-500/40 text-red-500"
                        : geofence.status === "GEOFENCE_WARNING"
                        ? "border-amber-500/40 text-amber-500"
                        : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {geofence.status === "OUTSIDE_PERMITTED_AREA"
                      ? "BREACH"
                      : geofence.status === "GEOFENCE_WARNING"
                      ? "WARNING"
                      : geofence.status === "APPROACHING_RESTRICTED_ZONE"
                      ? "ADVISORY"
                      : "SAFE"}
                  </Badge>
                </div>

                {/* 3. Marine Weather Condition */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/25 border border-border/40 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        weather.status === "CRITICAL"
                          ? "bg-red-500 animate-pulse"
                          : weather.status === "WARNING"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">
                        Marine Weather & Wave Mechanics (IMO FSA)
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {weather.summary}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono",
                      weather.status === "CRITICAL"
                        ? "border-red-500/40 text-red-500"
                        : weather.status === "WARNING"
                        ? "border-amber-500/40 text-amber-500"
                        : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {weather.status}
                  </Badge>
                </div>

                {/* 4. Tropical Cyclone Threat */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/25 border border-border/40 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        cyclone.status === "CRITICAL"
                          ? "bg-red-500"
                          : cyclone.status === "WARNING"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">
                        Tropical Cyclone & Gale Cone Monitoring
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {cyclone.summary}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono",
                      cyclone.status === "CRITICAL"
                        ? "border-red-500/40 text-red-500"
                        : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {cyclone.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* SAFE HARBOR RETURN VECTOR CARD */}
            {geofence.nearestSafeHarbor && (
              <Card className="border-border/60 shadow-2xs">
                <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <Navigation className="size-3.5 text-primary" />
                    Nearest Verified Indian Safe Harbor
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 text-xs flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground">
                        {geofence.nearestSafeHarbor.name} ({geofence.nearestSafeHarbor.state})
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        Designated Harbor Anchor: {geofence.nearestSafeHarbor.harbor}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right font-mono">
                        <span className="font-bold text-primary block">
                          {geofence.nearestSafeHarbor.distanceNM} NM
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({geofence.nearestSafeHarbor.distanceKm} km)
                        </span>
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-1">
                        Bearing: {geofence.returnBearing}
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-2 border-t text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Assigned SAR Coordination Center:</span>
                    <span className="font-medium text-foreground">{geofence.nearestSafeHarbor.coastGuardStation}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
