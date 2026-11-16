import { useEffect, useState } from 'react'
import { fullscreenSupported, isFullscreen, isTauri, toggleFullscreen } from '../platform'
import { IconCollapse, IconExpand } from './icons'

export function useFullscreen(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const update = () => void isFullscreen().then(setOn)
    update()
    document.addEventListener('fullscreenchange', update)
    window.addEventListener('voki-fullscreen', update)
    window.addEventListener('resize', update)
    return () => {
      document.removeEventListener('fullscreenchange', update)
      window.removeEventListener('voki-fullscreen', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return on
}

/** Round icon button for the session header. Hidden where fullscreen is impossible (iPhone Safari). */
export function FullscreenButton() {
  const on = useFullscreen()
  if (!fullscreenSupported()) return null
  return (
    <button
      type="button"
      onClick={() => void toggleFullscreen()}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
      aria-label={on ? 'Vollbild beenden (F)' : 'Vollbild (F)'}
      aria-pressed={on}
      title={on ? 'Vollbild beenden (F)' : 'Vollbild (F)'}
    >
      {on ? <IconCollapse /> : <IconExpand />}
    </button>
  )
}

/** Sidebar entry (PC): fullscreen from every screen. */
export function FullscreenNavItem() {
  const on = useFullscreen()
  if (!fullscreenSupported()) return null
  return (
    <button
      type="button"
      onClick={() => void toggleFullscreen()}
      aria-pressed={on}
      className="flex min-h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium text-fg/80 transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
    >
      {on ? <IconCollapse /> : <IconExpand />}
      <span className="flex-1 text-left">{on ? 'Vollbild beenden' : 'Vollbild'}</span>
      <span className="text-xs text-muted">{isTauri ? 'F11' : ''}</span>
    </button>
  )
}
