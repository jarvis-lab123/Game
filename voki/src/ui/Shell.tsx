import type { ReactNode } from 'react'
import { IconDecks, IconImport, IconPractice, IconSettings, IconStats, IconToday } from './icons'
import { cx } from './components'
import { APP_VERSION } from '../lib/version'
import { FullscreenNavItem } from './fullscreen'

const NAV = [
  { to: '/', label: 'Heute', icon: IconToday, match: (p: string) => p === '/' },
  { to: '/decks', label: 'Decks', icon: IconDecks, match: (p: string) => p.startsWith('/deck') },
  { to: '/ueben', label: 'Üben', icon: IconPractice, match: (p: string) => p.startsWith('/ueben') },
  { to: '/statistik', label: 'Statistik', icon: IconStats, match: (p: string) => p.startsWith('/statistik') },
  { to: '/einstellungen', label: 'Einstellungen', icon: IconSettings, match: (p: string) => p.startsWith('/einstellungen'), mobileLabel: 'Mehr' },
]
const DESKTOP_EXTRA = [{ to: '/import', label: 'Import', icon: IconImport, match: (p: string) => p.startsWith('/import') }]

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-b from-[#3a8dff] to-[#0062d1] text-white shadow-sm" aria-hidden><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7l6 11 6-11" /></svg></span>
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
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-glass px-3 py-5 backdrop-blur-xl desk:flex">
        <div className="px-3 pb-6"><Logo /></div>
        <nav aria-label="Hauptnavigation" className="flex flex-col gap-0.5">
          {[...NAV.slice(0, 4), ...DESKTOP_EXTRA, NAV[4]].map((n) => {
            const active = n.match(path)
            return (
              <a
                key={n.to}
                href={`#${n.to}`}
                aria-current={active ? 'page' : undefined}
                className={cx('flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium transition-colors duration-150', active ? 'bg-accent text-on-accent' : 'text-fg/80 hover:bg-surface-2 hover:text-fg')}
              >
                <n.icon />
                {n.label}
              </a>
            )
          })}
        </nav>
        <div className="mt-auto">
          <FullscreenNavItem />
        </div>
        <p className="mt-3 px-3 text-xs text-muted">Tipp: <kbd className="font-sans">Enter</kbd> startet das Lernen auf „Heute“.</p>
        <a href="#/einstellungen" className="mt-2 px-3 text-xs font-medium text-muted hover:text-fg">Voki {APP_VERSION}</a>
      </aside>

      <main id="main" className="safe-top mx-auto w-full max-w-3xl px-4 pb-28 pt-6 desk:max-w-4xl desk:px-10 desk:pb-12 desk:pt-10">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <nav aria-label="Hauptnavigation" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-glass backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 desk:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((n) => {
            const active = n.match(path)
            return (
              <a
                key={n.to}
                href={`#${n.to}`}
                aria-current={active ? 'page' : undefined}
                className={cx('flex min-h-[54px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium', active ? 'text-accent' : 'text-muted')}
              >
                <n.icon width={22} height={22} />
                {'mobileLabel' in n ? n.mobileLabel : n.label}
              </a>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
