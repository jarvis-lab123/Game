import { useEffect, useState } from 'react'
import { fullscreenSupported, isFullscreen, toggleFullscreen } from '../platform'
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
