'use client'
import { useEffect, useState, useCallback, useRef } from 'react'

// ── Color helpers ──────────────────────────────────
const REGIME_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'risk-on':      { label: '▲ Risk-on',      color: '#00c873', bg: '#00c87320', border: '#00c87340' },
  'risk-off':     { label: '▼ Risk-off',      color: '#ff3d5a', bg: '#ff3d5a20', border: '#ff3d5a40' },
  'neutral':      { label: '● Neutral',       color: '#4080ff', bg: '#4080ff20', border: '#4080ff40' },
  'ai-momentum':  { label: '◆ AI Momentum',   color: '#8868ff', bg: '#8868ff20', border: '#8868ff40' },
}
const TAG_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  'market':    { bg: '#4080ff20', text: '#4080ff', bar: '#4080ff' },
  'risk-on':   { bg: '#00c87320', text: '#00c873', bar: '#00c873' },
  'risk-off':  { bg: '#ff3d5a20', text: '#ff3d5a', bar: '#ff3d5a' },
  'neutral':   { bg: '#f0902020', text: '#f09020', bar: '#f09020' },
  'fomo':      { bg: '#8868ff20', text: '#8868ff', bar: '#8868ff' },
  'event':     { bg: '#8868ff20', text: '#8868ff', bar: '#8868ff' },
  'semis':     { bg: '#f0902020', text: '#f09020', bar: '#f09020' },
  'portfolio': { bg: '#00c87320', text: '#00c873', bar: '#00c873' },
  'crypto':    { bg: '#f0902020', text: '#f09020', bar: '#f09020' },
  'meeting':   { bg: '#4080ff20', text: '#4080ff', bar: '#4080ff' },
  'agenda':    { bg: '#4080ff20', text: '#4080ff', bar: '#4080ff' },
  'session':   { bg: '#f0902020', text: '#f09020', bar: '#f09020' },
  'system':    { bg: '#4080ff20', text: '#4080ff', bar: '#4080ff' },
  'alert':     { bg: '#ff3d5a20', text: '#ff3d5a', bar: '#ff3d5a' },
}
const COLOR_MAP: Record<string, string> = {
  green: '#00c873', red: '#ff3d5a', amber: '#f09020', blue: '#4080ff', purple: '#8868ff'
}
const fmt = (v: number) => '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
const chgFmt = (c: number) => (c >= 0 ? '+' : '') + c.toFixed(2) + '%'
const WX_ICONS: Record<number, string> = { 0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️', 45: '🌫', 61: '🌧', 80: '🌦', 95: '⛈' }
const WX_LABELS: Record<number, string> = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Foggy', 61: 'Rain', 80: 'Showers', 95: 'Thunderstorm' }

function genSpark(up: boolean, color: string) {
  const vs = up ? [3, 5, 4, 6, 5, 7, 6, 8, 7, 9] : [9, 8, 7, 8, 6, 7, 5, 6, 4, 5]
  return vs.map((h, i) => <div key={i} className="spk" style={{ height: h, background: color + '65' }} />)
}

// ── Status badge ───────────────────────────────────
function StatusBar({ statuses }: { statuses: Record<string, string> }) {
  return (
    <div className="status-bar">
      {Object.entries(statuses).map(([k, v]) => (
        <div key={k} className="status-item">
          <div className="status-dot" style={{ background: v === 'live' ? '#00c873' : v === 'cached' ? '#f09020' : '#ff3d5a' }} />
          {k}
          {v === 'cached' && ' (cached)'}
          {v === 'unavailable' && ' (offline)'}
        </div>
      ))}
    </div>
  )
}

// ── PORTFOLIO DATA ─────────────────────────────────
const POSITIONS = [
  { t: 'VTI', v: 366, s: 0.78, sec: 'US' }, { t: 'VXUS', v: 84, s: 1.97, sec: 'INTL' },
  { t: 'AVUV', v: 120, s: 0.71, sec: 'US' }, { t: 'AVDV', v: 108, s: 0.37, sec: 'INTL' },
  { t: 'VTIP', v: 50, s: 0.80, sec: 'BOND' }, { t: 'RXRX', v: 3, s: 13.61, sec: 'SPEC' },
  { t: 'BE', v: 298, s: 0.66, sec: 'SPEC' }, { t: 'MBLY', v: 10, s: 7.30, sec: 'SPEC' },
  { t: 'SKYT', v: 37, s: 2.96, sec: 'SPEC' },
]
const MOVERS = ['SPY','QQQ','NVDA','IONQ','SOXX','PLTR','RGTI','TSLA','AMD','MSTR','MU','MCHP']

export default function PabloOS() {
  const [page, setPage] = useState('ov')
  const [clock, setClock] = useState('')
  const [date, setDate] = useState('')
  const [regime, setRegime] = useState('neutral')
  const [intel, setIntel] = useState<any>(null)
  const [marketData, setMarketData] = useState<any>(null)
  const [portfolioData, setPortfolioData] = useState<any>(null)
  const [crypto, setCrypto] = useState<any>(null)
  const [mktNews, setMktNews] = useState<any>(null)
  const [worldNews, setWorldNews] = useState<any>(null)
  const [calendar, setCalendar] = useState<any>(null)
  const [weather, setWeather] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [finance, setFinance] = useState<any>({})
  const [showPayForm, setShowPayForm] = useState(false)
  const [payForm, setPayForm] = useState({ name: '', amount: '', date: '', recurring: false })

  // Clock
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      const ts = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0') + ':' + String(n.getSeconds()).padStart(2, '0')
      const ds = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const ms = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      setClock(ts)
      setDate(ds[n.getDay()] + ' ' + ms[n.getMonth()] + ' ' + n.getDate() + ' · ' + n.getFullYear())
    }
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [])

  // Load from localStorage
  useEffect(() => {
    try {
      const p = localStorage.getItem('pablo_pays'); if (p) setPayments(JSON.parse(p))
      const f = localStorage.getItem('pablo_fin'); if (f) setFinance(JSON.parse(f))
    } catch {}
  }, [])

  // Data fetchers — call our own API routes (no CORS ever)
  const loadIntel = useCallback(async () => {
    try { const d = await fetch('/api/intelligence').then(r => r.json()); setIntel(d); setRegime(d.regime || 'neutral') } catch {}
  }, [])

  const loadMarket = useCallback(async () => {
    try { const d = await fetch('/api/market?type=movers').then(r => r.json()); setMarketData(d) } catch {}
  }, [])

  const loadPortfolio = useCallback(async () => {
    try { const d = await fetch('/api/market?type=portfolio').then(r => r.json()); setPortfolioData(d) } catch {}
  }, [])

  const loadCrypto = useCallback(async () => {
    try { const d = await fetch('/api/crypto').then(r => r.json()); setCrypto(d) } catch {}
  }, [])

  const loadMktNews = useCallback(async () => {
    try { const d = await fetch('/api/news').then(r => r.json()); setMktNews(d) } catch {}
  }, [])

  const loadWorldNews = useCallback(async () => {
    try { const d = await fetch('/api/world').then(r => r.json()); setWorldNews(d) } catch {}
  }, [])

  const loadCalendar = useCallback(async () => {
    try { const d = await fetch('/api/calendar').then(r => r.json()); setCalendar(d) } catch {}
  }, [])

  const loadWeather = useCallback(async () => {
    try {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=25.6866&longitude=-100.3161&current=temperature_2m,weathercode&daily=temperature_2m_max,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&timezone=America/Monterrey&forecast_days=5')
      const d = await r.json(); setWeather(d)
    } catch {}
  }, [])

  useEffect(() => {
    loadIntel(); loadMarket(); loadPortfolio(); loadCrypto()
    loadMktNews(); loadWorldNews(); loadCalendar(); loadWeather()
    const i1 = setInterval(loadCrypto, 60000)
    const i2 = setInterval(loadMarket, 120000)
    const i3 = setInterval(loadIntel, 300000)
    return () => { clearInterval(i1); clearInterval(i2); clearInterval(i3) }
  }, [])

  const rc = REGIME_CONFIG[regime] || REGIME_CONFIG.neutral

  // ── Calendar helpers ────────────────────────────
  function buildAgenda(compact = true) {
    if (!calendar?.events?.length) {
      if (calendar?.status === 'unavailable') return <div className="unavail">Calendar feed offline · Full view on Calendar page</div>
      return <div className="unavail">No upcoming events</div>
    }
    const now = new Date()
    const todayS = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayE = new Date(todayS.getTime() + 86400000)
    const nextW = new Date(todayS.getTime() + 8 * 86400000)
    const today = calendar.events.filter((e: any) => new Date(e.start) >= todayS && new Date(e.start) < todayE)
    const upcoming = calendar.events.filter((e: any) => new Date(e.start) >= todayE && new Date(e.start) < nextW).slice(0, 4)
    const shown = [...today, ...upcoming].slice(0, compact ? 4 : 8)
    const ft = (d: string) => { const nd = new Date(d); if (nd.getHours() === 0 && nd.getMinutes() === 0) return 'All day'; return nd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }
    const fd = (d: string) => { const nd = new Date(d); const ds = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], ms = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return ds[nd.getDay()] + ' ' + ms[nd.getMonth()] + ' ' + nd.getDate() }
    const nextMtg = today.find((e: any) => !e.allDay && new Date(e.start) > now)
    const nextOrFirst = nextMtg || today[0]
    const diff = nextOrFirst ? Math.round((new Date(nextOrFirst.start).getTime() - now.getTime()) / 60000) : 0
    const cnt = diff <= 0 ? 'Now' : diff < 60 ? `in ${diff}m` : diff < 120 ? `in ${Math.floor(diff / 60)}h ${diff % 60}m` : ft(nextOrFirst.start)
    const rem = today.filter((e: any) => !e.allDay && new Date(e.start) >= now).length
    const intensity = today.length === 0 ? 'Free' : today.length <= 2 ? 'Light' : today.length <= 4 ? 'Moderate' : 'Heavy'
    return (
      <div>
        {nextOrFirst && (
          <div className="ag-next" style={{ borderColor: rc.border, background: rc.bg }}>
            <div className="ag-l">Next</div>
            <div className="ag-t">{nextOrFirst.summary}</div>
            <div className="ag-m">{cnt}{nextOrFirst.location ? ' · ' + nextOrFirst.location : ''}</div>
            <div className="ag-cnt">{rem} remaining · {intensity} schedule · {today.length} today{calendar.status === 'cached' ? ' · cached' : ''}</div>
          </div>
        )}
        {shown.map((ev: any, i: number) => {
          const isT = new Date(ev.start) >= todayS && new Date(ev.start) < todayE
          return (
            <div key={i} className="agrow">
              <div className="agbar" style={{ background: isT ? '#00c873' : '#4080ff' }} />
              <div style={{ flex: 1 }}>
                <div className="agev">{ev.summary}</div>
                <div className="agtime">{ev.allDay ? 'All day' : ft(ev.start)}{ev.location ? ' · ' + ev.location : ''}</div>
              </div>
              {isT
                ? <span className="agb" style={{ background: '#00c87320', color: '#00c873' }}>Today</span>
                : <span className="agb" style={{ background: 'var(--s3)', color: 'var(--t3)' }}>{fd(ev.start)}</span>
              }
            </div>
          )
        })}
      </div>
    )
  }

  // ── Intelligence items ──────────────────────────
  function renderIntelItems(items: any[]) {
    return items.map((item: any, i: number) => {
      const tc = TAG_COLORS[item.tag] || TAG_COLORS.system
      const bar = COLOR_MAP[item.color] || tc.bar
      return (
        <div key={i} className="irow">
          <div className="ibar" style={{ background: bar, opacity: 0.8 }} />
          <div className="ib">
            <div className="it">{item.text}</div>
            {item.context && <div className="ic">{item.context}</div>}
          </div>
          <span className="itag" style={{ background: tc.bg, color: tc.text }}>{item.tag}</span>
        </div>
      )
    })
  }

  // ── Market tiles ────────────────────────────────
  function renderMoverStrip(symbols: string[], data: any) {
    if (!data?.data || Object.keys(data.data).length === 0) {
      return (
        <div style={{ gridColumn: '1/-1', padding: '6px 0' }}>
          <span style={{ fontSize: 9, color: 'var(--t2)', fontWeight: 500 }}>
            {data?.status === 'cached'
              ? `Market data: last confirmed ${new Date(data.cachedAt || '').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
              : data?.status === 'unavailable'
              ? 'Market data feed temporarily unavailable · retrying'
              : 'Connecting to market data feed...'}
          </span>
        </div>
      )
    }
    return symbols.slice(0, 6).map((sym: string) => {
      const r = data.data[sym]; if (!r) return null
      const col = r.up ? '#00c873' : '#ff3d5a'
      return (
        <div key={sym} className="ms">
          <div className="ms-top">
            <span className="ms-sym">{sym}</span>
            <span className="ms-chg" style={{ color: col }}>{r.up ? '▲' : '▼'} {chgFmt(r.change)}</span>
          </div>
          <div className="ms-p">${r.price < 100 ? r.price.toFixed(2) : Math.round(r.price).toLocaleString()}</div>
          <div className="spark">{genSpark(r.up, col)}</div>
        </div>
      )
    })
  }

  // ── News items ──────────────────────────────────
  function renderNews(articles: any[]) {
    if (!articles?.length) return <div className="unavail">World intelligence stream reconnecting...</div>
    const sentColors: Record<string, { bg: string; text: string }> = {
      bullish: { bg: '#00c87320', text: '#00c873' },
      bearish: { bg: '#ff3d5a20', text: '#ff3d5a' },
      neutral: { bg: 'var(--s3)', text: 'var(--t3)' },
    }
    const catColors: Record<string, { bg: string; text: string }> = {
      geo: { bg: '#ff3d5a20', text: '#ff3d5a' },
      macro: { bg: '#4080ff20', text: '#4080ff' },
      tech: { bg: '#8868ff20', text: '#8868ff' },
      intel: { bg: 'var(--s3)', text: 'var(--t2)' },
    }
    return articles.map((a: any, i: number) => {
      const bc = a.sentiment ? sentColors[a.sentiment] : catColors[a.label] || catColors.intel
      return (
        <div key={i} className="ni">
          <div className="ni-src">{(a.source || '').toUpperCase().slice(0, 6)}</div>
          <div className="ni-b">
            <div className="ni-h">{a.title}</div>
            {a.context && <div className="ni-ctx">{a.context}</div>}
            <a href={a.url} target="_blank" rel="noopener" className="ni-a">Read →</a>
          </div>
          <span className="nbadge" style={{ background: bc.bg, color: bc.text }}>{a.sentiment || a.label || 'intel'}</span>
        </div>
      )
    })
  }

  // ── Payments ────────────────────────────────────
  const du = (d: string) => { const t = new Date(); t.setHours(0,0,0,0); return Math.round((new Date(d + 'T00:00:00').getTime() - t.getTime()) / 86400000) }
  const nm = (ds: string) => { const t = new Date(); t.setHours(0,0,0,0); const d = new Date(ds + 'T00:00:00'); while (d < t) d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0] }
  const savePays = (p: any[]) => { setPayments(p); localStorage.setItem('pablo_pays', JSON.stringify(p)) }
  const addPayment = () => {
    if (!payForm.name || !payForm.date) return
    savePays([...payments, payForm])
    setPayForm({ name: '', amount: '', date: '', recurring: false })
    setShowPayForm(false)
  }

  function renderPayments() {
    if (!payments.length) return <div className="unavail">Nothing due.</div>
    return [...payments].map((p, i) => ({ ...p, eff: p.recurring ? nm(p.date) : p.date, i }))
      .sort((a, b) => new Date(a.eff).getTime() - new Date(b.eff).getTime())
      .map((p: any) => {
        const d = du(p.eff)
        const bc = d < 0 ? 'bo' : d <= 5 ? 'bs' : 'bk'
        const bt = d < 0 ? Math.abs(d) + 'd overdue' : d === 0 ? 'today' : 'in ' + d + 'd'
        return (
          <div key={p.i} className="pitem">
            <div className="pdot" style={{ background: d < 0 ? 'var(--r)' : d <= 5 ? 'var(--a)' : 'var(--g)' }} />
            <span style={{ flex: 1, fontSize: 9, fontWeight: 500, color: 'var(--t1)' }}>{p.name}</span>
            <span className={`bg ${bc}`}>{bt}</span>
            {p.recurring && <span className="bg bm">mo</span>}
            <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--r)' }}>{p.amount}</span>
            <button onClick={() => savePays(payments.filter((_, idx) => idx !== p.i))} style={{ background: 'none', border: 'none', color: 'var(--t4)', fontSize: 9 }}><i className="ti ti-x" /></button>
          </div>
        )
      })
  }

  // ── Portfolio total ─────────────────────────────
  const portTotal = portfolioData?.data
    ? POSITIONS.reduce((sum, p) => sum + (portfolioData.data[p.t]?.price || p.v) * p.s, 0)
    : null

  // ── LIFESTYLE DATA ──────────────────────────────
  const allEv = [
    { c: 'var(--p)', tag: 'Music · Spanish Rock', name: 'Caifanes', date: 'May 29 & 30', loc: 'Auditorio Nacional, CDMX', fomo: 'This weekend', fc: 'var(--r)' },
    { c: 'var(--p)', tag: 'Music · Spanish Rock', name: 'Caifanes', date: 'Oct 17, 2026', loc: 'Auditorio Telmex, GDL', fomo: 'Plan ahead', fc: 'var(--a)' },
    { c: 'var(--p)', tag: 'Music · Regional MX', name: 'Carín León', date: '2026 MTY TBC', loc: 'Monterrey', fomo: 'Track drop', fc: 'var(--b)' },
    { c: 'var(--p)', tag: 'Tiny Desk', name: 'NPR Tiny Desk', date: 'Weekly', loc: 'YouTube · NPR', fomo: 'Never miss', fc: 'var(--g)' },
    { c: 'var(--r)', tag: 'Toros · EMSA', name: 'Corrida EMSA', date: 'Oct 2026', loc: 'Plaza Lorenzo Garza, MTY', fomo: 'emsa.mx', fc: 'var(--a)' },
    { c: 'var(--g)', tag: 'FIFA · World Cup', name: '4 matches — MTY', date: 'Summer 2026', loc: 'Estadio BBVA', fomo: 'Historic', fc: 'var(--r)' },
    { c: 'var(--p)', tag: 'Rock en Español', name: 'Zoé + Soda Stereo', date: 'TBC', loc: 'Mexico', fomo: 'Track', fc: 'var(--b)' },
    { c: 'var(--b)', tag: 'Business', name: 'Collision / Forbes U30', date: 'Mid-late 2026', loc: 'North America', fomo: 'Track', fc: 'var(--b)' },
  ]
  const allXP = [
    { tc: 'var(--a)', tag: 'Adventure · Texas', name: 'Helicopter Hog Hunting', loc: 'HeliBacon, College Station TX', why: 'AR-15s from Bell 212. Year-round. 4hrs from MTY. No license needed.' },
    { tc: 'var(--a)', tag: 'Adventure · Texas', name: 'Blackhawk Hog Hunt', loc: 'Executive Outdoor Adventures', why: 'UH-60 Blackhawk. 1.3M acres. Most elite version.' },
    { tc: 'var(--b)', tag: 'Outdoors · Mexico', name: 'Spearfishing — Sea of Cortez', loc: 'La Paz / Cozumel', why: 'Best in Latin America. Yellowfin tuna, grouper. Year-round.' },
    { tc: 'var(--g)', tag: 'Fitness · Global', name: 'HYROX Race', loc: 'Houston fall 2026 / MTY 2027', why: '8x1km + functional workouts. Global leaderboard.' },
    { tc: 'var(--b)', tag: 'Outdoors · Baja', name: 'Yellowfin Tuna Fishing', loc: 'Cabo / La Paz', why: 'Peak July–Nov. 30-50lb fish. 90min from MTY.' },
    { tc: 'var(--r)', tag: 'Motorsport · Track Day', name: 'Supercar Track Day', loc: 'Autódromo MTY / CDMX', why: 'Lambo or Ferrari on a real track. Private days available.' },
    { tc: 'var(--g)', tag: 'Adventure · International', name: 'Private Game Reserve Safari', loc: 'South Africa / Kenya', why: 'Fly-in camps. No crowds. Few people your age have done this.' },
    { tc: 'var(--b)', tag: 'Outdoors · Yucatán', name: 'Cave Diving — Cenotes', loc: 'Tulum, Mexico', why: "World's longest underwater cave. Guided intro dives." },
  ]

  // ── Nav pages ───────────────────────────────────
  const pages = [
    { id: 'ov', icon: 'ti-layout-dashboard', label: 'Overview' },
    { id: 'mkt', icon: 'ti-chart-line', label: 'Markets' },
    { id: 'port', icon: 'ti-briefcase', label: 'Portfolio' },
    { id: 'intel-page', icon: 'ti-brain', label: 'Intelligence' },
    { id: 'cal', icon: 'ti-calendar', label: 'Calendar' },
    null,
    { id: 'fin', icon: 'ti-wallet', label: 'Finance' },
    { id: 'world', icon: 'ti-world', label: 'World' },
    { id: 'life', icon: 'ti-compass', label: 'Lifestyle' },
  ]

  return (
    <>
      {/* TOP BAR */}
      <div className="topbar">
        <div className="tb-brand">Pablo OS</div>
        <div className="tb-clk">{clock}</div>
        <div className="tb-dt">{date}</div>
        <div className="tb-tix">
          {[
            ['Portfolio', portTotal ? fmt(portTotal) : '--'],
            ['SPY', marketData?.data?.SPY ? chgFmt(marketData.data.SPY.change) : '--'],
            ['QQQ', marketData?.data?.QQQ ? chgFmt(marketData.data.QQQ.change) : '--'],
            ['BTC', crypto?.btc ? fmt(crypto.btc.price) : '--'],
            ['ETH', crypto?.eth ? fmt(crypto.eth.price) : '--'],
            ['NVDA', marketData?.data?.NVDA ? chgFmt(marketData.data.NVDA.change) : '--'],
            ['IONQ', marketData?.data?.IONQ ? chgFmt(marketData.data.IONQ.change) : '--'],
            ['TSLA', marketData?.data?.TSLA ? chgFmt(marketData.data.TSLA.change) : '--'],
          ].map(([label, val]) => {
            const isChg = val !== '--' && (val.includes('+') || val.includes('%'))
            const color = !isChg ? 'var(--t1)' : val.startsWith('+') ? '#00c873' : '#ff3d5a'
            return <div key={label} className="tbt"><div className="tbt-l">{label}</div><div className="tbt-v" style={{ color }}>{val}</div></div>
          })}
        </div>
        <div className="tb-r">
          <div className="ldot" />
          <div className="rpill" style={{ color: rc.color, background: rc.bg, borderColor: rc.border }}>{rc.label}</div>
          <div style={{ fontSize: 7, color: 'var(--t3)' }}>
            {weather ? `MTY ${Math.round(weather.current.temperature_2m)}°F` : 'MTY --°F'}
          </div>
        </div>
      </div>

      <div className="os">
        {/* NAV */}
        <nav className="nav">
          {pages.map((p, i) => p === null
            ? <div key={i} className="nsep" />
            : <button key={p.id} className={`nb${page === p.id ? ' on' : ''}`} onClick={() => setPage(p.id)}>
                <i className={`ti ${p.icon} ni`} />
                <span className="nl">{p.label}</span>
              </button>
          )}
          <div className="nsep" style={{ marginTop: 'auto' }} />
          <button className="nb" onClick={() => { loadIntel(); loadMarket(); loadPortfolio(); loadCrypto(); loadMktNews(); loadWorldNews(); loadCalendar(); loadWeather() }}>
            <i className="ti ti-refresh ni" /><span className="nl">Refresh all</span>
          </button>
        </nav>

        <main className="main">

          {/* ═══════════ OVERVIEW ═══════════ */}
          {page === 'ov' && (
            <div className="page on" style={{ display: 'grid', gridTemplateColumns: '1fr 232px', gridTemplateRows: 'auto 1fr', gap: 6, height: '100%', overflow: 'hidden', padding: 8 }}>

              {/* HERO */}
              <div style={{ gridColumn: '1/3' }}>
                <div className="hero">
                  <div className="hero-inner">
                    <div className="hero-main">
                      <div className="hero-hd"><i className="ti ti-brain" />Executive intelligence — what matters right now<button className="ca" style={{ marginLeft: 'auto' }} onClick={loadIntel}><i className="ti ti-refresh" /></button></div>
                      {intel?.items?.length ? (
                        <>
                          <div className="hero-cols">{renderIntelItems(intel.items)}</div>
                          <StatusBar statuses={intel.dataStatus || {}} />
                        </>
                      ) : (
                        <div style={{ fontSize: 9, color: 'var(--t3)', fontStyle: 'italic' }}>Building intelligence briefing from live market data...</div>
                      )}
                    </div>
                    {/* REGIME */}
                    <div className="hero-panel" style={{ minWidth: 150 }}>
                      <div className="lbl mb4">Macro regime</div>
                      <div style={{ fontSize: 14, fontWeight: 300, color: rc.color, marginBottom: 4 }}>{rc.label}</div>
                      <div style={{ fontSize: 8, color: 'var(--t2)' }}>{intel?.session?.context || 'Loading session context...'}</div>
                      <div className="sep" />
                      <div className="lbl mb4">Session</div>
                      <div style={{ fontSize: 10, color: 'var(--t1)' }}>{intel?.session?.label || '--'}</div>
                    </div>
                    {/* AGENDA IN HERO */}
                    <div className="hero-panel" style={{ minWidth: 160 }}>
                      <div style={{ fontSize: 7, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.16em', marginBottom: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        Agenda<button className="ca" onClick={loadCalendar}><i className="ti ti-refresh" /></button>
                      </div>
                      {buildAgenda(true)}
                    </div>
                  </div>
                </div>
              </div>

              {/* BODY LEFT */}
              <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
                {/* MARKET MOVERS */}
                <div className="card card-xs">
                  <div className="ch"><span className="ch-t">Market movers</span><button className="ca" onClick={loadMarket}><i className="ti ti-refresh" /></button></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 5 }}>
                    {renderMoverStrip(MOVERS, marketData)}
                  </div>
                </div>

                {/* STREAM + WORLD NEWS */}
                <div className="g2" style={{ flex: 1, minHeight: 0 }}>
                  {/* Stream */}
                  <div className="stream">
                    <div className="stream-hd"><span className="ch-t">Operational intelligence stream</span><button className="ca" onClick={loadIntel}><i className="ti ti-refresh" /></button></div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {intel?.items?.length ? intel.items.map((item: any, i: number) => {
                        const tc = TAG_COLORS[item.tag] || TAG_COLORS.system
                        const bar = COLOR_MAP[item.color] || tc.bar
                        return (
                          <div key={i} className="srow">
                            <div className="s-time">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                            <div className="s-dot" style={{ background: bar }} />
                            <div className="s-body">
                              <div className="s-head">{item.text}</div>
                              {item.context && <div className="s-sub">{item.context}</div>}
                            </div>
                            <span className="s-badge" style={{ background: tc.bg, color: tc.text }}>{item.tag}</span>
                          </div>
                        )
                      }) : <div style={{ padding: '12px 11px', fontSize: 9, color: 'var(--t3)', fontStyle: 'italic' }}>Intelligence stream initializing — connecting to live feeds...</div>}
                    </div>
                  </div>
                  {/* World news */}
                  <div className="card card-xs" style={{ overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div className="ch"><span className="ch-t">World intelligence</span><button className="ca" onClick={loadWorldNews}><i className="ti ti-refresh" /></button></div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>{renderNews(worldNews?.articles || [])}</div>
                    {worldNews?.status === 'cached' && <div style={{ fontSize: 7, color: 'var(--t3)', paddingTop: 4, borderTop: '0.5px solid var(--b1)' }}>Using confirmed feed from {new Date(worldNews.cachedAt || '').toLocaleTimeString()}</div>}
                  </div>
                </div>

                {/* MARKET NEWS */}
                <div className="card card-xs">
                  <div className="ch"><span className="ch-t">Market intelligence — Marketaux live</span><button className="ca" onClick={loadMktNews}><i className="ti ti-refresh" /></button></div>
                  <div>{renderNews(mktNews?.articles || [])}</div>
                  {mktNews?.status === 'cached' && <div style={{ fontSize: 7, color: 'var(--t3)', paddingTop: 4, borderTop: '0.5px solid var(--b1)', marginTop: 4 }}>Using confirmed feed from {new Date(mktNews.cachedAt || '').toLocaleTimeString()}</div>}
                </div>
              </div>

              {/* SIDEBAR */}
              <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 5, minHeight: 0 }}>

                <div className="sw">
                  <div className="sw-hd">Market mood<button className="sw-ca" onClick={loadMarket}><i className="ti ti-refresh" /></button></div>
                  {marketData?.data?.SPY ? (() => {
                    const c = marketData.data.SPY.change
                    const col = c > 0.5 ? '#00c873' : c < -0.5 ? '#ff3d5a' : '#f09020'
                    const bg = c > 0.5 ? '#00c87320' : c < -0.5 ? '#ff3d5a20' : '#f0902020'
                    const icon = c > 0.5 ? 'ti-trending-up' : c < -0.5 ? 'ti-trending-down' : 'ti-minus'
                    const lbl = c > 0.5 ? 'Risk-on' : c < -0.5 ? 'Risk-off' : 'Neutral'
                    const sub = c > 0.5 ? 'Growth positioning favored. Breadth positive.' : c < -0.5 ? 'Defensive rotation increasing.' : 'Range-bound. No clear conviction.'
                    return (
                      <div>
                        <div className="mood-row"><div className="mood-ico" style={{ background: bg }}><i className={`ti ${icon}`} style={{ color: col, fontSize: 12 }} /></div><div><div style={{ fontSize: 13, fontWeight: 300, color: 'var(--t1)' }}>{lbl}</div><div className="lbl">SPY {chgFmt(c)}</div></div></div>
                        <div style={{ fontSize: 8, color: 'var(--t2)', lineHeight: 1.5 }}>{sub}</div>
                        <div style={{ fontSize: 7, color: 'var(--t3)', marginTop: 5, paddingTop: 5, borderTop: '0.5px solid var(--b1)' }}>Watch volume confirmation into close</div>
                      </div>
                    )
                  })() : <div className="unavail">Market mood feed reconnecting...</div>}
                </div>

                <div className="sw">
                  <div className="sw-hd">Edge alert<button className="sw-ca" onClick={loadIntel}><i className="ti ti-refresh" /></button></div>
                  {(() => {
                    const spy = marketData?.data?.SPY, ionq = marketData?.data?.IONQ, nvda = marketData?.data?.NVDA, qqq = marketData?.data?.QQQ
                    let t = '', b = '', col = '#ff3d5a', bg = '#ff3d5a20'
                    if (ionq?.price && ionq.change > 5) { t = `IONQ +${ionq.change.toFixed(1)}% — quantum rotation`; b = 'Federal $2B commitment changes risk/reward. IONQ leads with $260M real revenue.'; col = '#8868ff'; bg = '#8868ff20' }
                    else if (nvda?.price && !nvda.up && spy?.up) { t = 'NVDA trailing market — sell-the-news'; b = 'Beat $78B revenue but slipped vs SPY. Blackwell gross margin is the key watch.'; col = '#f09020'; bg = '#f0902020' }
                    else if (spy?.price && spy.change > 0.8 && qqq?.price && qqq.change > 1) { t = 'SPY + QQQ dual confirmation'; b = 'Broad and tech momentum aligned. Growth positions benefit.'; col = '#00c873'; bg = '#00c87320' }
                    else { t = 'Oil at $98 — inflation signal'; b = 'WTI near $98 repricing inflation. VTIP positioned correctly.'; col = '#ff3d5a'; bg = '#ff3d5a20' }
                    if (!marketData?.data || Object.keys(marketData.data).length === 0) return <div className="unavail">Edge analysis: connecting to live feeds...</div>
                    return <div className="edge-i" style={{ background: bg, borderColor: col + '20' }}><div className="edge-t" style={{ color: col }}>{t}</div><div className="edge-b" style={{ color: col + 'b0' }}>{b}</div></div>
                  })()}
                </div>

                <div className="sw">
                  <div className="sw-hd">BTC · ETH</div>
                  {crypto?.btc ? (
                    <>
                      <div className="ctile"><span style={{ fontSize: 9, fontWeight: 600, color: 'var(--t2)' }}>Bitcoin</span><div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: crypto.btc.up ? '#00c873' : '#ff3d5a' }}>{fmt(crypto.btc.price)}</div><div style={{ fontSize: 8, color: crypto.btc.up ? '#00c873' : '#ff3d5a' }}>{chgFmt(crypto.btc.change)} 24h</div></div></div>
                      <div className="ctile"><span style={{ fontSize: 9, fontWeight: 600, color: 'var(--t2)' }}>Ethereum</span><div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: crypto.eth.up ? '#00c873' : '#ff3d5a' }}>{fmt(crypto.eth.price)}</div><div style={{ fontSize: 8, color: crypto.eth.up ? '#00c873' : '#ff3d5a' }}>{chgFmt(crypto.eth.change)} 24h</div></div></div>
                      {crypto.status === 'cached' && <div style={{ fontSize: 7, color: 'var(--t3)', marginTop: 3 }}>Confirmed {new Date(crypto.cachedAt || '').toLocaleTimeString()}</div>}
                    </>
                  ) : <div className="unavail">Crypto feed connecting...</div>}
                </div>

                <div className="sw">
                  <div className="sw-hd">Weather · MTY</div>
                  {weather ? (
                    <>
                      <div className="wx-r"><div className="wx-tmp">{Math.round(weather.current.temperature_2m)}°F</div><div><div style={{ fontSize: 10, color: 'var(--t1)' }}>{WX_LABELS[weather.current.weathercode] || 'Clear'}</div><div className="lbl">Monterrey, NL</div></div></div>
                      <div className="wxdays">{weather.daily.time.map((t: string, i: number) => { const day = new Date(t + 'T12:00:00'); const days = ['Su','Mo','Tu','We','Th','Fr','Sa']; return <div key={i} className="wxd"><div className="wxdn">{days[day.getDay()]}</div><div style={{ fontSize: 10 }}>{WX_ICONS[weather.daily.weathercode[i]] || '🌡'}</div><div className="wxdh">{Math.round(weather.daily.temperature_2m_max[i])}°</div><div className="wxdp">{weather.daily.precipitation_probability_max[i]}%</div></div> })}</div>
                    </>
                  ) : <div className="unavail">Weather feed loading...</div>}
                </div>

                <div className="sw">
                  <div className="sw-hd">Portfolio<button className="sw-ca" onClick={loadPortfolio}><i className="ti ti-refresh" /></button></div>
                  {portTotal && <div style={{ fontSize: 16, fontWeight: 300, color: 'var(--t1)', marginBottom: 5 }}>{fmt(portTotal)}</div>}
                  {portfolioData?.data ? POSITIONS.slice(0, 5).map(p => {
                    const r = portfolioData.data[p.t]
                    const col = r?.price ? (r.up ? '#00c873' : '#ff3d5a') : 'var(--t3)'
                    const chg = r?.price ? chgFmt(r.change) : '—'
                    return <div key={p.t} className="pt-sm"><span style={{ fontSize: 8, fontWeight: 600, color: 'var(--t2)' }}>{p.t}</span><span style={{ fontSize: 9, fontWeight: 500, color: col }}>{chg}</span></div>
                  }) : <div className="unavail">Portfolio data reconnecting...</div>}
                </div>

                <div className="sw">
                  <div className="sw-hd">Payments due<button className="sw-ca" onClick={() => setShowPayForm(!showPayForm)}><i className="ti ti-plus" /></button></div>
                  {renderPayments()}
                  {showPayForm && (
                    <div className="af">
                      <input placeholder="e.g. Rent" value={payForm.name} onChange={e => setPayForm({ ...payForm, name: e.target.value })} />
                      <input placeholder="e.g. $500" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
                      <input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} className="aff" />
                      <div className="aff trw"><input type="checkbox" checked={payForm.recurring} onChange={e => setPayForm({ ...payForm, recurring: e.target.checked })} /><label>Repeat monthly</label></div>
                      <button className="fbtn aff" onClick={addPayment}>Add</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ MARKETS ═══════════ */}
          {page === 'mkt' && (
            <div className="page on" style={{ padding: 8 }}>
              <div className="sl">Live market movers</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 5, marginBottom: 8 }}>
                {MOVERS.map(sym => {
                  const r = marketData?.data?.[sym]; if (!r) return <div key={sym} className="ms"><div className="ms-sym">{sym}</div><div className="ms-p" style={{ color: 'var(--t3)', fontSize: 8 }}>—</div></div>
                  const col = r.up ? '#00c873' : '#ff3d5a'
                  return <div key={sym} className="ms"><div className="ms-top"><span className="ms-sym">{sym}</span><span className="ms-chg" style={{ color: col }}>{r.up ? '▲' : '▼'} {chgFmt(r.change)}</span></div><div className="ms-p">${r.price < 100 ? r.price.toFixed(2) : Math.round(r.price).toLocaleString()}</div><div className="spark">{genSpark(r.up, col)}</div></div>
                })}
              </div>
              {marketData?.status === 'cached' && <div style={{ fontSize: 8, color: 'var(--t3)', marginBottom: 6, fontStyle: 'italic' }}>Using confirmed market structure from {new Date(marketData.cachedAt || '').toLocaleTimeString()} · Live feed reconnecting</div>}
              {marketData?.status === 'unavailable' && <div style={{ fontSize: 8, color: '#f09020', marginBottom: 6 }}>Live market data temporarily unavailable · retrying in background</div>}
            </div>
          )}

          {/* ═══════════ PORTFOLIO ═══════════ */}
          {page === 'port' && (
            <div className="page on" style={{ padding: 8 }}>
              <div className="sl">Holdings</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9,1fr)', gap: 4, marginBottom: 8 }}>
                {POSITIONS.map(p => {
                  const r = portfolioData?.data?.[p.t]
                  const cls = r?.price ? (r.up ? 'ptile up' : 'ptile dn') : 'ptile nt'
                  const col = r?.price ? (r.up ? '#00c873' : '#ff3d5a') : 'var(--t3)'
                  const chg = r?.price ? chgFmt(r.change) : '—'
                  const price = r?.price || p.v
                  return <div key={p.t} className={cls}><div className="pt-s">{p.t}</div><div className="pt-c" style={{ color: col }}>{chg}</div><div className="pt-v">${Math.round(price)}</div></div>
                })}
              </div>
              {portTotal && <div style={{ fontSize: 18, fontWeight: 300, marginBottom: 8 }}>Total: {fmt(portTotal)} <span style={{ fontSize: 9, color: 'var(--t3)' }}>9 positions</span></div>}
              <div className="sl">Exposure</div>
              <div className="g4" style={{ gap: 5 }}>
                {[['US equity','68%','#00c873'],['International','18%','#4080ff'],['Inflation hedge','5%','#f09020'],['Speculative','9%','#8868ff']].map(([l,v,c]) => (
                  <div key={l} className="card card-xs"><div className="fl mb4">{l}</div><div className="nmd" style={{ color: c }}>{v}</div><div className="abar" style={{ marginTop: 4 }}><div className="afill" style={{ width: v, background: c }} /></div></div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════ INTELLIGENCE ═══════════ */}
          {page === 'intel-page' && (
            <div className="page on" style={{ padding: 8 }}>
              <div className="g2" style={{ marginBottom: 6 }}>
                <div className="card"><div className="ch"><span className="ch-t">Market intelligence</span><button className="ca" onClick={loadMktNews}><i className="ti ti-refresh" /></button></div>{renderNews(mktNews?.articles || [])}</div>
                <div className="card"><div className="ch"><span className="ch-t">World intelligence</span><button className="ca" onClick={loadWorldNews}><i className="ti ti-refresh" /></button></div>{renderNews(worldNews?.articles || [])}</div>
              </div>
              <div className="card"><div className="ch"><span className="ch-t">AI briefing</span><button className="ca" onClick={loadIntel}><i className="ti ti-refresh" /></button></div>{intel?.items ? <div className="hero-cols">{renderIntelItems(intel.items)}</div> : <div className="unavail">Building briefing...</div>}</div>
            </div>
          )}

          {/* ═══════════ CALENDAR ═══════════ */}
          {page === 'cal' && (
            <div className="page on" style={{ padding: 8 }}>
              <div className="g2" style={{ marginBottom: 8 }}>
                <div className="card"><div className="ch"><span className="ch-t">Operational agenda</span><button className="ca" onClick={loadCalendar}><i className="ti ti-refresh" /></button></div>{buildAgenda(false)}</div>
                <div className="card"><div className="ch"><span className="ch-t">Payments</span><button className="ca" onClick={() => setShowPayForm(!showPayForm)}><i className="ti ti-plus" /></button></div>{renderPayments()}{showPayForm && <div className="af"><input placeholder="Rent" value={payForm.name} onChange={e => setPayForm({...payForm,name:e.target.value})} /><input placeholder="$500" value={payForm.amount} onChange={e => setPayForm({...payForm,amount:e.target.value})} /><input type="date" value={payForm.date} onChange={e => setPayForm({...payForm,date:e.target.value})} className="aff" /><div className="aff trw"><input type="checkbox" checked={payForm.recurring} onChange={e => setPayForm({...payForm,recurring:e.target.checked})} /><label>Monthly</label></div><button className="fbtn aff" onClick={addPayment}>Add</button></div>}</div>
              </div>
              <div className="sl">Full calendar</div>
              <div className="card"><iframe src="https://calendar.google.com/calendar/embed?src=pablo%40dealground.com&ctz=America%2FTijuana&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&mode=WEEK&bgcolor=%2305050a&color=%2300c873" style={{ width: '100%', height: 360, border: 'none', borderRadius: 3 }} title="Calendar" /></div>
            </div>
          )}

          {/* ═══════════ FINANCE ═══════════ */}
          {page === 'fin' && (
            <div className="page on" style={{ padding: 8 }}>
              <div className="g4" style={{ gap: 5, marginBottom: 8 }}>
                {[['Income', finance.i || '—'], ['Expenses', finance.e || '—'], ['Portfolio', portTotal ? fmt(portTotal) : '--'], ['Crypto', crypto?.btc ? fmt(crypto.btc.price) + ' BTC' : '--']].map(([l, v]) => (
                  <div key={l} className="ft card card-xs"><div className="fl">{l}</div><div className="fv">{v}</div></div>
                ))}
              </div>
              <div className="card"><div className="ch"><span className="ch-t">Update</span></div>
                <div className="af">
                  <input placeholder="Monthly income" value={finance.i || ''} onChange={e => setFinance({...finance,i:e.target.value})} />
                  <input placeholder="Monthly expenses" value={finance.e || ''} onChange={e => setFinance({...finance,e:e.target.value})} />
                  <input placeholder="Crypto value" value={finance.c || ''} onChange={e => setFinance({...finance,c:e.target.value})} className="aff" />
                  <button className="fbtn aff" onClick={() => localStorage.setItem('pablo_fin', JSON.stringify(finance))}>Save</button>
                </div>
                <div style={{ fontSize: 7, color: 'var(--t3)', marginTop: 5 }}><i className="ti ti-lock" style={{ fontSize: 7, marginRight: 2 }} />Stored locally</div>
              </div>
            </div>
          )}

          {/* ═══════════ WORLD ═══════════ */}
          {page === 'world' && (
            <div className="page on" style={{ padding: 8 }}>
              <div className="g2">
                <div className="card"><div className="ch"><span className="ch-t">World intelligence</span><button className="ca" onClick={loadWorldNews}><i className="ti ti-refresh" /></button></div>{renderNews(worldNews?.articles || [])}</div>
                <div className="card"><div className="ch"><span className="ch-t">Market intelligence</span><button className="ca" onClick={loadMktNews}><i className="ti ti-refresh" /></button></div>{renderNews(mktNews?.articles || [])}</div>
              </div>
            </div>
          )}

          {/* ═══════════ LIFESTYLE ═══════════ */}
          {page === 'life' && (
            <div className="page on" style={{ padding: 8 }}>
              <div className="sl">Events & experiences</div>
              <div className="g4" style={{ marginBottom: 8 }}>
                {allEv.map((e, i) => (
                  <div key={i} className="etile" style={{ background: e.c + '10', borderColor: e.c + '25' }}>
                    <div className="etag" style={{ color: e.c }}>{e.tag}</div>
                    <div className="ename">{e.name}</div>
                    <div className="edate">{e.date} · {e.loc}</div>
                    <span className="efomo" style={{ background: e.fc + '18', color: e.fc }}>{e.fomo}</span>
                  </div>
                ))}
              </div>
              <div className="sl">Niche experiences</div>
              <div className="g4">
                {allXP.map((x, i) => (
                  <div key={i} className="xt">
                    <div className="xtag" style={{ color: x.tc }}>{x.tag}</div>
                    <div className="xname">{x.name}</div>
                    <div style={{ fontSize: 7, color: 'var(--t3)', marginBottom: 2 }}>{x.loc}</div>
                    <div className="xwhy">{x.why}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  )
}
