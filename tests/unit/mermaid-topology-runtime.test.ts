import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildNativeMermaidPreviewSvg,
  getMermaidDiagramDirection,
  layoutMermaidTopology,
  parseMermaidTopology,
} from '../../apps/web/src/components/mermaid/mermaidTopology.ts';

test('Mermaid topology parser preserves nodes and edge labels without third-party runtime', () => {
  const topology = parseMermaidTopology(`flowchart LR
    A[Start] -->|approved| B{Review}
    B --> C[Ship]`);

  assert.deepEqual(
    topology.nodes.map((node) => node.id),
    ['A', 'B', 'C']
  );
  assert.equal(topology.edges.length, 2);
  assert.equal(topology.edges[0].label, 'approved');
  assert.equal(getMermaidDiagramDirection('graph LR\nA --> B'), 'LR');
});

test('Mermaid topology layout handles cycles in O(V + E) without recursive level growth', () => {
  const topology = parseMermaidTopology(`flowchart TD
    A[Alpha] --> B[Beta]
    B --> A`);
  const layout = layoutMermaidTopology(topology, {
    direction: 'TD',
    nodeWidth: 180,
    nodeHeight: 80,
    gapX: 80,
    gapY: 60,
    padding: 40,
  });

  assert.equal(layout.nodes.length, 2);
  assert.ok(layout.width > 0);
  assert.ok(layout.height > 0);
  layout.nodes.forEach((node) => {
    assert.ok(Number.isFinite(node.x));
    assert.ok(Number.isFinite(node.y));
    assert.ok(node.level >= 0);
  });
});

test('Native Mermaid preview SVG escapes user labels before injecting markup', () => {
  const svg = buildNativeMermaidPreviewSvg(`flowchart TD
    A[<script>alert(1)</script>] --> B[Done & ready]`);

  assert.match(svg, /<svg/);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;alert/);
  assert.match(svg, /\(1\)&lt;\/script&gt;/);
  assert.match(svg, /Done &amp; ready/);
});
