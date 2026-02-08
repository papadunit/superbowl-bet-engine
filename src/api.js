const PROXY_URL = "/api/claude";

function parseJSON(raw) {
  if (!raw) return null;
  try {
    let c = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const s = c.indexOf("{"), e = c.lastIndexOf("}");
    if (s !== -1 && e > s) return JSON.parse(c.slice(s, e + 1));
  } catch (e) { console.error("Parse:", e.message, raw?.slice(0, 200)); }
  return null;
}

export async function runFullScan(settings) {
  try {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `You are an elite sports betting analyst and sharp handicapper. It's Super Bowl LX: New England Patriots vs Seattle Seahawks, February 8, 2026.

Search the web for:
1. "Super Bowl LX score Patriots Seahawks live"
2. "Super Bowl LX player stats leaders"
3. "Super Bowl LX betting odds props parlays"

Gather: live score, key player performances (passing yards, rushing yards, receiving yards, touchdowns), current odds (spread, moneyline, total), and player prop lines.

Then analyze ALL data to find the sharpest betting opportunities — straights AND parlays. Look for:
- Player props with edge (QB passing yards over/under, RB rushing, WR receiving, anytime TD scorers)
- Correlated parlays (bets that logically connect — e.g. team wins + their QB over passing yards)
- Live line value (spreads/totals slow to adjust to game flow)
- Momentum-based opportunities
- Scoring pace vs total
- Turnover-driven short fields

Aggression level: ${settings.aggression}/10 (${settings.aggression >= 7 ? "aggressive — find more plays, lower threshold" : settings.aggression <= 3 ? "very selective — only strongest edges" : "moderate — solid edges only"})

Respond with ONLY this JSON (no other text, no markdown):

{"game":{"ne_score":0,"sea_score":0,"quarter":"1","clock":"15:00","possession":"","status":"pregame","last_play":"","down":""},"players":{"passing":[{"name":"","team":"","yards":0,"td":0,"int":0,"comp":""}],"rushing":[{"name":"","team":"","yards":0,"td":0,"carries":0}],"receiving":[{"name":"","team":"","yards":0,"td":0,"rec":0,"targets":0}]},"odds":{"favorite":"SEA","spread":"-4.5","ne_ml":"+170","sea_ml":"-200","total":"45.5","fanduel_spread":"-4.5","dk_spread":"-4.5","betmgm_spread":"-4","best_spread_book":"betmgm","best_ml_book":"draftkings"},"bets":[{"id":"b1","type":"straight|parlay|player_prop","confidence":"LOCK|HIGH|MED","title":"short punchy title","legs":[{"pick":"specific bet","odds":"-110","book":"fanduel|draftkings|betmgm"}],"reasoning":"2-3 sentences explaining the edge","units":1,"ev_rating":8}],"narrative":"2-3 sentence game flow + market summary","momentum":"NE|SEA|NEUTRAL","strength":5}

BET RULES:
- "bets" array: 0-5 bets. Quality over quantity.
- For parlays: multiple items in "legs" array. For straights: single leg.
- type: "straight" for single bets, "parlay" for multi-leg, "player_prop" for player props
- confidence: "LOCK" = extremely strong (rare), "HIGH" = strong edge, "MED" = decent value
- ev_rating: 1-10 scale of expected value
- ALWAYS specify which sportsbook has the best line for each leg
- For player props include the player name and the over/under line
- For parlays, explain WHY the legs correlate
- If pregame: focus on pregame value — line discrepancies, player prop edges based on matchup analysis, sharp money indicators
- If live: focus on game flow, who's hot, pace, momentum shifts
- title should be catchy and clear like "Metcalf Over 75.5 Rec Yards" or "SEA -4.5 + DK Metcalf ATTD Parlay"
- Include actual odds numbers when possible`
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { error: err.error || `HTTP ${response.status}`, details: err.details };
    }

    const data = await response.json();
    const parsed = parseJSON(data.text);
    if (!parsed) return { error: "Could not parse AI response", raw: data.text?.slice(0, 400) };
    return { ...parsed, searches: data.searches };
  } catch (err) {
    return { error: err.message };
  }
}
