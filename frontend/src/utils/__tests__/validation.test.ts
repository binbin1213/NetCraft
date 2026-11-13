import { describe, expect, it } from 'vitest';
import { type Edge, type Node } from 'reactflow';
import {
  analyzeTopology,
  countBySeverity,
  isValidIPv4,
} from '../validation';
import { type DeviceData, type DeviceType } from '../../types/nodes';

const node = (
  id: string,
  type: DeviceType,
  ip: string,
  extra: Partial<DeviceData> = {}
): Node<DeviceData> => ({
  id,
  type: 'deviceNode',
  position: { x: 0, y: 0 },
  data: { name: id, type, ip, services: [], ...extra },
});

const edge = (
  id: string,
  source: string,
  target: string,
  type: Edge['data'] extends never ? never : 'fiber' | 'eth_1g' | 'eth_2.5g' | 'eth_10g' | 'wifi' = 'eth_1g'
): Edge => ({
  id,
  source,
  target,
  type: 'smartEdge',
  data: { type },
});

const codes = (issues: ReturnType<typeof analyzeTopology>) => issues.map((i) => i.code);

describe('isValidIPv4', () => {
  it('accepts valid addresses', () => {
    expect(isValidIPv4('192.168.1.1')).toBe(true);
    expect(isValidIPv4('10.0.0.254')).toBe(true);
    expect(isValidIPv4('0.0.0.0')).toBe(true);
    expect(isValidIPv4('255.255.255.255')).toBe(true);
  });

  it('rejects malformed addresses', () => {
    expect(isValidIPv4('192.168.1.256')).toBe(false);
    expect(isValidIPv4('192.168.1')).toBe(false);
    expect(isValidIPv4('Public IP')).toBe(false);
    expect(isValidIPv4('192.168.1.x')).toBe(false);
    expect(isValidIPv4('')).toBe(false);
  });
});

describe('analyzeTopology', () => {
  it('returns no issues for a clean linear topology', () => {
    const nodes = [
      node('modem', 'modem', '192.168.1.1'),
      node('router', 'router', '192.168.1.2'),
      node('pc', 'pc', '192.168.1.10'),
    ];
    const edges = [edge('e1', 'modem', 'router'), edge('e2', 'router', 'pc')];

    expect(analyzeTopology(nodes, edges)).toEqual([]);
  });

  it('detects a cycle', () => {
    const nodes = [
      node('a', 'switch', '10.0.0.1'),
      node('b', 'switch', '10.0.0.2'),
      node('c', 'switch', '10.0.0.3'),
    ];
    const edges = [
      edge('e1', 'a', 'b'),
      edge('e2', 'b', 'c'),
      edge('e3', 'c', 'a'), // closes the loop
    ];

    const issues = analyzeTopology(nodes, edges);
    const cycle = issues.filter((i) => i.code === 'cycle');
    expect(cycle).toHaveLength(1);
    expect(cycle[0].severity).toBe('error');
    expect(cycle[0].edgeIds).toEqual(['e3']);
  });

  it('detects IP conflicts across nodes', () => {
    const nodes = [
      node('a', 'pc', '192.168.1.10'),
      node('b', 'pc', '192.168.1.10'),
      node('c', 'pc', '192.168.1.11'),
    ];
    const issues = analyzeTopology(nodes, []);
    const conflict = issues.find((i) => i.code === 'ip-conflict');

    expect(conflict).toBeDefined();
    expect(conflict!.nodeIds.sort()).toEqual(['a', 'b']);
    expect(conflict!.params).toMatchObject({ ip: '192.168.1.10', count: 2 });
  });

  it('flags invalid IP values instead of treating them as a conflict', () => {
    const nodes = [node('a', 'pc', '192.168.1.x'), node('b', 'pc', '192.168.1.x')];
    const issues = analyzeTopology(nodes, []);
    const invalid = issues.filter((i) => i.code === 'ip-invalid');

    expect(invalid).toHaveLength(2);
    expect(issues.some((i) => i.code === 'ip-conflict')).toBe(false);
  });

  it('warns when a link exceeds an endpoint capability', () => {
    // modem caps at 1G, but the link claims 10G
    const nodes = [node('modem', 'modem', '1.1.1.1'), node('sw', 'switch', '10.0.0.1')];
    const edges = [edge('e1', 'modem', 'sw', 'eth_10g')];

    const issues = analyzeTopology(nodes, edges);
    const issue = issues.find((i) => i.code === 'link-speed-exceeds');

    expect(issue).toBeDefined();
    expect(issue!.params).toMatchObject({ link: 10, device: 1 });
  });

  it('reports an informational bottleneck when the link is much slower', () => {
    const nodes = [node('sw', 'switch', '10.0.0.1'), node('srv', 'server', '10.0.0.2')];
    const edges = [edge('e1', 'sw', 'srv', 'eth_1g')];

    const issue = analyzeTopology(nodes, edges).find((i) => i.code === 'link-bottleneck');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
  });

  it('skips speed checks for Wi-Fi links', () => {
    const nodes = [node('r', 'router', '10.0.0.1'), node('ap', 'ap', '10.0.0.2')];
    const edges = [edge('e1', 'r', 'ap', 'wifi')];

    const issues = analyzeTopology(nodes, edges);
    expect(codes(issues)).not.toContain('link-speed-exceeds');
    expect(codes(issues)).not.toContain('link-bottleneck');
  });

  it('detects port overflow using interfaceCount plus the uplink', () => {
    const hub = node('hub', 'switch', '10.0.0.1', { interfaceCount: 1 });
    const leaves = ['a', 'b', 'c'].map((id) => node(id, 'pc', `10.0.0.${10 + id.length}`));
    const edges = [edge('e1', 'hub', 'a'), edge('e2', 'hub', 'b'), edge('e3', 'hub', 'c')];

    const issues = analyzeTopology([hub, ...leaves], edges);
    const overflow = issues.find((i) => i.code === 'port-overflow');

    expect(overflow).toBeDefined();
    expect(overflow!.params).toMatchObject({ used: 3, capacity: 2 });
  });

  it('flags isolated nodes only when more than one node exists', () => {
    const single = analyzeTopology([node('only', 'pc', '10.0.0.1')], []);
    expect(codes(single)).not.toContain('isolated-node');

    const nodes = [node('a', 'pc', '10.0.0.1'), node('b', 'pc', '10.0.0.2')];
    expect(codes(analyzeTopology(nodes, []))).toContain('isolated-node');
  });

  it('suggests adding a gateway when none exists', () => {
    const nodes = [node('pc', 'pc', '10.0.0.1'), node('srv', 'server', '10.0.0.2')];
    expect(codes(analyzeTopology(nodes, []))).toContain('no-gateway');

    const withRouter = [node('r', 'router', '10.0.0.1'), node('pc', 'pc', '10.0.0.2')];
    expect(codes(analyzeTopology(withRouter, []))).not.toContain('no-gateway');
  });

  it('ignores edges that reference missing nodes', () => {
    const nodes = [node('a', 'pc', '10.0.0.1'), node('b', 'switch', '10.0.0.2')];
    const edges = [edge('e1', 'a', 'ghost'), edge('e2', 'a', 'b')];

    const issues = analyzeTopology(nodes, edges);
    // The dangling edge is skipped, so 'a' keeps its single real link to 'b'.
    expect(codes(issues)).not.toContain('cycle');
    expect(codes(issues)).not.toContain('isolated-node');
    expect(issues.filter((i) => i.nodeIds.includes('ghost'))).toHaveLength(0);
  });

  it('produces stable ids so UI state survives recomputation', () => {
    const nodes = [node('a', 'pc', '10.0.0.1'), node('b', 'pc', '10.0.0.1')];
    const first = analyzeTopology(nodes, []).map((i) => i.id);
    const second = analyzeTopology(nodes, []).map((i) => i.id);
    expect(first).toEqual(second);
  });
});

describe('countBySeverity', () => {
  it('counts issues per severity', () => {
    const nodes = [node('a', 'pc', '10.0.0.1'), node('b', 'pc', '10.0.0.1')];
    const counts = countBySeverity(analyzeTopology(nodes, []));

    expect(counts.error).toBe(1); // ip-conflict
    expect(counts.warning).toBe(2); // two isolated nodes
    expect(counts.info).toBe(1); // no-gateway
  });

  it('does not report isolation for a single-node canvas', () => {
    const counts = countBySeverity(analyzeTopology([node('solo', 'pc', '10.0.0.1')], []));
    expect(counts.warning).toBe(0);
  });
});

describe('knowledge-driven checks', () => {
  it('flags AdGuard Home and dnsmasq sharing the same host', () => {
    const router = node('r', 'router', '192.168.1.1', {
      services: [
        { name: 'AdGuard Home', ports: ['53'] },
        { name: 'dnsmasq', ports: ['53'] },
      ],
    });

    const issue = analyzeTopology([router], []).find((i) => i.code === 'port-conflict');
    expect(issue).toBeDefined();
    expect(issue!.nodeIds).toEqual(['r']);
    expect(issue!.params).toMatchObject({ a: 'adguardhome', b: 'dnsmasq', port: '53' });
  });

  it('does not flag the same services on different hosts', () => {
    const a = node('a', 'router', '192.168.1.1', { services: [{ name: 'AdGuard Home', ports: ['53'] }] });
    const b = node('b', 'pve', '192.168.1.21', { services: [{ name: 'dnsmasq', ports: ['53'] }] });

    expect(codes(analyzeTopology([a, b], []))).not.toContain('port-conflict');
  });

  it('ignores unrelated services', () => {
    const n = node('n', 'server', '192.168.1.30', {
      services: [
        { name: 'nginx', ports: ['80'] },
        { name: 'postgres', ports: ['5432'] },
      ],
    });
    expect(codes(analyzeTopology([n], []))).not.toContain('port-conflict');
  });

  it('recognises service names with different casing and spacing', () => {
    const n = node('n', 'router', '192.168.1.1', {
      services: [
        { name: 'adguard_home', ports: ['53'] },
        { name: 'DNSMasq', ports: ['53'] },
      ],
    });
    expect(codes(analyzeTopology([n], []))).toContain('port-conflict');
  });

  it('reports an IP that falls outside every documented range', () => {
    // .60 sits between the server block (.21-.50) and DHCP pool (.100-.200)
    const n = node('n', 'server', '192.168.1.60');
    const issue = analyzeTopology([n], []).find((i) => i.code === 'ip-zone-mismatch');
    expect(issue).toBeDefined();
    expect(issue!.params).toMatchObject({ ip: '192.168.1.60', actual: 'unassigned' });
  });

  it('accepts an IP inside a documented range', () => {
    const n = node('n', 'server', '192.168.1.30');
    expect(codes(analyzeTopology([n], []))).not.toContain('ip-zone-mismatch');
  });
});
