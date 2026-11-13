/**
 * Guards the structured knowledge data against drift.
 *
 * Every fact in src/data/knowledge.ts points at a verbatim quote in
 * RAG/KnowledgeBase/*.md. If a document is edited so that the quote no longer
 * exists, the fact is stale and this test fails — the same failure mode the
 * project already suffered from with 审查报告.md (documentation describing a
 * reality that had moved on).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  IP_PLAN,
  PORT_CONFLICT_RULES,
  SERVICE_CATALOG,
  type SourceRef,
} from '../knowledge';

const KB_DIR = resolve(__dirname, '../../../../RAG/KnowledgeBase');

/** Collapse whitespace so markdown wrapping changes do not break matching. */
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

const documents = new Map<string, string>();

const readDoc = (file: string): string => {
  const cached = documents.get(file);
  if (cached !== undefined) return cached;
  const text = normalize(readFileSync(resolve(KB_DIR, file), 'utf8'));
  documents.set(file, text);
  return text;
};

const allSources: Array<{ label: string; source: SourceRef }> = [
  ...SERVICE_CATALOG.map((s) => ({ label: `service:${s.id}`, source: s.source })),
  ...PORT_CONFLICT_RULES.map((r) => ({ label: `conflict:${r.a}×${r.b}`, source: r.source })),
  ...IP_PLAN.map((r) => ({ label: `ip-range:${r.id}`, source: r.source })),
];

describe('knowledge base source binding', () => {
  it('collects a non-trivial number of sourced facts', () => {
    expect(allSources.length).toBeGreaterThanOrEqual(10);
  });

  it.each(allSources)('$label quote still exists in $source.file', ({ source }) => {
    const doc = readDoc(source.file);
    expect(doc).toContain(normalize(source.quote));
  });

  it('every source points at an existing document', () => {
    for (const { source } of allSources) {
      expect(() => readDoc(source.file)).not.toThrow();
    }
  });
});

describe('knowledge data consistency', () => {
  it('service ids are unique', () => {
    const ids = SERVICE_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('conflict rules reference known services', () => {
    const ids = new Set(SERVICE_CATALOG.map((s) => s.id));
    for (const rule of PORT_CONFLICT_RULES) {
      expect(ids.has(rule.a)).toBe(true);
      expect(ids.has(rule.b)).toBe(true);
      expect(rule.a).not.toBe(rule.b);
    }
  });

  it('each conflict port is actually claimed by both services', () => {
    for (const rule of PORT_CONFLICT_RULES) {
      const a = SERVICE_CATALOG.find((s) => s.id === rule.a)!;
      const b = SERVICE_CATALOG.find((s) => s.id === rule.b)!;
      const claims = (svc: typeof a) =>
        svc.ports.includes(rule.port) || (svc.fallbackPorts ?? []).includes(rule.port);
      expect(claims(a), `${rule.a} should listen on ${rule.port}`).toBe(true);
      expect(claims(b), `${rule.b} should listen on ${rule.port}`).toBe(true);
    }
  });

  it('IP plan ranges do not overlap and stay within 1-254', () => {
    const sorted = [...IP_PLAN].sort((x, y) => x.from - y.from);
    for (const range of sorted) {
      expect(range.from).toBeGreaterThanOrEqual(1);
      expect(range.to).toBeLessThanOrEqual(254);
      expect(range.from).toBeLessThanOrEqual(range.to);
    }
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].from, `${sorted[i].id} overlaps ${sorted[i - 1].id}`)
        .toBeGreaterThan(sorted[i - 1].to);
    }
  });
});
