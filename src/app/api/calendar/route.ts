import { NextResponse } from 'next/server'
import { getCached, setCached } from '@/lib/cache'

const ICAL_URL = process.env.ICAL_URL || 'https://calendar.google.com/calendar/ical/pablo%40dealground.com/public/basic.ics'

// Convert iCal datetime to proper UTC ISO string
// Handles: floating (no Z, no TZID), UTC (Z suffix), and TZID-specified times
function parseIcalDate(dtLine: string, tzid: string | null): Date | null {
  // dtLine is the raw line e.g. "DTSTART;TZID=America/Chicago:20260526T080000"
  // or "DTSTART:20260526T140000Z"
  // or "DTSTART:20260526" (all day)
  
  const colonIdx = dtLine.lastIndexOf(':')
  if (colonIdx < 0) return null
  
  const rawTzid = dtLine.includes('TZID=') 
    ? dtLine.slice(dtLine.indexOf('TZID=') + 5, colonIdx)
    : null
  
  const val = dtLine.slice(colonIdx + 1).trim()
  
  // All day event
  if (val.length === 8) {
    return new Date(val.slice(0,4) + '-' + val.slice(4,6) + '-' + val.slice(6,8) + 'T00:00:00')
  }
  
  // Has Z suffix = UTC, parse directly
  if (val.endsWith('Z')) {
    const clean = val.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')
    return new Date(clean)
  }
  
  // Has TZID — treat as that timezone
  // We support America/Chicago, America/Monterrey, America/Mexico_City = CST = UTC-6
  const tz = rawTzid || tzid || ''
  const clean = val.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')
  
  const cstZones = ['America/Chicago', 'America/Monterrey', 'America/Mexico_City', 'America/Regina']
  const pstZones = ['America/Los_Angeles', 'America/Vancouver', 'America/Tijuana']
  const mstZones = ['America/Denver', 'America/Boise', 'America/Phoenix']
  const estZones = ['America/New_York', 'America/Toronto', 'America/Detroit']
  
  // DST-aware offsets for May 2026 (summer = DST active for US zones)
  let offsetHours = -6 // CST default (Monterrey doesn't observe DST)
  if (cstZones.some(z => tz.includes(z.split('/')[1]))) {
    // Monterrey = UTC-6 always. Chicago = CDT in summer = UTC-5
    offsetHours = tz.includes('Monterrey') || tz.includes('Mexico_City') || tz.includes('Regina') ? -6 : -5
  } else if (pstZones.some(z => tz.includes(z.split('/')[1]))) {
    offsetHours = -7 // PDT in summer
  } else if (mstZones.some(z => tz.includes(z.split('/')[1]))) {
    offsetHours = tz.includes('Phoenix') ? -7 : -6 // Arizona no DST
  } else if (estZones.some(z => tz.includes(z.split('/')[1]))) {
    offsetHours = -4 // EDT in summer
  }
  
  const localDate = new Date(clean)
  if (isNaN(localDate.getTime())) return null
  // Subtract offset to get UTC
  return new Date(localDate.getTime() - offsetHours * 3600000)
}

function parseIcal(text: string) {
  const events: any[] = []
  const lines = text.replace(/\r\n /g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let cur: any = null
  let calTzid: string | null = null
  
  for (const line of lines) {
    // Grab calendar-level timezone
    if (line.startsWith('X-WR-TIMEZONE:')) {
      calTzid = line.slice(14).trim()
    }
    
    if (line.trim() === 'BEGIN:VEVENT') { cur = {} }
    else if (line.trim() === 'END:VEVENT' && cur) {
      if (cur.SUMMARY && cur._DTSTART_RAW) events.push(cur)
      cur = null
    } else if (cur) {
      // Store raw DTSTART line for timezone-aware parsing
      if (line.startsWith('DTSTART')) {
        cur._DTSTART_RAW = line
        cur._ALLDAY = !line.includes('T')
      }
      const idx = line.indexOf(':')
      if (idx > 0) {
        const k = line.slice(0, idx).split(';')[0]
        cur[k] = line.slice(idx + 1).replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\/g, '').trim()
      }
    }
  }
  
  return events.map(ev => {
    const start = parseIcalDate(ev._DTSTART_RAW, calTzid)
    if (!start || isNaN(start.getTime())) return null
    return {
      summary: ev.SUMMARY,
      start: start.toISOString(),
      location: ev.LOCATION || '',
      allDay: ev._ALLDAY || false,
      description: ev.DESCRIPTION || ''
    }
  }).filter(Boolean).sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())
}

async function tryFetch(url: string): Promise<string | null> {
  const attempts = [
    async () => {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/calendar' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.text()
    },
    async () => {
      const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {
        cache: 'no-store', signal: AbortSignal.timeout(8000)
      })
      if (!r.ok) throw new Error()
      return await r.text()
    },
    async () => {
      const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, {
        cache: 'no-store', signal: AbortSignal.timeout(8000)
      })
      if (!r.ok) throw new Error()
      return await r.text()
    },
  ]
  for (const attempt of attempts) {
    try {
      const text = await attempt()
      if (text?.includes('BEGIN:VCALENDAR')) return text
    } catch {}
  }
  return null
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const text = await tryFetch(ICAL_URL)
  if (text) {
    const events = parseIcal(text)
    const payload = { events, timestamp: new Date().toISOString(), status: 'live', count: events.length }
    await setCached('calendar', payload)
    return NextResponse.json(payload)
  }
  const cached = await getCached('calendar')
  if (cached?.payload?.events?.length) {
    return NextResponse.json({ ...cached.payload, status: 'cached', cachedAt: cached.updated_at })
  }
  return NextResponse.json({ events: [], status: 'unavailable' })
}
