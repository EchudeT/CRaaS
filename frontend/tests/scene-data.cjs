// Component interaction checks without a browser or paid model calls.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const React = require('react')
const { create, act } = require('react-test-renderer')
const { MemoryRouter } = require('react-router-dom')

global.window = { addEventListener() {}, removeEventListener() {} }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const textOf = (node) => typeof node === 'string' || typeof node === 'number' ? String(node) : (node?.children || []).map(textOf).join(' ')

async function main() {
  const { createServer } = await import('vite')
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  let view
  const mount = async (Component, props = {}, route = '/') => {
    await act(async () => { view = create(React.createElement(MemoryRouter, { initialEntries: [route], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, React.createElement(Component, props))) })
  }
  const unmount = async () => { if (view) await act(async () => { view.unmount(); view = null }) }
  try {
    const { api } = await server.ssrLoadModule('/src/lib/api.ts')
    const catalog = JSON.parse(fs.readFileSync(path.resolve('../backend/app/assets/topology/catalog.json'), 'utf8'))
    const categories = JSON.parse(fs.readFileSync(path.resolve('../backend/app/assets/topology/categories.json'), 'utf8'))
    const examples = JSON.parse(fs.readFileSync(path.resolve('../backend/app/assets/topology/examples.json'), 'utf8')).examples
    const scenes = Object.entries(catalog.scenes).map(([id, s]) => ({ id, name: s.scene_name, entity_count: s.entities.length, categories: Object.entries(categories[id]).map(([id, name]) => ({ id, name })) }))
    api.scenes = async () => ({ items: scenes })
    api.meta = async () => ({ business: [] })
    let entityCalls = []
    api.entities = async (scene, q = '', category = '') => {
      entityCalls.push({ scene, q, category })
      const items = catalog.scenes[scene].entities.filter((e) => (!category || e.category_id === category) && JSON.stringify(e).toLowerCase().includes(q.toLowerCase())).map((e) => ({ ...e, category_name: categories[scene][e.category_id] }))
      return { items, total: items.length }
    }
    const { default: EntityCatalog } = await server.ssrLoadModule('/src/pages/EntityCatalog.tsx')
    await mount(EntityCatalog)
    await act(async () => { await sleep(300) })
    assert.equal(view.root.findAllByType('h3').length, 156)
    await act(async () => { view.root.findAllByType('select')[0].props.onChange({ target: { value: scenes[1].id } }) })
    await act(async () => { await sleep(300) })
    assert.equal(view.root.findAllByType('h3').length, scenes[1].entity_count)
    await act(async () => { view.root.findAllByType('select')[1].props.onChange({ target: { value: scenes[1].categories[0].id } }) })
    await act(async () => { await sleep(300) })
    assert.equal(entityCalls.at(-1).category, scenes[1].categories[0].id)
    await act(async () => { view.root.findByType('input').props.onChange({ target: { value: 'no-such-entity' } }) })
    await act(async () => { await sleep(300) })
    assert.equal(view.root.findAllByType('h3').length, 0)
    assert.match(textOf(view.root), /没有匹配的实体类型/)
    await unmount()

    const { TopologyEvidence } = await server.ssrLoadModule('/src/components/TopologyEvidence.tsx')
    for (const example of examples) {
      const scenario = {
        description: example.input,
        meta: { is_demo: true, sample_id: example.sample_id },
        nodes: example.output.entities.map((e) => ({ ...e, id: e.instance_id, name: e.canonical_name })),
        links: example.output.relations.map((r, i) => ({ ...r, id: `r${i}`, source: r.source, target: r.target })),
      }
      await act(async () => { view = create(React.createElement(TopologyEvidence, { scenario })) })
      const text = textOf(view.root)
      assert.ok(text.includes(example.input))
      for (const entity of example.output.entities) {
        assert.ok(text.includes(entity.evidence))
        assert.ok(text.includes(entity.entity_type_id))
      }
      for (const relation of example.output.relations) {
        assert.ok(text.includes(relation.interface))
        assert.ok(text.includes(relation.evidence))
      }
      assert.match(text, /演示数据/)
      await unmount()
    }

    let assignments = []
    api.assignResourceScenes = async (...args) => { assignments.push(args) }
    const { ResourceAssociation } = await server.ssrLoadModule('/src/components/SceneContext.tsx')
    let saved = 0
    await mount(ResourceAssociation, { item: { id: 'resource-1', scene_ids: [scenes[0].id], scene_names: [scenes[0].name], is_demo: true }, kind: 'compute', onSaved: () => saved++ })
    await act(async () => { await view.root.findAllByType('button').find((b) => textOf(b) === '关联场景').props.onClick() })
    assert.equal(view.root.findAllByType('input').length, 3)
    await act(async () => { view.root.findAllByType('input')[0].props.onChange({ target: { checked: false } }) })
    await act(async () => { view.root.findAllByType('input')[2].props.onChange({ target: { checked: true } }) })
    await act(async () => { await view.root.findAllByType('button').find((b) => textOf(b) === '保存关联').props.onClick() })
    assert.deepEqual(assignments, [['compute', 'resource-1', [scenes[2].id]]])
    assert.equal(saved, 1)
    await unmount()

    const sample = examples[0]
    const template = { id: 'example', name: '示例模板', description: sample.input, node_count: 6, zone_count: 1, business_name: '演练', source: 'example', is_demo: true, scene_name: scenes[0].name, sample_id: sample.sample_id, updated_at: '2026-10-30T12:00:00', topology: { kind: 'logical', meta: { host_count: 19 }, links: sample.output.relations } }
    const queries = []
    let oldResolve
    api.templates = async (params) => { queries.push(params); return params.scene === scenes[0].id ? { items: [template] } : { items: [] } }
    const { default: Templates } = await server.ssrLoadModule('/src/pages/Templates.tsx')
    await mount(Templates, {}, `/templates?scene=${scenes[0].id}`)
    await act(async () => { await sleep(300) })
    assert.equal(queries.at(-1).scene, scenes[0].id)
    assert.match(textOf(view.root), /直接打开示例，无需调用模型/)
    assert.equal(view.root.findAllByType('button').find((b) => textOf(b).includes('部署')).props.disabled, true)
    api.templates = (params) => params.scene === scenes[0].id ? new Promise((resolve) => { oldResolve = resolve }) : Promise.resolve({ items: [] })
    await act(async () => { view.root.findByType('input').props.onChange({ target: { value: 'slow' } }) })
    await act(async () => { await sleep(300) })
    await act(async () => { view.root.findAllByType('select')[0].props.onChange({ target: { value: scenes[1].id } }) })
    await act(async () => { await sleep(300) })
    await act(async () => { oldResolve({ items: [template] }) })
    assert.doesNotMatch(textOf(view.root), /直接打开示例，无需调用模型/)
    await unmount()
    console.log('Scene UI checks passed: 156 catalog types, scene/category/search filters, six evidence views, resource reassignment, direct template entry, disabled logical deployment, stale response ignored.')
  } finally {
    await unmount()
    await server.close()
    delete global.window
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
