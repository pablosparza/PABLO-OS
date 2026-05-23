import { NextResponse } from 'next/server'
import { getCached, setCached } from '@/lib/cache'

const MAUX_KEY = process.env.MARKETAUX_KEY || 'b6MZ3DivyyUzedSJBR2KaqRO6WyHubYbyCiYue79'

const CONTEXT_MAP: Record<string, string> = {
  SPY: 'Broad market — affects your entire equity portfolio.',
  NVDA: 'AI infrastructure demand — core semiconductor momentum.',
  IONQ: 'Quantum sector — federal investment catalyst.',
  BTC: 'Crypto risk proxy — 24hr risk-on/off leading indicator.',
  QQQ: 'Tech concentration — growth equity leadership.',
  SOXX: 'Semiconductor cycle — SKYT position relevance.',
  TSLA: 'EV/AI sentiment — innovation theme indicator.',
  AMD: 'AI chip competition — NVDA counterweight.',
  PLTR: 'AI software infrastructure — government intelligence play.',
}

export async function GET() {
  try {
    const r = await fetch(
      `https://api.marketaux.com/v1/news/all?symbols=SPY,NVDA,IONQ,BTC,QQQ,SOXX,TSLA,AMD,PLTR&filter_entities=true&language=en&limit=8&api_token=${MAUX_KEY}`,
      { next: { revalidate: 300 } }
    )
    const d = await r.json()
    if (!d.data?.length) throw new Error('no data')

    const articles = d.data.map((a: any) => {
      const src = (a.source || '').replace(/https?:\/\//, '').split('.')[0].toUpperCase().slice(0, 8) || 'MARKET'
      const sent = a.entities?.[0]?.sentiment_score || 0
      const sentiment = sent > 0.1 ? 'bullish' : sent < -0.1 ? 'bearish' : 'neutral'
      const tickers = a.entities?.map((e: any) => e.symbol).filter(Boolean).slice(0, 2) || []
      const context = tickers.map((t: string) => CONTEXT_MAP[t]).find(Boolean) || ''
      return { title: a.title, url: a.url, source: src, sentiment, sentScore: sent, tickers, context }
    })

    const payload = { articles, timestamp: new Date().toISOString(), status: 'live' }
    await setCached('market_news', payload)
    return NextResponse.json(payload)
  } catch {
    const cached = await getCached('market_news')
    if (cached) return NextResponse.json({ ...cached.payload, status: 'cached', cachedAt: cached.updated_at })
    return NextResponse.json({ articles: [], status: 'unavailable' })
  }
}
