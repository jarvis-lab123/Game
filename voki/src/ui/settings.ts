import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { DEFAULT_SETTINGS, type Settings } from '../lib/types'

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get('settings'), [])
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) }
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
  await db.settings.put({ ...cur, ...patch, id: 'settings' })
}

export function useTheme(theme: Settings['theme']) {
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}
