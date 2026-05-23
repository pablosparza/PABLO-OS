import { NextResponse } from 'next/server'
import { getCached, setCached } from '@/lib/cache'

const ICAL_URL = process.env.ICAL_URL || 'https://calendar.google.com/calendar/ical/pablo%40dealground.com/public/basic.ics'

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
        cur[k] = line.slice(idx + 1).replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\/g, '').trim()
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

export const dynamic = 'force-dynamic'

export async function GET() {
  // Try fetching the iCal
  const proxies = [
    ICAL_URL,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(ICAL_URL)}`,
    `https://corsproxy.io/?${encodeURIComponent(ICAL_URL)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(ICAL_URL)}`,
  ]

  for (const url of proxies) {
    try {
      const r = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/calendar, text/plain, */*',
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
      
      if (!r.ok) continue
      const text = await r.text()
      if (!text.includes('BEGIN:VCALENDAR')) continue
      
      const events = parseIcal(text)
      const payload = { events, timestamp: new Date().toISOString(), status: 'live', count: events.length }
      await setCached('calendar', payload)
      return NextResponse.json(payload)
    } catch {
      continue
    }
  }

  // Check cache
  const cached = await getCached('calendar')
  if (cached?.payload?.events?.length) {
    return NextResponse.json({ ...cached.payload, status: 'cached', cachedAt: cached.updated_at })
  }

  // Return setup instructions
  return NextResponse.json({ 
    events: [], 
    status: 'setup_required',
    message: 'Calendar not public',
    setup: 'Go to Google Calendar → Settings → your calendar → Access permissions → check "Make available to public"'
  })
}
