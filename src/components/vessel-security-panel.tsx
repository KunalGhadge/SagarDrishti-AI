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
  Wind,
  Waves,
  Compass,
  Anchor,
  Clock,
  MapPin,
  CheckCircle2,
  AlertOctagon,
  Info,
} from "lucide-react";
import { useShallow } from "zustand/shallow";
import { useVesselSecurity } from "@/hooks/use-vessel-security";
import { MapView, MapMarker } from "@/components/tool-invocation/map-view";
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
    trackHistory,
    geofence,
    weather,
    cyclone,
    incident,
    activeAlerts,
    polygons,
    requestLocation,
    refreshWeather,
  } = useVesselSecurity();

  const setOpen = (bool: boolean) => {
    appStoreMutate({
      securityPanel: {
        isOpen: bool,
      },
    });
  };

  // Build tactical map markers with dynamic heading & speed
  const mapMarkers: MapMarker[] = [
    {
      lat: activeCoords.latitude,
      lon: activeCoords.longitude,
      label: !activeCoords.isLive
        ? "Reference Coastal Sector (Waiting for Device GNSS)"
        : incident.isIncident
        ? `🚨 RESTRICTED ZONE BREACH (${activeCoords.latitude.toFixed(4)}°N, ${activeCoords.longitude.toFixed(4)}°E)`
        : `📍 Vessel Position (${activeCoords.latitude.toFixed(4)}°N, ${activeCoords.longitude.toFixed(4)}°E)`,
      type: incident.isIncident ? "hazard" : "current",
      heading: telemetry.headingDegrees,
      speed: telemetry.speedKts,
      accuracy: telemetry.accuracy,
    },
    ...(geofence.nearestSafeHarbor
      ? [
          {
            lat: geofence.nearestSafeHarbor.latitude,
            lon: geofence.nearestSafeHarbor.longitude,
            label: `⚓ Safe Port: ${geofence.nearestSafeHarbor.name} (${geofence.nearestSafeHarbor.distanceNM} NM • ${geofence.nearestSafeHarbor.bearing})`,
            type: "safe_zone" as const,
          },
        ]
      : []),
  ];

  // Emergency escape polyline vector
  const mapPath = geofence.nearestSafeHarbor
    ? [
        { lat: activeCoords.latitude, lon: activeCoords.longitude },
        { lat: geofence.nearestSafeHarbor.latitude, lon: geofence.nearestSafeHarbor.longitude },
      ]
    : undefined;

  // Track breadcrumbs coordinates
  const mapTrack = trackHistory.map((t) => ({ lat: t.lat, lon: t.lon }));

  const copyDistressReport = () => {
    const report = `========================================
SOLAS MARITIME INCIDENT DISPATCH REPORT
SAGARDRISHTI-AI VESSEL SAFETY OPS
========================================
INCIDENT ID: ${incident.incidentId || "INC-IND-ACTIVE"}
TIMESTAMP: ${new Date().toISOString()}
VESSEL STATUS: ${incident.severity} - ${incident.title || "OPERATIONAL ALERT"}
VIOLATED ZONE: ${incident.violatedZone || "N/A"}
DURATION IN ZONE: ${incident.durationMinutes} minutes

CURRENT GNSS TELEMETRY:
- Latitude: ${activeCoords.isLive ? `${activeCoords.latitude.toFixed(4)}°N` : "Unavailable (Pending Fix)"}
- Longitude: ${activeCoords.isLive ? `${activeCoords.longitude.toFixed(4)}°E` : "Unavailable (Pending Fix)"}
- Speed Over Ground: ${telemetry.speedKts != null ? `${telemetry.speedKts} kts` : "Unavailable"}
- Compass Heading: ${telemetry.headingCardinal || "Unavailable"}
- GPS Accuracy: ${telemetry.accuracy != null ? `±${telemetry.accuracy}m` : "Unavailable"}

SAFETY & RESCUE DIRECTIVE:
- Nearest Designated Safe Port: ${geofence.nearestSafeHarbor.name} (${geofence.nearestSafeHarbor.state})
- Harbor Anchor: ${geofence.nearestSafeHarbor.harbor}
- Nautical Distance: ${geofence.nearestSafeHarbor.distanceNM} NM (${geofence.nearestSafeHarbor.distanceKm} km)
- Emergency Heading Azimuth: ${geofence.returnBearing}
- Assigned SAR Coordination Center: ${geofence.nearestSafeHarbor.coastGuardStation}

EMERGENCY CONTACT CHANNELS:
- Indian Coast Guard MRCC: 1554 (Toll-Free 24x7)
- International Distress & Calling: VHF Ch 16 (156.800 MHz)
- Coastal Police: 1093
========================================`;

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    toast.success("Official SOLAS Incident Report copied to clipboard");
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
            : "w-full md:w-[740px] lg:w-[840px] h-full"
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
                    VESSEL SECURITY
                  </span>
                  <span className="text-muted-foreground text-xs hidden sm:inline">•</span>
                  <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
                    LIVE AUTONOMOUS MONITORING
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
                  Continuous GNSS Geofencing, Environmental Hazard Analysis & Kinematic Operations
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
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen Operations Console"}
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
            Autonomous Maritime Vessel Safety and Security Monitoring Console
          </DrawerDescription>
        </DrawerHeader>

        {/* Panel Body Scroll Area */}
        <ScrollArea className="flex-1 -mx-4 px-4 pr-3.5 pb-6">
          <div className="flex flex-col gap-4">
            {/* GPS UNAVAILABLE WARNING BANNER (Rendered honestly when browser GPS is unacquired) */}
            {telemetry.trackingStatus === "UNAVAILABLE" && (
              <Card className="border-amber-500/40 bg-amber-500/10 shadow-2xs">
                <CardContent className="p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-600 dark:text-amber-400 block text-xs">
                        GPS SIGNAL UNAVAILABLE — WAITING FOR DEVICE GNSS FIX
                      </span>
                      <span className="text-muted-foreground text-[11px] block mt-0.5">
                        Hardware GNSS coordinates are currently unacquired. Displaying regional coastal reference data. Live kinematic geofence alerts require active position streaming.
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 gap-1.5"
                    onClick={() => requestLocation()}
                  >
                    <Radio className="size-3 animate-pulse" />
                    Acquire Device GNSS
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* HIGH SEVERITY INCIDENT ALERT CARD (Visible when breach or kinematic anomaly is detected) */}
            {incident.isIncident && (
              <Card className="border-red-500/50 bg-red-500/10 shadow-xs">
                <CardHeader className="pb-2 pt-3 px-3.5 border-b border-red-500/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertOctagon className="size-4 animate-ping text-red-500" />
                      {incident.title}
                    </CardTitle>
                    <Badge variant="destructive" className="text-[10px] uppercase font-mono tracking-wider">
                      {incident.incidentId}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-3.5 pt-3 pb-3 text-xs flex flex-col gap-3">
                  <p className="text-foreground/90 font-medium leading-relaxed">
                    {incident.description}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 px-2.5 rounded-lg bg-background/80 border border-red-500/25 font-mono text-[11px]">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Zone Breached</span>
                      <span className="font-semibold text-red-500 truncate block">
                        {incident.violatedZone}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Restricted Dwell</span>
                      <span className="font-semibold">{incident.durationMinutes} min</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Breach GNSS</span>
                      <span className="font-semibold">
                        {activeCoords.latitude.toFixed(3)}°N, {activeCoords.longitude.toFixed(3)}°E
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Escape Heading</span>
                      <span className="font-semibold text-emerald-500">{geofence.returnBearing}</span>
                    </div>
                  </div>

                  {/* Incident Timeline with real timestamps */}
                  {incident.timeline && incident.timeline.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-background/60 border border-border/50 flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Clock className="size-3 text-primary" /> Incident Detection Timeline (Real Execution)
                      </span>
                      <div className="flex flex-col gap-1 font-mono text-[11px]">
                        {incident.timeline.map((entry, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-muted-foreground shrink-0">{entry.timestamp}</span>
                            <span className="text-muted-foreground shrink-0">—</span>
                            <span
                              className={cn(
                                "leading-tight",
                                entry.severity === "CRITICAL"
                                  ? "text-red-500 font-semibold"
                                  : entry.severity === "WARNING"
                                  ? "text-amber-500"
                                  : "text-foreground"
                              )}
                            >
                              {entry.event}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Directive & Distress Dispatch Action */}
                  <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-foreground">
                        Statutory Navigational Directive:
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {incident.recommendedAction}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="shrink-0 h-7 text-xs font-semibold gap-1.5 shadow-sm"
                      onClick={copyDistressReport}
                    >
                      {copiedReport ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copiedReport ? "Copied" : "Copy Distress Report"}
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <PhoneCall className="size-3 text-red-500" /> Emergency SAR Radios:
                    </span>
                    <a href="tel:1554" className="hover:text-foreground font-mono underline decoration-dotted">
                      Coast Guard MRCC: 1554
                    </a>
                    <span className="font-mono">VHF Calling: Ch 16 (156.8 MHz)</span>
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
                        telemetry.trackingStatus === "LIVE_GNSS"
                          ? "bg-emerald-500 animate-pulse"
                          : telemetry.trackingStatus === "CACHED_POSITION"
                          ? "bg-amber-500"
                          : "bg-red-500"
                      )}
                    />
                    {telemetry.trackingStatus === "LIVE_GNSS"
                      ? "LIVE GNSS (STREAMING)"
                      : telemetry.trackingStatus === "CACHED_POSITION"
                      ? "CACHED GNSS FIX"
                      : "GPS SIGNAL UNAVAILABLE"}
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
                    <span className="text-[10px] text-muted-foreground block font-medium">Last GNSS Update</span>
                    <span className="font-mono font-semibold text-foreground">
                      {telemetry.timestamp ? new Date(telemetry.timestamp).toLocaleTimeString() : "Unavailable"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 2 — TACTICAL MARITIME MAP WITH FLOATING HUD */}
            <div className="w-full">
              <MapView
                title="Tactical Maritime Navigation & Boundary Operations"
                description="Real-time georeferenced OSM tactical overlay with IMBL sectors, MPAs, and escape vectors"
                markers={mapMarkers}
                polygons={polygons}
                path={mapPath}
                track={mapTrack}
                pathLabel={
                  geofence.nearestSafeHarbor
                    ? `Direct Heading to ${geofence.nearestSafeHarbor.name} (${geofence.returnBearing})`
                    : undefined
                }
                hudOverlay={
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 px-3 rounded-lg bg-background/90 backdrop-blur-md border border-border/60 shadow-md text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <Anchor className="size-3.5 text-emerald-500" />
                      <span className="text-muted-foreground">NEAREST SAFE PORT:</span>
                      <strong className="text-foreground">
                        {geofence.nearestSafeHarbor.name}
                      </strong>
                      <span className="text-primary font-bold">
                        • {geofence.nearestSafeHarbor.distanceNM} NM • Bearing {geofence.returnBearing}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">GEOFENCE:</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono",
                          geofence.status === "BREACH"
                            ? "border-red-500 text-red-500 bg-red-500/10"
                            : geofence.status === "CRITICAL_PROXIMITY"
                            ? "border-amber-500 text-amber-500 bg-amber-500/10"
                            : "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                        )}
                      >
                        {geofence.status} ({geofence.distanceToBoundaryKm} km to {geofence.nearestZoneName})
                      </Badge>
                    </div>
                  </div>
                }
                mapHeight="360px"
              />
            </div>

            {/* SECTION 3 — ACTIVE ALERTS SECTION (Real monitored events only) */}
            <Card className="border-border/60 shadow-2xs">
              <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-primary" />
                    Active Alerts ({activeAlerts.length})
                  </CardTitle>
                  <span className="text-[10px] text-muted-foreground">
                    Derived strictly from live sensor & geospatial engines
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-3 flex flex-col gap-2">
                {activeAlerts.length === 0 ? (
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 block text-xs">
                        ALL MONITORED SYSTEMS NORMAL — No Active Security or Environmental Alerts
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        Autonomous monitoring of 7 coastal zones, statutory IMBL borders, and ECMWF / Copernicus Marine models is active.
                      </span>
                    </div>
                  </div>
                ) : (
                  activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "flex items-start justify-between gap-2 p-2.5 rounded-lg border text-xs",
                        alert.severity === "CRITICAL"
                          ? "bg-red-500/10 border-red-500/35"
                          : "bg-amber-500/10 border-amber-500/35"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {alert.severity === "CRITICAL" ? (
                          <AlertOctagon className="size-4 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                        ) : (
                          <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex flex-col">
                          <span
                            className={cn(
                              "font-bold text-xs",
                              alert.severity === "CRITICAL" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                            )}
                          >
                            {alert.title}
                          </span>
                          <span className="text-[11px] text-foreground/90 mt-0.5 leading-snug">
                            {alert.description}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1 font-mono">
                            <span>Sector: {alert.affectedLocation}</span>
                            <span>•</span>
                            <span>Source: {alert.source}</span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={alert.severity === "CRITICAL" ? "destructive" : "outline"}
                        className="text-[9px] uppercase font-mono shrink-0"
                      >
                        {alert.timeAgo}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* SECTION 4 — ENVIRONMENTAL & OCEAN CONDITIONS (Autonomous Background Feed) */}
            <Card className="border-border/60 shadow-2xs">
              <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                      <Waves className="size-3.5 text-primary" />
                      Environmental & Sea Conditions (IMO FSA Standard)
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Autonomous Polling
                    </Badge>
                  </div>
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
              <CardContent className="p-3 flex flex-col gap-2.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                      <Wind className="size-3" /> Sustained Wind
                    </span>
                    <span className="font-mono font-semibold text-foreground text-sm">
                      {weather.windSpeedKmph != null ? `${weather.windSpeedKmph} km/h` : "Unavailable"}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Gusts: {weather.windGustsKmph != null ? `${weather.windGustsKmph} km/h` : "N/A"}
                    </span>
                  </div>

                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                      <Waves className="size-3" /> Significant Waves
                    </span>
                    <span className="font-mono font-semibold text-foreground text-sm">
                      {weather.waveHeightMeters != null ? `${weather.waveHeightMeters} m` : "Unavailable"}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Period: {weather.wavePeriodSeconds != null ? `${weather.wavePeriodSeconds}s` : "N/A"}
                    </span>
                  </div>

                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                      <Compass className="size-3" /> Ocean Current
                    </span>
                    <span className="font-mono font-semibold text-foreground text-sm">
                      {weather.currentVelocityMs != null ? `${weather.currentVelocityMs} m/s` : "Unavailable"}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Sea: {weather.seaStateCategory}
                    </span>
                  </div>

                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                      <Shield className="size-3" /> Cyclone Threat
                    </span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                      {cyclone.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {cyclone.summary}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-md bg-muted/30 border border-border/30 flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground font-mono">
                  <span>Source: {weather.source}</span>
                  <span>
                    Last Polled:{" "}
                    {weather.lastUpdated ? new Date(weather.lastUpdated).toLocaleTimeString() : "Pending fix"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 5 — GEOFENCE STATUS & DECISION-SUPPORT ADVISORY */}
            <Card className="border-border/60 shadow-2xs">
              <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-primary" />
                    Geofence & Boundary Proximity Engine
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono",
                      geofence.status === "BREACH"
                        ? "border-red-500/40 text-red-500 bg-red-500/10 animate-pulse"
                        : geofence.status === "CRITICAL_PROXIMITY"
                        ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
                        : geofence.status === "APPROACHING"
                        ? "border-amber-500/40 text-amber-500"
                        : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {geofence.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3 text-xs flex flex-col gap-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Nearest Restricted Zone</span>
                    <strong className="text-foreground text-xs truncate block">{geofence.nearestZoneName}</strong>
                    <span className="text-[10px] text-muted-foreground uppercase">{geofence.zoneType}</span>
                  </div>
                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Distance to Boundary</span>
                    <strong className="text-foreground text-xs block">
                      {geofence.distanceToBoundaryKm != null ? `${geofence.distanceToBoundaryKm} km` : "N/A"}
                    </strong>
                    <span className="text-[10px] text-muted-foreground">
                      Buffer limit: 25.0 km
                    </span>
                  </div>
                  <div className="p-2 rounded-md bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Recommended Return Bearing</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 text-xs block">
                      {geofence.returnBearing}
                    </strong>
                    <span className="text-[10px] text-muted-foreground">
                      Toward {geofence.nearestSafeHarbor.name}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-secondary/30 border border-border/40 flex items-start gap-2 text-xs">
                  <Info className="size-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">
                      Navigational Directive:
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {geofence.recommendedAction}
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 mt-1 italic">
                      Notice: Autonomous decision-support advisory only. Vessel master and onboard navigation radar retain statutory maritime authority.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 6 — DYNAMIC RETURN GUIDANCE CARD */}
            {geofence.nearestSafeHarbor && (
              <Card className="border-border/60 shadow-2xs">
                <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <Navigation className="size-3.5 text-primary" />
                    Nearest Verified Indian Safe Port (Dynamically Resolved)
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
