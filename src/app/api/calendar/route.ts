import { NextResponse } from 'next/server'
import { getCached, setCached } from '@/lib/cache'

const ICAL_URL = process.env.ICAL_URL || 'https://calendar.google.com/calendar/ical/pablo%40dealground.com/public/basic.ics'

function parseIcal(text: string) {
  const events: any[] = []
  const lines = text.replace(/\r\n /g, '').replace(/\r\n/g, '\n').split('\n')
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
        cur[k] = line.slice(idx + 1).replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\/g, '').trim()
      }
    }
  }
  return events.map(ev => {
    const ds = ev.DTSTART || ''
    let start: Date, allDay = false
    if (ds.length === 8) {
      start = new Date(ds.slice(0,4)+'-'+ds.slice(4,6)+'-'+ds.slice(6,8))
      allDay = true
    } else {
      const c = ds.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/, '$1-$2-$3T$4:$5:$6$7')
      start = new Date(c)
    }
    if (isNaN(start.getTime())) return null
    return {
      summary: ev.SUMMARY,
      start: start.toISOString(),
      location: ev.LOCATION || '',
      allDay,
      description: ev.DESCRIPTION || ''
    }
  }).filter(Boolean).sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())
}

export async function GET() {
  try {
    const r = await fetch(ICAL_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 }
    })
    if (!r.ok) throw new Error('fetch failed')
    const text = await r.text()
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('invalid ical')
    const events = parseIcal(text)
    const payload = { events, timestamp: new Date().toISOString(), status: 'live' }
    await setCached('calendar', payload)
    return NextResponse.json(payload)
  } catch {
    const cached = await getCached('calendar')
    if (cached) return NextResponse.json({ ...cached.payload, status: 'cached', cachedAt: cached.updated_at })
    return NextResponse.json({ events: [], status: 'unavailable' })
  }
}
