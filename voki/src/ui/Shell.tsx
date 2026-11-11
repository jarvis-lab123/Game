import type { ReactNode } from 'react'
import { IconDecks, IconImport, IconSettings, IconToday } from './icons'
import { cx } from './components'

const NAV = [
  { to: '/', label: 'Heute', icon: IconToday, match: (p: string) => p === '/' },
  { to: '/decks', label: 'Decks', icon: IconDecks, match: (p: string) => p.startsWith('/deck') },
  { to: '/import', label: 'Import', icon: IconImport, match: (p: string) => p.startsWith('/import') },
  { to: '/einstellungen', label: 'Einstellungen', icon: IconSettings, match: (p: string) => p.startsWith('/einstellungen') },
]

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-on-accent" aria-hidden><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7l6 11 6-11" /></svg></span>
      <span className="text-[17px] font-semibold tracking-tight">Voki</span>
    </span>
  )
}

export function Shell({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="min-h-full desk:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Zum Inhalt
      </a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 desk:flex">
        <div className="px-3 pb-6"><Logo /></div>
        <nav aria-label="Hauptnavigation" className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active = n.match(path)
            return (
              <a
                key={n.to}
                href={`#${n.to}`}
                aria-current={active ? 'page' : undefined}
                className={cx('flex min-h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors duration-150', active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg')}
              >
                <n.icon />
                {n.label}
              </a>
            )
          })}
        </nav>
        <p className="mt-auto px-3 text-xs text-muted">Tipp: <kbd className="font-sans">Enter</kbd> startet die Session auf „Heute“.</p>
      </aside>

      <main id="main" className="safe-top mx-auto w-full max-w-3xl px-4 pb-28 pt-6 desk:max-w-4xl desk:px-10 desk:pb-12 desk:pt-10">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <nav aria-label="Hauptnavigation" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur desk:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {NAV.map((n) => {
            const active = n.match(path)
            return (
              <a
                key={n.to}
                href={`#${n.to}`}
                aria-current={active ? 'page' : undefined}
                className={cx('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active ? 'text-accent' : 'text-muted')}
              >
                <n.icon width={22} height={22} />
                {n.label}
              </a>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
