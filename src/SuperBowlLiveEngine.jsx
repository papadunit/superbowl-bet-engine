import { useState, useEffect, useCallback, useRef } from "react";
import { runFullScan } from "./api";

const BOOKS = { fanduel: { name: "FanDuel", color: "#1493ff", icon: "🔵" }, draftkings: { name: "DraftKings", color: "#53d337", icon: "🟢" }, betmgm: { name: "BetMGM", color: "#c4a44a", icon: "🟡" } };
const TEAMS = { NE: { name: "Patriots", accent: "#C60C30" }, SEA: { name: "Seahawks", accent: "#69BE28" } };

export default function SuperBowlLiveEngine() {
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState(null);
  const [odds, setOdds] = useState(null);
  const [bets, setBets] = useState([]);
  const [placedBets, setPlacedBets] = useState([]);
  const [narrative, setNarrative] = useState("");
  const [momentum, setMomentum] = useState({ dir: "NEUTRAL", str: 5 });
  const [activeTab, setActiveTab] = useState("bets");
  const [isScanning, setIsScanning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(120);
  const [scanLog, setScanLog] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({ aggression: 7, unitSize: 25, bankroll: 500 });
  const [popup, setPopup] = useState(null); // the big alert popup
  const [soundEnabled, setSoundEnabled] = useState(true);
  const intervalRef = useRef(null);

  const log = useCallback((msg, type = "info") => {
    setScanLog(p => [{ msg, type, time: new Date() }, ...p].slice(0, 100));
  }, []);

  // Play alert sound
  const playAlert = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  }, [soundEnabled]);

  const doScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    setError(null);
    log("━━━ FULL SCAN ━━━", "scan");

    const result = await runFullScan(settings);

    if (result.error) {
      log(`⚠️ ${result.error}`, "error");
      if (result.details) log(`   ${String(result.details).slice(0, 250)}`, "error");
      setError(result.error.includes("429") ? "Rate limited — wait 60-90s then scan again." : result.error);
    } else {
      if (result.game) {
        setGame(result.game);
        log(`✅ NE ${result.game.ne_score} – SEA ${result.game.sea_score} | Q${result.game.quarter} ${result.game.clock} | ${(result.game.status || "").toUpperCase()}`, "success");
      }
      if (result.players) {
        setPlayers(result.players);
        const topPasser = result.players.passing?.[0];
        const topRusher = result.players.rushing?.[0];
        if (topPasser?.name) log(`📊 Top passer: ${topPasser.name} ${topPasser.yards}yds ${topPasser.td}TD`, "info");
        if (topRusher?.name) log(`📊 Top rusher: ${topRusher.name} ${topRusher.yards}yds ${topRusher.td}TD`, "info");
      }
      if (result.odds) {
        setOdds(result.odds);
        log(`✅ Lines: ${result.odds.favorite} ${result.odds.spread} | O/U ${result.odds.total} | Best spread: ${result.odds.best_spread_book}`, "success");
      }
      if (result.narrative) setNarrative(result.narrative);
      if (result.momentum) setMomentum({ dir: result.momentum, str: result.strength || 5 });

      // BETS — the money part
      if (result.bets?.length > 0) {
        const newBets = result.bets.map((b, i) => ({ ...b, id: b.id || `${Date.now()}-${i}`, timestamp: new Date() }));
        setBets(p => [...newBets, ...p]);
        log(`🔥 ${newBets.length} BET${newBets.length > 1 ? "S" : ""} FOUND`, "alert");
        newBets.forEach(b => log(`   → ${b.confidence} ${b.type.toUpperCase()}: ${b.title}`, "alert"));

        // Show popup for the best bet
        const best = newBets.reduce((a, b) => (b.ev_rating || 0) > (a.ev_rating || 0) ? b : a, newBets[0]);
        setPopup(best);
        playAlert();
        setActiveTab("bets");
      } else {
        log("✓ No strong opportunities right now", "info");
      }
      log(`🔍 ${result.searches || 0} web searches used`, "info");
    }

    setLastUpdate(new Date());
    setIsScanning(false);
    log("━━━ DONE ━━━", "success");
  }, [isScanning, settings, log, playAlert]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(doScan, refreshInterval * 1000);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, refreshInterval, doScan]);

  const placeBet = (bet) => {
    const wager = (bet.units || 1) * settings.unitSize;
    setPlacedBets(p => [{ ...bet, placed: new Date(), totalWager: wager, result: "pending" }, ...p]);
    setBets(p => p.filter(b => b.id !== bet.id));
    log(`💰 PLACED: ${bet.title} ($${wager})`, "alert");
    setPopup(null);
  };
  const resolveBet = (i, r) => setPlacedBets(p => p.map((b, idx) => idx === i ? { ...b, result: r } : b));
  const dismiss = (id) => { setBets(p => p.filter(b => b.id !== id)); if (popup?.id === id) setPopup(null); };

  const totalW = placedBets.reduce((s, b) => s + b.totalWager, 0);
  const won = placedBets.filter(b => b.result === "won").reduce((s, b) => s + b.totalWager * 1.9, 0);
  const lost = placedBets.filter(b => b.result === "lost").reduce((s, b) => s + b.totalWager, 0);
  const net = won - lost;

  return (
    <div style={{ minHeight: "100vh", background: "#06060c", fontFamily: "'JetBrains Mono','Fira Code',monospace", color: "#d0d0d0", position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet" />
      <div style={{ position: "fixed", inset: 0, background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,100,0.008) 3px,rgba(0,255,100,0.008) 4px)", pointerEvents: "none", zIndex: 50 }} />

      {/* ═══ POPUP ALERT ═══ */}
      {popup && <BetPopup bet={popup} unitSize={settings.unitSize} onPlace={() => placeBet(popup)} onDismiss={() => setPopup(null)} />}

      {/* HEADER */}
      <header style={{ background: "linear-gradient(180deg,#0c0c14,#06060c)", borderBottom: "1px solid rgba(0,255,100,0.1)", padding: "12px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontFamily: "Orbitron", fontSize: 17, fontWeight: 900, background: "linear-gradient(90deg,#00ff64,#00ccff,#ff6b35)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0, letterSpacing: 3 }}>SUPERBOWL LX ENGINE</h1>
            <div style={{ fontSize: 8, color: "#444", letterSpacing: 2, marginTop: 2 }}>PLAYER PROPS × PARLAYS × AI SHARP SCANNER</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {Object.values(BOOKS).map(b => <span key={b.name} style={{ fontSize: 8, color: b.color, opacity: 0.7 }}>{b.icon}{b.name}</span>)}
          </div>
        </div>
      </header>

      {/* CONTROLS */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={doScan} disabled={isScanning} style={{ background: isScanning ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg,#00ff6420,#00ccff15)", border: `1px solid ${isScanning ? "rgba(255,255,255,0.05)" : "rgba(0,255,100,0.3)"}`, borderRadius: 8, padding: "10px 24px", color: isScanning ? "#444" : "#00ff64", cursor: isScanning ? "default" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
          {isScanning ? "⏳ SCANNING..." : "📡 SCAN NOW"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: "5px 10px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ background: autoRefresh ? "rgba(0,255,100,0.15)" : "transparent", border: `1px solid ${autoRefresh ? "rgba(0,255,100,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 4, padding: "4px 8px", color: autoRefresh ? "#00ff64" : "#555", cursor: "pointer", fontSize: 9, fontFamily: "inherit" }}>{autoRefresh ? "AUTO ●" : "AUTO ○"}</button>
          <select value={refreshInterval} onChange={e => setRefreshInterval(parseInt(e.target.value))} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "3px 6px", color: "#888", fontSize: 9, fontFamily: "inherit" }}>
            <option value={90}>90s</option><option value={120}>2m</option><option value={180}>3m</option><option value={300}>5m</option>
          </select>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "5px 10px", color: "#666", cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>⚙️</button>
        <button onClick={() => setSoundEnabled(!soundEnabled)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "5px 10px", color: soundEnabled ? "#00ff64" : "#444", cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>{soundEnabled ? "🔊" : "🔇"}</button>
        {lastUpdate && <span style={{ fontSize: 8, color: "#333", marginLeft: "auto" }}>Last: {lastUpdate.toLocaleTimeString()}</span>}
      </div>

      {error && <div style={{ padding: "8px 20px", background: "rgba(255,50,50,0.08)", borderBottom: "1px solid rgba(255,50,50,0.2)", fontSize: 10, color: "#ff6644" }}>⚠️ {error}</div>}

      {showSettings && (
        <div style={{ padding: "10px 20px", background: "#0a0a12", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Inp label="AGGRESSION" sub="1=safe 10=degen" value={settings.aggression} onChange={v => setSettings(p => ({ ...p, aggression: Math.min(10, Math.max(1, parseInt(v) || 7)) }))} />
          <Inp label="UNIT ($)" value={settings.unitSize} onChange={v => setSettings(p => ({ ...p, unitSize: parseInt(v) || 25 }))} />
          <Inp label="BANKROLL ($)" value={settings.bankroll} onChange={v => setSettings(p => ({ ...p, bankroll: parseInt(v) || 500 }))} />
        </div>
      )}

      {/* SCOREBOARD */}
      <div style={{ padding: "16px 20px 8px", background: "linear-gradient(180deg,rgba(0,255,100,0.015),transparent)" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <TeamBox team="NE" score={game?.ne_score} possession={game?.possession === "NE"} />
          <div style={{ textAlign: "center", minWidth: 100 }}>
            <Badge status={game?.status} />
            <div style={{ fontSize: 11, color: game?.status === "live" ? "#00ff64" : "#555", fontFamily: "Orbitron", marginTop: 4 }}>{game ? `Q${game.quarter} ${game.clock}` : "6:30 PM EST"}</div>
            {game?.down && <div style={{ fontSize: 9, color: "#555", marginTop: 4 }}>{game.down}</div>}
            {game?.last_play && <div style={{ fontSize: 8, color: "#555", marginTop: 4, maxWidth: 200, lineHeight: 1.4, fontStyle: "italic" }}>{game.last_play}</div>}
          </div>
          <TeamBox team="SEA" score={game?.sea_score} possession={game?.possession === "SEA"} />
        </div>
        {/* Momentum bar */}
        <div style={{ maxWidth: 400, margin: "10px auto 0", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 8, color: TEAMS.NE.accent, width: 24, textAlign: "right" }}>NE</span>
          <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.03)", borderRadius: 2, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: "50%", top: 0, height: "100%", width: `${Math.abs(momentum.str - 5) * 10}%`, background: momentum.dir === "NE" ? TEAMS.NE.accent : momentum.dir === "SEA" ? TEAMS.SEA.accent : "#333", borderRadius: 2, transform: momentum.dir === "NE" ? "translateX(-100%)" : "translateX(0)", transition: "all 0.5s" }} />
          </div>
          <span style={{ fontSize: 8, color: TEAMS.SEA.accent, width: 24 }}>SEA</span>
        </div>
        {narrative && <div style={{ fontSize: 10, color: "#555", textAlign: "center", marginTop: 8, lineHeight: 1.5, maxWidth: 600, margin: "8px auto 0" }}>{narrative}</div>}
      </div>

      {/* ODDS BAR */}
      {odds && (
        <div style={{ padding: "8px 20px", display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <OddsPill label="SPREAD" value={`${odds.favorite} ${odds.spread}`} />
          <OddsPill label="NE ML" value={odds.ne_ml} />
          <OddsPill label="SEA ML" value={odds.sea_ml} />
          <OddsPill label="TOTAL" value={`O/U ${odds.total}`} />
          {odds.best_spread_book && <OddsPill label="BEST SPREAD" value={odds.best_spread_book.toUpperCase()} accent />}
          {odds.best_ml_book && <OddsPill label="BEST ML" value={odds.best_ml_book.toUpperCase()} accent />}
        </div>
      )}

      {/* PLAYER STATS */}
      {players && (players.passing?.length > 0 || players.rushing?.length > 0 || players.receiving?.length > 0) && (
        <div style={{ padding: "8px 20px 4px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <div style={{ fontSize: 8, color: "#444", letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>PLAYER STATS</div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {players.passing?.filter(p => p.name).map((p, i) => <PlayerChip key={`p${i}`} label="PASS" name={p.name} team={p.team} stat={`${p.yards}yd ${p.td}TD ${p.int || 0}INT`} />)}
            {players.rushing?.filter(p => p.name).map((p, i) => <PlayerChip key={`r${i}`} label="RUSH" name={p.name} team={p.team} stat={`${p.yards}yd ${p.td}TD ${p.carries || 0}car`} />)}
            {players.receiving?.filter(p => p.name).map((p, i) => <PlayerChip key={`w${i}`} label="REC" name={p.name} team={p.team} stat={`${p.rec || 0}rec ${p.yards}yd ${p.td}TD`} />)}
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "0 20px", overflowX: "auto" }}>
        {[{ k: "bets", l: "🔥 BETS", c: bets.length }, { k: "placed", l: "💰 PLACED", c: placedBets.length }, { k: "log", l: "📟 LOG", c: scanLog.length }].map(t => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} style={{ background: "transparent", border: "none", borderBottom: activeTab === t.k ? "2px solid #00ff64" : "2px solid transparent", padding: "10px 16px", color: activeTab === t.k ? "#00ff64" : "#444", cursor: "pointer", fontSize: 11, fontFamily: "inherit", letterSpacing: 1, whiteSpace: "nowrap" }}>
            {t.l} {t.c > 0 && <span style={{ background: t.k === "bets" ? "rgba(255,80,50,0.2)" : "rgba(0,255,100,0.12)", borderRadius: 8, padding: "1px 6px", fontSize: 9, marginLeft: 4, color: t.k === "bets" ? "#ff6b35" : undefined }}>{t.c}</span>}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: "12px 20px", minHeight: 200, maxHeight: "42vh", overflowY: "auto", paddingBottom: 60 }}>
        {activeTab === "bets" && (bets.length === 0
          ? <Empty icon="📡" title={isScanning ? "SCANNING..." : "AWAITING SCAN"} sub="Hit SCAN NOW to analyze player stats, props, and build sharp parlays." />
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{bets.map(b => <BetCard key={b.id} bet={b} unitSize={settings.unitSize} onPlace={() => placeBet(b)} onDismiss={() => dismiss(b.id)} onPopup={() => setPopup(b)} />)}</div>
        )}

        {activeTab === "placed" && (placedBets.length === 0
          ? <Empty icon="💰" title="NO BETS PLACED" sub="Place bets from the alerts. Mark WON/LOST/PUSH to track P/L." />
          : <>
            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <StatBox label="WAGERED" value={`$${totalW}`} color="#00ccff" />
              <StatBox label="WON" value={`$${won.toFixed(0)}`} color="#00ff64" />
              <StatBox label="LOST" value={`$${lost}`} color="#ff4444" />
              <StatBox label="NET" value={`${net >= 0 ? "+" : ""}$${net.toFixed(0)}`} color={net >= 0 ? "#00ff64" : "#ff4444"} />
              <StatBox label="BANK" value={`$${settings.bankroll - totalW + won}`} color="#fff" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{placedBets.map((b, i) => <PlacedCard key={i} bet={b} onResolve={r => resolveBet(i, r)} />)}</div>
          </>
        )}

        {activeTab === "log" && (scanLog.length === 0
          ? <Empty icon="📟" title="NO SCANS" sub="Run a scan." />
          : <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{scanLog.map((e, i) => (
            <div key={i} style={{ fontSize: 10, padding: "2px 0", display: "flex", gap: 8, color: { alert: "#ff6b35", success: "#00ff64", error: "#ff4444", scan: "#00ccff" }[e.type] || "#555" }}>
              <span style={{ color: "#222", minWidth: 65, fontSize: 8, paddingTop: 2, flexShrink: 0 }}>{e.time.toLocaleTimeString()}</span>
              <span style={{ wordBreak: "break-word" }}>{e.msg}</span>
            </div>
          ))}</div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "linear-gradient(180deg,transparent,#06060c 40%)", padding: "20px 20px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#1a1a1a", letterSpacing: 1, flexWrap: "wrap" }}>
          <span>CLAUDE AI × PLAYER PROPS × PARLAY ENGINE</span>
          <span>NOT FINANCIAL ADVICE • BET RESPONSIBLY</span>
        </div>
      </div>

      <style>{`
        @keyframes popIn{from{opacity:0;transform:scale(.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{border-color:rgba(255,80,50,0.2)}50%{border-color:rgba(255,80,50,0.5)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        input:focus,select:focus{outline:none}button:active{transform:scale(.97)}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,255,100,.1);border-radius:2px}
        option{background:#111;color:#888}
      `}</style>
    </div>
  );
}

// ═══ POPUP MODAL ═══
function BetPopup({ bet, unitSize, onPlace, onDismiss }) {
  const confColor = bet.confidence === "LOCK" ? "#ff2222" : bet.confidence === "HIGH" ? "#ff6b35" : "#ffaa00";
  const isParlay = bet.type === "parlay" || (bet.legs?.length || 0) > 1;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onDismiss}>
      <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(180deg,#0f0f1a,#0a0a12)", border: `2px solid ${confColor}40`, borderRadius: 16, padding: 24, maxWidth: 480, width: "100%", animation: "popIn .3s ease-out", boxShadow: `0 0 60px ${confColor}15, 0 20px 60px rgba(0,0,0,0.5)` }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <span style={{ background: `${confColor}20`, border: `1px solid ${confColor}50`, borderRadius: 4, padding: "3px 10px", fontSize: 10, color: confColor, fontWeight: 700, letterSpacing: 1 }}>
                {bet.confidence === "LOCK" ? "🔒 LOCK" : bet.confidence === "HIGH" ? "🔥 HIGH" : "⚡ MED"}
              </span>
              <span style={{ fontSize: 10, color: "#666", textTransform: "uppercase" }}>{bet.type}{isParlay ? ` (${bet.legs?.length || 0} legs)` : ""}</span>
            </div>
            <div style={{ fontSize: 9, color: "#444" }}>EV RATING: <span style={{ color: (bet.ev_rating || 0) >= 7 ? "#00ff64" : "#ffaa00" }}>{"★".repeat(Math.min(bet.ev_rating || 5, 10))}</span> {bet.ev_rating}/10</div>
          </div>
          <button onClick={onDismiss} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 18, padding: 0, lineHeight: 1 }}>✕</button>
        </div>

        {/* Title */}
        <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "Orbitron", color: "#fff", marginBottom: 14, lineHeight: 1.3, background: `linear-gradient(90deg,#fff,${confColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{bet.title}</div>

        {/* Legs */}
        <div style={{ marginBottom: 14 }}>
          {(bet.legs || []).map((leg, i) => {
            const book = BOOKS[leg.book] || Object.values(BOOKS)[0];
            return (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  {isParlay && <div style={{ fontSize: 8, color: "#555", marginBottom: 2 }}>LEG {i + 1}</div>}
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#ddd" }}>{leg.pick}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#00ff64", fontFamily: "Orbitron" }}>{leg.odds}</div>
                  <div style={{ fontSize: 8, color: book?.color || "#888" }}>{book?.icon} {book?.name || leg.book}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reasoning */}
        <div style={{ fontSize: 11, color: "#888", lineHeight: 1.6, marginBottom: 16, padding: "10px 12px", background: "rgba(0,255,100,0.03)", borderRadius: 8, borderLeft: `3px solid ${confColor}30` }}>{bet.reasoning}</div>

        {/* Action */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#888" }}>{bet.units || 1}u = <span style={{ color: "#fff", fontWeight: 700 }}>${(bet.units || 1) * unitSize}</span></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onDismiss} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 20px", color: "#666", cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>SKIP</button>
            <button onClick={onPlace} style={{ background: `linear-gradient(135deg,${confColor},${confColor}cc)`, border: "none", borderRadius: 8, padding: "10px 28px", color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12, letterSpacing: 1, boxShadow: `0 4px 20px ${confColor}30` }}>
              {isParlay ? "🎯 LOCK PARLAY" : "💰 PLACE BET"} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ BET CARD (in list) ═══
function BetCard({ bet, unitSize, onPlace, onDismiss, onPopup }) {
  const confColor = bet.confidence === "LOCK" ? "#ff2222" : bet.confidence === "HIGH" ? "#ff6b35" : "#ffaa00";
  const isParlay = bet.type === "parlay" || (bet.legs?.length || 0) > 1;
  return (
    <div style={{ background: "linear-gradient(135deg,rgba(255,60,40,0.04),rgba(255,150,50,0.02))", border: "1px solid rgba(255,60,40,0.12)", borderRadius: 10, padding: 12, animation: "slideIn .3s ease-out, glow 3s ease-in-out infinite", cursor: "pointer" }} onClick={onPopup}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ background: `${confColor}18`, border: `1px solid ${confColor}40`, borderRadius: 4, padding: "2px 7px", fontSize: 8, color: confColor, fontWeight: 700 }}>{bet.confidence === "LOCK" ? "🔒 LOCK" : bet.confidence}</span>
          <span style={{ fontSize: 8, color: "#555", textTransform: "uppercase" }}>{bet.type}{isParlay ? ` ${bet.legs?.length}L` : ""}</span>
          <span style={{ fontSize: 8, color: "#333" }}>EV:{bet.ev_rating}/10</span>
        </div>
        <button onClick={e => { e.stopPropagation(); onDismiss(); }} style={{ background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: 11 }}>✕</button>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#e0e0e0", marginBottom: 4 }}>{bet.title}</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
        {(bet.legs || []).map((leg, i) => {
          const book = BOOKS[leg.book];
          return <span key={i} style={{ fontSize: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, padding: "2px 8px", color: "#999" }}>{leg.pick} <span style={{ color: "#00ff64" }}>{leg.odds}</span> <span style={{ color: book?.color || "#666", fontSize: 8 }}>{book?.name || leg.book}</span></span>;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#444" }}>{bet.units || 1}u = ${(bet.units || 1) * unitSize}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); onPopup(); }} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "5px 12px", color: "#888", cursor: "pointer", fontFamily: "inherit", fontSize: 9 }}>VIEW</button>
          <button onClick={e => { e.stopPropagation(); onPlace(); }} style={{ background: `linear-gradient(135deg,#00ff64,#00cc50)`, border: "none", borderRadius: 5, padding: "5px 16px", color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 9, letterSpacing: 1 }}>PLACE →</button>
        </div>
      </div>
    </div>
  );
}

// ═══ PLACED BET CARD ═══
function PlacedCard({ bet, onResolve }) {
  const bg = bet.result === "won" ? "rgba(0,255,100,0.04)" : bet.result === "lost" ? "rgba(255,50,50,0.04)" : "rgba(255,255,255,0.015)";
  const bc = bet.result === "won" ? "rgba(0,255,100,0.15)" : bet.result === "lost" ? "rgba(255,50,50,0.15)" : "rgba(255,255,255,0.04)";
  return (
    <div style={{ background: bg, border: `1px solid ${bc}`, borderRadius: 8, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bet.title}</div>
          <div style={{ fontSize: 8, color: "#444", marginTop: 2 }}>${bet.totalWager} • {bet.placed?.toLocaleTimeString()} • {bet.type}</div>
        </div>
        {bet.result === "pending" ? (
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            <SmBtn label="WON ✓" color="#00ff64" onClick={() => onResolve("won")} />
            <SmBtn label="LOST ✕" color="#ff4444" onClick={() => onResolve("lost")} />
            <SmBtn label="PUSH" color="#888" onClick={() => onResolve("push")} />
          </div>
        ) : <span style={{ fontSize: 11, fontWeight: 700, color: bet.result === "won" ? "#00ff64" : bet.result === "push" ? "#888" : "#ff4444" }}>{bet.result === "won" ? `+$${(bet.totalWager * .9).toFixed(0)}` : bet.result === "push" ? "$0" : `-$${bet.totalWager}`}</span>}
      </div>
    </div>
  );
}

// ═══ SMALL COMPONENTS ═══
function TeamBox({ team, score, possession }) {
  const t = TEAMS[team];
  return <div style={{ textAlign: "center", minWidth: 110 }}>
    <div style={{ fontSize: 9, fontFamily: "Orbitron", color: t.accent, letterSpacing: 2, marginBottom: 4 }}>{t.name.toUpperCase()}</div>
    <div style={{ fontSize: 48, fontWeight: 900, fontFamily: "Orbitron", color: "#fff", textShadow: `0 0 30px ${t.accent}50`, lineHeight: 1 }}>{score ?? "–"}</div>
    {possession && <div style={{ fontSize: 8, color: "#00ff64", marginTop: 4 }}>● POSSESSION</div>}
  </div>;
}

function Badge({ status }) {
  const s = status || "pregame";
  const m = { pregame: ["rgba(255,255,255,0.04)", "#555", "PREGAME"], live: ["rgba(255,50,50,0.12)", "#ff4444", "● LIVE"], halftime: ["rgba(255,170,0,0.1)", "#ffaa00", "HALFTIME"], final: ["rgba(255,255,255,0.04)", "#888", "FINAL"] }[s] || ["rgba(255,255,255,0.04)", "#555", s.toUpperCase()];
  return <span style={{ background: m[0], border: `1px solid ${m[1]}30`, borderRadius: 4, padding: "2px 8px", fontSize: 9, color: m[1], fontWeight: 700, letterSpacing: 1, animation: s === "live" ? "pulse 2s infinite" : "none" }}>{m[2]}</span>;
}

function OddsPill({ label, value, accent }) {
  return <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 7, color: "#444", letterSpacing: 1 }}>{label}</div>
    <div style={{ fontSize: 11, fontWeight: 600, color: accent ? "#00ff64" : "#999", fontFamily: accent ? undefined : "Orbitron" }}>{value}</div>
  </div>;
}

function PlayerChip({ label, name, team, stat }) {
  const t = TEAMS[team] || {};
  return <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 6, padding: "5px 10px", minWidth: 120, flexShrink: 0 }}>
    <div style={{ fontSize: 7, color: "#555", letterSpacing: 1 }}>{label}</div>
    <div style={{ fontSize: 11, fontWeight: 600, color: t.accent || "#999" }}>{name}</div>
    <div style={{ fontSize: 9, color: "#777" }}>{stat}</div>
  </div>;
}

function SmBtn({ label, color, onClick }) {
  return <button onClick={onClick} style={{ background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 4, padding: "3px 8px", color, cursor: "pointer", fontSize: 8, fontFamily: "inherit" }}>{label}</button>;
}
function StatBox({ label, value, color }) {
  return <div style={{ background: `${color}06`, border: `1px solid ${color}15`, borderRadius: 8, padding: "6px 12px", textAlign: "center", minWidth: 70 }}><div style={{ fontSize: 7, color: "#444", letterSpacing: 1, marginBottom: 1 }}>{label}</div><div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "Orbitron" }}>{value}</div></div>;
}
function Inp({ label, sub, value, onChange }) {
  return <div><div style={{ fontSize: 8, color: "#555", letterSpacing: 1, marginBottom: 2 }}>{label}</div>{sub && <div style={{ fontSize: 7, color: "#333", marginBottom: 3 }}>{sub}</div>}<input value={value} onChange={e => onChange(e.target.value)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "5px 8px", color: "#00ff64", fontFamily: "inherit", fontSize: 12, width: 72 }} /></div>;
}
function Empty({ icon, title, sub }) {
  return <div style={{ textAlign: "center", padding: 36, color: "#333" }}><div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div><div style={{ fontSize: 11, fontFamily: "Orbitron", letterSpacing: 2, marginBottom: 6 }}>{title}</div><div style={{ fontSize: 9, color: "#444", maxWidth: 320, margin: "0 auto", lineHeight: 1.5 }}>{sub}</div></div>;
}
