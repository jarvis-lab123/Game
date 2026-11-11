import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { forwardRef } from 'react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110 active:brightness-95 shadow-sm',
  secondary: 'bg-surface text-fg ring-1 ring-inset ring-line hover:bg-surface-2',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-surface text-bad ring-1 ring-inset ring-line hover:bg-bad-soft',
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg' | 'sm'; kbd?: string }>(
  function Button({ variant = 'secondary', size = 'md', kbd, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cx(
          'inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition-[background,filter,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
          size === 'lg' ? 'min-h-14 px-6 text-[17px]' : size === 'sm' ? 'min-h-11 px-3 text-sm desk:min-h-9' : 'min-h-11 px-4 text-[15px]',
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
    <kbd className={cx('inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-current/25 px-1 font-sans text-[11px] font-medium opacity-70', className)}>
      {children}
    </kbd>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl bg-surface p-5 ring-1 ring-line', className)}>{children}</section>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, action, back }: { title: string; subtitle?: ReactNode; action?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="truncate text-[28px] font-semibold tracking-tight">{title}</h1>
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

const fieldCls = 'w-full rounded-xl bg-surface px-3.5 py-2.5 text-[15px] text-fg ring-1 ring-inset ring-line placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent'

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
        <span className="h-7 w-12 rounded-full bg-surface-2 ring-1 ring-inset ring-line transition-colors duration-150 peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
        <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('min-h-11 rounded-lg px-3 text-sm font-medium transition-colors duration-150 desk:min-h-9', value === o.value ? 'bg-surface text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <p className="text-[17px] font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-sm text-[15px] text-muted">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function pct(v: number | null | undefined) {
  return v == null ? '–' : `${Math.round(v * 100)} %`
}
