// ── Claude API Integration ────────────────────────────────
// Uses the Anthropic Messages API with web search tool
// to fetch live game data and sportsbook odds in real-time.
//
// IMPORTANT: This app is designed to run in environments where
// the Anthropic API key is handled automatically (e.g., Claude.ai artifacts).
//
// For standalone deployment, you'll need to either:
//   1. Set up a backend proxy that injects your API key
//   2. Use environment variables with a serverless function
//
// NEVER put your API key directly in frontend code.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

async function callClaude(prompt, apiKey = null) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    }

    const response = await fetch(apiKey ? API_URL : API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("API error:", response.status, err);
      return null;
    }

    const data = await response.json();
    return data.content?.map(item => item.text || "").filter(Boolean).join("\n") || "";
  } catch (err) {
    console.error("Claude API error:", err);
    return null;
  }
}

function parseJSON(raw) {
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    console.error("JSON parse error:", e);
  }
  return null;
}

// ── Fetch live game score + state ─────────────────────────
export async function fetchLiveGameData(apiKey = null) {
  const prompt = `Search for the LIVE score and current game state of Super Bowl LX between New England Patriots and Seattle Seahawks happening on February 8, 2026.

I need you to respond ONLY with a JSON object in this exact format, no markdown, no backticks, no explanation:
{"ne_score":0,"sea_score":0,"quarter":"1","clock":"15:00","possession":"NE","down_distance":"1st & 10","last_play":"","yard_line":"","status":"pregame","key_stats":{"ne_total_yards":0,"sea_total_yards":0,"ne_turnovers":0,"sea_turnovers":0,"ne_passing_yards":0,"sea_passing_yards":0,"ne_rushing_yards":0,"sea_rushing_yards":0}}

For status use: "pregame", "live", "halftime", "final". Use the ACTUAL live data from your search results. If the game hasn't started yet, use pregame status.`;

  const result = await callClaude(prompt, apiKey);
  return parseJSON(result);
}

// ── Fetch live odds across sportsbooks ────────────────────
export async function fetchLiveOdds(apiKey = null) {
  const prompt = `Search for the CURRENT betting odds for Super Bowl LX Patriots vs Seahawks across FanDuel, DraftKings, BetMGM, and Underdog Fantasy. I need spread, moneyline, and over/under from each book.

Respond ONLY with a JSON object, no markdown, no backticks, no extra text:
{"timestamp":"","books":{"fanduel":{"spread":{"ne":"","sea":"","line":""},"moneyline":{"ne":"","sea":""},"over_under":{"total":"","over":"","under":""}},"draftkings":{"spread":{"ne":"","sea":"","line":""},"moneyline":{"ne":"","sea":""},"over_under":{"total":"","over":"","under":""}},"betmgm":{"spread":{"ne":"","sea":"","line":""},"moneyline":{"ne":"","sea":""},"over_under":{"total":"","over":"","under":""}},"underdog":{"spread":{"ne":"","sea":"","line":""},"moneyline":{"ne":"","sea":""},"over_under":{"total":"","over":"","under":""}}},"best_bets":{"best_ne_spread":"","best_sea_spread":"","best_ne_ml":"","best_sea_ml":"","best_over":"","best_under":""},"notes":""}

Fill in real odds from your search in American format (+150, -110, etc). For best_bets, name the sportsbook with the best line. Use "N/A" for anything unavailable.`;

  const result = await callClaude(prompt, apiKey);
  return parseJSON(result);
}

// ── Strategic analysis combining game + odds ──────────────
export async function getStrategicAnalysis(gameData, oddsData, settings, apiKey = null) {
  const prompt = `You are an elite sports betting analyst. Analyze this LIVE Super Bowl LX game state and odds data to identify sharp betting opportunities.

LIVE GAME STATE:
${JSON.stringify(gameData, null, 2)}

LIVE ODDS ACROSS BOOKS:
${JSON.stringify(oddsData, null, 2)}

BETTOR SETTINGS:
- Aggression: ${settings.aggression}/10 (10=max risk)
- Unit size: $${settings.unitSize}
- Bankroll remaining: $${settings.bankroll}

Run these strategy checks:
1. MOMENTUM SHIFT — Is one team on an unanswered scoring run (10+ pts)? Flag live spread value on trailing team.
2. SCORING PACE — Project total points based on current pace vs the posted over/under. Flag over or under if significant deviation.
3. TURNOVER IMPACT — Recent turnovers creating short-field scoring opportunities?
4. LINE SHOPPING — Which specific book has the best number for each bet type right now?
5. LIVE VALUE — Are any lines slow to adjust to game flow? Where is there exploitable edge?
6. HALFTIME / QUARTER — Near halftime or end of quarter with strategic 2H or quarter bet value?
7. LATE GAME — 4th quarter one-score game moneyline value on trailing team?

Respond ONLY with JSON, no markdown, no backticks:
{"alerts":[{"type":"spread|moneyline|over_under|prop|next_score|quarter","confidence":"HIGH|MED|LOW","team":"NE|SEA|OVER|UNDER","description":"short description of the opportunity","action":"specific instruction on what to bet and where","best_book":"fanduel|draftkings|betmgm|underdog","reasoning":"why this is a good bet right now","units":1}],"game_narrative":"2-3 sentence game flow summary","momentum":"NE|SEA|NEUTRAL","momentum_strength":5,"recommended_wait":false,"wait_reason":""}

RULES:
- Generate 0-3 alerts MAX. Quality over quantity.
- Only flag genuine edges. No filler alerts.
- If pregame or no clear edge, return empty alerts and recommended_wait=true.
- Higher aggression setting = lower confidence threshold for alerts.
- Always specify which book has the best line for each alert.
- momentum_strength: 1-10 scale.`;

  const result = await callClaude(prompt, apiKey);
  return parseJSON(result);
}
