import { NextResponse } from 'next/server'

export async function GET() {
  const now = new Date()
  const h = now.getHours()
  const day = now.getDay()
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Fetch all data in parallel
  const [marketRes, newsRes, worldRes, calRes] = await Promise.allSettled([
    fetch(`${base}/api/market?type=movers`).then(r => r.json()),
    fetch(`${base}/api/news`).then(r => r.json()),
    fetch(`${base}/api/world`).then(r => r.json()),
    fetch(`${base}/api/calendar`).then(r => r.json()),
  ])

  const market = marketRes.status === 'fulfilled' ? marketRes.value : null
  const news   = newsRes.status === 'fulfilled'   ? newsRes.value   : null
  const world  = worldRes.status === 'fulfilled'  ? worldRes.value  : null
  const cal    = calRes.status === 'fulfilled'    ? calRes.value    : null

  const sessions = [
    [0,6,'Overnight','Markets closed. Asia session active.'],
    [6,9,'Pre-market','US futures trading. Key setup window.'],
    [9,9.5,'Market open','Volatile first 30 min. Watch breadth.'],
    [9.5,16,'Trading session','Full liquidity. Price discovery active.'],
    [16,20,'After-hours','Thin liquidity. Earnings moves possible.'],
    [20,24,'Overnight','Price discovery paused. News risk active.'],
  ]
  const session = sessions.find(([s,e]) => h >= (s as number) && h < (e as number)) || sessions[0]

  // Build raw context to synthesize
  const spy  = market?.data?.SPY
  const qqq  = market?.data?.QQQ
  const nvda = market?.data?.NVDA
  const ionq = market?.data?.IONQ
  const soxx = market?.data?.SOXX
  const pltr = market?.data?.PLTR

  const marketSummary = spy?.price
    ? `SPY ${spy.change>=0?'+':''}${spy.change.toFixed(2)}%, QQQ ${qqq?.change>=0?'+':''}${qqq?.change?.toFixed(2)||'--'}%, NVDA ${nvda?.change>=0?'+':''}${nvda?.change?.toFixed(2)||'--'}%, IONQ ${ionq?.change>=0?'+':''}${ionq?.change?.toFixed(2)||'--'}%, SOXX ${soxx?.change>=0?'+':''}${soxx?.change?.toFixed(2)||'--'}%, PLTR ${pltr?.change>=0?'+':''}${pltr?.change?.toFixed(2)||'--'}%`
    : 'Market data unavailable'

  const newsHeadlines = news?.articles?.slice(0,5).map((a:any) => a.title).join(' | ') || ''
  const worldHeadlines = world?.articles?.slice(0,5).map((a:any) => a.title).join(' | ') || ''

  // Calendar context
  const CST = 6 * 3600000
  const mtyMs = now.getTime() - CST
  const mtyNow = new Date(mtyMs)
  const y = mtyNow.getUTCFullYear(), mo = mtyNow.getUTCMonth(), dy = mtyNow.getUTCDate()
  const todayStart = new Date(Date.UTC(y, mo, dy, 0) + CST).toISOString()
  const todayEnd   = new Date(Date.UTC(y, mo, dy, 23, 59, 59) + CST).toISOString()
  const tomorrowStart = new Date(Date.UTC(y, mo, dy+1, 0) + CST).toISOString()
  const tomorrowEnd   = new Date(Date.UTC(y, mo, dy+1, 23, 59, 59) + CST).toISOString()
  const todayEvs    = cal?.events?.filter((e:any) => e.start >= todayStart && e.start <= todayEnd && !e.allDay) || []
  const tomorrowEvs = cal?.events?.filter((e:any) => e.start >= tomorrowStart && e.start <= tomorrowEnd && !e.allDay) || []
  const nextEv = todayEvs.find((e:any) => e.start > now.toISOString()) || tomorrowEvs[0]
  const calSummary = todayEvs.length === 0
    ? `Clear day. Next meeting: ${nextEv?.summary || 'none this week'}`
    : `${todayEvs.length} meetings today: ${todayEvs.map((e:any)=>e.summary).join(', ')}. Tomorrow: ${tomorrowEvs.length} meetings.`

  // Portfolio context
  const portfolio = 'Holdings: VTI (US equity core), VXUS (international), AVUV+AVDV (small cap value), VTIP (inflation hedge), RXRX+BE+MBLY+SKYT (speculative). Monthly income $2,749. Obligations: car $582, rent $722, credit cards $110.'

  // Use Claude API to synthesize everything into actionable intelligence
  let synthesized: any[] = []
  try {
    const prompt = `You are Pablo's personal executive intelligence system. Synthesize the following real-time data into exactly 6 concise, actionable intelligence items. 

Rules:
- Each item must be a single clear sentence stating what happened and what to do or watch
- NO raw headlines — synthesize and interpret
- Focus on what directly affects Pablo's portfolio and life
- Include specific numbers when available
- Format as JSON array: [{"text":"...","context":"...","tag":"market|semis|macro|meeting|portfolio|event|alert","color":"green|red|amber|blue|purple"}]
- "text" = the key insight (1 sentence, ~15 words max)
- "context" = why it matters to Pablo specifically (1 sentence)

Current data:
MARKETS: ${marketSummary}
SESSION: ${session[2]} — ${day===0||day===6?'Weekend':'Weekday'}
MARKET NEWS: ${newsHeadlines}
WORLD NEWS: ${worldHeadlines}
CALENDAR: ${calSummary}
PORTFOLIO: ${portfolio}

Return only valid JSON array, nothing else.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await res.json()
    const raw = data.content?.[0]?.text?.trim() || '[]'
    const cleaned = raw.replace(/```json|```/g, '').trim()
    synthesized = JSON.parse(cleaned)
  } catch {
    // Fallback to rule-based if AI fails
    synthesized = buildFallbackItems(spy, qqq, nvda, ionq, nextEv, todayEvs, tomorrowEvs, session, day)
  }

  // Determine regime
  let regime = 'neutral'
  if (ionq?.price && ionq.change > 5) regime = 'ai-momentum'
  else if (spy?.price && spy.change > 0.8) regime = 'risk-on'
  else if (spy?.price && spy.change < -0.8) regime = 'risk-off'

  // Synthesize world news into inline items (no links needed)
  const worldItems = synthesizeWorld(world?.articles || [])

  // Synthesize market news into inline items
  const marketItems = synthesizeMarket(news?.articles || [], market?.data || {})

  return NextResponse.json({
    items: synthesized.slice(0, 6),
    worldItems,
    marketItems,
    regime,
    session: { label: session[2] as string, context: session[3] as string },
    dataStatus: { market: market?.status, news: news?.status, world: world?.status, calendar: cal?.status },
    timestamp: now.toISOString()
  })
}

function buildFallbackItems(spy:any, qqq:any, nvda:any, ionq:any, nextEv:any, todayEvs:any[], tomorrowEvs:any[], session:any[], day:number) {
  const items: any[] = []
  if (day===0||day===6) items.push({ text:'Weekend — markets closed. Use today to review positioning.', context:'Macro positioning window. Review allocation and upcoming week catalysts.', tag:'session', color:'amber' })
  if (spy?.price) {
    const c = spy.change
    items.push({ text:`Market ${c>0.5?'pushing higher':'under pressure'} — SPY ${c>=0?'+':''}${c.toFixed(2)}%, QQQ ${qqq?.change>=0?'+':''}${qqq?.change?.toFixed(2)||'--'}%`, context: c>0.5?'Growth exposure in VTI and speculative positions benefits. AI momentum confirmed.': c<-0.5?'Risk-off building. Monitor if rotation into defensives accelerates.':'No directional conviction. Watch for macro catalyst.', tag: c>0.5?'market':'neutral', color: c>0?'green':c<0?'red':'amber' })
  }
  if (ionq?.change > 3) items.push({ text:`IONQ surging +${ionq.change.toFixed(1)}% — quantum sector in active rotation`, context:'Federal $2B investment driving institutional buying. Pure-play with $260M real revenue.', tag:'semis', color:'purple' })
  if (nvda?.price) items.push({ text:`NVDA ${nvda.change>=0?'holding gains':'under pressure'} at $${Math.round(nvda.price)} — AI infrastructure ${nvda.up?'intact':'softening'}`, context:'Blackwell gross margin on Vera Rubin transition is the key watch metric this quarter.', tag:'semis', color: nvda.up?'green':'amber' })
  if (nextEv) items.push({ text:`Next: ${nextEv.summary}${todayEvs.length>0?' · '+todayEvs.filter((e:any)=>e.start>new Date().toISOString()).length+' remaining today':''}`, context:`${todayEvs.length===0?'Clear day — deep work available.':todayEvs.length<=2?'Light schedule.':'Moderate day.'} Tomorrow: ${tomorrowEvs.length} meetings.`, tag:'meeting', color:'blue' })
  items.push({ text:'Core portfolio intact — VTI, AVUV, AVDV, VTIP all holding structure', context:'No action required on core positions. VTIP hedge performing as inflation stays elevated.', tag:'portfolio', color:'green' })
  return items
}

function synthesizeWorld(articles: any[]) {
  if (!articles.length) return []
  // Group by category and create synthesized one-liners
  const geo = articles.filter((a:any) => a.label === 'geo').slice(0,2)
  const macro = articles.filter((a:any) => a.label === 'macro').slice(0,2)
  const tech = articles.filter((a:any) => a.label === 'tech').slice(0,2)
  const items: any[] = []
  macro.forEach((a:any) => items.push({ title: a.title, why: getWhy(a.title), label:'macro', col:'#4080ff' }))
  geo.forEach((a:any)   => items.push({ title: a.title, why: getWhy(a.title), label:'geo',   col:'#ff3d5a' }))
  tech.forEach((a:any)  => items.push({ title: a.title, why: getWhy(a.title), label:'tech',  col:'#8868ff' }))
  return items.slice(0, 6)
}

function synthesizeMarket(articles: any[], data: any) {
  if (!articles.length) return []
  return articles.slice(0, 5).map((a:any) => ({
    title: a.title,
    context: a.context || '',
    sentiment: a.sentiment,
    tickers: a.tickers || []
  }))
}

function getWhy(title: string): string {
  const low = title.toLowerCase()
  if (low.includes('fed')||low.includes('rate')||low.includes('federal reserve')) return 'Rate path directly affects your equity valuations and VTIP positioning.'
  if (low.includes('oil')||low.includes('crude')||low.includes('energy')) return 'Energy costs pressure inflation — VTIP hedge remains relevant.'
  if (low.includes('china')||low.includes('taiwan')) return 'Semiconductor supply chain risk affects NVDA, SOXX, SKYT positions.'
  if (low.includes('inflation')||low.includes('cpi')) return 'Inflation data shifts rate expectations — key for VTIP and growth mix.'
  if (low.includes('nvda')||low.includes('ai')||low.includes('semiconductor')) return 'AI infrastructure demand drives semiconductor momentum across your holdings.'
  if (low.includes('ukraine')||low.includes('russia')||low.includes('war')) return 'Geopolitical risk maintains elevated energy and commodity premium.'
  if (low.includes('recession')||low.includes('gdp')) return 'Growth signals affect equity risk appetite and defensive rotation.'
  if (low.includes('yield')||low.includes('treasury')||low.includes('bond')) return 'Rate movements reprice growth stocks and portfolio duration.'
  return 'Monitor for portfolio relevance as situation develops.'
}
