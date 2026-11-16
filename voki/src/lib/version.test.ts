import { describe, it, expect } from 'vitest'
import { compareVersions, latestVokiRelease } from './version'

describe('compareVersions', () => {
  it('orders semver numerically', () => {
    expect(compareVersions('0.2.10', '0.2.9')).toBeGreaterThan(0)
    expect(compareVersions('0.2.3', '0.2.3')).toBe(0)
    expect(compareVersions('0.2.3', '1.0.0')).toBeLessThan(0)
  })
})

describe('latestVokiRelease', () => {
  const rel = (tag: string, extra = {}) => ({ tag_name: tag, html_url: `https://x/${tag}`, draft: false, prerelease: false, assets: [{ name: `Voki-Setup-${tag.slice(6)}.msi`, browser_download_url: `https://x/${tag}.msi` }], ...extra })
  it('finds the newest voki release and ignores other tags and drafts', () => {
    const r = latestVokiRelease([rel('schach-v9.0.0'), rel('voki-v0.2.3'), rel('voki-v0.2.10'), rel('voki-v0.9.0', { draft: true })])
    expect(r).toEqual({ version: '0.2.10', page: 'https://x/voki-v0.2.10', msi: 'https://x/voki-v0.2.10.msi' })
  })
  it('null when there is none', () => expect(latestVokiRelease([])).toBeNull())
})
