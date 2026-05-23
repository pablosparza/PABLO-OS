'use client'
import { useEffect, useState, useCallback } from 'react'

// ── helpers ────────────────────────────────────────
const fmt = (v: number) => '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
const chgFmt = (c: number) => (c >= 0 ? '+' : '') + c.toFixed(2) + '%'
const WX_ICONS: Record<number, string> = { 0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',61:'🌧',80:'🌦',95:'⛈' }
const WX_LABELS: Record<number, string> = { 0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',61:'Rain',80:'Showers',95:'Thunderstorm' }

const REGIME_CFG: Record<string,any> = {
  'risk-on':     { label:'▲ Risk-on',     col:'#00c873', bg:'#00c87320', border:'#00c87340' },
  'risk-off':    { label:'▼ Risk-off',    col:'#ff3d5a', bg:'#ff3d5a20', border:'#ff3d5a40' },
  'neutral':     { label:'● Neutral',     col:'#4080ff', bg:'#4080ff20', border:'#4080ff40' },
  'ai-momentum': { label:'◆ AI Momentum', col:'#8868ff', bg:'#8868ff20', border:'#8868ff40' },
}

const POSITIONS = [
  {t:'VTI',v:366,s:.78,sec:'US'},{t:'VXUS',v:84,s:1.97,sec:'INTL'},
  {t:'AVUV',v:120,s:.71,sec:'US'},{t:'AVDV',v:108,s:.37,sec:'INTL'},
  {t:'VTIP',v:50,s:.80,sec:'BOND'},{t:'RXRX',v:3,s:13.61,sec:'SPEC'},
  {t:'BE',v:298,s:.66,sec:'SPEC'},{t:'MBLY',v:10,s:7.30,sec:'SPEC'},
  {t:'SKYT',v:37,s:2.96,sec:'SPEC'},
]

// ── date helpers ───────────────────────────────────
const fmtTime = (iso: string) => {
  const d = new Date(iso)
  // Display in Monterrey time (CST = UTC-6, no DST)
  const mtyTime = d.toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'America/Monterrey'
  })
  // Check if midnight in MTY = all day
  const mtyHour = parseInt(d.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Monterrey' }))
  if (mtyHour === 0 || mtyHour === 24) return 'All day'
  return mtyTime
}
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { 
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'America/Monterrey'
  })
}
const countdown = (iso: string) => {
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  if (diff <= 0) return 'Now'
  if (diff < 60) return `in ${diff}m`
  if (diff < 120) return `in ${Math.floor(diff/60)}h ${diff%60}m`
  return `at ${fmtTime(iso)}`
}
const duDays = (dateStr: string) => {
  const t = new Date(); t.setHours(0,0,0,0)
  return Math.round((new Date(dateStr + 'T00:00:00').getTime() - t.getTime()) / 86400000)
}
const nextMonth = (dateStr: string) => {
  const t = new Date(); t.setHours(0,0,0,0)
  const d = new Date(dateStr + 'T00:00:00')
  while (d < t) d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}

// ── WHY IT MATTERS classifier ──────────────────────
function whyMatters(title: string): string {
  const low = title.toLowerCase()
  if (low.includes('fed') || low.includes('federal reserve') || low.includes('powell')) return 'Fed policy drives equity valuations and rate-sensitive positions.'
  if (low.includes('inflation') || low.includes('cpi') || low.includes('pce')) return 'Inflation data shifts rate expectations — critical for VTIP and equity mix.'
  if (low.includes('oil') || low.includes('crude') || low.includes('opec')) return 'Energy costs reprice inflation — pressure on growth equities.'
  if (low.includes('nvidia') || low.includes('semiconductor') || low.includes('chip')) return 'AI infrastructure demand — core driver of NVDA, SOXX, SKYT.'
  if (low.includes('quantum') || low.includes('ionq')) return 'Federal quantum investment — directly relevant to IONQ.'
  if (low.includes('china') || low.includes('taiwan')) return 'Geopolitical risk affects semiconductor supply chains globally.'
  if (low.includes('ukraine') || low.includes('russia')) return 'European conflict maintains elevated energy and commodity risk.'
  if (low.includes('recession') || low.includes('gdp')) return 'Growth trajectory affects equity risk appetite and defensive rotation.'
  if (low.includes('yield') || low.includes('treasury') || low.includes('bond')) return 'Rate movements reprice growth stocks and portfolio duration.'
  if (low.includes('tariff') || low.includes('trade')) return 'Trade barriers reprice input costs and multinational earnings.'
  if (low.includes('ai') || low.includes('artificial intelligence')) return 'AI breakthroughs accelerate sector rotation toward infrastructure.'
  if (low.includes('sanction')) return 'Trade restrictions affect global supply chains and commodity flows.'
  return ''
}

// ── regime interpretation ──────────────────────────
function regimeNarrative(spy: any, ionq: any, nvda: any): { regime: string; headline: string; sub: string } {
  if (ionq?.change > 5) return { regime: 'ai-momentum', headline: `IONQ +${ionq.change.toFixed(1)}% — quantum sector leading`, sub: 'Federal $2B commitment driving sector rotation. Pure-play quantum names outperforming.' }
  if (spy?.change > 0.8) return { regime: 'risk-on', headline: `Broad market +${spy.change.toFixed(2)}% — growth positioning favored`, sub: 'Market breadth positive. VTI and diversified exposure benefits from risk-on regime.' }
  if (spy?.change < -0.8) return { regime: 'risk-off', headline: `Market pressure ${spy.change.toFixed(2)}% — defensive rotation building`, sub: 'Growth equities under pressure. VTIP inflation hedge and international diversification relevant.' }
  if (nvda && !nvda.up) return { regime: 'neutral', headline: 'AI infrastructure cautious — semiconductors mixed', sub: 'NVDA showing post-earnings consolidation. Gross margin on Blackwell transition is the key watch.' }
  return { regime: 'neutral', headline: 'Markets range-bound — no clear conviction', sub: 'No directional catalyst. Oil at $98 quietly repricing inflation. VTIP hedge well-timed.' }
}


// ── PayForm — fully self-contained, own state, never resets ──
function PayForm({ onAdd }: { onAdd: (p: any) => void }) {
  const [n, setN] = useState('')
  const [a, setA] = useState('')
  const [d, setD] = useState('')
  const [r, setR] = useState(false)
  const add = () => {
    if (!n.trim() || !d) return
    onAdd({ name: n.trim(), amount: a || '—', date: d, recurring: r })
    setN(''); setA(''); setD(''); setR(false)
  }
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginTop:8, paddingTop:8, borderTop:'0.5px solid var(--b1)' }}>
      <input placeholder="Name e.g. Rent" value={n} onChange={e => setN(e.target.value)} />
      <input placeholder="Amount e.g. $1,200" value={a} onChange={e => setA(e.target.value)} />
      <input type="date" value={d} onChange={e => setD(e.target.value)} style={{ gridColumn:'1/-1' }} />
      <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', gap:4, fontSize:8, color:'var(--t2)' }}>
        <input type="checkbox" checked={r} onChange={e => setR(e.target.checked)} /><label>Repeat monthly</label>
      </div>
      <button className="fbtn" style={{ gridColumn:'1/-1' }} onClick={add}>Add obligation</button>
    </div>
  )
}

export default function PabloOS() {
  const [page, setPage] = useState('ov')
  const [intel, setIntel] = useState<any>(null)
  const [marketData, setMarketData] = useState<any>(null)
  const [portData, setPortData] = useState<any>(null)
  const [mktNews, setMktNews] = useState<any>(null)
  const [worldNews, setWorldNews] = useState<any>(null)
  const [calendar, setCalendar] = useState<any>(null)
  const [weather, setWeather] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [finance, setFinance] = useState<any>({})
  const [showPayForm, setShowPayForm] = useState(false)
  const [regime, setRegime] = useState('neutral')

  // clock — uses DOM directly so clock ticking never causes re-render
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      const ts = String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0')
      const ds=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],ms=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const dt = ds[n.getDay()]+' '+ms[n.getMonth()]+' '+n.getDate()+' · '+n.getFullYear()
      const clkEl = document.getElementById('pablo-clock')
      const dtEl = document.getElementById('pablo-date')
      if (clkEl) clkEl.textContent = ts
      if (dtEl) dtEl.textContent = dt
    }
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [])

  // local storage
  useEffect(() => {
    try {
      const p = localStorage.getItem('pablo_pays'); if (p) setPayments(JSON.parse(p))
      const f = localStorage.getItem('pablo_fin'); if (f) setFinance(JSON.parse(f))
    } catch {}
  }, [])

  // data loaders — all server-side API routes, zero CORS
  const loadIntel     = useCallback(async () => { try { const d = await fetch('/api/intelligence').then(r=>r.json()); setIntel(d); setRegime(d.regime||'neutral') } catch {} }, [])
  const loadMarket    = useCallback(async () => { try { const d = await fetch('/api/market?type=movers').then(r=>r.json()); setMarketData(d) } catch {} }, [])
  const loadPortfolio = useCallback(async () => { try { const d = await fetch('/api/market?type=portfolio').then(r=>r.json()); setPortData(d) } catch {} }, [])
  const loadMktNews   = useCallback(async () => { try { const d = await fetch('/api/news').then(r=>r.json()); setMktNews(d) } catch {} }, [])
  const loadWorldNews = useCallback(async () => {
    try {
      const d = await fetch('/api/world', { signal: AbortSignal.timeout(12000) }).then(r=>r.json())
      setWorldNews(d)
    } catch {
      setWorldNews((prev: any) => prev || { articles: [], status: 'unavailable' })
    }
  }, [])
  const loadCalendar  = useCallback(async () => { try { const d = await fetch('/api/calendar').then(r=>r.json()); setCalendar(d) } catch {} }, [])
  const loadWeather   = useCallback(async () => {
    try {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=25.6866&longitude=-100.3161&current=temperature_2m,weathercode&daily=temperature_2m_max,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&timezone=America/Monterrey&forecast_days=5')
      setWeather(await r.json())
    } catch {}
  }, [])

  const refreshAll = useCallback(() => {
    loadIntel(); loadMarket(); loadPortfolio()
    loadMktNews(); loadWorldNews(); loadCalendar(); loadWeather()
  }, [loadIntel, loadMarket, loadPortfolio, loadMktNews, loadWorldNews, loadCalendar, loadWeather])

  const initialized = typeof window !== 'undefined' && (window as any).__pablo_init
  useEffect(() => {
    if (!(window as any).__pablo_init) {
      (window as any).__pablo_init = true
      refreshAll()
    }
    const i2 = setInterval(loadMarket, 300000)
    const i3 = setInterval(loadIntel, 600000)
    const i4 = setInterval(loadCalendar, 900000)
    return () => { clearInterval(i2); clearInterval(i3); clearInterval(i4) }
  }, [])

  const rc = REGIME_CFG[regime] || REGIME_CFG.neutral

  // ── CALENDAR INTELLIGENCE ──────────────────────
  const calIntel = (() => {
    if (!calendar?.events?.length) return null
    const now = new Date()
    // Monterrey = CST = UTC-6 always (no DST)
    const CST_OFFSET = 6 * 3600000 // 6 hours in ms
    const mtyMs = now.getTime() - CST_OFFSET // current time in CST as if UTC
    const mtyNow = new Date(mtyMs)
    const y = mtyNow.getUTCFullYear(), mo = mtyNow.getUTCMonth(), day = mtyNow.getUTCDate()
    // Day start/end in UTC (add back CST offset)
    const todayS = new Date(Date.UTC(y, mo, day, 0) + CST_OFFSET)
    const todayE = new Date(Date.UTC(y, mo, day, 23, 59, 59) + CST_OFFSET)
    const tomorrowS = new Date(Date.UTC(y, mo, day + 1, 0) + CST_OFFSET)
    const tomorrowE = new Date(Date.UTC(y, mo, day + 1, 23, 59, 59) + CST_OFFSET)
    const weekE = new Date(Date.UTC(y, mo, day + 7, 23, 59, 59) + CST_OFFSET)

    const allFuture = calendar.events
      .filter((e:any) => new Date(e.start) > now)
      .sort((a:any, b:any) => new Date(a.start).getTime() - new Date(b.start).getTime())

    const todayEvs = calendar.events
      .filter((e:any) => {
        const s = new Date(e.start)
        return s >= todayS && s <= todayE
      })
      .sort((a:any,b:any) => new Date(a.start).getTime() - new Date(b.start).getTime())

    const tomorrowEvs = calendar.events
      .filter((e:any) => {
        const s = new Date(e.start)
        return s >= tomorrowS && s <= tomorrowE
      })
      .sort((a:any,b:any) => new Date(a.start).getTime() - new Date(b.start).getTime())

    const weekEvs = calendar.events
      .filter((e:any) => {
        const s = new Date(e.start)
        return s > tomorrowE && s <= weekE
      })
      .sort((a:any,b:any) => new Date(a.start).getTime() - new Date(b.start).getTime())

    const next = todayEvs.find((e:any) => new Date(e.start) > now) || allFuture[0]
    const remainingToday = todayEvs.filter((e:any) => new Date(e.start) > now && !e.allDay).length
    const intensity = todayEvs.length === 0 ? 'free' : todayEvs.length <= 2 ? 'light' : todayEvs.length <= 4 ? 'moderate' : 'heavy'
    const intensityLabel = { free:'Free day', light:'Light schedule', moderate:'Moderate schedule', heavy:'Heavy schedule' }[intensity] as string

    // Focus blocks
    const sortedToday = todayEvs.filter((e:any) => !e.allDay)
    const focusBlocks: string[] = []
    if (sortedToday.length === 0) {
      focusBlocks.push('All day available for deep work')
    } else {
      const workEnd = new Date(todayS); workEnd.setHours(18,0,0,0)
      const workStart = new Date(todayS); workStart.setHours(9,0,0,0)
      let cursor = now > workStart ? new Date(now) : new Date(workStart)
      for (const ev of sortedToday) {
        const evStart = new Date(ev.start)
        if (evStart <= cursor) { cursor = new Date(evStart); cursor.setHours(cursor.getHours()+1); continue }
        const gap = (evStart.getTime() - cursor.getTime()) / 60000
        if (gap >= 90 && cursor < workEnd) {
          const endT = evStart < workEnd ? evStart : workEnd
          focusBlocks.push(`${fmtTime(cursor.toISOString())} – ${fmtTime(endT.toISOString())}`)
        }
        cursor = new Date(evStart); cursor.setHours(cursor.getHours()+1)
      }
      const remaining_time = (workEnd.getTime() - cursor.getTime()) / 60000
      if (remaining_time >= 90 && cursor < workEnd) {
        focusBlocks.push(`${fmtTime(cursor.toISOString())} – 6:00 PM`)
      }
    }

    // Intelligent analysis of each upcoming event
    function analyzeEvent(ev: any): string {
      const t = (ev.summary || '').toLowerCase()
      const loc = (ev.location || '').toLowerCase()
      const s = new Date(ev.start)
      const daysAway = Math.ceil((s.getTime() - now.getTime()) / 86400000)

      if (t.includes('pablo') && t.includes('dan')) return 'Your 1:1 with Dan. Bring updates on priorities and blockers.'
      if (t.includes('dealground') && t.includes('team')) return 'Team sync. Prepare agenda — status, blockers, next actions.'
      if (t.includes('dealground') || t.includes('deal ground')) return 'DealGround business meeting. Prepare deal status and key metrics.'
      if (t.includes('paris') || t.includes('geran') || t.includes('ruthanne')) return 'External stakeholder call. Confirm agenda and prepare talking points.'
      if (t.includes('anthropic') || t.includes('cowork')) return 'Cross-team collaboration session. Note action items.'
      if (t.includes('interview') || t.includes('candidate')) return 'Interview scheduled. Review candidate profile beforehand.'
      if (t.includes('review') || t.includes('planning')) return 'Planning/review session. Prepare structured summary.'
      if (t.includes('demo') || t.includes('presentation')) return 'Demo or presentation. Test setup in advance.'
      if (t.includes('lunch') || t.includes('dinner') || t.includes('coffee')) return 'Relationship meeting. Low agenda, high presence.'
      if (t.includes('call') || t.includes('sync')) return 'Quick sync. Keep tight — confirm agenda beforehand.'
      if (daysAway <= 1) return 'Tomorrow — confirm time and prep materials tonight.'
      if (daysAway <= 3) return `In ${daysAway} days — add to prep list today.`
      return ''
    }

    // Schedule summary
    let summary = ''
    if (intensity === 'free') summary = 'Clear day — optimal for deep work and strategic planning.'
    else if (intensity === 'light') summary = `${todayEvs.length} meeting${todayEvs.length>1?'s':''} today. Strong focus time available.`
    else if (intensity === 'moderate') summary = `${todayEvs.length} meetings today. Protect your focus windows.`
    else summary = `Heavy day — ${todayEvs.length} meetings. Prioritize ruthlessly, delegate where possible.`

    // Tomorrow summary
    const tomorrowSummary = tomorrowEvs.length === 0 ? 'Tomorrow is clear'
      : tomorrowEvs.length <= 2 ? `Light tomorrow — ${tomorrowEvs.length} meeting${tomorrowEvs.length>1?'s':''}`
      : `${tomorrowEvs.length} meetings tomorrow — plan ahead tonight`

    return {
      next, remainingToday, intensity, intensityLabel, summary, tomorrowSummary,
      focusBlocks, todayEvs, tomorrowEvs, weekEvs, allFuture,
      todayS, todayE, analyzeEvent
    }
  })()

  // ── PAYMENTS INTELLIGENCE ──────────────────────
  const payIntel = (() => {
    const all = payments.map(p => ({ ...p, eff: p.recurring ? nextMonth(p.date) : p.date }))
      .filter(p => duDays(p.eff) >= 0)
      .sort((a,b) => new Date(a.eff).getTime() - new Date(b.eff).getTime())
      .slice(0, 8)
    const totalDue = all.filter(p => duDays(p.eff) <= 30).reduce((sum, p) => {
      const v = parseFloat((p.amount||'0').replace(/[$,]/g,''))
      return sum + (isNaN(v) ? 0 : v)
    }, 0)
    const income = parseFloat((finance.i||'0').replace(/[$,]/g,'')) || 0
    const expenses = parseFloat((finance.e||'0').replace(/[$,]/g,'')) || 0
    const free = income - expenses - totalDue
    return { upcoming: all, totalDue, free: free > 0 ? free : 0, income, expenses }
  })()

  // ── PORTFOLIO TOTAL ────────────────────────────
  const portTotal = portData?.data
    ? POSITIONS.reduce((sum,p) => sum + (portData.data[p.t]?.price || p.v) * p.s, 0)
    : null

  // ── regime narrative ───────────────────────────
  const spyQ = marketData?.data?.SPY
  const ionqQ = marketData?.data?.IONQ
  const nvdaQ = marketData?.data?.NVDA
  const qqq = marketData?.data?.QQQ
  const rn = regimeNarrative(spyQ, ionqQ, nvdaQ)

  // ── payments persistence ───────────────────────
  const savePays = (p: any[]) => { setPayments(p); localStorage.setItem('pablo_pays', JSON.stringify(p)) }


  // ── style helpers ──────────────────────────────
  const tagSty = (color: string) => ({ background: color+'20', color, fontSize:7, padding:'1px 5px', borderRadius:20, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.06em', whiteSpace:'nowrap' as const, flexShrink:0 })
  const urgentColor = (days: number) => days < 0 ? '#ff3d5a' : days <= 3 ? '#ff3d5a' : days <= 7 ? '#f09020' : '#00c873'

  // ── OVERVIEW ───────────────────────────────────
  const Overview = () => (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 280px', gridTemplateRows:'1fr 1fr', gap:6, height:'100%', overflow:'hidden' }}>

      {/* TOP LEFT — OPERATIONAL COMMAND (calendar + priorities) */}
      <div style={{ gridColumn:'1/2', display:'flex', flexDirection:'column', gap:6 }}>
        {/* SCHEDULE INTELLIGENCE */}
        <div style={{ background:'var(--s1)', border:'0.5px solid var(--b3)', borderRadius:'var(--radius)', padding:'11px 13px', position:'relative', overflow:'hidden', flex:'1 1 0', minHeight:0 }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${rc.col}80,transparent)`, opacity:.6 }} />
          <div style={{ fontSize:7, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.17em', marginBottom:9, display:'flex', alignItems:'center', gap:5 }}>
            <i className="ti ti-calendar" style={{ fontSize:9, color:rc.col }} />
            Operational schedule
            <button className="ca" style={{ marginLeft:'auto' }} onClick={loadCalendar}><i className="ti ti-refresh" /></button>
          </div>
          {calIntel ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {/* LEFT: Next + Focus + Today */}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {/* Next event */}
                {calIntel.next ? (
                  <div style={{ background:rc.bg, border:`0.5px solid ${rc.border}`, borderRadius:'var(--rs)', padding:'8px 10px' }}>
                    <div style={{ fontSize:7, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:2 }}>
                      {new Date(calIntel.next.start) >= calIntel.todayS && new Date(calIntel.next.start) <= calIntel.todayE ? 'Next today' : 'Next upcoming'}
                    </div>
                    <div style={{ fontSize:12, fontWeight:500, color:'var(--t1)', marginBottom:2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{calIntel.next.summary}</div>
                    <div style={{ fontSize:9, color:rc.col, fontWeight:500 }}>{countdown(calIntel.next.start)}{calIntel.next.location ? ' · '+calIntel.next.location : ''}</div>
                    {calIntel.analyzeEvent(calIntel.next) && (
                      <div style={{ fontSize:8, color:'var(--t2)', marginTop:4, paddingTop:4, borderTop:'0.5px solid var(--b1)', fontStyle:'italic' }}>{calIntel.analyzeEvent(calIntel.next)}</div>
                    )}
                    <div style={{ fontSize:7, color:'var(--t3)', marginTop:4 }}>{calIntel.remainingToday} remaining today · {calIntel.intensityLabel}</div>
                  </div>
                ) : (
                  <div style={{ background:'var(--gd)', border:'0.5px solid #00c87330', borderRadius:'var(--rs)', padding:'8px 10px' }}>
                    <div style={{ fontSize:11, fontWeight:500, color:'#00c873', marginBottom:2 }}>Clear day</div>
                    <div style={{ fontSize:9, color:'var(--t2)' }}>{calIntel.summary}</div>
                  </div>
                )}
                {/* Focus blocks */}
                {calIntel.focusBlocks.length > 0 && (
                  <div>
                    <div style={{ fontSize:7, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>Deep work windows</div>
                    {calIntel.focusBlocks.slice(0,2).map((b,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 0', borderBottom:'0.5px solid var(--b1)' }}>
                        <div style={{ width:2, height:14, background:'#00c87360', borderRadius:2, flexShrink:0 }} />
                        <span style={{ fontSize:9, color:'var(--t2)' }}>{b}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Today summary */}
                <div style={{ fontSize:8, color:'var(--t3)', fontStyle:'italic' }}>{calIntel.summary}</div>
                {calIntel.tomorrowSummary && (
                  <div style={{ fontSize:8, color:'var(--t3)' }}>{calIntel.tomorrowSummary}</div>
                )}
              </div>

              {/* RIGHT: Today events + Upcoming with analysis */}
              <div style={{ overflow:'auto' }}>
                {/* TODAY events */}
                {calIntel.todayEvs.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:7, color:rc.col, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4, fontWeight:600 }}>Today</div>
                    {calIntel.todayEvs.map((ev:any, i:number) => {
                      const isPast = new Date(ev.start) < new Date()
                      const analysis = calIntel.analyzeEvent(ev)
                      return (
                        <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start', padding:'4px 0', borderBottom:'0.5px solid var(--b1)', opacity:isPast?.5:1 }}>
                          <div style={{ width:2, background:isPast?'var(--t4)':rc.col, borderRadius:2, minHeight:isPast?14:20, flexShrink:0, marginTop:2 }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:10, fontWeight:500, color:isPast?'var(--t3)':'var(--t1)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{ev.summary}</div>
                            <div style={{ fontSize:8, color:'var(--t3)' }}>{ev.allDay ? 'All day' : fmtTime(ev.start)}{ev.location?' · '+ev.location:''}</div>
                            {!isPast && analysis && <div style={{ fontSize:8, color:'var(--t2)', fontStyle:'italic', marginTop:1 }}>{analysis}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* TOMORROW */}
                {calIntel.tomorrowEvs.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:7, color:'#4080ff', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4, fontWeight:600 }}>Tomorrow</div>
                    {calIntel.tomorrowEvs.slice(0,3).map((ev:any, i:number) => {
                      const analysis = calIntel.analyzeEvent(ev)
                      return (
                        <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start', padding:'4px 0', borderBottom:'0.5px solid var(--b1)' }}>
                          <div style={{ width:2, background:'#4080ff80', borderRadius:2, minHeight:18, flexShrink:0, marginTop:2 }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:10, fontWeight:500, color:'var(--t1)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{ev.summary}</div>
                            <div style={{ fontSize:8, color:'var(--t3)' }}>{fmtTime(ev.start)}{ev.location?' · '+ev.location:''}</div>
                            {analysis && <div style={{ fontSize:8, color:'var(--t2)', fontStyle:'italic', marginTop:1 }}>{analysis}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* UPCOMING this week */}
                {calIntel.weekEvs.length > 0 && (
                  <div>
                    <div style={{ fontSize:7, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4, fontWeight:600 }}>This week</div>
                    {calIntel.weekEvs.slice(0,4).map((ev:any, i:number) => {
                      const analysis = calIntel.analyzeEvent(ev)
                      return (
                        <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start', padding:'4px 0', borderBottom:'0.5px solid var(--b1)' }}>
                          <div style={{ width:2, background:'var(--t4)', borderRadius:2, minHeight:18, flexShrink:0, marginTop:2 }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:10, fontWeight:500, color:'var(--t1)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{ev.summary}</div>
                            <div style={{ fontSize:8, color:'var(--t3)' }}>{fmtDate(ev.start)} · {ev.allDay?'All day':fmtTime(ev.start)}</div>
                            {analysis && <div style={{ fontSize:8, color:'var(--t2)', fontStyle:'italic', marginTop:1 }}>{analysis}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {calendar?.status === 'cached' && <div style={{ fontSize:7, color:'var(--t3)', marginTop:6, fontStyle:'italic' }}>Confirmed {new Date(calendar.cachedAt||'').toLocaleTimeString()}</div>}
              </div>
            </div>
          ) : (
            <div style={{ fontSize:9, color:'var(--t3)', fontStyle:'italic' }}>
              {calendar?.status === 'setup_required' ? (
                <div style={{background:'var(--ad)',border:'0.5px solid #f0902030',borderRadius:'var(--rs)',padding:'8px 10px'}}>
                  <div style={{fontSize:9,fontWeight:600,color:'var(--a)',marginBottom:3}}>One-time setup needed</div>
                  <div style={{fontSize:8,color:'var(--t2)',lineHeight:1.6}}>
                    1. Open <b>calendar.google.com</b> → Settings ⚙️<br/>
                    2. Click your calendar → "Access permissions"<br/>
                    3. Check ✓ "Make available to public"<br/>
                    4. Click refresh icon above
                  </div>
                </div>
              ) : calendar?.status === 'unavailable' ? 'Calendar temporarily offline · retrying' : 'Loading schedule...'}
            </div>
          )}
        </div>

        {/* EXECUTIVE INTELLIGENCE */}
        <div style={{ background:'var(--s2)', border:'0.5px solid var(--b2)', borderRadius:'var(--radius)', padding:'10px 12px', flex:1, overflow:'auto' }}>
          <div style={{ fontSize:7, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.17em', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
            <i className="ti ti-brain" style={{ fontSize:9, color:rc.col }} />
            What matters right now
            <button className="ca" style={{ marginLeft:'auto' }} onClick={loadIntel}><i className="ti ti-refresh" /></button>
          </div>
          {intel?.items?.length ? intel.items.map((item:any, i:number) => {
            const colors: Record<string,string> = { green:'#00c873', red:'#ff3d5a', amber:'#f09020', blue:'#4080ff', purple:'#8868ff' }
            const col = colors[item.color] || '#4080ff'
            return (
              <div key={i} style={{ display:'flex', gap:7, alignItems:'flex-start', padding:'6px 0', borderBottom:'0.5px solid var(--b1)' }}>
                <div style={{ width:2, background:col, opacity:.8, borderRadius:2, minHeight:22, flexShrink:0, marginTop:2 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:'var(--t1)', lineHeight:1.5 }}>{item.text}</div>
                  {item.context && <div style={{ fontSize:8, color:'var(--t2)', marginTop:2, fontStyle:'italic', lineHeight:1.35 }}>{item.context}</div>}
                </div>
                <span style={{ ...tagSty(col), marginTop:3 }}>{item.tag}</span>
              </div>
            )
          }) : <div style={{ fontSize:9, color:'var(--t3)', fontStyle:'italic' }}>Building intelligence briefing...</div>}
        </div>
      </div>

      {/* TOP CENTER — MACRO INTELLIGENCE + WORLD NEWS */}
      <div style={{ gridColumn:'2/3', display:'flex', flexDirection:'column', gap:6 }}>
        {/* MACRO CONTEXT */}
        <div style={{ background:'var(--s2)', border:'0.5px solid var(--b2)', borderRadius:'var(--radius)', padding:'10px 12px' }}>
          <div style={{ fontSize:7, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.17em', marginBottom:8 }}>Macro context</div>
          {/* Regime headline */}
          <div style={{ background:rc.bg, border:`0.5px solid ${rc.border}`, borderRadius:'var(--rs)', padding:'8px 10px', marginBottom:8 }}>
            <div style={{ fontSize:11, fontWeight:500, color:rc.col, marginBottom:3 }}>{rn.headline}</div>
            <div style={{ fontSize:9, color:'var(--t2)', lineHeight:1.5 }}>{rn.sub}</div>
          </div>
          {/* Key macro indicators — focused on portfolio-relevant signals */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5 }}>
            {[
              { label:'IONQ quantum', sym:'IONQ', data:ionqQ },
              { label:'NVDA AI semis', sym:'NVDA', data:nvdaQ },
              { label:'VTIP inflation hedge', sym:'VTIP', data:portData?.data?.VTIP },
              { label:'SOXX semiconductors', sym:'SOXX', data:marketData?.data?.SOXX },
            ].map(item => {
              const d = item.data
              const price = d?.price
              const change = d?.change
              const up = d?.up
              const col = change !== undefined ? (up ? '#00c873' : '#ff3d5a') : 'var(--t3)'
              return (
                <div key={item.sym} style={{ background:'var(--s3)', borderRadius:'var(--rs)', padding:'6px 8px', border:'0.5px solid var(--b1)' }}>
                  <div style={{ fontSize:7, color:'var(--t3)', marginBottom:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{item.label}</div>
                  <div style={{ fontSize:9, fontWeight:600, color:'var(--t2)' }}>{item.sym}</div>
                  {change !== undefined
                    ? <div style={{ fontSize:10, fontWeight:500, color:col }}>{up?'▲':'▼'} {chgFmt(change)}</div>
                    : <div style={{ fontSize:9, color:'var(--t3)' }}>—</div>
                  }
                  {price && <div style={{ fontSize:8, color:'var(--t3)' }}>${price < 100 ? price.toFixed(2) : Math.round(price).toLocaleString()}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* WORLD INTELLIGENCE */}
        <div style={{ background:'var(--s2)', border:'0.5px solid var(--b2)', borderRadius:'var(--radius)', padding:'10px 12px', flex:1, overflow:'auto' }}>
          <div style={{ fontSize:7, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.17em', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
            <i className="ti ti-world" style={{ fontSize:9 }} />World intelligence<button className="ca" style={{ marginLeft:'auto' }} onClick={loadWorldNews}><i className="ti ti-refresh" /></button>
          </div>
          {worldNews?.articles?.length ? worldNews.articles.slice(0,6).map((a:any, i:number) => {
            const why = whyMatters(a.title)
            const col = a.label === 'geo' ? '#ff3d5a' : a.label === 'macro' ? '#4080ff' : a.label === 'tech' ? '#8868ff' : 'var(--t2)'
            return (
              <div key={i} style={{ display:'flex', gap:7, alignItems:'flex-start', padding:'5px 0', borderBottom:'0.5px solid var(--b1)' }}>
                <div style={{ fontSize:7, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', minWidth:26, paddingTop:1, flexShrink:0 }}>{(a.source||'').slice(0,5)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:10, color:'var(--t1)', lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>{a.title}</div>
                  {why && <div style={{ fontSize:8, color:'var(--t2)', marginTop:2, fontStyle:'italic' }}>{why}</div>}
                  <a href={a.url} target="_blank" rel="noopener" style={{ fontSize:7, color:'#4080ff', opacity:.5 }}>Read →</a>
                </div>
                <span style={{ ...tagSty(col), marginTop:1 }}>{a.label||'intel'}</span>
              </div>
            )
          }) : <div style={{ fontSize:9, color:'var(--t3)', fontStyle:'italic' }}>{worldNews?.status === 'cached' ? `Intelligence feed confirmed ${new Date(worldNews.cachedAt||'').toLocaleTimeString()}` : 'World intelligence stream loading...'}</div>}
        </div>
      </div>

      {/* RIGHT SIDEBAR — compact persistent awareness */}
      <div style={{ gridColumn:'3/4', gridRow:'1/3', overflow:'auto', display:'flex', flexDirection:'column', gap:5 }}>

        {/* PAYMENTS DUE */}
        <div style={{ background:'var(--s2)', border:'0.5px solid var(--b2)', borderRadius:'var(--radius)', padding:'9px 11px', flexShrink:0 }}>
          <div style={{ fontSize:7, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.15em', marginBottom:7, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            Financial obligations
            <button className="sw-ca" onClick={() => setShowPayForm(!showPayForm)}><i className="ti ti-plus" /></button>
          </div>
          {payIntel.upcoming.length > 0 ? payIntel.upcoming.slice(0,5).map((p:any, i:number) => {
            const d = duDays(p.eff)
            const col = urgentColor(d)
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            const dt = new Date(p.eff+'T00:00:00')
            const dtLabel = months[dt.getMonth()]+' '+dt.getDate()
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 0', borderBottom:'0.5px solid var(--b1)' }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:col, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, fontWeight:500, color:'var(--t1)' }}>{p.name}</div>
                  <div style={{ fontSize:8, color:'var(--t3)' }}>{dtLabel}{d === 0 ? ' · today' : d === 1 ? ' · tomorrow' : ` · in ${d}d`}</div>
                </div>
                <div style={{ fontSize:10, fontWeight:600, color:col }}>{p.amount||'—'}</div>
                <button onClick={() => savePays(payments.filter((_,idx)=>idx!==p.i))} style={{ background:'none', border:'none', color:'var(--t4)', fontSize:9, padding:0 }}><i className="ti ti-x" /></button>
              </div>
            )
          }) : <div style={{ fontSize:9, color:'var(--t3)', fontStyle:'italic' }}>No obligations tracked yet</div>}
          {payIntel.upcoming.length > 0 && payIntel.income > 0 && (
            <div style={{ marginTop:7, paddingTop:7, borderTop:'0.5px solid var(--b2)' }}>
              <div style={{ fontSize:8, color:'var(--t3)', marginBottom:2 }}>Projected free cash this month</div>
              <div style={{ fontSize:14, fontWeight:300, color: payIntel.free > 0 ? '#00c873' : '#ff3d5a' }}>{fmt(payIntel.free)}</div>
              <div style={{ fontSize:7, color:'var(--t3)', marginTop:1 }}>after income – expenses – obligations</div>
            </div>
          )}
          {showPayForm && (
            <PayForm onAdd={(p) => { savePays([...payments, p]); setShowPayForm(false) }} />
          )}
        </div>

        {/* MARKET INTELLIGENCE */}
        <div style={{ background:'var(--s2)', border:'0.5px solid var(--b2)', borderRadius:'var(--radius)', padding:'9px 11px', flexShrink:0 }}>
          <div style={{ fontSize:7, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.15em', marginBottom:7, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            Market intelligence<button className="sw-ca" onClick={loadMktNews}><i className="ti ti-refresh" /></button>
          </div>
          {mktNews?.articles?.slice(0,4).map((a:any, i:number) => {
            const col = a.sentiment === 'bullish' ? '#00c873' : a.sentiment === 'bearish' ? '#ff3d5a' : 'var(--t3)'
            return (
              <div key={i} style={{ padding:'5px 0', borderBottom:'0.5px solid var(--b1)' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:5, marginBottom:2 }}>
                  <div style={{ flex:1, fontSize:9, color:'var(--t1)', lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>{a.title}</div>
                  <span style={{ ...tagSty(col) }}>{a.sentiment||'neu'}</span>
                </div>
                {a.context && <div style={{ fontSize:8, color:'var(--t2)', fontStyle:'italic', lineHeight:1.3 }}>{a.context}</div>}
              </div>
            )
          }) || <div style={{ fontSize:9, color:'var(--t3)', fontStyle:'italic' }}>Loading market intelligence...</div>}
        </div>

        {/* BTC + ETH */}


        {/* PORTFOLIO SNAPSHOT */}
        <div style={{ background:'var(--s2)', border:'0.5px solid var(--b2)', borderRadius:'var(--radius)', padding:'9px 11px', flexShrink:0 }}>
          <div style={{ fontSize:7, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.15em', marginBottom:6, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            Portfolio<button className="sw-ca" onClick={loadPortfolio}><i className="ti ti-refresh" /></button>
          </div>
          {portTotal && <div style={{ fontSize:16, fontWeight:300, color:'var(--t1)', marginBottom:6 }}>{fmt(portTotal)}</div>}
          {portData?.data ? POSITIONS.slice(0,6).map(p => {
            const r = portData.data[p.t]
            const col = r?.price ? (r.up ? '#00c873' : '#ff3d5a') : 'var(--t3)'
            return (
              <div key={p.t} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'3px 0', borderBottom:'0.5px solid var(--b1)' }}>
                <span style={{ fontSize:8, fontWeight:600, color:'var(--t2)' }}>{p.t}</span>
                <span style={{ fontSize:9, fontWeight:500, color:col, fontVariantNumeric:'tabular-nums' }}>{r?.price ? chgFmt(r.change) : '—'}</span>
              </div>
            )
          }) : <div style={{ fontSize:9, color:'var(--t3)', fontStyle:'italic' }}>Portfolio data loading...</div>}
          {portData?.status === 'cached' && <div style={{ fontSize:7, color:'var(--t3)', marginTop:4, fontStyle:'italic' }}>Confirmed {new Date(portData.cachedAt||'').toLocaleTimeString()}</div>}
        </div>

        {/* WEATHER */}
        <div style={{ background:'var(--s2)', border:'0.5px solid var(--b2)', borderRadius:'var(--radius)', padding:'9px 11px', flexShrink:0 }}>
          <div style={{ fontSize:7, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.15em', marginBottom:6 }}>Weather · MTY</div>
          {weather ? (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <div style={{ fontSize:20, fontWeight:300 }}>{Math.round(weather.current.temperature_2m)}°F</div>
                <div><div style={{ fontSize:10, color:'var(--t1)' }}>{WX_LABELS[weather.current.weathercode]||'Clear'}</div><div style={{ fontSize:7, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.08em' }}>Monterrey, NL</div></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:2, paddingTop:5, borderTop:'0.5px solid var(--b1)' }}>
                {weather.daily.time.map((t:string, i:number) => (
                  <div key={i} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:7, color:'var(--t3)' }}>{['Su','Mo','Tu','We','Th','Fr','Sa'][new Date(t+'T12:00:00').getDay()]}</div>
                    <div style={{ fontSize:11 }}>{WX_ICONS[weather.daily.weathercode[i]]||'🌡'}</div>
                    <div style={{ fontSize:9, fontWeight:500, color:'var(--t1)' }}>{Math.round(weather.daily.temperature_2m_max[i])}°</div>
                    <div style={{ fontSize:7, color:'#4080ff' }}>{weather.daily.precipitation_probability_max[i]}%</div>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ fontSize:9, color:'var(--t3)', fontStyle:'italic' }}>Weather loading...</div>}
        </div>

      </div>

      {/* BOTTOM — WEEK AHEAD + MARKET MOVERS combined full width */}
      <div style={{ gridColumn:'1/3', background:'var(--s2)', border:'0.5px solid var(--b2)', borderRadius:'var(--radius)', padding:'10px 12px', overflow:'hidden', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div style={{ overflow:'auto' }}>
          <div style={{ fontSize:7, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.17em', marginBottom:7, display:'flex', alignItems:'center', gap:5 }}>
            <i className="ti ti-calendar-week" style={{ fontSize:9 }} />Week ahead
          </div>
          {calIntel?.weekEvs?.length ? calIntel.weekEvs.slice(0,5).map((ev:any, i:number) => (
            <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start', padding:'4px 0', borderBottom:'0.5px solid var(--b1)' }}>
              <div style={{ width:2, background:'#4080ff60', borderRadius:2, minHeight:18, flexShrink:0, marginTop:2 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:10, fontWeight:500, color:'var(--t1)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{ev.summary}</div>
                <div style={{ fontSize:8, color:'var(--t3)' }}>{fmtDate(ev.start)} · {ev.allDay ? 'All day' : fmtTime(ev.start)}</div>
              </div>
            </div>
          )) : <div style={{ fontSize:9, color:'var(--t3)', fontStyle:'italic' }}>{calIntel ? 'No upcoming events this week' : calendar?.status === 'setup_required' ? 'Enable public access in Google Calendar settings' : 'Calendar loading...'}</div>}
        </div>
        <div>
          <div style={{ fontSize:7, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.17em', marginBottom:7, display:'flex', alignItems:'center', gap:5 }}>
            <i className="ti ti-chart-line" style={{ fontSize:9 }} />Market movers<button className="ca" style={{ marginLeft:'auto' }} onClick={loadMarket}><i className="ti ti-refresh" /></button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4 }}>
            {['SPY','QQQ','NVDA','IONQ','SOXX','PLTR','TSLA','AMD'].map(sym => {
              const r = marketData?.data?.[sym]
              const col = r?.price ? (r.up ? '#00c873' : '#ff3d5a') : 'var(--t3)'
              return (
                <div key={sym} style={{ background:'var(--s3)', borderRadius:'var(--rs)', padding:'5px 7px', border:'0.5px solid var(--b1)' }}>
                  <div style={{ fontSize:8, fontWeight:600, color:'var(--t2)' }}>{sym}</div>
                  {r?.price ? <><div style={{ fontSize:10, fontWeight:500, color:col }}>{r.up?'▲':'▼'} {chgFmt(r.change)}</div><div style={{ fontSize:8, color:'var(--t3)' }}>${r.price<100?r.price.toFixed(2):Math.round(r.price).toLocaleString()}</div></> : <div style={{ fontSize:9, color:'var(--t3)' }}>—</div>}
                </div>
              )
            })}
          </div>
          {marketData?.status === 'cached' && <div style={{ fontSize:7, color:'var(--t3)', marginTop:5, fontStyle:'italic' }}>Last confirmed {new Date(marketData.cachedAt||'').toLocaleTimeString()}</div>}
        </div>
      </div>
    </div>
  )

  // ── LIFESTYLE DATA ─────────────────────────────
  const allEv = [
    {c:'var(--p)',tag:'Music · Spanish Rock',name:'Caifanes',date:'May 29 & 30',loc:'Auditorio Nacional, CDMX',fomo:'This weekend',fc:'var(--r)'},
    {c:'var(--p)',tag:'Music · Spanish Rock',name:'Caifanes',date:'Oct 17, 2026',loc:'Auditorio Telmex, GDL',fomo:'Plan ahead',fc:'var(--a)'},
    {c:'var(--p)',tag:'Music · Regional MX',name:'Carín León',date:'2026 MTY TBC',loc:'Monterrey',fomo:'Track drop',fc:'var(--b)'},
    {c:'var(--p)',tag:'Tiny Desk',name:'NPR Tiny Desk',date:'Weekly',loc:'YouTube · NPR',fomo:'Never miss',fc:'var(--g)'},
    {c:'var(--r)',tag:'Toros · EMSA',name:'Corrida EMSA',date:'Oct 2026',loc:'Plaza Lorenzo Garza, MTY',fomo:'emsa.mx',fc:'var(--a)'},
    {c:'var(--g)',tag:'FIFA · World Cup',name:'4 matches — MTY',date:'Summer 2026',loc:'Estadio BBVA',fomo:'Historic',fc:'var(--r)'},
    {c:'var(--p)',tag:'Rock en Español',name:'Zoé + Soda Stereo',date:'TBC',loc:'Mexico',fomo:'Track',fc:'var(--b)'},
    {c:'var(--b)',tag:'Business',name:'Collision / Forbes U30',date:'Mid-late 2026',loc:'North America',fomo:'Track',fc:'var(--b)'},
  ]
  const allXP = [
    {tc:'var(--a)',tag:'Adventure · Texas',name:'Helicopter Hog Hunting',loc:'HeliBacon, College Station TX',why:'AR-15s from Bell 212. Year-round. 4hrs from MTY. No license needed.'},
    {tc:'var(--a)',tag:'Adventure · Texas',name:'Blackhawk Hog Hunt',loc:'Executive Outdoor Adventures',why:'UH-60 Blackhawk. 1.3M acres. Most elite version.'},
    {tc:'var(--b)',tag:'Outdoors · Mexico',name:'Spearfishing — Sea of Cortez',loc:'La Paz / Cozumel',why:'Best in Latin America. Yellowfin tuna, grouper. Year-round.'},
    {tc:'var(--g)',tag:'Fitness · Global',name:'HYROX Race',loc:'Houston fall 2026 / MTY 2027',why:'8x1km + functional workouts. Global leaderboard.'},
    {tc:'var(--b)',tag:'Outdoors · Baja',name:'Yellowfin Tuna Fishing',loc:'Cabo / La Paz',why:'Peak July–Nov. 30-50lb fish. 90min from MTY.'},
    {tc:'var(--r)',tag:'Motorsport · Track Day',name:'Supercar Track Day',loc:'Autódromo MTY / CDMX',why:'Lambo or Ferrari on a real track. Private days available.'},
    {tc:'var(--g)',tag:'Adventure · International',name:'Private Game Reserve Safari',loc:'South Africa / Kenya',why:'Fly-in camps. No crowds. Few people your age have done this.'},
    {tc:'var(--b)',tag:'Outdoors · Yucatán',name:'Cave Diving — Cenotes',loc:'Tulum, Mexico',why:"World's longest underwater cave. Guided intro dives."},
  ]

  const NAV = [
    {id:'ov',icon:'ti-layout-dashboard',label:'Overview'},
    {id:'mkt',icon:'ti-chart-line',label:'Markets'},
    {id:'port',icon:'ti-briefcase',label:'Portfolio'},
    {id:'intel-page',icon:'ti-brain',label:'Intelligence'},
    {id:'cal',icon:'ti-calendar',label:'Calendar'},
    null,
    {id:'fin',icon:'ti-wallet',label:'Finance'},
    {id:'world',icon:'ti-world',label:'World'},
    {id:'life',icon:'ti-compass',label:'Lifestyle'},
  ]

  return (
    <>
      {/* TOP BAR */}
      <div className="topbar">
        <div className="tb-brand">Pablo OS</div>
        <div className="tb-clk" id="pablo-clock">--:--:--</div>
        <div className="tb-dt" id="pablo-date"></div>
        <div className="tb-tix">
          {[
            ['Portfolio', portTotal ? fmt(portTotal) : '--'],
            ['SPY', spyQ ? chgFmt(spyQ.change) : '--'],
            ['QQQ', qqq ? chgFmt(qqq.change) : '--'],
            ['NVDA', nvdaQ ? chgFmt(nvdaQ.change) : '--'],
            ['IONQ', ionqQ ? chgFmt(ionqQ.change) : '--'],
          ].map(([label, val]) => {
            const isChg = val !== '--' && val.includes('%')
            const color = !isChg ? 'var(--t1)' : val.startsWith('+') ? '#00c873' : '#ff3d5a'
            return <div key={label} className="tbt"><div className="tbt-l">{label}</div><div className="tbt-v" style={{color}}>{val}</div></div>
          })}
        </div>
        <div className="tb-r">
          <div className="ldot" />
          <div className="rpill" style={{color:rc.col,background:rc.bg,borderColor:rc.border}}>{rc.label}</div>
          <div style={{fontSize:7,color:'var(--t3)'}}>{weather?`MTY ${Math.round(weather.current.temperature_2m)}°F`:'MTY --°F'}</div>
        </div>
      </div>

      <div className="os">
        {/* NAV */}
        <nav className="nav">
          {NAV.map((p,i) => p === null
            ? <div key={i} className="nsep" />
            : <button key={p.id} className={`nb${page===p.id?' on':''}`} onClick={()=>setPage(p.id)}>
                <i className={`ti ${p.icon} ni`} /><span className="nl">{p.label}</span>
              </button>
          )}
          <div className="nsep" style={{marginTop:'auto'}} />
          <button className="nb" onClick={refreshAll}><i className="ti ti-refresh ni" /><span className="nl">Refresh all</span></button>
        </nav>

        <main className="main">
          {/* OVERVIEW */}
          {page === 'ov' && <div className="page on" style={{padding:8}}><Overview /></div>}

          {/* MARKETS */}
          {page === 'mkt' && (
            <div className="page on" style={{padding:8}}>
              <div style={{fontSize:7,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.17em',marginBottom:8}}>Market movers — contextual view</div>
              {/* Regime context first */}
              <div style={{background:rc.bg,border:`0.5px solid ${rc.border}`,borderRadius:'var(--radius)',padding:'10px 12px',marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:500,color:rc.col,marginBottom:3}}>{rn.headline}</div>
                <div style={{fontSize:9,color:'var(--t2)',lineHeight:1.5}}>{rn.sub}</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:5,marginBottom:8}}>
                {['SPY','QQQ','NVDA','IONQ','SOXX','PLTR','RGTI','TSLA','AMD','MSTR','MU','MCHP'].map(sym => {
                  const r = marketData?.data?.[sym]
                  const col = r?.price ? (r.up ? '#00c873' : '#ff3d5a') : 'var(--t3)'
                  return (
                    <div key={sym} style={{background:'var(--s3)',borderRadius:'var(--rs)',padding:'7px 9px',border:'0.5px solid var(--b2)'}}>
                      <div style={{fontSize:8,fontWeight:600,color:'var(--t2)',marginBottom:2}}>{sym}</div>
                      {r?.price
                        ? <><div style={{fontSize:11,fontWeight:500,color:col}}>{r.up?'▲':'▼'} {chgFmt(r.change)}</div><div style={{fontSize:8,color:'var(--t3)'}}>${r.price<100?r.price.toFixed(2):Math.round(r.price).toLocaleString()}</div></>
                        : <div style={{fontSize:9,color:'var(--t3)'}}>—</div>
                      }
                    </div>
                  )
                })}
              </div>
              {marketData?.status !== 'live' && <div style={{fontSize:8,color:'var(--t3)',fontStyle:'italic'}}>{marketData?.status === 'cached' ? `Using confirmed market structure from ${new Date(marketData.cachedAt||'').toLocaleTimeString()} · live feed reconnecting` : 'Live market data temporarily unavailable'}</div>}
            </div>
          )}

          {/* PORTFOLIO */}
          {page === 'port' && (
            <div className="page on" style={{padding:8}}>
              <div style={{fontSize:7,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.17em',marginBottom:8}}>Holdings</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(9,1fr)',gap:4,marginBottom:8}}>
                {POSITIONS.map(p => {
                  const r = portData?.data?.[p.t]
                  const cls = r?.price ? (r.up ? 'ptile up' : 'ptile dn') : 'ptile nt'
                  const col = r?.price ? (r.up ? '#00c873' : '#ff3d5a') : 'var(--t3)'
                  return <div key={p.t} className={cls}><div className="pt-s">{p.t}</div><div className="pt-c" style={{color:col}}>{r?.price ? chgFmt(r.change) : '—'}</div><div className="pt-v">${Math.round(r?.price||p.v)}</div></div>
                })}
              </div>
              {portTotal && <div style={{fontSize:18,fontWeight:300,marginBottom:8}}>Total: {fmt(portTotal)} <span style={{fontSize:9,color:'var(--t3)'}}>9 positions · long-term</span></div>}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5}}>
                {[['US equity','68%','#00c873'],['International','18%','#4080ff'],['Inflation hedge','5%','#f09020'],['Speculative','9%','#8868ff']].map(([l,v,c]) => (
                  <div key={l} style={{background:'var(--s3)',borderRadius:'var(--rs)',padding:'8px 10px',border:'0.5px solid var(--b1)'}}><div style={{fontSize:7,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:3}}>{l}</div><div style={{fontSize:13,fontWeight:400,color:c as string}}>{v}</div><div style={{height:2,borderRadius:1,background:'var(--s4)',overflow:'hidden',marginTop:3}}><div style={{height:'100%',width:v as string,background:c as string,borderRadius:1}}/></div></div>
                ))}
              </div>
            </div>
          )}

          {/* INTELLIGENCE */}
          {page === 'intel-page' && (
            <div className="page on" style={{padding:8}}>
              <div className="g2" style={{marginBottom:6}}>
                <div className="card"><div className="ch"><span className="ch-t">Market intelligence</span><button className="ca" onClick={loadMktNews}><i className="ti ti-refresh" /></button></div>
                  {mktNews?.articles?.map((a:any,i:number) => (
                    <div key={i} style={{padding:'6px 0',borderBottom:'0.5px solid var(--b1)'}}>
                      <div style={{display:'flex',gap:6,alignItems:'flex-start',marginBottom:2}}>
                        <div style={{fontSize:7,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',minWidth:26,flexShrink:0}}>{(a.source||'').slice(0,5)}</div>
                        <div style={{fontSize:10,color:'var(--t1)',lineHeight:1.4,flex:1}}>{a.title}</div>
                        <span style={{...tagSty(a.sentiment==='bullish'?'#00c873':a.sentiment==='bearish'?'#ff3d5a':'var(--t3)')}}>{a.sentiment||'neu'}</span>
                      </div>
                      {a.context && <div style={{fontSize:8,color:'var(--t2)',fontStyle:'italic',lineHeight:1.3,paddingLeft:32}}>{a.context}</div>}
                    </div>
                  ))||<div style={{fontSize:9,color:'var(--t3)',fontStyle:'italic'}}>Loading...</div>}
                </div>
                <div className="card"><div className="ch"><span className="ch-t">World intelligence</span><button className="ca" onClick={loadWorldNews}><i className="ti ti-refresh" /></button></div>
                  {worldNews?.articles?.map((a:any,i:number) => {
                    const why = whyMatters(a.title)
                    const col = a.label === 'geo' ? '#ff3d5a' : a.label === 'macro' ? '#4080ff' : '#8868ff'
                    return (
                      <div key={i} style={{padding:'6px 0',borderBottom:'0.5px solid var(--b1)'}}>
                        <div style={{display:'flex',gap:6,alignItems:'flex-start',marginBottom:2}}>
                          <div style={{fontSize:7,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',minWidth:26,flexShrink:0}}>{(a.source||'').slice(0,5)}</div>
                          <div style={{fontSize:10,color:'var(--t1)',lineHeight:1.4,flex:1}}>{a.title}</div>
                          <span style={{...tagSty(col)}}>{a.label||'intel'}</span>
                        </div>
                        {why && <div style={{fontSize:8,color:'var(--t2)',fontStyle:'italic',lineHeight:1.3,paddingLeft:32}}>{why}</div>}
                        <a href={a.url} target="_blank" rel="noopener" style={{fontSize:7,color:'#4080ff',opacity:.5,paddingLeft:32,display:'block'}}>Read →</a>
                      </div>
                    )
                  })||<div style={{fontSize:9,color:'var(--t3)',fontStyle:'italic'}}>Loading...</div>}
                </div>
              </div>
            </div>
          )}

          {/* CALENDAR */}
          {page === 'cal' && (
            <div className="page on" style={{padding:8}}>
              <div className="g2" style={{marginBottom:8}}>
                <div className="card">
                  <div className="ch"><span className="ch-t">Operational agenda</span><button className="ca" onClick={loadCalendar}><i className="ti ti-refresh" /></button></div>
                  {calIntel ? (
                    <div>
                      {calIntel.next && (
                        <div style={{background:rc.bg,border:`0.5px solid ${rc.border}`,borderRadius:'var(--rs)',padding:'8px 10px',marginBottom:8}}>
                          <div style={{fontSize:7,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:2}}>Next</div>
                          <div style={{fontSize:12,fontWeight:500,color:'var(--t1)',marginBottom:2}}>{calIntel.next.summary}</div>
                          <div style={{fontSize:9,color:'var(--t2)'}}>{countdown(calIntel.next.start)}{calIntel.next.location?' · '+calIntel.next.location:''}</div>
                          <div style={{fontSize:7,color:'var(--t3)',marginTop:5,paddingTop:5,borderTop:'0.5px solid var(--b1)'}}>{calIntel.remainingToday} remaining · {calIntel.summary}</div>
                        </div>
                      )}
                      {calIntel.allFuture.slice(0,10).map((ev:any,i:number) => {
                        const isT = new Date(ev.start) >= calIntel.todayS && new Date(ev.start) < calIntel.todayE
                        return (
                          <div key={i} style={{display:'flex',gap:7,alignItems:'flex-start',padding:'5px 0',borderBottom:'0.5px solid var(--b1)'}}>
                            <div style={{width:2,background:isT?rc.col:'#4080ff',borderRadius:2,minHeight:20,flexShrink:0,marginTop:2}} />
                            <div style={{flex:1}}>
                              <div style={{fontSize:10,fontWeight:500,color:'var(--t1)'}}>{ev.summary}</div>
                              <div style={{fontSize:8,color:'var(--t3)'}}>{ev.allDay?'All day':fmtTime(ev.start)}{ev.location?' · '+ev.location:''}</div>
                            </div>
                            {isT ? <span style={{...tagSty('#00c873')}}>today</span> : <span style={{fontSize:7,color:'var(--t3)',whiteSpace:'nowrap'}}>{fmtDate(ev.start)}</span>}
                          </div>
                        )
                      })}
                    </div>
                  ) : <div style={{fontSize:9,color:'var(--t3)',fontStyle:'italic'}}>{calendar?.status==='unavailable'?'Calendar feed offline':'Loading calendar...'}</div>}
                </div>
                <div className="card">
                  <div className="ch"><span className="ch-t">Payments</span><button className="ca" onClick={()=>setShowPayForm(!showPayForm)}><i className="ti ti-plus" /></button></div>
                  {payIntel.upcoming.map((p:any,i:number) => {
                    const d = duDays(p.eff); const col = urgentColor(d)
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    const dt = new Date(p.eff+'T00:00:00')
                    return (
                      <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 0',borderBottom:'0.5px solid var(--b1)'}}>
                        <div style={{fontSize:8,color:'var(--t3)',minWidth:42}}>{months[dt.getMonth()]} {dt.getDate()}</div>
                        <div style={{flex:1,fontSize:10,fontWeight:500,color:'var(--t1)'}}>{p.name}</div>
                        <div style={{fontSize:11,fontWeight:600,color:col}}>{p.amount||'—'}</div>
                        <button onClick={()=>savePays(payments.filter((_,idx)=>idx!==p.i))} style={{background:'none',border:'none',color:'var(--t4)',fontSize:9,padding:0}}><i className="ti ti-x" /></button>
                      </div>
                    )
                  })}
                  {payIntel.income > 0 && (
                    <div style={{marginTop:8,paddingTop:8,borderTop:'0.5px solid var(--b2)'}}>
                      <div style={{fontSize:8,color:'var(--t3)',marginBottom:3}}>Projected free cash</div>
                      <div style={{fontSize:16,fontWeight:300,color:payIntel.free>0?'#00c873':'#ff3d5a'}}>{fmt(payIntel.free)}</div>
                    </div>
                  )}
                  {showPayForm && <PayForm onAdd={(p) => { savePays([...payments, p]); setShowPayForm(false) }} />}
                </div>
              </div>
              <div style={{fontSize:7,fontWeight:600,color:'var(--t4)',textTransform:'uppercase',letterSpacing:'.18em',marginBottom:6}}>Full calendar</div>
              <div className="card"><iframe src="https://calendar.google.com/calendar/embed?src=pablo%40dealground.com&ctz=America%2FTijuana&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&mode=WEEK&bgcolor=%2305050a&color=%2300c873" style={{width:'100%',height:360,border:'none',borderRadius:3}} title="Calendar" /></div>
            </div>
          )}

          {/* FINANCE */}
          {page === 'fin' && (
            <div className="page on" style={{padding:8}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,marginBottom:8}}>
                {[['Income',finance.i||'—'],['Expenses',finance.e||'—'],['Portfolio',portTotal?fmt(portTotal):'--'],['Portfolio',portTotal?fmt(portTotal):'--']].map(([l,v]) => (
                  <div key={l} style={{background:'var(--s3)',borderRadius:'var(--rs)',padding:'8px 10px',border:'0.5px solid var(--b1)'}}><div style={{fontSize:7,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:3}}>{l}</div><div style={{fontSize:15,fontWeight:300,color:'var(--t1)'}}>{v}</div></div>
                ))}
              </div>
              <div className="g2">
                <div className="card"><div className="ch"><span className="ch-t">Update financials</span></div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                    <input placeholder="Monthly income" value={finance.i||''} onChange={e=>setFinance({...finance,i:e.target.value})} />
                    <input placeholder="Monthly expenses" value={finance.e||''} onChange={e=>setFinance({...finance,e:e.target.value})} />
                                    <button className="fbtn" style={{gridColumn:'1/-1'}} onClick={()=>localStorage.setItem('pablo_fin',JSON.stringify(finance))}>Save</button>
                  </div>
                  <div style={{fontSize:7,color:'var(--t3)',marginTop:5}}><i className="ti ti-lock" style={{fontSize:7,marginRight:2}} />Stored locally</div>
                </div>
                <div className="card"><div className="ch"><span className="ch-t">Upcoming obligations</span><button className="ca" onClick={()=>setShowPayForm(!showPayForm)}><i className="ti ti-plus" /></button></div>
                  {payIntel.upcoming.map((p:any,i:number) => {
                    const d = duDays(p.eff); const col = urgentColor(d)
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    const dt = new Date(p.eff+'T00:00:00')
                    return <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderBottom:'0.5px solid var(--b1)'}}><div style={{fontSize:8,color:'var(--t3)',minWidth:42}}>{months[dt.getMonth()]} {dt.getDate()}</div><div style={{flex:1,fontSize:10,fontWeight:500,color:'var(--t1)'}}>{p.name}</div><div style={{fontSize:11,fontWeight:600,color:col}}>{p.amount}</div><button onClick={()=>savePays(payments.filter((_,idx)=>idx!==p.i))} style={{background:'none',border:'none',color:'var(--t4)',fontSize:9,padding:0}}><i className="ti ti-x" /></button></div>
                  })}
                  {payIntel.income > 0 && <div style={{marginTop:8,paddingTop:8,borderTop:'0.5px solid var(--b2)'}}><div style={{fontSize:8,color:'var(--t3)',marginBottom:2}}>Projected free cash</div><div style={{fontSize:16,fontWeight:300,color:payIntel.free>0?'#00c873':'#ff3d5a'}}>{fmt(payIntel.free)}</div></div>}
                  {showPayForm && <PayForm onAdd={(p) => { savePays([...payments, p]); setShowPayForm(false) }} />}
                </div>
              </div>
            </div>
          )}

          {/* WORLD */}
          {page === 'world' && (
            <div className="page on" style={{padding:8}}>
              <div className="g2">
                <div className="card"><div className="ch"><span className="ch-t">World intelligence — high signal</span><button className="ca" onClick={loadWorldNews}><i className="ti ti-refresh" /></button></div>
                  {worldNews?.articles?.map((a:any,i:number) => {
                    const why = whyMatters(a.title); const col = a.label==='geo'?'#ff3d5a':a.label==='macro'?'#4080ff':'#8868ff'
                    return <div key={i} style={{padding:'6px 0',borderBottom:'0.5px solid var(--b1)'}}><div style={{display:'flex',gap:6,alignItems:'flex-start',marginBottom:2}}><div style={{fontSize:7,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',minWidth:26,flexShrink:0}}>{(a.source||'').slice(0,5)}</div><div style={{fontSize:10,color:'var(--t1)',lineHeight:1.4,flex:1}}>{a.title}</div><span style={{...tagSty(col)}}>{a.label||'intel'}</span></div>{why&&<div style={{fontSize:8,color:'var(--t2)',fontStyle:'italic',paddingLeft:32}}>{why}</div>}<a href={a.url} target="_blank" rel="noopener" style={{fontSize:7,color:'#4080ff',opacity:.5,paddingLeft:32,display:'block'}}>Read →</a></div>
                  })||<div style={{fontSize:9,color:'var(--t3)',fontStyle:'italic'}}>Loading world intelligence...</div>}
                </div>
                <div className="card"><div className="ch"><span className="ch-t">Market intelligence</span><button className="ca" onClick={loadMktNews}><i className="ti ti-refresh" /></button></div>
                  {mktNews?.articles?.map((a:any,i:number) => {
                    const col = a.sentiment==='bullish'?'#00c873':a.sentiment==='bearish'?'#ff3d5a':'var(--t3)'
                    return <div key={i} style={{padding:'6px 0',borderBottom:'0.5px solid var(--b1)'}}><div style={{display:'flex',gap:6,alignItems:'flex-start',marginBottom:2}}><div style={{fontSize:7,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',minWidth:26,flexShrink:0}}>{(a.source||'').slice(0,5)}</div><div style={{fontSize:10,color:'var(--t1)',lineHeight:1.4,flex:1}}>{a.title}</div><span style={{...tagSty(col)}}>{a.sentiment||'neu'}</span></div>{a.context&&<div style={{fontSize:8,color:'var(--t2)',fontStyle:'italic',paddingLeft:32}}>{a.context}</div>}</div>
                  })||<div style={{fontSize:9,color:'var(--t3)',fontStyle:'italic'}}>Loading...</div>}
                </div>
              </div>
            </div>
          )}

          {/* LIFESTYLE */}
          {page === 'life' && (
            <div className="page on" style={{padding:8}}>
              <div style={{fontSize:7,fontWeight:600,color:'var(--t4)',textTransform:'uppercase',letterSpacing:'.18em',marginBottom:6}}>Events & experiences</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,marginBottom:8}}>
                {allEv.map((e,i) => <div key={i} style={{borderRadius:'var(--rs)',padding:'8px 10px',border:`0.5px solid ${e.c}25`,background:e.c+'10'}}><div style={{fontSize:7,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',color:e.c,marginBottom:3}}>{e.tag}</div><div style={{fontSize:10,fontWeight:500,color:'var(--t1)',marginBottom:2}}>{e.name}</div><div style={{fontSize:8,color:'var(--t3)'}}>{e.date} · {e.loc}</div><span style={{...tagSty(e.fc as string),display:'inline-block',marginTop:4}}>{e.fomo}</span></div>)}
              </div>
              <div style={{fontSize:7,fontWeight:600,color:'var(--t4)',textTransform:'uppercase',letterSpacing:'.18em',marginBottom:6}}>Niche experiences</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5}}>
                {allXP.map((x,i) => <div key={i} style={{borderRadius:'var(--rs)',padding:'8px 10px',border:'0.5px solid var(--b2)',background:'var(--s2)'}}><div style={{fontSize:7,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',color:x.tc,marginBottom:2}}>{x.tag}</div><div style={{fontSize:10,fontWeight:500,color:'var(--t1)',marginBottom:2}}>{x.name}</div><div style={{fontSize:7,color:'var(--t3)',marginBottom:2}}>{x.loc}</div><div style={{fontSize:8,color:'var(--t2)',lineHeight:1.4}}>{x.why}</div></div>)}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
