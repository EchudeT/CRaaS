const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const React = require('react')
const { act, create } = require('react-test-renderer')

const textOf = (node) => typeof node === 'string' ? node : (node?.children || []).map(textOf).join(' ')
const empty = () => ({ kind: 'logical', name: '编辑测试', description: '原文', zones: [], nodes: [], links: [],
  meta: { scene: 'communication_network_and_services', node_count: 0, zone_count: 0, link_count: 0, host_count: 0, generator: 'llm' } })

async function main() {
  const { createServer } = await import('vite')
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  let view
  const unmount = async () => { if (view) await act(async () => { view.unmount(); view = null }) }
  try {
    const { api } = await server.ssrLoadModule('/src/lib/api.ts')
    const { NodePalette } = await server.ssrLoadModule('/src/components/NodePalette.tsx')
    const { insertPaletteNode, receiveNodeDrop, NODE_DRAG_MIME } = await server.ssrLoadModule('/src/lib/topologyEditing.ts')
    const catalog = JSON.parse(fs.readFileSync(path.resolve('../backend/app/assets/topology/catalog.json'), 'utf8'))
    const categories = JSON.parse(fs.readFileSync(path.resolve('../backend/app/assets/topology/categories.json'), 'utf8'))
    const requests = []
    api.entities = async (scene) => {
      requests.push(scene)
      return { items: catalog.scenes[scene].entities.map((e) => ({ ...e, category_name: categories[scene][e.category_id], display_type: 'server' })) }
    }
    let dragged, ended = false, chosen
    await act(async () => { view = create(React.createElement(NodePalette, { scenario: empty(), onDragItem: (i) => { dragged = i }, onDragEnd: () => { ended = true }, onAdd: (i) => { chosen = i } })) })
    assert.deepEqual(requests, ['communication_network_and_services'])
    assert.equal(view.root.findAllByProps({ draggable: true }).length, 70)
    const first = view.root.findAllByProps({ draggable: true })[0]
    const data = new Map()
    const transfer = { setData: (key, value) => data.set(key, value), getData: (key) => data.get(key) || '' }
    first.props.onDragStart({ dataTransfer: transfer })
    assert.equal(transfer.effectAllowed, 'copy')
    assert.equal(transfer.getData(NODE_DRAG_MIME), dragged.entity_type_id)
    first.props.onDoubleClick()
    assert.equal(chosen.entity_type_id, dragged.entity_type_id)
    chosen = null
    first.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    assert.equal(chosen.entity_type_id, dragged.entity_type_id)
    first.props.onDragEnd()
    assert.equal(ended, true)

    const source = { ...empty(), zones: [{ id: 'existing-zone', name: '原区域', cidr: '', color: '#0072CE' }],
      nodes: [{ id: 'original', name: '原节点', type: 'server', zone: 'existing-zone', quantity: 6, evidence: '原文证据', attributes: { mode: 'original' }, x: 1, y: 1 }],
      links: [{ id: 'relation', source: 'original', target: 'original', interface: 'N2', evidence: '保持原关系' }] }
    const snapshot = structuredClone(source)
    const flowNodes = [{ id: 'zonebox-existing-zone', type: 'zonebox', position: { x: 0, y: 0 }, style: { width: 500, height: 500 } },
      { id: 'original', type: 'net', position: { x: 30, y: 90 } }]
    let prevented = false, result
    receiveNodeDrop({ preventDefault() { prevented = true }, clientX: 900, clientY: 700, dataTransfer: transfer },
      // 画布偏移 (100, 100) 且缩放为 2 倍。
      ({ x, y }) => ({ x: (x - 100) / 2, y: (y - 100) / 2 }), flowNodes,
      (id, drop) => { assert.equal(id, dragged.id); result = insertPaletteNode(source, dragged, drop, 'manual-1') })
    assert.equal(prevented, true)
    assert.deepEqual(source, snapshot)
    const node = result.nodes.at(-1)
    assert.equal(node.x, 400)
    assert.equal(node.y, 300)
    assert.equal(node.zone, 'existing-zone')
    assert.equal(node.entity_type_id, dragged.entity_type_id)
    assert.equal(node.origin, 'manual')
    assert.equal(node.quantity, 1)
    assert.equal(node.status, 'planned')
    for (const field of ['ip', 'image', 'flavor', 'evidence']) assert.equal(node[field], '')
    assert.equal(node.confidence, undefined)
    assert.equal(node.cpu, 0)
    assert.equal(result.meta.deployment_ready, false)
    assert.equal(result.meta.host_count, 7)
    assert.equal(result.nodes[0].x, 30)
    assert.equal(result.nodes[0].evidence, '原文证据')
    assert.deepEqual(result.links, source.links)
    assert.deepEqual(result.nodes[0].attributes, source.nodes[0].attributes)
    const reopened = JSON.parse(JSON.stringify(result))
    assert.equal(reopened.nodes.at(-1).origin, 'manual')
    assert.equal(reopened.nodes.at(-1).x, 400)
    const { computeLayout } = await server.ssrLoadModule('/src/lib/layout.ts')
    // 手工指定的落点即使接近展开组也不自动跳到别处；自动布局仍可重新排布。
    const layout = computeLayout({ ...result, links: [] })
    assert.deepEqual(layout.nodes.find((n) => n.id === 'manual-1').position, { x: 400, y: 300 })
    const next = insertPaletteNode(result, dragged, { position: { x: -200, y: -300 }, positions: {} }, 'manual-2')
    assert.notEqual(next.nodes.at(-1).name, node.name)
    assert.equal(next.nodes.at(-1).x, -200)
    assert.equal(next.nodes.at(-1).quantity, 1)
    const fresh = insertPaletteNode(empty(), dragged, { position: { x: 1, y: 2 }, positions: {} }, 'manual-3')
    assert.equal(fresh.nodes[0].zone, fresh.zones[0].id)

    let added = false
    receiveNodeDrop({ preventDefault() {}, clientX: 1, clientY: 2, dataTransfer: { getData: () => '' } }, (p) => p, [], () => { added = true })
    assert.equal(added, false)
    receiveNodeDrop({ preventDefault() {}, clientX: 1, clientY: 2, dataTransfer: transfer }, () => ({ x: NaN, y: 2 }), [], () => { added = true })
    assert.equal(added, false)
    receiveNodeDrop({ preventDefault() { throw new Error('只读画布不得接收拖拽') }, clientX: 1, clientY: 2, dataTransfer: transfer }, (p) => p, [])

    await act(async () => { view.root.findByType('input').props.onChange({ target: { value: 'amf' } }) })
    assert.ok(view.root.findAllByProps({ draggable: true }).some((b) => textOf(b).includes('AMF')))
    assert.ok(view.root.findAllByProps({ draggable: true }).length < 70)
    await act(async () => { view.root.findByType('input').props.onChange({ target: { value: '' } }); view.root.findByType('select').props.onChange({ target: { value: 'five_g_core' } }) })
    assert.equal(view.root.findAllByProps({ draggable: true }).length, catalog.scenes.communication_network_and_services.entities.filter((e) => e.category_id === 'five_g_core').length)
    await unmount()

    api.entities = async () => { throw new Error('catalog unavailable') }
    await act(async () => { view = create(React.createElement(NodePalette, { scenario: empty(), onDragItem() {}, onDragEnd() {}, onAdd() {} })) })
    assert.match(textOf(view.root), /实体目录加载失败/)
    assert.equal(view.root.findAllByProps({ draggable: true }).length, 0)
    await unmount()
    const physical = { ...empty(), kind: undefined }
    await act(async () => { view = create(React.createElement(NodePalette, { scenario: physical, onDragItem() {}, onDragEnd() {}, onAdd() {} })) })
    assert.equal(view.root.findAllByProps({ draggable: true }).length, 10)
    console.log('Node palette checks passed: catalog sidebar, drag payload, search/category, keyboard fallback, canvas offset/zoom, zone hit, manual provenance, no invented facts/links, viewport position snapshot, repeated inserts, read-only and malformed drops, catalog failure, generic templates.')
  } finally { await unmount(); await server.close() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
