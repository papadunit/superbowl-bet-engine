import { useState, useEffect, useCallback, useRef } from "react";
import { runFullScan } from "./api";

const BOOKS = [
  { id: "fanduel", name: "FanDuel", color: "#1493ff", icon: "🔵" },
  { id: "draftkings", name: "DraftKings", color: "#53d337", icon: "🟢" },
  { id: "betmgm", name: "BetMGM", color: "#c4a44a", icon: "🟡" },
];

const TEAMS = {
  NE: { name: "Patriots", accent: "#C60C30" },
  SEA: { name: "Seahawks", accent: "#69BE28" },
};

export default function SuperBowlLiveEngine() {
  const [game, setGame] = useState(null);
  const [odds, setOdds] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [placedBets, setPlacedBets] = useState([]);
  const [activeTab, setActiveTab] = useState("live");
  const [isScanning, setIsScanning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(120);
  const [scanLog, setScanLog] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [flashAlert, setFlashAlert] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({ aggression: 6, unitSize: 25, bankroll: 500 });
  const intervalRef = useRef(null);

  const log = useCallback((msg, type = "info") => {
    setScanLog(p => [{ msg, type, time: new Date() }, ...p].slice(0, 80));
  }, []);

  const doScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    setError(null);
    log("━━━ SCANNING ━━━", "scan");
    log("📡 Fetching game + odds + strategy in single call...", "scan");

    const result = await runFullScan(settings);

    if (result.error) {
      log(`⚠️ Error: ${result.error}`, "error");
      if (result.details) log(`   ${String(result.details).slice(0, 200)}`, "error");
      if (result.error.includes("429")) {
        setError("Rate limited — wait 60s then try again. Consider setting auto-refresh to 2min+.");
      } else {
        setError(result.error);
      }
    } else {
      // Game data
      if (result.game) {
        setGame(result.game);
        log(`✅ NE ${result.game.ne_score} — SEA ${result.game.sea_score} | Q${result.game.quarter} ${result.game.clock} | ${(result.game.status || "").toUpperCase()}`, "success");
      }
      // Odds
      if (result.odds) {
        setOdds(result.odds);
        const fav = result.odds.favorite || "SEA";
        log(`✅ Odds loaded | Favorite: ${fav} | Best spread: ${result.odds.best_spread_book} | Best ML: ${result.odds.best_ml_book}`, "success");
        if (result.odds.notes) log(`📝 ${result.odds.notes}`, "info");
      }
      // Analysis
      if (result.analysis) {
        setAnalysis(result.analysis);
        if (result.analysis.alerts?.length > 0) {
          const newAlerts = result.analysis.alerts.map((a, i) => ({ ...a, id: `${Date.now()}-${i}`, timestamp: new Date() }));
          setAlerts(p => [...newAlerts, ...p]);
          setFlashAlert(true);
          setTimeout(() => setFlashAlert(false), 2000);
          log(`🔴 ${newAlerts.length} ALERT${newAlerts.length > 1 ? "S" : ""}`, "alert");
          newAlerts.forEach(a => log(`   → ${a.confidence} | ${a.desc}`, "alert"));
        } else {
          log("✓ No actionable opportunities", "info");
        }
        if (result.analysis.narrative) log(`📊 ${result.analysis.narrative}`, "info");
        if (result.analysis.wait) log("⏸ Engine recommends waiting", "info");
      }
      log(`✅ Used ${result.searches || 0} web searches`, "success");
    }

    setLastUpdate(new Date());
    setIsScanning(false);
    log("━━━ DONE ━━━", "success");
  }, [isScanning, settings, log]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(doScan, refreshInterval * 1000);
      log(`🔄 Auto: every ${refreshInterval}s`, "info");
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, refreshInterval, doScan, log]);

  const placeBet = (alert) => {
    setPlacedBets(p => [{ ...alert, placed: new Date(), totalWager: (alert.units || 1) * settings.unitSize, result: "pending" }, ...p]);
    setAlerts(p => p.filter(a => a.id !== alert.id));
    log(`💰 BET: ${alert.desc} → ${alert.book} ($${(alert.units || 1) * settings.unitSize})`, "alert");
  };
  const resolveBet = (i, r) => setPlacedBets(p => p.map((b, idx) => idx === i ? { ...b, result: r } : b));
  const dismissAlert = (id) => setAlerts(p => p.filter(a => a.id !== id));

  const totalWagered = placedBets.reduce((s, b) => s + b.totalWager, 0);
  const totalWon = placedBets.filter(b => b.result === "won").reduce((s, b) => s + b.totalWager * 1.9, 0);
  const totalLost = placedBets.filter(b => b.result === "lost").reduce((s, b) => s + b.totalWager, 0);
  const netPL = totalWon - totalLost;

  return (
    <div style={{ minHeight: "100vh", background: "#06060c", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#d0d0d0" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet" />
      <div style={{ position: "fixed", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,100,0.008) 3px, rgba(0,255,100,0.008) 4px)", pointerEvents: "none", zIndex: 100 }} />
      {flashAlert && <div style={{ position: "fixed", inset: 0, background: "radial-gradient(circle, rgba(255,50,50,0.2), transparent 70%)", animation: "flash .6s ease-out", pointerEvents: "none", zIndex: 99 }} />}

      {/* HEADER */}
      <header style={{ background: "linear-gradient(180deg, #0c0c14, #06060c)", borderBottom: "1px solid rgba(0,255,100,0.1)", padding: "14px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontFamily: "'Orbitron'", fontSize: 18, fontWeight: 900, background: "linear-gradient(90deg, #00ff64, #00ccff, #ff6b35)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0, letterSpacing: 3 }}>SUPERBOWL LX ENGINE</h1>
            <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginTop: 2 }}>SINGLE-CALL AI SCANNER × 3 BOOKS</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {BOOKS.map(b => <span key={b.id} style={{ fontSize: 9, color: b.color, opacity: 0.7 }}>{b.icon} {b.name.toUpperCase()}</span>)}
          </div>
        </div>
      </header>

      {/* CONTROLS */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={doScan} disabled={isScanning} style={{
          background: isScanning ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg, #00ff6420, #00ccff15)",
          border: `1px solid ${isScanning ? "rgba(255,255,255,0.05)" : "rgba(0,255,100,0.3)"}`,
          borderRadius: 8, padding: "10px 24px", color: isScanning ? "#444" : "#00ff64",
          cursor: isScanning ? "default" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: 1
        }}>{isScanning ? "⏳ SCANNING..." : "📡 SCAN NOW"}</button>

        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: "6px 12px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => setAutoRefresh(!autoRefresh)} style={{
            background: autoRefresh ? "rgba(0,255,100,0.15)" : "transparent",
            border: `1px solid ${autoRefresh ? "rgba(0,255,100,0.3)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 4, padding: "4px 10px", color: autoRefresh ? "#00ff64" : "#555", cursor: "pointer", fontSize: 10, fontFamily: "inherit"
          }}>{autoRefresh ? "AUTO ●" : "AUTO ○"}</button>
          <select value={refreshInterval} onChange={e => setRefreshInterval(parseInt(e.target.value))} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "4px 8px", color: "#888", fontSize: 10, fontFamily: "inherit" }}>
            <option value={90}>90s</option>
            <option value={120}>2min</option>
            <option value={180}>3min</option>
            <option value={300}>5min</option>
          </select>
        </div>

        <button onClick={() => setShowSettings(!showSettings)} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 12px", color: "#666", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>⚙️ Strategy</button>
        {lastUpdate && <span style={{ fontSize: 9, color: "#333", marginLeft: "auto" }}>Last: {lastUpdate.toLocaleTimeString()}</span>}
      </div>

      {error && <div style={{ padding: "10px 20px", background: "rgba(255,50,50,0.08)", borderBottom: "1px solid rgba(255,50,50,0.2)", fontSize: 11, color: "#ff6644" }}>⚠️ {error}</div>}

      {showSettings && (
        <div style={{ padding: "12px 20px", background: "#0a0a12", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Inp label="AGGRESSION" sub="1-10" value={settings.aggression} onChange={v => setSettings(p => ({ ...p, aggression: Math.min(10, Math.max(1, parseInt(v) || 5)) }))} />
          <Inp label="UNIT ($)" sub="base bet" value={settings.unitSize} onChange={v => setSettings(p => ({ ...p, unitSize: parseInt(v) || 25 }))} />
          <Inp label="BANKROLL ($)" sub="total" value={settings.bankroll} onChange={v => setSettings(p => ({ ...p, bankroll: parseInt(v) || 500 }))} />
          <div style={{ fontSize: 9, color: "#333", maxWidth: 250, lineHeight: 1.5 }}>Now uses ONE API call per scan to stay under rate limits. Set auto-refresh to 2min+ to be safe.</div>
        </div>
      )}

      {/* SCOREBOARD */}
      <div style={{ padding: "20px", background: "linear-gradient(180deg, rgba(0,255,100,0.02), transparent)" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <TeamBox team="NE" score={game?.ne_score} possession={game?.possession === "NE"} />
          <div style={{ textAlign: "center", minWidth: 110 }}>
            <StatusBadge status={game?.status} />
            <div style={{ fontSize: 12, color: game?.status === "live" ? "#00ff64" : "#555", fontFamily: "'Orbitron'", marginTop: 4 }}>
              {game ? `Q${game.quarter} ${game.clock}` : "6:30 PM EST"}
            </div>
            {game?.down_distance && <div style={{ fontSize: 9, color: "#555", marginTop: 6 }}>{game.down_distance}</div>}
            {game?.last_play && <div style={{ fontSize: 9, color: "#666", marginTop: 6, maxWidth: 220, lineHeight: 1.5, fontStyle: "italic" }}>{game.last_play}</div>}
          </div>
          <TeamBox team="SEA" score={game?.sea_score} possession={game?.possession === "SEA"} />
        </div>
        {game?.stats && (
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            <Mini label="NE YDS" value={game.stats.ne_yards} />
            <Mini label="SEA YDS" value={game.stats.sea_yards} />
            <Mini label="NE TO" value={game.stats.ne_to} bad={game.stats.ne_to > 0} />
            <Mini label="SEA TO" value={game.stats.sea_to} bad={game.stats.sea_to > 0} />
          </div>
        )}
      </div>

      {/* ODDS TABLE */}
      {odds && <OddsTable odds={odds} />}

      {/* TABS */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "0 20px", overflowX: "auto" }}>
        {[{ k: "live", l: "⚡ ALERTS", c: alerts.length }, { k: "bets", l: "💰 BETS", c: placedBets.length }, { k: "log", l: "📟 LOG", c: scanLog.length }, { k: "momentum", l: "📈 MOMENTUM" }].map(t => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
            background: "transparent", border: "none", borderBottom: activeTab === t.k ? "2px solid #00ff64" : "2px solid transparent",
            padding: "10px 16px", color: activeTab === t.k ? "#00ff64" : "#444", cursor: "pointer", fontSize: 11, fontFamily: "inherit", letterSpacing: 1, whiteSpace: "nowrap"
          }}>{t.l} {t.c > 0 && <span style={{ background: "rgba(0,255,100,0.12)", borderRadius: 8, padding: "1px 6px", fontSize: 9, marginLeft: 4 }}>{t.c}</span>}</button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: "14px 20px", minHeight: 200, maxHeight: "40vh", overflowY: "auto", paddingBottom: 60 }}>
        {activeTab === "live" && (alerts.length === 0
          ? <Empty icon="📡" title={isScanning ? "SCANNING..." : "AWAITING SCAN"} sub='Hit SCAN NOW. Uses 1 API call for game + odds + strategy.' />
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{alerts.map(a => <AlertCard key={a.id} alert={a} onPlace={() => placeBet(a)} onDismiss={() => dismissAlert(a.id)} unitSize={settings.unitSize} />)}</div>
        )}

        {activeTab === "bets" && (placedBets.length === 0
          ? <Empty icon="💰" title="NO BETS" sub="Place bets from alerts. Mark WON/LOST/PUSH." />
          : <>
            <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <Stat label="WAGERED" value={`$${totalWagered}`} color="#00ccff" />
              <Stat label="WON" value={`$${totalWon.toFixed(0)}`} color="#00ff64" />
              <Stat label="LOST" value={`$${totalLost}`} color="#ff4444" />
              <Stat label="NET" value={`${netPL >= 0 ? "+" : ""}$${netPL.toFixed(0)}`} color={netPL >= 0 ? "#00ff64" : "#ff4444"} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{placedBets.map((b, i) => <BetCard key={i} bet={b} onResolve={r => resolveBet(i, r)} />)}</div>
          </>
        )}

        {activeTab === "log" && (scanLog.length === 0
          ? <Empty icon="📟" title="NO SCANS" sub="Run first scan." />
          : <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{scanLog.map((e, i) => (
            <div key={i} style={{ fontSize: 11, padding: "3px 0", display: "flex", gap: 8, color: e.type === "alert" ? "#ff6b35" : e.type === "success" ? "#00ff64" : e.type === "error" ? "#ff4444" : e.type === "scan" ? "#00ccff" : "#555" }}>
              <span style={{ color: "#222", minWidth: 72, fontSize: 9, paddingTop: 2, flexShrink: 0 }}>{e.time.toLocaleTimeString()}</span>
              <span style={{ wordBreak: "break-word" }}>{e.msg}</span>
            </div>
          ))}</div>
        )}

        {activeTab === "momentum" && (analysis
          ? <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 12, letterSpacing: 1 }}>MOMENTUM</div>
            <div style={{ fontSize: 32, fontFamily: "'Orbitron'", fontWeight: 900, color: analysis.momentum === "NE" ? TEAMS.NE.accent : analysis.momentum === "SEA" ? TEAMS.SEA.accent : "#555", marginBottom: 8 }}>
              {analysis.momentum === "NE" ? "← PATRIOTS" : analysis.momentum === "SEA" ? "SEAHAWKS →" : "— NEUTRAL —"}
            </div>
            {analysis.strength != null && <div style={{ maxWidth: 300, margin: "0 auto 16px" }}><div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, height: 6, overflow: "hidden" }}><div style={{ width: `${(analysis.strength / 10) * 100}%`, height: "100%", background: analysis.momentum === "NE" ? TEAMS.NE.accent : analysis.momentum === "SEA" ? TEAMS.SEA.accent : "#555", borderRadius: 4 }} /></div><div style={{ fontSize: 9, color: "#444", marginTop: 4 }}>STRENGTH: {analysis.strength}/10</div></div>}
            {analysis.narrative && <div style={{ fontSize: 12, color: "#888", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>{analysis.narrative}</div>}
            {analysis.wait && <div style={{ marginTop: 16, fontSize: 11, color: "#ff6b35", background: "rgba(255,107,53,0.08)", display: "inline-block", padding: "8px 20px", borderRadius: 6, border: "1px solid rgba(255,107,53,0.2)" }}>⏸ WAIT FOR BETTER ENTRY</div>}
          </div>
          : <Empty icon="📈" title="NO DATA" sub="Run a scan first." />
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "linear-gradient(180deg, transparent, #06060c 40%)", padding: "24px 20px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#1a1a1a", letterSpacing: 1, flexWrap: "wrap" }}>
          <span>1 API CALL PER SCAN × CLAUDE AI + WEB SEARCH</span>
          <span>NOT FINANCIAL ADVICE • BET RESPONSIBLY</span>
        </div>
      </div>

      <style>{`
        @keyframes flash{0%{opacity:1}100%{opacity:0}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{border-color:rgba(255,80,50,0.2)}50%{border-color:rgba(255,80,50,0.6)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        input:focus,select:focus{outline:none}
        button:active{transform:scale(0.97)}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,255,100,0.1);border-radius:2px}
        option{background:#111;color:#888}
      `}</style>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────
function TeamBox({ team, score, possession }) {
  const t = TEAMS[team];
  return (
    <div style={{ textAlign: "center", minWidth: 120 }}>
      <div style={{ fontSize: 10, fontFamily: "'Orbitron'", color: t.accent, letterSpacing: 2, marginBottom: 4 }}>{t.name.toUpperCase()}</div>
      <div style={{ fontSize: 52, fontWeight: 900, fontFamily: "'Orbitron'", color: "#fff", textShadow: `0 0 30px ${t.accent}50`, lineHeight: 1 }}>{score ?? "–"}</div>
      {possession && <div style={{ fontSize: 9, color: "#00ff64", marginTop: 6 }}>● POSSESSION</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = status || "pregame";
  const m = { pregame: ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.08)", "#555", "PREGAME"], live: ["rgba(255,50,50,0.12)", "rgba(255,50,50,0.3)", "#ff4444", "● LIVE"], halftime: ["rgba(255,170,0,0.1)", "rgba(255,170,0,0.25)", "#ffaa00", "HALFTIME"], final: ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.08)", "#888", "FINAL"] }[s] || ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.08)", "#555", s.toUpperCase()];
  return <span style={{ background: m[0], border: `1px solid ${m[1]}`, borderRadius: 4, padding: "3px 10px", fontSize: 10, color: m[2], fontWeight: 700, letterSpacing: 1, animation: s === "live" ? "pulse 2s ease-in-out infinite" : "none" }}>{m[3]}</span>;
}

function OddsTable({ odds }) {
  const fav = odds.favorite || "SEA";
  const dog = fav === "SEA" ? "NE" : "SEA";
  return (
    <div style={{ padding: "0 20px 12px", overflowX: "auto" }}>
      <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>LIVE ODDS — {fav} FAVORED</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 500 }}>
        <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {["BOOK", "SPREAD", `${fav} ML`, `${dog} ML`, "TOTAL"].map(h => <th key={h} style={{ textAlign: h === "BOOK" ? "left" : "center", padding: "6px 8px", color: "#444", fontWeight: 500, fontSize: 9 }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {BOOKS.map(book => {
            const d = odds[book.id];
            if (!d) return null;
            const isBestSpread = odds.best_spread_book === book.id;
            const isBestML = odds.best_ml_book === book.id;
            const isBestTotal = odds.best_total_book === book.id;
            return (
              <tr key={book.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td style={{ padding: 8, color: book.color, fontWeight: 600 }}>{book.icon} {book.name}</td>
                <td style={{ textAlign: "center", padding: 8, color: isBestSpread ? "#00ff64" : "#aaa" }}>{d.spread || "–"}</td>
                <td style={{ textAlign: "center", padding: 8, color: isBestML ? "#00ff64" : "#aaa" }}>{d.ml_fav || "–"}</td>
                <td style={{ textAlign: "center", padding: 8, color: isBestML ? "#00ff64" : "#aaa" }}>{d.ml_dog || "–"}</td>
                <td style={{ textAlign: "center", padding: 8, color: isBestTotal ? "#00ff64" : "#888" }}>{d.total || "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {odds.best_spread_book && <Tag label={`BEST SPREAD: ${odds.best_spread_book}`} />}
        {odds.best_ml_book && <Tag label={`BEST ML: ${odds.best_ml_book}`} />}
        {odds.best_total_book && <Tag label={`BEST TOTAL: ${odds.best_total_book}`} />}
      </div>
    </div>
  );
}

function Tag({ label }) {
  return <span style={{ fontSize: 9, color: "#00ff64", background: "rgba(0,255,100,0.06)", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(0,255,100,0.15)" }}>{label.toUpperCase()}</span>;
}

function AlertCard({ alert, onPlace, onDismiss, unitSize }) {
  const confColor = alert.confidence === "HIGH" ? "#ff4444" : alert.confidence === "MED" ? "#ffaa00" : "#00ccff";
  const book = BOOKS.find(b => b.id === alert.book) || BOOKS[0];
  return (
    <div style={{ background: "linear-gradient(135deg, rgba(255,60,40,0.05), rgba(255,150,50,0.02))", border: "1px solid rgba(255,60,40,0.15)", borderRadius: 10, padding: 14, animation: "slideIn .3s ease-out, glow 2.5s ease-in-out infinite" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ background: `${confColor}18`, border: `1px solid ${confColor}40`, borderRadius: 4, padding: "2px 8px", fontSize: 9, color: confColor, fontWeight: 700 }}>{alert.confidence}</span>
          <span style={{ fontSize: 9, color: "#555" }}>{alert.type?.toUpperCase()}</span>
        </div>
        <button onClick={onDismiss} style={{ background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: 12 }}>✕</button>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0", marginBottom: 6 }}>{alert.desc}</div>
      <div style={{ fontSize: 11, color: "#00ff64", background: "rgba(0,255,100,0.04)", borderRadius: 6, padding: "8px 10px", marginBottom: 6, borderLeft: "3px solid rgba(0,255,100,0.25)", lineHeight: 1.5 }}>{alert.action}</div>
      <div style={{ fontSize: 10, color: "#555", marginBottom: 10, lineHeight: 1.5 }}>{alert.reason}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#555" }}>{alert.units || 1}u = ${(alert.units || 1) * unitSize}</span>
          <span style={{ fontSize: 9, color: book.color, background: `${book.color}12`, padding: "2px 8px", borderRadius: 4, border: `1px solid ${book.color}25` }}>{book.icon} {book.name}</span>
        </div>
        <button onClick={onPlace} style={{ background: "linear-gradient(135deg, #00ff64, #00cc50)", border: "none", borderRadius: 6, padding: "8px 20px", color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 1 }}>PLACE BET →</button>
      </div>
    </div>
  );
}

function BetCard({ bet, onResolve }) {
  const bg = bet.result === "won" ? "rgba(0,255,100,0.04)" : bet.result === "lost" ? "rgba(255,50,50,0.04)" : "rgba(255,255,255,0.015)";
  const bc = bet.result === "won" ? "rgba(0,255,100,0.15)" : bet.result === "lost" ? "rgba(255,50,50,0.15)" : "rgba(255,255,255,0.04)";
  return (
    <div style={{ background: bg, border: `1px solid ${bc}`, borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bet.desc}</div>
        <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>${bet.totalWager} • {bet.placed?.toLocaleTimeString()}{bet.book && ` • ${bet.book}`}</div>
      </div>
      {bet.result === "pending" ? (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <Btn label="WON ✓" color="#00ff64" onClick={() => onResolve("won")} />
          <Btn label="LOST ✕" color="#ff4444" onClick={() => onResolve("lost")} />
          <Btn label="PUSH" color="#888" onClick={() => onResolve("push")} />
        </div>
      ) : <span style={{ fontSize: 11, fontWeight: 700, color: bet.result === "won" ? "#00ff64" : bet.result === "push" ? "#888" : "#ff4444" }}>{bet.result === "won" ? `+$${(bet.totalWager * .9).toFixed(0)}` : bet.result === "push" ? "$0" : `-$${bet.totalWager}`}</span>}
    </div>
  );
}

function Btn({ label, color, onClick }) {
  return <button onClick={onClick} style={{ background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 4, padding: "4px 10px", color, cursor: "pointer", fontSize: 9, fontFamily: "inherit" }}>{label}</button>;
}
function Stat({ label, value, color }) {
  return <div style={{ background: `${color}06`, border: `1px solid ${color}15`, borderRadius: 8, padding: "8px 14px", textAlign: "center", minWidth: 80 }}><div style={{ fontSize: 8, color: "#444", letterSpacing: 1, marginBottom: 2 }}>{label}</div><div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'Orbitron'" }}>{value}</div></div>;
}
function Mini({ label, value, bad }) {
  return <div style={{ textAlign: "center" }}><div style={{ fontSize: 8, color: "#333", letterSpacing: 1 }}>{label}</div><div style={{ fontSize: 13, fontWeight: 600, color: bad ? "#ff4444" : "#777" }}>{value}</div></div>;
}
function Inp({ label, sub, value, onChange }) {
  return <div><div style={{ fontSize: 9, color: "#555", letterSpacing: 1, marginBottom: 2 }}>{label}</div>{sub && <div style={{ fontSize: 8, color: "#333", marginBottom: 4 }}>{sub}</div>}<input value={value} onChange={e => onChange(e.target.value)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "6px 10px", color: "#00ff64", fontFamily: "inherit", fontSize: 13, width: 80 }} /></div>;
}
function Empty({ icon, title, sub }) {
  return <div style={{ textAlign: "center", padding: 40, color: "#333" }}><div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div><div style={{ fontSize: 12, fontFamily: "'Orbitron'", letterSpacing: 2, marginBottom: 6 }}>{title}</div><div style={{ fontSize: 10, color: "#444", maxWidth: 340, margin: "0 auto", lineHeight: 1.5 }}>{sub}</div></div>;
}
