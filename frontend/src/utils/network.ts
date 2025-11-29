import { type Node } from 'reactflow';
import { type DeviceData } from '../types/nodes';

/**
 * 智能生成下一个可用 IP 地址
 * Simple heuristic to find the next available IP in the 192.168.1.x subnet
 */
export const generateNextIP = (nodes: Node<DeviceData>[]): string => {
  const subnet = '192.168.1.';
  const usedSuffixes = new Set<number>();

  nodes.forEach((node) => {
    if (node.data.ip && node.data.ip.startsWith(subnet)) {
      const suffix = parseInt(node.data.ip.split('.')[3], 10);
      if (!isNaN(suffix)) {
        usedSuffixes.add(suffix);
      }
    }
  });

  // Start checking from 1 (Gateway) up to 254
  // Typically .1 is Router, so maybe we want to be smart about device type, 
  // but for now, sequential allocation is good enough.
  for (let i = 1; i < 255; i++) {
    if (!usedSuffixes.has(i)) {
      return `${subnet}${i}`;
    }
  }

  return '192.168.1.x'; // Fallback if subnet is full (unlikely for this demo)
};
