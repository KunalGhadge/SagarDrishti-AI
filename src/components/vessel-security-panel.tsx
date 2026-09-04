"use client";

import { appStore } from "@/app/store";
import { cn } from "lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
    incidentWorkflow,
    activeAlerts,
    polygons,
    dataIntegrity,
    requestLocation,
    refreshWeather,
    officialWarning,
    riskAssessment,
  } = useVesselSecurity();

  const router = useRouter();

  const setOpen = (bool: boolean) => {
    appStoreMutate({
      securityPanel: {
        isOpen: bool,
      },
    });
  };

  const handleSelectDangerScenario = (scenario: {
    name: string;
    reason: string;
    distressMessage: string;
  }) => {
    // 1. Close drawer
    setOpen(false);

    // 2. Queue pending message in appStore
    appStoreMutate({
      pendingChatMessage: scenario.distressMessage,
    });

    toast.error(`🚨 Emergency Demo: ${scenario.name} selected. Opening chat session...`);

    // 3. Navigate to a clean chat session
    router.push("/");
    router.refresh();
  };

  // Build tactical map markers with dynamic heading & speed - ZERO FAKE POSITIONS
  const mapMarkers: MapMarker[] = [
    ...(activeCoords.isLive && activeCoords.latitude != null && activeCoords.longitude != null
      ? [
          {
            lat: activeCoords.latitude,
            lon: activeCoords.longitude,
            label: incident.isIncident
              ? `🚨 RESTRICTED ZONE BREACH (${activeCoords.latitude.toFixed(4)}°N, ${activeCoords.longitude.toFixed(4)}°E)`
              : `📍 Live Vessel GNSS (${activeCoords.latitude.toFixed(4)}°N, ${activeCoords.longitude.toFixed(4)}°E)`,
            type: incident.isIncident ? ("hazard" as const) : ("current" as const),
            heading: telemetry.headingDegrees,
            speed: telemetry.speedKts,
            accuracy: telemetry.accuracy,
          },
        ]
      : []),
    ...(geofence.nearestSafeHarbor
      ? [
          {
            lat: geofence.nearestSafeHarbor.latitude,
            lon: geofence.nearestSafeHarbor.longitude,
            label: `⚓ Verified Port: ${geofence.nearestSafeHarbor.name} (${geofence.nearestSafeHarbor.distanceNM} NM • ${geofence.nearestSafeHarbor.bearing})`,
            type: "safe_zone" as const,
          },
        ]
      : []),
  ];

  // Emergency escape polyline vector (Rendered only when live position is acquired)
  const mapPath =
    activeCoords.isLive && activeCoords.latitude != null && activeCoords.longitude != null && geofence.nearestSafeHarbor
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
- Latitude: ${activeCoords.isLive && activeCoords.latitude != null ? `${activeCoords.latitude.toFixed(4)}°N` : "Unavailable (Pending Fix)"}
- Longitude: ${activeCoords.isLive && activeCoords.longitude != null ? `${activeCoords.longitude.toFixed(4)}°E` : "Unavailable (Pending Fix)"}
- Speed Over Ground: ${telemetry.speedKts != null ? `${telemetry.speedKts} kts` : "Unavailable"}
- Compass Heading: ${telemetry.headingCardinal || "Unavailable"}
- GPS Accuracy: ${telemetry.accuracy != null ? `±${telemetry.accuracy}m` : "Unavailable"}

SAFETY & RESCUE DIRECTIVE:
- Nearest Verified Major Port: ${geofence.nearestSafeHarbor.name} (${geofence.nearestSafeHarbor.state})
- Port Authority: ${geofence.nearestSafeHarbor.authority || "Major Port Authority"}
- Nautical Distance: ${geofence.nearestSafeHarbor.distanceNM} NM (${geofence.nearestSafeHarbor.distanceKm} km)
- Emergency Heading Vector: ${geofence.returnBearing}
- Assigned SAR Coordination Center: ${geofence.nearestSafeHarbor.assignedMrcc}

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
          "px-4 flex flex-col h-screen max-h-screen min-h-0 overflow-hidden transition-all duration-300 z-50",
          isFullscreen
            ? "w-screen max-w-none rounded-none inset-0"
            : "w-full md:w-[740px] lg:w-[840px]"
        )}
      >
        {/* Panel Header */}
        <DrawerHeader className="shrink-0 px-0 py-3 border-b border-border/40 mb-2">
          <DrawerTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "size-9 rounded-lg flex items-center justify-center transition-colors shrink-0",
                  overallLevel === "CRITICAL"
                    ? "bg-red-500/15 text-red-500 border border-red-500/30"
                    : overallLevel === "WARNING"
                    ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                )}
              >
                {overallLevel === "CRITICAL" ? (
                  <ShieldAlert className="size-5 animate-pulse" />
                ) : overallLevel === "WARNING" ? (
                  <ShieldAlert className="size-5" />
                ) : (
                  <ShieldCheck className="size-5" />
                )}
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight">
                    VESSEL SECURITY
                  </span>
                  <span className="text-muted-foreground text-xs hidden sm:inline">•</span>
                  <span className="text-xs sm:text-sm font-semibold text-muted-foreground hidden sm:inline">
                    LIVE AUTONOMOUS MONITORING
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-mono font-semibold uppercase tracking-wider px-2.5 py-0.5",
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
                <span className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
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
                    className="rounded-full size-8.5"
                    onClick={() => setIsFullscreen((prev) => !prev)}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="size-4.5" />
                    ) : (
                      <Maximize2 className="size-4.5" />
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
                  className="flex items-center gap-1.5 rounded-full h-8.5 px-3.5"
                >
                  <X className="size-4" />
                  <Separator orientation="vertical" className="h-3.5" />
                  <span className="text-xs text-muted-foreground font-mono font-medium">
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

        {/* Panel Body Scroll Area (Constrained to panel interior with overscroll containment) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-4 px-4 pr-3.5 pb-6">
          <div className="flex flex-col gap-4">
            {/* DEMO: SIMULATE VESSEL DANGER (JUDGE DEMO MODE) */}
            <Card className="border-red-500/40 bg-gradient-to-br from-red-500/10 via-background to-background shadow-xs">
              <CardHeader className="py-2.5 px-3.5 border-b border-border/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="size-4 text-red-500 animate-pulse" />
                    <CardTitle className="text-xs sm:text-sm font-bold text-foreground">
                      Simulate Vessel Danger (Judge Demo)
                    </CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-red-500/50 text-red-600 dark:text-red-400 bg-red-500/10 uppercase"
                  >
                    Autonomous SOS Trigger
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3 text-xs flex flex-col gap-2.5">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Select a live emergency threat scenario. SagarDrishti AI will open a fresh chat, notify the marine orchestrator, request operator confirmation, and auto-dispatch the Coast Guard MRCC 1554 SAR rescue plan after 10s if unanswered.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
                  <Button
                    variant="outline"
                    className="h-auto py-2 px-2.5 flex flex-col items-start text-left border-red-500/35 hover:border-red-500 hover:bg-red-500/10 transition-all"
                    onClick={() =>
                      handleSelectDangerScenario({
                        name: "Crossing Geofence (IMBL)",
                        reason: "Crossing statutory geofencing boundary (IMBL)",
                        distressMessage:
                          "EMERGENCY: I am in danger! Reason: Crossing statutory geofencing boundary (IMBL). My vessel has drifted into the restricted boundary corridor and requires immediate navigational assistance and safe harbor return heading.",
                      })
                    }
                  >
                    <span className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 text-xs">
                      🚨 Crossing Geofence / IMBL
                    </span>
                    <span className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 font-sans">
                      Vessel crossed territorial boundary line into restricted sector
                    </span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto py-2 px-2.5 flex flex-col items-start text-left border-amber-500/35 hover:border-amber-500 hover:bg-amber-500/10 transition-all"
                    onClick={() =>
                      handleSelectDangerScenario({
                        name: "Severe Cyclone & Gale Winds",
                        reason: "Caught in severe cyclone storm with gale winds > 65 km/h",
                        distressMessage:
                          "EMERGENCY: I am in danger! Reason: Caught in severe cyclone storm with gale-force winds exceeding 65 km/h and dangerous high swell. Requesting emergency shelter harbor routing.",
                      })
                    }
                  >
                    <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-xs">
                      🌀 Cyclone & Gale Winds
                    </span>
                    <span className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 font-sans">
                      Severe squall & high waves exceeding small-craft safe thresholds
                    </span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto py-2 px-2.5 flex flex-col items-start text-left border-rose-500/35 hover:border-rose-500 hover:bg-rose-500/10 transition-all"
                    onClick={() =>
                      handleSelectDangerScenario({
                        name: "Engine Failure & Sinking",
                        reason: "Catastrophic engine breakdown with rapid water ingress and capsize hazard",
                        distressMessage:
                          "EMERGENCY: I am in danger! Reason: Engine failure with rapid hull water ingress and imminent sinking hazard. Requesting urgent Coast Guard MRCC 1554 SAR dispatch.",
                      })
                    }
                  >
                    <span className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 text-xs">
                      ⚓ Engine Failure & Sinking
                    </span>
                    <span className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 font-sans">
                      Propulsion breakdown with water ingress and capsize distress
                    </span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto py-2 px-2.5 flex flex-col items-start text-left border-purple-500/35 hover:border-purple-500 hover:bg-purple-500/10 transition-all"
                    onClick={() =>
                      handleSelectDangerScenario({
                        name: "Piracy / Hostile Skiff Threat",
                        reason: "Hostile armed skiff approaching vessel in offshore corridor",
                        distressMessage:
                          "EMERGENCY: I am in danger! Reason: Hostile armed skiff approaching vessel at high speed. Bridge lockdown initiated, requesting emergency Coast Guard intervention.",
                      })
                    }
                  >
                    <span className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 text-xs">
                      🔒 Piracy / Armed Threat
                    </span>
                    <span className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 font-sans">
                      Unidentified hostile craft boarding approach in offshore corridor
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* GPS UNAVAILABLE WARNING BANNER (Rendered honestly when browser GPS is unacquired) */}
            {telemetry.trackingStatus === "UNAVAILABLE" && (
              <Card className="border-amber-500/40 bg-amber-500/10 shadow-2xs">
                <CardContent className="p-3.5 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-4.5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-amber-600 dark:text-amber-400 block text-xs sm:text-sm">
                        GPS SIGNAL UNAVAILABLE — WAITING FOR DEVICE GNSS FIX
                      </span>
                      <span className="text-muted-foreground text-xs block leading-relaxed">
                        Hardware GNSS coordinates are currently unacquired. Displaying regional coastal reference data. Live kinematic geofence alerts require active position streaming.
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-8 text-xs sm:text-sm border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 gap-1.5 px-3 font-medium"
                    onClick={() => requestLocation()}
                  >
                    <Radio className="size-3.5 animate-pulse" />
                    Acquire Device GNSS
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* HIGH SEVERITY INCIDENT ALERT CARD (Visible when breach or kinematic anomaly is detected) */}
            {incident.isIncident && (
              <Card className="border-red-500/50 bg-red-500/10 shadow-xs">
                <CardHeader className="pb-2.5 pt-3 px-3.5 border-b border-red-500/20">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm sm:text-base font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertOctagon className="size-4.5 animate-ping text-red-500" />
                      {incident.title}
                    </CardTitle>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {incidentWorkflow?.stage === "OPERATOR_CONFIRMED_INTENTIONAL" && (
                        <Badge variant="outline" className="text-xs font-mono border-emerald-500 text-emerald-600 dark:text-emerald-400 px-2 py-0.5">
                          INTENTIONAL ACKNOWLEDGED
                        </Badge>
                      )}
                      {incidentWorkflow?.stage === "BREACH_COUNTDOWN" && (
                        <Badge variant="outline" className="text-xs font-mono border-amber-500 text-amber-600 dark:text-amber-400 animate-pulse px-2 py-0.5">
                          INTENT PENDING
                        </Badge>
                      )}
                      {incidentWorkflow?.stage === "UNRESPONSIVE_ESCALATED" && (
                        <Badge variant="destructive" className="text-xs font-mono px-2 py-0.5">
                          SOLAS ESCALATED
                        </Badge>
                      )}
                      <Badge variant="destructive" className="text-xs uppercase font-mono tracking-wider px-2 py-0.5">
                        {incident.incidentId}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-3.5 pt-3 pb-3 text-xs sm:text-sm flex flex-col gap-3">
                  <p className="text-foreground/90 font-medium leading-relaxed">
                    {incident.description}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-2.5 px-3 rounded-lg bg-background/80 border border-red-500/25 font-mono text-xs sm:text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground block text-xs font-medium">Zone Breached</span>
                      <span className="font-bold text-red-500 truncate block">
                        {incident.violatedZone}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground block text-xs font-medium">Restricted Dwell</span>
                      <span className="font-bold text-foreground">{incident.durationMinutes} min</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground block text-xs font-medium">Breach GNSS</span>
                      <span className="font-bold text-foreground truncate block">
                        {activeCoords.latitude != null && activeCoords.longitude != null
                          ? `${activeCoords.latitude.toFixed(3)}°N, ${activeCoords.longitude.toFixed(3)}°E`
                          : "Awaiting Fix"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground block text-xs font-medium">Escape Heading</span>
                      <span className="font-bold text-emerald-500">{geofence.returnBearing}</span>
                    </div>
                  </div>

                  {/* Incident Timeline with real timestamps */}
                  {incident.timeline && incident.timeline.length > 0 && (
                    <div className="p-3 rounded-lg bg-background/60 border border-border/50 flex flex-col gap-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="size-3.5 text-primary" /> Incident Detection Timeline (Real Execution)
                      </span>
                      <div className="flex flex-col gap-1.5 font-mono text-xs">
                        {incident.timeline.map((entry, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-muted-foreground shrink-0">{entry.timestamp}</span>
                            <span className="text-muted-foreground shrink-0">—</span>
                            <span
                              className={cn(
                                "leading-relaxed",
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
                  <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs sm:text-sm font-bold text-foreground">
                        Statutory Navigational Directive:
                      </span>
                      <span className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
                        {incident.recommendedAction}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="shrink-0 h-8 text-xs sm:text-sm font-semibold gap-1.5 shadow-sm px-3"
                      onClick={copyDistressReport}
                    >
                      {copiedReport ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {copiedReport ? "Copied" : "Copy Distress Report"}
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <PhoneCall className="size-3.5 text-red-500" /> Emergency SAR Radios:
                    </span>
                    <a href="tel:1554" className="hover:text-foreground font-mono underline decoration-dotted font-medium">
                      Coast Guard MRCC: 1554
                    </a>
                    <span className="font-mono">VHF Calling: Ch 16 (156.8 MHz)</span>
                    <a href="tel:1093" className="hover:text-foreground font-mono underline decoration-dotted font-medium">
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
                  <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <Radio className="size-4 text-primary" />
                    Live Vessel Telemetry
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="text-xs font-mono font-medium tracking-tight flex items-center gap-1.5 px-2.5 py-0.5"
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full",
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs sm:text-sm">
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground block font-medium">Latitude</span>
                    <span className="font-mono font-bold text-foreground text-sm sm:text-base">
                      {telemetry.latitude != null ? `${telemetry.latitude.toFixed(4)}°N` : "Unavailable"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground block font-medium">Longitude</span>
                    <span className="font-mono font-bold text-foreground text-sm sm:text-base">
                      {telemetry.longitude != null ? `${telemetry.longitude.toFixed(4)}°E` : "Unavailable"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground block font-medium">Speed Over Ground</span>
                    <span className="font-mono font-bold text-foreground text-sm sm:text-base">
                      {telemetry.speedKts != null ? `${telemetry.speedKts} kts` : "Unavailable"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground block font-medium">Compass Heading</span>
                    <span className="font-mono font-bold text-foreground text-sm sm:text-base truncate block">
                      {telemetry.headingCardinal || "Unavailable"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground block font-medium">GPS Accuracy</span>
                    <span className="font-mono font-bold text-foreground text-sm sm:text-base">
                      {telemetry.accuracy != null ? `±${telemetry.accuracy}m` : "Unavailable"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground block font-medium">Last GNSS Update</span>
                    <span className="font-mono font-bold text-foreground text-xs sm:text-sm">
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
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 px-3 rounded-lg bg-background/95 backdrop-blur-md border border-border/60 shadow-md text-xs sm:text-sm font-mono">
                    <div className="flex items-center gap-2">
                      <Anchor className="size-4 text-emerald-500 shrink-0" />
                      <span className="text-muted-foreground font-medium">NEAREST VERIFIED PORT:</span>
                      <strong className="text-foreground font-bold">
                        {geofence.nearestSafeHarbor.name}
                      </strong>
                      <span className="text-primary font-bold">
                        • {geofence.nearestSafeHarbor.distanceNM} NM • Vector {geofence.returnBearing}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-medium">GEOFENCE:</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-mono px-2 py-0.5 font-semibold",
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

            {/* SECTION 3A — OFFICIAL GOVERNMENT WARNING (IMD / INCOIS) */}
            <Card className="border-border/60 shadow-2xs">
              <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                      <AlertTriangle className="size-4 text-primary" />
                      Official Warning
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-mono px-2 py-0.5 font-medium">
                      Source: IMD
                    </Badge>
                  </div>
                  <Badge
                    variant={
                      officialWarning?.verified && officialWarning?.status === "ACTIVE_WARNING"
                        ? "destructive"
                        : officialWarning?.verified && officialWarning?.status === "NO_ACTIVE_WARNING"
                        ? "outline"
                        : "secondary"
                    }
                    className={cn(
                      "text-xs font-mono font-semibold uppercase tracking-wider px-2 py-0.5",
                      officialWarning?.verified &&
                        officialWarning?.status === "NO_ACTIVE_WARNING" &&
                        "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    )}
                  >
                    {officialWarning?.verified
                      ? officialWarning.status === "ACTIVE_WARNING"
                        ? "ACTIVE WARNING"
                        : "NO ACTIVE WARNING"
                      : "NO VERIFIED WARNING"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 flex flex-col gap-3 text-xs sm:text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-foreground text-sm sm:text-base">
                      {officialWarning?.verified
                        ? officialWarning.status === "ACTIVE_WARNING"
                          ? "Official Advisory: Active Marine Weather Warning"
                          : "No verified warning for selected area"
                        : "Official warning data unavailable"}
                    </span>
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {officialWarning?.advisoryText || "Direct IMD official bulletin feed currently unacquired or unavailable."}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2.5 border-t border-border/30 text-xs font-mono text-muted-foreground">
                  <div className="p-1.5 rounded bg-muted/30 flex flex-col gap-0.5">
                    <span className="block text-xs uppercase tracking-wider text-muted-foreground/80 font-medium">Source</span>
                    <span className="font-semibold text-foreground text-xs sm:text-sm">IMD</span>
                  </div>
                  <div className="p-1.5 rounded bg-muted/30 flex flex-col gap-0.5">
                    <span className="block text-xs uppercase tracking-wider text-muted-foreground/80 font-medium">Area</span>
                    <span className="font-semibold text-foreground text-xs sm:text-sm truncate block">{officialWarning?.area || "Coastal Sector"}</span>
                  </div>
                  <div className="p-1.5 rounded bg-muted/30 flex flex-col gap-0.5">
                    <span className="block text-xs uppercase tracking-wider text-muted-foreground/80 font-medium">Updated</span>
                    <span className="font-semibold text-foreground text-xs sm:text-sm">{officialWarning?.issuedAt || "Unavailable"}</span>
                  </div>
                  <div className="p-1.5 rounded bg-muted/30 flex flex-col gap-0.5">
                    <span className="block text-xs uppercase tracking-wider text-muted-foreground/80 font-medium">Verification</span>
                    <span className="font-semibold text-foreground text-xs sm:text-sm">{officialWarning?.verified ? "Authoritative Live" : "Unverified / Degraded"}</span>
                  </div>
                </div>

                {officialWarning?.officialBulletinUrl && (
                  <div className="pt-1">
                    <a
                      href={officialWarning.officialBulletinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs sm:text-sm text-primary underline hover:text-primary/80 inline-flex items-center gap-1 font-mono font-medium"
                    >
                      <span>🔗 View Official IMD RSMC Fishermen Bulletin (PDF)</span>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SECTION 3B — SAGARDRISHTI RISK ASSESSMENT (Deterministic Engine) */}
            <Card className="border-border/60 shadow-2xs">
              <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                      <ShieldCheck className="size-4 text-primary" />
                      SagarDrishti Risk Assessment
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-mono px-2 py-0.5 font-medium">
                      Deterministic Engine
                    </Badge>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-mono font-semibold uppercase tracking-wider px-2 py-0.5",
                      riskAssessment?.level === "CODE_RED"
                        ? "bg-red-500/15 text-red-500 border-red-500/30 animate-pulse"
                        : riskAssessment?.level === "CODE_ORANGE"
                        ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                        : riskAssessment?.level === "CODE_YELLOW"
                        ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30"
                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    )}
                  >
                    {riskAssessment?.badge || "🟢 CODE GREEN"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 flex flex-col gap-2.5 text-xs sm:text-sm">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-bold text-foreground text-sm sm:text-base">
                      IMO FSA Risk Index: {riskAssessment?.riskIndex ?? 2} (Score: {riskAssessment?.riskScore ?? 20}/100)
                    </span>
                    <span className="text-xs font-mono text-muted-foreground font-medium">
                      MSC-MEPC.2/Circ.12/Rev.2
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {riskAssessment?.reasoning || "Sea and atmospheric conditions within safe operational margins."}
                  </span>
                </div>

                <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 text-xs flex flex-col gap-1.5">
                  <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Assessment Deterministic Basis:
                  </span>
                  {riskAssessment?.basis?.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
                      <span className="size-1.5 rounded-full bg-primary shrink-0" />
                      <span>{b}</span>
                    </div>
                  )) || (
                    <span className="text-muted-foreground font-mono text-xs">
                      ECMWF IFS 0.25° Wind + Copernicus Marine Waves
                    </span>
                  )}
                </div>

                <div className="text-xs text-muted-foreground/85 leading-normal italic">
                  Note: SagarDrishti Risk Assessment is an automated algorithmic decision-support tool. It is not an official government directive. Master retains absolute navigational discretion.
                </div>
              </CardContent>
            </Card>

            {/* SECTION 3C — MONITORED SECURITY & GEOFENCE ALERTS */}
            <Card className="border-border/60 shadow-2xs">
              <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <AlertTriangle className="size-4 text-primary" />
                    Monitored Safety Alerts ({activeAlerts.length})
                  </CardTitle>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    Live sensor & geospatial telemetry
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 flex flex-col gap-2.5">
                {activeAlerts.length === 0 ? (
                  <div className="flex items-center gap-3 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs sm:text-sm">
                    <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-sm sm:text-base">
                        ALL MONITORED SYSTEMS NORMAL — No Active Security or Environmental Alerts
                      </span>
                      <span className="text-xs sm:text-sm text-muted-foreground block mt-0.5">
                        Autonomous monitoring of 7 coastal zones, statutory IMBL borders, and ECMWF / Copernicus Marine models is active.
                      </span>
                    </div>
                  </div>
                ) : (
                  activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "flex items-start justify-between gap-2.5 p-3 rounded-lg border text-xs sm:text-sm",
                        alert.severity === "CRITICAL"
                          ? "bg-red-500/10 border-red-500/35"
                          : "bg-amber-500/10 border-amber-500/35"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {alert.severity === "CRITICAL" ? (
                          <AlertOctagon className="size-4.5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                        ) : (
                          <AlertTriangle className="size-4.5 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={cn(
                              "font-bold text-sm",
                              alert.severity === "CRITICAL" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                            )}
                          >
                            {alert.title}
                          </span>
                          <span className="text-xs sm:text-sm text-foreground/90 leading-snug">
                            {alert.description}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 font-mono">
                            <span>Sector: {alert.affectedLocation}</span>
                            <span>•</span>
                            <span>Source: {alert.source}</span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={alert.severity === "CRITICAL" ? "destructive" : "outline"}
                        className="text-xs uppercase font-mono shrink-0 px-2 py-0.5"
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
                    <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                      <Waves className="size-4 text-primary" />
                      Environmental & Sea Conditions (IMO FSA Standard)
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-mono px-2 py-0.5">
                      Autonomous Polling
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={refreshWeather}
                  >
                    <RefreshCw className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 flex flex-col gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs sm:text-sm">
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Wind className="size-3.5" /> Sustained Wind
                    </span>
                    <span className="font-mono font-bold text-foreground text-base sm:text-lg">
                      {weather.windSpeedKmph != null ? `${weather.windSpeedKmph} km/h` : "Unavailable"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Gusts: {weather.windGustsKmph != null ? `${weather.windGustsKmph} km/h` : "N/A"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Waves className="size-3.5" /> Significant Waves
                    </span>
                    <span className="font-mono font-bold text-foreground text-base sm:text-lg">
                      {weather.waveHeightMeters != null ? `${weather.waveHeightMeters} m` : "Unavailable"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Period: {weather.wavePeriodSeconds != null ? `${weather.wavePeriodSeconds}s` : "N/A"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Compass className="size-3.5" /> Ocean Current
                    </span>
                    <span className="font-mono font-bold text-foreground text-base sm:text-lg">
                      {weather.currentVelocityMs != null ? `${weather.currentVelocityMs} m/s` : "Unavailable"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Sea: {weather.seaStateCategory}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Shield className="size-3.5" /> Cyclone Threat
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base sm:text-lg">
                      {cyclone.status}
                    </span>
                    <span className="text-xs text-muted-foreground truncate block">
                      {cyclone.summary}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-md bg-muted/30 border border-border/30 flex flex-wrap items-center justify-between gap-1.5 text-xs text-muted-foreground font-mono">
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
                  <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <MapPin className="size-4 text-primary" />
                    Geofence & Boundary Proximity Engine
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-mono px-2.5 py-0.5 font-semibold",
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
              <CardContent className="p-3.5 text-xs sm:text-sm flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono">
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground block font-medium">Nearest Restricted Zone</span>
                    <strong className="text-foreground text-sm sm:text-base font-bold truncate block tracking-tight">{geofence.nearestZoneName}</strong>
                    <span className="text-xs text-muted-foreground uppercase font-medium">{geofence.zoneType}</span>
                  </div>
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground block font-medium">Distance to Boundary</span>
                    <strong className="text-foreground text-base sm:text-lg font-bold block">
                      {geofence.distanceToBoundaryKm != null ? `${geofence.distanceToBoundaryKm} km` : "N/A"}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      Buffer limit: 25.0 km
                    </span>
                  </div>
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground block font-medium">Recommended Return Bearing</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 text-base sm:text-lg font-bold block">
                      {geofence.returnBearing}
                    </strong>
                    <span className="text-xs text-muted-foreground truncate block">
                      Toward {geofence.nearestSafeHarbor.name}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-secondary/30 border border-border/40 flex items-start gap-2.5 text-xs sm:text-sm">
                  <Info className="size-4.5 text-primary shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-foreground text-sm sm:text-base">
                      Navigational Directive:
                    </span>
                    <span className="text-xs sm:text-sm text-foreground/95 font-medium leading-relaxed">
                      {geofence.recommendedAction}
                    </span>
                    <span className="text-xs text-muted-foreground/85 mt-1 leading-normal italic">
                      Notice: Autonomous decision-support advisory only. Vessel master and onboard navigation radar retain statutory maritime authority.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 6 — NEAREST VERIFIED MAJOR PORT */}
            {geofence.nearestSafeHarbor && (
              <Card className="border-border/60 shadow-2xs">
                <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                      <Navigation className="size-4 text-primary" />
                      Nearest Verified Major Port (MoPSW Registry)
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-mono border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 font-medium">
                      {geofence.nearestSafeHarbor.verificationStatus || "VERIFIED_GOVERNMENT"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-3.5 text-xs sm:text-sm flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-base sm:text-lg text-foreground">
                        {geofence.nearestSafeHarbor.name} ({geofence.nearestSafeHarbor.state})
                      </span>
                      <span className="text-muted-foreground text-xs sm:text-sm">
                        Authority: {geofence.nearestSafeHarbor.authority || "Major Port Authority"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="text-right font-mono">
                        <span className="font-bold text-primary block text-base sm:text-lg">
                          {geofence.nearestSafeHarbor.distanceNM} NM
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({geofence.nearestSafeHarbor.distanceKm} km)
                        </span>
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs sm:text-sm font-bold px-2.5 py-1">
                        Vector: {geofence.returnBearing}
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/30 text-xs sm:text-sm text-muted-foreground flex items-center justify-between flex-wrap gap-1">
                    <span>Assigned SAR Coordination Center:</span>
                    <span className="font-semibold text-foreground">{geofence.nearestSafeHarbor.assignedMrcc}</span>
                  </div>

                  <div className="p-2.5 rounded bg-muted/30 border border-border/30 text-xs text-muted-foreground italic leading-relaxed">
                    ⚠️ {geofence.nearestSafeHarbor.navigationDisclaimer || "Decision-support only. Port suitability depends on vessel class, draft, weather, harbour status and navigation conditions."}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SECTION 7 — DATA QUALITY & PROVENANCE AUDIT */}
            <Card className="border-border/60 shadow-2xs">
              <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <Shield className="size-4 text-primary" />
                    Data Quality, Integrity & Provenance Audit
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-mono px-2.5 py-0.5 font-medium",
                      dataIntegrity.autonomousMode === "ENABLED"
                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                        : "border-amber-500/40 text-amber-500 bg-amber-500/10"
                    )}
                  >
                    AUTONOMOUS MODE: {dataIntegrity.autonomousMode}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 text-xs sm:text-sm flex flex-col gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs sm:text-sm">
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground block font-medium">GNSS RECEIVER</span>
                    <strong className={cn("text-xs sm:text-sm font-bold", dataIntegrity.gnssStatus === "LIVE" ? "text-emerald-500" : "text-amber-500")}>
                      {dataIntegrity.gnssStatus}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground block font-medium">BOUNDARY DATA</span>
                    <strong className="text-emerald-500 text-xs sm:text-sm font-bold">
                      {dataIntegrity.boundaryDataStatus}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground block font-medium">PORT REGISTRY</span>
                    <strong className="text-emerald-500 text-xs sm:text-sm font-bold">
                      {dataIntegrity.portDataStatus} (12 Ports)
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-md bg-secondary/30 border border-border/40 flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground block font-medium">WEATHER STREAM</span>
                    <strong className="text-emerald-500 text-xs sm:text-sm font-bold">
                      {dataIntegrity.weatherDataStatus}
                    </strong>
                  </div>
                </div>

                {dataIntegrity.gatingReason && (
                  <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                    ⚠️ <strong>Autonomous Safety Note:</strong> {dataIntegrity.gatingReason}
                  </div>
                )}

                {/* Active Boundary Provenance Details */}
                {geofence.provenance && (
                  <div className="p-3 rounded-lg bg-secondary/20 border border-border/40 text-xs sm:text-sm flex flex-col gap-2 font-mono">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="font-bold text-foreground text-xs sm:text-sm">{geofence.provenance.sourceName}</span>
                      <Badge variant="outline" className="text-xs py-0.5 px-2 border-primary/40 text-primary font-medium">
                        {geofence.provenance.verificationStatus}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span>Legal Instrument: {geofence.provenance.sourceDocument}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span>Authority: {geofence.provenance.sourceOrganization}</span>
                      <span>Datum: {geofence.provenance.coordinateReferenceSystem}</span>
                      <span>Breach Trigger: {geofence.provenance.canTriggerAutonomousBoundaryIncident ? "ENABLED" : "GATED / DISABLED"}</span>
                    </div>
                    {geofence.provenance.notes && (
                      <div className="text-xs text-muted-foreground/90 italic pt-1.5 border-t border-border/30 leading-relaxed">
                        {geofence.provenance.notes}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
