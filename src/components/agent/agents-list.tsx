"use client";

import { useTranslations } from "next-intl";
import { AgentSummary, AgentUpdateSchema } from "app-types/agent";
import { Card, CardDescription, CardHeader, CardTitle } from "ui/card";
import { Button } from "ui/button";
import { Plus, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { BackgroundPaths } from "ui/background-paths";
import { useBookmark } from "@/hooks/queries/use-bookmark";
import { useMutateAgents } from "@/hooks/queries/use-agents";
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher } from "lib/utils";
import { Visibility } from "@/components/shareable-actions";
import { ShareableCard } from "@/components/shareable-card";
import { notify } from "lib/notify";
import { useMemo, useState } from "react";
import { handleErrorWithToast } from "ui/shared-toast";
import { safe } from "ts-safe";
import { canCreateAgent } from "lib/auth/client-permissions";
import {
  SAGARDRISHTI_PRESEEDED_AGENTS,
  SLUG_TO_UUID_MAP,
  UUID_TO_SLUG_MAP,
} from "lib/ai/marine-agents-seed";

const DEFAULT_SYSTEM_AGENTS: AgentSummary[] = SAGARDRISHTI_PRESEEDED_AGENTS.map(
  (agent) => ({
    id: SLUG_TO_UUID_MAP[agent.id] || agent.id,
    name: agent.name,
    description: agent.description,
    icon: agent.icon,
    userId: agent.userId || "system",
    visibility: (agent.visibility || "public") as any,
    isBookmarked: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  })
);

const PRESEEDED_ID_SET = new Set<string>([
  ...Object.keys(SLUG_TO_UUID_MAP),
  ...Object.values(SLUG_TO_UUID_MAP),
  ...SAGARDRISHTI_PRESEEDED_AGENTS.map((a) => a.id),
]);

function isDefaultAgent(agent: { id: string; name?: string }): boolean {
  if (!agent) return false;
  if (PRESEEDED_ID_SET.has(agent.id)) return true;
  return SAGARDRISHTI_PRESEEDED_AGENTS.some(
    (p) => p.name.toLowerCase() === (agent.name || "").toLowerCase()
  );
}

interface AgentsListProps {
  initialMyAgents: AgentSummary[];
  initialSharedAgents: AgentSummary[];
  userId: string;
  userRole?: string | null;
}

export function AgentsList({
  initialMyAgents,
  initialSharedAgents,
  userId,
  userRole,
}: AgentsListProps) {
  const t = useTranslations();
  const mutateAgents = useMutateAgents();
  const [deletingAgentLoading, setDeletingAgentLoading] = useState<
    string | null
  >(null);
  const [visibilityChangeLoading, setVisibilityChangeLoading] = useState<
    string | null
  >(null);

  const { data: allAgents } = useSWR(
    "/api/agent?filters=mine,shared",
    fetcher,
    {
      fallbackData: [...initialMyAgents, ...initialSharedAgents],
    },
  );

  const rawAgents: AgentSummary[] =
    allAgents || [...initialMyAgents, ...initialSharedAgents];

  // Custom agents created by this user (non-default)
  const customAgents = rawAgents.filter(
    (agent: AgentSummary) => agent.userId === userId && !isDefaultAgent(agent)
  );

  // Core fleet & shared agents (deduplicated by normalized ID & name)
  const fleetAgents = useMemo(() => {
    const list: AgentSummary[] = [];
    const seenIds = new Set<string>();

    const normalize = (id: string) => {
      return SLUG_TO_UUID_MAP[id] || UUID_TO_SLUG_MAP[id] || id;
    };

    const add = (agent: AgentSummary) => {
      if (!agent || !agent.id) return;
      const key1 = agent.id;
      const key2 = normalize(agent.id);
      const nameKey = agent.name ? agent.name.toLowerCase().trim() : undefined;
      if (
        seenIds.has(key1) ||
        seenIds.has(key2) ||
        (nameKey && seenIds.has(nameKey))
      ) {
        return;
      }
      seenIds.add(key1);
      seenIds.add(key2);
      if (nameKey) seenIds.add(nameKey);
      list.push(agent);
    };

    // First add DB versions of default and shared agents
    for (const a of rawAgents) {
      if (isDefaultAgent(a) || a.userId !== userId) {
        add(a);
      }
    }

    // Ensure all 6 default preseeded agents are present
    for (const p of DEFAULT_SYSTEM_AGENTS) {
      add(p);
    }

    return list;
  }, [rawAgents, userId]);

  const { toggleBookmark: toggleBookmarkHook, isLoading: isBookmarkLoading } =
    useBookmark({
      itemType: "agent",
    });

  const toggleBookmark = async (agentId: string, isBookmarked: boolean) => {
    await toggleBookmarkHook({ id: agentId, isBookmarked });
  };

  const updateVisibility = async (agentId: string, visibility: Visibility) => {
    safe(() => setVisibilityChangeLoading(agentId))
      .map(() => AgentUpdateSchema.parse({ visibility }))
      .map(JSON.stringify)
      .map(async (body) =>
        fetcher(`/api/agent/${agentId}`, {
          method: "PUT",
          body,
        }),
      )
      .ifOk(() => {
        mutateAgents({ id: agentId, visibility });
        toast.success(t("Agent.visibilityUpdated"));
      })
      .ifFail((e) => {
        handleErrorWithToast(e);
        toast.error(t("Common.error"));
      })
      .watch(() => setVisibilityChangeLoading(null));
  };

  const deleteAgent = async (agentId: string) => {
    const ok = await notify.confirm({
      description: t("Agent.deleteConfirm"),
    });
    if (!ok) return;
    safe(() => setDeletingAgentLoading(agentId))
      .map(() =>
        fetcher(`/api/agent/${agentId}`, {
          method: "DELETE",
        }),
      )
      .ifOk(() => {
        mutateAgents({ id: agentId }, true);
        toast.success(t("Agent.deleted"));
      })
      .ifFail((e) => {
        handleErrorWithToast(e);
        toast.error(t("Common.error"));
      })
      .watch(() => setDeletingAgentLoading(null));
  };

  // Check if user can create agents using Better Auth permissions
  const canCreate = canCreateAgent(userRole ?? "editor");

  return (
    <div className="w-full flex flex-col gap-4 p-8">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold" data-testid="agents-title">
            Multi-Agent Orchestration Fleet
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Autonomous marine intelligence specialists coordinated by the Master Marine Planner. All specialist agents and custom user agents are dynamically routed and orchestrated for multi-agent tactical missions.
          </p>
        </div>
        {canCreate && (
          <Link href="/agent/new" className="shrink-0">
            <Button variant="ghost" data-testid="create-agent-button">
              <Plus />
              {t("Agent.newAgent")}
            </Button>
          </Link>
        )}
      </div>

      {/* Custom User Agents Section */}
      {canCreate && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              Custom Agents (Multi-Agent Integrated)
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/agent/new">
              <Card
                className="relative bg-secondary overflow-hidden cursor-pointer hover:bg-input transition-colors h-[196px]"
                data-testid="create-agent-card"
              >
                <div className="absolute inset-0 w-full h-full opacity-50">
                  <BackgroundPaths />
                </div>
                <CardHeader>
                  <CardTitle>
                    <h1 className="text-lg font-bold">
                      {t("Agent.newAgent")}
                    </h1>
                  </CardTitle>
                  <CardDescription className="mt-2">
                    <p>
                      Deploy a custom specialist agent. Automatically ingested into multi-agent orchestration and task routing.
                    </p>
                  </CardDescription>
                  <div className="mt-auto ml-auto flex-1">
                    <Button variant="ghost" size="lg">
                      {t("Common.create")}
                      <ArrowUpRight className="size-3.5" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            </Link>

            {customAgents.map((agent) => (
              <ShareableCard
                key={agent.id}
                type="agent"
                item={agent}
                href={`/agent/${agent.id}`}
                onVisibilityChange={updateVisibility}
                isVisibilityChangeLoading={visibilityChangeLoading === agent.id}
                isDeleteLoading={deletingAgentLoading === agent.id}
                onDelete={deleteAgent}
              />
            ))}
          </div>
        </div>
      )}

      {/* Specialized Marine Multi-Agent Fleet */}
      <div className="flex flex-col gap-4 mt-8">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            Specialized Marine Multi-Agent Fleet
          </h2>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fleetAgents.map((agent) => (
            <ShareableCard
              key={agent.id}
              type="agent"
              item={agent}
              isOwner={agent.userId === userId && !isDefaultAgent(agent)}
              href={`/agent/${agent.id}`}
              onBookmarkToggle={toggleBookmark}
              isBookmarkToggleLoading={isBookmarkLoading(agent.id)}
            />
          ))}
          {fleetAgents.length === 0 && (
            <Card className="col-span-full bg-transparent border-none">
              <CardHeader className="text-center py-12">
                <CardTitle>
                  {canCreate
                    ? t("Agent.noSharedAgents")
                    : t("Agent.noAvailableAgents")}
                </CardTitle>
                <CardDescription>
                  {canCreate
                    ? t("Agent.noSharedAgentsDescription")
                    : t("Agent.noAvailableAgentsDescription")}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
