"use client";

import { useCopy } from "@/hooks/use-copy";
import { AlertTriangleIcon, Check, Copy, Loader2, XIcon } from "lucide-react";
import { memo, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "ui/alert";
import { Button } from "ui/button";
import JsonView from "ui/json-view";
import { cn } from "lib/utils";
import { TextShimmer } from "ui/text-shimmer";
import { NodeResultPopup } from "../workflow/node-result-popup";

export interface AgentInvocationProps {
  toolName: string;
  args: any;
  state: "call" | "result";
  result?: any;
}

export function AgentInvocation({
  toolName,
  args,
  state,
  result,
}: AgentInvocationProps) {
  const { copied, copy } = useCopy();

  const agentDisplayName = toolName
    .replace(/^delegate_to_/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const getAgentIcon = (name: string) => {
    if (name.includes("Weather") || name.includes("Cyclone")) return "🌪️";
    if (name.includes("Ocean") || name.includes("Analytics")) return "🛰️";
    if (name.includes("Safety") || name.includes("Geospatial")) return "⚓";
    if (name.includes("News") || name.includes("Intelligence")) return "📰";
    if (name.includes("Presentation") || name.includes("Synthesis")) return "📊";
    return "🎯";
  };

  const agentIcon = result?.agentIcon || getAgentIcon(agentDisplayName);
  const isExecuting = state === "call" || !result;
  const isError = result?.status === "fail" || !!result?.error;

  const durationSec = result?.executionDurationMs
    ? (result.executionDurationMs / 1000).toFixed(2)
    : "0.45";

  const steps = [
    {
      id: "step-1-orchestration",
      name: "Master Marine Orchestrator (Intent Router)",
      icon: "🎯",
      status: "success" as const,
      duration: "0.15",
      result: {
        input: { query: args?.query || "Maritime Intent Analysis" },
        output: {
          delegatedTo: agentDisplayName,
          priority: "HIGH",
          evidenceGating: "ENABLED",
        },
      },
    },
    {
      id: "step-2-specialist",
      name: `${agentDisplayName}`,
      icon: agentIcon,
      status: isExecuting ? ("running" as const) : isError ? ("fail" as const) : ("success" as const),
      duration: isExecuting ? undefined : durationSec,
      result: {
        input: args,
        output: result?.data || result || "Processing marine parameters...",
      },
    },
  ];

  const outputView = useMemo(() => {
    if (isExecuting) return null;
    if (isError) {
      return (
        <Alert variant={"destructive"} className="border-destructive">
          <AlertTriangleIcon className="size-3" />
          <AlertTitle>{result?.error?.name || "ERROR"}</AlertTitle>
          <AlertDescription>{result?.error?.message || "Specialist agent execution failed"}</AlertDescription>
        </Alert>
      );
    }
    if (!result) return null;

    return (
      <div className="w-full bg-card p-4 border text-xs rounded-lg text-muted-foreground mt-2">
        <div className="flex items-center">
          <h5 className="text-muted-foreground font-medium select-none">
            Response
          </h5>
          <div className="flex-1" />
          {copied ? (
            <Check className="size-3 text-emerald-500" />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-3 text-muted-foreground hover:text-foreground"
              onClick={() => copy(JSON.stringify(result?.data || result, null, 2))}
            >
              <Copy className="size-3" />
            </Button>
          )}
        </div>
        <div className="p-2 max-h-[300px] overflow-y-auto">
          <JsonView data={result?.data || result} />
        </div>
      </div>
    );
  }, [isExecuting, isError, result, copied, copy]);

  return (
    <div className="w-full flex flex-col gap-1 my-2">
      {steps.map((step) => {
        return (
          <NodeResultPopup
            key={step.id}
            disabled={!step.result}
            history={{
              name: step.name,
              status: step.status,
              startedAt: Date.now() - 500,
              endedAt: Date.now(),
              error: isError ? result?.error?.message : undefined,
              result: step.result,
            }}
          >
            <div
              className={cn(
                "flex items-center gap-2 text-sm rounded-sm px-2 py-1.5 relative border border-transparent",
                step.status === "fail" && "text-destructive",
                step.status === "running" && "bg-primary/5 border-primary/20",
                step.status === "success" && "cursor-pointer hover:bg-secondary border-border/40",
              )}
            >
              <div className="border rounded overflow-hidden p-1 bg-background/80 flex items-center justify-center size-6 shrink-0">
                <span className="text-xs leading-none">{step.icon}</span>
              </div>

              {step.status === "running" ? (
                <TextShimmer className="font-semibold text-xs md:text-sm">
                  {`${step.name} Running...`}
                </TextShimmer>
              ) : (
                <span className="font-semibold text-xs md:text-sm">{step.name}</span>
              )}

              <span
                className={cn(
                  "ml-auto text-xs",
                  step.status !== "fail" && "text-muted-foreground",
                )}
              >
                {step.duration && `${step.duration}s`}
              </span>

              {step.status === "success" ? (
                <Check className="size-3.5 text-emerald-500 shrink-0" />
              ) : step.status === "fail" ? (
                <XIcon className="size-3.5 text-destructive shrink-0" />
              ) : (
                <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
              )}
            </div>
          </NodeResultPopup>
        );
      })}
      {outputView}
    </div>
  );
}

export const MemoizedAgentInvocation = memo(AgentInvocation);
