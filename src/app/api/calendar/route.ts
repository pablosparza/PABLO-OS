import { NextResponse } from 'next/server'
import { getCached, setCached } from '@/lib/cache'

const ICAL_URL = 'https://calendar.google.com/calendar/ical/pablo%40dealground.com/public/basic.ics'

function parseIcal(text: string) {
  const events: any[] = []
  const lines = text.replace(/\r\n /g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let cur: any = null
  for (const line of lines) {
    if (line.trim() === 'BEGIN:VEVENT') { cur = {} }
    else if (line.trim() === 'END:VEVENT' && cur) {
      if (cur.SUMMARY && cur.DTSTART) events.push(cur)
      cur = null
    } else if (cur) {
      const idx = line.indexOf(':')
      if (idx > 0) {
        const k = line.slice(0, idx).split(';')[0]
        cur[k] = line.slice(idx + 1)
          .replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\/g, '').trim()
      }
    }
  }
  return events.map(ev => {
    const ds = ev.DTSTART || ''
    let start: Date, allDay = false
    if (ds.length === 8) {
      start = new Date(ds.slice(0,4)+'-'+ds.slice(4,6)+'-'+ds.slice(6,8)+'T00:00:00')
      allDay = true
    } else {
      const clean = ds.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/, '$1-$2-$3T$4:$5:$6$7')
      start = new Date(clean)
    }
    if (isNaN(start.getTime())) return null
    return { summary: ev.SUMMARY, start: start.toISOString(), location: ev.LOCATION || '', allDay }
  }).filter(Boolean).sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())
}

async function tryFetch(url: string): Promise<string | null> {
  const attempts = [
    // Direct fetch - works on Vercel edge
    async () => {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PabloOS/1.0)', Accept: 'text/calendar' },
        next: { revalidate: 0 }
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.text()
    },
    // Via allorigins
    async () => {
      const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {
        next: { revalidate: 0 }
      })
      if (!r.ok) throw new Error(`allorigins HTTP ${r.status}`)
      return await r.text()
    },
    // Via corsproxy
    async () => {
      const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, {
        next: { revalidate: 0 }
      })
      if (!r.ok) throw new Error(`corsproxy HTTP ${r.status}`)
      return await r.text()
    },
  ]
  for (const attempt of attempts) {
    try {
      const text = await attempt()
      if (text.includes('BEGIN:VCALENDAR')) return text
    } catch {}
  }
  return null
}

export async function GET() {
  const text = await tryFetch(ICAL_URL)
  if (text) {
    const events = parseIcal(text)
    const payload = { events, timestamp: new Date().toISOString(), status: 'live', count: events.length }
    await setCached('calendar', payload)
    return NextResponse.json(payload)
  }
  // Try cache
  const cached = await getCached('calendar')
  if (cached?.payload) {
    return NextResponse.json({ ...cached.payload, status: 'cached', cachedAt: cached.updated_at })
  }
  return NextResponse.json({ events: [], status: 'unavailable', message: 'Calendar feed temporarily unavailable' })
}
