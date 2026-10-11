"use client";
import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import {
  GitBranch,
  Box,
  Package,
  Bug,
  FileCheck2,
  FileText,
  MessageSquare,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { label, type Snapshot, type Kind } from "@/lib/model";
const icons = {
  Component: Box,
  Dependency: Package,
  Decision: GitBranch,
  Reason: MessageSquare,
  Bug,
  Fix: FileCheck2,
  Evidence: FileText,
};
type GraphNode = Node<
  { label: string; kind: Kind; detail: string; highlighted: boolean },
  "memory"
>;
function MemoryNode({ data, selected }: NodeProps<GraphNode>) {
  const Icon = icons[data.kind];
  return (
    <div
      className={`graph-node ${selected ? "is-selected" : ""} ${data.highlighted ? "is-highlighted" : ""}`}
    >
      <Handle type="target" position={Position.Left} />
      <span className={`node-kind kind-${data.kind.toLowerCase()}`}>
        <Icon size={14} aria-hidden="true" />
        {data.kind}
      </span>
      <strong>{data.label}</strong>
      <span className="node-detail">{data.detail}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { memory: MemoryNode };
const positions: Record<Kind, { x: number; y: number }[]> = {
  Decision: [{ x: 30, y: 50 }],
  Reason: [{ x: 30, y: 245 }],
  Component: [
    { x: 340, y: 50 },
    { x: 645, y: 245 },
  ],
  Dependency: [{ x: 340, y: 435 }],
  Bug: [{ x: 645, y: 50 }],
  Fix: [{ x: 950, y: 245 }],
  Evidence: [
    { x: 30, y: 435 },
    { x: 645, y: 435 },
    { x: 950, y: 435 },
  ],
};
export default function Graph({
  data,
  visibleIds,
  selectedId,
  onSelect,
  highlightedEdges,
  animatePaths = true,
}: {
  data: Snapshot;
  visibleIds: string[];
  selectedId: string;
  onSelect: (id: string) => void;
  highlightedEdges: string[];
  animatePaths?: boolean;
}) {
  const reduced = useReducedMotion(),
    [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>(
      {},
    );
  const { nodes, edges } = useMemo(() => {
    const counts: Partial<Record<Kind, number>> = {};
    const visible = new Set(visibleIds),
      active = new Set(highlightedEdges);
    const highlighted = new Set(
      data.relationships
        .filter((e) => active.has(e.id))
        .flatMap((e) => [e.source, e.target]),
    );
    const nodes: GraphNode[] = data.records
      .filter((r) => visible.has(r.id))
      .map((r) => {
        const index = counts[r.kind] || 0;
        counts[r.kind] = index + 1;
        const position = positions[r.kind][index] || {
          x: (index % 4) * 305,
          y: 630 + Math.floor(index / 4) * 175,
        };
        return {
          id: r.id,
          type: "memory",
          position: offsets[r.id] || position,
          data: {
            label: label(r),
            kind: r.kind,
            detail:
              r.fields.status ||
              r.fields.verificationStatus ||
              r.fields.version ||
              r.fields.type ||
              "Project memory",
            highlighted: highlighted.has(r.id),
          },
          selected: r.id === selectedId,
          ariaLabel: `${r.kind}: ${label(r)}. Press Enter to view record.`,
        };
      });
    const edges = data.relationships
      .filter((e) => visible.has(e.source) && visible.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.type.toLowerCase().replaceAll("_", " "),
        animated: active.has(e.id) && !reduced && animatePaths,
        style: {
          stroke: active.has(e.id) ? "#FF7A2F" : "#48484f",
          strokeWidth: active.has(e.id) ? 2 : 1,
        },
        labelStyle: {
          fill: active.has(e.id) ? "#ffac78" : "#a6a6b1",
          fontSize: 10,
        },
        labelBgStyle: { fill: "#151517", fillOpacity: 1 },
        labelBgPadding: [6, 4] as [number, number],
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: active.has(e.id) ? "#FF7A2F" : "#48484f",
        },
      }));
    return { nodes, edges };
  }, [
    data,
    visibleIds,
    selectedId,
    highlightedEdges,
    reduced,
    offsets,
    animatePaths,
  ]);
  return (
    <div
      className="graph-canvas"
      role="region"
      aria-label="Interactive project memory graph"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => {
          for (const change of changes) {
            if (change.type === "position" && change.position) {
              const position = change.position;
              setOffsets((previous) => ({
                ...previous,
                [change.id]: position,
              }));
            }
            if (change.type === "select" && change.selected)
              onSelect(change.id);
          }
        }}
        onNodeClick={(_, n) => onSelect(n.id)}
        onNodeDragStop={(_, n) =>
          setOffsets((prev) => ({ ...prev, [n.id]: n.position }))
        }
        nodesConnectable={false}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.16 }}
        minZoom={0.25}
        maxZoom={1.6}
        colorMode="dark"
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#37373d" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.selected ? "#ff7a2f" : "#48484f")}
          maskColor="rgba(17,17,19,.75)"
        />
      </ReactFlow>
    </div>
  );
}
