import pathlib
p = pathlib.Path('paystation/src/App.jsx')
s = p.read_text()

old_sessions = '''function SessionsTab({ ownerId, bays }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState(null)
  useEffect(() => {
    const q = query(collection(db, "sessions"), where("ownerId", "==", ownerId), orderBy("startedAt", "desc"), limit(50))
    const unsub = onSnapshot(q, snap => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [ownerId])
  const getBayName = (bayId) => { const b = bays.find(x => x.id === bayId); return b?.displayName || bayId?.substring(0, 8) || "Unknown" }
  if (loading) return <div style={S.placeholder}><Loader size={24} style={{ animation: "spin 1s linear infinite" }} /></div>
  return <>
    <div style={S.sectionHeader}><h2 style={S.sectionTitle}>Session History</h2><div style={{ fontSize: "12px", color: T.textDim }}>Last 50 sessions</div></div>
    {sessions.length === 0 ? <div style={S.placeholder}><BarChart3 size={40} strokeWidth={1} /><div style={S.placeholderTitle}>No sessions yet</div><div style={S.placeholderSub}>Sessions will appear here after customers use the wash.</div></div>
    : <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
          {["Date", "Bay", "Duration", "Charge", "Contact", "Receipt", "Issue", "Code"].map(h => <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: T.textDim }}>{h}</th>)}
        </tr></thead>
        <tbody>{sessions.map(s => {
          const start = s.startedAt?.toDate ? s.startedAt.toDate() : null
          const end = s.endedAt?.toDate ? s.endedAt.toDate() : null
          const duration = start && end ? Math.floor((end - start) / 1000) : 0
          const fns = (s.functionSegments || []).map(seg => fnName(seg.function, bays.find(b => b.id === s.bayId))).filter((v, i, a) => a.indexOf(v) === i)
          return <tr key={s.id} onClick={() => setSelectedSession(s)} style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "12px", color: T.textSecondary }}>{start ? formatDate(start) : "--"}</td>
            <td style={{ padding: "10px 14px", fontWeight: 600 }}>{getBayName(s.bayId)}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, color: T.accent }}>{formatDuration(duration)}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, color: T.accent }}>${(s.totalCharge || 0).toFixed(2)}</td>
            <td style={{ padding: "10px 14px", fontSize: "11px", color: T.textSecondary, maxWidth: "200px" }}>{fns.join(", ") || "--"}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "11px", color: (s.customerPhone || s.customerEmail) ? T.accent : T.textDim }}>{s.customerPhone || s.customerEmail || "--"}</td>
            <td style={{ padding: "10px 14px" }}>{s.receiptMethod ? <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: s.receiptMethod === "sms" ? T.blue + "20" : T.accent + "20", color: s.receiptMethod === "sms" ? T.blue : T.accent }}>{s.receiptMethod === "sms" ? "Text" : "Email"}</span> : <span style={{ color: T.textDim }}>--</span>}</td>
            <td style={{ padding: "10px 14px" }}>{s.issueId ? <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: T.amberDim, color: T.amber }}>Issue</span> : "--"}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "12px", color: s.transferCode ? T.accent : T.textDim }}>{s.transferCode || "--"}</td>
          </tr>
        })}</tbody>
      </table>
    </div>}
    {selectedSession && <SessionDetailModal session={selectedSession} bays={bays} onClose={() => setSelectedSession(null)} />}
  </>
}'''

new_sessions = r'''function SessionsTab({ ownerId, bays }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState(null)
  const [range, setRange] = useState("7d")
  const [view, setView] = useState("history") // "history" or "stats"

  useEffect(() => {
    let startDate = null
    const now = new Date()
    if (range === "today") { startDate = new Date(); startDate.setHours(0, 0, 0, 0) }
    else if (range === "7d") { startDate = new Date(now.getTime() - 7 * 86400000) }
    else if (range === "30d") { startDate = new Date(now.getTime() - 30 * 86400000) }
    else if (range === "90d") { startDate = new Date(now.getTime() - 90 * 86400000) }

    let q
    if (startDate) {
      q = query(collection(db, "sessions"), where("ownerId", "==", ownerId), where("startedAt", ">=", Timestamp.fromDate(startDate)), orderBy("startedAt", "desc"), limit(500))
    } else {
      q = query(collection(db, "sessions"), where("ownerId", "==", ownerId), orderBy("startedAt", "desc"), limit(500))
    }
    setLoading(true)
    const unsub = onSnapshot(q, snap => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [ownerId, range])

  const getBayName = (bayId) => { const b = bays.find(x => x.id === bayId); return b?.displayName || bayId?.substring(0, 8) || "Unknown" }

  // Stats calculations
  const totalRevenue = sessions.reduce((sum, s) => sum + (s.totalCharge || 0), 0)
  const totalSessions = sessions.length
  const avgCharge = totalSessions > 0 ? totalRevenue / totalSessions : 0
  const totalDuration = sessions.reduce((sum, s) => {
    const start = s.startedAt?.toDate ? s.startedAt.toDate() : null
    const end = s.endedAt?.toDate ? s.endedAt.toDate() : null
    return sum + (start && end ? Math.floor((end - start) / 1000) : 0)
  }, 0)
  const avgDuration = totalSessions > 0 ? totalDuration / totalSessions : 0
  const issueCount = sessions.filter(s => s.issueId).length

  // Per-bay stats
  const bayStats = {}
  sessions.forEach(s => {
    if (!bayStats[s.bayId]) bayStats[s.bayId] = { name: getBayName(s.bayId), sessions: 0, revenue: 0, duration: 0 }
    bayStats[s.bayId].sessions++
    bayStats[s.bayId].revenue += (s.totalCharge || 0)
    const start = s.startedAt?.toDate ? s.startedAt.toDate() : null
    const end = s.endedAt?.toDate ? s.endedAt.toDate() : null
    bayStats[s.bayId].duration += (start && end ? Math.floor((end - start) / 1000) : 0)
  })

  // Function popularity
  const fnStats = {}
  sessions.forEach(s => {
    const segs = s.functionSegments || []
    const bay = bays.find(b => b.id === s.bayId)
    segs.forEach(seg => {
      const name = fnName(seg.function, bay)
      const segStart = seg.startedAt?.toDate ? seg.startedAt.toDate() : (seg.startedAt?.seconds ? new Date(seg.startedAt.seconds * 1000) : null)
      const segEnd = seg.endedAt?.toDate ? seg.endedAt.toDate() : (seg.endedAt?.seconds ? new Date(seg.endedAt.seconds * 1000) : null)
      const secs = segStart && segEnd ? Math.floor((segEnd - segStart) / 1000) : 0
      if (!fnStats[name]) fnStats[name] = { count: 0, totalTime: 0 }
      fnStats[name].count++
      fnStats[name].totalTime += secs
    })
  })
  const sortedFns = Object.entries(fnStats).sort((a, b) => b[1].totalTime - a[1].totalTime)
  const maxFnTime = sortedFns.length > 0 ? sortedFns[0][1].totalTime : 1

  // Daily revenue for chart-like display
  const dailyRevenue = {}
  sessions.forEach(s => {
    const d = s.startedAt?.toDate ? s.startedAt.toDate().toLocaleDateString("en-CA") : null
    if (d) { dailyRevenue[d] = (dailyRevenue[d] || 0) + (s.totalCharge || 0) }
  })
  const dailySessions = {}
  sessions.forEach(s => {
    const d = s.startedAt?.toDate ? s.startedAt.toDate().toLocaleDateString("en-CA") : null
    if (d) { dailySessions[d] = (dailySessions[d] || 0) + 1 }
  })
  const sortedDays = Object.keys(dailyRevenue).sort()
  const maxDayRev = Math.max(...Object.values(dailyRevenue), 1)

  const rangeLabels = { today: "Today", "7d": "7 Days", "30d": "30 Days", "90d": "90 Days", all: "All Time" }

  if (loading) return <div style={S.placeholder}><Loader size={24} style={{ animation: "spin 1s linear infinite" }} /></div>

  return <>
    <div style={S.sectionHeader}>
      <h2 style={S.sectionTitle}>Sessions</h2>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {/* View toggle */}
        <div style={{ display: "flex", gap: "4px", marginRight: "12px" }}>
          {["history", "stats"].map(v => <button key={v} onClick={() => setView(v)} style={{
            padding: "5px 14px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", cursor: "pointer", border: "none",
            background: view === v ? T.accent + "22" : T.bgDeep, color: view === v ? T.accent : T.textDim
          }}>{v === "history" ? "History" : "Statistics"}</button>)}
        </div>
        {/* Date range pills */}
        <div style={{ display: "flex", gap: "4px" }}>
          {Object.keys(rangeLabels).map(r => <button key={r} onClick={() => setRange(r)} style={{
            padding: "5px 12px", borderRadius: "6px", fontSize: "10px", fontWeight: 600, letterSpacing: "1px", cursor: "pointer", border: "none",
            background: range === r ? T.blue + "22" : T.bgDeep, color: range === r ? T.blue : T.textDim
          }}>{rangeLabels[r]}</button>)}
        </div>
      </div>
    </div>

    {view === "stats" ? <>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "20px" }}>
        <div style={S.statCard}><div style={S.scLabel}>Revenue</div><div style={S.scValue(T.accent)}>${totalRevenue.toFixed(2)}</div></div>
        <div style={S.statCard}><div style={S.scLabel}>Sessions</div><div style={S.scValue(T.blue)}>{totalSessions}</div></div>
        <div style={S.statCard}><div style={S.scLabel}>Avg Charge</div><div style={S.scValue(T.accent)}>${avgCharge.toFixed(2)}</div></div>
        <div style={S.statCard}><div style={S.scLabel}>Avg Duration</div><div style={{ fontFamily: T.fontMono, fontSize: "20px", color: T.textPrimary }}>{formatDuration(Math.floor(avgDuration))}</div></div>
        <div style={S.statCard}><div style={S.scLabel}>Issues</div><div style={S.scValue(T.amber)}>{issueCount}</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        {/* Daily Revenue */}
        <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "12px", padding: "20px" }}>
          <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: T.textDim, marginBottom: "14px" }}>DAILY REVENUE</div>
          {sortedDays.length === 0 ? <div style={{ color: T.textDim, fontSize: "12px" }}>No data</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {sortedDays.slice(-14).map(day => <div key={day} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "70px", fontFamily: T.fontMono, fontSize: "10px", color: T.textDim, flexShrink: 0 }}>{day.slice(5)}</div>
              <div style={{ flex: 1, height: "16px", borderRadius: "4px", background: T.bgDeep, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: "4px", background: T.accent, width: (dailyRevenue[day] / maxDayRev * 100) + "%", transition: "width 0.3s" }} />
              </div>
              <div style={{ width: "60px", fontFamily: T.fontMono, fontSize: "11px", color: T.accent, textAlign: "right" }}>${dailyRevenue[day].toFixed(2)}</div>
              <div style={{ width: "30px", fontFamily: T.fontMono, fontSize: "10px", color: T.textDim, textAlign: "right" }}>{dailySessions[day] || 0}</div>
            </div>)}
          </div>}
        </div>

        {/* Function Popularity */}
        <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "12px", padding: "20px" }}>
          <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: T.textDim, marginBottom: "14px" }}>FUNCTION USAGE (by time)</div>
          {sortedFns.length === 0 ? <div style={{ color: T.textDim, fontSize: "12px" }}>No data</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sortedFns.map(([name, data]) => <div key={name}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                <span style={{ fontWeight: 600, color: T.textPrimary }}>{name}</span>
                <span style={{ fontFamily: T.fontMono, color: T.textSecondary }}>{formatDuration(data.totalTime)} ({data.count}x)</span>
              </div>
              <div style={{ height: "8px", borderRadius: "4px", background: T.bgDeep, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: "4px", background: T.blue, width: (data.totalTime / maxFnTime * 100) + "%", transition: "width 0.3s" }} />
              </div>
            </div>)}
          </div>}
        </div>
      </div>

      {/* Per-Bay Breakdown */}
      {Object.keys(bayStats).length > 0 && <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: T.textDim, borderBottom: "1px solid " + T.border }}>BY BAY</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead><tr style={{ borderBottom: "1px solid " + T.border }}>
            {["Bay", "Sessions", "Revenue", "Avg Charge", "Total Time", "Avg Time"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: T.textDim }}>{h}</th>)}
          </tr></thead>
          <tbody>{Object.entries(bayStats).sort((a, b) => b[1].revenue - a[1].revenue).map(([id, bs]) => <tr key={id} style={{ borderBottom: "1px solid " + T.border }}>
            <td style={{ padding: "10px 14px", fontWeight: 600 }}>{bs.name}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono }}>{bs.sessions}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, color: T.accent }}>${bs.revenue.toFixed(2)}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono }}>${(bs.sessions > 0 ? bs.revenue / bs.sessions : 0).toFixed(2)}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono }}>{formatDuration(bs.duration)}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono }}>{formatDuration(bs.sessions > 0 ? Math.floor(bs.duration / bs.sessions) : 0)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </>

    : <>
      {/* History View */}
      <div style={{ fontSize: "12px", color: T.textDim, marginBottom: "12px" }}>{totalSessions} sessions — ${totalRevenue.toFixed(2)} total revenue</div>
      {sessions.length === 0 ? <div style={S.placeholder}><BarChart3 size={40} strokeWidth={1} /><div style={S.placeholderTitle}>No sessions in this period</div><div style={S.placeholderSub}>Try a longer date range.</div></div>
      : <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "12px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead><tr style={{ borderBottom: "1px solid " + T.border }}>
            {["Date", "Bay", "Duration", "Charge", "Contact", "Receipt", "Issue", "Code"].map(h => <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: T.textDim }}>{h}</th>)}
          </tr></thead>
          <tbody>{sessions.map(s => {
            const start = s.startedAt?.toDate ? s.startedAt.toDate() : null
            const end = s.endedAt?.toDate ? s.endedAt.toDate() : null
            const duration = start && end ? Math.floor((end - start) / 1000) : 0
            return <tr key={s.id} onClick={() => setSelectedSession(s)} style={{ cursor: "pointer", borderBottom: "1px solid " + T.border }}>
              <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "12px", color: T.textSecondary }}>{start ? formatDate(start) : "--"}</td>
              <td style={{ padding: "10px 14px", fontWeight: 600 }}>{getBayName(s.bayId)}</td>
              <td style={{ padding: "10px 14px", fontFamily: T.fontMono, color: T.accent }}>{formatDuration(duration)}</td>
              <td style={{ padding: "10px 14px", fontFamily: T.fontMono, color: T.accent }}>${(s.totalCharge || 0).toFixed(2)}</td>
              <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "11px", color: (s.customerPhone || s.customerEmail) ? T.accent : T.textDim }}>{s.customerPhone || s.customerEmail || "--"}</td>
              <td style={{ padding: "10px 14px" }}>{s.receiptMethod ? <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: s.receiptMethod === "sms" ? T.blue + "20" : T.accent + "20", color: s.receiptMethod === "sms" ? T.blue : T.accent }}>{s.receiptMethod === "sms" ? "Text" : "Email"}</span> : <span style={{ color: T.textDim }}>--</span>}</td>
              <td style={{ padding: "10px 14px" }}>{s.issueId ? <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: T.amberDim, color: T.amber }}>Issue</span> : "--"}</td>
              <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "12px", color: s.transferCode ? T.accent : T.textDim }}>{s.transferCode || "--"}</td>
            </tr>
          })}</tbody>
        </table>
      </div>}
    </>}
    {selectedSession && <SessionDetailModal session={selectedSession} bays={bays} onClose={() => setSelectedSession(null)} />}
  </>
}'''

assert s.count(old_sessions) == 1, 'SessionsTab not found'
s = s.replace(old_sessions, new_sessions)

p.write_text(s)
print('OK - SessionsTab rewritten with date filtering + statistics')
print('Features:')
print('  - Date range pills: Today, 7 Days, 30 Days, 90 Days, All Time')
print('  - View toggle: History (table) / Statistics')
print('  - Stats: Revenue, Sessions, Avg Charge, Avg Duration, Issues')
print('  - Daily revenue bar chart (last 14 days)')
print('  - Function popularity by total time with usage count')
print('  - Per-bay breakdown table (sessions, revenue, avg charge, time)')
