import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
})

export const IconToday = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3.5" y="4.5" width="17" height="16" rx="3" /><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" /></svg>
export const IconDecks = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3.5" y="7" width="13" height="13" rx="2.5" /><path d="M7.5 3.5h10a3 3 0 0 1 3 3v10" /></svg>
export const IconImport = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5" /><path d="M4 15.5v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" /></svg>
export const IconSettings = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
export const IconPlay = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" /></svg>
export const IconCheck = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
export const IconX = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
export const IconSound = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>
export const IconSearch = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
export const IconChevron = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M9.5 6l6 6-6 6" /></svg>
export const IconBack = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M14.5 6l-6 6 6 6" /></svg>
export const IconPlus = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
export const IconCopy = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="8.5" y="8.5" width="12" height="12" rx="2.5" /><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" /></svg>
export const IconFlame = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.4 3.6-8.3.3-.9 1.5-1 2-.2 1 1.6 1.4 3 1.4 4.3 1-.6 1.6-1.6 1.8-2.6.2-.8 1.2-1 1.7-.3 1.4 1.9 2.5 4 2.5 6.6 0 4-2.6 6.7-6.5 6.7z" /></svg>
export const IconBulb = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></svg>
export const IconTrash = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></svg>

export function Flag({ lang, size = 18 }: { lang: 'en' | 'fr' | 'other'; size?: number }) {
  const h = Math.round(size * 0.7)
  if (lang === 'fr')
    return (
      <svg width={size} height={h} viewBox="0 0 3 2" className="shrink-0 rounded-[3px] ring-1 ring-black/10" aria-label="Französisch" role="img">
        <rect width="1" height="2" fill="#1f4bb4" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#e1323c" />
      </svg>
    )
  if (lang === 'en')
    return (
      <svg width={size} height={h} viewBox="0 0 60 40" className="shrink-0 rounded-[3px] ring-1 ring-black/10" aria-label="Englisch" role="img">
        <rect width="60" height="40" fill="#1f3c88" />
        <path d="M0 0l60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
        <path d="M0 0l60 40M60 0L0 40" stroke="#d22f3c" strokeWidth="3" />
        <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
        <path d="M30 0v40M0 20h60" stroke="#d22f3c" strokeWidth="7" />
      </svg>
    )
  return <span className="inline-block h-3 w-4 shrink-0 rounded-[3px] bg-surface-2 ring-1 ring-line" aria-hidden />
}
