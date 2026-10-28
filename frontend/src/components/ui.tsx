import { Check, ChevronDown, Info, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ button */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
}

export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonProps) {
  const variants = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 border border-brand-500 shadow-sm',
    secondary: 'bg-white text-ink-700 border border-line hover:border-brand-300 hover:text-brand-600',
    outline: 'bg-transparent text-brand-600 border border-brand-300 hover:bg-brand-50',
    ghost: 'bg-transparent text-ink-500 border border-transparent hover:bg-slate-100 hover:text-ink-900',
    danger: 'bg-danger text-white border border-danger hover:bg-danger/90',
  }
  const sizes = {
    sm: 'h-8 px-3 text-[12.5px] gap-1.5 rounded-lg',
    md: 'h-9 px-4 text-[13px] gap-2 rounded-lg',
    lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
  }
  return (
    <button
      className={cn(
        'inline-flex cursor-pointer items-center justify-center font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------- badge */
export function Badge({
  children,
  className,
  dot,
}: {
  children: React.ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] font-medium leading-4',
        className ?? 'border-slate-200 bg-slate-50 text-ink-500',
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------- card */
export function Card({
  children,
  className,
  hover,
}: {
  children: React.ReactNode
  className?: string
  hover?: boolean
}) {
  return <div className={cn('card', hover && 'card-hover', className)}>{children}</div>
}

export function CardHeader({
  title,
  desc,
  right,
  icon,
  className,
}: {
  title: React.ReactNode
  desc?: React.ReactNode
  right?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line px-5 py-4', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-brand-500">{icon}</span>}
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-ink-900">{title}</div>
          {desc && <div className="mt-0.5 text-[12px] leading-5 text-ink-500">{desc}</div>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ inputs */
export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-center gap-1 text-[12px] font-medium text-ink-700">
        {label}
        {required && <span className="text-danger">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-ink-400">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border border-line bg-white px-3 text-[13px] text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, 'h-9', props.className)} />
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, 'py-2.5 leading-6', props.className)} />
}

export function Select({
  options,
  value,
  onChange,
  className,
  placeholder,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputCls, 'h-9 cursor-pointer appearance-none pr-8')}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
    </div>
  )
}

/* -------------------------------------------------------------------- tabs */
export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: { value: string; label: string; count?: number }[]
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/70 p-1', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            'cursor-pointer rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-200',
            value === it.value
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-ink-500 hover:text-ink-900',
          )}
        >
          {it.label}
          {it.count != null && <span className="ml-1 text-[11px] opacity-70">{it.count}</span>}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------- modal */
export function Modal({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  width = 'max-w-2xl',
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  desc?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-ink-900/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('relative z-10 w-full animate-fade-up rounded-2xl bg-white shadow-pop', width)}>
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <div className="text-[15px] font-semibold text-ink-900">{title}</div>
            {desc && <div className="mt-1 text-[12px] text-ink-500">{desc}</div>}
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-ink-400 transition-colors hover:bg-slate-100 hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- stat card */
export function StatCard({
  label,
  value,
  suffix,
  icon,
  tone = 'brand',
  hint,
}: {
  label: string
  value: React.ReactNode
  suffix?: string
  icon?: React.ReactNode
  tone?: 'brand' | 'ok' | 'warn' | 'danger' | 'muted'
  hint?: string
}) {
  const tones = {
    brand: 'text-brand-500 bg-brand-50 border-brand-100',
    ok: 'text-ok bg-ok/10 border-ok/20',
    warn: 'text-warn bg-warn/10 border-warn/20',
    danger: 'text-danger bg-danger/10 border-danger/20',
    muted: 'text-ink-500 bg-slate-100 border-slate-200',
  }
  return (
    <div className="card flex items-center gap-3 px-4 py-3.5">
      {icon && <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', tones[tone])}>{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] text-ink-500">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="mono-num text-[19px] font-semibold leading-6 text-ink-900">{value}</span>
          {suffix && <span className="text-[11.5px] text-ink-400">{suffix}</span>}
        </div>
      </div>
      {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
    </div>
  )
}

/* ----------------------------------------------------------------- progress */
export function Progress({
  value,
  tone = 'brand',
  height = 'h-1.5',
}: {
  value: number
  tone?: 'brand' | 'ok' | 'warn' | 'danger' | 'muted'
  height?: string
}) {
  const colors = { brand: 'bg-brand-500', ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger', muted: 'bg-slate-300' }
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-slate-100', height)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------- misc */
export function SectionTitle({
  title,
  desc,
  right,
}: {
  title: React.ReactNode
  desc?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight text-ink-900">{title}</h2>
        {desc && <p className="mt-1 text-[12.5px] text-ink-500">{desc}</p>}
      </div>
      {right}
    </div>
  )
}

export function Empty({ text = '暂无数据', icon }: { text?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-ink-400">
      {icon}
      <span className="text-[12.5px]">{text}</span>
    </div>
  )
}

export function KeyValue({ items }: { items: { k: string; v: React.ReactNode }[] }) {
  return (
    <div className="divide-y divide-line">
      {items.map((it) => (
        <div key={it.k} className="flex items-start justify-between gap-4 py-2.5">
          <span className="shrink-0 text-[12px] text-ink-500">{it.k}</span>
          <span className="text-right text-[12.5px] font-medium text-ink-900">{it.v}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------- toast */
type ToastMsg = { id: number; text: string; tone: 'ok' | 'info' | 'error' }
const listeners = new Set<(m: ToastMsg) => void>()

export function toast(text: string, tone: 'ok' | 'info' | 'error' = 'ok') {
  const msg = { id: Date.now() + Math.random(), text, tone }
  listeners.forEach((l) => l(msg))
}

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([])
  useEffect(() => {
    const fn = (m: ToastMsg) => {
      setItems((prev) => [...prev, m])
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== m.id)), 2600)
    }
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((m) => (
        <div
          key={m.id}
          className="animate-fade-up flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] text-ink-900 shadow-pop"
        >
          <span
            className={cn(
              'flex h-4 w-4 items-center justify-center rounded-full text-white',
              m.tone === 'ok' ? 'bg-ok' : m.tone === 'error' ? 'bg-danger' : 'bg-brand-500',
            )}
          >
            {m.tone === 'ok' ? <Check className="h-3 w-3" /> : <Info className="h-3 w-3" />}
          </span>
          {m.text}
        </div>
      ))}
    </div>
  )
}
