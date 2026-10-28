import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function pct(v: number) {
  return `${Math.round(v)}%`
}

export function gb(mb: number) {
  if (!mb) return '—'
  return mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${mb} MB`
}

export function money(v: number) {
  return `¥${v.toFixed(2)}`
}

export function shortTime(iso: string) {
  if (!iso) return '—'
  return iso.replace('T', ' ').slice(0, 16)
}

export function statusTone(status: string) {
  switch (status) {
    case 'running':
    case '在线':
    case '可用':
    case '就绪':
      return 'text-ok bg-ok/10 border-ok/20'
    case 'provisioning':
      return 'text-brand-600 bg-brand-50 border-brand-200'
    case 'failed':
    case '异常':
      return 'text-danger bg-danger/10 border-danger/20'
    case 'destroyed':
    case 'stopped':
      return 'text-ink-400 bg-slate-100 border-slate-200'
    default:
      return 'text-ink-500 bg-slate-100 border-slate-200'
  }
}

export const statusLabel: Record<string, string> = {
  running: '运行中',
  provisioning: '部署中',
  failed: '失败',
  destroyed: '已销毁',
  stopped: '已停止',
}

export function levelTone(level: string) {
  switch (level) {
    case 'critical':
      return 'text-danger border-danger/25 bg-danger/5'
    case 'warning':
      return 'text-warn border-warn/25 bg-warn/5'
    default:
      return 'text-brand-600 border-brand-200 bg-brand-50'
  }
}

export function download(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function copy(text: string) {
  navigator.clipboard?.writeText(text)
}
