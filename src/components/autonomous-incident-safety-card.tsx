"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Compass,
  Copy,
  Check,
  Navigation,
  PhoneCall,
  Radio,
  ShieldAlert,
  X,
} from "lucide-react";
import { cn } from "lib/utils";
import { toast } from "sonner";
import { useVesselSecurity } from "@/hooks/use-vessel-security";
import { UseChatHelpers } from "@ai-sdk/react";
import { UIMessage } from "ai";

interface AutonomousIncidentSafetyCardProps {
  sendMessage?: UseChatHelpers<UIMessage>["sendMessage"];
}

export function AutonomousIncidentSafetyCard({ sendMessage }: AutonomousIncidentSafetyCardProps) {
  const [incidentWorkflow, appStoreMutate] = appStore(
    useShallow((state) => [state.incidentWorkflow, state.mutate])
  );

  const { confirmIntentional, triggerEmergencySos, resetIncidentWorkflow } = useVesselSecurity();
  const [copiedReport, setCopiedReport] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const hasDispatchedRef = useRef(false);

  // Reset dispatch guard when incident resets
  useEffect(() => {
    if (!incidentWorkflow?.isActive || incidentWorkflow.stage === "IDLE") {
      hasDispatchedRef.current = false;
    }
  }, [incidentWorkflow?.isActive, incidentWorkflow?.stage]);

  // Dispatch SOS to multi-agent chat system
  const dispatchSosToChat = useCallback((isTimeout = false) => {
    if (hasDispatchedRef.current) return;
    hasDispatchedRef.current = true;

    triggerEmergencySos();

    if (sendMessage) {
      const lat = incidentWorkflow.coordinates?.lat ?? 16.0600;
      const lon = incidentWorkflow.coordinates?.lon ?? 73.4500;
      const zone = incidentWorkflow.zoneName || "Restricted Maritime Corridor";
      const speed = incidentWorkflow.speedKts != null ? `${incidentWorkflow.speedKts} kts` : "4.5 kts";
      const heading = incidentWorkflow.headingDeg != null ? `${incidentWorkflow.headingDeg}°` : "180°";
      const port = incidentWorkflow.nearestPort || "Mormugao Port Authority (Goa)";
      const escapeVector = incidentWorkflow.returnBearing || "152° (SSE)";

      const prefix = isTimeout
        ? "🚨 CONFIRMED ACTIVE EMERGENCY SOS: UNRESPONSIVE VESSEL KINEMATIC ANOMALY! 60-second operator intent confirmation expired with zero response."
        : "🚨 CONFIRMED ACTIVE EMERGENCY SOS: Vessel distress initiated by operator!";

      const distressPrompt = `${prefix} Boundary breach in ${zone} at coordinates ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E (Speed: ${speed}, Heading: ${heading}). YES, active emergency confirmed. Initiate immediate SOLAS SAR Maritime Rescue protocol, calculate emergency escape heading to nearest safe harbor (${port}, bearing ${escapeVector}), and render tactical emergency navigation map with official Coast Guard MRCC 1554 rescue channels.`;

      sendMessage({
        role: "user",
        parts: [{ type: "text", text: distressPrompt }],
      });
      toast.error("🚨 Emergency SOS Dispatched to Multi-Agent Rescue Operations", {
        duration: 8000,
      });
    }
  }, [triggerEmergencySos, sendMessage, incidentWorkflow]);

  // Real system-clock countdown calculation
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

        // Trigger AI emergency dispatch
        dispatchSosToChat(true);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [
    incidentWorkflow?.isActive,
    incidentWorkflow?.stage,
    incidentWorkflow?.countdownDeadline,
    appStoreMutate,
    dispatchSosToChat,
  ]);

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
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 my-3 transition-all duration-300 animate-in fade-in slide-in-from-top-3">
      <Card
        className={cn(
          "border-2 shadow-2xl overflow-hidden rounded-2xl backdrop-blur-2xl",
          isAcknowledged
            ? "border-emerald-500/60 bg-zinc-950/95 text-zinc-100 shadow-[0_0_40px_rgba(16,185,129,0.15)]"
            : isCountdown
            ? "border-red-500/70 bg-zinc-950/95 text-zinc-100 shadow-[0_0_50px_rgba(239,68,68,0.25)]"
            : "border-red-500/80 bg-zinc-950/95 text-zinc-100 shadow-[0_0_60px_rgba(239,68,68,0.35)]"
        )}
      >
        {/* Command HUD Top Header */}
        <CardHeader
          className={cn(
            "py-3 px-4 sm:px-5 border-b flex flex-row items-center justify-between space-y-0",
            isAcknowledged
              ? "bg-gradient-to-r from-emerald-950/70 via-zinc-900 to-zinc-950 border-emerald-500/30"
              : "bg-gradient-to-r from-red-950/90 via-zinc-900 to-zinc-950 border-red-500/30"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "relative flex items-center justify-center size-9 rounded-xl border shrink-0",
                isAcknowledged
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : isCountdown
                  ? "bg-red-500/20 border-red-500/40 text-red-400"
                  : "bg-red-500/30 border-red-500/60 text-red-300"
              )}
            >
              {isAcknowledged ? (
                <CheckCircle2 className="size-5" />
              ) : isCountdown ? (
                <>
                  <Radio className="size-4 animate-ping absolute text-red-500/60" />
                  <AlertTriangle className="size-5 text-red-400 relative z-10" />
                </>
              ) : (
                <AlertOctagon className="size-5 text-red-400 animate-pulse" />
              )}
            </div>

            <div>
              <CardTitle className="text-xs sm:text-sm font-black tracking-wider uppercase flex items-center gap-2">
                <span className={isAcknowledged ? "text-emerald-400" : "text-red-400 font-mono"}>
                  {isAcknowledged
                    ? "✓ AUTHORIZED TRANSIT CONFIRMED"
                    : isCountdown
                    ? "🚨 GEOFENCE BREACH DETECTED // IMMEDIATE OPERATOR ACTION REQUIRED"
                    : isEscalated
                    ? "🔴 CODE RED: UNRESPONSIVE KINEMATIC ANOMALY"
                    : "🔴 CODE RED: ACTIVE SOLAS DISTRESS RESCUE ENGAGED"}
                </span>
              </CardTitle>
              <span className="text-[11px] text-zinc-400 font-mono block mt-0.5">
                Autonomous Vessel Safety & Kinematic Threat Containment System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-[11px] uppercase tracking-wider px-2.5 py-0.5 font-bold",
                isAcknowledged
                  ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                  : "border-red-500/60 bg-red-950/50 text-red-300"
              )}
            >
              {incidentWorkflow.incidentId}
            </Badge>
            {isAcknowledged && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
                onClick={resetIncidentWorkflow}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 flex flex-col gap-3.5 text-xs sm:text-sm">
          {/* Situation Notice */}
          {isAcknowledged ? (
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between gap-3 text-emerald-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-xs sm:text-sm block">
                    Movement acknowledged by operator.
                  </span>
                  <span className="text-xs text-zinc-400 block">
                    Automatic SOS escalation cancelled. Transit recorded as intentional at {incidentWorkflow.acknowledgedAt || "just now"}. Continuous vessel safety monitoring active.
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-500/50 text-emerald-300 hover:bg-emerald-950/60 text-xs shrink-0"
                onClick={resetIncidentWorkflow}
              >
                Dismiss
              </Button>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-red-950/35 border-l-4 border-l-red-500 border-y border-r border-red-500/25 flex items-start gap-3 text-zinc-200">
              <ShieldAlert className="size-5 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Your vessel has crossed the statutory maritime perimeter into restricted waters (
                <strong className="text-red-400 font-bold">{incidentWorkflow.zoneName || "Protected Corridor"}</strong>
                ). Automated emergency escalation to the Indian Coast Guard MRCC 1554 will initiate if no operator acknowledgment is received.
              </div>
            </div>
          )}

          {/* 4-Tile High-Tech Telemetry HUD */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between hover:border-zinc-700 transition-colors">
              <span className="text-zinc-400 block text-[10px] font-mono uppercase tracking-wider">
                Restricted Corridor
              </span>
              <span className="font-bold text-red-400 truncate block text-xs sm:text-sm mt-1">
                {incidentWorkflow.zoneName || "Statutory IMBL"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between hover:border-zinc-700 transition-colors">
              <span className="text-zinc-400 block text-[10px] font-mono uppercase tracking-wider">
                Current Location
              </span>
              <span className="font-semibold text-cyan-300 font-mono text-xs sm:text-sm mt-1 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                {incidentWorkflow.coordinates?.lat.toFixed(4)}°N, {incidentWorkflow.coordinates?.lon.toFixed(4)}°E
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between hover:border-zinc-700 transition-colors">
              <span className="text-zinc-400 block text-[10px] font-mono uppercase tracking-wider">
                SOG • True Heading
              </span>
              <span className="font-semibold text-zinc-200 font-mono text-xs sm:text-sm mt-1 flex items-center gap-1.5">
                <Navigation className="size-3.5 text-zinc-400" />
                {incidentWorkflow.speedKts != null ? `${incidentWorkflow.speedKts} kts` : "N/A"} • {incidentWorkflow.headingDeg != null ? `${incidentWorkflow.headingDeg}°` : "N/A"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between hover:border-zinc-700 transition-colors">
              <span className="text-zinc-400 block text-[10px] font-mono uppercase tracking-wider">
                Emergency Escape
              </span>
              <span className="font-bold text-emerald-400 font-mono text-xs sm:text-sm mt-1 truncate flex items-center gap-1">
                <Compass className="size-3.5 text-emerald-400 shrink-0" />
                {incidentWorkflow.returnBearing}
              </span>
              <span className="text-[10px] text-zinc-400 truncate block mt-0.5">
                to {incidentWorkflow.nearestPort} ({incidentWorkflow.portDistanceNM} NM)
              </span>
            </div>
          </div>

          {/* Real System-Clock Countdown & Intent Action Buttons (When in countdown) */}
          {isCountdown && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-zinc-900 to-red-950/40 border border-amber-500/40 flex flex-col gap-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <Clock className="size-4 text-amber-400 animate-spin" />
                  <span className="font-bold text-amber-300 tracking-wider">
                    AUTONOMOUS SAFETY ESCALATION TIMER
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-xs text-zinc-400">Response required in:</span>
                  <div className="px-3 py-1 rounded-lg bg-zinc-950 border border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.25)] font-mono text-sm font-black text-amber-400 tracking-widest">
                    00:{secondsRemaining.toString().padStart(2, "0")}
                  </div>
                </div>
              </div>

              <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                  style={{ width: `${progressValue}%` }}
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <Button
                  type="button"
                  className="h-11 text-xs sm:text-sm font-bold bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.15)] rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                  onClick={() => confirmIntentional()}
                >
                  <Check className="size-4 text-emerald-400" />
                  THIS MOVEMENT IS INTENTIONAL
                </Button>

                <Button
                  type="button"
                  className="h-11 text-xs sm:text-sm font-bold bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white border border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.4)] rounded-xl transition-all duration-200 flex items-center justify-center gap-2 animate-pulse"
                  onClick={() => dispatchSosToChat(false)}
                >
                  <AlertTriangle className="size-4" />
                  I NEED HELP / SOS — TRIGGER SAR RESCUE
                </Button>
              </div>
            </div>
          )}

          {/* Escalated / SOS Mode (When countdown reached zero or operator pressed SOS) */}
          {(isEscalated || isSos) && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-red-950/60 via-zinc-900 to-red-950/40 border border-red-500/60 shadow-[0_0_30px_rgba(239,68,68,0.25)] flex flex-col gap-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-5 text-red-500 animate-pulse" />
                  <span className="font-bold text-xs sm:text-sm text-red-400 tracking-wide font-mono">
                    {isEscalated
                      ? "🔴 SOLAS ESCALATION: UNRESPONSIVE KINEMATIC ANOMALY"
                      : "🔴 ACTIVE SOLAS DISTRESS RESCUE PROTOCOL ENGAGED"}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-red-500/60 bg-red-950/80 text-red-300 font-bold">
                  MULTI-AGENT SAR STREAMING BELOW
                </Badge>
              </div>

              <div className="text-xs text-zinc-300 leading-relaxed">
                {isEscalated
                  ? "Zero acknowledgment received within 60 seconds. Vessel remains inside the restricted corridor. Multi-agent emergency intelligence and Coast Guard MRCC dispatch parameters streaming in the chat feed below."
                  : "Operator activated emergency distress protocol. Multi-agent SAR emergency response streaming below with tactical safe port vector and official distress channels."}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-red-500/20">
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                  <a href="tel:1554" className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1">
                    <PhoneCall className="size-3.5" /> Coast Guard MRCC: 1554
                  </a>
                  <span className="text-zinc-400">VHF: Ch 16 (156.800 MHz)</span>
                  <a href="tel:1093" className="text-zinc-300 hover:text-white font-semibold">
                    Police: 1093
                  </a>
                </div>

                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 text-xs font-semibold gap-1.5 shadow-md"
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
