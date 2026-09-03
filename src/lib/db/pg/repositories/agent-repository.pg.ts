import { Agent, AgentRepository, AgentSummary } from "app-types/agent";
import { pgDb as db } from "../db.pg";
import { AgentTable, BookmarkTable, UserTable } from "../schema.pg";
import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { generateUUID } from "lib/utils";
import {
  SAGARDRISHTI_PRESEEDED_AGENTS,
  SLUG_TO_UUID_MAP,
  UUID_TO_SLUG_MAP,
} from "lib/ai/marine-agents-seed";

export { SLUG_TO_UUID_MAP, UUID_TO_SLUG_MAP };

function resolveAgentUuid(id: string): string {
  return SLUG_TO_UUID_MAP[id] || id;
}

let isSeedingInitialized = false;

async function ensureSeededAgents(): Promise<void> {
  if (isSeedingInitialized) return;
  try {
    const existing = await db.select({ id: AgentTable.id }).from(AgentTable).limit(1);
    if (existing.length === 0) {
      const [adminUser] = await db.select({ id: UserTable.id }).from(UserTable).limit(1);
      const ownerId = adminUser?.id;
      if (ownerId) {
        for (const agent of SAGARDRISHTI_PRESEEDED_AGENTS) {
          const uuid = SLUG_TO_UUID_MAP[agent.id] || generateUUID();
          await db
            .insert(AgentTable)
            .values({
              id: uuid,
              name: agent.name,
              description: agent.description,
              icon: agent.icon,
              userId: ownerId,
              instructions: agent.instructions,
              visibility: agent.visibility || "public",
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoNothing();
        }
      }
    }
    isSeedingInitialized = true;
  } catch (err) {
    console.warn("Failed to auto-seed agents into PostgreSQL:", err);
  }
}

export const pgAgentRepository: AgentRepository = {
  async insertAgent(agent) {
    await ensureSeededAgents();
    const [result] = await db
      .insert(AgentTable)
      .values({
        id: generateUUID(),
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        userId: agent.userId,
        instructions: agent.instructions,
        visibility: agent.visibility || "private",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      ...result,
      description: result.description ?? undefined,
      icon: result.icon ?? undefined,
      instructions: result.instructions ?? {},
    };
  },

  async selectAgentById(id, userId): Promise<Agent | null> {
    await ensureSeededAgents();
    const resolvedId = resolveAgentUuid(id);

    // Query genuine database record from PostgreSQL AgentTable
    const [result] = await db
      .select({
        id: AgentTable.id,
        name: AgentTable.name,
        description: AgentTable.description,
        icon: AgentTable.icon,
        userId: AgentTable.userId,
        instructions: AgentTable.instructions,
        visibility: AgentTable.visibility,
        createdAt: AgentTable.createdAt,
        updatedAt: AgentTable.updatedAt,
        isBookmarked: sql<boolean>`${BookmarkTable.id} IS NOT NULL`,
      })
      .from(AgentTable)
      .leftJoin(
        BookmarkTable,
        and(
          eq(BookmarkTable.itemId, AgentTable.id),
          eq(BookmarkTable.userId, userId),
          eq(BookmarkTable.itemType, "agent"),
        ),
      )
      .where(
        and(
          eq(AgentTable.id, resolvedId),
          or(
            eq(AgentTable.userId, userId), // Own agent
            eq(AgentTable.visibility, "public"), // Public agent
            eq(AgentTable.visibility, "readonly"), // Readonly agent
          ),
        ),
      );

    if (!result) {
      // Fallback check in preseeded seed array if database is empty/unseeded
      const fallback = SAGARDRISHTI_PRESEEDED_AGENTS.find((a) => a.id === id || SLUG_TO_UUID_MAP[a.id] === id);
      if (fallback) {
        return {
          ...fallback,
          id: resolvedId,
          createdAt: new Date(),
          updatedAt: new Date(),
          isBookmarked: false,
        };
      }
      return null;
    }

    return {
      ...result,
      description: result.description ?? undefined,
      icon: result.icon ?? undefined,
      instructions: result.instructions ?? {},
      isBookmarked: result.isBookmarked ?? false,
    };
  },

  async selectAgentsByUserId(userId) {
    await ensureSeededAgents();
    const results = await db
      .select({
        id: AgentTable.id,
        name: AgentTable.name,
        description: AgentTable.description,
        icon: AgentTable.icon,
        userId: AgentTable.userId,
        instructions: AgentTable.instructions,
        visibility: AgentTable.visibility,
        createdAt: AgentTable.createdAt,
        updatedAt: AgentTable.updatedAt,
        userName: UserTable.name,
        userAvatar: UserTable.image,
        isBookmarked: sql<boolean>`false`,
      })
      .from(AgentTable)
      .innerJoin(UserTable, eq(AgentTable.userId, UserTable.id))
      .where(eq(AgentTable.userId, userId))
      .orderBy(desc(AgentTable.createdAt));

    return results.map((result) => ({
      ...result,
      description: result.description ?? undefined,
      icon: result.icon ?? undefined,
      instructions: result.instructions ?? {},
      userName: result.userName ?? undefined,
      userAvatar: result.userAvatar ?? undefined,
      isBookmarked: false,
    }));
  },

  async updateAgent(id, userId, agent) {
    await ensureSeededAgents();
    const resolvedId = resolveAgentUuid(id);

    const [result] = await db
      .update(AgentTable)
      .set({
        ...agent,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(AgentTable.id, resolvedId),
          or(
            eq(AgentTable.userId, userId),
            eq(AgentTable.visibility, "public"),
          ),
        ),
      )
      .returning();

    if (!result) {
      throw new Error(`Agent ${id} not found in database or update not permitted`);
    }

    return {
      ...result,
      description: result.description ?? undefined,
      icon: result.icon ?? undefined,
      instructions: result.instructions ?? {},
    };
  },

  async deleteAgent(id, userId) {
    await ensureSeededAgents();
    const resolvedId = resolveAgentUuid(id);
    await db
      .delete(AgentTable)
      .where(and(eq(AgentTable.id, resolvedId), eq(AgentTable.userId, userId)));
  },

  async selectAgents(
    currentUserId,
    filters = ["all"],
    limit = 50,
  ): Promise<AgentSummary[]> {
    await ensureSeededAgents();
    let orConditions: any[] = [];

    for (const filter of filters) {
      if (filter === "mine") {
        orConditions.push(eq(AgentTable.userId, currentUserId));
      } else if (filter === "shared") {
        orConditions.push(
          and(
            ne(AgentTable.userId, currentUserId),
            or(
              eq(AgentTable.visibility, "public"),
              eq(AgentTable.visibility, "readonly"),
            ),
          ),
        );
      } else if (filter === "bookmarked") {
        orConditions.push(
          and(
            ne(AgentTable.userId, currentUserId),
            or(
              eq(AgentTable.visibility, "public"),
              eq(AgentTable.visibility, "readonly"),
            ),
            sql`${BookmarkTable.id} IS NOT NULL`,
          ),
        );
      } else if (filter === "all") {
        orConditions = [
          or(
            eq(AgentTable.userId, currentUserId),
            and(
              ne(AgentTable.userId, currentUserId),
              or(
                eq(AgentTable.visibility, "public"),
                eq(AgentTable.visibility, "readonly"),
              ),
            ),
          ),
        ];
        break;
      }
    }

    const results = await db
      .select({
        id: AgentTable.id,
        name: AgentTable.name,
        description: AgentTable.description,
        icon: AgentTable.icon,
        userId: AgentTable.userId,
        instructions: AgentTable.instructions,
        visibility: AgentTable.visibility,
        createdAt: AgentTable.createdAt,
        updatedAt: AgentTable.updatedAt,
        userName: UserTable.name,
        userAvatar: UserTable.image,
        isBookmarked: sql<boolean>`CASE WHEN ${BookmarkTable.id} IS NOT NULL THEN true ELSE false END`,
      })
      .from(AgentTable)
      .innerJoin(UserTable, eq(AgentTable.userId, UserTable.id))
      .leftJoin(
        BookmarkTable,
        and(
          eq(BookmarkTable.itemId, AgentTable.id),
          eq(BookmarkTable.userId, currentUserId),
          eq(BookmarkTable.itemType, "agent"),
        ),
      )
      .where(orConditions.length > 1 ? or(...orConditions) : orConditions[0])
      .orderBy(
        sql`CASE WHEN ${AgentTable.userId} = ${currentUserId} THEN 0 ELSE 1 END`,
        desc(AgentTable.createdAt),
      )
      .limit(limit);

    return results.map((result) => ({
      ...result,
      description: result.description ?? undefined,
      icon: result.icon ?? undefined,
      instructions: result.instructions ?? {},
      userName: result.userName ?? undefined,
      userAvatar: result.userAvatar ?? undefined,
    }));
  },

  async checkAccess(agentId, userId, destructive = false) {
    await ensureSeededAgents();
    const resolvedId = resolveAgentUuid(agentId);

    const [agent] = await db
      .select({
        visibility: AgentTable.visibility,
        userId: AgentTable.userId,
      })
      .from(AgentTable)
      .where(eq(AgentTable.id, resolvedId));

    if (!agent) {
      return false;
    }
    if (userId === agent.userId) return true;
    if (agent.visibility === "public" && !destructive) return true;
    if (agent.visibility === "readonly" && !destructive) return true;
    return false;
  },
};
