/**
 * Templates are reference answers, so they must pass the app's own checker.
 *
 * A template that reports errors teaches users a broken pattern, so any newly
 * added template has to satisfy `analyzeTopology()` before it ships.
 */

import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../templates';
import { analyzeTopology } from '../../utils/validation';

const nodeById = (templateId: string, nodeId: string) => {
  const template = TEMPLATES.find((t) => t.id === templateId)!;
  return template.nodes.find((n) => n.id === nodeId)!;
};

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('template %s', (id, template) => {
  it('has at least a modem and a router', () => {
    const types = template.nodes.map((n) => n.data.type);
    expect(types).toContain('modem');
    expect(types.some((t) => t === 'router' || t === 'firewall')).toBe(true);
  });

  it('produces no issues at all', () => {
    // A reference topology should be exemplary: errors mean it is wrong,
    // warnings mean it is sloppy. Both undermine its purpose as a starting point.
    const issues = analyzeTopology(template.nodes, template.edges);
    expect(issues, `${id} must be issue-free: ${JSON.stringify(issues)}`).toEqual([]);
  });

  it('has unique node and edge ids', () => {
    expect(new Set(template.nodes.map((n) => n.id)).size).toBe(template.nodes.length);
    expect(new Set(template.edges.map((e) => e.id)).size).toBe(template.edges.length);
  });

  it('only references existing nodes', () => {
    const ids = new Set(template.nodes.map((n) => n.id));
    for (const e of template.edges) {
      expect(ids.has(e.source), `${e.id} source`).toBe(true);
      expect(ids.has(e.target), `${e.id} target`).toBe(true);
    }
  });

  it('declares i18n keys rather than literal text', () => {
    expect(template.nameKey).toMatch(/^templates\./);
    expect(template.descriptionKey).toMatch(/^templates\./);
  });
});

describe('basic_home follows the single-NAT principle', () => {
  it('bridges the modem: no LAN address on the modem', () => {
    expect(nodeById('basic_home', 't1_modem').data.ip).toBe('');
  });

  it('puts the PC in the same subnet as the router', () => {
    const router = nodeById('basic_home', 't1_router').data.ip;
    const pc = nodeById('basic_home', 't1_pc').data.ip;
    const subnet = (ip: string) => ip.split('.').slice(0, 3).join('.');
    expect(subnet(pc)).toBe(subnet(router));
  });
});

describe('dns_stack separates the DNS components', () => {
  it('keeps AdGuard Home on 53 and dnsmasq off it', () => {
    const router = nodeById('dns_stack', 't4_router');
    const services = router.data.services ?? [];
    const adguard = services.find((s) => s.name.startsWith('AdGuard'));
    const dnsmasq = services.find((s) => s.name.startsWith('dnsmasq'));

    expect(adguard?.ports).toContain('53');
    expect(dnsmasq?.ports).not.toContain('53');
    expect(dnsmasq?.ports).toContain('5353');
  });

  it('does not flag a port conflict', () => {
    const template = TEMPLATES.find((t) => t.id === 'dns_stack')!;
    const codes = analyzeTopology(template.nodes, template.edges).map((i) => i.code);
    expect(codes).not.toContain('port-conflict');
  });
});

describe('bypass_router points clients at the bypass node', () => {
  it('routes the PC gateway and DNS through the bypass address', () => {
    const bypassIp = nodeById('bypass_router', 't3_bypass').data.ip;
    const pc = nodeById('bypass_router', 't3_pc').data;
    expect(pc.gateway).toBe(bypassIp);
    expect(pc.dns).toBe(bypassIp);
  });
});
