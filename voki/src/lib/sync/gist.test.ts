import { describe, it, expect } from 'vitest'
import { GistClient, SyncError, decodeSyncCode, encodeSyncCode } from './gist'

type Call = { url: string; init?: RequestInit }
function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = []
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    return handler(url, init)
  }) as typeof fetch
  return { f, calls }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('GistClient', () => {
  it('creates a secret gist with headers and returns its id', async () => {
    const { f, calls } = fakeFetch(() => json({ id: 'g1' }, 201))
    const id = await new GistClient('tok', f).create('{"v":1}')
    expect(id).toBe('g1')
    expect(calls[0].url).toBe('https://api.github.com/gists')
    expect(calls[0].init?.method).toBe('POST')
    const h = new Headers(calls[0].init?.headers)
    expect(h.get('Authorization')).toBe('Bearer tok')
    expect(h.get('Accept')).toBe('application/vnd.github+json')
    expect(h.get('X-GitHub-Api-Version')).toBe('2022-11-28')
    const body = JSON.parse(String(calls[0].init?.body))
    expect(body).toEqual({ description: 'Voki Sync (nicht löschen)', public: false, files: { 'voki-sync.json': { content: '{"v":1}' } } })
  })

  it('reads the file, follows raw_url when truncated, null when missing', async () => {
    const { f, calls } = fakeFetch((url) => {
      if (url.endsWith('/gists/a')) return json({ files: { 'voki-sync.json': { content: 'A', truncated: false } } })
      if (url.endsWith('/gists/b')) return json({ files: { 'voki-sync.json': { content: 'x', truncated: true, raw_url: 'https://raw.example/b' } } })
      if (url === 'https://raw.example/b') return new Response('FULL')
      if (url.endsWith('/gists/c')) return json({ files: {} })
      return json({ files: { 'voki-sync.json': { content: '' } } })
    })
    const c = new GistClient('tok', f)
    expect(await c.read('a')).toBe('A')
    expect(await c.read('b')).toBe('FULL')
    expect(await c.read('c')).toBeNull()
    expect(await c.read('d')).toBeNull()
    expect(calls[0].url).toBe('https://api.github.com/gists/a')
  })

  it('writes with PATCH', async () => {
    const { f, calls } = fakeFetch(() => json({ id: 'g1' }))
    await new GistClient('tok', f).write('g1', 'C')
    expect(calls[0].url).toBe('https://api.github.com/gists/g1')
    expect(calls[0].init?.method).toBe('PATCH')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ files: { 'voki-sync.json': { content: 'C' } } })
  })

  it('maps errors to SyncError with German messages', async () => {
    const at = (status: number) => new GistClient('t', fakeFetch(() => json({}, status)).f).read('x')
    await expect(at(401)).rejects.toMatchObject({ kind: 'auth', message: 'Token ungültig oder ohne Gist-Recht.' })
    await expect(at(403)).rejects.toMatchObject({ kind: 'auth' })
    await expect(at(404)).rejects.toMatchObject({ kind: 'notfound', message: 'Sync-Gist nicht gefunden.' })
    await expect(at(500)).rejects.toMatchObject({ kind: 'server', message: 'GitHub-Fehler (Status 500).' })
    const offline = new GistClient('t', (async () => { throw new TypeError('Failed to fetch') }) as typeof fetch)
    const err = await offline.write('x', 'y').catch((e) => e)
    expect(err).toBeInstanceOf(SyncError)
    expect(err).toMatchObject({ kind: 'network', message: 'Keine Verbindung zu GitHub.' })
  })
})

describe('sync code', () => {
  it('round-trips and trims whitespace', () => {
    const code = encodeSyncCode({ token: 'ghp_abc123', gistId: 'f00ba4' })
    expect(code.startsWith('VOKI1-')).toBe(true)
    expect(code).toMatch(/^VOKI1-[A-Za-z0-9_-]+$/)
    expect(decodeSyncCode(`  ${code}\n`)).toEqual({ token: 'ghp_abc123', gistId: 'f00ba4' })
  })
  it('rejects garbage', () => {
    for (const bad of ['', 'hallo', 'VOKI1-', 'VOKI1-!!!', 'VOKI1-' + btoa('{"token":1}'), 'VOKI2-abc'])
      expect(() => decodeSyncCode(bad)).toThrow('Ungültiger Sync-Code.')
  })
})
