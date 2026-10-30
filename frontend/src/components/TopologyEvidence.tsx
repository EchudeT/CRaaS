import type { Scenario } from '@/lib/types'
import { Card } from './ui'
import { DataBadge } from './SceneContext'

export function TopologyEvidence({ scenario }: { scenario: Scenario }) {
  const names = Object.fromEntries(scenario.nodes.map((n) => [n.id, n.name]))
  return <Card className="space-y-4 p-4">
    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">设备与关系依据 <DataBadge demo={scenario.meta.is_demo} /></div>
    {scenario.meta.is_demo && <p className="text-xs text-ink-500">{scenario.meta.data_source} · {scenario.meta.sample_id}。用于展示抽取结构，未部署到真实平台。连线表示实体组之间的逻辑关系。</p>}
    <details open className="rounded-lg border border-line p-3">
      <summary className="cursor-pointer text-xs font-medium">完整需求原文</summary>
      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-ink-600">{scenario.description}</p>
    </details>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-xs">
        <thead className="bg-slate-50 text-ink-500"><tr>{['设备 / 实体类型', '数量', '接口与属性', '原文依据'].map((t) => <th key={t} className="p-2">{t}</th>)}</tr></thead>
        <tbody>{scenario.nodes.map((n) => <tr key={n.id} className="border-b border-line align-top">
          <td className="p-2"><div className="font-medium">{n.name}</div><div className="mt-1 text-[10px] text-ink-400">{n.entity_type_id}</div>{n.origin === 'manual' && <span className="text-[10px] text-amber-700">手工添加</span>}</td>
          <td className="p-2">{n.quantity ?? 1} {String(n.attributes?.unit ?? '')}</td>
          <td className="max-w-md break-words p-2"><dl>{Object.entries(n.attributes ?? {}).map(([k, v]) => <div key={k} className="mb-1"><dt className="inline text-ink-400">{k}: </dt><dd className="inline">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></div>)}</dl>{n.interfaces?.length ? <div>接口：{JSON.stringify(n.interfaces)}</div> : null}</td>
          <td className="max-w-md whitespace-pre-wrap break-words p-2 leading-5 text-ink-600">{n.evidence || '未提供'}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-xs">
        <thead className="bg-slate-50 text-ink-500"><tr>{['起点 → 终点', '关系类型', '接口 / 协议 / 速率', '原文依据'].map((t) => <th key={t} className="p-2">{t}</th>)}</tr></thead>
        <tbody>{scenario.links.map((l) => <tr key={l.id} className="border-b border-line align-top">
          <td className="p-2">{names[l.source]} → {names[l.target]}</td><td className="p-2">{l.relation_type}</td>
          <td className="p-2">{[l.interface, l.protocol, l.bandwidth].filter(Boolean).join(' · ') || '原文未指定'}</td>
          <td className="max-w-md whitespace-pre-wrap break-words p-2 leading-5 text-ink-600">{l.evidence || '未提供'}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </Card>
}
