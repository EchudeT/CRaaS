// Run with: node tests/edge-routing.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/edgeRouting.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const compiledModule = { exports: {} }
new Function('require', 'module', 'exports', compiled.outputText)(require, compiledModule, compiledModule.exports)
const { routeEdges } = compiledModule.exports
const node = (id, x, y, width = 168, height = 54, type = 'net') => ({ id, type, position: { x, y }, style: { width, height }, data: {} })
const nodes = [node('a', 0, 0), node('b', 0, 380), node('blocking', 0, 180), node('zone', -24, -48, 216, 510, 'zonebox')]
const links = [
  { id: 'edge1', source: 'a', target: 'b', label: '100GE', data: { link: { evidence: '原文依据' } } },
  { id: 'edge2', source: 'a', target: 'b', label: 'control' },
]
const before = JSON.stringify({ nodes, links })
function intersects(a, b, n) {
  const r = { ...n.position, ...n.style }
  if (a.x === b.x) return a.x > r.x && a.x < r.x + r.width && Math.max(a.y, b.y) > r.y && Math.min(a.y, b.y) < r.y + r.height
  return a.y > r.y && a.y < r.y + r.height && Math.max(a.x, b.x) > r.x && Math.min(a.x, b.x) < r.x + r.width
}
function verify(routed, obstacles) {
  for (const edge of routed) {
    assert.ok(edge.data?.route, `no obstacle-free route for ${edge.id}`)
    const points = edge.data.route.points
    assert.ok(!/NaN|Infinity/.test(edge.data.route.path))
    for (let i = 1; i < points.length; i++) {
      assert.ok(points[i - 1].x === points[i].x || points[i - 1].y === points[i].y, 'segments must follow routing channels')
      for (const obstacle of obstacles) {
        const rect = obstacle.type === 'zonebox' ? { ...obstacle, style: { ...obstacle.style, height: 32 } } : obstacle
        assert.ok(!intersects(points[i - 1], points[i], rect), `${edge.id} crosses ${obstacle.id}`)
      }
    }
  }
}
const routed = routeEdges(nodes, links)
verify(routed, nodes)
assert.notEqual(routed[0].data.route.path, routed[1].data.route.path, 'parallel edges should use separate channels')
assert.deepEqual(routed.map(({ id, source, target, label }) => ({ id, source, target, label })), links.map(({ id, source, target, label }) => ({ id, source, target, label })))
assert.deepEqual(routed[0].data.link, links[0].data.link)
assert.equal(JSON.stringify({ nodes, links }), before, 'routing must not alter facts or saved coordinates')
const moved = nodes.map((n) => n.id === 'b' ? { ...n, position: { x: 500, y: 350 } } : n)
verify(routeEdges(moved, links), moved)
const manyNodes = Array.from({ length: 40 }, (_, i) => node(`n${i}`, (i % 5) * 340, Math.floor(i / 5) * 150))
const manyEdges = Array.from({ length: 55 }, (_, i) => ({ id: `e${i}`, source: `n${i % 40}`, target: `n${(i * 7 + 9) % 40}` })).filter((e) => e.source !== e.target)
const start = performance.now()
const manyRouted = routeEdges(manyNodes, manyEdges)
verify(manyRouted, manyNodes)
console.log(`Edge routing checks passed: obstacle and header avoidance, parallel channels, dragging, preserved facts; dense graph ${Math.round(performance.now() - start)} ms.`)
