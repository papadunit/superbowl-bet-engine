// ── Frontend API Layer ────────────────────────────────────
// All calls go through /api/claude (Vercel Serverless)

const PROXY_URL = "/api/claude";

async function callClaude(prompt, type = "general") {
  try {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, type }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Unknown error" }));
      console.error(`[api] ${type} failed:`, response.status, err);
      return { text: null, error: err.error || `HTTP ${response.status}`, details: err.details };
    }

    const data = await response.json();
    console.log(`[api] ${type} OK: ${data.text?.length || 0} chars, ${data.search_count || 0} searches`);
    return { text: data.text || null, error: null, searches: data.search_count };
  } catch (err) {
    console.error(`[api] ${type} network error:`, err);
    return { text: null, error: err.message };
  }
}

function parseJSON(raw) {
  if (!raw) return null;
  try {
    // Remove markdown code fences
    let cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    // Find the outermost JSON object
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
  } catch (e) {
    console.error("[api] JSON parse error:", e.message, "raw:", raw?.slice(0, 200));
  }
  return null;
}

// ── Fetch live game score + state ─────────────────────────
export async function fetchLiveGameData() {
  const prompt = `Search the web for "Super Bowl LX score today" to find the current score of the Patriots vs Seahawks Super Bowl game on February 8, 2026.

You MUST respond with ONLY a JSON object. No other text before or after. No markdown. No explanation.

{"ne_score":0,"sea_score":0,"quarter":"1","clock":"15:00","possession":"NE","down_distance":"","last_play":"","yard_line":"","status":"pregame","key_stats":{"ne_total_yards":0,"sea_total_yards":0,"ne_turnovers":0,"sea_turnovers":0,"ne_passing_yards":0,"sea_passing_yards":0,"ne_rushing_yards":0,"sea_rushing_yards":0}}

Rules:
- status must be one of: "pregame", "live", "halftime", "final"  
- Use actual data from your web search
- If game hasn't started, use status "pregame" with 0-0
- Output ONLY the JSON object, nothing else`;

  const result = await callClaude(prompt, "game");
  if (result.error) return { _error: result.error, _details: result.details };
  return parseJSON(result.text);
}

// ── Fetch live odds across sportsbooks ────────────────────
export async function fetchLiveOdds() {
  const prompt = `Search the web for Super Bowl LX betting odds. Try these searches:
1. "Patriots Seahawks Super Bowl odds"
2. "Super Bowl 2026 betting lines spread"

Find the point spread, moneyline, and over/under total for this game.

You MUST respond with ONLY a JSON object. No other text. No markdown. No explanation.

{"timestamp":"now","books":{"fanduel":{"spread":{"ne":"-110","sea":"-110","line":"-4.5"},"moneyline":{"ne":"+170","sea":"-200"},"over_under":{"total":"45.5","over":"-110","under":"-110"}},"draftkings":{"spread":{"ne":"-110","sea":"-110","line":"-4.5"},"moneyline":{"ne":"+175","sea":"-205"},"over_under":{"total":"45.5","over":"-108","under":"-112"}},"betmgm":{"spread":{"ne":"-110","sea":"-110","line":"-4"},"moneyline":{"ne":"+165","sea":"-195"},"over_under":{"total":"46","over":"-110","under":"-110"}},"underdog":{"spread":{"ne":"N/A","sea":"N/A","line":"N/A"},"moneyline":{"ne":"N/A","sea":"N/A"},"over_under":{"total":"N/A","over":"N/A","under":"N/A"}}},"best_bets":{"best_ne_spread":"betmgm","best_sea_spread":"fanduel","best_ne_ml":"draftkings","best_sea_ml":"betmgm","best_over":"draftkings","best_under":"fanduel"},"notes":""}

CRITICAL RULES:
- The above is an EXAMPLE with placeholder numbers. Replace with REAL odds from your search.
- American odds format: -110, +150, -200, etc.
- "line" = point spread number like "-4.5" or "+3"
- If you found general consensus odds but not book-specific, apply them to FanDuel/DraftKings/BetMGM with tiny realistic variations
- Underdog Fantasy is DFS — put N/A for their fields
- best_bets = which book has the best line for each bet type
- notes = brief description of what you found
- You MUST populate the fields with real data. Do NOT return the example numbers above.
- Output ONLY the JSON, nothing else`;

  const result = await callClaude(prompt, "odds");
  if (result.error) return { _error: result.error, _details: result.details };
  return parseJSON(result.text);
}

// ── Strategic analysis ────────────────────────────────────
export async function getStrategicAnalysis(gameData, oddsData, settings) {
  const prompt = `You are an elite sports betting analyst. Analyze Super Bowl LX (Patriots vs Seahawks, Feb 8 2026).

Search the web for "Super Bowl LX latest" to get any updates.

GAME STATE: ${JSON.stringify(gameData)}
ODDS: ${JSON.stringify(oddsData)}
SETTINGS: Aggression ${settings.aggression}/10, Unit $${settings.unitSize}, Bankroll $${settings.bankroll}

Check these strategies:
1. MOMENTUM — Unanswered 10+ pt run? Trailing team spread value.
2. SCORING PACE — Pace vs O/U total. Flag over/under.
3. TURNOVERS — Short-field opportunities.
4. LINE SHOPPING — Best number across books.
5. LIVE VALUE — Slow-adjusting lines.
6. HALFTIME — 3-14 pt gap near half, 2H spread.
7. LATE GAME — Q4 one-score, trailing team ML.
8. PREGAME — If pregame, flag any book-to-book discrepancies or sharp value.

You MUST respond with ONLY a JSON object. No other text. No markdown.

{"alerts":[{"type":"spread","confidence":"HIGH","team":"SEA","description":"example","action":"example","best_book":"fanduel","reasoning":"example","units":1}],"game_narrative":"summary","momentum":"NEUTRAL","momentum_strength":5,"recommended_wait":false,"wait_reason":""}

Rules:
- 0-3 alerts only. Real edges only.
- Aggression ${settings.aggression}/10: ${settings.aggression >= 7 ? "aggressive — more alerts ok" : settings.aggression <= 3 ? "very selective" : "moderate"}
- If no edge, empty alerts array + recommended_wait=true
- Output ONLY the JSON, nothing else`;

  const result = await callClaude(prompt, "strategy");
  if (result.error) return { _error: result.error, _details: result.details };
  return parseJSON(result.text);
}
