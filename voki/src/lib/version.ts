export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

interface GhRelease { tag_name: string; html_url: string; draft: boolean; prerelease: boolean; assets: { name: string; browser_download_url: string }[] }
export interface VokiRelease { version: string; page: string; msi: string | null }

/** Newest published "voki-vX.Y.Z" release from the GitHub releases list. */
export function latestVokiRelease(list: GhRelease[]): VokiRelease | null {
  const voki = list
    .filter((r) => !r.draft && !r.prerelease && /^voki-v\d+\.\d+\.\d+$/.test(r.tag_name))
    .map((r) => ({ version: r.tag_name.slice(6), page: r.html_url, msi: r.assets.find((a) => a.name.endsWith('.msi'))?.browser_download_url ?? null }))
    .sort((x, y) => compareVersions(y.version, x.version))
  return voki[0] ?? null
}

/** Ask GitHub for the newest Windows release. Null when offline or nothing found. */
export async function fetchLatestRelease(fetchImpl: typeof fetch = fetch): Promise<VokiRelease | null> {
  try {
    const r = await fetchImpl('https://api.github.com/repos/jarvis-lab123/Game/releases?per_page=20', { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' })
    if (!r.ok) return null
    return latestVokiRelease(await r.json())
  } catch {
    return null
  }
}
