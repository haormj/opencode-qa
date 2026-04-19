import { BaseEdge, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

const HANDLE_OFFSET = 8

function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const adjustedSourceX = sourceX - HANDLE_OFFSET
  const adjustedTargetX = targetX + HANDLE_OFFSET

  const [edgePath] = getBezierPath({
    sourceX: adjustedSourceX,
    sourceY,
    sourcePosition,
    targetX: adjustedTargetX,
    targetY,
    targetPosition,
  })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        ...style,
        stroke: '#D0D5DC',
        strokeWidth: 2,
      }}
      markerEnd={markerEnd}
    />
  )
}

export default CustomEdge
