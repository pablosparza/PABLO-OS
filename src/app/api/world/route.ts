import { NextResponse } from 'next/server'
import { getCached, setCached } from '@/lib/cache'

const HIGH_SIGNAL = [
  'oil','crude','opec','federal reserve','fed rate','interest rate','inflation',
  'cpi','gdp','ukraine','russia','china','taiwan','semiconductor','nvidia',
  'artificial intelligence','quantum','central bank','treasury yield','bond yield',
  'geopolit','nato','iran','middle east','sanction','tariff','trade war',
  'imf','world bank','recession','stagflation','volatility','earnings',
  'merger','acquisition','default','bankruptcy','supply chain','military'
]

const CONTEXT_MAP: Record<string, string> = {
  oil: 'Rising energy costs reprice inflation — pressure on growth equities.',
  crude: 'Crude movement is critical to inflation trajectory and VTIP positioning.',
  opec: 'Supply decisions drive energy sector and broader inflation outlook.',
  'federal reserve': 'Fed policy is the primary driver of equity valuations globally.',
  'interest rate': 'Rate decisions affect portfolio duration and growth multiples.',
  inflation: 'Inflation data shifts rate expectations — key for VTIP and equity mix.',
  cpi: 'CPI determines Fed reaction — critical to growth vs value rotation.',
  gdp: 'Growth trajectory affects equity risk appetite and defensive rotation.',
  ukraine: 'European conflict maintains elevated energy and commodity risk premium.',
  russia: 'Geopolitical risk premium affects energy markets and safe-haven flows.',
  china: 'China slowdown affects global growth and VXUS emerging market exposure.',
  taiwan: 'Taiwan tensions carry semiconductor supply chain risk — NVDA and SOXX.',
  semiconductor: 'AI demand directly relevant to NVDA, SOXX, and SKYT positions.',
  nvidia: 'AI infrastructure demand — core driver of semiconductor momentum.',
  'artificial intelligence': 'AI breakthroughs accelerate sector rotation toward infrastructure.',
  quantum: 'Federal quantum investment — directly relevant to IONQ momentum.',
  'central bank': 'Global monetary policy coordination affects cross-asset positioning.',
  'treasury yield': 'Yield changes reprice risk assets and portfolio duration risk.',
  'bond yield': 'Rate movements affect growth stock valuations significantly.',
  sanction: 'Trade restrictions affect global supply chains and commodity flows.',
  tariff: 'Trade barriers reprice input costs and affect multinational earnings.',
  recession: 'Signals trigger defensive rotation away from growth equities.',
  stagflation: 'Worst regime for growth equities — VTIP and commodities outperform.',
}

function getContext(title: string): string {
  const low = title.toLowerCase()
  for (const [k, v] of Object.entries(CONTEXT_MAP)) {
    if (low.includes(k)) return v
  }
  return ''
}

function isHighSignal(title: string): boolean {
  const low = title.toLowerCase()
  return HIGH_SIGNAL.some(w => low.includes(w))
}

function classifyArticle(title: string): { label: string; category: string } {
  const low = title.toLowerCase()
  const geo = ['war','attack','sanction','missile','coup','military','nuclear','invasion','conflict']
  const fin = ['market','stock','inflation','fed','crypto','oil','rate','nasdaq','gdp','yield','trade','recession']
  const tech = ['ai','semiconductor','nvidia','quantum','chip','openai']
  if (geo.some(w => low.includes(w))) return { label: 'geo', category: 'geopolitical' }
  if (fin.some(w => low.includes(w))) return { label: 'macro', category: 'financial' }
  if (tech.some(w => low.includes(w))) return { label: 'tech', category: 'technology' }
  return { label: 'intel', category: 'world' }
}

const FEEDS = [
  { url: 'https://feeds.reuters.com/reuters/businessNews', source: 'Reuters' },
  { url: 'https://feeds.reuters.com/Reuters/worldNews', source: 'Reuters' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC' },
  { url: 'https://rss.dw.com/rdf/rss-en-economy', source: 'DW' },
  { url: 'https://feeds.skynews.com/feeds/rss/business.xml', source: 'Sky' },
]

async function parseFeed(url: string, source: string) {
  const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=14`, {
    next: { revalidate: 600 }
  })
  const d = await r.json()
  if (d.status !== 'ok' || !d.items?.length) return []
  return d.items.map((item: any) => ({
    title: item.title,
    url: item.link,
    source,
    ...classifyArticle(item.title),
    context: getContext(item.title),
    highSignal: isHighSignal(item.title)
  }))
}

export async function GET() {
  try {
    const results = await Promise.allSettled(FEEDS.map(f => parseFeed(f.url, f.source)))
    const allArticles: any[] = []
    results.forEach(r => {
      if (r.status === 'fulfilled') allArticles.push(...r.value)
    })

    if (allArticles.length === 0) throw new Error('no articles')

    // Deduplicate by title similarity, prioritize high signal
    const seen = new Set<string>()
    const filtered = allArticles
      .filter(a => {
        const key = a.title.toLowerCase().slice(0, 40)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

    const highSignal = filtered.filter(a => a.highSignal)
    const articles = (highSignal.length >= 4 ? highSignal : filtered).slice(0, 8)

    const payload = { articles, timestamp: new Date().toISOString(), status: 'live' }
    await setCached('world_news', payload)
    return NextResponse.json(payload)
  } catch {
    const cached = await getCached('world_news')
    if (cached) return NextResponse.json({ ...cached.payload, status: 'cached', cachedAt: cached.updated_at })
    return NextResponse.json({ articles: [], status: 'unavailable' })
  }
}
