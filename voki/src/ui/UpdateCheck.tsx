import { useEffect, useState } from 'react'
import { APP_VERSION, compareVersions, fetchLatestRelease, type VokiRelease } from '../lib/version'
import { checkWebUpdate, isTauri, openExternal } from '../platform'
import { shellVersion } from '../platform/shell'
import { Button } from './components'

/** PC app: newest release on GitHub if it is newer than this one. */
export function useNewerRelease(): VokiRelease | null {
  const [rel, setRel] = useState<VokiRelease | null>(null)
  useEffect(() => {
    if (!isTauri) return
    // only the installed Windows shell needs a download; the app itself updates automatically
    void Promise.all([fetchLatestRelease(), shellVersion()]).then(([r, shell]) => {
      if (r && shell && compareVersions(r.version, shell) > 0) setRel(r)
    })
  }, [])
  return rel
}

export function UpdateBanner() {
  const rel = useNewerRelease()
  if (!rel) return null
  return (
    <section className="rounded-[22px] bg-accent-soft p-5" role="status">
      <p className="text-[17px] font-semibold text-accent">Neue PC-Version {rel.version} verfügbar</p>
      <p className="mt-1 text-[15px] text-fg/80">Nur nötig für Neuerungen am Windows-Programm selbst (Tray, Fenster). Herunterladen, Voki im Tray mit Rechtsklick → „Beenden“ schliessen, Installer starten.</p>
      <Button variant="primary" className="mt-4" onClick={() => void openExternal(rel.msi ?? rel.page)}>Version {rel.version} herunterladen</Button>
    </section>
  )
}

/** Settings: version + manual check. */
export function VersionPanel() {
  const [msg, setMsg] = useState('')
  const [rel, setRel] = useState<VokiRelease | null>(null)
  const [busy, setBusy] = useState(false)
  const [shell, setShell] = useState<string | null>(null)
  useEffect(() => void shellVersion().then(setShell), [])
  const check = async () => {
    setBusy(true)
    setMsg('')
    if (isTauri) {
      await checkWebUpdate().catch(() => {})
      const r = await fetchLatestRelease()
      const s = (await shellVersion()) ?? APP_VERSION
      if (!r) setMsg('Keine Verbindung zu GitHub. Später nochmal versuchen.')
      else if (compareVersions(r.version, s) > 0) setRel(r)
      else setMsg('Alles aktuell.')
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
        <p className="text-[13px] text-muted">
          {isTauri ? `PC-App · Windows-Programm ${shell ?? '…'} · aktualisiert sich selbst` : 'Web-App · aktualisiert sich selbst'}
          {msg ? ` · ${msg}` : ''}
        </p>
      </div>
      {rel ? (
        <Button variant="primary" onClick={() => void openExternal(rel.msi ?? rel.page)}>Version {rel.version} herunterladen</Button>
      ) : (
        <Button onClick={() => void check()} disabled={busy}>{busy ? 'Suche …' : 'Nach Updates suchen'}</Button>
      )}
    </section>
  )
}
