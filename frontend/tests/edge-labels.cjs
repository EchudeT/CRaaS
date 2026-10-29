// Run with: node tests/edge-labels.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/edgeLabels.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const compiledModule = { exports: {} }
new Function('require', 'module', 'exports', compiled.outputText)(require, compiledModule, compiledModule.exports)
const { placeEdgeLabels } = compiledModule.exports
const node = (id, x, y) => ({ id, type: 'net', position: { x, y }, style: { width: 168, height: 54 }, data: {} })
const nodes = [node('a', 0, 0), node('b', 0, 300), node('blocking', 0, 145)]
const edges = Array.from({ length: 4 }, (_, i) => ({
  id: `e${i}`, source: 'a', target: 'b', sourceHandle: 'b', targetHandle: 't',
  label: i === 3 ? '这是一条包含接口协议和带宽信息的长链路描述' : `100GE · protocol ${i}`,
}))
const before = JSON.stringify({ nodes, edges })
const labels = placeEdgeLabels(nodes, edges)
assert.equal(labels.size, 4)
const rect = (label) => ({ x: label.x - label.width / 2, y: label.y - label.height / 2, width: label.width, height: label.height })
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
const placed = Array.from(labels.values()).map(rect)
for (const label of placed) {
  for (const n of nodes) assert.ok(!overlaps(label, { ...n.position, ...n.style }), 'label must avoid device cards')
}
for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
  assert.ok(!overlaps(placed[i], placed[j]), 'parallel labels must avoid each other')
}
assert.ok(labels.get('e3').height > 24, 'long text must reserve multiple lines')
assert.ok(labels.get('e3').width <= 184)
assert.equal(placeEdgeLabels(nodes, edges.map((edge) => ({ ...edge, label: undefined }))).size, 0)
const moved = nodes.map((n) => n.id === 'b' ? { ...n, position: { x: 400, y: 500 } } : n)
assert.notDeepEqual(placeEdgeLabels(moved, edges).get('e0'), labels.get('e0'), 'labels must follow moved endpoints')
assert.equal(JSON.stringify({ nodes, edges }), before, 'placement must not modify graph facts or positions')
console.log('Edge label checks passed: node avoidance, parallel labels, wrapping, hidden labels, dragging, immutable graph.')
