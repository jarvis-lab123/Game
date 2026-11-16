import { useEffect, useState } from 'react'
import { APP_VERSION, compareVersions, fetchLatestRelease, type VokiRelease } from '../lib/version'
import { checkWebUpdate, isTauri, openExternal } from '../platform'
import { Button } from './components'

/** PC app: newest release on GitHub if it is newer than this one. */
export function useNewerRelease(): VokiRelease | null {
  const [rel, setRel] = useState<VokiRelease | null>(null)
  useEffect(() => {
    if (!isTauri) return
    void fetchLatestRelease().then((r) => r && compareVersions(r.version, APP_VERSION) > 0 && setRel(r))
  }, [])
  return rel
}

export function UpdateBanner() {
  const rel = useNewerRelease()
  if (!rel) return null
  return (
    <section className="rounded-[22px] bg-accent-soft p-5" role="status">
      <p className="text-[17px] font-semibold text-accent">Neue Version {rel.version} verfügbar</p>
      <p className="mt-1 text-[15px] text-fg/80">Du hast {APP_VERSION}. Herunterladen, dann Voki im Tray (unten rechts) mit Rechtsklick → „Beenden“ schliessen und den Installer starten.</p>
      <Button variant="primary" className="mt-4" onClick={() => void openExternal(rel.msi ?? rel.page)}>Version {rel.version} herunterladen</Button>
    </section>
  )
}

/** Settings: version + manual check. */
export function VersionPanel() {
  const [msg, setMsg] = useState('')
  const [rel, setRel] = useState<VokiRelease | null>(null)
  const [busy, setBusy] = useState(false)
  const check = async () => {
    setBusy(true)
    setMsg('')
    if (isTauri) {
      const r = await fetchLatestRelease()
      if (!r) setMsg('Keine Verbindung zu GitHub. Später nochmal versuchen.')
      else if (compareVersions(r.version, APP_VERSION) > 0) setRel(r)
      else setMsg('Du hast die neueste Version.')
    } else {
      await checkWebUpdate().catch(() => {})
      setMsg('Du hast die neueste Version. Neue Versionen lädt Voki automatisch.')
    }
    setBusy(false)
  }
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-surface p-5 shadow-card">
      <div>
        <p className="text-[17px] font-semibold">Voki {APP_VERSION}</p>
        <p className="text-[13px] text-muted">{isTauri ? 'PC-App (Windows)' : 'Web-App'}{msg ? ` · ${msg}` : ''}</p>
      </div>
      {rel ? (
        <Button variant="primary" onClick={() => void openExternal(rel.msi ?? rel.page)}>Version {rel.version} herunterladen</Button>
      ) : (
        <Button onClick={() => void check()} disabled={busy}>{busy ? 'Suche …' : 'Nach Updates suchen'}</Button>
      )}
    </section>
  )
}
