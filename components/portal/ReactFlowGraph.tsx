"use client";

import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  Background,
  BackgroundVariant,
} from "@xyflow/react";

interface ReactFlowGraphProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: NodeMouseHandler;
  className?: string;
}

export function ReactFlowGraph({
  nodes,
  edges,
  onNodeClick,
  className,
}: ReactFlowGraphProps) {
  return (
    <div className={`h-[350px] ${className ?? ""}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
      </ReactFlow>
    </div>
  );
}
