import { useState } from 'react'
import { db } from '../../db/db'
import { toTSV } from '../../lib/export'
import { downloadFile } from '../../platform'
import { Button } from '../components'

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'voki'
}

/** Downloads all words of a deck as TSV (term, translation, example, gender, notes). */
export function ExportButton({ deckId }: { deckId: string }) {
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    try {
      const [deck, notes, cards] = await Promise.all([db.decks.get(deckId), db.notes.where('deckId').equals(deckId).toArray(), db.cards.where('deckId').equals(deckId).toArray()])
      // keep import order
      const order = new Map<string, number>()
      for (const c of cards) order.set(c.noteId, Math.min(order.get(c.noteId) ?? Infinity, c.order))
      notes.sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity))
      downloadFile(`${safeName(deck?.name ?? 'voki')}.tsv`, toTSV(notes), 'text/tab-separated-values')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="secondary" onClick={run} disabled={busy}>
      TSV exportieren
    </Button>
  )
}
