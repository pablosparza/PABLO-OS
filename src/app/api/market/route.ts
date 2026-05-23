import { NextResponse } from 'next/server'
import { getCached, setCached } from '@/lib/cache'

const SYMBOLS = ['SPY','QQQ','NVDA','IONQ','SOXX','PLTR','RGTI','TSLA','AMD','MSTR','MU','MCHP','AMCA']
const PORTFOLIO = ['VTI','VXUS','AVUV','AVDV','VTIP','RXRX','BE','MBLY','SKYT']

async function fetchQuote(symbol: string): Promise<any> {
  // Try Yahoo Finance (server-side, no CORS)
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 60 }
    })
    const d = await r.json()
    const result = d?.chart?.result?.[0]
    if (!result) throw new Error('no result')
    const meta = result.meta
    const price = meta.regularMarketPrice
    const prev = meta.chartPreviousClose || meta.previousClose || price
    const change = prev ? ((price - prev) / prev * 100) : 0
    return { symbol, price, change, up: change >= 0, source: 'yahoo' }
  } catch {}

  // Try Alpha Vantage free tier
  try {
    const r = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=demo`,
      { next: { revalidate: 120 } }
    )
    const d = await r.json()
    const q = d['Global Quote']
    if (!q || !q['05. price']) throw new Error()
    const price = parseFloat(q['05. price'])
    const change = parseFloat(q['10. change percent'].replace('%', ''))
    return { symbol, price, change, up: change >= 0, source: 'alphavantage' }
  } catch {}

  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'movers'
  const symbols = type === 'portfolio' ? PORTFOLIO : SYMBOLS
  const cacheKey = `market_${type}`

  // Try live fetch
  try {
    const results = await Promise.allSettled(symbols.map(fetchQuote))
    const data: Record<string, any> = {}
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) {
        data[symbols[i]] = r.value
      }
    })

    if (Object.keys(data).length > 0) {
      const payload = {
        data,
        timestamp: new Date().toISOString(),
        status: 'live'
      }
      await setCached(cacheKey, payload)
      return NextResponse.json(payload)
    }
  } catch {}

  // Fall back to cache
  const cached = await getCached(cacheKey)
  if (cached) {
    return NextResponse.json({
      ...cached.payload,
      status: 'cached',
      cachedAt: cached.updated_at
    })
  }

  return NextResponse.json({
    data: {},
    status: 'unavailable',
    message: 'Market data temporarily unavailable'
  })
}
