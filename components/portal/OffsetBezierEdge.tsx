"use client";

import { BaseEdge, type EdgeProps } from "@xyflow/react";

const OFFSET_PX = 35;

export function OffsetBezierEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const parallelIndex = (data?.parallelIndex as number) ?? 0;
  const parallelCount = (data?.parallelCount as number) ?? 1;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;

  const offsetFactor = parallelIndex - (parallelCount - 1) / 2;
  const offset = offsetFactor * OFFSET_PX;

  const mx = (sourceX + targetX) / 2 + px * offset;
  const my = (sourceY + targetY) / 2 + py * offset;

  const path = `M ${sourceX} ${sourceY} Q ${mx} ${my} ${targetX} ${targetY}`;

  // Stagger labels along the curve so parallel labels don't stack
  const t = parallelCount <= 1
    ? 0.5
    : 0.3 + (parallelIndex / (parallelCount - 1)) * 0.4;
  const u = 1 - t;
  const labelX = u * u * sourceX + 2 * t * u * mx + t * t * targetX;
  const labelY = u * u * sourceY + 2 * t * u * my + t * t * targetY;

  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
      markerEnd={markerEnd}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
    />
  );
}
