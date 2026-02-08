import { useState, useEffect, useCallback, useRef } from "react";
import { fetchLiveGameData, fetchLiveOdds, getStrategicAnalysis } from "./api";

// ── CONSTANTS ─────────────────────────────────────────────
const BOOKS = [
  { id: "fanduel", name: "FanDuel", color: "#1493ff", icon: "🔵" },
  { id: "draftkings", name: "DraftKings", color: "#53d337", icon: "🟢" },
  { id: "betmgm", name: "BetMGM", color: "#c4a44a", icon: "🟡" },
  { id: "underdog", name: "Underdog", color: "#ff6b35", icon: "🟠" },
];

const TEAMS = {
  NE: { name: "Patriots", full: "New England Patriots", accent: "#C60C30" },
  SEA: { name: "Seahawks", full: "Seattle Seahawks", accent: "#69BE28" },
};

export default function SuperBowlLiveEngine() {
  const [gameData, setGameData] = useState(null);
  const [oddsData, setOddsData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [placedBets, setPlacedBets] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("live");
  const [isScanning, setIsScanning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [scanLog, setScanLog] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [flashAlert, setFlashAlert] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({ aggression: 6, unitSize: 25, bankroll: 500 });
  const intervalRef = useRef(null);

  const addLog = useCallback((msg, type = "info") => {
    setScanLog((prev) => [{ msg, type, time: new Date() }, ...prev].slice(0, 100));
  }, []);

  // ── Full scan cycle ──
  const runFullScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    setError(null);
    addLog("━━━ INITIATING FULL SCAN ━━━", "scan");

    // 1) Live game data
    addLog("📡 Fetching live game data via Claude AI...", "scan");
    const game = await fetchLiveGameData();
    if (game) {
      setGameData(game);
      addLog(`✅ Score: NE ${game.ne_score} — SEA ${game.sea_score} | Q${game.quarter} ${game.clock} | ${game.status.toUpperCase()}`, "success");
    } else {
      addLog("⚠️ Could not fetch game data — check Vercel env var ANTHROPIC_API_KEY", "error");
      setError("API call failed. Make sure ANTHROPIC_API_KEY is set in Vercel Environment Variables, then redeploy.");
    }

    // 2) Live odds
    addLog("💰 Scanning sportsbook odds across 4 books...", "scan");
    const odds = await fetchLiveOdds();
    if (odds) {
      setOddsData(odds);
      const bookCount = Object.values(odds.books || {}).filter((b) => b && b.spread?.ne && b.spread.ne !== "N/A").length;
      addLog(`✅ Odds loaded from ${bookCount}/4 sportsbooks`, "success");
      if (odds.notes) addLog(`📝 ${odds.notes}`, "info");
    } else {
      addLog("⚠️ Could not fetch odds", "error");
    }

    // 3) Strategy
    if (game || odds) {
      addLog("🧠 Running AI strategy analysis...", "scan");
      const strat = await getStrategicAnalysis(game || {}, odds || {}, settings);
      if (strat) {
        setAnalysis(strat);
        if (strat.alerts?.length > 0) {
          const newAlerts = strat.alerts.map((a, i) => ({ ...a, id: `${Date.now()}-${i}`, timestamp: new Date() }));
          setAlerts((prev) => [...newAlerts, ...prev]);
          setAlertHistory((prev) => [...newAlerts, ...prev]);
          setFlashAlert(true);
          setTimeout(() => setFlashAlert(false), 2000);
          addLog(`🔴 ${newAlerts.length} NEW ALERT${newAlerts.length > 1 ? "S" : ""}`, "alert");
          newAlerts.forEach((a) => addLog(`   → ${a.confidence} | ${a.description}`, "alert"));
        } else {
          addLog("✓ No actionable opportunities right now", "info");
        }
        if (strat.game_narrative) addLog(`📊 ${strat.game_narrative}`, "info");
        if (strat.recommended_wait) addLog(`⏸ Wait recommended${strat.wait_reason ? ": " + strat.wait_reason : ""}`, "info");
      }
    }

    setLastUpdate(new Date());
    setIsScanning(false);
    addLog("━━━ SCAN COMPLETE ━━━", "success");
  }, [isScanning, settings, addLog]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(runFullScan, refreshInterval * 1000);
      addLog(`🔄 Auto-refresh: every ${refreshInterval}s`, "info");
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, refreshInterval, runFullScan, addLog]);

  const placeBet = (alert) => {
    const bet = { ...alert, placed: new Date(), unitSize: settings.unitSize, totalWager: (alert.units || 1) * settings.unitSize, result: "pending" };
    setPlacedBets((prev) => [bet, ...prev]);
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    addLog(`💰 BET PLACED: ${alert.description} → ${alert.best_book || "best available"} ($${bet.totalWager})`, "alert");
  };

  const resolveBet = (idx, result) => setPlacedBets((prev) => prev.map((b, i) => (i === idx ? { ...b, result } : b)));
  const dismissAlert = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  const totalWagered = placedBets.reduce((s, b) => s + b.totalWager, 0);
  const totalWon = placedBets.filter((b) => b.result === "won").reduce((s, b) => s + b.totalWager * 1.9, 0);
  const totalLost = placedBets.filter((b) => b.result === "lost").reduce((s, b) => s + b.totalWager, 0);
  const netPL = totalWon - totalLost;
  const pendingWagers = placedBets.filter((b) => b.result === "pending").reduce((s, b) => s + b.totalWager, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#06060c", fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace", color: "#d0d0d0" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet" />

      {/* Scan lines */}
      <div style={{ position: "fixed", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,100,0.008) 3px, rgba(0,255,100,0.008) 4px)", pointerEvents: "none", zIndex: 100 }} />
      {flashAlert && <div style={{ position: "fixed", inset: 0, background: "radial-gradient(circle, rgba(255,50,50,0.2) 0%, transparent 70%)", animation: "flashPulse 0.6s ease-out", pointerEvents: "none", zIndex: 99 }} />}

      {/* ═══ HEADER ═══ */}
      <header style={{ background: "linear-gradient(180deg, #0c0c14, #06060c)", borderBottom: "1px solid rgba(0,255,100,0.1)", padding: "14px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontFamily: "'Orbitron'", fontSize: 18, fontWeight: 900, background: "linear-gradient(90deg, #00ff64, #00ccff, #ff6b35)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0, letterSpacing: 3 }}>
              SUPERBOWL LX ENGINE
            </h1>
            <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginTop: 2 }}>LIVE ODDS × AI STRATEGY × MULTI-BOOK SCANNER</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {BOOKS.map((b) => (
              <span key={b.id} style={{ fontSize: 9, color: b.color, letterSpacing: 1, opacity: 0.7 }}>{b.icon} {b.name.split(" ")[0].toUpperCase()}</span>
            ))}
          </div>
        </div>
      </header>

      {/* ═══ CONTROL BAR ═══ */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={runFullScan} disabled={isScanning} style={{
          background: isScanning ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg, #00ff6420, #00ccff15)",
          border: `1px solid ${isScanning ? "rgba(255,255,255,0.05)" : "rgba(0,255,100,0.3)"}`,
          borderRadius: 8, padding: "10px 24px", color: isScanning ? "#444" : "#00ff64",
          cursor: isScanning ? "default" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: 1
        }}>
          {isScanning ? "⏳ SCANNING..." : "📡 SCAN NOW"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: "6px 12px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => setAutoRefresh(!autoRefresh)} style={{
            background: autoRefresh ? "rgba(0,255,100,0.15)" : "transparent",
            border: `1px solid ${autoRefresh ? "rgba(0,255,100,0.3)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 4, padding: "4px 10px", color: autoRefresh ? "#00ff64" : "#555",
            cursor: "pointer", fontSize: 10, fontFamily: "inherit"
          }}>{autoRefresh ? "AUTO ●" : "AUTO ○"}</button>
          <select value={refreshInterval} onChange={(e) => setRefreshInterval(parseInt(e.target.value))} style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4,
            padding: "4px 8px", color: "#888", fontSize: 10, fontFamily: "inherit"
          }}>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
            <option value={90}>90s</option>
            <option value={120}>2min</option>
          </select>
        </div>

        <button onClick={() => setShowSettings(!showSettings)} style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6, padding: "6px 12px", color: "#666", cursor: "pointer", fontSize: 11, fontFamily: "inherit"
        }}>⚙️ Strategy</button>

        {lastUpdate && <span style={{ fontSize: 9, color: "#333", marginLeft: "auto" }}>Last: {lastUpdate.toLocaleTimeString()}</span>}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: "10px 20px", background: "rgba(255,50,50,0.08)", borderBottom: "1px solid rgba(255,50,50,0.2)", fontSize: 11, color: "#ff6644", lineHeight: 1.5 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ═══ SETTINGS ═══ */}
      {showSettings && (
        <div style={{ padding: "12px 20px", background: "#0a0a12", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
          <SettingInput label="AGGRESSION" sublabel="1=safe 10=degen" value={settings.aggression}
            onChange={(v) => setSettings((p) => ({ ...p, aggression: Math.min(10, Math.max(1, parseInt(v) || 5)) }))} />
          <SettingInput label="UNIT SIZE ($)" sublabel="base bet" value={settings.unitSize}
            onChange={(v) => setSettings((p) => ({ ...p, unitSize: parseInt(v) || 25 }))} />
          <SettingInput label="BANKROLL ($)" sublabel="total budget" value={settings.bankroll}
            onChange={(v) => setSettings((p) => ({ ...p, bankroll: parseInt(v) || 500 }))} />
          <div style={{ fontSize: 9, color: "#333", lineHeight: 1.6, maxWidth: 300 }}>
            Higher aggression = more frequent alerts, bigger unit sizing, lower confidence threshold. Engine shops lines across all 4 books.
          </div>
        </div>
      )}

      {/* ═══ SCOREBOARD ═══ */}
      <div style={{ padding: "20px", background: "linear-gradient(180deg, rgba(0,255,100,0.02), transparent)" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <TeamDisplay team="NE" data={gameData} />
          <GameClock data={gameData} />
          <TeamDisplay team="SEA" data={gameData} />
        </div>
        {gameData?.key_stats && (
          <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
            <MiniStat label="NE YDS" value={gameData.key_stats.ne_total_yards} />
            <MiniStat label="SEA YDS" value={gameData.key_stats.sea_total_yards} />
            <MiniStat label="NE PASS" value={gameData.key_stats.ne_passing_yards} />
            <MiniStat label="SEA PASS" value={gameData.key_stats.sea_passing_yards} />
            <MiniStat label="NE RUSH" value={gameData.key_stats.ne_rushing_yards} />
            <MiniStat label="SEA RUSH" value={gameData.key_stats.sea_rushing_yards} />
            <MiniStat label="NE TO" value={gameData.key_stats.ne_turnovers} bad={gameData.key_stats.ne_turnovers > 0} />
            <MiniStat label="SEA TO" value={gameData.key_stats.sea_turnovers} bad={gameData.key_stats.sea_turnovers > 0} />
          </div>
        )}
      </div>

      {/* ═══ ODDS TABLE ═══ */}
      {oddsData?.books && <OddsTable oddsData={oddsData} />}

      {/* ═══ TABS ═══ */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "0 20px", overflowX: "auto" }}>
        {[
          { key: "live", label: "⚡ ALERTS", count: alerts.length },
          { key: "bets", label: "💰 BETS", count: placedBets.length },
          { key: "log", label: "📟 SCAN LOG", count: scanLog.length },
          { key: "momentum", label: "📈 MOMENTUM" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            background: "transparent", border: "none",
            borderBottom: activeTab === tab.key ? "2px solid #00ff64" : "2px solid transparent",
            padding: "10px 16px", color: activeTab === tab.key ? "#00ff64" : "#444",
            cursor: "pointer", fontSize: 11, fontFamily: "inherit", letterSpacing: 1, whiteSpace: "nowrap"
          }}>
            {tab.label} {tab.count > 0 && <span style={{ background: "rgba(0,255,100,0.12)", borderRadius: 8, padding: "1px 6px", fontSize: 9, marginLeft: 4 }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{ padding: "14px 20px", minHeight: 220, maxHeight: "40vh", overflowY: "auto", paddingBottom: 60 }}>

        {activeTab === "live" && (
          alerts.length === 0 ? (
            <EmptyState icon="📡" title={isScanning ? "SCANNING..." : "AWAITING SCAN"}
              subtitle='Hit "SCAN NOW" to search live scores & odds across FanDuel, DraftKings, BetMGM, and Underdog. Enable auto-refresh once the game starts.' />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {alerts.map((alert) => (
                <LiveAlertCard key={alert.id} alert={alert} onPlace={() => placeBet(alert)}
                  onDismiss={() => dismissAlert(alert.id)} unitSize={settings.unitSize} />
              ))}
            </div>
          )
        )}

        {activeTab === "bets" && (
          placedBets.length === 0 ? (
            <EmptyState icon="💰" title="NO BETS PLACED" subtitle="When alerts fire, hit PLACE BET to track them. Mark WON, LOST, or PUSH to track P/L." />
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <StatBox label="WAGERED" value={`$${totalWagered}`} color="#00ccff" />
                <StatBox label="WON" value={`$${totalWon.toFixed(0)}`} color="#00ff64" />
                <StatBox label="LOST" value={`$${totalLost}`} color="#ff4444" />
                <StatBox label="NET P/L" value={`${netPL >= 0 ? "+" : ""}$${netPL.toFixed(0)}`} color={netPL >= 0 ? "#00ff64" : "#ff4444"} />
                <StatBox label="PENDING" value={`$${pendingWagers}`} color="#ffaa00" />
                <StatBox label="REMAINING" value={`$${settings.bankroll - totalWagered + totalWon}`} color="#fff" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {placedBets.map((bet, idx) => (
                  <PlacedBetCard key={idx} bet={bet} onResolve={(r) => resolveBet(idx, r)} />
                ))}
              </div>
            </>
          )
        )}

        {activeTab === "log" && (
          scanLog.length === 0 ? (
            <EmptyState icon="📟" title="NO SCANS YET" subtitle="Run your first scan to see the activity log." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {scanLog.map((entry, idx) => (
                <div key={idx} style={{
                  fontSize: 11, padding: "3px 0", display: "flex", gap: 8,
                  color: entry.type === "alert" ? "#ff6b35" : entry.type === "success" ? "#00ff64" : entry.type === "error" ? "#ff4444" : entry.type === "scan" ? "#00ccff" : "#555"
                }}>
                  <span style={{ color: "#222", minWidth: 72, fontSize: 9, paddingTop: 2, flexShrink: 0 }}>{entry.time.toLocaleTimeString()}</span>
                  <span style={{ wordBreak: "break-word" }}>{entry.msg}</span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "momentum" && <MomentumPanel analysis={analysis} isScanning={isScanning} />}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "linear-gradient(180deg, transparent, #06060c 40%)", padding: "24px 20px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#1a1a1a", letterSpacing: 1, flexWrap: "wrap", gap: 4 }}>
          <span>POWERED BY CLAUDE AI × VERCEL × MULTI-BOOK SCANNER</span>
          <span>NOT FINANCIAL ADVICE • BET RESPONSIBLY</span>
        </div>
      </div>

      <style>{`
        @keyframes flashPulse { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes borderPulse { 0%, 100% { border-color: rgba(255,80,50,0.2); } 50% { border-color: rgba(255,80,50,0.6); } }
        @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        input:focus, select:focus { outline: none; }
        button:active { transform: scale(0.97); }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,100,0.1); border-radius: 2px; }
        option { background: #111; color: #888; }
      `}</style>
    </div>
  );
}

// ── SUBCOMPONENTS ─────────────────────────────────────────

function TeamDisplay({ team, data }) {
  const t = TEAMS[team];
  const scoreKey = team === "NE" ? "ne_score" : "sea_score";
  return (
    <div style={{ textAlign: "center", minWidth: 120 }}>
      <div style={{ fontSize: 10, fontFamily: "'Orbitron'", color: t.accent, letterSpacing: 2, marginBottom: 4 }}>{t.name.toUpperCase()}</div>
      <div style={{ fontSize: 52, fontWeight: 900, fontFamily: "'Orbitron'", color: "#fff", textShadow: `0 0 30px ${t.accent}50`, lineHeight: 1 }}>
        {data?.[scoreKey] ?? "–"}
      </div>
      {data?.possession === team && <div style={{ fontSize: 9, color: "#00ff64", marginTop: 6 }}>● POSSESSION</div>}
    </div>
  );
}

function GameClock({ data }) {
  return (
    <div style={{ textAlign: "center", minWidth: 110 }}>
      <StatusBadge status={data?.status} />
      <div style={{ fontSize: 12, color: data?.status === "live" ? "#00ff64" : "#555", fontFamily: "'Orbitron'", marginTop: 4 }}>
        {data ? `Q${data.quarter} ${data.clock}` : "6:30 PM EST"}
      </div>
      {data?.down_distance && <div style={{ fontSize: 9, color: "#555", marginTop: 6 }}>{data.down_distance}</div>}
      {data?.yard_line && <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>{data.yard_line}</div>}
      {data?.last_play && <div style={{ fontSize: 9, color: "#666", marginTop: 8, maxWidth: 220, lineHeight: 1.5, fontStyle: "italic" }}>{data.last_play}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = status || "pregame";
  const c = {
    pregame: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", text: "#555", label: "PREGAME" },
    live: { bg: "rgba(255,50,50,0.12)", border: "rgba(255,50,50,0.3)", text: "#ff4444", label: "● LIVE" },
    halftime: { bg: "rgba(255,170,0,0.1)", border: "rgba(255,170,0,0.25)", text: "#ffaa00", label: "HALFTIME" },
    final: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", text: "#888", label: "FINAL" },
  }[s] || { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", text: "#555", label: s.toUpperCase() };
  return (
    <span style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 4, padding: "3px 10px", fontSize: 10, color: c.text, fontWeight: 700, letterSpacing: 1, animation: s === "live" ? "livePulse 2s ease-in-out infinite" : "none" }}>
      {c.label}
    </span>
  );
}

function OddsTable({ oddsData }) {
  return (
    <div style={{ padding: "0 20px 12px", overflowX: "auto" }}>
      <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>LIVE ODDS COMPARISON</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["BOOK", "NE SPREAD", "SEA SPREAD", "NE ML", "SEA ML", "TOTAL", "O/U"].map((h) => (
                <th key={h} style={{ textAlign: h === "BOOK" ? "left" : "center", padding: "6px 8px", color: "#444", fontWeight: 500, fontSize: 9 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BOOKS.map((book) => {
              const d = oddsData.books?.[book.id];
              if (!d) return null;
              const best = oddsData.best_bets || {};
              const isBest = (k) => best[k]?.toLowerCase().includes(book.id);
              return (
                <tr key={book.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: 8, color: book.color, fontWeight: 600 }}>{book.icon} {book.name}</td>
                  <td style={{ textAlign: "center", padding: 8, color: isBest("best_ne_spread") ? "#00ff64" : "#aaa" }}>{d.spread?.ne || "–"} {d.spread?.line ? `(${d.spread.line})` : ""}</td>
                  <td style={{ textAlign: "center", padding: 8, color: isBest("best_sea_spread") ? "#00ff64" : "#aaa" }}>{d.spread?.sea || "–"} {d.spread?.line ? `(${d.spread.line})` : ""}</td>
                  <td style={{ textAlign: "center", padding: 8, color: isBest("best_ne_ml") ? "#00ff64" : "#aaa" }}>{d.moneyline?.ne || "–"}</td>
                  <td style={{ textAlign: "center", padding: 8, color: isBest("best_sea_ml") ? "#00ff64" : "#aaa" }}>{d.moneyline?.sea || "–"}</td>
                  <td style={{ textAlign: "center", padding: 8, color: "#888" }}>{d.over_under?.total || "–"}</td>
                  <td style={{ textAlign: "center", padding: 8, color: "#888", fontSize: 10 }}>O {d.over_under?.over || "–"} / U {d.over_under?.under || "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {oddsData.best_bets && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {Object.entries(oddsData.best_bets).filter(([_, v]) => v && v !== "N/A" && v !== "").map(([key, val]) => (
            <span key={key} style={{ fontSize: 9, color: "#00ff64", background: "rgba(0,255,100,0.06)", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(0,255,100,0.15)" }}>
              BEST {key.replace("best_", "").replace(/_/g, " ").toUpperCase()}: {val}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveAlertCard({ alert, onPlace, onDismiss, unitSize }) {
  const book = BOOKS.find((b) => b.id === alert.best_book) || BOOKS[0];
  const confColor = alert.confidence === "HIGH" ? "#ff4444" : alert.confidence === "MED" ? "#ffaa00" : "#00ccff";
  return (
    <div style={{ background: "linear-gradient(135deg, rgba(255,60,40,0.05), rgba(255,150,50,0.02))", border: "1px solid rgba(255,60,40,0.15)", borderRadius: 10, padding: 14, animation: "slideDown 0.3s ease-out, borderPulse 2.5s ease-in-out infinite" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ background: `${confColor}18`, border: `1px solid ${confColor}40`, borderRadius: 4, padding: "2px 8px", fontSize: 9, color: confColor, fontWeight: 700 }}>{alert.confidence} CONFIDENCE</span>
          <span style={{ fontSize: 9, color: "#555" }}>{alert.type?.toUpperCase()}</span>
        </div>
        <button onClick={onDismiss} style={{ background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0", marginBottom: 6 }}>{alert.description}</div>
      <div style={{ fontSize: 11, color: "#00ff64", background: "rgba(0,255,100,0.04)", borderRadius: 6, padding: "8px 10px", marginBottom: 6, borderLeft: "3px solid rgba(0,255,100,0.25)", lineHeight: 1.5 }}>{alert.action}</div>
      <div style={{ fontSize: 10, color: "#555", marginBottom: 10, lineHeight: 1.5 }}>{alert.reasoning}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "#555" }}>{alert.units || 1}u = ${(alert.units || 1) * unitSize}</span>
          {alert.best_book && <span style={{ fontSize: 9, color: book.color, background: `${book.color}12`, padding: "2px 8px", borderRadius: 4, border: `1px solid ${book.color}25` }}>{book.icon} BEST @ {book.name}</span>}
        </div>
        <button onClick={onPlace} style={{ background: "linear-gradient(135deg, #00ff64, #00cc50)", border: "none", borderRadius: 6, padding: "8px 20px", color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 1 }}>PLACE BET →</button>
      </div>
    </div>
  );
}

function PlacedBetCard({ bet, onResolve }) {
  const bg = bet.result === "won" ? "rgba(0,255,100,0.04)" : bet.result === "lost" ? "rgba(255,50,50,0.04)" : "rgba(255,255,255,0.015)";
  const border = bet.result === "won" ? "rgba(0,255,100,0.15)" : bet.result === "lost" ? "rgba(255,50,50,0.15)" : "rgba(255,255,255,0.04)";
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bet.description}</div>
        <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>${bet.totalWager} • {bet.placed?.toLocaleTimeString()}{bet.best_book && ` • ${bet.best_book}`}</div>
      </div>
      {bet.result === "pending" ? (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <SmallBtn label="WON ✓" color="#00ff64" onClick={() => onResolve("won")} />
          <SmallBtn label="LOST ✕" color="#ff4444" onClick={() => onResolve("lost")} />
          <SmallBtn label="PUSH" color="#888" onClick={() => onResolve("push")} />
        </div>
      ) : (
        <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, color: bet.result === "won" ? "#00ff64" : bet.result === "push" ? "#888" : "#ff4444" }}>
          {bet.result === "won" ? `+$${(bet.totalWager * 0.9).toFixed(0)}` : bet.result === "push" ? "$0" : `-$${bet.totalWager}`}
        </span>
      )}
    </div>
  );
}

function MomentumPanel({ analysis, isScanning }) {
  if (!analysis) return <EmptyState icon="📈" title={isScanning ? "ANALYZING..." : "NO DATA YET"} subtitle="Run a scan to see real-time momentum analysis." />;
  const mColor = analysis.momentum === "NE" ? TEAMS.NE.accent : analysis.momentum === "SEA" ? TEAMS.SEA.accent : "#555";
  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 12, letterSpacing: 1 }}>MOMENTUM INDICATOR</div>
      <div style={{ fontSize: 32, fontFamily: "'Orbitron'", fontWeight: 900, color: mColor, marginBottom: 8 }}>
        {analysis.momentum === "NE" ? "← PATRIOTS" : analysis.momentum === "SEA" ? "SEAHAWKS →" : "— NEUTRAL —"}
      </div>
      {analysis.momentum_strength != null && (
        <div style={{ maxWidth: 300, margin: "0 auto 16px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, height: 6, overflow: "hidden" }}>
            <div style={{ width: `${(analysis.momentum_strength / 10) * 100}%`, height: "100%", background: mColor, borderRadius: 4, transition: "width 0.5s" }} />
          </div>
          <div style={{ fontSize: 9, color: "#444", marginTop: 4 }}>STRENGTH: {analysis.momentum_strength}/10</div>
        </div>
      )}
      {analysis.game_narrative && <div style={{ fontSize: 12, color: "#888", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>{analysis.game_narrative}</div>}
      {analysis.recommended_wait && (
        <div style={{ marginTop: 16, fontSize: 11, color: "#ff6b35", background: "rgba(255,107,53,0.08)", display: "inline-block", padding: "8px 20px", borderRadius: 6, border: "1px solid rgba(255,107,53,0.2)" }}>
          ⏸ WAIT FOR BETTER ENTRY{analysis.wait_reason && <div style={{ fontSize: 9, color: "#996644", marginTop: 4 }}>{analysis.wait_reason}</div>}
        </div>
      )}
    </div>
  );
}

function SmallBtn({ label, color, onClick }) {
  return <button onClick={onClick} style={{ background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 4, padding: "4px 10px", color, cursor: "pointer", fontSize: 9, fontFamily: "inherit" }}>{label}</button>;
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: `${color}06`, border: `1px solid ${color}15`, borderRadius: 8, padding: "8px 14px", textAlign: "center", minWidth: 80 }}>
      <div style={{ fontSize: 8, color: "#444", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'Orbitron'" }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, bad }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 8, color: "#333", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: bad ? "#ff4444" : "#777" }}>{value}</div>
    </div>
  );
}

function SettingInput({ label, sublabel, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "#555", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 8, color: "#333", marginBottom: 4 }}>{sublabel}</div>}
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "6px 10px", color: "#00ff64", fontFamily: "inherit", fontSize: 13, width: 80 }} />
    </div>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ textAlign: "center", padding: 40, color: "#333" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 12, fontFamily: "'Orbitron'", letterSpacing: 2, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 10, color: "#444", maxWidth: 340, margin: "0 auto", lineHeight: 1.5 }}>{subtitle}</div>
    </div>
  );
}
