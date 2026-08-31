import React, { useEffect, useMemo, useRef, useState } from "react";
import { addFrontendNote, clearFrontendLogs, getFrontendLogs, subscribeToFrontendLogs } from "../lib/devTelemetry";

function formatTimestamp(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return timestamp;
  }
}

function DevLogs({ user, isActive = false }) {
  const [backendLogs, setBackendLogs] = useState([]);
  const [frontendLogs, setFrontendLogs] = useState(getFrontendLogs());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStream, setSelectedStream] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [showNoise, setShowNoise] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const scrollRef = useRef(null);

  const backendUrl = useMemo(() => "http://localhost:3000", []);

  const combinedLogs = useMemo(() => {
    const merged = [
      ...backendLogs.map((entry) => ({ ...entry, stream: "backend" })),
      ...frontendLogs.map((entry) => ({ ...entry, stream: "frontend" })),
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let visible = showNoise ? merged : merged.filter((entry) => !entry.meta?.noise);
    if (!showDebug) visible = visible.filter(e => String(e.level || "").toLowerCase() !== "debug");
    if (selectedStream !== "all") visible = visible.filter(e => e.stream === selectedStream);
    if (selectedLevel !== "all") visible = visible.filter(e => String(e.level || "").toLowerCase() === selectedLevel);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      visible = visible.filter(e => String(e.message || "").toLowerCase().includes(q));
    }
    return visible;
  }, [backendLogs, frontendLogs, selectedStream, selectedLevel, showNoise, search]);

  // Auto-scroll naar nieuwste entry
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [combinedLogs, autoScroll]);

  useEffect(() => {
    return subscribeToFrontendLogs(setFrontendLogs);
  }, []);

  useEffect(() => {
    if (!isActive) return undefined;
    let cancelled = false;
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/dev-logs`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!cancelled) {
          setBackendLogs(Array.isArray(data.logs) ? data.logs : []);
          setError("");
          setLoading(false);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message || "Kon dev logs niet ophalen");
          setLoading(false);
        }
      }
    };
    fetchLogs();
    const intervalId = window.setInterval(fetchLogs, 3500);
    return () => { cancelled = true; window.clearInterval(intervalId); };
  }, [backendUrl, isActive]);

  const errorCount = combinedLogs.filter(e => e.level === "error").length;
  const warnCount = combinedLogs.filter(e => e.level === "warn").length;
  const importCount = combinedLogs.filter(e => String(e.message || "").includes("[smart-import]")).length;

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto" }}>
      <div style={{
        borderRadius: 28,
        padding: 28,
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))",
        boxShadow: "0 28px 70px rgba(0, 0, 0, 0.35)",
        border: "1px solid rgba(148, 163, 184, 0.18)",
        color: "#e5e7eb"
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1.4, color: "#94a3b8", marginBottom: 6 }}>Observability</div>
            <h1 style={{ margin: 0, fontSize: "1.8rem", lineHeight: 1.1 }}>Dev logs</h1>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Stream filters */}
            <button onClick={() => setSelectedStream("all")} style={chipStyle(selectedStream === "all", "#38bdf8")}>Alles</button>
            <button onClick={() => setSelectedStream("backend")} style={chipStyle(selectedStream === "backend", "#f59e0b")}>Backend</button>
            <button onClick={() => setSelectedStream("frontend")} style={chipStyle(selectedStream === "frontend", "#22c55e")}>Frontend</button>
            <div style={{ width: 1, height: 28, background: "rgba(148,163,184,0.2)" }} />
            {/* Level filters */}
            <button onClick={() => setSelectedLevel("all")} style={chipStyle(selectedLevel === "all", "#94a3b8")}>Alle niveaus</button>
            <button onClick={() => setSelectedLevel("error")} style={chipStyle(selectedLevel === "error", "#ef4444")}>
              Errors {errorCount > 0 && <span style={{ background: "#ef4444", borderRadius: 999, padding: "1px 6px", marginLeft: 4, fontSize: 11 }}>{errorCount}</span>}
            </button>
            <button onClick={() => setSelectedLevel("warn")} style={chipStyle(selectedLevel === "warn", "#f59e0b")}>
              Warnings {warnCount > 0 && <span style={{ background: "#f59e0b", color: "#000", borderRadius: 999, padding: "1px 6px", marginLeft: 4, fontSize: 11 }}>{warnCount}</span>}
            </button>
            <div style={{ width: 1, height: 28, background: "rgba(148,163,184,0.2)" }} />
            <button onClick={() => setShowDebug(v => !v)} style={chipStyle(showDebug, "#7dd3fc")}>{showDebug ? "Debug verbergen" : "Debug tonen"}</button>
            <button onClick={() => setShowNoise(v => !v)} style={chipStyle(showNoise, "#a78bfa")}>{showNoise ? "Noise verbergen" : "Noise tonen"}</button>
            <button onClick={() => setAutoScroll(v => !v)} style={chipStyle(autoScroll, "#34d399")}>{autoScroll ? "⬇ Auto-scroll aan" : "Auto-scroll uit"}</button>
            <button onClick={() => { clearFrontendLogs(); }} style={chipStyle(false, "#ef4444")}>Frontend wissen</button>
          </div>
        </div>

        {/* Zoekbalk + stats */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Zoek in logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: "1 1 260px", padding: "9px 14px", borderRadius: 12,
              background: "rgba(15,23,42,0.7)", border: "1px solid rgba(148,163,184,0.25)",
              color: "#e2e8f0", fontSize: 14, outline: "none"
            }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <StatPill label="Zichtbaar" value={combinedLogs.length} accent="#38bdf8" />
            <StatPill label="Backend" value={backendLogs.length} accent="#f59e0b" />
            <StatPill label="Frontend" value={frontendLogs.length} accent="#22c55e" />
            {importCount > 0 && <StatPill label="Smart import" value={importCount} accent="#a78bfa" />}
          </div>
        </div>

        {loading && <div style={{ marginBottom: 12, color: "#94a3b8", fontSize: 13 }}>Backend logs laden...</div>}
        {error && (
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)", color: "#fecaca", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Log stream */}
        <div
          ref={scrollRef}
          onScroll={e => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
            if (!atBottom && autoScroll) setAutoScroll(false);
          }}
          style={{
            background: "rgba(10, 15, 30, 0.85)", borderRadius: 16,
            border: "1px solid rgba(148, 163, 184, 0.14)",
            maxHeight: "68vh", overflowY: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 12.5
          }}
        >
          {combinedLogs.length === 0 ? (
            <div style={{ padding: 24, color: "#64748b", textAlign: "center" }}>Geen logberichten{search ? ` voor "${search}"` : ""}.</div>
          ) : (
            combinedLogs.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const isImport = String(entry.message || "").includes("[smart-import]");
              const msg = String(entry.message || "");
              const isLong = msg.length > 120;
              return (
                <div
                  key={`${entry.stream}-${entry.id}`}
                  onClick={() => isLong && setExpandedId(isExpanded ? null : entry.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 52px 78px 1fr",
                    gap: 10,
                    padding: "8px 14px",
                    borderBottom: "1px solid rgba(148, 163, 184, 0.08)",
                    background: isImport
                      ? "rgba(167, 139, 250, 0.06)"
                      : entry.level === "error"
                      ? "rgba(239,68,68,0.07)"
                      : entry.level === "warn"
                      ? "rgba(245,158,11,0.05)"
                      : entry.stream === "backend"
                      ? "rgba(245, 158, 11, 0.025)"
                      : "rgba(34, 197, 94, 0.02)",
                    cursor: isLong ? "pointer" : "default",
                    transition: "background 0.15s"
                  }}
                >
                  <div style={{ color: "#475569", whiteSpace: "nowrap" }}>{formatTimestamp(entry.timestamp)}</div>
                  <div style={{ color: levelColor(entry.level), fontWeight: 700, textTransform: "uppercase", fontSize: 11 }}>{entry.level || "log"}</div>
                  <div style={{ color: streamColor(entry.stream), fontWeight: 700, fontSize: 11 }}>{entry.stream}</div>
                  <div style={{ color: "#cbd5e1", whiteSpace: isExpanded ? "pre-wrap" : "nowrap", overflow: isExpanded ? "visible" : "hidden", textOverflow: "ellipsis", wordBreak: isExpanded ? "break-all" : undefined }}>
                    {isImport && <span style={{ color: "#a78bfa", marginRight: 6 }}>▶</span>}
                    {msg}
                    {isLong && !isExpanded && <span style={{ color: "#475569", marginLeft: 6 }}>▼</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function chipStyle(active, accent) {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? accent : "rgba(148, 163, 184, 0.22)"}`,
    background: active ? `${accent}22` : "rgba(255,255,255,0.04)",
    color: active ? accent : "#94a3b8",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    transition: "all 0.15s",
    whiteSpace: "nowrap"
  };
}

function levelColor(level) {
  if (level === "error") return "#fca5a5";
  if (level === "warn") return "#fde68a";
  if (level === "debug") return "#7dd3fc";
  return "#86efac";
}

function streamColor(stream) {
  return stream === "backend" ? "#fbbf24" : "#4ade80";
}

function StatPill({ label, value, accent }) {
  return (
    <div style={{
      borderRadius: 10, padding: "6px 14px",
      background: "rgba(15, 23, 42, 0.72)",
      border: `1px solid ${accent}44`,
      display: "flex", gap: 8, alignItems: "center"
    }}>
      <span style={{ color: "#64748b", fontSize: 12 }}>{label}</span>
      <span style={{ color: accent, fontWeight: 800, fontSize: 14 }}>{value}</span>
    </div>
  );
}

export default DevLogs;
