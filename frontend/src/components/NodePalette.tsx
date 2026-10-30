import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Scenario } from '@/lib/types'
import { NODE_DRAG_MIME, type PaletteItem } from '@/lib/topologyEditing'
import { Card, Input, Select } from './ui'
import { nodeMeta } from './nodeMeta'

export function NodePalette({ scenario, onDragItem, onDragEnd, onAdd }: {
  scenario: Scenario
  onDragItem: (item: PaletteItem) => void
  onDragEnd: () => void
  onAdd: (item: PaletteItem) => void
}) {
  const [items, setItems] = useState<PaletteItem[]>([])
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [revision, setRevision] = useState(0)
  const logical = scenario.kind === 'logical'
  const sceneKey = [scenario.meta.scene, ...(scenario.meta.secondary_scenes || [])].filter(Boolean).join('|')

  useEffect(() => {
    let active = true
    setCategory('')
    setItems([])
    setError('')
    if (!logical) {
      setItems(Object.entries(nodeMeta).map(([type, m]) => ({ id: type, name: m.label, type: type as PaletteItem['type'] })))
      setLoading(false)
      return
    }
    const scenes = [...new Set(sceneKey.split('|').filter(Boolean))]
    if (!scenes.length) { setError('当前逻辑模板未指定场景，请先在代码中设置 meta.scene。'); return }
    setLoading(true)
    Promise.all(scenes.map((scene) => api.entities(scene))).then((responses) => {
      const seen = new Set<string>()
      const entries = responses.flatMap((r) => r.items).filter((e) => {
        if (seen.has(e.entity_type_id)) return false
        seen.add(e.entity_type_id)
        return true
      })
      if (active) setItems(entries.map((e) => ({ id: e.entity_type_id, name: e.canonical_name, type: e.display_type || 'server',
        entity_type_id: e.entity_type_id, category: e.category_id, category_name: e.category_name, aliases: e.aliases })))
    }).catch(() => { if (active) setError('实体目录加载失败，请重试。') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [logical, sceneKey, revision])

  const entries = items
  const categories = [...new Map(entries.filter((i) => i.category).map((i) => [i.category!, i.category_name || i.category!])).entries()]
  const filtered = entries.filter((i) => (!category || i.category === category)
    && [i.name, i.id, ...(i.aliases || [])].join(' ').toLowerCase().includes(q.trim().toLowerCase()))

  return <Card className="flex min-h-0 flex-col overflow-hidden xl:h-[650px]">
    <div className="space-y-2 border-b border-line p-3">
      <h3 className="text-xs font-semibold">节点组件</h3>
      <p className="text-[10.5px] leading-5 text-ink-500">拖动图标到画布添加；双击或按回车也可添加。</p>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索设备 / 别名" aria-label="搜索节点组件" />
      {logical && <Select value={category} onChange={setCategory} options={[{ value: '', label: '全部分类' }, ...categories.map(([value, label]) => ({ value, label }))]} />}
    </div>
    <div className="grid max-h-[260px] grid-cols-2 content-start gap-2 overflow-y-auto p-2 xl:max-h-none xl:flex-1 xl:grid-cols-1">
      {filtered.map((item) => {
        const meta = nodeMeta[item.type] || nodeMeta.server
        const Icon = meta.icon
        return <button key={item.id} type="button" draggable aria-label={`添加${item.name}`} title={`${item.name}${item.entity_type_id ? ` · ${item.entity_type_id}` : ''}：拖入画布，或双击添加`}
          className="flex cursor-grab items-center gap-2 rounded-lg border border-line bg-white p-2 text-left hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-brand-500 active:cursor-grabbing"
          onDragStart={(event) => { event.dataTransfer.setData(NODE_DRAG_MIME, item.id); event.dataTransfer.effectAllowed = 'copy'; onDragItem(item) }}
          onDragEnd={onDragEnd} onDoubleClick={() => onAdd(item)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(item) } }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ color: meta.color, background: `${meta.color}12` }}><Icon className="h-5 w-5" /></span>
          <span className="min-w-0 break-words text-[11px] leading-4">{item.name}</span>
        </button>
      })}
      {loading && <p className="col-span-full p-2 text-xs text-ink-400">正在加载实体目录…</p>}
      {error && <div className="col-span-full space-y-2 p-2 text-xs text-danger"><p>{error}</p><button type="button" onClick={() => setRevision((r) => r + 1)} className="text-brand-600">重新加载</button></div>}
      {!loading && !error && !filtered.length && <p className="col-span-full p-2 text-xs text-ink-400">没有匹配的组件</p>}
    </div>
    <p className="border-t border-line p-3 text-[10px] leading-5 text-ink-500">手工添加会明确标记来源；连接、镜像、规格及原文依据由你补充。</p>
  </Card>
}
