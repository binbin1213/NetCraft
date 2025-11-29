import { BaseEdge, type EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import { type EdgeData } from '../../types/nodes';

export default function SmartEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected
}: EdgeProps<EdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // 默认类型
  const type = data?.type || 'eth_1g';
  const isFiber = type === 'fiber';
  const is10G = type === 'eth_10g';
  const isWifi = type === 'wifi';

  // 颜色映射
  let strokeColor = '#64748b'; // slate-500 (default)
  if (isFiber) strokeColor = '#facc15'; // yellow-400
  if (is10G) strokeColor = '#f97316'; // orange-500
  if (isWifi) strokeColor = '#38bdf8'; // sky-400 (dashed)

  // 选中状态高亮
  if (selected) {
    strokeColor = '#22d3ee'; // cyan-400
  }

  return (
    <>
      {/* 底部发光层 (Glow Effect) - 仅在选中或光纤模式下显示 */}
      {(selected || isFiber) && (
        <BaseEdge
          path={edgePath}
          style={{
            stroke: strokeColor,
            strokeWidth: selected ? 5 : 3,
            strokeOpacity: 0.3,
            filter: 'blur(4px)',
          }}
        />
      )}

      {/* 核心连线 */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: isFiber ? 1.5 : 2,
          strokeDasharray: isWifi ? '5,5' : undefined,
          ...style,
        }}
      />

      {/* 数据流动动画 (Flow Animation) */}
      {/* 只有非 Wi-Fi 且开启了动画才显示 (默认都开) */}
      {!isWifi && (
        <circle r="2" fill={strokeColor}>
          <animateMotion dur={isFiber ? "1s" : "2s"} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* 标签渲染 (可选) */}
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[9px] font-mono text-slate-400 shadow-sm backdrop-blur-sm">
              {data.label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
