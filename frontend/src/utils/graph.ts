import { type Edge } from 'reactflow';

/**
 * 判断两个节点之间是否已存在连线。
 * 物理线缆没有方向，因此 A->B 与 B->A 视为同一条连接。
 */
export const edgeExists = (
  edges: Edge[],
  source?: string | null,
  target?: string | null
): boolean => {
  if (!source || !target) return false;
  return edges.some(
    (e) =>
      (e.source === source && e.target === target) ||
      (e.source === target && e.target === source)
  );
};
