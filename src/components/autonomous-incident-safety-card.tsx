"use client";

import { useEffect, useState } from "react";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { Card, CardContent, CardHeader, CardTitle } from "ui/card";
import { Button } from "ui/button";
import { Badge } from "ui/badge";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  PhoneCall,
  ShieldAlert,
  X,
} from "lucide-react";
import { cn } from "lib/utils";
import { toast } from "sonner";
import { useVesselSecurity } from "@/hooks/use-vessel-security";

export function AutonomousIncidentSafetyCard() {
  const [incidentWorkflow, appStoreMutate] = appStore(
    useShallow((state) => [state.incidentWorkflow, state.mutate])
  );

  const { confirmIntentional, triggerEmergencySos, resetIncidentWorkflow } = useVesselSecurity();
  const [copiedReport, setCopiedReport] = useState(false);

  // Real system-clock countdown calculation
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);

  useEffect(() => {
    if (!incidentWorkflow?.isActive || incidentWorkflow?.stage !== "BREACH_COUNTDOWN") {
      return;
    }

    const updateCountdown = () => {
      if (!incidentWorkflow.countdownDeadline) {
        setSecondsRemaining(60);
        return;
      }
      const now = Date.now();
      const diffMs = incidentWorkflow.countdownDeadline - now;
      const remaining = Math.max(0, Math.ceil(diffMs / 1000));
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        // Autonomous Escalation triggered on real system time
        appStoreMutate((prev) => ({
          incidentWorkflow: {
            ...prev.incidentWorkflow,
            stage: "UNRESPONSIVE_ESCALATED",
            escalatedAt: new Date().toLocaleTimeString(),
            timeline: [
              ...prev.incidentWorkflow.timeline,
              {
                timestamp: new Date().toLocaleTimeString(),
                event: "Unresponsive Kinematic Anomaly declared: Countdown expired without operator response",
                severity: "CRITICAL" as const,
              },
            ],
          },
        }));
        toast.error("🚨 Autonomous Safety Escalation: No response received. Potential Maritime Incident declared.", {
          duration: 10000,
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [incidentWorkflow?.isActive, incidentWorkflow?.stage, incidentWorkflow?.countdownDeadline, appStoreMutate]);

  // Copy official distress report
  const copyDistressReport = () => {
    const report = `========================================
SOLAS MARITIME INCIDENT DISPATCH REPORT
SAGARDRISHTI-AI AUTONOMOUS SAFETY WORKFLOW
========================================
INCIDENT ID: ${incidentWorkflow.incidentId || "INC-IND-ACTIVE"}
STAGE: ${incidentWorkflow.stage}
TIMESTAMP: ${new Date().toISOString()}
BREACH LOCATION: ${incidentWorkflow.coordinates?.lat.toFixed(4)}°N, ${incidentWorkflow.coordinates?.lon.toFixed(4)}°E
RESTRICTED ZONE: ${incidentWorkflow.zoneName}
SPEED OVER GROUND: ${incidentWorkflow.speedKts != null ? `${incidentWorkflow.speedKts} kts` : "Unavailable"}
COMPASS HEADING: ${incidentWorkflow.headingDeg != null ? `${incidentWorkflow.headingDeg}°` : "Unavailable"}

SAFETY & RESCUE DIRECTIVE:
- Nearest Verified Major Port: ${incidentWorkflow.nearestPort}
- Nautical Distance: ${incidentWorkflow.portDistanceNM} NM
- Emergency Escape Vector: ${incidentWorkflow.returnBearing}
- Live Marine Conditions: ${incidentWorkflow.weatherSummary}
- Source Document: ${incidentWorkflow.provenance?.sourceDocument || "Official UN/Government Maritime Publication"}
- Verification Status: ${incidentWorkflow.provenance?.verificationStatus || "VERIFIED"}
- Disclaimer: Decision-support only. Port suitability depends on vessel class, draft, weather, harbour status and navigation conditions.

STATUTORY EMERGENCY RADIO & HELPLINE:
- Indian Coast Guard MRCC: 1554 (Toll-Free 24x7)
- International VHF Distress: Channel 16 (156.800 MHz)
- Coastal Police: 1093
========================================`;

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    toast.success("Official SOLAS Distress Report copied to clipboard");
    setTimeout(() => setCopiedReport(false), 2500);
  };

  if (!incidentWorkflow?.isActive || incidentWorkflow.stage === "IDLE") {
    return null;
  }

  const isCountdown = incidentWorkflow.stage === "BREACH_COUNTDOWN";
  const isAcknowledged = incidentWorkflow.stage === "OPERATOR_CONFIRMED_INTENTIONAL";
  const isEscalated = incidentWorkflow.stage === "UNRESPONSIVE_ESCALATED";
  const isSos = incidentWorkflow.stage === "SOS_TRIGGERED";

  const progressValue = Math.max(0, Math.min(100, (secondsRemaining / 60) * 100));

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 my-4 transition-all duration-300 animate-in fade-in slide-in-from-top-4">
      <Card
        className={cn(
          "border-2 shadow-lg overflow-hidden",
          isAcknowledged
            ? "border-emerald-500/50 bg-emerald-500/5"
            : isCountdown
            ? "border-amber-500/60 bg-amber-500/10 dark:bg-amber-950/20"
            : "border-red-500/70 bg-red-500/10 dark:bg-red-950/30"
        )}
      >
        {/* Header */}
        <CardHeader className="py-3 px-4 border-b bg-muted/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {isAcknowledged ? (
                <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
              ) : isCountdown ? (
                <AlertTriangle className="size-5 text-amber-500 shrink-0 animate-bounce" />
              ) : (
                <AlertOctagon className="size-5 text-red-500 shrink-0 animate-pulse" />
              )}
              <div>
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <span>
                    {isAcknowledged
                      ? "INTENTIONAL MOVEMENT CONFIRMED"
                      : isCountdown
                      ? "MARITIME SAFETY ALERT — BOUNDARY BREACH DETECTED"
                      : isEscalated
                      ? "POTENTIAL MARITIME INCIDENT / KINEMATIC ANOMALY"
                      : "EMERGENCY SOS / MARITIME RESCUE ESCALATION"}
                  </span>
                </CardTitle>
                <span className="text-xs text-muted-foreground block">
                  Autonomous Vessel Geofence & Kinetic Incident Workflow
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant={isAcknowledged ? "outline" : "destructive"}
                className={cn(
                  "font-mono text-[10px] uppercase",
                  isAcknowledged && "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                )}
              >
                {incidentWorkflow.incidentId}
              </Badge>
              {isAcknowledged && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={resetIncidentWorkflow}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 flex flex-col gap-3 text-xs sm:text-sm">
          {/* Main message text */}
          {isAcknowledged ? (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-1 text-emerald-700 dark:text-emerald-300">
              <span className="font-semibold flex items-center gap-1.5 text-xs sm:text-sm">
                <CheckCircle2 className="size-4 text-emerald-500" /> Movement acknowledged by operator.
              </span>
              <span className="text-xs text-muted-foreground">
                Automatic SOS escalation cancelled. Continue monitoring vessel position. Incident logged as intentional transit at {incidentWorkflow.acknowledgedAt || "just now"}.
              </span>
            </div>
          ) : (
            <p className="text-foreground/90 font-medium leading-relaxed">
              Your vessel has crossed the statutory maritime boundary into a restricted foreign or protected corridor. You may be moving outside the permitted sailing area.
              <strong className="block text-red-600 dark:text-red-400 mt-1 font-semibold">
                Please confirm whether this movement is intentional. Automated safety escalation will begin if no response is received.
              </strong>
            </p>
          )}

          {/* Factual Telemetry Grid (From deterministic security engine) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-2.5 rounded-lg bg-background/80 border border-border/60 font-mono text-[11px] sm:text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px]">Restricted Area</span>
              <span className="font-bold text-red-500 truncate block">
                {incidentWorkflow.zoneName || "Statutory IMBL"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Current Location</span>
              <span className="font-semibold text-foreground">
                {incidentWorkflow.coordinates?.lat.toFixed(4)}°N, {incidentWorkflow.coordinates?.lon.toFixed(4)}°E
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Kinematics</span>
              <span className="font-semibold text-foreground">
                {incidentWorkflow.speedKts != null ? `${incidentWorkflow.speedKts} kts` : "N/A"} • {incidentWorkflow.headingDeg != null ? `${incidentWorkflow.headingDeg}°` : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Escape Heading</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {incidentWorkflow.returnBearing} ({incidentWorkflow.nearestPort})
              </span>
            </div>
          </div>

          {/* Real System-Clock Countdown & Intent Buttons (When in countdown) */}
          {isCountdown && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <Clock className="size-4 text-amber-600 dark:text-amber-400 animate-spin" />
                  <span className="font-bold text-amber-700 dark:text-amber-300">
                    AUTOMATIC SAFETY ESCALATION
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-xs text-muted-foreground">Response required in:</span>
                  <Badge
                    variant="outline"
                    className="font-mono text-xs font-bold px-2 py-0.5 border-amber-500/50 bg-background text-amber-600 dark:text-amber-400"
                  >
                    00:{secondsRemaining.toString().padStart(2, "0")}
                  </Badge>
                </div>
              </div>

              <div className="h-1.5 w-full bg-amber-500/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progressValue}%` }}
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <Button
                  variant="outline"
                  className="h-10 text-xs font-bold border-emerald-500/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 gap-2 shadow-xs"
                  onClick={() => confirmIntentional()}
                >
                  <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                  THIS MOVEMENT IS INTENTIONAL
                </Button>

                <Button
                  variant="destructive"
                  className="h-10 text-xs font-bold gap-2 shadow-sm animate-pulse"
                  onClick={() => triggerEmergencySos()}
                >
                  <AlertTriangle className="size-4" />
                  I NEED HELP / SOS
                </Button>
              </div>
            </div>
          )}

          {/* Escalated / SOS Mode (When countdown reached zero or operator pressed SOS) */}
          {(isEscalated || isSos) && (
            <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="size-4 text-red-500" />
                  <span className="font-bold text-xs text-red-600 dark:text-red-400">
                    {isEscalated
                      ? "UNRESPONSIVE KINEMATIC ANOMALY (SOLAS ESCALATED)"
                      : "EMERGENCY SOS MARITIME REPORT"}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-red-500/50 text-red-500">
                  AUTHORITY DISPATCH PREPARED
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground flex flex-col gap-1">
                <span>
                  {isEscalated
                    ? "No acknowledgment received within 60 seconds. Vessel remains in the restricted corridor. Structured distress telemetry prepared for Indian Coast Guard MRCC dispatch."
                    : "Operator activated emergency distress protocol. Structured SAR dispatch parameters compiled with verified GPS coordinates."}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-red-500/20">
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                  <a href="tel:1554" className="text-primary hover:underline font-bold flex items-center gap-1">
                    <PhoneCall className="size-3 text-red-500" /> Coast Guard: 1554
                  </a>
                  <span>VHF: Ch 16</span>
                  <a href="tel:1093" className="text-primary hover:underline font-bold">
                    Police: 1093
                  </a>
                </div>

                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 text-xs font-semibold gap-1.5"
                  onClick={copyDistressReport}
                >
                  {copiedReport ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copiedReport ? "Copied" : "Copy Official Distress Dispatch"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
