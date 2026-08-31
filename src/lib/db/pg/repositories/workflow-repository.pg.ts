import { and, desc, eq, inArray, not, or, sql } from "drizzle-orm";
import { pgDb } from "../db.pg";
import {
  UserTable,
  WorkflowEdgeTable,
  WorkflowNodeDataTable,
  WorkflowTable,
} from "../schema.pg";
import {
  DBWorkflow,
  DBEdge,
  DBNode,
  WorkflowRepository,
  WorkflowSummary,
} from "app-types/workflow";
import { NodeKind } from "lib/ai/workflow/workflow.interface";
import { createUINode } from "lib/ai/workflow/create-ui-node";
import {
  convertUINodeToDBNode,
  defaultObjectJsonSchema,
} from "lib/ai/workflow/shared.workflow";
import { ObjectJsonSchema7 } from "app-types/util";
import { SAGARDRISHTI_PRESEEDED_WORKFLOWS } from "lib/ai/marine-workflows-seed";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str: string | undefined | null): boolean {
  return typeof str === "string" && UUID_REGEX.test(str);
}

export const pgWorkflowRepository: WorkflowRepository = {
  async selectToolByIds(ids) {
    if (!ids.length) return [];
    
    // Check preseeded workflows first
    const preseededMatches = SAGARDRISHTI_PRESEEDED_WORKFLOWS
      .filter((w) => ids.includes(w.id))
      .map((w) => {
        const inputNode = w.nodes.find((n) => n.kind === NodeKind.Input || n.kind === "input");
        return {
          id: w.id,
          name: w.name,
          description: w.description,
          schema: ((inputNode?.nodeConfig as any)?.outputSchema || (inputNode?.nodeConfig as any)?.schema || structuredClone(defaultObjectJsonSchema)) as ObjectJsonSchema7,
        };
      });

    const validIds = ids.filter(isValidUUID);
    if (!validIds.length) return preseededMatches;

    const rows = await pgDb
      .select({
        id: WorkflowTable.id,
        name: WorkflowTable.name,
        description: WorkflowTable.description,
        schema: WorkflowNodeDataTable.nodeConfig,
      })
      .from(WorkflowTable)
      .innerJoin(
        WorkflowNodeDataTable,
        and(
          eq(WorkflowNodeDataTable.workflowId, WorkflowTable.id),
          eq(WorkflowNodeDataTable.kind, NodeKind.Input),
        ),
      )
      .where(
        and(
          inArray(WorkflowTable.id, validIds),
          eq(WorkflowTable.isPublished, true),
        ),
      );

    const dbMatches = rows.map(
      (data) =>
        ({
          ...data,
          schema:
            data.schema?.outputSchema ||
            structuredClone(defaultObjectJsonSchema),
        }) as {
          id: string;
          name: string;
          description?: string;
          schema: ObjectJsonSchema7;
        },
    );

    return [...preseededMatches, ...dbMatches];
  },

  async selectExecuteAbility(userId) {
    const rows = await pgDb
      .select({
        id: WorkflowTable.id,
        name: WorkflowTable.name,
        description: WorkflowTable.description,
        icon: WorkflowTable.icon,
        visibility: WorkflowTable.visibility,
        isPublished: WorkflowTable.isPublished,
        userId: WorkflowTable.userId,
        userName: UserTable.name,
        userAvatar: UserTable.image,
        updatedAt: WorkflowTable.updatedAt,
      })
      .from(WorkflowTable)
      .innerJoin(UserTable, eq(WorkflowTable.userId, UserTable.id))
      .where(
        and(
          eq(WorkflowTable.isPublished, true),
          or(
            eq(WorkflowTable.userId, userId),
            not(eq(WorkflowTable.visibility, "private")),
          ),
        ),
      );

    const preseededSummaries: WorkflowSummary[] = SAGARDRISHTI_PRESEEDED_WORKFLOWS.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      icon: w.icon as any,
      visibility: w.visibility as any,
      isPublished: true,
      userId: "system",
      userName: "SagarDrishti System",
      updatedAt: new Date(),
    }));

    const existingIds = new Set(rows.map((r) => r.id));
    return [
      ...preseededSummaries.filter((p) => !existingIds.has(p.id)),
      ...(rows as WorkflowSummary[]),
    ];
  },

  async selectAll(userId) {
    const rows = await pgDb
      .select({
        id: WorkflowTable.id,
        name: WorkflowTable.name,
        description: WorkflowTable.description,
        icon: WorkflowTable.icon,
        visibility: WorkflowTable.visibility,
        isPublished: WorkflowTable.isPublished,
        userId: WorkflowTable.userId,
        userName: UserTable.name,
        userAvatar: UserTable.image,
        updatedAt: WorkflowTable.updatedAt,
      })
      .from(WorkflowTable)
      .innerJoin(UserTable, eq(WorkflowTable.userId, UserTable.id))
      .where(
        or(
          inArray(WorkflowTable.visibility, ["public", "readonly"]),
          eq(WorkflowTable.userId, userId),
        ),
      )
      .orderBy(desc(WorkflowTable.createdAt));

    const preseededSummaries: WorkflowSummary[] = SAGARDRISHTI_PRESEEDED_WORKFLOWS.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      icon: w.icon as any,
      visibility: w.visibility as any,
      isPublished: true,
      userId: "system",
      userName: "SagarDrishti System",
      updatedAt: new Date(),
    }));


    const existingIds = new Set(rows.map((r) => r.id));
    return [
      ...preseededSummaries.filter((p) => !existingIds.has(p.id)),
      ...(rows as WorkflowSummary[]),
    ];
  },

  async selectById(id) {
    const preseeded = SAGARDRISHTI_PRESEEDED_WORKFLOWS.find((w) => w.id === id);
    if (preseeded) {
      return {
        id: preseeded.id,
        name: preseeded.name,
        description: preseeded.description,
        icon: preseeded.icon as any,
        version: preseeded.version || "1.0.0",
        isPublished: preseeded.isPublished,
        visibility: preseeded.visibility as any,
        userId: preseeded.userId || "system",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    if (!isValidUUID(id)) return null;

    try {
      const [workflow] = await pgDb
        .select()
        .from(WorkflowTable)
        .where(eq(WorkflowTable.id, id));
      return workflow as DBWorkflow;
    } catch {
      return null;
    }
  },

  async checkAccess(workflowId, userId, readOnly = true) {
    if (SAGARDRISHTI_PRESEEDED_WORKFLOWS.some((w) => w.id === workflowId)) {
      return true;
    }

    if (!isValidUUID(workflowId) || !isValidUUID(userId)) {
      return false;
    }

    try {
      const [workflow] = await pgDb
        .select({
          visibility: WorkflowTable.visibility,
          userId: WorkflowTable.userId,
        })
        .from(WorkflowTable)
        .where(and(eq(WorkflowTable.id, workflowId)));
      if (!workflow) {
        return false;
      }
      if (userId == workflow.userId) return true;
      if (workflow.visibility === "private") {
        return false;
      }
      if (workflow.visibility == "readonly" && !readOnly) return false;
      return true;
    } catch {
      return false;
    }
  },


  async delete(id) {
    const result = await pgDb
      .delete(WorkflowTable)
      .where(eq(WorkflowTable.id, id));
    if (result.rowCount === 0) {
      throw new Error("Workflow not found");
    }
  },
  async selectByUserId(userId) {
    const rows = await pgDb
      .select()
      .from(WorkflowTable)
      .where(eq(WorkflowTable.userId, userId))
      .orderBy(desc(WorkflowTable.createdAt));
    return rows as DBWorkflow[];
  },
  async save(workflow, noGenerateInputNode = false) {
    const isPreseeded = SAGARDRISHTI_PRESEEDED_WORKFLOWS.find((w) => w.id === workflow.id);
    if (isPreseeded) {
      return {
        id: isPreseeded.id,
        name: workflow.name ?? isPreseeded.name,
        description: workflow.description ?? isPreseeded.description,
        icon: workflow.icon ?? (isPreseeded.icon as any),
        version: workflow.version ?? isPreseeded.version ?? "1.0.0",
        isPublished: workflow.isPublished ?? isPreseeded.isPublished ?? false,
        visibility: workflow.visibility ?? (isPreseeded.visibility as any) ?? "public",
        userId: workflow.userId ?? isPreseeded.userId ?? "system",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as DBWorkflow;
    }

    const prev = workflow.id
      ? await pgDb
          .select({ id: WorkflowTable.id })
          .from(WorkflowTable)
          .where(eq(WorkflowTable.id, workflow.id))
      : null;
    const isNew = !prev;
    const [row] = await pgDb
      .insert(WorkflowTable)
      .values(workflow)
      .onConflictDoUpdate({
        target: [WorkflowTable.id],
        set: {
          ...workflow,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (isNew && !noGenerateInputNode) {
      const startNode = createUINode(NodeKind.Input);
      await pgDb.insert(WorkflowNodeDataTable).values({
        ...convertUINodeToDBNode(row.id, startNode),
        name: "INPUT",
      });
    }

    return row as DBWorkflow;
  },
  async saveStructure({ workflowId, nodes, edges, deleteNodes, deleteEdges }) {
    if (SAGARDRISHTI_PRESEEDED_WORKFLOWS.some((w) => w.id === workflowId)) {
      return;
    }
    await pgDb.transaction(async (tx) => {
      const deletePromises: Promise<any>[] = [];

      if (deleteNodes?.length) {
        const deleteNodePromises = tx
          .delete(WorkflowNodeDataTable)
          .where(
            and(
              eq(WorkflowNodeDataTable.workflowId, workflowId),
              inArray(WorkflowNodeDataTable.id, deleteNodes),
            ),
          );
        deletePromises.push(deleteNodePromises);
      }
      if (deleteEdges?.length) {
        const deleteEdgePromises = tx
          .delete(WorkflowEdgeTable)
          .where(
            and(
              eq(WorkflowEdgeTable.workflowId, workflowId),
              inArray(WorkflowEdgeTable.id, deleteEdges),
            ),
          );
        deletePromises.push(deleteEdgePromises);
      }
      await Promise.all(deletePromises);
      if (nodes?.length) {
        await tx
          .insert(WorkflowNodeDataTable)
          .values(nodes)
          .onConflictDoUpdate({
            target: [WorkflowNodeDataTable.id],
            set: {
              nodeConfig: sql.raw(
                `excluded.${WorkflowNodeDataTable.nodeConfig.name}`,
              ),
              uiConfig: sql.raw(
                `excluded.${WorkflowNodeDataTable.uiConfig.name}`,
              ),
              name: sql.raw(`excluded.${WorkflowNodeDataTable.name.name}`),
              description: sql.raw(
                `excluded.${WorkflowNodeDataTable.description.name}`,
              ),
              kind: sql.raw(`excluded.${WorkflowNodeDataTable.kind.name}`),
              updatedAt: new Date(),
            },
          });
      }
      if (edges?.length) {
        await tx.insert(WorkflowEdgeTable).values(edges).onConflictDoNothing();
      }
    });
  },
  async selectStructureById(id, opt) {
    const preseeded = SAGARDRISHTI_PRESEEDED_WORKFLOWS.find((w) => w.id === id);
    if (preseeded) {
      return {
        id: preseeded.id,
        name: preseeded.name,
        description: preseeded.description,
        icon: preseeded.icon as any,
        version: preseeded.version || "1.0.0",
        isPublished: true,
        visibility: preseeded.visibility as any,
        userId: preseeded.userId || "system",
        createdAt: new Date(),
        updatedAt: new Date(),
        nodes: (preseeded.nodes || []) as DBNode[],
        edges: (preseeded.edges || []) as DBEdge[],
      };
    }

    if (!isValidUUID(id)) return null;

    try {
      const [workflow] = await pgDb
        .select()
        .from(WorkflowTable)
        .where(eq(WorkflowTable.id, id));

      if (!workflow) return null;

      const nodeWhere = opt?.ignoreNote
        ? and(
            eq(WorkflowNodeDataTable.workflowId, id),
            not(eq(WorkflowNodeDataTable.kind, NodeKind.Note)),
          )
        : eq(WorkflowNodeDataTable.workflowId, id);

      const nodePromises = pgDb
        .select()
        .from(WorkflowNodeDataTable)
        .where(nodeWhere);
      const edgePromises = pgDb
        .select()
        .from(WorkflowEdgeTable)
        .where(eq(WorkflowEdgeTable.workflowId, id));
      const [nodes, edges] = await Promise.all([nodePromises, edgePromises]);
      return {
        ...(workflow as DBWorkflow),
        nodes: (nodes || []) as DBNode[],
        edges: (edges || []) as DBEdge[],
      };
    } catch {
      return null;
    }
  },
};
