import { DBEdge, DBNode } from "app-types/workflow";
import { NodeKind } from "../workflow.interface";

export function addEdgeBranchLabel(nodes: DBNode[], edges: DBEdge[]) {
  const outs = (id: string) => edges.filter((e) => e.source === id);
  const start = nodes.find((n) => n.kind === NodeKind.Input);
  if (!start) return;
  const q: { id: string; bid: string }[] = [{ id: start.id, bid: "B0" }];

  while (q.length) {
    const item = q.shift();
    if (!item) break;
    const { id, bid } = item;
    const node = nodes.find((n) => n.id === id);
    if (!node) continue;
    const nexts = outs(id);

    if (node.kind === NodeKind.Condition) {
      const byHandle = new Map<string, DBEdge[]>();
      nexts.forEach((e) => {
        e.uiConfig = e.uiConfig || {};
        const h = e.uiConfig.sourceHandle ?? (e as any).sourceHandle ?? "right";
        (byHandle.get(h) ?? byHandle.set(h, []).get(h))!.push(e);
      });
      byHandle.forEach((group) => {
        if (group.length === 1) {
          const [e] = group;
          e.uiConfig = e.uiConfig || {};
          if (!e.uiConfig.label) {
            e.uiConfig.label = bid;
            q.push({ id: e.target, bid });
          }
        } else {
          group.forEach((e, i) => {
            e.uiConfig = e.uiConfig || {};
            const newBid = `${bid}.${i}`;
            if (!e.uiConfig.label) {
              e.uiConfig.label = newBid;
              q.push({ id: e.target, bid: newBid });
            }
          });
        }
      });
    } else {
      nexts.forEach((e, i) => {
        e.uiConfig = e.uiConfig || {};
        const newBid = nexts.length > 1 ? `${bid}.${i}` : bid;
        if (!e.uiConfig.label) {
          e.uiConfig.label = newBid;
          q.push({ id: e.target, bid: newBid });
        }
      });
    }
  }
}
