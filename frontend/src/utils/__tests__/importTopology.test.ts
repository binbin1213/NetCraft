import { describe, expect, it } from 'vitest';
import { ImportError, parseTopologyFile, parseTopologyObject } from '../importTopology';

const exportShape = {
  nodes: [
    {
      id: 'n1',
      type: 'deviceNode',
      position: { x: 10, y: 20 },
      data: { name: '光猫', type: 'modem', ip: '192.168.1.1', status: 'online' },
    },
    {
      id: 'n2',
      type: 'deviceNode',
      position: { x: 30, y: 40 },
      data: { name: '路由', type: 'router', ip: '192.168.1.2' },
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'n1',
      target: 'n2',
      type: 'smartEdge',
      data: { type: 'eth_10g' },
    },
  ],
  version: '1.0.0',
};

describe('parseTopologyFile', () => {
  it('parses a standard export payload', () => {
    const result = parseTopologyFile(JSON.stringify(exportShape));

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.warnings).toEqual([]);
    expect(result.nodes[0].position).toEqual({ x: 10, y: 20 });
    expect(result.nodes[0].data.ip).toBe('192.168.1.1');
    expect(result.edges[0].data?.type).toBe('eth_10g');
  });

  it('unwraps the cloud project shape', () => {
    const cloudShape = { id: 1, name: 'p', data: [{ nodes: exportShape.nodes, edges: exportShape.edges }] };
    const result = parseTopologyObject(cloudShape);
    expect(result.nodes).toHaveLength(2);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseTopologyFile('{not json')).toThrow(ImportError);
  });

  it('rejects a payload without nodes', () => {
    expect(() => parseTopologyFile('{"edges": []}')).toThrow(
      expect.objectContaining({ code: 'missingNodes' })
    );
  });

  it('rejects an empty node list', () => {
    expect(() => parseTopologyFile('{"nodes": [], "edges": []}')).toThrow(
      expect.objectContaining({ code: 'noNodes' })
    );
  });

  it('rejects edges that are not an array', () => {
    expect(() =>
      parseTopologyFile(JSON.stringify({ nodes: exportShape.nodes, edges: 'oops' }))
    ).toThrow(expect.objectContaining({ code: 'edgesNotArray' }));
  });
});

describe('recoverable problems become warnings', () => {
  it('skips edges pointing at missing nodes', () => {
    const payload = {
      nodes: exportShape.nodes,
      edges: [{ id: 'bad', source: 'n1', target: 'ghost' }],
    };
    const result = parseTopologyObject(payload);

    expect(result.edges).toHaveLength(0);
    expect(result.warnings).toContainEqual({ code: 'edgeMissingNode', index: 0 });
  });

  it('collapses duplicate undirected edges', () => {
    const payload = {
      nodes: exportShape.nodes,
      edges: [
        { id: 'a', source: 'n1', target: 'n2' },
        { id: 'b', source: 'n2', target: 'n1' },
      ],
    };
    const result = parseTopologyObject(payload);

    expect(result.edges).toHaveLength(1);
    expect(result.warnings).toContainEqual({ code: 'duplicateEdge', source: 'n2', target: 'n1' });
  });

  it('skips self loops', () => {
    const result = parseTopologyObject({
      nodes: exportShape.nodes,
      edges: [{ id: 'self', source: 'n1', target: 'n1' }],
    });
    expect(result.edges).toHaveLength(0);
    expect(result.warnings).toContainEqual({ code: 'selfLoop', index: 0 });
  });

  it('coerces unknown device types to pc and warns', () => {
    const result = parseTopologyObject({
      nodes: [{ id: 'x', data: { type: 'quantum-router' } }],
      edges: [],
    });
    expect(result.nodes[0].data.type).toBe('pc');
    expect(result.warnings).toContainEqual({ code: 'unknownDeviceType', id: 'x', type: 'quantum-router' });
  });

  it('coerces unknown connection types to eth_1g and warns', () => {
    const result = parseTopologyObject({
      nodes: exportShape.nodes,
      edges: [{ id: 'e', source: 'n1', target: 'n2', data: { type: 'magic' } }],
    });
    expect(result.edges[0].data?.type).toBe('eth_1g');
    expect(result.warnings).toContainEqual({ code: 'unknownConnectionType', source: 'n1', target: 'n2', type: 'magic' });
  });

  it('skips duplicate node ids', () => {
    const result = parseTopologyObject({
      nodes: [
        { id: 'dup', data: { type: 'pc', ip: '1.1.1.1' } },
        { id: 'dup', data: { type: 'pc', ip: '1.1.1.2' } },
      ],
      edges: [],
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.warnings).toContainEqual({ code: 'duplicateNodeId', id: 'dup' });
  });

  it('defaults missing positions to the origin', () => {
    const result = parseTopologyObject({
      nodes: [{ id: 'a', data: { type: 'pc' } }],
      edges: [],
    });
    expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it('always renders nodes through the deviceNode component', () => {
    const result = parseTopologyObject({
      nodes: [{ id: 'a', type: 'evil', data: { type: 'pc' } }],
      edges: [],
    });
    expect(result.nodes[0].type).toBe('deviceNode');
  });
});
