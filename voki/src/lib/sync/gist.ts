const API = 'https://api.github.com'
export const SYNC_FILE = 'voki-sync.json'

export type SyncErrorKind = 'auth' | 'notfound' | 'network' | 'server'

export class SyncError extends Error {
  kind: SyncErrorKind
  constructor(kind: SyncErrorKind, message: string) {
    super(message)
    this.name = 'SyncError'
    this.kind = kind
  }
}

function statusError(status: number): SyncError {
  if (status === 401 || status === 403) return new SyncError('auth', 'Token ungültig oder ohne Gist-Recht.')
  if (status === 404) return new SyncError('notfound', 'Sync-Gist nicht gefunden.')
  return new SyncError('server', `GitHub-Fehler (Status ${status}).`)
}

interface GistFile { content?: string; truncated?: boolean; raw_url?: string }

/** Minimal GitHub Gist API client (token needs only the `gist` scope). */
export class GistClient {
  private token: string
  private fetchImpl: typeof fetch

  constructor(token: string, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
    this.token = token
    this.fetchImpl = fetchImpl
  }

  private async send(url: string, init: RequestInit = {}, auth = true): Promise<Response> {
    let res: Response
    try {
      res = await this.fetchImpl(url, {
        ...init,
        cache: 'no-store',
        headers: auth
          ? {
              Authorization: `Bearer ${this.token}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            }
          : undefined,
      })
    } catch {
      throw new SyncError('network', 'Keine Verbindung zu GitHub.')
    }
    if (!res.ok) throw statusError(res.status)
    return res
  }

  async create(content: string): Promise<string> {
    const res = await this.send(`${API}/gists`, {
      method: 'POST',
      body: JSON.stringify({ description: 'Voki Sync (nicht löschen)', public: false, files: { [SYNC_FILE]: { content } } }),
    })
    const g = (await res.json()) as { id?: string }
    if (!g.id) throw new SyncError('server', 'GitHub-Fehler (keine Gist-ID).')
    return g.id
  }

  async read(gistId: string): Promise<string | null> {
    const res = await this.send(`${API}/gists/${encodeURIComponent(gistId)}`)
    const g = (await res.json()) as { files?: Record<string, GistFile | null> }
    const file = g.files?.[SYNC_FILE]
    if (!file) return null
    let content = file.content ?? ''
    // Raw URLs of secret gists work without auth; no headers keeps it a simple CORS request.
    if (file.truncated && file.raw_url) content = await (await this.send(file.raw_url, {}, false)).text()
    return content.trim() ? content : null
  }

  async write(gistId: string, content: string): Promise<void> {
    await this.send(`${API}/gists/${encodeURIComponent(gistId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ files: { [SYNC_FILE]: { content } } }),
    })
  }
}

const PREFIX = 'VOKI1-'

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('bad base64url')
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function encodeSyncCode(cfg: { token: string; gistId: string }): string {
  return PREFIX + toBase64Url(JSON.stringify({ token: cfg.token, gistId: cfg.gistId }))
}

export function decodeSyncCode(code: string): { token: string; gistId: string } {
  const c = code.replace(/\s+/g, '')
  try {
    if (!c.startsWith(PREFIX)) throw new Error()
    const x = JSON.parse(fromBase64Url(c.slice(PREFIX.length))) as { token?: unknown; gistId?: unknown }
    if (typeof x.token !== 'string' || typeof x.gistId !== 'string' || !x.token || !x.gistId) throw new Error()
    return { token: x.token, gistId: x.gistId }
  } catch {
    throw new Error('Ungültiger Sync-Code.')
  }
}
