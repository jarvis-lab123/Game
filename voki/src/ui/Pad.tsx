import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface PadHandle { clear: () => void; toDataURL: () => string | null; isEmpty: () => boolean }

/** Drawing surface for handwriting and memory sketches (finger, pen or mouse). */
export const Pad = forwardRef<PadHandle, { height?: number; initial?: string; label: string; onChange?: () => void }>(function Pad({ height = 200, initial, label, onChange }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const empty = useRef(!initial)

  const ctx = () => canvas.current?.getContext('2d') ?? null
  const setup = () => {
    const c = canvas.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    const w = c.clientWidth
    c.width = w * ratio
    c.height = height * ratio
    const g = c.getContext('2d')!
    g.scale(ratio, ratio)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.lineWidth = 3
    g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#111'
    if (initial) {
      const img = new Image()
      img.onload = () => g.drawImage(img, 0, 0, w, height)
      img.src = initial
    }
  }
  useEffect(setup, []) // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    clear: () => {
      const c = canvas.current
      const g = ctx()
      if (c && g) g.clearRect(0, 0, c.width, c.height)
      empty.current = true
      onChange?.()
    },
    toDataURL: () => (empty.current ? null : canvas.current?.toDataURL('image/png') ?? null),
    isEmpty: () => empty.current,
  }))

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={label}
      className="block w-full touch-none rounded-2xl bg-surface-2/60 ring-1 ring-inset ring-line"
      style={{ height }}
      onPointerDown={(e) => {
        drawing.current = true
        canvas.current?.setPointerCapture(e.pointerId)
        const g = ctx()
        const p = pos(e)
        g?.beginPath()
        g?.moveTo(p.x, p.y)
        g?.lineTo(p.x + 0.1, p.y + 0.1)
        g?.stroke()
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return
        const g = ctx()
        const p = pos(e)
        g?.lineTo(p.x, p.y)
        g?.stroke()
        if (empty.current) {
          empty.current = false
          onChange?.()
        }
      }}
      onPointerUp={() => (drawing.current = false)}
      onPointerCancel={() => (drawing.current = false)}
    />
  )
})
