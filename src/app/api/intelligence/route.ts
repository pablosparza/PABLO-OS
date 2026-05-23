import { NextResponse } from 'next/server'

export async function GET() {
  const now = new Date()
  const h = now.getHours()
  const day = now.getDay()

  // Fetch all data server-side in parallel
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const [marketRes, cryptoRes, newsRes, worldRes, calRes] = await Promise.allSettled([
    fetch(`${base}/api/market?type=movers`).then(r => r.json()),
    fetch(`${base}/api/crypto`).then(r => r.json()),
    fetch(`${base}/api/news`).then(r => r.json()),
    fetch(`${base}/api/world`).then(r => r.json()),
    fetch(`${base}/api/calendar`).then(r => r.json()),
  ])

  const market = marketRes.status === 'fulfilled' ? marketRes.value : null
  const crypto = cryptoRes.status === 'fulfilled' ? cryptoRes.value : null
  const news = newsRes.status === 'fulfilled' ? newsRes.value : null
  const world = worldRes.status === 'fulfilled' ? worldRes.value : null
  const cal = calRes.status === 'fulfilled' ? calRes.value : null

  const items: any[] = []

  // Session context
  const sessions = [
    [0, 6, 'Overnight', 'Markets closed. Asia session active. News risk elevated.'],
    [6, 9, 'Pre-market', 'US futures trading. Key setup window before open.'],
    [9, 9.5, 'Market open', 'Volatile first 30 min. Watch breadth closely.'],
    [9.5, 16, 'Trading session', 'Full liquidity. Price discovery active.'],
    [16, 20, 'After-hours', 'Thin liquidity. Earnings moves possible.'],
    [20, 24, 'Overnight', 'Price discovery paused. Macro news risk active.'],
  ]
  const session = sessions.find(([s, e]) => h >= (s as number) && h < (e as number)) || sessions[0]

  // Weekend
  if (day === 0 || day === 6) {
    items.push({ text: `Weekend — ${session[2]}. Markets closed.`, context: 'Macro positioning window. Review portfolio allocation and upcoming week catalysts.', tag: 'session', color: 'amber' })
  }

  // SPY
  const spy = market?.data?.SPY
  const qqq = market?.data?.QQQ
  if (spy?.price) {
    const c = spy.change
    items.push({
      text: `SPY ${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(2)}% · QQQ ${qqq ? (qqq.change >= 0 ? '▲' : '▼') + Math.abs(qqq.change).toFixed(2) + '%' : '—'} · ${session[2]}`,
      context: c > 0.5 ? 'Broad and tech momentum aligned. Growth exposure in VTI and speculative positions benefits.' : c < -0.5 ? 'Risk-off pressure. Monitor whether this is profit-taking or genuine rotation to defensives.' : 'Range-bound. No clear conviction. Watch for macro catalyst to define direction.',
      tag: c > 0.5 ? 'risk-on' : c < -0.5 ? 'risk-off' : 'neutral',
      color: c > 0 ? 'green' : c < 0 ? 'red' : 'amber'
    })
  } else {
    items.push({ text: `Market data: ${market?.status === 'cached' ? 'Using last confirmed structure from ' + new Date(market.cachedAt || '').toLocaleTimeString() : 'Feed reconnecting'}`, context: 'Real-time quotes temporarily delayed. Portfolio structure and macro thesis unchanged.', tag: 'system', color: 'blue' })
  }

  // IONQ
  const ionq = market?.data?.IONQ
  if (ionq?.price && ionq.change > 3) {
    items.push({ text: `IONQ +${ionq.change.toFixed(1)}% — quantum sector rotation accelerating.`, context: 'Federal $2B commitment changes risk/reward of pure-play quantum. IONQ leads with $260M real revenue. RGTI momentum-only — different risk profile.', tag: 'fomo', color: 'purple' })
  }

  // NVDA
  const nvda = market?.data?.NVDA
  if (nvda?.price) {
    items.push({ text: `NVDA ${nvda.change >= 0 ? '▲ +' : '▼ '}${Math.abs(nvda.change).toFixed(2)}% — AI infrastructure ${nvda.up ? 'momentum' : 'cautious'}.`, context: 'Blackwell gross margin on Vera Rubin transition is the key metric. Top-line beat already priced.', tag: 'semis', color: nvda.up ? 'green' : 'amber' })
  }

  // BTC
  if (crypto?.btc?.price) {
    const bc = crypto.btc.change
    items.push({ text: `BTC ${bc >= 0 ? '+' : ''}${bc.toFixed(2)}% 24h — crypto ${bc >= 0 ? 'supporting' : 'working against'} risk narrative.`, context: 'Crypto acts as a 24hr leading indicator for risk-on/off sentiment across all asset classes.', tag: 'crypto', color: bc >= 0 ? 'green' : 'red' })
  }

  // Calendar
  if (cal?.events?.length) {
    const nowIso = now.toISOString()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
    const todayEvs = cal.events.filter((e: any) => e.start >= todayStart && e.start < todayEnd)
    const next = todayEvs.find((e: any) => !e.allDay && e.start > nowIso)
    if (next) {
      const diff = Math.round((new Date(next.start).getTime() - now.getTime()) / 60000)
      const countdown = diff <= 0 ? 'now' : diff < 60 ? `in ${diff}m` : `in ${Math.floor(diff / 60)}h ${diff % 60}m`
      items.push({ text: `${next.summary} — ${countdown}${next.location ? ' · ' + next.location : ''}`, context: `${todayEvs.length} meetings today. ${todayEvs.filter((e: any) => !e.allDay && e.start > nowIso).length - 1} remaining after this.`, tag: 'meeting', color: 'blue' })
    }
  }

  // Persistent portfolio intelligence
  items.push({ text: 'Core (VTI, AVUV, AVDV) intact. VTIP inflation hedge active. Oil at $98 validates positioning.', context: 'Long-term thesis unchanged. No action required on core positions today.', tag: 'portfolio', color: 'green' })

  // Lifestyle
  if (day >= 4) {
    items.push({ text: 'Caifanes — Auditorio Nacional CDMX, May 29 & 30. This weekend.', context: 'Tickets still moving. One of the most significant Spanish rock acts performing live this year.', tag: 'event', color: 'purple' })
  }

  // Determine regime
  let regime = 'neutral'
  if (ionq?.price && ionq.change > 5) regime = 'ai-momentum'
  else if (spy?.price && spy.change > 0.8) regime = 'risk-on'
  else if (spy?.price && spy.change < -0.8) regime = 'risk-off'

  return NextResponse.json({
    items: items.slice(0, 7),
    regime,
    session: { label: session[2] as string, context: session[3] as string },
    dataStatus: { market: market?.status, crypto: crypto?.status, news: news?.status, world: world?.status, calendar: cal?.status },
    timestamp: now.toISOString()
  })
}
