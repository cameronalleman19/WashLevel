import pathlib
p = pathlib.Path('paystation/src/App.jsx')
s = p.read_text()

# ═══════════════════════════════════════════════════════════════
# 1. ADD FOUR NEW TABS BEFORE PlaceholderTab
# ═══════════════════════════════════════════════════════════════
anchor = 'function PlaceholderTab({ icon: Icon, label }) {'

new_tabs = r'''
// ═══════════════════════════════════════════
// PAYMENTS TAB (Stripe Connect placeholder)
// ═══════════════════════════════════════════
function PaymentsTab({ ownerId, bays }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, "sessions"), where("ownerId", "==", ownerId), orderBy("startedAt", "desc"), limit(50))
    const unsub = onSnapshot(q, snap => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.totalCharge > 0))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [ownerId])

  const getBayName = (bayId) => { const b = bays.find(x => x.id === bayId); return b?.displayName || bayId?.substring(0, 8) || "Unknown" }
  const totalRev = sessions.reduce((sum, s) => sum + (s.totalCharge || 0), 0)

  if (loading) return <div style={S.placeholder}><Loader size={24} style={{ animation: "spin 1s linear infinite" }} /></div>

  return <>
    <div style={S.sectionHeader}><h2 style={S.sectionTitle}>Payments</h2></div>

    {/* Stripe Connect Banner */}
    <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "12px", padding: "24px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: "16px", fontWeight: 600, color: T.textPrimary, marginBottom: "4px" }}>Stripe Connect</div>
        <div style={{ fontSize: "13px", color: T.textDim, lineHeight: 1.5 }}>Connect your Stripe account to accept card payments at the kiosk. Funds are deposited directly to your bank account.</div>
      </div>
      <button style={{ background: "#635BFF", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", opacity: 0.6 }} disabled>Coming Soon</button>
    </div>

    {/* Transaction History */}
    <div style={S.sectionHeader}><h3 style={{ ...S.sectionTitle, fontSize: "14px" }}>Transaction History</h3><div style={{ fontSize: "12px", color: T.textDim }}>Total: ${totalRev.toFixed(2)} from {sessions.length} sessions</div></div>
    {sessions.length === 0 ? <div style={S.placeholder}><CreditCard size={40} strokeWidth={1} /><div style={S.placeholderTitle}>No transactions yet</div><div style={S.placeholderSub}>Completed sessions with charges will appear here.</div></div>
    : <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "12px", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead><tr style={{ borderBottom: "1px solid " + T.border }}>
          {["Date", "Bay", "Subtotal", "Tax", "Total", "Status"].map(h => <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: T.textDim }}>{h}</th>)}
        </tr></thead>
        <tbody>{sessions.map(s => {
          const date = s.startedAt?.toDate ? s.startedAt.toDate() : null
          return <tr key={s.id} style={{ borderBottom: "1px solid " + T.border }}>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "12px", color: T.textSecondary }}>{date ? formatDate(date) : "--"}</td>
            <td style={{ padding: "10px 14px", fontWeight: 600 }}>{getBayName(s.bayId)}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono }}>${(s.subtotal || s.totalCharge || 0).toFixed(2)}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, color: T.textSecondary }}>{s.salesTax ? "$" + s.salesTax.toFixed(2) : "--"}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, color: T.accent, fontWeight: 600 }}>${(s.totalCharge || 0).toFixed(2)}</td>
            <td style={{ padding: "10px 14px" }}><span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: s.stripePaymentIntentId ? T.green + "20" : T.blue + "20", color: s.stripePaymentIntentId ? T.green : T.blue }}>{s.stripePaymentIntentId ? "Captured" : "Dev Mode"}</span></td>
          </tr>
        })}</tbody>
      </table>
    </div>}
  </>
}

// ═══════════════════════════════════════════
// STAFF ACCESS TAB
// ═══════════════════════════════════════════
function StaffTab({ ownerId }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("full")
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    const q = query(collection(db, "washboardStaff"), where("ownerId", "==", ownerId), orderBy("invitedAt", "desc"))
    const unsub = onSnapshot(q, snap => {
      setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [ownerId])

  const inviteStaff = async () => {
    if (!inviteEmail || !inviteEmail.includes("@")) return
    setInviting(true)
    try {
      await addDoc(collection(db, "washboardStaff"), {
        ownerId, email: inviteEmail.toLowerCase().trim(), role: inviteRole,
        status: "pending", invitedAt: serverTimestamp()
      })
      setInviteEmail("")
      setShowInvite(false)
    } catch (e) { console.error("Invite failed:", e) }
    setInviting(false)
  }

  const removeStaff = async (id) => {
    if (!confirm("Remove this staff member?")) return
    try { await deleteDoc(doc(db, "washboardStaff", id)) } catch (e) { console.error(e) }
  }

  const toggleRole = async (id, currentRole) => {
    const newRole = currentRole === "full" ? "no-finance" : "full"
    try { await updateDoc(doc(db, "washboardStaff", id), { role: newRole }) } catch (e) { console.error(e) }
  }

  if (loading) return <div style={S.placeholder}><Loader size={24} style={{ animation: "spin 1s linear infinite" }} /></div>

  return <>
    <div style={S.sectionHeader}>
      <h2 style={S.sectionTitle}>Staff Access</h2>
      <button onClick={() => setShowInvite(!showInvite)} style={{ background: T.accent + "18", color: T.accent, border: "1px solid " + T.accent + "44", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><Plus size={14} /> INVITE STAFF</button>
    </div>

    {showInvite && <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label style={CS.label}>Email Address</label>
          <input style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep }} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="staff@email.com" />
        </div>
        <div style={{ width: "180px" }}>
          <label style={CS.label}>Access Level</label>
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep, cursor: "pointer" }}>
            <option value="full">Full Access</option>
            <option value="no-finance">No Finance</option>
          </select>
        </div>
        <button onClick={inviteStaff} disabled={inviting} style={{ background: T.accent, color: T.bgDeep, border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{inviting ? "Sending..." : "Send Invite"}</button>
        <button onClick={() => { setShowInvite(false); setInviteEmail("") }} style={{ background: "none", border: "1px solid " + T.border, borderRadius: "8px", padding: "10px", cursor: "pointer", color: T.textDim }}><X size={16} /></button>
      </div>
      <div style={{ marginTop: "10px", fontSize: "11px", color: T.textDim }}>
        <b>Full Access:</b> All dashboard features including revenue, payments, and billing.
        <b style={{ marginLeft: "12px" }}>No Finance:</b> Bay management, sessions, and issues — no revenue or payment data visible.
      </div>
    </div>}

    {staff.length === 0 && !showInvite ? <div style={S.placeholder}><Users size={40} strokeWidth={1} /><div style={S.placeholderTitle}>No staff members</div><div style={S.placeholderSub}>Invite staff to give them dashboard access with role-based permissions.</div></div>
    : staff.length > 0 && <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "12px", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead><tr style={{ borderBottom: "1px solid " + T.border }}>
          {["Email", "Role", "Status", "Invited", ""].map(h => <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: T.textDim }}>{h}</th>)}
        </tr></thead>
        <tbody>{staff.map(m => {
          const invited = m.invitedAt?.toDate ? m.invitedAt.toDate() : null
          return <tr key={m.id} style={{ borderBottom: "1px solid " + T.border }}>
            <td style={{ padding: "10px 14px", fontWeight: 600 }}>{m.email}</td>
            <td style={{ padding: "10px 14px" }}>
              <button onClick={() => toggleRole(m.id, m.role)} style={{ fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "4px", border: "none", cursor: "pointer", background: m.role === "full" ? T.accent + "20" : T.blue + "20", color: m.role === "full" ? T.accent : T.blue }}>{m.role === "full" ? "Full Access" : "No Finance"}</button>
            </td>
            <td style={{ padding: "10px 14px" }}><span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: m.status === "active" ? T.green + "20" : T.amber + "20", color: m.status === "active" ? T.green : T.amber }}>{m.status === "active" ? "Active" : "Pending"}</span></td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "12px", color: T.textSecondary }}>{invited ? formatDate(invited) : "--"}</td>
            <td style={{ padding: "10px 14px" }}><button onClick={() => removeStaff(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim }}><Trash2 size={14} /></button></td>
          </tr>
        })}</tbody>
      </table>
    </div>}
  </>
}

// ═══════════════════════════════════════════
// LOCATION TAB
// ═══════════════════════════════════════════
function LocationTab({ ownerId, bays }) {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [config, setConfig] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const q = query(collection(db, "washboardLocations"), where("ownerId", "==", ownerId))
    const unsub = onSnapshot(q, snap => {
      const locs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setLocations(locs)
      if (locs.length > 0 && !selectedId) { setSelectedId(locs[0].id); setConfig({ ...locs[0] }) }
      else if (selectedId) { const found = locs.find(l => l.id === selectedId); if (found) setConfig({ ...found }) }
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [ownerId])

  const addLocation = async () => {
    const name = prompt("Location name (e.g. Main Street Wash):")
    if (!name) return
    try {
      const ref = await addDoc(collection(db, "washboardLocations"), {
        ownerId, name, address: "", city: "", state: "", zip: "", phone: "", website: "", logoUrl: "", timezone: "America/New_York", createdAt: serverTimestamp()
      })
      setSelectedId(ref.id)
    } catch (e) { console.error(e) }
  }

  const u = (field, value) => setConfig(prev => ({ ...prev, [field]: value }))

  const saveLocation = async () => {
    if (!selectedId || !config) return
    setSaving(true)
    try {
      const { id, ...data } = config
      data.updatedAt = serverTimestamp()
      await updateDoc(doc(db, "washboardLocations", selectedId), data)
      // Update logoUrl on all bays under this location
      if (data.logoUrl !== undefined) {
        const locationBays = bays.filter(b => b.locationId === selectedId)
        for (const bay of locationBays) {
          await updateDoc(doc(db, "bays", bay.id), { logoUrl: data.logoUrl })
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error("Save failed:", e) }
    setSaving(false)
  }

  const handleLogoUpload = async (file) => {
    if (!selectedId) return
    try {
      const ext = file.name.split(".").pop()
      const r = storageRef(storage, "washboardLocations/" + selectedId + "/logo." + ext)
      await uploadBytes(r, file, { contentType: file.type })
      const url = await getDownloadURL(r)
      u("logoUrl", url)
    } catch (e) { console.error("Logo upload failed:", e) }
  }

  if (loading) return <div style={S.placeholder}><Loader size={24} style={{ animation: "spin 1s linear infinite" }} /></div>

  return <>
    <div style={S.sectionHeader}>
      <h2 style={S.sectionTitle}>Locations</h2>
      <button onClick={addLocation} style={{ background: T.accent + "18", color: T.accent, border: "1px solid " + T.accent + "44", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><Plus size={14} /> ADD LOCATION</button>
    </div>

    {locations.length === 0 ? <div style={S.placeholder}><Building2 size={40} strokeWidth={1} /><div style={S.placeholderTitle}>No locations</div><div style={S.placeholderSub}>Add a location to set your business info, logo, and address for receipts.</div></div>
    : <>
      {/* Location selector tabs */}
      {locations.length > 1 && <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {locations.map(loc => <button key={loc.id} onClick={() => { setSelectedId(loc.id); setConfig({ ...loc }) }} style={{
          padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: "none",
          background: selectedId === loc.id ? T.accent + "22" : T.bgPanel,
          color: selectedId === loc.id ? T.accent : T.textDim
        }}>{loc.name || "Unnamed"}</button>)}
      </div>}

      {config && <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Logo */}
        <div style={{ ...CS.section, padding: "20px" }}>
          <h3 style={CS.sectionTitle}><Image size={16} /> Logo</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "12px" }}>
            {config.logoUrl ? <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={config.logoUrl} alt="Logo" style={{ height: "64px", borderRadius: "8px", background: T.bgDeep, padding: "4px" }} />
              <button onClick={() => u("logoUrl", "")} style={{ ...CS.cancelBtn, padding: "6px 12px", fontSize: "11px" }}><Trash2 size={12} /> Remove</button>
            </div>
            : <label style={{ cursor: "pointer", border: "2px dashed " + T.border, borderRadius: "10px", padding: "20px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <Upload size={24} color={T.textDim} />
              <span style={{ fontSize: "12px", color: T.textDim }}>Click to upload logo (PNG, SVG)</span>
              <input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]) }} />
            </label>}
          </div>
          <div style={{ ...CS.hint, marginTop: "8px" }}>Used on kiosk screensaver, welcome screen, receipts, and emails for all bays at this location</div>
        </div>

        {/* Business Info */}
        <div style={{ ...CS.section, padding: "20px" }}>
          <h3 style={CS.sectionTitle}><Building2 size={16} /> Business Info</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
            <div><label style={CS.label}>Business Name</label><input style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep }} value={config.name || ""} onChange={e => u("name", e.target.value)} placeholder="Main Street Car Wash" /></div>
            <div><label style={CS.label}>Phone</label><input style={{ ...CS.inputMono, color: T.accent, background: T.bgDeep }} value={config.phone || ""} onChange={e => u("phone", e.target.value)} placeholder="(555) 555-1234" /></div>
            <div><label style={CS.label}>Website</label><input style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep }} value={config.website || ""} onChange={e => u("website", e.target.value)} placeholder="https://mycarwash.com" /></div>
            <div><label style={CS.label}>Timezone</label>
              <select value={config.timezone || "America/New_York"} onChange={e => u("timezone", e.target.value)} style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep, cursor: "pointer" }}>
                <option value="America/New_York">Eastern</option>
                <option value="America/Chicago">Central</option>
                <option value="America/Denver">Mountain</option>
                <option value="America/Los_Angeles">Pacific</option>
                <option value="America/Anchorage">Alaska</option>
                <option value="Pacific/Honolulu">Hawaii</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address */}
        <div style={{ ...CS.section, padding: "20px" }}>
          <h3 style={CS.sectionTitle}><Building2 size={16} /> Address</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
            <div><label style={CS.label}>Street Address</label><input style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep }} value={config.address || ""} onChange={e => u("address", e.target.value)} placeholder="123 Main Street" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
              <div><label style={CS.label}>City</label><input style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep }} value={config.city || ""} onChange={e => u("city", e.target.value)} placeholder="Mechanicsburg" /></div>
              <div><label style={CS.label}>State</label><input style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep }} value={config.state || ""} onChange={e => u("state", e.target.value)} placeholder="PA" /></div>
              <div><label style={CS.label}>ZIP</label><input style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep }} value={config.zip || ""} onChange={e => u("zip", e.target.value)} placeholder="17055" /></div>
            </div>
          </div>
          <div style={{ ...CS.hint, marginTop: "8px" }}>Displayed on receipts and emails</div>
        </div>

        {/* Save Button */}
        <button onClick={saveLocation} disabled={saving} style={{ background: saving ? T.bgPanel : T.accent, color: saving ? T.textDim : T.bgDeep, border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, letterSpacing: "2px", cursor: saving ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          {saving ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> SAVING...</> : saved ? <><Check size={16} /> SAVED</> : <><Save size={16} /> SAVE LOCATION</>}
        </button>
      </div>}
    </>}
  </>
}

// ═══════════════════════════════════════════
// BILLING TAB (placeholder)
// ═══════════════════════════════════════════
function BillingTab({ bays }) {
  const bayCount = bays.length

  return <>
    <div style={S.sectionHeader}><h2 style={S.sectionTitle}>Billing</h2></div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
      <div style={S.statCard}><div style={S.scLabel}>Active Bays</div><div style={S.scValue(T.accent)}>{bayCount}</div><div style={S.scSub}>Licensed</div></div>
      <div style={S.statCard}><div style={S.scLabel}>Plan</div><div style={{ fontSize: "18px", fontWeight: 600, color: T.textPrimary }}>--</div><div style={S.scSub}>Not set</div></div>
      <div style={S.statCard}><div style={S.scLabel}>Next Invoice</div><div style={{ fontSize: "18px", fontWeight: 600, color: T.textPrimary }}>--</div><div style={S.scSub}>TBD</div></div>
    </div>

    <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
      <Receipt size={40} color={T.textDim} strokeWidth={1} style={{ marginBottom: "12px" }} />
      <div style={{ fontFamily: T.fontDisplay, fontSize: "18px", fontWeight: 600, color: T.textPrimary, marginBottom: "6px" }}>Billing Coming Soon</div>
      <div style={{ fontSize: "13px", color: T.textDim, maxWidth: "400px", margin: "0 auto", lineHeight: 1.6 }}>
        WashBoard billing will be set up on a per-bay basis. Pricing details are being finalized. During the beta period, all features are available at no charge.
      </div>
    </div>
  </>
}

''' + 'function PlaceholderTab({ icon: Icon, label }) {'

assert s.count(anchor) == 1, 'PlaceholderTab anchor not found'
s = s.replace(anchor, new_tabs)

# ═══════════════════════════════════════════════════════════════
# 2. WIRE TABS IN RENDER
# ═══════════════════════════════════════════════════════════════
old_render = '      {!["overview", "config", "sessions", "codes", "issues", "devices"].includes(activeTab) && <PlaceholderTab icon={TAB_ICONS[activeTab] || Construction} label={TAB_LABELS[activeTab]} />}'
new_render = '''      {activeTab === "payments" && <PaymentsTab ownerId={user.uid} bays={bays} />}
      {activeTab === "staff" && <StaffTab ownerId={user.uid} />}
      {activeTab === "location" && <LocationTab ownerId={user.uid} bays={bays} />}
      {activeTab === "billing" && <BillingTab bays={bays} />}
      {!["overview", "config", "sessions", "codes", "issues", "devices", "payments", "staff", "location", "billing"].includes(activeTab) && <PlaceholderTab icon={TAB_ICONS[activeTab] || Construction} label={TAB_LABELS[activeTab]} />}'''
assert s.count(old_render) == 1, 'Tab render not found'
s = s.replace(old_render, new_render)

# ═══════════════════════════════════════════════════════════════
# 3. REMOVE LOGO UPLOAD FROM BAY CONFIG
# ═══════════════════════════════════════════════════════════════
old_logo_section = '''                {config.logoUrl ? <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <img src={config.logoUrl} alt="Logo" style={{ height: "48px", borderRadius: "8px", background: T.bgDeep, padding: "4px" }} />
                  <button onClick={() => u("logoUrl", "")} style={{ ...CS.cancelBtn, padding: "6px 12px", fontSize: "11px" }}><Trash2 size={12} /> Remove</button>
                </div>'''

new_logo_section = '''                {config.logoUrl ? <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <img src={config.logoUrl} alt="Logo" style={{ height: "48px", borderRadius: "8px", background: T.bgDeep, padding: "4px" }} />
                  <span style={{ fontSize: "11px", color: T.textDim }}>Managed in Location tab</span>
                </div>'''

if s.count(old_logo_section) == 1:
    s = s.replace(old_logo_section, new_logo_section)
    print('  - Logo upload moved to Location tab')
else:
    print('  ! Logo section not found in Bay Config - check manually')

p.write_text(s)
print('OK - All four tabs added + logo moved to Location')
print('Tabs: Payments, Staff Access, Location, Billing')
print('Remember to:')
print('  1. Add Firestore rules for washboardStaff and washboardLocations')
print('  2. Create composite index: washboardStaff (ownerId ASC, invitedAt DESC)')
