import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { forwardRef } from 'react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110 active:brightness-95',
  secondary: 'bg-accent-soft text-accent hover:brightness-[0.97] dark:hover:brightness-125',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-bad-soft text-bad hover:brightness-[0.97] dark:hover:brightness-125',
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg' | 'sm'; kbd?: string }>(
  function Button({ variant = 'secondary', size = 'md', kbd, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cx(
          'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-[background,filter,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
          size === 'lg' ? 'min-h-[52px] px-7 text-[17px]' : size === 'sm' ? 'min-h-11 px-4 text-sm desk:min-h-9' : 'min-h-11 px-5 text-[15px]',
          VARIANTS[variant],
          className,
        )}
        {...rest}
      >
        {children}
        {kbd && <Kbd className="ml-1 hidden desk:inline-flex">{kbd}</Kbd>}
      </button>
    )
  },
)

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cx('hidden h-5 min-w-5 items-center desk:inline-flex justify-center rounded-md border border-current/30 px-1 font-sans text-[11px] font-medium', className)}>
      {children}
    </kbd>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-[22px] bg-surface p-5 shadow-card desk:p-6', className)}>{children}</section>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, action, back }: { title: string; subtitle?: ReactNode; action?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="truncate text-[34px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function Progress({ value, tone = 'accent', label, className }: { value: number; tone?: 'accent' | 'good' | 'warn' | 'bad'; label?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const bar = { accent: 'bg-accent', good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad' }[tone]
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cx('h-full rounded-full transition-[width] duration-300', bar)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad' }) {
  const t = {
    neutral: 'bg-surface-2 text-muted',
    accent: 'bg-accent-soft text-accent',
    good: 'bg-good-soft text-good',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular', t)}>{children}</span>
}

const fieldCls = 'w-full rounded-xl bg-surface-2 px-3.5 py-2.5 text-[16px] text-fg ring-0 placeholder:text-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(fieldCls, 'min-h-11', className)} {...p} />
})
export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cx(fieldCls, className)} {...p} />
})
export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldCls, 'min-h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" }} {...p} />
}

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
      {children}
      {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-[31px] w-[51px] rounded-full bg-surface-2 transition-colors duration-150 peer-checked:bg-good peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
        <span className="pointer-events-none absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-md transition-transform duration-200 peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] bg-surface-2 p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('min-h-11 rounded-[8px] px-3.5 text-sm font-semibold transition-all duration-150 desk:min-h-9', value === o.value ? 'bg-surface text-fg shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#636366]' : 'text-muted hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[22px] bg-surface px-6 py-10 text-center shadow-card">
      <p className="text-[17px] font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-sm text-[15px] text-muted">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function pct(v: number | null | undefined) {
  return v == null ? '–' : `${Math.round(v * 100)} %`
}

/** Apple-style progress ring. value 0..1 */
export function Ring({ value, size = 64, stroke = 7, tone = 'accent', label, children }: { value: number; size?: number; stroke?: number; tone?: 'accent' | 'good' | 'warn' | 'bad'; label: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  const color = { accent: 'var(--accent)', good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)' }[tone]
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {v > 0.005 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)' }} />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function readinessTone(v: number | null | undefined): 'accent' | 'good' | 'warn' | 'bad' {
  if (v == null) return 'accent'
  return v >= 0.8 ? 'good' : v >= 0.5 ? 'warn' : 'bad'
}
