import { NextResponse } from 'next/server'
import { getCached, setCached } from '@/lib/cache'

export async function GET() {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
      { next: { revalidate: 60 } }
    )
    const d = await r.json()
    const payload = {
      btc: {
        price: d.bitcoin.usd,
        change: d.bitcoin.usd_24h_change,
        up: d.bitcoin.usd_24h_change >= 0
      },
      eth: {
        price: d.ethereum.usd,
        change: d.ethereum.usd_24h_change,
        up: d.ethereum.usd_24h_change >= 0
      },
      timestamp: new Date().toISOString(),
      status: 'live'
    }
    await setCached('crypto', payload)
    return NextResponse.json(payload)
  } catch {
    const cached = await getCached('crypto')
    if (cached) return NextResponse.json({ ...cached.payload, status: 'cached', cachedAt: cached.updated_at })
    return NextResponse.json({ status: 'unavailable' })
  }
}
