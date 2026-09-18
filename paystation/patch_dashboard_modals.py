import pathlib
p = pathlib.Path('paystation/src/App.jsx')
s = p.read_text()

# ═══════════════════════════════════════════════════════════════
# 1. FIX SESSIONS TILE CLICK
# ═══════════════════════════════════════════════════════════════
# The BayOverview function signature may not have been updated
old_overview = 'function BayOverview({ bays, todayStats, onNavigateConfig })'
if s.count(old_overview) == 1:
    s = s.replace(old_overview, 'function BayOverview({ bays, todayStats, onNavigateConfig, onNavigateSessions, onNavigateIssues, onNavigateDevices })')
    print('  Fixed BayOverview signature')

# ═══════════════════════════════════════════════════════════════
# 2. ADD CONTACT + RECEIPT COLUMNS TO SESSIONS TABLE
# ═══════════════════════════════════════════════════════════════
old_session_headers = '          {["Date", "Bay", "Duration", "Charge", "Functions", "Issue", "Code"].map(h => <th key={h}'
new_session_headers = '          {["Date", "Bay", "Duration", "Charge", "Contact", "Receipt", "Issue", "Code"].map(h => <th key={h}'
assert s.count(old_session_headers) == 1, 'Session table headers not found'
s = s.replace(old_session_headers, new_session_headers)

old_session_issue_col = """            <td style={{ padding: "10px 14px" }}>{s.issueId ? <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: T.amberDim, color: T.amber }}>Issue</span> : "--"}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "12px", color: s.transferCode ? T.accent : T.textDim }}>{s.transferCode || "--"}</td>"""

new_session_issue_col = """            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "11px", color: (s.customerPhone || s.customerEmail) ? T.accent : T.textDim }}>{s.customerPhone || s.customerEmail || "--"}</td>
            <td style={{ padding: "10px 14px" }}>{s.receiptMethod ? <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: s.receiptMethod === "sms" ? T.blue + "20" : T.accent + "20", color: s.receiptMethod === "sms" ? T.blue : T.accent }}>{s.receiptMethod === "sms" ? "Text" : "Email"}</span> : <span style={{ color: T.textDim }}>--</span>}</td>
            <td style={{ padding: "10px 14px" }}>{s.issueId ? <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: T.amberDim, color: T.amber }}>Issue</span> : "--"}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "12px", color: s.transferCode ? T.accent : T.textDim }}>{s.transferCode || "--"}</td>"""

assert s.count(old_session_issue_col) == 1, 'Session issue/code columns not found'
s = s.replace(old_session_issue_col, new_session_issue_col)

# ═══════════════════════════════════════════════════════════════
# 3. ADD CONTACT + SEND RECEIPT TO SESSION DETAIL MODAL
# ═══════════════════════════════════════════════════════════════
old_modal_end = """        {(session.issueId || session.transferCode) && <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "10px", padding: "16px 20px" }}>
          {session.issueId && <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: session.transferCode ? "10px" : 0 }}>
            <AlertTriangle size={14} style={{ color: T.amber }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: T.amber }}>Issue reported during session</span>
          </div>}
          {session.transferCode && <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <KeyRound size={14} style={{ color: T.accent }} />
            <span style={{ fontSize: "13px", color: T.textSecondary }}>Transfer code:</span>
            <span style={{ fontFamily: T.fontMono, fontSize: "15px", fontWeight: 600, color: T.accent, letterSpacing: "2px" }}>{session.transferCode}</span>
          </div>}
        </div>}
      </div>
    </div>
  </div>
}"""

new_modal_end = """        {/* Contact + Receipt */}
        <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "10px", padding: "16px 20px", marginBottom: "20px" }}>
          <div style={{ ...CS.label, marginBottom: "12px" }}>Customer Contact</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div><div style={{ fontSize: "10px", color: T.textDim, letterSpacing: "1px", marginBottom: "2px" }}>PHONE</div><div style={{ fontFamily: T.fontMono, fontSize: "13px", color: session.customerPhone ? T.accent : T.textDim }}>{session.customerPhone || "Not provided"}</div></div>
            <div><div style={{ fontSize: "10px", color: T.textDim, letterSpacing: "1px", marginBottom: "2px" }}>EMAIL</div><div style={{ fontFamily: T.fontMono, fontSize: "13px", color: session.customerEmail ? T.accent : T.textDim }}>{session.customerEmail || "Not provided"}</div></div>
          </div>
          {session.receiptMethod && <div style={{ marginTop: "10px", fontSize: "11px", color: T.textSecondary }}>Receipt sent via {session.receiptMethod === "sms" ? "text" : "email"} to {session.customerPhone || session.customerEmail}</div>}
          <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
            <button onClick={() => {
              const dest = prompt("Enter phone or email to send receipt:")
              if (!dest) return
              const method = dest.includes("@") ? "email" : "sms"
              const destination = method === "sms" ? (dest.startsWith("+") ? dest : "+1" + dest.replace(/\\D/g, "")) : dest
              const bay = bays.find(b => b.id === session.bayId)
              const start = session.startedAt?.toDate ? session.startedAt.toDate() : new Date()
              const segments = session.functionSegments || []
              const fnList = []
              const fnAgg = {}
              segments.forEach(seg => {
                const name = fnName(seg.function, bay)
                const segStart = seg.startedAt?.toDate ? seg.startedAt.toDate() : (seg.startedAt?.seconds ? new Date(seg.startedAt.seconds * 1000) : null)
                const segEnd = seg.endedAt?.toDate ? seg.endedAt.toDate() : (seg.endedAt?.seconds ? new Date(seg.endedAt.seconds * 1000) : null)
                const secs = segStart && segEnd ? Math.floor((segEnd - segStart) / 1000) : 0
                fnAgg[name] = (fnAgg[name] || 0) + secs
              })
              Object.entries(fnAgg).forEach(([name, secs]) => { fnList.push({ name, time: String(Math.floor(secs/60)).padStart(2,"0") + ":" + String(secs%60).padStart(2,"0") }) })
              const sd = session.startedAt?.toDate ? session.startedAt.toDate() : new Date()
              const dur = session.startedAt?.toDate && session.endedAt?.toDate ? Math.floor((session.endedAt.toDate() - session.startedAt.toDate()) / 1000) : 0
              fetch("https://us-central1-washlevel-c16d9.cloudfunctions.net/sendWashBoardReceipt", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ method, destination, sessionData: {
                  washName: bay?.washName || "Self-Serve Wash", bayName: bay?.displayName || "Bay",
                  date: formatDate(sd), duration: String(Math.floor(dur/60)).padStart(2,"0") + ":" + String(dur%60).padStart(2,"0"),
                  subtotal: session.subtotal || session.totalCharge || 0, salesTax: session.salesTax || 0, total: session.totalCharge || 0,
                  functions: fnList, transferCode: session.transferCode || null, promoDiscount: 0, promoCredit: 0, logoUrl: bay?.logoUrl || ""
                }})
              }).then(r => r.json()).then(d => { if (d.success) alert("Receipt sent!"); else alert("Failed: " + (d.error || "Unknown error")) }).catch(e => alert("Error: " + e.message))
            }} style={{ background: T.accent + "18", color: T.accent, border: "1px solid " + T.accent + "44", borderRadius: "6px", padding: "6px 14px", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><Mail size={12} /> SEND RECEIPT</button>
          </div>
        </div>

        {(session.issueId || session.transferCode) && <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "10px", padding: "16px 20px" }}>
          {session.issueId && <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: session.transferCode ? "10px" : 0 }}>
            <AlertTriangle size={14} style={{ color: T.amber }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: T.amber }}>Issue reported during session</span>
          </div>}
          {session.transferCode && <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <KeyRound size={14} style={{ color: T.accent }} />
            <span style={{ fontSize: "13px", color: T.textSecondary }}>Transfer code:</span>
            <span style={{ fontFamily: T.fontMono, fontSize: "15px", fontWeight: 600, color: T.accent, letterSpacing: "2px" }}>{session.transferCode}</span>
          </div>}
        </div>}
      </div>
    </div>
  </div>
}"""

assert s.count(old_modal_end) == 1, 'Session modal end not found'
s = s.replace(old_modal_end, new_modal_end)

# ═══════════════════════════════════════════════════════════════
# 4. ADD ISSUE DETAIL MODAL + WIRE CLICKABLE ROWS
# ═══════════════════════════════════════════════════════════════

# Add selectedIssue state and modal to IssuesTab
old_issues_state = '''function IssuesTab({ ownerId, bays }) {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")'''

new_issues_state = '''function IssuesTab({ ownerId, bays }) {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [selectedIssue, setSelectedIssue] = useState(null)'''

assert s.count(old_issues_state) == 1, 'IssuesTab state not found'
s = s.replace(old_issues_state, new_issues_state)

# Make rows clickable
old_issue_row = '''          return <tr key={issue.id} style={{ borderBottom: "1px solid " + T.border }}>'''
new_issue_row = '''          return <tr key={issue.id} onClick={() => setSelectedIssue(issue)} style={{ cursor: "pointer", borderBottom: "1px solid " + T.border }}>'''
assert s.count(old_issue_row) == 1, 'Issue row not found'
s = s.replace(old_issue_row, new_issue_row)

# Add contact column to issues table
old_issue_headers = '''          {["Time", "Bay", "Type", "Function", "Phone", "Transfer Code", "Status", ""].map(h => <th key={h}'''
new_issue_headers = '''          {["Time", "Bay", "Type", "Function", "Contact", "Transfer Code", "Status", ""].map(h => <th key={h}'''
assert s.count(old_issue_headers) == 1, 'Issue headers not found'
s = s.replace(old_issue_headers, new_issue_headers)

# Update phone column label reference
old_phone_col = '''            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "12px", color: issue.callbackPhone ? T.accent : T.textDim }}>{issue.callbackPhone || "--"}</td>'''
new_phone_col = '''            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "11px", color: issue.callbackPhone ? T.accent : T.textDim }}>{issue.callbackPhone || "--"}</td>'''
assert s.count(old_phone_col) == 1, 'Issue phone column not found'
s = s.replace(old_phone_col, new_phone_col)

# Add modal render at end of IssuesTab (before the closing <>)
old_issues_end = '''    </div>}
  </>
}

// ═══════════════════════════════════════════
// DEVICES TAB'''

new_issues_end = '''    </div>}
    {selectedIssue && <IssueDetailModal issue={selectedIssue} bays={bays} onClose={() => setSelectedIssue(null)} onResolve={(id) => { resolveIssue(id); setSelectedIssue(null) }} />}
  </>
}

function IssueDetailModal({ issue, bays, onClose, onResolve }) {
  const [session, setSession] = useState(null)
  const [startPhoto, setStartPhoto] = useState(null)
  const [endPhoto, setEndPhoto] = useState(null)

  useEffect(() => {
    if (!issue.sessionId) return
    const loadSession = async () => {
      try {
        const d = await getDoc(doc(db, "sessions", issue.sessionId))
        if (d.exists()) setSession({ id: d.id, ...d.data() })
      } catch (e) {}
    }
    loadSession()
    const loadPhoto = async (filename, setter) => {
      try {
        const r = storageRef(storage, "sessions/" + issue.sessionId + "/" + filename + ".jpg")
        setter(await getDownloadURL(r))
      } catch (e) {}
    }
    loadPhoto("start", setStartPhoto)
    loadPhoto("end", setEndPhoto)
  }, [issue.sessionId])

  const bay = bays.find(b => b.id === issue.bayId)
  const issueTypes = { functionNotWorking: "Function Not Working", leakingFitting: "Leaking Fitting", other: "Other" }
  const time = issue.reportedAt?.toDate ? issue.reportedAt.toDate() : null
  const isOpen = issue.status === "open"
  const resolvedAt = issue.resolvedAt?.toDate ? issue.resolvedAt.toDate() : null

  const segments = session?.functionSegments || []
  const fnTimes = {}
  segments.forEach(seg => {
    const name = fnName(seg.function, bay)
    const segStart = seg.startedAt?.toDate ? seg.startedAt.toDate() : (seg.startedAt?.seconds ? new Date(seg.startedAt.seconds * 1000) : null)
    const segEnd = seg.endedAt?.toDate ? seg.endedAt.toDate() : (seg.endedAt?.seconds ? new Date(seg.endedAt.seconds * 1000) : null)
    const secs = segStart && segEnd ? Math.floor((segEnd - segStart) / 1000) : 0
    fnTimes[name] = (fnTimes[name] || 0) + secs
  })
  const duration = session?.startedAt?.toDate && session?.endedAt?.toDate ? Math.floor((session.endedAt.toDate() - session.startedAt.toDate()) / 1000) : 0

  return <div style={S.modal}>
    <div style={S.modalBackdrop} onClick={onClose} />
    <div style={{ ...S.modalContent, maxWidth: "700px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid " + T.border }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <AlertTriangle size={20} style={{ color: T.amber }} />
          <div>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: "18px", fontWeight: 600, color: T.textPrimary, margin: 0 }}>Issue Details</h2>
            <div style={{ fontSize: "11px", color: T.textDim, marginTop: "2px" }}>{bay?.displayName || issue.bayId} {time ? " — " + formatDate(time) : ""}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim }}><X size={20} /></button>
      </div>

      <div style={{ padding: "20px 24px", maxHeight: "70vh", overflowY: "auto" }}>
        {/* Status + Type */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          <div style={S.statCard}><div style={S.scLabel}>Type</div><div style={{ fontSize: "14px", fontWeight: 600, color: T.amber }}>{issueTypes[issue.type] || issue.type}</div></div>
          <div style={S.statCard}><div style={S.scLabel}>Function</div><div style={{ fontSize: "14px", fontWeight: 600, color: T.textPrimary }}>{issue.affectedFunction != null ? fnName(issue.affectedFunction, bay) : "N/A"}</div></div>
          <div style={S.statCard}><div style={S.scLabel}>Status</div><div style={{ fontSize: "14px", fontWeight: 600, color: isOpen ? T.amber : T.green }}>{isOpen ? "Open" : "Resolved"}</div>{resolvedAt && <div style={{ fontSize: "10px", color: T.textDim, marginTop: "2px" }}>{formatDate(resolvedAt)}</div>}</div>
        </div>

        {/* Contact */}
        <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "10px", padding: "16px 20px", marginBottom: "20px" }}>
          <div style={{ ...CS.label, marginBottom: "12px" }}>Customer Contact</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div><div style={{ fontSize: "10px", color: T.textDim, letterSpacing: "1px", marginBottom: "2px" }}>CALLBACK PHONE</div><div style={{ fontFamily: T.fontMono, fontSize: "14px", color: issue.callbackPhone ? T.accent : T.textDim }}>{issue.callbackPhone || "Not provided"}</div></div>
            <div><div style={{ fontSize: "10px", color: T.textDim, letterSpacing: "1px", marginBottom: "2px" }}>TRANSFER CODE</div><div style={{ fontFamily: T.fontMono, fontSize: "14px", letterSpacing: "3px", color: issue.transferCode ? T.accent : T.textDim }}>{issue.transferCode || "None"}</div></div>
          </div>
          {session?.customerEmail && <div style={{ marginTop: "10px" }}><div style={{ fontSize: "10px", color: T.textDim, letterSpacing: "1px", marginBottom: "2px" }}>EMAIL (FROM RECEIPT)</div><div style={{ fontFamily: T.fontMono, fontSize: "13px", color: T.accent }}>{session.customerEmail}</div></div>}
        </div>

        {/* Session Photos */}
        {(startPhoto || endPhoto) && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          <div style={{ background: T.bgDeep, border: "1px solid " + T.border, borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "8px 12px", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: T.textDim, borderBottom: "1px solid " + T.border }}>SESSION START</div>
            {startPhoto ? <img src={startPhoto} alt="Start" style={{ width: "100%", display: "block" }} /> : <div style={{ padding: "40px", textAlign: "center", color: T.textDim, fontSize: "12px" }}>No photo</div>}
          </div>
          <div style={{ background: T.bgDeep, border: "1px solid " + T.border, borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "8px 12px", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: T.textDim, borderBottom: "1px solid " + T.border }}>SESSION END</div>
            {endPhoto ? <img src={endPhoto} alt="End" style={{ width: "100%", display: "block" }} /> : <div style={{ padding: "40px", textAlign: "center", color: T.textDim, fontSize: "12px" }}>No photo</div>}
          </div>
        </div>}

        {/* Session charges */}
        {session && <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "10px", padding: "16px 20px", marginBottom: "20px" }}>
          <div style={{ ...CS.label, marginBottom: "12px" }}>Session</div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}><span style={{ color: T.textSecondary }}>Duration</span><span style={{ fontFamily: T.fontMono, color: T.accent }}>{formatDuration(duration)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}><span style={{ color: T.textSecondary }}>Total Charge</span><span style={{ fontFamily: T.fontMono, color: T.accent }}>{"$" + (session.totalCharge || 0).toFixed(2)}</span></div>
        </div>}

        {/* Function breakdown */}
        {Object.keys(fnTimes).length > 0 && <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "10px", padding: "16px 20px", marginBottom: "20px" }}>
          <div style={{ ...CS.label, marginBottom: "12px" }}>Function Breakdown</div>
          {Object.entries(fnTimes).sort((a, b) => b[1] - a[1]).map(([name, secs]) => {
            const pct = duration > 0 ? (secs / duration * 100) : 0
            return <div key={name} style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                <span style={{ fontWeight: 600, color: T.textPrimary }}>{name}</span>
                <span style={{ fontFamily: T.fontMono, color: T.textSecondary }}>{formatDuration(secs)}</span>
              </div>
              <div style={{ height: "6px", borderRadius: "3px", background: T.bgDeep, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: "3px", background: T.accent, width: pct + "%", transition: "width 0.3s" }} />
              </div>
            </div>
          })}
        </div>}

        {/* Resolve button */}
        {isOpen && <button onClick={() => onResolve(issue.id)} style={{ width: "100%", background: T.green + "18", color: T.green, border: "1px solid " + T.green + "44", borderRadius: "10px", padding: "14px", fontSize: "13px", fontWeight: 700, letterSpacing: "2px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}><Check size={16} /> MARK AS RESOLVED</button>}
      </div>
    </div>
  </div>
}

// ═══════════════════════════════════════════
// DEVICES TAB'''

assert s.count(old_issues_end) == 1, 'Issues tab end not found'
s = s.replace(old_issues_end, new_issues_end)

p.write_text(s)
print('OK - Dashboard updated:')
print('  - Sessions: Contact + Receipt columns, Send Receipt in modal')
print('  - Issues: Clickable rows, full detail modal with photos/functions/contact/resolve')
print('  - BayOverview: Tile click fix')
