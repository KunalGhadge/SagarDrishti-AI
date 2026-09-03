import { Skeleton } from "ui/skeleton";
import { Card, CardDescription, CardHeader, CardTitle } from "ui/card";
import { BackgroundPaths } from "ui/background-paths";
import { getTranslations } from "next-intl/server";

export default async function AgentsLoading() {
  const t = await getTranslations();

  return (
    <div className="w-full flex flex-col gap-4 p-8">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Multi-Agent Orchestration Fleet</h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Autonomous marine intelligence specialists coordinated by the Master Marine Planner. All specialist agents and custom user agents are dynamically routed and orchestrated for multi-agent tactical missions.
          </p>
        </div>
        <Skeleton className="h-10 w-32 shrink-0" />
      </div>

      {/* Custom Agents Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            Custom Agents (Multi-Agent Integrated)
          </h2>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Create new agent card */}
          <Card className="relative bg-secondary overflow-hidden h-[196px]">
            <div className="absolute inset-0 w-full h-full opacity-50">
              <BackgroundPaths />
            </div>
            <CardHeader>
              <CardTitle>
                <h1 className="text-lg font-bold">{t("Agent.newAgent")}</h1>
              </CardTitle>
              <CardDescription className="mt-2">
                <p>
                  Deploy a custom specialist agent. Automatically ingested into multi-agent orchestration and task routing.
                </p>
              </CardDescription>
              <div className="mt-auto ml-auto flex-1">
                <Skeleton className="h-10 w-20" />
              </div>
            </CardHeader>
          </Card>

          {/* Agent cards */}
          {Array(2)
            .fill(null)
            .map((_, i) => (
              <Skeleton key={i} className="min-h-[196px]" />
            ))}
        </div>
      </div>

      {/* Specialized Marine Multi-Agent Fleet Section */}
      <div className="flex flex-col gap-4 mt-8">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            Specialized Marine Multi-Agent Fleet
          </h2>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array(6)
            .fill(null)
            .map((_, i) => (
              <Skeleton key={i} className="min-h-[196px]" />
            ))}
        </div>
      </div>
    </div>
  );
}
