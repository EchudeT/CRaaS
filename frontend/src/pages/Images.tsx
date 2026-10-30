import { CheckCircle2, Disc3, HardDrive, Plus, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { ImageRes } from '@/lib/types'
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, StatCard, Tabs, toast } from '@/components/ui'
import { shortTime } from '@/lib/utils'
import { ResourceAssociation, SceneBar, useScene, useRequestGuard } from '@/components/SceneContext'

export default function Images() {
  const [scene, setScene] = useScene()
  const [items, setItems] = useState<ImageRes[]>([])
  const [categories, setCategories] = useState<string[]>(['全部'])
  const [cat, setCat] = useState('全部')
  const [q, setQ] = useState('')
  const beginRequest = useRequestGuard(`${scene}/${cat}/${q}`)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    category: '应用镜像',
    sub_category: '通用镜像',
    os_type: 'Linux',
    size_gb: 20,
    version: 'v1.0',
    source: '通用镜像',
  })

  function load() {
    const current = beginRequest()
    api
      .images({ category: cat, q, scene })
      .then((r) => {
        if (!current()) return
        setItems(r.items)
        setCategories(r.categories)
      })
      .catch(() => { if (current()) { setItems([]); toast('加载镜像失败', 'error') } })
  }

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, q, scene])

  async function submit() {
    if (!form.name.trim()) {
      toast('请填写镜像名称', 'error')
      return
    }
    try {
      await api.addImage({ ...form, scene_ids: scene ? [scene] : [] })
      toast('镜像已录入')
      setOpen(false)
      setForm({ ...form, name: '' })
      load()
    } catch {
      toast('录入失败', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <SceneBar scene={scene} onChange={setScene} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="当前筛选镜像" value={items.length} suffix="个" icon={<Disc3 className="h-4 w-4" />} />
        <StatCard label="标记可用" value={items.filter((i) => i.status === '可用').length} suffix="个" tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="演示记录" value={items.filter((i) => i.is_demo).length} suffix="个" tone="muted" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="录入容量" value={items.reduce((s, i) => s + i.size_gb, 0)} suffix="GB" tone="muted" icon={<HardDrive className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs items={categories.map((c) => ({ value: c, label: c }))} value={cat} onChange={setCat} />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索镜像名称" className="w-52 pl-8" />
          </div>
          <Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
            录入镜像
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-slate-50/70 text-left text-[11.5px] text-ink-500">
                <th className="px-4 py-2.5 font-medium">镜像名称</th>
                <th className="px-4 py-2.5 font-medium">分类</th>
                <th className="px-4 py-2.5 font-medium">子类</th>
                <th className="px-4 py-2.5 font-medium">系统</th>
                <th className="px-4 py-2.5 font-medium">大小</th>
                <th className="px-4 py-2.5 font-medium">版本</th>
                <th className="px-4 py-2.5 font-medium">来源</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 font-medium">录入时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-line/70 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-brand-50 text-brand-600">
                        <Disc3 className="h-3 w-3" />
                      </div>
                      <span className="font-medium text-ink-900">{i.name}</span>
                    </div>
                    <ResourceAssociation item={i} kind="image" onSaved={load} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">{i.category}</td>
                  <td className="px-4 py-2.5 text-ink-500">{i.sub_category}</td>
                  <td className="px-4 py-2.5 text-ink-600">{i.os_type}</td>
                  <td className="mono-num px-4 py-2.5 text-ink-600">{i.size_gb} GB</td>
                  <td className="mono-num px-4 py-2.5 text-ink-600">{i.version}</td>
                  <td className="px-4 py-2.5">
                    <Badge className="border-slate-200 bg-slate-50 text-ink-500">{i.source}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className="border-ok/25 bg-ok/10 text-ok" dot>
                      {i.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-500">{shortTime(i.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && <Empty text="没有匹配的镜像" icon={<Disc3 className="h-6 w-6" />} />}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="录入镜像资源"
        desc="按统一字段规范封装，录入后可用于任意场景模板"
        width="max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={submit}>
              确认录入
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="镜像名称" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：Nginx 应用镜像" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="分类">
              <Select
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                options={['操作系统', '应用镜像', '安全工具', '网络设备', '环境镜像', '容器镜像'].map((c) => ({ value: c, label: c }))}
              />
            </Field>
            <Field label="子类">
              <Input value={form.sub_category} onChange={(e) => setForm({ ...form, sub_category: e.target.value })} />
            </Field>
            <Field label="操作系统">
              <Input value={form.os_type} onChange={(e) => setForm({ ...form, os_type: e.target.value })} />
            </Field>
            <Field label="大小 (GB)">
              <Input
                type="number"
                value={form.size_gb}
                onChange={(e) => setForm({ ...form, size_gb: Number(e.target.value) })}
                className="mono-num"
              />
            </Field>
            <Field label="版本">
              <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </Field>
            <Field label="来源">
              <Select
                value={form.source}
                onChange={(v) => setForm({ ...form, source: v })}
                options={['通用镜像', '行业镜像', '私有镜像'].map((c) => ({ value: c, label: c }))}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
