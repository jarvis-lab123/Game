import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { exportBackup, restoreBackup, validateBackup } from '../../lib/backup'
import { downloadFile, isTauri } from '../../platform'
import { Button, Input, Label, PageHeader, Panel, SectionTitle, Segmented } from '../components'
import { saveSettings, useSettings } from '../settings'

export async function downloadBackup() {
  const b = await exportBackup(db)
  const day = new Date().toISOString().slice(0, 10)
  downloadFile(`voki-backup-${day}.json`, JSON.stringify(b))
  await saveSettings({ lastBackupAt: new Date().toISOString() })
}

/** Validates first, asks, then replaces everything. Returns true if restored. */
export async function restoreFromFile(content: string): Promise<boolean> {
  let json: unknown
  try {
    json = JSON.parse(content)
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.')
  }
  const b = validateBackup(json)
  const words = b.notes.length
  if (!confirm(`Backup vom ${new Date(b.exportedAt).toLocaleDateString('de-CH')} mit ${words} Wörtern laden? Alle Daten auf diesem Gerät werden dadurch ersetzt.`)) return false
  await restoreBackup(db, b)
  return true
}

export function BackupReminder() {
  const s = useSettings()
  const count = useLiveQuery(() => db.notes.count(), [])
  if (!count) return null
  const days = s.lastBackupAt ? Math.floor((Date.now() - new Date(s.lastBackupAt).getTime()) / 86400000) : Infinity
  if (days < 7) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-4 ring-1 ring-line">
      <p className="text-[15px]">
        <span className="font-medium">Backup fällig.</span>{' '}
        <span className="text-muted">{days === Infinity ? 'Du hast noch nie gesichert.' : `Letztes Backup vor ${days} Tagen.`}</span>
      </p>
      <Button size="sm" onClick={downloadBackup}>Jetzt sichern</Button>
    </div>
  )
}

export function SettingsScreen() {
  const s = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const counts = useLiveQuery(async () => ({ words: await db.notes.count(), logs: await db.logs.count() }), [])

  return (
    <div className="space-y-6">
      <PageHeader title="Einstellungen" />

      <Panel>
        <SectionTitle>Lernen</SectionTitle>
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="st-min">Minuten pro Tag</Label>
            <div className="flex items-center gap-2"><Input className="max-w-28 tabular" id="st-min" type="number" inputMode="numeric" min={5} max={120} value={s.dailyMinutesGoal} onChange={(e) => saveSettings({ dailyMinutesGoal: Math.max(5, Math.min(120, Number(e.target.value) || 15)) })} /><span className="text-sm text-muted">Min</span></div>
          </div>
          <div>
            <Label htmlFor="st-new" hint="(ohne Testdatum)">Neue pro Tag</Label>
            <div className="flex items-center gap-2"><Input className="max-w-28 tabular" id="st-new" type="number" inputMode="numeric" min={0} max={100} value={s.newCardsPerDayDefault} onChange={(e) => saveSettings({ newCardsPerDayDefault: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /><span className="text-sm text-muted">Wörter</span></div>
          </div>
          <div>
            <Label htmlFor="st-ret" hint="(Standard 90)">Behaltensquote</Label>
            <div className="flex items-center gap-2"><Input className="max-w-28 tabular" id="st-ret" type="number" inputMode="numeric" min={80} max={97} value={Math.round(s.desiredRetention * 100)} onChange={(e) => saveSettings({ desiredRetention: Math.max(0.8, Math.min(0.97, (Number(e.target.value) || 90) / 100)) })} /><span className="text-sm text-muted">%</span></div>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">Höhere Quote = häufigere Wiederholungen. 90 % ist für die meisten ideal.</p>
      </Panel>

      <Panel>
        <SectionTitle>Darstellung</SectionTitle>
        <Segmented label="Farbschema" value={s.theme} onChange={(v) => saveSettings({ theme: v })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }]} />
      </Panel>

      <Panel>
        <SectionTitle>Backup</SectionTitle>
        <p className="text-[15px] text-muted">
          Sichert alle Decks, Wörter und deinen Lernfortschritt als JSON-Datei. {isTauri ? 'PC-App und Handy-App' : 'Handy und PC'} haben getrennte Speicher: Bis zum Sync (Phase 2) bringst du Daten per Backup auf das andere Gerät.
        </p>
        {counts && <p className="mt-2 text-sm text-muted tabular">{counts.words} Wörter · {counts.logs} Abfragen gespeichert</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={downloadBackup}>Backup herunterladen</Button>
          <input
            ref={fileRef}
            aria-label="Backup-Datei wählen"
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                if (await restoreFromFile(await f.text())) setMsg({ ok: true, text: 'Backup geladen.' })
              } catch (err) {
                setMsg({ ok: false, text: (err as Error).message })
              }
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>Backup laden …</Button>
        </div>
        {msg && <p role="status" className={`mt-3 rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>{msg.text}</p>}
        {s.lastBackupAt && <p className="mt-3 text-sm text-muted">Letztes Backup: {new Date(s.lastBackupAt).toLocaleString('de-CH')}</p>}
      </Panel>

      <p className="text-center text-xs text-muted">Voki {__APP_VERSION__} · {isTauri ? 'PC-App' : 'Web-App'} · Daten bleiben auf diesem Gerät</p>
    </div>
  )
}
