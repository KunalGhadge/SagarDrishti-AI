import { getSession } from "auth/server";
import { createWorkflowExecutor } from "lib/ai/workflow/executor/workflow-executor";
import { workflowRepository } from "lib/db/repository";
import { encodeWorkflowEvent } from "lib/ai/workflow/shared.workflow";
import logger from "logger";
import { colorize } from "consola/utils";
import { errorToString, toAny } from "lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {

  try {
    const { id } = await params;
    let query: any = {};
    let clientNodes: any = null;
    let clientEdges: any = null;
    try {
      const body = await request.json();
      query = body.query || {};
      clientNodes = body.nodes;
      clientEdges = body.edges;
    } catch {}

    const session = await getSession();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
    const hasAccess = await workflowRepository.checkAccess(id, session.user.id);
    if (!hasAccess) {
      return new Response("Unauthorized", { status: 401 });
    }
    const workflow = await workflowRepository.selectStructureById(id);
    if (!workflow) {
      return new Response("Workflow not found", { status: 404 });
    }

    const nodes = clientNodes?.length ? clientNodes : workflow.nodes;
    const edges = clientEdges?.length ? clientEdges : workflow.edges;

    const wfLogger = logger.withDefaults({
      message: colorize("cyan", `WORKFLOW '${workflow.name}' `),
    });
    const app = createWorkflowExecutor({
      edges,
      nodes,
      logger: wfLogger,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let isAborted = false;
        // Subscribe to workflow events
        app.subscribe((evt) => {
          if (isAborted) return;
          if (
            (evt.eventType == "NODE_START" || evt.eventType == "NODE_END") &&
            evt.node.name == "SKIP"
          ) {
            return;
          }
          try {
            const err = toAny(evt)?.error;
            if (err) {
              toAny(evt).error = {
                name: err.name || "ERROR",
                message: errorToString(err) || "Execution Error",
              };
            }
            // Use custom encoding instead of SSE format
            const data = encodeWorkflowEvent(evt);
            controller.enqueue(encoder.encode(data));
            // Close stream when workflow ends
            if (evt.eventType === "WORKFLOW_END") {
              controller.close();
            }
          } catch (error) {
            logger.error("Stream write error:", error);
            try {
              controller.close();
            } catch {}
          }
        });

        // Handle client disconnection
        request.signal.addEventListener("abort", async () => {
          isAborted = true;
          void app.exit();
          try {
            controller.close();
          } catch {}
        });

        // Start the workflow
        app
          .run(
            { query },
            {
              disableHistory: true,
              timeout: 1000 * 60 * 5,
            },
          )
          .then((result) => {
            if (!result.isOk) {
              logger.error("Workflow execution error:", result.error);
            }
          })
          .catch((err) => {
            logger.error("Workflow runner uncaught error:", err);
            try {
              controller.close();
            } catch {}
          });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    logger.error("POST /api/workflow/[id]/execute error:", error);
    return Response.json(
      { error: errorToString(error) || "Internal Server Error" },
      { status: 500 },
    );
  }
}
