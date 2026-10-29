// Run with: node tests/quantity-layout.cjs
// Exercise the real TypeScript layout without adding a test framework.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/layout.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const compiledModule = { exports: {} }
new Function('require', 'module', 'exports', compiled.outputText)(require, compiledModule, compiledModule.exports)
const { computeLayout, applyPositions, MAX_VISIBLE_INSTANCES } = compiledModule.exports

const scenario = {
  kind: 'logical', zones: [{ id: 'ptn', name: 'PTN', cidr: '', color: '#0072CE' }],
  nodes: [2, 4, 6].map((quantity, i) => ({ id: `ptn_${i}`, name: `PTN ${i}`, zone: 'ptn', type: 'transport', quantity })),
  links: [0, 1].map((i) => ({ id: `link_${i}`, source: `ptn_${i}`, target: `ptn_${i + 1}`, bandwidth: i ? '10Gbps' : '100Gbps' })),
}
const original = JSON.stringify(scenario)
const expanded = computeLayout(scenario)
const groups = expanded.nodes.filter((n) => n.type === 'net')
assert.equal(groups.reduce((sum, n) => sum + n.data.dimensions.count, 0), 12, '2/4/6 must display 12 cards')
assert.equal(expanded.edges.length, 2, 'expansion must not invent instance wiring')
assert.deepEqual(expanded.edges.map((e) => [e.source, e.target]), scenario.links.map((l) => [l.source, l.target]))
assert.equal(expanded.zoneRects[0].count, 12)
function verifyBounds(layout) {
  const nodes = layout.nodes.filter((n) => n.type === 'net')
  for (const n of nodes) {
    const zone = layout.zoneRects.find((z) => z.id === n.data.node.zone)
    assert.ok(n.position.x >= zone.x && n.position.y >= zone.y)
    assert.ok(n.position.x + n.data.dimensions.width <= zone.x + zone.w)
    assert.ok(n.position.y + n.data.dimensions.height <= zone.y + zone.h)
  }
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j]
    assert.ok(a.position.x + a.data.dimensions.width <= b.position.x || b.position.x + b.data.dimensions.width <= a.position.x ||
      a.position.y + a.data.dimensions.height <= b.position.y || b.position.y + b.data.dimensions.height <= a.position.y, 'groups overlap')
  }
}
verifyBounds(expanded)
const compact = computeLayout(scenario, { expandQuantities: false })
assert.equal(compact.nodes.filter((n) => n.type === 'net').reduce((sum, n) => sum + n.data.dimensions.count, 0), 3)
const oldPositions = { ...scenario, nodes: scenario.nodes.map((n, i) => ({ ...n, x: 14, y: 44 + i * 74 })) }
verifyBounds(computeLayout(oldPositions))
const saved = applyPositions(scenario, expanded.nodes)
assert.deepEqual(computeLayout(saved).nodes.filter((n) => n.type === 'net').map((n) => n.position), groups.map((n) => n.position), 'saved expanded positions must survive reload')
const large = computeLayout({ ...scenario, nodes: [{ ...scenario.nodes[0], quantity: 10000 }], links: [] })
assert.equal(large.nodes.find((n) => n.type === 'net').data.dimensions.count, MAX_VISIBLE_INSTANCES)
assert.equal(large.nodes.find((n) => n.type === 'net').data.dimensions.quantity, 10000)
assert.equal(JSON.stringify(scenario), original, 'layout must not mutate extraction or quantities')
console.log('Quantity layout checks passed: expansion, group relations, bounds, compact mode, saved positions, large quantities, immutable input.')
