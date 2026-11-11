import { useEffect, useState } from 'react'

export interface Route { path: string; parts: string[]; query: URLSearchParams }

function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/'
  const [path, qs] = raw.split('?')
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs ?? '') }
}

export function useRoute(): Route {
  const [r, setR] = useState(parse)
  useEffect(() => {
    const on = () => setR(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}

export function go(to: string) {
  location.hash = to
}
