# 🏈 Super Bowl LX — Live Betting Strategy Engine

AI-powered live betting command center for Super Bowl LX. Monitors the game in real-time, scans odds across **FanDuel, DraftKings, BetMGM, and Underdog**, and generates sharp betting recommendations using Claude AI.

## 🎯 Features

- **📡 Live Game Monitoring** — Real-time scores, play-by-play, possession, and stats via Claude AI + web search
- **💰 4-Book Odds Scanner** — Compares live lines across FanDuel, DraftKings, BetMGM, and Underdog
- **🧠 7 Betting Strategies** — AI analyzes momentum, scoring pace, turnovers, line value, and more
- **📊 Line Shopping** — Highlights which sportsbook has the best number for each bet
- **💵 P/L Tracker** — Track bets, mark results, monitor real-time profit/loss

## 🏗 Architecture

```
Browser → /api/claude (Vercel Serverless) → Anthropic API (with web search)
```

All Claude API calls go through a server-side proxy (`/api/claude.js`). This solves CORS issues and keeps your API key secure — it never touches the browser.

## 🚀 Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "🏈 Super Bowl LX Bet Engine"
git remote add origin https://github.com/YOUR_USERNAME/superbowl-bet-engine.git
git push -u origin main
```

### 2. Deploy on Vercel
- Go to [vercel.com/new](https://vercel.com/new) → Import your repo
- Vercel auto-detects Vite — defaults are fine
- **Add Environment Variable:**
  - Key: `ANTHROPIC_API_KEY`
  - Value: your `sk-ant-...` key from [console.anthropic.com](https://console.anthropic.com)
- Hit **Deploy**

### 3. Use It
- Visit your `.vercel.app` URL
- Hit **📡 SCAN NOW** to pull live data
- Enable **AUTO** refresh during the game (30s-2min intervals)

## 📁 Project Structure

```
superbowl-bet-engine/
├── api/
│   └── claude.js               ← Vercel serverless proxy (handles API key + CORS)
├── src/
│   ├── main.jsx                ← React entry
│   ├── App.jsx                 ← App wrapper
│   ├── api.js                  ← Frontend API layer (calls /api/claude)
│   └── SuperBowlLiveEngine.jsx ← Main engine UI
├── index.html
├── package.json
├── vite.config.js
├── vercel.json                 ← Vercel routing config
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

## 🔥 Strategy Engine

| Strategy | Trigger | Bet Type |
|----------|---------|----------|
| Momentum Shift | 10+ unanswered points | Live spread on trailing team |
| Scoring Pace | Pace deviates from O/U | Live over/under |
| Turnover Impact | Recent turnover | Next score props |
| Line Shopping | Best number across books | Any bet type |
| Live Value | Lines slow to adjust | Edge exploitation |
| Halftime | 3-14 pt gap near half | 2nd half spread |
| Late Game ML | Q4 one-score game | Moneyline trailing team |

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Aggression | 6 | 1=conservative, 10=degen. Controls alert frequency & unit sizing |
| Unit Size | $25 | Base bet amount per unit |
| Bankroll | $500 | Total budget. Tracks remaining balance |
| Auto Refresh | Off | Scan interval: 30s, 60s, 90s, or 2min |

## ⚠️ Disclaimers

- **Not financial advice.** Gambling involves risk. Bet only what you can afford to lose.
- **No automated betting.** This app recommends bets — you place them manually.
- **Bet responsibly.** Problem gambling? Call 1-800-522-4700.

## 📜 License

MIT

---

Built for Super Bowl LX — Patriots vs Seahawks — February 8, 2026
