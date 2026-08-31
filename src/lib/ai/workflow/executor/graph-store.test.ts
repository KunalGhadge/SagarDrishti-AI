import { DBNode } from "app-types/workflow";
import { describe, expect, it } from "vitest";
import { createGraphStore } from "./graph-store";

describe("graph-store", () => {
  it("get/set Output", () => {
    const store = createGraphStore({
      nodes: [],
      edges: [],
    });
    const context = store();
    expect(
      context.getOutput({
        nodeId: "v1",
        path: [],
      }),
    ).toBe(undefined);

    expect(
      context.getOutput({
        nodeId: "v1",
        path: ["person"],
      }),
    ).toBe(undefined);

    context.setOutput(
      {
        nodeId: "v1",
        path: ["person"],
      },
      {
        name: "sagardrishti",
        age: 30,
      },
    );
    expect(
      context.getOutput({
        nodeId: "v1",
        path: ["person"],
      }),
    ).toEqual({
      name: "sagardrishti",
      age: 30,
    });

    expect(
      context.getOutput({
        nodeId: "v1",
        path: ["person", "name"],
      }),
    ).toBe("sagardrishti");

    expect(
      context.getOutput({
        nodeId: "v1",
        path: ["person", "name", "xxx"],
      }),
    ).toBe(undefined);

    context.setOutput(
      {
        nodeId: "v2",
        path: ["person", "name", "xxx"],
      },
      "xxx",
    );

    expect(
      context.getOutput({
        nodeId: "v2",
        path: ["person", "name", "xxx"],
      }),
    ).toBe("xxx");
  });
  it("default value", () => {
    const store = createGraphStore({
      nodes: [
        {
          id: "v1",
          nodeConfig: {
            outputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  default: "sagardrishti",
                },
              },
            },
          },
        } as unknown as DBNode,
      ],
      edges: [],
    });
    const context = store();
    expect(
      context.getOutput({
        nodeId: "v1",
        path: ["name"],
      }),
    ).toBe("sagardrishti");
  });
});
