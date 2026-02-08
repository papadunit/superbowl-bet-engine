# 🏈 Super Bowl LX — Live Betting Strategy Engine

AI-powered live betting command center that monitors the Super Bowl in real-time, scans odds across **FanDuel, DraftKings, BetMGM, and Underdog**, and uses Claude AI to generate sharp betting recommendations based on configurable strategies.

![Engine](https://img.shields.io/badge/Powered_by-Claude_AI-blue)
![Status](https://img.shields.io/badge/Super_Bowl_LX-Patriots_vs_Seahawks-red)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎯 What It Does

- **📡 Live Game Monitoring** — Pulls real-time scores, play-by-play, possession, down & distance, and key stats via Claude AI web search
- **💰 Multi-Book Odds Scanner** — Compares live lines across FanDuel, DraftKings, BetMGM, and Underdog simultaneously
- **🧠 AI Strategy Engine** — Analyzes 7 betting strategies in real-time and generates targeted alerts
- **📊 Line Shopping** — Highlights which sportsbook has the best number for each bet type
- **💵 P/L Tracker** — Track placed bets, mark results, and monitor your real-time profit/loss

## 🔥 Strategy Engine

The AI analyzes these strategies on every scan:

| Strategy | Trigger | Bet Type |
|----------|---------|----------|
| **Momentum Shift** | 10+ unanswered points | Live spread on trailing team |
| **Scoring Pace** | Total pace deviates from O/U | Live over/under |
| **Turnover Impact** | Recent turnover | Next score props |
| **Line Shopping** | Best number across books | Any bet type |
| **Live Value** | Lines slow to adjust | Edge exploitation |
| **Halftime** | 3-14 pt gap near half | 2nd half spread |
| **Late Game ML** | Q4 one-score game | Moneyline trailing team |

## 🚀 Quick Start

### Run in Claude.ai (Easiest)
1. Open Claude.ai
2. Paste the contents of `src/SuperBowlLiveEngine.jsx` as a React artifact
3. Hit **SCAN NOW** — no API key needed!

### Run Locally
```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/superbowl-bet-engine.git
cd superbowl-bet-engine

# Install dependencies
npm install

# Start dev server
npm run dev
```

### API Key Setup

For standalone deployment, you'll need an Anthropic API key:

1. Get your key at [console.anthropic.com](https://console.anthropic.com)
2. Click 🔑 **API Key** in the app and paste it in
3. Or set up a backend proxy for production (recommended)

> ⚠️ **Never commit your API key to the repo.** For production, use a serverless function or backend proxy to inject the key server-side.

## 🎮 How to Use

### Before Kickoff
1. Open the app and click **📡 SCAN NOW** to grab pregame lines
2. Configure your strategy in **⚙️ Settings**:
   - **Aggression** (1-10): Controls alert sensitivity and bet sizing
   - **Unit Size**: Your base bet amount in dollars
   - **Bankroll**: Total budget for the game
3. Review odds comparison table to see which books have the best pregame numbers

### During the Game
1. Enable **AUTO** refresh (30s-2min intervals)
2. Watch the **⚡ ALERTS** tab for betting opportunities
3. Each alert shows:
   - **Confidence level** (HIGH / MED / LOW)
   - **Exact bet description** and action
   - **Which sportsbook** has the best line
   - **Unit sizing** based on your settings
4. Hit **PLACE BET →** when you pull the trigger on the sportsbook
5. Mark each bet as **WON ✓**, **LOST ✕**, or **PUSH** after it settles

### Track Results
- **💰 BETS** tab shows your running P/L
- **📟 SCAN LOG** shows all engine activity
- **📈 MOMENTUM** shows real-time game flow analysis

## 🏗 Tech Stack

- **React 18** + **Vite** — Fast, modern frontend
- **Claude API** (Sonnet) — AI-powered analysis with web search
- **Zero dependencies** — No external UI libraries, pure inline styles

## 📁 Project Structure

```
superbowl-bet-engine/
├── index.html              # Entry HTML
├── package.json            # Dependencies
├── vite.config.js          # Vite configuration
├── .gitignore              
├── .env.example            # Environment variable template
├── README.md               
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # App wrapper
    ├── api.js              # Claude API integration layer
    └── SuperBowlLiveEngine.jsx  # Main engine component
```

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Aggression | 6 | 1=conservative, 10=maximum risk. Controls alert frequency & unit sizing |
| Unit Size | $25 | Base bet amount. Alerts recommend 1-3 units per bet |
| Bankroll | $500 | Total available budget. App tracks remaining balance |
| Auto Refresh | Off | Auto-scan interval: 30s, 60s, 90s, or 2min |

## 🛡 Disclaimers

- **This is NOT financial advice.** Gambling involves risk. Only bet what you can afford to lose.
- **Bet responsibly.** If you or someone you know has a gambling problem, call 1-800-522-4700.
- **No automated betting.** This app recommends bets — you place them manually on the sportsbook.
- **Odds data** is sourced via web search and may have slight delays vs live book prices.

## 📜 License

MIT — use it, modify it, ship it.

---

Built with 🏈 for Super Bowl LX — Patriots vs Seahawks — February 8, 2026
