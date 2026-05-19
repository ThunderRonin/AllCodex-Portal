"use client";

import { useEffect, useRef, useId, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface MermaidDiagramProps {
  /** Mermaid DSL string (e.g. "graph LR; A-->B") */
  chart: string;
  /** Additional CSS classes on the container */
  className?: string;
  /** Called when a node with a data-id is clicked */
  onNodeClick?: (nodeId: string) => void;
}

let mermaidInstance: typeof import("mermaid") | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Ensures Mermaid is imported once, initialized with the project's theme, flowchart, and security configuration, and cached for reuse.
 *
 * @returns The initialized Mermaid module instance
 */
async function ensureMermaid() {
  if (mermaidInstance) return mermaidInstance;
  if (!initPromise) {
    initPromise = (async () => {
      const m = await import("mermaid");
      m.default.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          // Match the grimoire palette
          primaryColor: "#6b4c2a",
          primaryTextColor: "#e8dcc8",
          primaryBorderColor: "#8b6914",
          secondaryColor: "#2a1f3d",
          secondaryTextColor: "#d4c9a8",
          tertiaryColor: "#1a1528",
          lineColor: "#8b6914",
          textColor: "#e8dcc8",
          mainBkg: "#1a1528",
          nodeBorder: "#8b6914",
          clusterBkg: "#1a1528",
          edgeLabelBackground: "#1a1528",
          fontSize: "14px",
        },
        flowchart: {
          htmlLabels: true,
          curve: "basis",
          padding: 12,
          nodeSpacing: 50,
          rankSpacing: 60,
        },
        securityLevel: "antiscript",
      });
      mermaidInstance = m;
    })();
  }
  await initPromise;
  return mermaidInstance!;
}

export function MermaidDiagram({ chart, className, onNodeClick }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, "-");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chart.trim()) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const m = await ensureMermaid();
        if (cancelled || !containerRef.current) return;

        // Clear previous render
        containerRef.current.innerHTML = "";

        const { svg } = await m.default.render(`mermaid-${uniqueId}`, chart);
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = svg;
        setError(null);

        // Attach click handlers if callback provided
        if (onNodeClick) {
          const nodes = containerRef.current.querySelectorAll("[data-id]");
          for (const node of nodes) {
            (node as HTMLElement).style.cursor = "pointer";
            node.addEventListener("click", () => {
              const id = node.getAttribute("data-id");
              if (id) onNodeClick(id);
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to render diagram");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [chart, uniqueId, onNodeClick]);

  if (error) {
    return (
      <div className={`text-sm text-destructive/80 italic p-4 ${className ?? ""}`}>
        Diagram render failed: {error}
      </div>
    );
  }

  return (
    <div className={className}>
      {loading && (
        <div className="space-y-3 p-4">
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto [&_svg]:mx-auto [&_svg]:max-w-full"
      />
    </div>
  );
}
