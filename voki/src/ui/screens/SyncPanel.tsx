import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import QRCode from 'qrcode'
import { db } from '../../db/db'
import { enableSync, getSyncConfig, joinSync, setSyncConfig, syncCodeFor, syncNow } from '../../db/sync'
import { copyText } from '../../platform'
import { Button, Input, Label, Panel, SectionTitle, TextArea } from '../components'

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Voki%20Sync'

type Msg = { ok: boolean; text: string } | null

function errText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Unbekannter Fehler.'
}

function Status({ msg }: { msg: Msg }) {
  if (!msg) return null
  return <p role="status" className={`mt-3 rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>{msg.text}</p>
}

export function SyncPanel() {
  // undefined = loading, null = off
  const cfg = useLiveQuery(() => getSyncConfig(db), [])
  return (
    <Panel>
      <SectionTitle>Sync</SectionTitle>
      {cfg === undefined ? <p className="text-[15px] text-muted">Lädt …</p> : cfg ? <SyncOn code={syncCodeFor(cfg)} lastSyncAt={cfg.lastSyncAt} lastError={cfg.lastError} /> : <SyncOff />}
    </Panel>
  )
}

function SyncOff() {
  const [mode, setMode] = useState<'new' | 'join'>('new')
  const [token, setToken] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg({ ok: false, text: errText(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="text-[15px] text-muted">Synchronisiert PC und Handy über ein privates GitHub-Gist. Kostenlos, ohne Login.</p>

      {mode === 'new' ? (
        <>
          <ol className="mt-4 space-y-4">
            <li>
              <p className="mb-2 text-[15px]"><span className="font-medium">1.</span> Erstelle bei GitHub einen Token mit dem Recht „gist“.</p>
              <a
                href={TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-surface px-4 text-[15px] font-medium text-fg ring-1 ring-inset ring-line transition-colors duration-150 hover:bg-surface-2"
              >
                Token erstellen ↗
              </a>
            </li>
            <li>
              <Label htmlFor="sync-token"><span className="font-medium">2.</span> Token einfügen</Label>
              <form
                className="flex flex-col gap-2 desk:flex-row"
                onSubmit={(e) => {
                  e.preventDefault()
                  void run(() => enableSync(db, token))
                }}
              >
                <Input
                  id="sync-token"
                  className="min-w-0 w-full font-mono desk:flex-1"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="ghp_…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <Button type="submit" variant="primary" disabled={busy || !token.trim()}>{busy ? 'Einen Moment …' : 'Sync einschalten'}</Button>
              </form>
            </li>
          </ol>
          <Button variant="ghost" className="mt-4 -ml-2" onClick={() => { setMode('join'); setMsg(null) }}><span className="text-accent">Ich habe schon einen Sync-Code →</span></Button>
        </>
      ) : (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => joinSync(db, code))
          }}
        >
          <Label htmlFor="sync-code">Sync-Code einfügen</Label>
          <TextArea
            id="sync-code"
            rows={3}
            className="font-mono text-sm break-all"
            autoComplete="off"
            spellCheck={false}
            placeholder="VOKI1-…"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <p className="mt-2 text-sm text-muted">Deine Daten auf diesem Gerät bleiben erhalten und werden zusammengeführt.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={busy || !code.trim()}>{busy ? 'Verbinde …' : 'Verbinden'}</Button>
            <Button type="button" variant="ghost" onClick={() => { setMode('new'); setMsg(null) }}>Zurück</Button>
          </div>
        </form>
      )}
      <Status msg={msg} />
    </div>
  )
}

function SyncOn({ code, lastSyncAt, lastError }: { code: string; lastSyncAt?: string; lastError?: string }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(code, { margin: 1, width: 360, errorCorrectionLevel: 'M' })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null))
    return () => {
      alive = false
    }
  }, [code])

  const syncNowClick = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await syncNow(db)
      setMsg({ ok: true, text: r.changed ? 'Synchronisiert. Neue Daten übernommen.' : 'Synchronisiert. Alles aktuell.' })
    } catch {
      // The error is stored in the config and shown in the status line.
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    const ok = await copyText(code)
    setMsg(ok ? { ok: true, text: 'Sync-Code kopiert.' } : { ok: false, text: 'Kopieren hat nicht geklappt. Markiere den Code von Hand.' })
  }

  const turnOff = async () => {
    if (!confirm('Sync auf diesem Gerät ausschalten? Deine Daten bleiben erhalten.')) return
    try {
      await setSyncConfig(db, null)
    } catch (e) {
      setMsg({ ok: false, text: errText(e) })
    }
  }

  return (
    <div>
      {lastError ? (
        <p className="text-[15px] text-bad">Sync fehlgeschlagen: {lastError}</p>
      ) : (
        <p className="text-[15px] text-muted">
          {lastSyncAt ? `Zuletzt synchronisiert: ${new Date(lastSyncAt).toLocaleString('de-CH')}` : 'Noch nicht synchronisiert.'}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={syncNowClick} disabled={busy}>{busy ? 'Synchronisiere …' : 'Jetzt synchronisieren'}</Button>
      </div>
      <Status msg={msg} />

      <div className="mt-6 border-t border-line pt-5">
        <p className="mb-2 text-sm font-medium">Sync-Code für dein anderes Gerät</p>
        <div className="flex flex-wrap items-start gap-5">
          {qr && <img src={qr} width={180} height={180} alt="QR-Code mit deinem Sync-Code" className="rounded-xl bg-white p-2 ring-1 ring-line" />}
          <div className="min-w-0 flex-1 basis-60">
            <p className="select-all break-all rounded-xl bg-surface-2 px-3.5 py-2.5 font-mono text-sm">{code}</p>
            <Button size="sm" className="mt-2" onClick={copy}>Code kopieren</Button>
            <p className="mt-3 text-sm text-muted">Am Handy in Voki unter Einstellungen → Sync den Code einfügen.</p>
            <p className="mt-1 text-sm text-muted">Der Code enthält deinen Token. Teile ihn mit niemandem.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <Button variant="danger" onClick={turnOff}>Sync ausschalten</Button>
        <p className="mt-2 text-sm text-muted">Deine Daten bleiben auf diesem Gerät.</p>
      </div>
    </div>
  )
}
