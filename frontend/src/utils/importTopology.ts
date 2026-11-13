import { type Edge, type Node } from 'reactflow';
import { type DeviceData, type DeviceType, type EdgeData } from '../types/nodes';

const KNOWN_DEVICE_TYPES: DeviceType[] = [
  'modem',
  'router',
  'switch',
  'pc',
  'server',
  'ap',
  'firewall',
  'pve',
  'esxi',
  'unraid',
  'vm_windows',
  'vm_linux',
  'vm_openwrt',
];

const KNOWN_CONNECTION_TYPES: EdgeData['type'][] = [
  'fiber',
  'eth_1g',
  'eth_2.5g',
  'eth_10g',
  'wifi',
];

/** Non-fatal problems, reported as codes so the UI can localize them. */
export type ImportWarning =
  | { code: 'nodeNotObject'; index: number }
  | { code: 'duplicateNodeId'; id: string }
  | { code: 'unknownDeviceType'; id: string; type: string }
  | { code: 'edgeNotObject'; index: number }
  | { code: 'edgeMissingNode'; index: number }
  | { code: 'selfLoop'; index: number }
  | { code: 'duplicateEdge'; source: string; target: string }
  | { code: 'unknownConnectionType'; source: string; target: string; type: string };

export interface ImportResult {
  nodes: Node<DeviceData>[];
  edges: Edge<EdgeData>[];
  warnings: ImportWarning[];
}

/** Machine-readable reasons, translated by the UI layer. */
export type ImportErrorCode =
  | 'invalidJson'
  | 'notAnObject'
  | 'missingNodes'
  | 'edgesNotArray'
  | 'noNodes';

export class ImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode) {
    super(code);
    this.name = 'ImportError';
    this.code = code;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Parse a topology exported by "导出 JSON" (or a cloud project payload).
 *
 * Accepts both `{ nodes, edges }` and a bare `{ data: [{ nodes, edges }] }`
 * wrapper. Throws ImportError with a user-facing message when the payload
 * cannot be interpreted at all; recoverable problems become warnings.
 */
export const parseTopologyFile = (raw: string): ImportResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ImportError('invalidJson');
  }

  return parseTopologyObject(parsed);
};

export const parseTopologyObject = (parsed: unknown): ImportResult => {
  if (!isObject(parsed)) {
    throw new ImportError('notAnObject');
  }

  // Unwrap the cloud project shape: { data: [{ nodes, edges }] }
  let payload: Record<string, unknown> = parsed;
  if ('data' in parsed) {
    const data = parsed.data;
    const first = Array.isArray(data) ? data[0] : data;
    if (isObject(first) && ('nodes' in first || 'edges' in first)) {
      payload = first;
    }
  }

  const rawNodes = payload.nodes;
  const rawEdges = payload.edges;

  if (!Array.isArray(rawNodes)) {
    throw new ImportError('missingNodes');
  }
  if (rawEdges !== undefined && !Array.isArray(rawEdges)) {
    throw new ImportError('edgesNotArray');
  }

  const warnings: ImportWarning[] = [];
  const nodes: Node<DeviceData>[] = [];
  const seenIds = new Set<string>();

  rawNodes.forEach((entry, index) => {
    if (!isObject(entry)) {
      warnings.push({ code: 'nodeNotObject', index });
      return;
    }
    const data = isObject(entry.data) ? entry.data : {};
    const id = typeof entry.id === 'string' && entry.id ? entry.id : `imported_node_${index}`;

    if (seenIds.has(id)) {
      warnings.push({ code: 'duplicateNodeId', id });
      return;
    }
    seenIds.add(id);

    const rawType = String(data.type ?? '');
    let type = rawType as DeviceType;
    if (!KNOWN_DEVICE_TYPES.includes(type)) {
      warnings.push({ code: 'unknownDeviceType', id, type: rawType });
      type = 'pc';
    }

    const position = isObject(entry.position) ? entry.position : {};
    const x = Number(position.x);
    const y = Number(position.y);

    nodes.push({
      id,
      // Always render through our own node component.
      type: 'deviceNode',
      position: {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
      },
      data: {
        name: typeof data.name === 'string' && data.name ? data.name : id,
        type,
        ip: typeof data.ip === 'string' ? data.ip : '',
        status:
          data.status === 'online' || data.status === 'offline' || data.status === 'warning'
            ? data.status
            : 'online',
        services: Array.isArray(data.services)
          ? (data.services as DeviceData['services'])
          : [],
        brand: typeof data.brand === 'string' ? data.brand : undefined,
        model: typeof data.model === 'string' ? data.model : undefined,
        interfaceCount:
          typeof data.interfaceCount === 'number' ? data.interfaceCount : undefined,
        managementPort:
          typeof data.managementPort === 'string' ? data.managementPort : undefined,
        os: typeof data.os === 'string' ? data.os : undefined,
        os_version: typeof data.os_version === 'string' ? data.os_version : undefined,
        cpu: typeof data.cpu === 'string' ? data.cpu : undefined,
        ram: typeof data.ram === 'string' ? data.ram : undefined,
        disk: typeof data.disk === 'string' ? data.disk : undefined,
        dns: typeof data.dns === 'string' ? data.dns : undefined,
        gateway: typeof data.gateway === 'string' ? data.gateway : undefined,
      },
    });
  });

  if (nodes.length === 0) {
    throw new ImportError('noNodes');
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: Edge<EdgeData>[] = [];
  const edgeSignatures = new Set<string>();

  (rawEdges ?? []).forEach((entry, index) => {
    if (!isObject(entry)) {
      warnings.push({ code: 'edgeNotObject', index });
      return;
    }
    const source = String(entry.source ?? '');
    const target = String(entry.target ?? '');

    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      warnings.push({ code: 'edgeMissingNode', index });
      return;
    }
    if (source === target) {
      warnings.push({ code: 'selfLoop', index });
      return;
    }

    // Physical cables are undirected; collapse duplicates.
    const signature = [source, target].sort().join('->');
    if (edgeSignatures.has(signature)) {
      warnings.push({ code: 'duplicateEdge', source, target });
      return;
    }
    edgeSignatures.add(signature);

    const data = isObject(entry.data) ? entry.data : {};
    const rawConn = String(data.type ?? 'eth_1g');
    const connType = KNOWN_CONNECTION_TYPES.includes(rawConn as EdgeData['type'])
      ? (rawConn as EdgeData['type'])
      : 'eth_1g';
    if (connType !== rawConn) {
      warnings.push({
        code: 'unknownConnectionType',
        source,
        target,
        type: rawConn,
      });
    }

    edges.push({
      id: typeof entry.id === 'string' && entry.id ? entry.id : `imported_edge_${index}`,
      source,
      target,
      type: 'smartEdge',
      sourceHandle: typeof entry.sourceHandle === 'string' ? entry.sourceHandle : undefined,
      targetHandle: typeof entry.targetHandle === 'string' ? entry.targetHandle : undefined,
      data: { type: connType, animated: data.animated !== false },
    });
  });

  return { nodes, edges, warnings };
};
