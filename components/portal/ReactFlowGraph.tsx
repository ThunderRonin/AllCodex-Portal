"use client";

import "@xyflow/react/dist/style.css";
import { useCallback } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type ReactFlowInstance,
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
  const onInit = useCallback((instance: ReactFlowInstance) => {
    requestAnimationFrame(() => instance.fitView({ padding: 0.15 }));
  }, []);

  return (
    <div className={`h-[350px] ${className ?? ""}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        onInit={onInit}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
      </ReactFlow>
    </div>
  );
}
