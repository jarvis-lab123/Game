import { describe, expect, it } from 'vitest'
import { buildFromHtml, busyRoute } from './liveupdate'

describe('liveupdate', () => {
  it('reads the build from index.html', () => {
    expect(buildFromHtml('<script type="module" crossorigin src="/Game/voki/assets/index-D8ghJbVa.js"></script>')).toBe('assets/index-D8ghJbVa.js')
    expect(buildFromHtml('<html></html>')).toBeNull()
  })
  it('never reloads during a session or test', () => {
    expect(busyRoute('#/lernen?go=1&min=10')).toBe(true)
    expect(busyRoute('#/lernen?min=10&go=1')).toBe(true)
    expect(busyRoute('#/probetest?deck=x&paper=1')).toBe(true)
    expect(busyRoute('#/bloecke?deck=x&start=0')).toBe(true)
    expect(busyRoute('#/lernen')).toBe(false)
    expect(busyRoute('#/')).toBe(false)
    expect(busyRoute('')).toBe(false)
    expect(busyRoute('#/ueben?tab=bloecke')).toBe(false)
  })
})
