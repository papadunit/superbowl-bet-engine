// All data fetched in ONE Claude API call to minimize token usage & rate limits

const PROXY_URL = "/api/claude";

function parseJSON(raw) {
  if (!raw) return null;
  try {
    let c = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const s = c.indexOf("{"), e = c.lastIndexOf("}");
    if (s !== -1 && e > s) return JSON.parse(c.slice(s, e + 1));
  } catch (e) { console.error("Parse error:", e.message, raw?.slice(0, 150)); }
  return null;
}

export async function runFullScan(settings) {
  try {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Search for "Super Bowl LX score Patriots Seahawks" and "Super Bowl odds today". Then respond with ONLY this JSON (no other text):

{"game":{"ne_score":0,"sea_score":0,"quarter":"1","clock":"15:00","possession":"","down_distance":"","last_play":"","status":"pregame","stats":{"ne_yards":0,"sea_yards":0,"ne_to":0,"sea_to":0}},"odds":{"fanduel":{"spread":"-4.5","ml_fav":"-200","ml_dog":"+170","total":"45.5"},"draftkings":{"spread":"-4.5","ml_fav":"-205","ml_dog":"+175","total":"45.5"},"betmgm":{"spread":"-4","ml_fav":"-195","ml_dog":"+165","total":"46"},"favorite":"SEA","best_spread_book":"betmgm","best_ml_book":"draftkings","best_total_book":"draftkings","notes":""},"analysis":{"alerts":[{"type":"spread","confidence":"HIGH","team":"NE","desc":"","action":"","book":"fanduel","reason":"","units":1}],"narrative":"","momentum":"NEUTRAL","strength":5,"wait":false}}

RULES: Fill with REAL data from search. status=pregame|live|halftime|final. American odds (-110,+150). favorite=which team is favored. alerts=0-3 max, only real edges. Aggression=${settings.aggression}/10. If no edge, empty alerts+wait=true. Spread is from favorite's perspective (negative=favorite gives points).`
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { error: err.error || `HTTP ${response.status}`, details: err.details };
    }

    const data = await response.json();
    const parsed = parseJSON(data.text);
    if (!parsed) return { error: "Could not parse response", raw: data.text?.slice(0, 300) };
    return { ...parsed, searches: data.searches };
  } catch (err) {
    return { error: err.message };
  }
}
