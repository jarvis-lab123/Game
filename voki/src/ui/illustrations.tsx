/** Minimal line illustrations in the app's own tokens (no stock art). */
type Kind = 'cards' | 'done' | 'test' | 'notebook' | 'sync' | 'group'

export function Illustration({ kind, size = 120 }: { kind: Kind; size?: number }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden className="text-accent">
      <circle cx="60" cy="60" r="56" fill="var(--accent-soft)" />
      {kind === 'cards' && (
        <g {...s}>
          <rect x="30" y="38" width="44" height="54" rx="7" transform="rotate(-10 52 65)" className="text-muted" stroke="currentColor" fill="var(--surface)" />
          <rect x="44" y="30" width="44" height="54" rx="7" fill="var(--surface)" />
          <path d="M54 50h24M54 60h16M54 70h20" />
        </g>
      )}
      {kind === 'done' && (
        <g {...s}>
          <circle cx="60" cy="60" r="26" fill="var(--surface)" />
          <path d="M48 61l8 8 16-17" strokeWidth="3" className="text-good" stroke="currentColor" />
          <path d="M92 32l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM26 78l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="currentColor" stroke="none" />
        </g>
      )}
      {kind === 'test' && (
        <g {...s}>
          <rect x="36" y="26" width="48" height="66" rx="6" fill="var(--surface)" />
          <path d="M46 42h28M46 52h22M46 62h26" className="text-muted" stroke="currentColor" />
          <circle cx="78" cy="80" r="14" fill="var(--accent)" stroke="none" />
          <text x="78" y="85" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--on-accent)" stroke="none">6</text>
        </g>
      )}
      {kind === 'notebook' && (
        <g {...s}>
          <rect x="34" y="28" width="50" height="64" rx="6" fill="var(--surface)" />
          <path d="M44 28v64" />
          <path d="M54 46h20M54 56h14" className="text-muted" stroke="currentColor" />
          <path d="M66 70l4 4 9-10" className="text-good" stroke="currentColor" strokeWidth="2.5" />
        </g>
      )}
      {kind === 'sync' && (
        <g {...s}>
          <rect x="24" y="40" width="34" height="26" rx="4" fill="var(--surface)" />
          <path d="M20 72h42" />
          <rect x="70" y="36" width="22" height="40" rx="5" fill="var(--surface)" />
          <path d="M50 86c8 6 22 6 30-2M78 84l2 0 0-4M70 30c-8-6-22-6-30 2M42 32l-2 0 0 4" />
        </g>
      )}
      {kind === 'group' && (
        <g {...s}>
          <rect x="26" y="46" width="22" height="30" rx="4" fill="var(--surface)" />
          <rect x="50" y="40" width="22" height="30" rx="4" fill="var(--accent)" stroke="none" />
          <rect x="74" y="46" width="22" height="30" rx="4" fill="var(--surface)" />
          <path d="M55 55l4 4 8-9" stroke="var(--on-accent)" strokeWidth="2.5" />
        </g>
      )}
    </svg>
  )
}
