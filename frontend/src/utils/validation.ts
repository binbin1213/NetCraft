import { type Edge, type Node } from 'reactflow';
import { type ConnectionType, type DeviceData, type DeviceType } from '../types/nodes';
import {
  DEVICE_IP_ZONE,
  PORT_CONFLICT_RULES,
  SERVICE_CATALOG,
  findIpRange,
} from '../data/knowledge';

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'cycle'
  | 'ip-conflict'
  | 'ip-invalid'
  | 'link-speed-exceeds'
  | 'link-bottleneck'
  | 'port-overflow'
  | 'isolated-node'
  | 'no-gateway'
  | 'port-conflict'
  | 'ip-zone-mismatch';

export interface Issue {
  /** Stable id so React keys and dismissal state survive recomputation. */
  id: string;
  code: IssueCode;
  severity: IssueSeverity;
  nodeIds: string[];
  edgeIds: string[];
  /** Values interpolated into the localized message, e.g. { ip: '192.168.1.1' }. */
  params?: Record<string, string | number>;
}

/** Nominal link rate in Mbps. Wi-Fi is excluded from speed checks. */
export const LINK_SPEED_MBPS: Record<ConnectionType, number | null> = {
  fiber: 10000,
  eth_10g: 10000,
  'eth_2.5g': 2500,
  eth_1g: 1000,
  wifi: null,
};

/** Maximum useful port rate per device class, in Mbps. */
export const DEVICE_MAX_SPEED_MBPS: Record<DeviceType, number> = {
  modem: 1000,
  router: 2500,
  switch: 10000,
  ap: 1000,
  pc: 2500,
  server: 10000,
  firewall: 2500,
  pve: 10000,
  esxi: 10000,
  unraid: 10000,
  vm_windows: 10000,
  vm_linux: 10000,
  vm_openwrt: 10000,
};

/** Device types that can act as the network egress. */
const GATEWAY_TYPES: DeviceType[] = ['modem', 'router', 'firewall'];

const IPV4_RE =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export const isValidIPv4 = (value: string): boolean => IPV4_RE.test(value.trim());

const maxSpeedOf = (type: DeviceType): number =>
  DEVICE_MAX_SPEED_MBPS[type] ?? 1000;

/** Union-find over node ids, used for undirected cycle detection. */
class DisjointSet {
  private parent = new Map<string, string>();

  find(id: string): string {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      return id;
    }
    let root = id;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let cursor = id;
    while (this.parent.get(cursor) !== root) {
      const next = this.parent.get(cursor)!;
      this.parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }

  /** Returns false when the two ids are already connected (i.e. edge closes a loop). */
  union(a: string, b: string): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;
    this.parent.set(rootA, rootB);
    return true;
  }
}

/**
 * Inspect a topology and return design problems.
 *
 * Physical cables are undirected, so all graph reasoning treats A->B and B->A
 * as the same link.
 */
export const analyzeTopology = (
  nodes: Node<DeviceData>[],
  edges: Edge[]
): Issue[] => {
  const issues: Issue[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // --- 1. Cycles (broadcast storms on L2 without STP) ---
  const dsu = new DisjointSet();
  for (const edge of edges) {
    // Ignore dangling edges that reference removed nodes.
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    if (!dsu.union(edge.source, edge.target)) {
      issues.push({
        id: `cycle:${edge.id}`,
        code: 'cycle',
        severity: 'error',
        nodeIds: [edge.source, edge.target],
        edgeIds: [edge.id],
      });
    }
  }

  // --- 2. IP conflicts and invalid addresses ---
  const ipGroups = new Map<string, string[]>();
  for (const node of nodes) {
    const rawIp = (node.data.ip ?? '').trim();
    if (!rawIp) continue;
    if (!isValidIPv4(rawIp)) {
      issues.push({
        id: `ip-invalid:${node.id}`,
        code: 'ip-invalid',
        severity: 'warning',
        nodeIds: [node.id],
        edgeIds: [],
        params: { ip: rawIp },
      });
      continue;
    }
    const group = ipGroups.get(rawIp) ?? [];
    group.push(node.id);
    ipGroups.set(rawIp, group);
  }
  for (const [ip, ids] of ipGroups) {
    if (ids.length > 1) {
      issues.push({
        id: `ip-conflict:${ip}`,
        code: 'ip-conflict',
        severity: 'error',
        nodeIds: ids,
        edgeIds: [],
        params: { ip, count: ids.length },
      });
    }
  }

  // --- 3. Link speed vs. endpoint capability ---
  for (const edge of edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;

    const connType: ConnectionType = edge.data?.type ?? 'eth_1g';
    const linkSpeed = LINK_SPEED_MBPS[connType];
    if (linkSpeed === null) continue; // Wi-Fi: no meaningful cable rate

    const capSource = maxSpeedOf(source.data.type);
    const capTarget = maxSpeedOf(target.data.type);
    const bottleneck = Math.min(capSource, capTarget);

    if (linkSpeed > bottleneck) {
      issues.push({
        id: `link-speed-exceeds:${edge.id}`,
        code: 'link-speed-exceeds',
        severity: 'warning',
        nodeIds: [edge.source, edge.target],
        edgeIds: [edge.id],
        params: { link: linkSpeed / 1000, device: bottleneck / 1000 },
      });
    } else if (bottleneck >= 5000 && linkSpeed <= 1000) {
      // Only flag a real downgrade: a multi-gigabit device wired at 1G or less.
      // A 2.5G-capable PC on a 1G link is normal in home setups, not a problem.
      issues.push({
        id: `link-bottleneck:${edge.id}`,
        code: 'link-bottleneck',
        severity: 'info',
        nodeIds: [edge.source, edge.target],
        edgeIds: [edge.id],
        params: { link: linkSpeed / 1000, device: bottleneck / 1000 },
      });
    }
  }

  // --- 4. Port overflow (each link consumes one port on both ends) ---
  const degree = new Map<string, number>();
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  for (const node of nodes) {
    const used = degree.get(node.id) ?? 0;
    // interfaceCount counts LAN ports; the WAN/uplink port is one extra.
    const capacity = (node.data.interfaceCount ?? 3) + 1;
    if (used > capacity) {
      issues.push({
        id: `port-overflow:${node.id}`,
        code: 'port-overflow',
        severity: 'warning',
        nodeIds: [node.id],
        edgeIds: [],
        params: { used, capacity },
      });
    }
  }

  // --- 5. Isolated nodes (only meaningful once a topology exists) ---
  if (nodes.length > 1) {
    for (const node of nodes) {
      if ((degree.get(node.id) ?? 0) === 0) {
        issues.push({
          id: `isolated-node:${node.id}`,
          code: 'isolated-node',
          severity: 'warning',
          nodeIds: [node.id],
          edgeIds: [],
        });
      }
    }
  }

  // --- 6. No egress device at all ---
  if (nodes.length > 0 && !nodes.some((n) => GATEWAY_TYPES.includes(n.data.type))) {
    issues.push({
      id: 'no-gateway',
      code: 'no-gateway',
      severity: 'info',
      nodeIds: [],
      edgeIds: [],
    });
  }

  // --- 7. Service port conflicts documented in the knowledge base ---
  // Match on the ports a service actually declares, not just its name: a
  // "dnsmasq (5353)" entry has deliberately moved off 53 and must not be
  // reported as competing for it.
  for (const node of nodes) {
    const services = node.data.services ?? [];
    if (services.length === 0) continue;

    const normalizeName = (value: string) =>
      value.toLowerCase().replace(/[\s_()（）-]/g, '');

    /** Catalog entries this service plausibly maps to. */
    const resolveEntry = (name: string) => {
      const needle = normalizeName(name);
      return SERVICE_CATALOG.filter((entry) => {
        const entryName = normalizeName(entry.name);
        return (
          needle.includes(entry.id) ||
          entryName.includes(needle) ||
          needle.startsWith(entry.id)
        );
      });
    };

    for (const rule of PORT_CONFLICT_RULES) {
      // Which services on this host listen on the contested port?
      const claimants = services.filter((svc) => {
        if (!svc.ports.includes(rule.port)) return false;
        return resolveEntry(svc.name).some((e) => e.id === rule.a || e.id === rule.b);
      });

      const ids = new Set(
        claimants.flatMap((svc) =>
          resolveEntry(svc.name)
            .filter((e) => e.id === rule.a || e.id === rule.b)
            .map((e) => e.id)
        )
      );

      if (claimants.length >= 2 && ids.has(rule.a) && ids.has(rule.b)) {
        issues.push({
          id: `port-conflict:${node.id}:${rule.a}:${rule.b}`,
          code: 'port-conflict',
          severity: 'warning',
          nodeIds: [node.id],
          edgeIds: [],
          params: {
            host: node.data.name,
            a: rule.a,
            b: rule.b,
            port: rule.port,
            resolution: rule.resolution,
          },
        });
      }
    }
  }

  // --- 8. IP outside the recommended zone for that device class ---
  for (const node of nodes) {
    const ip = (node.data.ip ?? '').trim();
    if (!isValidIPv4(ip)) continue;
    const zoneId = DEVICE_IP_ZONE[node.data.type];
    if (!zoneId) continue;

    const lastOctet = Number(ip.split('.')[3]);
    const actual = findIpRange(lastOctet);
    if (!actual) {
      issues.push({
        id: `ip-zone-mismatch:${node.id}`,
        code: 'ip-zone-mismatch',
        severity: 'info',
        nodeIds: [node.id],
        edgeIds: [],
        params: { ip, expected: zoneId, actual: 'unassigned' },
      });
    }
  }

  return issues;
};

export const countBySeverity = (issues: Issue[]) => ({
  error: issues.filter((i) => i.severity === 'error').length,
  warning: issues.filter((i) => i.severity === 'warning').length,
  info: issues.filter((i) => i.severity === 'info').length,
});
