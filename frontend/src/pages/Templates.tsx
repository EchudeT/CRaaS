import { Boxes, CheckCircle2, Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Meta } from '@/lib/api'
import type { Template } from '@/lib/types'
import { Badge, Button, Card, Empty, Input, Select, toast } from '@/components/ui'
import { shortTime } from '@/lib/utils'
import { SceneBar, DataBadge, useScene, useRequestGuard } from '@/components/SceneContext'

export default function Templates() {
  const nav = useNavigate()
  const [scene, setScene] = useScene()
  const [items, setItems] = useState<Template[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [q, setQ] = useState('')
  const [biz, setBiz] = useState('')
  const [loading, setLoading] = useState(true)
  const beginRequest = useRequestGuard(`${scene}/${q}/${biz}`)

  function load() {
    const current = beginRequest()
    setLoading(true)
    api
      .templates({ q, business: biz, scene })
      .then((r) => { if (current()) setItems(r.items) })
      .catch(() => { if (current()) { setItems([]); toast('加载模板失败', 'error') } })
      .finally(() => { if (current()) setLoading(false) })
  }

  useEffect(() => {
    api.meta().then(setMeta).catch(() => setMeta(null))
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, biz, scene])

  const bizOptions = useMemo(
    () => [{ value: '', label: '全部业务' }, ...(meta?.business ?? []).map((b) => ({ value: b.id, label: b.name }))],
    [meta],
  )

  async function remove(id: string) {
    try {
      await api.deleteTemplate(id)
      toast('模板已删除')
      load()
    } catch {
      toast('删除失败', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <SceneBar scene={scene} onChange={setScene} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.filter((t) => t.source === 'example').map((t) => <Link key={t.id} to={`/templates/${t.id}`}>
          <Card hover className="h-full space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">{t.name}<DataBadge demo={t.is_demo} /></div>
            <div className="text-xs text-brand-600">{t.scene_name}</div>
            <div className="text-xs text-ink-500">{t.node_count} 类设备 · {t.topology.meta.host_count} 台/个实体 · {t.topology.links.length} 条关系</div>
            <div className="text-xs text-ink-500">{t.sample_id} · 含数量、接口及原文依据</div>
            <div className="text-xs text-brand-600">直接打开示例，无需调用模型 →</div>
          </Card>
        </Link>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-ink-900">私有场景模板</div>
            <div className="text-[11.5px] text-ink-400">共 {items.length} 个模板；逻辑拓扑需完成资源映射后部署</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索模板名称或描述"
              className="w-56 pl-8"
            />
          </div>
          <Select options={bizOptions} value={biz} onChange={setBiz} className="w-36" />
          <Link to="/topology">
            <Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />}>
              新建模板
            </Button>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-slate-50/70 text-left text-[11.5px] text-ink-500">
                <th className="px-4 py-2.5 font-medium">模板名称</th>
                <th className="px-4 py-2.5 font-medium">业务类型</th>
                <th className="px-4 py-2.5 font-medium">区域</th>
                <th className="px-4 py-2.5 font-medium">节点数</th>
                <th className="px-4 py-2.5 font-medium">来源</th>
                <th className="px-4 py-2.5 font-medium">更新时间</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-b border-line/70 transition-colors last:border-0 hover:bg-slate-50/60">
                  <td className="max-w-[340px] px-4 py-3">
                    <Link to={`/templates/${t.id}`} className="block truncate font-medium text-ink-900 hover:text-brand-600">
                      {t.name}
                    </Link>
                    <div className="mt-0.5 truncate text-[11px] text-ink-400">{t.description}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-brand-600">{t.scene_name}<DataBadge demo={t.is_demo} /></div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="border-brand-100 bg-brand-50 text-brand-600">{t.business_name}</Badge>
                  </td>
                  <td className="mono-num px-4 py-3 text-ink-700">{t.zone_count}</td>
                  <td className="mono-num px-4 py-3 text-ink-700">{t.node_count}</td>
                  <td className="px-4 py-3">
                    <Badge className="border-slate-200 bg-slate-50 text-ink-500">
                      {t.source === 'example' ? '内置示例' : t.source === 'llm' ? 'LLM 生成' : '规则引擎'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-500">{shortTime(t.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => nav(`/templates/${t.id}`)}
                        className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600"
                      >
                        <Pencil className="h-3 w-3" /> 编辑
                      </button>
                      <button
                        onClick={() => nav(`/orchestrate/${t.id}`)}
                        disabled={t.topology.kind === 'logical'}
                        title={t.topology.kind === 'logical' ? '逻辑拓扑尚未映射实际资源' : undefined}
                        className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Boxes className="h-3 w-3" /> 部署
                      </button>
                      <button
                        onClick={() => api.validateTemplate(t.id).then((v) => toast(v.passed ? '校验通过' : `发现 ${v.error_count} 个错误`, v.passed ? 'ok' : 'error'))}
                        className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600"
                      >
                        <CheckCircle2 className="h-3 w-3" /> 校验
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-ink-400 transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && items.length === 0 && <Empty text="没有匹配的场景模板" icon={<Layers className="h-6 w-6" />} />}
      </Card>
    </div>
  )
}
