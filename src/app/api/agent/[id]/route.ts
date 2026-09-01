import { agentRepository } from "lib/db/repository";
import { getSession } from "auth/server";
import { z } from "zod";
import { AgentUpdateSchema } from "app-types/agent";
import { serverCache } from "lib/cache";
import { CacheKeys } from "lib/cache/cache-keys";
import { canEditAgent, canDeleteAgent } from "lib/auth/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session?.user.id) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const { id } = await params;

  const hasAccess = await agentRepository.checkAccess(id, session.user.id);
  if (!hasAccess) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Access denied to requested agent" } },
      { status: 403 }
    );
  }

  const agent = await agentRepository.selectAgentById(id, session.user.id);
  if (!agent) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: `Agent with ID ${id} not found` } },
      { status: 404 }
    );
  }

  return Response.json(agent);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session?.user.id) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required to update agent" } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;

    // Check access for write operations
    const hasAccess = await agentRepository.checkAccess(id, session.user.id);
    const hasRolePermission = await canEditAgent();

    if (!hasAccess && !hasRolePermission) {
      return Response.json(
        { success: false, error: { code: "FORBIDDEN", message: "User lacks permission to update this agent" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = AgentUpdateSchema.parse(body);

    // For non-owners of public agents, preserve original visibility
    const existingAgent = await agentRepository.selectAgentById(
      id,
      session.user.id,
    );
    if (!existingAgent) {
      return Response.json(
        { success: false, error: { code: "NOT_FOUND", message: `Agent ${id} does not exist` } },
        { status: 404 }
      );
    }

    if (existingAgent.userId !== session.user.id) {
      data.visibility = existingAgent.visibility;
    }

    const agent = await agentRepository.updateAgent(id, session.user.id, data);
    serverCache.delete(CacheKeys.agentInstructions(agent.id));

    return Response.json(agent);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid agent configuration payload",
            details: error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
          },
        },
        { status: 400 },
      );
    }

    console.error("Failed to update agent:", error);
    return Response.json(
      {
        success: false,
        error: {
          code: "DATABASE_UPDATE_ERROR",
          message: error?.message || "Internal database update error occurred",
          details: String(error),
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session?.user.id) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const hasAccess = await agentRepository.checkAccess(
      id,
      session.user.id,
      true, // destructive = true for delete operations
    );
    const hasRolePermission = await canDeleteAgent();

    if (!hasAccess && !hasRolePermission) {
      return Response.json(
        { success: false, error: { code: "FORBIDDEN", message: "Permission denied to delete agent" } },
        { status: 403 }
      );
    }

    await agentRepository.deleteAgent(id, session.user.id);
    serverCache.delete(CacheKeys.agentInstructions(id));
    return Response.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error("Failed to delete agent:", error);
    return Response.json(
      {
        success: false,
        error: {
          code: "DELETE_ERROR",
          message: error?.message || "Internal server error deleting agent",
        },
      },
      { status: 500 }
    );
  }
}
