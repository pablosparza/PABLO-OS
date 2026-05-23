# Pablo OS — Deploy in 5 steps

## What this is
A proper Next.js app. All API calls happen server-side — no CORS ever.
Backend fetches Yahoo Finance, Marketaux, BBC, Reuters, CoinGecko, your Google Calendar.
Frontend calls /api/* routes on your own domain.
Supabase caches last-known-good data so the dashboard never shows "Loading...".

---

## STEP 1 — Supabase cache table (1 min)

1. Go to https://supabase.com/dashboard/project/qciuznawebkgpuhqzdoi
2. Click "SQL Editor" in the left sidebar
3. Click "New query"
4. Paste the contents of supabase-setup.sql
5. Click "Run"

---

## STEP 2 — GitHub (2 min)

Option A — GitHub Desktop (easiest):
1. Download GitHub Desktop: https://desktop.github.com
2. Sign in with your GitHub account
3. File → Add Local Repository → select this folder (pablo-os)
4. Click "Publish repository" → name it pablo-os → make it private → Publish

Option B — Terminal:
```
cd ~/Downloads/pablo-os
git init
git add .
git commit -m "initial"
gh repo create pablo-os --private --push --source=.
```

---

## STEP 3 — Vercel deploy (2 min)

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Find pablo-os → Import
4. Under "Environment Variables", add each line from vercel-env.txt
5. Click "Deploy"
6. Wait ~60 seconds → you get a live URL like pablo-os.vercel.app

---

## STEP 4 — Set NEXT_PUBLIC_APP_URL

After deploy, Vercel shows your URL.
Go to Vercel → Settings → Environment Variables → Add:
  NEXT_PUBLIC_APP_URL = https://your-pablo-os-url.vercel.app

Then Redeploy (Deployments → ... → Redeploy).

---

## STEP 5 — Done

Open your URL. Everything loads. Calendar shows. No CORS. No spinners.

Data flow:
Browser → /api/intelligence → Yahoo Finance, Marketaux, RSS, CoinGecko, iCal
                             → Supabase cache (if APIs fail, last-known data shown with timestamp)

---

## What each API route does

/api/market      — Yahoo Finance (server-side, no CORS) for SPY, QQQ, NVDA etc
/api/crypto      — CoinGecko for BTC, ETH  
/api/news        — Marketaux for market intelligence with sentiment
/api/world       — Reuters + BBC RSS for high-signal world news (filtered)
/api/calendar    — Parses your Google Calendar iCal server-side
/api/intelligence — Orchestrates all feeds into a ranked briefing

All routes cache to Supabase on success.
On failure they return cached data with a timestamp.
Never fake numbers. Never silent failures.
