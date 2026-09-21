import { useState, useEffect, useCallback, useRef } from "react"
import {
  Radio, Settings, BarChart3, AlertTriangle, KeyRound,
  Smartphone, CreditCard, Users, Building2, Receipt,
  Bell, ChevronDown, Circle, Clock, Pause, WifiOff,
  Wrench, Droplets, Construction, Save, Plus, Trash2,
  ToggleLeft, ToggleRight, Upload, Image, Phone, DollarSign,
  Tag, Palette, Monitor, Server, Shield, Check, Loader,
  LogOut, Eye, EyeOff, Mail, Lock, Link, RefreshCw, Copy,
  X, Play, Square, Timer, Gamepad2, Video, PlusCircle,
  Wind, Sparkles, Brush, SprayCan, Waves, Flame,
  CloudRain, Snowflake, Zap, ShieldCheck, CircleDot,
  Pipette, Eraser, Fan, Car, Hexagon, ZapOff
} from "lucide-react"
import { db, auth, storage, functions, httpsCallable, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "./firebase"
import {
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc,
  onSnapshot, query, where, orderBy, limit, serverTimestamp, Timestamp, deleteDoc
} from "firebase/firestore"
import { ref as storageRef, getDownloadURL, uploadBytes } from "firebase/storage"

// ═══════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════

const T = {
  bgDeep: "#070e1a", bgBase: "#0b1628", bgPanel: "#112240", bgElevated: "#152a4a",
  bgHover: "#1a3358", border: "#1c3455", borderLight: "#254675",
  accent: "#00d4aa", accentDim: "rgba(0,212,170,0.12)", accentGlow: "rgba(0,212,170,0.25)",
  blue: "#3b82f6", blueDim: "rgba(59,130,246,0.12)",
  amber: "#f59e0b", amberDim: "rgba(245,158,11,0.12)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.12)",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.12)",
  textPrimary: "#e2e8f0", textSecondary: "#7a8ba5", textDim: "#4a5d78",
  fontDisplay: "'Space Grotesk', sans-serif",
  fontBody: "'Inter', sans-serif",
  fontMono: "'Share Tech Mono', monospace",
}

// ═══════════════════════════════════════════
// DEFAULT FUNCTIONS (16 — matches 450E channels)
// ═══════════════════════════════════════════

const DEFAULT_FUNCTIONS = [
  { id: 0,  name: "Wheel Brush" },
  { id: 1,  name: "Wheel Cleaner" },
  { id: 2,  name: "Bug Off / De-Salt" },
  { id: 3,  name: "Pre-Soak" },
  { id: 4,  name: "Foam Brush" },
  { id: 5,  name: "HP Rinse" },
  { id: 6,  name: "HP Soap" },
  { id: 7,  name: "Ceramic Coat" },
  { id: 8,  name: "Triple Foam" },
  { id: 9,  name: "Air Dryer" },
  { id: 10, name: "Spot-Free Rinse" },
  { id: 11, name: "Engine Clean" },
  { id: 12, name: "Function 13" },
  { id: 13, name: "Function 14" },
  { id: 14, name: "Function 15" },
  { id: 15, name: "Function 16" },
]


// ICON OPTIONS for function picker
const ICON_OPTIONS = [
  { key: "drop.fill", label: "Drop" },
  { key: "humidity.fill", label: "Spray" },
  { key: "water.waves", label: "Waves" },
  { key: "wind", label: "Wind" },
  { key: "sparkles", label: "Sparkles" },
  { key: "paintbrush.fill", label: "Brush" },
  { key: "flame.fill", label: "Flame" },
  { key: "snowflake", label: "Snowflake" },
  { key: "bolt.fill", label: "Bolt" },
  { key: "shield.lefthalf.filled", label: "Shield" },
  { key: "circle.dotted", label: "Circle" },
  { key: "fanblades.fill", label: "Fan" },
  { key: "cloud.rain.fill", label: "Rain" },
  { key: "eyedropper.halffull", label: "Pipette" },
  { key: "eraser.fill", label: "Eraser" },
  { key: "car.side", label: "Car" },
  { key: "wrench.fill", label: "Wrench" },
  { key: "gear", label: "Gear" },
]

const SF_TO_LUCIDE = {
  "drop.fill": Droplets, "humidity.fill": SprayCan, "water.waves": Waves,
  "wind": Wind, "sparkles": Sparkles, "paintbrush.fill": Brush,
  "flame.fill": Flame, "snowflake": Snowflake, "bolt.fill": Zap,
  "shield.lefthalf.filled": ShieldCheck, "circle.dotted": CircleDot,
  "fanblades.fill": Fan, "cloud.rain.fill": CloudRain,
  "eyedropper.halffull": Pipette, "eraser.fill": Eraser,
  "car.side": Car, "wrench.fill": Wrench, "gear": Settings,
  "circle.hexagongrid.fill": Hexagon, "drop.triangle.fill": Droplets,
  "ladybug.fill": CircleDot, "engine.combustion.fill": Settings,
}

const DEFAULT_SF_SYMBOLS = {
  0: "circle.hexagongrid.fill", 1: "drop.triangle.fill", 2: "ladybug.fill",
  3: "humidity.fill", 4: "paintbrush.fill", 5: "water.waves",
  6: "drop.fill", 7: "shield.lefthalf.filled", 8: "cloud.rain.fill",
  9: "wind", 10: "sparkles", 11: "engine.combustion.fill",
}

const LucideForSF = ({ sf, size = 16, color }) => {
  const Icon = SF_TO_LUCIDE[sf] || CircleDot
  return <Icon size={size} color={color} />
}

const makeDefaultConfig = (bayName = "Bay 1") => ({
  washName: "Self-Serve Wash", displayName: bayName, attendantPhone: "", logoUrl: "",
  pricingMode: "flatRate", flatRatePerMinute: "1.00", minimumCharge: "", maximumCharge: "",
  relayHost: "192.168.1.100", relayPort: "502", watchdogInterval: "10",
  status: "offline", displayMode: "auto", salesTaxEnabled: false, salesTaxRate: "",
  functions: DEFAULT_FUNCTIONS.map(f => ({ ...f, enabled: f.id < 12, customName: "", icon: "", perFunctionRate: "" })),
})

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function statusLabel(st) {
  if (st === "outOfService") return "Out of service"
  if (st === "relayDown") return "Relay down"
  return st
}

function effectiveStatus(bay) {
  if (bay.outOfService === true) return "outOfService"
  if (!bay.lastHeartbeat) return bay.status || "offline"
  const lastBeat = bay.lastHeartbeat?.toMillis ? bay.lastHeartbeat.toMillis() : (bay.lastHeartbeat?.seconds ? bay.lastHeartbeat.seconds * 1000 : 0)
  const staleMs = Date.now() - lastBeat
  // Scale with the interval the iPad reports. HeartbeatScheduler sends every
  // 30s in a session, 120s idle and 300s overnight, so a fixed 90s flagged
  // healthy idle bays offline. Floor of 90s for older builds without the field.
  const interval = typeof bay.heartbeatInterval === "number" ? bay.heartbeatInterval : 30
  if (staleMs > Math.max(90000, interval * 3000)) return "offline"
  // The iPad is reporting and says its relay is unreachable. This is
  // separate from outOfService, which is the operator's own switch.
  if (bay.relayConnected === false) return "relayDown"
  // A fresh heartbeat outranks a stored offline. The iPad writes
  // status: offline on termination and older builds never reset it on
  // launch, so a live bay could sit on OFFLINE until its next session ended.
  if (bay.status === "offline") return "idle"
  return bay.status || "idle"
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}
function formatDuration(sec) {
  const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, "0")}`
}
function timeAgo(date) {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return "just now"; if (mins < 60) return mins + "m ago"
  const hrs = Math.floor(mins / 60); if (hrs < 24) return hrs + "h ago"
  return Math.floor(hrs / 24) + "d ago"
}
function formatDate(date) {
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}
function fnName(id, bay) {
  const custom = bay?.functionConfigs?.[String(id)]?.customName
  return custom || DEFAULT_FUNCTIONS[id]?.name || `Function ${id + 1}`
}

// ═══════════════════════════════════════════
// PAIRING CODE HELPERS
// ═══════════════════════════════════════════

function generateRandomCode() { return String(Math.floor(100000 + Math.random() * 900000)) }
async function createPairingCode(bayId, ownerId) {
  for (let i = 0; i < 10; i++) {
    const code = generateRandomCode()
    const q = query(collection(db, "pairingCodes"), where("code", "==", code), where("used", "==", false))
    const snap = await getDocs(q)
    const now = Date.now()
    const conflict = snap.docs.some(d => { const e = d.data().expiresAt; return (e?.toMillis ? e.toMillis() : e) > now })
    if (!conflict) {
      const expiresAt = Timestamp.fromMillis(now + 5 * 60 * 1000)
      const ref = await addDoc(collection(db, "pairingCodes"), { code, bayId, ownerId, used: false, createdAt: serverTimestamp(), expiresAt })
      return { id: ref.id, code, expiresAt }
    }
  }
  throw new Error("Could not generate unique code")
}

// ═══════════════════════════════════════════
// PROMO CODE HELPERS
// ═══════════════════════════════════════════

async function createPromoCode(ownerId, codeType, value, expiresInDays, label, usageLimit, customCode) {
  const code = customCode && customCode.trim().length > 0 ? customCode.trim() : String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = Timestamp.fromMillis(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
  await addDoc(collection(db, "promoCodes"), {
    code, ownerId, codeType, value, expiresAt,
    label: label || "", usageLimit: usageLimit || null, usageCount: 0,
    used: false, createdAt: serverTimestamp(),
  })
  return code
}

// ═══════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════

const NAV_ITEMS = [
  { section: "Operations" },
  { id: "overview", label: "Bay Overview", icon: Radio },
  { id: "config", label: "Bay Config", icon: Settings },
  { id: "sessions", label: "Sessions", icon: BarChart3 },
  { id: "issues", label: "Issues", icon: AlertTriangle },
  { id: "codes", label: "Codes", icon: KeyRound },
  { section: "System" },
  { id: "devices", label: "Devices", icon: Smartphone },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "staff", label: "Staff Access", icon: Users },
  { section: "Settings" },
  { id: "location", label: "Location", icon: Building2 },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "billing", label: "Billing", icon: Receipt },
]

// ═══════════════════════════════════════════
// STYLES (compressed)
// ═══════════════════════════════════════════

const S = {
  app: { display: "grid", gridTemplateColumns: "220px 1fr", gridTemplateRows: "60px 1fr", gridTemplateAreas: `"sidebar topbar" "sidebar main"`, height: "100vh", fontFamily: T.fontBody, color: T.textPrimary, background: T.bgDeep },
  sidebar: { gridArea: "sidebar", background: T.bgBase, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflowY: "auto" },
  sidebarBrand: { padding: "18px 20px 14px", borderBottom: `1px solid ${T.border}` },
  brandTitle: { fontFamily: T.fontDisplay, fontSize: "20px", fontWeight: 700, letterSpacing: "1px", color: T.accent, margin: 0 },
  brandSub: { fontSize: "10px", fontWeight: 500, letterSpacing: "2px", textTransform: "uppercase", color: T.textDim, marginTop: "2px" },
  sidebarNav: { padding: "12px 10px", display: "flex", flexDirection: "column", gap: "2px", flex: 1 },
  navSection: { fontSize: "9px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: T.textDim, padding: "14px 10px 6px" },
  navItem: (a) => ({ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: a ? T.accent : T.textSecondary, background: a ? T.accentDim : "transparent", transition: "all 0.15s", border: "none", width: "100%", textAlign: "left", fontFamily: T.fontBody }),
  sidebarFooter: { padding: "12px 14px", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "10px" },
  userAvatar: { width: "32px", height: "32px", borderRadius: "8px", background: T.bgElevated, border: `1px solid ${T.borderLight}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600, color: T.accent, fontFamily: T.fontDisplay },
  topbar: { gridArea: "topbar", background: T.bgBase, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", padding: "0 24px", gap: "16px" },
  topbarTitle: { fontFamily: T.fontDisplay, fontSize: "16px", fontWeight: 600, color: T.textPrimary, margin: 0 },
  locationSelector: { display: "flex", alignItems: "center", gap: "6px", background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 500, color: T.textSecondary, fontFamily: T.fontBody },
  locDot: { width: "6px", height: "6px", borderRadius: "50%", background: T.green, boxShadow: `0 0 6px ${T.green}` },
  topbarRight: { marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" },
  topbarStat: (c, bg) => ({ display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "6px", fontFamily: T.fontMono, fontSize: "13px", background: bg, color: c }),
  statLabel: { fontFamily: T.fontBody, fontSize: "10px", fontWeight: 500, opacity: 0.7, textTransform: "uppercase", letterSpacing: "1px" },
  main: { gridArea: "main", padding: "24px", overflowY: "auto", background: `radial-gradient(ellipse 60% 40% at 20% 10%, rgba(0,212,170,0.02) 0%, transparent 70%), ${T.bgDeep}` },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" },
  statCard: { background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" },
  scLabel: { fontSize: "10px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: T.textDim },
  scValue: (c) => ({ fontFamily: T.fontMono, fontSize: "26px", fontWeight: 400, lineHeight: 1, color: c }),
  scSub: { fontSize: "11px", color: T.textSecondary },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" },
  sectionTitle: { fontFamily: T.fontDisplay, fontSize: "14px", fontWeight: 600, letterSpacing: "1px", color: T.textPrimary, margin: 0 },
  bayGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" },
  bayCard: (st) => {
    if (st === "offline") return { background: "rgba(239,68,68,0.06)", border: `2px solid ${T.red}`, borderRadius: "12px", overflow: "hidden", transition: "all 0.2s", cursor: "pointer", boxShadow: `0 0 24px rgba(239,68,68,0.25)` }
    if (st === "outOfService") return { background: T.bgPanel, border: `1px dashed rgba(156,163,175,0.5)`, borderRadius: "12px", overflow: "hidden", transition: "all 0.2s", cursor: "pointer", opacity: 0.75 }
    if (st === "relayDown") return { background: "rgba(245,158,11,0.06)", border: `2px solid ${T.amber}`, borderRadius: "12px", overflow: "hidden", transition: "all 0.2s", cursor: "pointer", boxShadow: `0 0 24px rgba(245,158,11,0.2)` }
    return { background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden", transition: "all 0.2s", cursor: "pointer" }
  },
  bayHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" },
  bayName: { fontFamily: T.fontDisplay, fontSize: "15px", fontWeight: 600, color: T.textPrimary, margin: 0 },
  bayBadge: (st) => { const m = { idle: { bg: T.bgElevated, c: T.textDim, b: T.border }, active: { bg: T.accentDim, c: T.accent, b: "rgba(0,212,170,0.3)" }, issue: { bg: T.amberDim, c: T.amber, b: "rgba(245,158,11,0.3)" }, offline: { bg: T.redDim, c: T.red, b: "rgba(239,68,68,0.3)" }, outOfService: { bg: "rgba(107,114,128,0.15)", c: "#9ca3af", b: "rgba(107,114,128,0.35)" }, relayDown: { bg: T.amberDim, c: T.amber, b: "rgba(245,158,11,0.4)" } }; const v = m[st] || m.idle; return { fontSize: "10px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", padding: "3px 10px", borderRadius: "6px", background: v.bg, color: v.c, border: `1px solid ${v.b}` } },
  bayBody: { padding: "0 16px 14px" },
  baySession: { background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "12px", display: "flex", alignItems: "center", gap: "14px" },
  bayTimer: (c) => ({ fontFamily: T.fontMono, fontSize: "28px", color: c || T.accent, letterSpacing: "2px", textShadow: `0 0 15px ${T.accentGlow}`, lineHeight: 1 }),
  bayIdle: { textAlign: "center", padding: "18px 12px", color: T.textDim, fontSize: "12px", letterSpacing: "1px", lineHeight: 1.6 },
  placeholder: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: "16px", color: T.textDim },
  placeholderTitle: { fontFamily: T.fontDisplay, fontSize: "18px", fontWeight: 600, letterSpacing: "1px", color: T.textSecondary },
  placeholderSub: { fontSize: "13px", color: T.textDim },
  modal: { position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" },
  modalBackdrop: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" },
  modalContent: { position: "relative", background: T.bgBase, border: `1px solid ${T.border}`, borderRadius: "16px", width: "90%", maxWidth: "1000px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" },
}

const CS = {
  wrap: { display: "flex", flexDirection: "column", gap: "20px", maxWidth: "900px" },
  section: { background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px 24px" },
  sectionTitle: { fontFamily: T.fontDisplay, fontSize: "14px", fontWeight: 600, letterSpacing: "1px", color: T.accent, margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" },
  row: { display: "flex", gap: "16px", marginBottom: "14px", alignItems: "flex-start" },
  field: (f = 1) => ({ display: "flex", flexDirection: "column", gap: "5px", flex: f }),
  label: { fontSize: "10px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: T.textDim },
  input: { background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 500, color: T.textPrimary, fontFamily: T.fontBody, outline: "none", width: "100%", transition: "border-color 0.15s" },
  inputMono: { background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "10px 14px", fontSize: "14px", fontWeight: 400, color: T.accent, fontFamily: T.fontMono, outline: "none", width: "100%", transition: "border-color 0.15s" },
  hint: { fontSize: "11px", color: T.textDim, marginTop: "2px" },
  toggle: (a) => ({ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", padding: "8px 14px", borderRadius: "8px", background: a ? T.accentDim : T.bgDeep, border: `1px solid ${a ? T.accent : T.border}`, color: a ? T.accent : T.textDim, fontSize: "12px", fontWeight: 600, letterSpacing: "1px", transition: "all 0.15s" }),
  fnGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" },
  fnCard: (en) => ({ background: T.bgDeep, border: `1px solid ${en ? T.border : "rgba(255,255,255,0.04)"}`, borderRadius: "10px", padding: "14px", opacity: en ? 1 : 0.4, transition: "all 0.15s" }),
  fnHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" },
  fnName: { fontSize: "13px", fontWeight: 600, color: T.textPrimary, letterSpacing: "0.5px" },
  fnId: { fontFamily: T.fontMono, fontSize: "10px", color: T.textDim },
  toggleSwitch: (a) => ({ width: "38px", height: "20px", borderRadius: "10px", background: a ? T.accent : T.border, position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }),
  toggleKnob: (a) => ({ width: "16px", height: "16px", borderRadius: "50%", background: "white", position: "absolute", top: "2px", left: a ? "20px" : "2px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }),
  saveBar: { position: "sticky", bottom: 0, background: T.bgBase, borderTop: `1px solid ${T.border}`, padding: "14px 24px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", marginTop: "20px", borderRadius: "10px" },
  saveBtn: { display: "flex", alignItems: "center", gap: "6px", background: T.accent, color: T.bgDeep, border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "13px", fontWeight: 700, letterSpacing: "1px", cursor: "pointer", fontFamily: T.fontDisplay, transition: "opacity 0.15s" },
  cancelBtn: { display: "flex", alignItems: "center", gap: "6px", background: "transparent", color: T.textDim, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "10px 20px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: T.fontBody },
  uploadArea: { border: `2px dashed ${T.border}`, borderRadius: "10px", padding: "24px", textAlign: "center", cursor: "pointer", transition: "border-color 0.15s", color: T.textDim, fontSize: "12px" },
  baySelector: { display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" },
  bayTab: (a) => ({ padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, background: a ? T.accentDim : T.bgPanel, color: a ? T.accent : T.textSecondary, border: `1px solid ${a ? T.accent : T.border}`, transition: "all 0.15s", fontFamily: T.fontBody }),
  savedBanner: { display: "flex", alignItems: "center", gap: "6px", color: T.accent, fontSize: "12px", fontWeight: 600, letterSpacing: "1px" },
}

// ═══════════════════════════════════════════
// GLOBAL STYLES
// ═══════════════════════════════════════════

const GlobalStyle = () => <style>{`
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { font-family: ${T.fontBody}; background: ${T.bgDeep}; color: ${T.textPrimary}; overflow-x: hidden; }
  input, select, button, textarea { color: ${T.textPrimary}; background: ${T.bgDeep}; }
  input:focus, textarea:focus { border-color: ${T.accent} !important; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(0,212,170,0.15); } 50% { box-shadow: 0 0 30px rgba(0,212,170,0.3); } }
`}</style>

// ═══════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════

function LoginScreen() {
  const [mode, setMode] = useState("login")
  const [email, setEmail] = useState(""), [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false), [error, setError] = useState(""), [loading, setLoading] = useState(false)
  const handleSubmit = async () => {
    setError(""); if (!email || !password) { setError("Enter your email and password."); return }
    if (mode === "signup" && password.length < 6) { setError("Password must be at least 6 characters."); return }
    setLoading(true)
    try { mode === "login" ? await signInWithEmailAndPassword(auth, email, password) : await createUserWithEmailAndPassword(auth, email, password) }
    catch (e) { setError({ "auth/invalid-email": "Invalid email.", "auth/invalid-credential": "Invalid email or password.", "auth/email-already-in-use": "Account already exists.", "auth/weak-password": "Password too short.", "auth/too-many-requests": "Too many attempts." }[e.code] || e.message) }
    setLoading(false)
  }
  return (<><GlobalStyle /><div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(ellipse 60% 50% at 50% 30%, rgba(0,212,170,0.04) 0%, transparent 70%), ${T.bgDeep}`, fontFamily: T.fontBody }}>
    <div style={{ width: "100%", maxWidth: "380px", padding: "0 20px" }}>
      <div style={{ textAlign: "center", marginBottom: "36px" }}><h1 style={{ fontFamily: T.fontDisplay, fontSize: "28px", fontWeight: 700, letterSpacing: "1px", color: T.accent, margin: 0 }}>WashBoard</h1><div style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "3px", textTransform: "uppercase", color: T.textDim, marginTop: "6px" }}>by WashLevel</div></div>
      <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "32px 28px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: "18px", fontWeight: 600, color: T.textPrimary, margin: "0 0 4px 0" }}>{mode === "login" ? "Sign in" : "Create account"}</h2>
        <p style={{ fontSize: "13px", color: T.textSecondary, margin: "0 0 24px 0" }}>{mode === "login" ? "Access your wash operations." : "Set up your WashBoard account."}</p>
        <div style={{ marginBottom: "16px" }}><label style={CS.label}>Email</label><div style={{ position: "relative", marginTop: "6px" }}><Mail size={15} style={{ position: "absolute", left: "12px", top: "11px", color: T.textDim }} /><input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="you@example.com" style={{ ...CS.input, paddingLeft: "36px" }} autoFocus /></div></div>
        <div style={{ marginBottom: "24px" }}><label style={CS.label}>Password</label><div style={{ position: "relative", marginTop: "6px" }}><Lock size={15} style={{ position: "absolute", left: "12px", top: "11px", color: T.textDim }} /><input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder={mode === "signup" ? "At least 6 characters" : "Enter password"} style={{ ...CS.input, paddingLeft: "36px", paddingRight: "40px" }} /><button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: "8px", top: "6px", background: "none", border: "none", cursor: "pointer", color: T.textDim, padding: "4px" }}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></div>
        {error && <div style={{ background: T.redDim, border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "12px", color: T.red, fontWeight: 500 }}>{error}</div>}
        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: T.accent, color: T.bgDeep, fontSize: "14px", fontWeight: 700, fontFamily: T.fontDisplay, letterSpacing: "1px", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>{loading && <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />}{mode === "login" ? "Sign In" : "Create Account"}</button>
        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: T.textSecondary }}>{mode === "login" ? "No account yet?" : "Already have an account?"}{" "}<button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError("") }} style={{ background: "none", border: "none", color: T.accent, cursor: "pointer", fontWeight: 600, fontSize: "13px", fontFamily: T.fontBody }}>{mode === "login" ? "Sign up" : "Sign in"}</button></div>
      </div>
      <div style={{ textAlign: "center", marginTop: "24px", fontSize: "11px", color: T.textDim }}>washlevel.com</div>
    </div></div></>)
}

// ═══════════════════════════════════════════
// SIDEBAR + TOPBAR
// ═══════════════════════════════════════════

function Sidebar({ activeTab, onTabChange, user, onSignOut }) {
  const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : "??"
  return <div style={S.sidebar}>
    <div style={S.sidebarBrand}><h1 style={S.brandTitle}>WashBoard</h1><div style={S.brandSub}>by WashLevel</div></div>
    <div style={S.sidebarNav}>{NAV_ITEMS.map((item, i) => {
      if (item.section) return <div key={i} style={S.navSection}>{item.section}</div>
      const Icon = item.icon
      return <button key={item.id} style={S.navItem(activeTab === item.id)} onClick={() => onTabChange(item.id)}
        onMouseEnter={e => { if (activeTab !== item.id) e.currentTarget.style.background = T.bgPanel }}
        onMouseLeave={e => { if (activeTab !== item.id) e.currentTarget.style.background = "transparent" }}>
        <Icon size={16} /> {item.label}
      </button>
    })}</div>
    <div style={S.sidebarFooter}>
      <div style={S.userAvatar}>{initials}</div>
      <div style={{ flex: 1, overflow: "hidden" }}><div style={{ fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email || "User"}</div><div style={{ fontSize: "10px", color: T.textDim }}>Owner</div></div>
      <button onClick={onSignOut} title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, padding: "4px" }}><LogOut size={14} /></button>
    </div>
  </div>
}

function Topbar({ tabLabel, todayRevenue, todaySessions, activeBays, totalBays, locations, selectedLocationId, onLocationChange }) {
  const [showDrop, setShowDrop] = useState(false)
  const selectedName = locations?.find(l => l.id === selectedLocationId)?.name || (locations?.length > 0 ? locations[0].name : "No Location")
  return <div style={S.topbar}>
    <h2 style={S.topbarTitle}>{tabLabel}</h2>
    <div style={{ position: "relative" }}>
      <div style={S.locationSelector} onClick={() => setShowDrop(!showDrop)}><div style={S.locDot} /> {selectedName} <ChevronDown size={12} style={{ opacity: 0.4, transform: showDrop ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} /></div>
      {showDrop && <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "4px", background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "8px", overflow: "hidden", zIndex: 100, minWidth: "220px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
        {(locations || []).map(loc => <div key={loc.id} onClick={() => { onLocationChange(loc.id); setShowDrop(false) }} style={{ padding: "10px 16px", fontSize: "13px", cursor: "pointer", color: loc.id === selectedLocationId ? T.accent : T.textSecondary, background: loc.id === selectedLocationId ? T.accent + "11" : "transparent", fontWeight: loc.id === selectedLocationId ? 600 : 400, display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: loc.id === selectedLocationId ? T.accent : T.textDim }} />{loc.name || "Unnamed"}</div>)}
        {(locations || []).length === 0 && <div style={{ padding: "10px 16px", fontSize: "12px", color: T.textDim }}>No locations — add one in Location tab</div>}
      </div>}
    </div>
    <div style={S.topbarRight}>
      <div style={S.topbarStat(T.accent, T.accentDim)}><span style={S.statLabel}>Today</span> ${todayRevenue.toFixed(2)}</div>
      <div style={S.topbarStat(T.blue, T.blueDim)}><span style={S.statLabel}>Sessions</span> {todaySessions}</div>
      <div style={S.topbarStat(T.green, T.greenDim)}><span style={S.statLabel}>Active</span> {activeBays}/{totalBays}</div>
    </div>
  </div>
}

// ═══════════════════════════════════════════
// PAIRING SECTION (Bay Config)
// ═══════════════════════════════════════════

function PairingSection({ bayId, ownerId }) {
  const [code, setCode] = useState(null), [expiresAt, setExpiresAt] = useState(null), [timeLeft, setTimeLeft] = useState(0), [generating, setGenerating] = useState(false), [copied, setCopied] = useState(false)
  useEffect(() => { if (!expiresAt) return; const tick = () => { const r = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)); setTimeLeft(r); if (r <= 0) { setCode(null); setExpiresAt(null) } }; tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv) }, [expiresAt])
  const generate = async () => { setGenerating(true); try { const r = await createPairingCode(bayId, ownerId); setCode(r.code); setExpiresAt(r.expiresAt.toMillis ? r.expiresAt.toMillis() : r.expiresAt) } catch (e) { alert("Failed: " + e.message) } setGenerating(false) }
  return <div style={CS.section}>
    <h3 style={{ ...CS.sectionTitle, color: T.amber }}><Link size={16} /> iPad Pairing</h3>
    {!code ? <div style={{ textAlign: "center", padding: "20px 0" }}>
      <Smartphone size={32} style={{ color: T.textDim, marginBottom: "8px" }} />
      <div style={{ fontSize: "14px", fontWeight: 600, color: T.textPrimary, marginBottom: "4px" }}>No iPad connected</div>
      <div style={{ fontSize: "12px", color: T.textSecondary, maxWidth: "360px", margin: "0 auto 16px", lineHeight: 1.5 }}>Generate a pairing code and enter it on the iPad. Expires in 5 minutes.</div>
      <button onClick={generate} disabled={generating} style={{ ...CS.saveBtn, display: "inline-flex" }}>{generating ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <KeyRound size={14} />}{generating ? "Generating..." : "Generate Pairing Code"}</button>
    </div> : <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div style={{ display: "inline-block", padding: "20px 40px", borderRadius: "14px", background: T.bgDeep, border: `2px solid ${T.accent}`, animation: "pulse-glow 2s ease-in-out infinite", marginBottom: "16px" }}>
        <div style={CS.label}>Pairing Code</div>
        <div style={{ fontFamily: T.fontMono, fontSize: "48px", color: T.accent, letterSpacing: "12px", textShadow: `0 0 20px ${T.accentGlow}`, marginTop: "8px" }}>{code}</div>
      </div>
      <div style={{ marginBottom: "16px" }}><span style={{ padding: "6px 14px", borderRadius: "6px", background: timeLeft < 60 ? T.redDim : T.amberDim, color: timeLeft < 60 ? T.red : T.amber, fontSize: "12px", fontWeight: 600, fontFamily: T.fontMono }}><Clock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}</span></div>
      <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "16px" }}>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }} style={CS.cancelBtn}>{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : "Copy"}</button>
        <button onClick={generate} style={CS.cancelBtn}><RefreshCw size={12} /> New</button>
      </div>
      <div style={{ background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "16px 20px", textAlign: "left", maxWidth: "400px", margin: "0 auto" }}>
        <div style={{ ...CS.label, marginBottom: "12px" }}>Setup Instructions</div>
        {["Mount iPad in enclosure", "Connect Ethernet and power via USB-C", "Open WashBoard app", "Enter the 6-digit code above", "Bay status changes to Idle"].map((step, i) => <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "8px" }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0, background: T.accentDim, border: "1px solid rgba(0,212,170,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: T.accent, fontFamily: T.fontMono }}>{i + 1}</div>
          <div style={{ fontSize: "12px", color: T.textSecondary, lineHeight: 1.5, paddingTop: "2px" }}>{step}</div>
        </div>)}
      </div>
    </div>}
  </div>
}

// ═══════════════════════════════════════════
// BAY DETAIL MODAL
// ═══════════════════════════════════════════

function HoldToToggle({ active, onComplete, holdMs = 1000 }) {
  // active=false → button says "Take Out of Service" (red, danger)
  // active=true  → button says "Return to Service"   (amber, less severe)
  const [progress, setProgress] = useState(0)  // 0.0 → 1.0
  const rafRef = useRef(null)
  const startRef = useRef(null)

  const cancel = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    startRef.current = null
    setProgress(0)
  }

  const start = () => {
    if (rafRef.current) return
    startRef.current = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - startRef.current) / holdMs)
      setProgress(p)
      if (p >= 1) {
        cancel()
        onComplete()
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  const color = active ? T.amber : T.red
  const bgDim = active ? T.amberDim : T.redDim
  const label = active ? "RETURN TO SERVICE" : "TAKE OUT OF SERVICE"
  const sublabel = active ? "Hold to bring bay back online" : "Hold to stop this bay immediately"

  return (
    <div
      onMouseDown={start} onMouseUp={cancel} onMouseLeave={cancel}
      onTouchStart={(e) => { e.preventDefault(); start() }} onTouchEnd={cancel} onTouchCancel={cancel}
      style={{
        position: "relative", userSelect: "none", cursor: "pointer",
        background: bgDim, border: `2px solid ${color}`, borderRadius: "12px",
        padding: "20px 24px", overflow: "hidden",
        transition: progress > 0 ? "none" : "background 0.2s"
      }}
    >
      {/* Fill overlay grows left-to-right as they hold */}
      <div style={{
        position: "absolute", inset: 0, background: color, opacity: 0.35,
        width: `${progress * 100}%`, transition: "none", pointerEvents: "none"
      }} />
      <div style={{ position: "relative", textAlign: "center" }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: "18px", fontWeight: 700, color, letterSpacing: "2px" }}>{label}</div>
        <div style={{ fontSize: "11px", color: T.textSecondary, marginTop: "4px", letterSpacing: "1px", textTransform: "uppercase" }}>{sublabel}</div>
      </div>
    </div>
  )
}

function BayDetailModal({ bay, bays, onClose }) {
  const [elapsed, setElapsed] = useState("00:00")
  const [takeover, setTakeover] = useState(false)
  const [sending, setSending] = useState(null)

  useEffect(() => {
    if (!bay?.currentSessionStartedAt) return
    const ms = bay.currentSessionStartedAt?.toMillis ? bay.currentSessionStartedAt.toMillis() : bay.currentSessionStartedAt
    const tick = () => setElapsed(formatElapsed(Date.now() - ms))
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv)
  }, [bay?.currentSessionStartedAt])

  const sendCommand = async (type, data = {}) => {
    setSending(type)
    try {
      await updateDoc(doc(db, "bays", bay.id), { remoteCommand: { type, ...data, timestamp: Date.now() } })
    } catch (e) { console.error("Command failed:", e) }
    setTimeout(() => setSending(null), 500)
  }

  const activeFns = bay?.activeFunctions || Array.from({ length: 12 }, (_, i) => i)
  const status = bay?.status || "offline"

  return <div style={S.modal}>
    <div style={S.modalBackdrop} onClick={onClose} />
    <div style={S.modalContent}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${T.border}` }}>
        <div>
          <h2 style={{ fontFamily: T.fontDisplay, fontSize: "18px", fontWeight: 600, color: T.textPrimary, margin: 0 }}>{bay?.displayName || bay?.id}</h2>
          <div style={{ fontSize: "11px", color: T.textDim, marginTop: "2px" }}>{bay?.washName || "Self-Serve Wash"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={S.bayBadge(status)}>{statusLabel(status)}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim }}><X size={20} /></button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", padding: "20px 24px" }}>
        {/* Left: Live status */}
        <div>
          <div style={{ ...CS.label, marginBottom: "12px" }}>Live Status</div>
          <div style={{ background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px", textAlign: "center" }}>
            {status === "active" || status === "issue" ? <>
              <div style={{ fontFamily: T.fontMono, fontSize: "48px", color: status === "issue" ? T.amber : T.accent, letterSpacing: "4px" }}>{elapsed}</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: T.textPrimary, marginTop: "8px", textTransform: "uppercase", letterSpacing: "2px" }}>
                {bay?.currentFunction != null ? fnName(bay.currentFunction, bay) : "Waiting for selection"}
              </div>
              {bay?.currentSessionStartedAt && <div style={{ fontFamily: T.fontMono, fontSize: "14px", color: T.textDim, marginTop: "4px" }}>
                ${((Date.now() - (bay.currentSessionStartedAt?.toMillis ? bay.currentSessionStartedAt.toMillis() : bay.currentSessionStartedAt)) / 60000 * (bay.flatRatePerMinute || 1)).toFixed(2)} charged
              </div>}
            </> : status === "idle" ? <>
              <div style={{ fontSize: "14px", color: T.textDim, marginBottom: "8px" }}>Waiting for customer</div>
              {bay?.lastSession && <div>
                <div style={{ fontSize: "11px", color: T.textSecondary }}>Last session</div>
                <div style={{ fontFamily: T.fontMono, fontSize: "16px", color: T.accent }}>${(bay.lastSession.charge || 0).toFixed(2)} / {formatDuration(bay.lastSession.durationSeconds || 0)}</div>
                <div style={{ fontSize: "10px", color: T.textDim }}>{bay.lastSession.endedAt?.toDate ? timeAgo(bay.lastSession.endedAt.toDate()) : ""}</div>
              </div>}
            </> : <div style={{ color: T.textDim }}><WifiOff size={24} style={{ marginBottom: "8px" }} /><div>Offline</div></div>}
          </div>

          {/* Camera feed */}
          <div style={{ background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden", marginTop: "12px" }}>
            {bay?.streamUrl ? (
              <img src={bay.streamUrl} alt="Live feed" style={{ width: "100%", display: "block", borderRadius: "12px" }}
                onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex" }} />
            ) : null}
            <div style={{ display: bay?.streamUrl ? "none" : "flex", flexDirection: "column", alignItems: "center", padding: "24px", color: T.textDim }}>
              <Video size={24} style={{ marginBottom: "8px" }} />
              <div style={{ fontSize: "12px" }}>{bay?.streamUrl ? "Stream unavailable" : "No camera connected"}</div>
            </div>
          </div>

          {/* Device info */}
          {bay?.deviceId && <div style={{ marginTop: "12px", fontSize: "11px", color: T.textDim }}>
            <div>Device: {bay.deviceName || bay.deviceId}</div>
            {bay?.lastHeartbeat && <div>Last heartbeat: {bay.lastHeartbeat?.toDate ? timeAgo(bay.lastHeartbeat.toDate()) : "unknown"}</div>}
          </div>}
        </div>

        {/* Right: Remote control */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={CS.label}>Remote Control</div>
            <div style={CS.toggle(takeover)} onClick={() => setTakeover(!takeover)}>
              <Gamepad2 size={12} /> {takeover ? "Takeover ON" : "Takeover OFF"}
            </div>
          </div>

          {takeover ? <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", marginBottom: "12px" }}>
              {activeFns.map(fId => {
                const isActive = bay?.currentFunction === fId
                return <button key={fId} onClick={() => sendCommand("activateFunction", { functionId: fId })}
                  style={{ padding: "10px 4px", borderRadius: "8px", border: `1px solid ${isActive ? T.accent : T.border}`, background: isActive ? T.accentDim : T.bgDeep, color: isActive ? T.accent : T.textSecondary, fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: T.fontBody, textAlign: "center", opacity: sending === "activateFunction" ? 0.6 : 1 }}>
                  {fnName(fId, bay)}
                </button>
              })}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => sendCommand("allOff")} style={{ ...CS.cancelBtn, flex: 1, justifyContent: "center", color: T.red, borderColor: "rgba(239,68,68,0.3)" }}><Square size={12} /> All Off</button>
              <button onClick={() => sendCommand("addTime", { minutes: 5 })} style={{ ...CS.cancelBtn, flex: 1, justifyContent: "center", color: T.accent, borderColor: "rgba(0,212,170,0.3)" }}><PlusCircle size={12} /> +5 min</button>
            </div>
          </> : <div style={{ background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "40px 20px", textAlign: "center" }}>
            <Gamepad2 size={32} style={{ color: T.textDim, marginBottom: "8px" }} />
            <div style={{ fontSize: "13px", color: T.textDim }}>Enable takeover to remotely control this bay's functions</div>
          </div>}
        </div>
      </div>
      {/* E-stop — placed at bottom of modal, distinct from live status above */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "20px 24px", background: T.bgDeep }}>
        <div style={{ fontSize: "11px", color: T.textDim, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px", fontWeight: 600 }}>Bay Control</div>
        <HoldToToggle
          active={bay?.outOfService === true}
          onComplete={async () => {
            try {
              await updateDoc(doc(db, "bays", bay.id), { outOfService: !(bay?.outOfService === true), outOfServiceAt: serverTimestamp() })
            } catch (e) { console.error("E-stop toggle failed:", e) }
          }}
        />
        {bay?.outOfService === true && (
          <div style={{ fontSize: "11px", color: T.textDim, marginTop: "10px", textAlign: "center", letterSpacing: "1px" }}>
            Bay is showing OUT OF SERVICE to customers
          </div>
        )}
      </div>
    </div>
  </div>
}

// ═══════════════════════════════════════════
// BAY OVERVIEW
// ═══════════════════════════════════════════

function BayCard({ bay, onClick }) {
  const [elapsed, setElapsed] = useState("")
  useEffect(() => {
    if (bay.status !== "active" && bay.status !== "issue") return
    if (!bay.currentSessionStartedAt) return
    const ms = bay.currentSessionStartedAt?.toMillis ? bay.currentSessionStartedAt.toMillis() : bay.currentSessionStartedAt
    const tick = () => setElapsed(formatElapsed(Date.now() - ms))
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv)
  }, [bay])
  const status = effectiveStatus(bay)
  return <div style={S.bayCard(status)} onClick={onClick}>
    <div style={S.bayHeader}>
      <div><h3 style={S.bayName}>{bay.displayName || bay.id}</h3><div style={{ fontFamily: T.fontMono, fontSize: "10px", color: T.textDim }}>{bay.deviceId ? "iPad paired" : "No device"}</div></div>
      <div style={S.bayBadge(status)}>{statusLabel(status)}</div>
    </div>
    <div style={S.bayBody}>
      {(status === "active" || status === "issue") ? (
        bay.currentSessionStartedAt ? <div style={S.baySession}>
          <div style={S.bayTimer(status === "issue" ? T.amber : T.accent)}>{elapsed}</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: "12px", fontWeight: 600, color: bay.status === "issue" ? T.amber : T.textPrimary, textTransform: "uppercase", letterSpacing: "1px" }}>
            {status === "issue" && <Pause size={12} style={{ marginRight: 4, verticalAlign: -1 }} />}
            {bay.isTransferSession && <KeyRound size={10} style={{ marginRight: 4, verticalAlign: -1, color: T.amber }} />}
            {bay.isPromoSession && <Tag size={10} style={{ marginRight: 4, verticalAlign: -1, color: T.accent }} />}
            {bay.currentFunction != null ? fnName(bay.currentFunction, bay) : "Waiting"}
          </div></div>
        </div> : <div style={S.bayIdle}><div style={{ color: T.accent, fontSize: "13px", fontWeight: 600 }}>Customer at kiosk</div><div style={{ fontSize: "11px", marginTop: "4px" }}>Waiting for function selection</div></div>
      ) : status === "idle" ? (
        <div style={S.bayIdle}>{bay.lastSession ? <>
          <div style={{ fontSize: "11px", color: T.textSecondary, marginBottom: "4px" }}>Last session</div>
          <div style={{ fontFamily: T.fontMono, fontSize: "16px", color: T.accent }}>${(bay.lastSession.charge || 0).toFixed(2)}<span style={{ color: T.textDim, fontSize: "12px", margin: "0 6px" }}>/</span>{formatDuration(bay.lastSession.durationSeconds || 0)}</div>
          <div style={{ fontSize: "10px", color: T.textDim, marginTop: "4px" }}>{bay.lastSession.endedAt?.toDate ? timeAgo(bay.lastSession.endedAt.toDate()) : ""}</div>
        </> : "Waiting for customer"}</div>
      ) : status === "relayDown" ? (
        <div style={{ ...S.bayIdle, color: T.amber, padding: "24px 12px" }}>
          <ZapOff size={30} strokeWidth={2} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "2px", color: T.amber }}>RELAY DOWN</div>
          <div style={{ fontSize: "10px", marginTop: 4, color: T.textDim }}>iPad online, relay unreachable</div>
        </div>
      ) : status === "outOfService" ? (
        <div style={{ ...S.bayIdle, color: "#9ca3af", padding: "24px 12px" }}>
          <Construction size={28} strokeWidth={1.5} style={{ marginBottom: 8, opacity: 0.7 }} />
          <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "2px", color: "#9ca3af" }}>OUT OF SERVICE</div>
          <div style={{ fontSize: "10px", marginTop: 4, color: T.textDim }}>Operator disabled</div>
        </div>
      ) : (
        <div style={{ ...S.bayIdle, color: T.red, padding: "24px 12px" }}>
          <WifiOff size={32} strokeWidth={2} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "2px", color: T.red }}>OFFLINE</div>
          <div style={{ fontSize: "10px", marginTop: 4, color: T.textDim }}>{bay.deviceId ? "iPad not responding" : "No device paired"}</div>
        </div>
      )}

    </div>
  </div>
}

function BayOverview({ bays, todayStats, onNavigateConfig, onNavigateSessions, onNavigateIssues, onNavigateDevices }) {
  const [selectedBay, setSelectedBay] = useState(null)
  const activeBays = bays.filter(b => { const s = effectiveStatus(b); return s === "active" || s === "issue" })
  const onlineBays = bays.filter(b => effectiveStatus(b) !== "offline")
  return <>
    <div style={S.statsRow}>
      <div style={{...S.statCard,cursor:"pointer"}} onClick={()=>onNavigateSessions?.()}><div style={S.scLabel}>Today's Revenue</div><div style={S.scValue(T.accent)}>${todayStats.revenue.toFixed(2)}</div><div style={S.scSub}>{todayStats.sessions} sessions</div></div>
      <div style={{...S.statCard,cursor:"pointer"}} onClick={()=>onNavigateSessions?.()}><div style={S.scLabel}>Total Sessions</div><div style={S.scValue(T.blue)}>{todayStats.sessions}</div><div style={S.scSub}>Today</div></div>
      <div style={{ ...S.statCard, cursor: "pointer" }} onClick={() => onNavigateIssues?.()}><div style={S.scLabel}>Open Issues</div><div style={S.scValue(T.amber)}>{todayStats.issues}</div><div style={S.scSub}>Unresolved</div></div>
      <div style={{ ...S.statCard, cursor: "pointer" }} onClick={() => onNavigateDevices?.()}><div style={S.scLabel}>Bays Online</div><div style={S.scValue(T.green)}>{onlineBays.length}/{bays.length}</div><div style={S.scSub}>{activeBays.length} active</div></div>
    </div>
    <div style={S.sectionHeader}><h2 style={S.sectionTitle}>Live Bay Status</h2></div>
    {bays.length === 0 ? <div style={S.placeholder}><Radio size={40} strokeWidth={1} /><div style={S.placeholderTitle}>No bays configured</div><div style={S.placeholderSub}>Go to Bay Config to add your first bay.</div></div>
    : <div style={S.bayGrid}>{bays.map(b => <BayCard key={b.id} bay={b} onClick={() => setSelectedBay(b)} />)}</div>}
    {selectedBay && <BayDetailModal bay={bays.find(b => b.id === selectedBay.id) || selectedBay} bays={bays} onClose={() => setSelectedBay(null)} />}
  </>
}

// ═══════════════════════════════════════════
// SESSION DETAIL MODAL
// ═══════════════════════════════════════════

function SessionDetailModal({ session, bays, onClose }) {
  const [startPhoto, setStartPhoto] = useState(null)
  const [endPhoto, setEndPhoto] = useState(null)

  useEffect(() => {
    if (!session?.id) return
    const loadPhoto = async (filename, setter) => {
      try {
        const r = storageRef(storage, "sessions/" + session.id + "/" + filename + ".jpg")
        const url = await getDownloadURL(r)
        setter(url)
      } catch (e) { /* no photo */ }
    }
    loadPhoto("start", setStartPhoto)
    loadPhoto("end", setEndPhoto)
  }, [session?.id])

  const bay = bays.find(b => b.id === session.bayId)
  const start = session.startedAt?.toDate ? session.startedAt.toDate() : null
  const end = session.endedAt?.toDate ? session.endedAt.toDate() : null
  const duration = start && end ? Math.floor((end - start) / 1000) : 0
  const segments = session.functionSegments || []

  const fnTimes = {}
  segments.forEach(seg => {
    const name = fnName(seg.function, bay)
    const segStart = seg.startedAt?.toDate ? seg.startedAt.toDate() : (seg.startedAt?.seconds ? new Date(seg.startedAt.seconds * 1000) : null)
    const segEnd = seg.endedAt?.toDate ? seg.endedAt.toDate() : (seg.endedAt?.seconds ? new Date(seg.endedAt.seconds * 1000) : null)
    const secs = segStart && segEnd ? Math.floor((segEnd - segStart) / 1000) : 0
    fnTimes[name] = (fnTimes[name] || 0) + secs
  })

  const subtotal = session.subtotal || session.totalCharge || 0
  const tax = session.salesTax || 0
  const total = session.totalCharge || 0

  return <div style={S.modal}>
    <div style={S.modalBackdrop} onClick={onClose} />
    <div style={{ ...S.modalContent, maxWidth: "700px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid " + T.border }}>
        <div>
          <h2 style={{ fontFamily: T.fontDisplay, fontSize: "18px", fontWeight: 600, color: T.textPrimary, margin: 0 }}>Session Details</h2>
          <div style={{ fontSize: "11px", color: T.textDim, marginTop: "2px" }}>{session.id}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim }}><X size={20} /></button>
      </div>

      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          <div style={{ background: T.bgDeep, border: "1px solid " + T.border, borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "8px 12px", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: T.textDim, borderBottom: "1px solid " + T.border }}>Session Start</div>
            {startPhoto ? <img src={startPhoto} alt="Start" style={{ width: "100%", display: "block" }} />
            : <div style={{ padding: "40px", textAlign: "center", color: T.textDim, fontSize: "12px" }}>No photo</div>}
          </div>
          <div style={{ background: T.bgDeep, border: "1px solid " + T.border, borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "8px 12px", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: T.textDim, borderBottom: "1px solid " + T.border }}>Session End</div>
            {endPhoto ? <img src={endPhoto} alt="End" style={{ width: "100%", display: "block" }} />
            : <div style={{ padding: "40px", textAlign: "center", color: T.textDim, fontSize: "12px" }}>No photo</div>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          <div style={S.statCard}><div style={S.scLabel}>Bay</div><div style={{ fontSize: "16px", fontWeight: 600, color: T.textPrimary }}>{bay?.displayName || session.bayId?.substring(0, 8)}</div></div>
          <div style={S.statCard}><div style={S.scLabel}>Duration</div><div style={{ fontFamily: T.fontMono, fontSize: "20px", color: T.accent }}>{formatDuration(duration)}</div></div>
          <div style={S.statCard}><div style={S.scLabel}>Date</div><div style={{ fontSize: "13px", color: T.textSecondary }}>{start ? formatDate(start) : "--"}</div></div>
        </div>

        <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "10px", padding: "16px 20px", marginBottom: "20px" }}>
          <div style={{ ...CS.label, marginBottom: "12px" }}>Charges</div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}><span style={{ color: T.textSecondary }}>Subtotal</span><span style={{ fontFamily: T.fontMono, color: T.textPrimary }}>{"$" + subtotal.toFixed(2)}</span></div>
          {tax > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}><span style={{ color: T.textSecondary }}>Sales Tax</span><span style={{ fontFamily: T.fontMono, color: T.textPrimary }}>{"$" + tax.toFixed(2)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", fontSize: "15px", fontWeight: 700, borderTop: "1px solid " + T.border, marginTop: "6px" }}><span>Total</span><span style={{ fontFamily: T.fontMono, color: T.accent }}>{"$" + total.toFixed(2)}</span></div>
        </div>

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

        {/* Contact + Receipt */}
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
              const destination = method === "sms" ? (dest.startsWith("+") ? dest : "+1" + dest.replace(/\D/g, "")) : dest
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
}

// ═══════════════════════════════════════════
// SESSIONS TAB
// ═══════════════════════════════════════════

function SessionsTab({ ownerId, bays }) {
  const [rawSessions, setSessions] = useState([])
  const sessions = rawSessions.filter(x => bays.some(b => b.id === x.bayId))
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
}

// ═══════════════════════════════════════════
// BAY CONFIG
// ═══════════════════════════════════════════

function configFromFirestore(d) {
  const fns = DEFAULT_FUNCTIONS.map(f => {
    const active = d.activeFunctions || Array.from({ length: 12 }, (_, i) => i)
    const cfg = (d.functionConfigs || {})[String(f.id)] || {}
    const rates = d.perFunctionRates || {}
    return { ...f, enabled: active.includes(f.id), customName: cfg.customName || "", icon: cfg.icon || "", perFunctionRate: rates[String(f.id)] ? String(rates[String(f.id)]) : "" }
  })
  return { washName: d.washName || "Self-Serve Wash", displayName: d.displayName || "", attendantPhone: d.attendantPhone || "",
    pricingMode: d.pricingMode || "flatRate", flatRatePerMinute: d.flatRatePerMinute != null ? String(d.flatRatePerMinute) : "1.00",
    minimumCharge: d.minimumCharge != null ? String(d.minimumCharge) : "", maximumCharge: d.maximumCharge != null ? String(d.maximumCharge) : "",
    relayHost: d.relayHost || "192.168.1.100", relayPort: d.relayPort != null ? String(d.relayPort) : "502",
    watchdogInterval: d.watchdogInterval != null ? String(d.watchdogInterval) : "10", status: d.status || "offline",
    logoUrl: d.logoUrl || "", displayMode: d.displayMode || "auto", salesTaxEnabled: d.salesTaxEnabled || false, salesTaxRate: d.salesTaxRate != null ? String(d.salesTaxRate) : "",
    outOfService: d.outOfService === true, functions: fns }
}

function configToFirestore(c, ownerId) {
  const activeFunctions = c.functions.filter(f => f.enabled).map(f => f.id)
  const functionConfigs = {}, perFunctionRates = {}
  c.functions.forEach(f => { const fc = {}; if (f.customName) fc.customName = f.customName; if (f.icon) fc.icon = f.icon; if (Object.keys(fc).length) functionConfigs[String(f.id)] = fc; if (f.perFunctionRate) perFunctionRates[String(f.id)] = parseFloat(f.perFunctionRate) || 0 })
  return { ownerId, washName: c.washName, displayName: c.displayName, attendantPhone: c.attendantPhone,
    status: c.status || "offline", pricingMode: c.pricingMode, flatRatePerMinute: parseFloat(c.flatRatePerMinute) || 1.00,
    minimumCharge: c.minimumCharge ? parseFloat(c.minimumCharge) : null, maximumCharge: c.maximumCharge ? parseFloat(c.maximumCharge) : null,
    relayHost: c.relayHost, relayPort: parseInt(c.relayPort) || 502, watchdogInterval: parseInt(c.watchdogInterval) || 10,
    logoUrl: c.logoUrl || "", displayMode: c.displayMode || "auto", salesTaxEnabled: c.salesTaxEnabled || false, salesTaxRate: c.salesTaxRate ? parseFloat(c.salesTaxRate) : null,
    activeFunctions, functionConfigs, perFunctionRates, updatedAt: serverTimestamp() }
}

function BayConfigTab({ bays, ownerId, locationId }) {
  const [selId, setSelId] = useState(null), [config, setConfig] = useState(makeDefaultConfig()), [saving, setSaving] = useState(false), [saved, setSaved] = useState(false), [creating, setCreating] = useState(false)
  useEffect(() => { if (bays.length > 0 && (!selId || !bays.some(b => b.id === selId))) { setSelId(bays[0].id); setConfig(configFromFirestore(bays[0])) } }, [bays])
  const selectBay = (id) => { setSelId(id); const b = bays.find(x => x.id === id); if (b) setConfig(configFromFirestore(b)); setSaved(false) }
  const u = (k, v) => { setConfig(p => ({ ...p, [k]: v })); setSaved(false) }
  const uFn = (id, k, v) => { setConfig(p => ({ ...p, functions: p.functions.map(f => f.id === id ? { ...f, [k]: v } : f) })); setSaved(false) }
  const save = async () => {
    if (!selId) return
    setSaving(true)
    try {
      const payload = configToFirestore(config, ownerId)
      // Self-heal bays created before this fix. Only writes when the current
      // value is missing or the old placeholder — a real location is never
      // overwritten, even if a different one is selected in the topbar.
      const current = bays.find(b => b.id === selId)?.locationId
      if ((!current || current === "default") && locationId) payload.locationId = locationId
      await setDoc(doc(db, "bays", selId), payload, { merge: true })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e) { alert("Failed: " + e.message) }
    setSaving(false)
  }
  const create = async () => {
    // Alerts, reports and logos all resolve through the bay's location. A
    // bay without one runs fine and then silently never alerts anyone.
    if (!locationId) { alert("Add a location first under Settings > Location. Alerts and reports are grouped by location."); return }
    setCreating(true)
    try {
      const c = makeDefaultConfig(`Bay ${bays.length + 1}`)
      const ref = await addDoc(collection(db, "bays"), { ...configToFirestore(c, ownerId), locationId })
      setSelId(ref.id); setConfig(c)
    } catch (e) { alert("Failed: " + e.message) }
    setCreating(false)
  }
  const selBay = bays.find(b => b.id === selId)
  const isUnpaired = selBay && !selBay.deviceId

  return <div style={CS.wrap}>
    <div style={CS.baySelector}>
      {bays.map(b => <button key={b.id} style={CS.bayTab(selId === b.id)} onClick={() => selectBay(b.id)}>{b.displayName || b.id}</button>)}
      <button style={{ ...CS.bayTab(false), borderStyle: "dashed", display: "flex", alignItems: "center", gap: "4px" }} onClick={create} disabled={creating}>{creating ? <Loader size={12} /> : <Plus size={12} />}{creating ? "Creating..." : "Add Bay"}</button>
    </div>
    {!selId && bays.length === 0 ? <div style={S.placeholder}><Settings size={40} strokeWidth={1} /><div style={S.placeholderTitle}>No bays yet</div></div> : <>
      {isUnpaired && selId && <PairingSection bayId={selId} ownerId={ownerId} />}

      <div style={CS.section}><h3 style={CS.sectionTitle}><Tag size={16} /> Identity</h3>
        <div style={CS.row}><div style={CS.field()}><label style={CS.label}>Wash Name</label><input style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep }} value={config.washName} onChange={e => u("washName", e.target.value)} placeholder="Self-Serve Wash" /><div style={CS.hint}>Shown at top of kiosk</div></div>
        <div style={CS.field()}><label style={CS.label}>Bay Display Name</label><input style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep }} value={config.displayName} onChange={e => u("displayName", e.target.value)} placeholder="Bay 1" /></div></div>
        <div style={CS.row}><div style={CS.field()}><label style={CS.label}>Logo</label>
                {config.logoUrl ? <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <img src={config.logoUrl} alt="Logo" style={{ height: "48px", borderRadius: "8px", background: T.bgDeep, padding: "4px" }} />
                  <span style={{ fontSize: "11px", color: T.textDim }}>Managed in Location tab</span>
                </div> : <label style={{ ...CS.uploadArea, cursor: "pointer", display: "block" }}>
                  <Upload size={20} style={{ marginBottom: "6px", opacity: 0.5 }} /><br />
                  Click to upload logo (PNG, SVG)
                  <input type="file" accept="image/png,image/svg+xml,image/jpeg" style={{ display: "none" }} onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file || !selId) return;
                    try {
                      const r = storageRef(storage, "bays/" + selId + "/logo." + file.name.split(".").pop());
                      await uploadBytes(r, file, { contentType: file.type });
                      const url = await getDownloadURL(r);
                      u("logoUrl", url);
                    } catch (err) { alert("Upload failed: " + err.message); }
                  }} />
                </label>}
              </div></div>
      </div>

      <div style={CS.section}><h3 style={CS.sectionTitle}><Monitor size={16} /> Display</h3>
        <div style={CS.row}><div style={CS.field()}><label style={CS.label}>Kiosk Appearance</label>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>{["dark", "light", "auto"].map(m => <div key={m} style={CS.toggle(config.displayMode === m)} onClick={() => u("displayMode", m)}>{m === "dark" ? <EyeOff size={14} /> : m === "light" ? <Eye size={14} /> : <RefreshCw size={14} />}{m.charAt(0).toUpperCase() + m.slice(1)}</div>)}</div>
          <div style={CS.hint}>Light mode maximizes brightness for outdoor visibility. Auto switches by time of day.</div>
        </div></div>
      </div>

      <div style={CS.section}><h3 style={CS.sectionTitle}><DollarSign size={16} /> Pricing</h3>
        <div style={CS.row}><div style={CS.field("none")}><label style={CS.label}>Pricing Mode</label><div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <div style={CS.toggle(config.pricingMode === "flatRate")} onClick={() => u("pricingMode", "flatRate")}>{config.pricingMode === "flatRate" ? <ToggleRight size={14} /> : <ToggleLeft size={14} />} Flat Rate</div>
          <div style={CS.toggle(config.pricingMode === "perFunction")} onClick={() => u("pricingMode", "perFunction")}>{config.pricingMode === "perFunction" ? <ToggleRight size={14} /> : <ToggleLeft size={14} />} Per Function</div>
        </div></div></div>
        <div style={CS.row}>
          {config.pricingMode === "flatRate" && <div style={CS.field(0.5)}><label style={CS.label}>Rate per Minute</label><div style={{ position: "relative" }}><span style={{ position: "absolute", left: "12px", top: "10px", color: T.textDim, fontSize: "14px", fontFamily: T.fontMono }}>$</span><input style={{ ...CS.inputMono, paddingLeft: "26px" }} value={config.flatRatePerMinute} onChange={e => u("flatRatePerMinute", e.target.value)} /></div></div>}
          <div style={CS.field(0.5)}><label style={CS.label}>Minimum Charge</label><div style={{ position: "relative" }}><span style={{ position: "absolute", left: "12px", top: "10px", color: T.textDim, fontSize: "14px", fontFamily: T.fontMono }}>$</span><input style={{ ...CS.inputMono, paddingLeft: "26px" }} value={config.minimumCharge} onChange={e => u("minimumCharge", e.target.value)} placeholder="0.00" /></div></div>
          <div style={CS.field(0.5)}><label style={CS.label}>Maximum Charge</label><div style={{ position: "relative" }}><span style={{ position: "absolute", left: "12px", top: "10px", color: T.textDim, fontSize: "14px", fontFamily: T.fontMono }}>$</span><input style={{ ...CS.inputMono, paddingLeft: "26px" }} value={config.maximumCharge} onChange={e => u("maximumCharge", e.target.value)} placeholder="No limit" /></div></div>
        </div>
      </div>

      <div style={CS.section}><h3 style={CS.sectionTitle}><Receipt size={16} /> Sales Tax</h3>
        <div style={CS.row}><div style={CS.field()}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "8px 0" }} onClick={() => u("salesTaxEnabled", !config.salesTaxEnabled)}>
            <div style={{ width: "44px", height: "24px", borderRadius: "12px", background: config.salesTaxEnabled ? T.accent : T.bgElevated, border: "2px solid " + (config.salesTaxEnabled ? T.accent : T.borderLight), position: "relative", transition: "all 0.2s", flexShrink: 0 }}>
              <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "white", position: "absolute", top: "1px", left: config.salesTaxEnabled ? "22px" : "1px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
            </div>
            <span style={{ fontSize: "14px", fontWeight: 600, color: config.salesTaxEnabled ? T.textPrimary : T.textSecondary }}>Enable sales tax</span>
          </div>
          <div style={CS.hint}>Applied at end of session as a separate line item on the receipt</div>
        </div></div>
        {config.salesTaxEnabled && <div style={CS.row}><div style={CS.field(0.3)}>
          <label style={CS.label}>Tax Rate (%)</label>
          <div style={{ position: "relative" }}><input style={CS.inputMono} value={config.salesTaxRate} onChange={e => u("salesTaxRate", e.target.value)} placeholder="6.5" /><span style={{ position: "absolute", right: "12px", top: "10px", color: T.textDim, fontSize: "14px", fontFamily: T.fontMono }}>%</span></div>
        </div></div>}
      </div>

      <div style={CS.section}><h3 style={CS.sectionTitle}><Monitor size={16} /> Functions ({config.functions.filter(f => f.enabled).length} of {config.functions.length} active)</h3>
        <div style={{ ...CS.fnGrid, marginTop: "14px" }}>{config.functions.map(fn => <div key={fn.id} style={CS.fnCard(fn.enabled)}>
          <div style={CS.fnHeader}><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><LucideForSF sf={fn.icon || DEFAULT_SF_SYMBOLS[fn.id] || "circle.dotted"} size={18} color={fn.enabled ? T.accent : T.textDim} /><div><div style={CS.fnName}>{fn.customName || fn.name}</div><div style={CS.fnId}>Coil {String(fn.id).padStart(2, "0")}</div></div></div>
            <div style={CS.toggleSwitch(fn.enabled)} onClick={() => uFn(fn.id, "enabled", !fn.enabled)}><div style={CS.toggleKnob(fn.enabled)} /></div></div>
          {fn.enabled && <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div><label style={{ ...CS.label, fontSize: "9px" }}>Custom Name</label><input style={{ ...CS.input, padding: "7px 10px", fontSize: "12px", color: T.textPrimary, background: T.bgDeep }} value={fn.customName} onChange={e => uFn(fn.id, "customName", e.target.value)} placeholder={fn.name} /></div>
            <div><label style={{ ...CS.label, fontSize: "9px" }}>Icon</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px", alignItems: "center" }}>
                {ICON_OPTIONS.map(opt => {
                  const currentIcon = fn.icon || DEFAULT_SF_SYMBOLS[fn.id] || ""
                  const isSelected = currentIcon === opt.key
                  return <div key={opt.key} title={opt.label} onClick={() => uFn(fn.id, "icon", opt.key)} style={{
                    width: 32, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    background: isSelected ? T.accent + "22" : T.bgDeep,
                    border: isSelected ? `2px solid ${T.accent}` : `1px solid ${T.bgPanel}`,
                  }}><LucideForSF sf={opt.key} size={16} color={isSelected ? T.accent : T.textDim} /></div>
                })}
                <label title="Upload custom icon" style={{
                  width: 32, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  background: (fn.icon || "").startsWith("http") ? T.accent + "22" : T.bgDeep,
                  border: (fn.icon || "").startsWith("http") ? `2px solid ${T.accent}` : `1px dashed ${T.textDim}44`,
                }}><Upload size={14} color={T.textDim} /><input type="file" accept="image/png,image/svg+xml,image/webp" style={{ display: "none" }} onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return
                  try {
                    const ext = file.name.split(".").pop()
                    const r = storageRef(storage, "bays/" + selId + "/icons/" + fn.id + "." + ext)
                    await uploadBytes(r, file, { contentType: file.type })
                    const url = await getDownloadURL(r)
                    uFn(fn.id, "icon", url)
                  } catch (err) { console.error("Icon upload failed:", err) }
                }} /></label>
              </div>
              {(fn.icon || "").startsWith("http") && <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <img src={fn.icon} alt="Custom icon" style={{ width: 24, height: 24, borderRadius: 4, background: T.bgDeep, padding: "2px" }} />
                <span style={{ fontSize: "10px", color: T.textDim }}>Custom icon</span>
                <button onClick={() => uFn(fn.id, "icon", "")} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}><X size={12} color={T.red} /></button>
              </div>}
            </div>
            {config.pricingMode === "perFunction" && <div><label style={{ ...CS.label, fontSize: "9px" }}>Rate ($/min)</label><div style={{ position: "relative" }}><span style={{ position: "absolute", left: "10px", top: "7px", color: T.textDim, fontSize: "12px", fontFamily: T.fontMono }}>$</span><input style={{ ...CS.inputMono, padding: "7px 10px 7px 24px", fontSize: "12px" }} value={fn.perFunctionRate} onChange={e => uFn(fn.id, "perFunctionRate", e.target.value)} /></div></div>}
          </div>}
        </div>)}</div>
      </div>

      <div style={CS.section}><h3 style={CS.sectionTitle}><Phone size={16} /> Contact</h3>
        <div style={CS.row}><div style={CS.field(0.5)}><label style={CS.label}>Attendant Phone</label><input style={{ ...CS.inputMono, color: T.accent, background: T.bgDeep }} value={config.attendantPhone} onChange={e => u("attendantPhone", e.target.value)} placeholder="(555) 555-1234" /><div style={CS.hint}>Shown in help flow</div></div></div>
      </div>

      <div style={CS.section}><h3 style={CS.sectionTitle}><Server size={16} /> Hardware</h3>
        <div style={CS.row}>
          <div style={CS.field()}><label style={CS.label}>Relay Host (IP)</label><input style={{ ...CS.inputMono, color: T.accent, background: T.bgDeep }} value={config.relayHost} onChange={e => u("relayHost", e.target.value)} /><div style={CS.hint}>SeaI/O-450E static IP</div></div>
          <div style={CS.field(0.5)}><label style={CS.label}>Relay Port</label><input style={{ ...CS.inputMono, color: T.accent, background: T.bgDeep }} value={config.relayPort} onChange={e => u("relayPort", e.target.value)} /></div>
          <div style={CS.field(0.5)}><label style={CS.label}>Watchdog (sec)</label><input style={{ ...CS.inputMono, color: T.accent, background: T.bgDeep }} value={config.watchdogInterval} onChange={e => u("watchdogInterval", e.target.value)} /></div>
        </div>
      </div>

      <div style={CS.saveBar}>
        {saved && <div style={CS.savedBanner}><Check size={14} /> Saved</div>}
        <button style={CS.cancelBtn} onClick={() => { const b = bays.find(x => x.id === selId); if (b) setConfig(configFromFirestore(b)) }}>Discard</button>
        <button style={{ ...CS.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>{saving ? <Loader size={14} /> : <Save size={14} />}{saving ? "Saving..." : "Save Configuration"}</button>
      </div>
    </>}
  </div>
}

// ═══════════════════════════════════════════
// CODES TAB
// ═══════════════════════════════════════════

function CodesTab({ ownerId }) {
  const [codes, setCodes] = useState([])
  const [transferCodes, setTransferCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGenerator, setShowGenerator] = useState(false)
  const [codeType, setCodeType] = useState("dollar")
  const [codeValue, setCodeValue] = useState("")
  const [codeExpiry, setCodeExpiry] = useState("30")
  const [codeLabel, setCodeLabel] = useState("")
  const [customCode, setCustomCode] = useState("")
  const [codeUsageLimit, setCodeUsageLimit] = useState("")
  const [generating, setGenerating] = useState(false)
  const [generatedCode, setGeneratedCode] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const q1 = query(collection(db, "promoCodes"), where("ownerId", "==", ownerId), orderBy("createdAt", "desc"), limit(50))
    const unsub1 = onSnapshot(q1, snap => {
      setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))

    const q2 = query(collection(db, "transferCodes"), where("ownerId", "==", ownerId), orderBy("createdAt", "desc"), limit(50))
    const unsub2 = onSnapshot(q2, snap => {
      setTransferCodes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, () => {})

    return () => { unsub1(); unsub2() }
  }, [ownerId])

  const handleGenerate = async () => {
    if (!codeValue) return
    setGenerating(true)
    try {
      const val = parseFloat(codeValue)
      const code = await createPromoCode(ownerId, codeType, val, parseInt(codeExpiry) || 30, codeLabel, codeUsageLimit ? parseInt(codeUsageLimit) : null, customCode)
      setGeneratedCode(code)
      setCodeValue("")
      setCodeLabel("")
      setCustomCode("")
      setCodeUsageLimit("")
      setTimeout(() => setGeneratedCode(null), 5000)
    } catch (e) { alert("Failed: " + e.message) }
    setGenerating(false)
  }

  const allCodes = [
    ...codes.map(c => ({ ...c, source: "promo" })),
    ...transferCodes.map(c => ({ ...c, source: "transfer", codeType: "dollar", value: c.originalCharge || 0 }))
  ].sort((a, b) => {
    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0
    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0
    return bTime - aTime
  })

  if (loading) return <div style={S.placeholder}><Loader size={24} style={{ animation: "spin 1s linear infinite" }} /></div>

  return <>
    <div style={S.sectionHeader}>
      <h2 style={S.sectionTitle}>Codes</h2>
      <button onClick={() => setShowGenerator(!showGenerator)} style={{ ...CS.saveBtn, padding: "8px 16px", fontSize: "12px" }}>
        <Plus size={14} /> Generate Code
      </button>
    </div>

    {showGenerator && <div style={{ ...CS.section, marginBottom: "20px" }}>
      <h3 style={CS.sectionTitle}><KeyRound size={16} /> New Promo Code</h3>
      <div style={CS.row}>
        <div style={CS.field("none")}>
          <label style={CS.label}>Code Type</label>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <div style={CS.toggle(codeType === "dollar")} onClick={() => setCodeType("dollar")}>
              <DollarSign size={14} /> Dollar Amount
            </div>
            <div style={CS.toggle(codeType === "percent")} onClick={() => setCodeType("percent")}>
              % Percentage Off
            </div>
          </div>
        </div>
      </div>
      <div style={CS.row}>
        <div style={CS.field()}>
          <label style={CS.label}>Label (optional)</label>
          <input style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep }} value={codeLabel} onChange={e => setCodeLabel(e.target.value)} placeholder="e.g. Grand Opening Special" />
        </div>
        <div style={CS.field(0.4)}>
          <label style={CS.label}>Custom Code (optional)</label>
          <input style={CS.inputMono} value={customCode} onChange={e => setCustomCode(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Auto-generated if blank" maxLength={6} />
          <div style={CS.hint}>Numeric only (6 digits). Leave blank for random code.</div>
        </div>
      </div>
      <div style={CS.row}>
        <div style={CS.field(0.3)}>
          <label style={CS.label}>{codeType === "dollar" ? "Credit Amount" : "Discount %"}</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "12px", top: "10px", color: T.textDim, fontSize: "14px", fontFamily: T.fontMono }}>{codeType === "dollar" ? "$" : ""}</span>
            <input style={{ ...CS.inputMono, paddingLeft: codeType === "dollar" ? "26px" : "14px" }} value={codeValue} onChange={e => setCodeValue(e.target.value)} placeholder={codeType === "dollar" ? "10.00" : "25"} />
            {codeType === "percent" && <span style={{ position: "absolute", right: "12px", top: "10px", color: T.textDim, fontSize: "14px", fontFamily: T.fontMono }}>%</span>}
          </div>
        </div>
        <div style={CS.field(0.3)}>
          <label style={CS.label}>Expires In (days)</label>
          <input style={CS.inputMono} value={codeExpiry} onChange={e => setCodeExpiry(e.target.value)} placeholder="30" />
        </div>
        <div style={CS.field(0.3)}>
          <label style={CS.label}>Max Uses</label>
          <input style={CS.inputMono} value={codeUsageLimit} onChange={e => setCodeUsageLimit(e.target.value)} placeholder="Unlimited" />
        </div>
        <div style={CS.field(0.3)}>
          <label style={CS.label}>&nbsp;</label>
          <button onClick={handleGenerate} disabled={generating} style={{ ...CS.saveBtn, width: "100%", justifyContent: "center" }}>
            {generating ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <KeyRound size={14} />}
            {generating ? "..." : "Generate"}
          </button>
        </div>
      </div>
      {generatedCode && <div style={{ ...CS.savedBanner, marginTop: "8px", fontSize: "14px" }}>
        <Check size={14} /> Code generated: <span style={{ fontFamily: T.fontMono, letterSpacing: "3px", fontSize: "18px", marginLeft: "8px" }}>{generatedCode}</span>
      </div>}
    </div>}

    <div style={{ marginBottom: "16px" }}>
      <input style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep, maxWidth: "300px" }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by code, label, or type..." />
    </div>

    {(() => {
      const filtered = searchQuery ? allCodes.filter(c => {
        const q = searchQuery.toLowerCase()
        return (c.code || "").toLowerCase().includes(q) || (c.label || "").toLowerCase().includes(q) || (c.codeType || "").toLowerCase().includes(q) || (c.source || "").toLowerCase().includes(q)
      }) : allCodes
      return filtered
    })().length === 0 ? <div style={S.placeholder}><KeyRound size={40} strokeWidth={1} /><div style={S.placeholderTitle}>No codes yet</div><div style={S.placeholderSub}>Generate promo codes or transfer codes will appear here from help flow sessions.</div></div>
    : <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "12px", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead><tr style={{ borderBottom: "1px solid " + T.border }}>
          {["Code", "Label", "Type", "Value", "Uses", "Source", "Status", "Expires"].map(h => <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: T.textDim }}>{h}</th>)}
        </tr></thead>
        <tbody>{(() => {
      const filtered = searchQuery ? allCodes.filter(c => {
        const q = searchQuery.toLowerCase()
        return (c.code || "").toLowerCase().includes(q) || (c.label || "").toLowerCase().includes(q) || (c.codeType || "").toLowerCase().includes(q) || (c.source || "").toLowerCase().includes(q)
      }) : allCodes
      return filtered
    })().map((c, i) => {
          const created = c.createdAt?.toDate ? c.createdAt.toDate() : null
          const expires = c.expiresAt?.toDate ? c.expiresAt.toDate() : null
          const isExpired = expires && expires < new Date()
          const isUsed = c.used || c.redeemed
          const statusColor = isUsed ? T.textDim : isExpired ? T.red : T.green
          const statusText = isUsed ? "Used" : isExpired ? "Expired" : "Active"
          return <tr key={c.id || i} style={{ borderBottom: "1px solid " + T.border }}>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "14px", fontWeight: 600, color: T.accent, letterSpacing: "2px" }}>{c.code}</td>
            <td style={{ padding: "10px 14px", fontSize: "12px", color: T.textSecondary, maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label || "--"}</td>
            <td style={{ padding: "10px 14px" }}>{c.codeType === "percent" ? "% Off" : "$ Credit"}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, color: T.textPrimary }}>{c.codeType === "percent" ? c.value + "%" : "$" + (c.value || 0).toFixed(2)}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "12px", color: T.textSecondary }}>{c.usageLimit ? (c.usageCount || 0) + "/" + c.usageLimit : (c.usageCount || 0)}</td>
            <td style={{ padding: "10px 14px" }}><span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: c.source === "transfer" ? T.amberDim : T.accentDim, color: c.source === "transfer" ? T.amber : T.accent }}>{c.source === "transfer" ? "Transfer" : "Promo"}</span></td>
            <td style={{ padding: "10px 14px" }}><span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: statusColor + "20", color: statusColor }}>{statusText}</span></td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "11px", color: isExpired ? T.red : T.textSecondary }}>{expires ? formatDate(expires) : "--"}</td>
          </tr>
        })}</tbody>
      </table>
    </div>}
  </>
}

// ═══════════════════════════════════════════
// PLACEHOLDER
// ═══════════════════════════════════════════


// ═══════════════════════════════════════════
// ISSUES TAB
// ═══════════════════════════════════════════
function IssuesTab({ ownerId, bays }) {
  const [rawIssues, setIssues] = useState([])
  const issues = rawIssues.filter(x => bays.some(b => b.id === x.bayId))
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [selectedIssue, setSelectedIssue] = useState(null)

  useEffect(() => {
    const q = query(collection(db, "issues"), where("ownerId", "==", ownerId), orderBy("reportedAt", "desc"), limit(100))
    const unsub = onSnapshot(q, snap => {
      setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [ownerId])

  const getBayName = (bayId) => { const b = bays.find(x => x.id === bayId); return b?.displayName || bayId?.substring(0, 8) || "Unknown" }

  const issueTypes = { functionNotWorking: "Function Not Working", leakingFitting: "Leaking Fitting", other: "Other" }

  const resolveIssue = async (issueId) => {
    try {
      await updateDoc(doc(db, "issues", issueId), { status: "resolved", resolvedAt: serverTimestamp() })
    } catch (e) { console.error("Failed to resolve:", e) }
  }

  const filtered = filter === "all" ? issues : issues.filter(i => i.status === filter)
  const openCount = issues.filter(i => i.status === "open").length
  const resolvedCount = issues.filter(i => i.status === "resolved").length

  if (loading) return <div style={S.placeholder}><Loader size={24} style={{ animation: "spin 1s linear infinite" }} /></div>

  return <>
    <div style={S.sectionHeader}>
      <h2 style={S.sectionTitle}>Issues</h2>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: T.textDim }}>{openCount} open, {resolvedCount} resolved</span>
        <div style={{ display: "flex", gap: "4px", marginLeft: "12px" }}>
          {["all", "open", "resolved"].map(f => <button key={f} onClick={() => setFilter(f)} style={{
            padding: "4px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", cursor: "pointer", border: "none",
            background: filter === f ? T.accent + "22" : T.bgDeep,
            color: filter === f ? T.accent : T.textDim
          }}>{f}</button>)}
        </div>
      </div>
    </div>
    {filtered.length === 0 ? <div style={S.placeholder}><AlertTriangle size={40} strokeWidth={1} /><div style={S.placeholderTitle}>{filter === "all" ? "No issues reported" : "No " + filter + " issues"}</div><div style={S.placeholderSub}>Issues reported by customers will appear here.</div></div>
    : <div style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "12px", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead><tr style={{ borderBottom: "1px solid " + T.border }}>
          {["Time", "Bay", "Type", "Function", "Contact", "Transfer Code", "Status", ""].map(h => <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: T.textDim }}>{h}</th>)}
        </tr></thead>
        <tbody>{filtered.map(issue => {
          const time = issue.reportedAt?.toDate ? issue.reportedAt.toDate() : null
          const isOpen = issue.status === "open"
          return <tr key={issue.id} onClick={() => setSelectedIssue(issue)} style={{ cursor: "pointer", borderBottom: "1px solid " + T.border }}>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "12px", color: T.textSecondary }}>{time ? formatDate(time) : "--"}</td>
            <td style={{ padding: "10px 14px", fontWeight: 600 }}>{getBayName(issue.bayId)}</td>
            <td style={{ padding: "10px 14px" }}><span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: T.amberDim, color: T.amber }}>{issueTypes[issue.type] || issue.type}</span></td>
            <td style={{ padding: "10px 14px", fontSize: "12px", color: T.textSecondary }}>{issue.affectedFunction != null ? fnName(issue.affectedFunction, bays.find(b => b.id === issue.bayId)) : "--"}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "11px", color: issue.callbackPhone ? T.accent : T.textDim }}>{issue.callbackPhone || "--"}</td>
            <td style={{ padding: "10px 14px", fontFamily: T.fontMono, fontSize: "12px", letterSpacing: "2px", color: issue.transferCode ? T.accent : T.textDim }}>{issue.transferCode || "--"}</td>
            <td style={{ padding: "10px 14px" }}><span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: isOpen ? T.amberDim : T.green + "20", color: isOpen ? T.amber : T.green }}>{isOpen ? "Open" : "Resolved"}</span></td>
            <td style={{ padding: "10px 14px" }}>{isOpen && <button onClick={() => resolveIssue(issue.id)} style={{ background: T.green + "18", color: T.green, border: "1px solid " + T.green + "44", borderRadius: "6px", padding: "4px 10px", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", cursor: "pointer" }}>RESOLVE</button>}</td>
          </tr>
        })}</tbody>
      </table>
    </div>}
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
// DEVICES TAB
// ═══════════════════════════════════════════
function thermalMeta(state) {
  switch (state) {
    case "critical": return { label: "Critical", color: T.red }
    case "serious":  return { label: "Hot", color: T.amber }
    case "fair":     return { label: "Elevated", color: T.accent }
    case "nominal":  return { label: "Normal", color: T.green }
    default:         return { label: "--", color: T.textDim }
  }
}

function powerMeta(state) {
  switch (state) {
    case "unplugged": return { label: "Unplugged", color: T.red }
    case "charging":  return { label: "Charging", color: T.green }
    case "full":      return { label: "Charged", color: T.green }
    default:          return { label: "--", color: T.textDim }
  }
}

function healthAlerts(d, threshold) {
  const out = []
  if (typeof threshold !== "number") threshold = 50
  if (d.relayConnected === false) out.push("Relay unreachable - bay cannot run washes")
  if (d.thermalState === "critical") out.push("Device overheating - check bay cooling")
  if (d.powerState === "unplugged") out.push("Running on battery - charger may have failed")
  else if (typeof d.batteryLevel === "number" && d.batteryLevel >= 0 && d.batteryLevel < threshold) out.push("Battery below " + threshold + "%")
  return out
}

function DevicesTab({ bays, batteryThreshold }) {
  const now = Date.now()
  const devices = bays.filter(b => b.deviceId).map(b => {
    const hb = b.lastHeartbeat?.toDate ? b.lastHeartbeat.toDate() : null
    const interval = typeof b.heartbeatInterval === "number" ? b.heartbeatInterval : 30
    const stale = hb ? (now - hb.getTime()) > (interval * 3000) : true
    return { ...b, heartbeatDate: hb, isOnline: !stale }
  })

  return <>
    <div style={S.sectionHeader}><h2 style={S.sectionTitle}>Devices</h2><div style={{ fontSize: "12px", color: T.textDim }}>{devices.filter(d => d.isOnline).length} of {devices.length} online</div></div>
    {devices.length === 0 ? <div style={S.placeholder}><Smartphone size={40} strokeWidth={1} /><div style={S.placeholderTitle}>No devices paired</div><div style={S.placeholderSub}>Pair an iPad to a bay from Bay Config to see it here.</div></div>
    : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
      {devices.map(d => <div key={d.id} style={{ background: T.bgPanel, border: "1px solid " + T.border, borderRadius: "12px", padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Smartphone size={20} color={d.isOnline ? T.green : T.textDim} />
            <div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: "15px", fontWeight: 600, color: T.textPrimary }}>{d.displayName || d.id}</div>
              <div style={{ fontSize: "11px", color: T.textDim }}>{d.deviceName || "iPad"}</div>
            </div>
          </div>
          <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "6px", background: d.isOnline ? T.green + "20" : T.red + "20", color: d.isOnline ? T.green : T.red }}>{d.isOnline ? "Online" : "Offline"}</span>
        </div>
            {d.isOnline && healthAlerts(d, batteryThreshold).length > 0 && <div style={{ marginBottom: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {healthAlerts(d, batteryThreshold).map((msg, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", background: T.red + "14", border: "1px solid " + T.red + "40", borderRadius: "8px", padding: "8px 10px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.red, flexShrink: 0 }} />
                <div style={{ fontSize: "11px", color: T.red, fontWeight: 600 }}>{msg}</div>
              </div>)}
            </div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
          <div><div style={{ color: T.textDim, fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>DEVICE ID</div><div style={{ fontFamily: T.fontMono, fontSize: "10px", color: T.textSecondary, wordBreak: "break-all" }}>{d.deviceId?.substring(0, 16) || "--"}...</div></div>
          <div><div style={{ color: T.textDim, fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>LAST HEARTBEAT</div><div style={{ fontFamily: T.fontMono, fontSize: "11px", color: d.isOnline ? T.green : T.red }}>{d.heartbeatDate ? formatDate(d.heartbeatDate) : "Never"}</div></div>
          <div><div style={{ color: T.textDim, fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>RELAY HOST</div><div style={{ fontFamily: T.fontMono, fontSize: "11px", color: T.accent }}>{d.relayHost || "--"}</div></div>
          <div><div style={{ color: T.textDim, fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>RELAY</div><div style={{ fontFamily: T.fontMono, fontSize: "11px", color: !d.isOnline ? T.textDim : d.relayConnected === false ? T.amber : d.relayConnected === true ? T.green : T.textDim }}>{!d.isOnline ? "--" : d.relayConnected === false ? "Unreachable" : d.relayConnected === true ? "Connected" : "Unknown"}</div></div>
          <div><div style={{ color: T.textDim, fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>SESSION</div><div style={{ fontFamily: T.fontMono, fontSize: "11px", color: d.isOnline && d.status === "active" ? T.accent : T.textSecondary }}>{d.isOnline ? (d.status || "--") : "--"}</div></div>
              <div><div style={{ color: T.textDim, fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>THERMAL</div><div style={{ fontFamily: T.fontMono, fontSize: "11px", color: d.isOnline ? thermalMeta(d.thermalState).color : T.textDim }}>{d.isOnline ? thermalMeta(d.thermalState).label : "--"}</div></div>
              <div><div style={{ color: T.textDim, fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>POWER</div><div style={{ fontFamily: T.fontMono, fontSize: "11px", color: d.isOnline ? powerMeta(d.powerState).color : T.textDim }}>{d.isOnline ? powerMeta(d.powerState).label : "--"}{d.isOnline && typeof d.batteryLevel === "number" && d.batteryLevel >= 0 && <span style={{ color: d.batteryLevel < (typeof batteryThreshold === "number" ? batteryThreshold : 50) ? T.amber : T.textSecondary }}>{" " + d.batteryLevel + "%"}</span>}</div></div>
          {d.streamUrl && <div style={{ gridColumn: "1 / -1" }}><div style={{ color: T.textDim, fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>STREAM URL</div><div style={{ fontFamily: T.fontMono, fontSize: "10px", color: T.accent, wordBreak: "break-all" }}>{d.streamUrl}</div></div>}
        </div>
      </div>)}
    </div>}
  </>
}


// ═══════════════════════════════════════════
// PAYMENTS TAB (Stripe Connect placeholder)
// ═══════════════════════════════════════════
function PaymentsTab({ ownerId, bays }) {
  const [rawSessions, setSessions] = useState([])
  const sessions = rawSessions.filter(x => bays.some(b => b.id === x.bayId))
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

function AlertsTab({ ownerId }) {
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

  const u = (field, value) => setConfig(prev => ({ ...prev, [field]: value }))

  const save = async () => {
    if (!selectedId || !config) return
    setSaving(true)
    try {
      const { id, ...data } = config
      data.updatedAt = serverTimestamp()
      await updateDoc(doc(db, "washboardLocations", selectedId), data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error("Save failed:", e) }
    setSaving(false)
  }

  const CONDITIONS = [
    { key: "issueReported", label: "Customer reports an issue", desc: "Triggered from the kiosk help screen" },
    { key: "relayDown", label: "Relay unreachable", desc: "Bay cannot operate - taken out of service" },
    { key: "bayOffline", label: "Bay offline", desc: "No heartbeat from the kiosk" },
    { key: "powerUnplugged", label: "Power disconnected", desc: "iPad running on battery" },
    { key: "batteryLow", label: "Battery below threshold", desc: "Charger may be failing" },
    { key: "thermalCritical", label: "Device overheating", desc: "Check bay cooling" },
  ]

  const DEFAULTS = {
    issueReported: { sms: true, email: false },
    relayDown: { sms: true, email: false },
    bayOffline: { sms: true, email: false },
    powerUnplugged: { sms: true, email: false },
    batteryLow: { sms: false, email: true },
    thermalCritical: { sms: true, email: false },
  }

  const settingFor = key => (config?.alertSettings || {})[key] || DEFAULTS[key] || { sms: false, email: false }

  const toggle = (key, channel) => {
    const current = settingFor(key)
    u("alertSettings", { ...(config.alertSettings || DEFAULTS), [key]: { ...current, [channel]: !current[channel] } })
  }

  const Toggle = ({ on, onClick }) => <button onClick={onClick} style={{
    width: "38px", height: "22px", borderRadius: "11px", border: "none", cursor: "pointer", position: "relative",
    background: on ? T.accent : T.border, transition: "background 0.15s"
  }}><div style={{
    position: "absolute", top: "3px", left: on ? "19px" : "3px", width: "16px", height: "16px",
    borderRadius: "50%", background: on ? T.bgDeep : T.textDim, transition: "left 0.15s"
  }} /></button>

  if (loading) return <div style={S.placeholder}><Loader size={24} style={{ animation: "spin 1s linear infinite" }} /></div>

  return <>
    <div style={S.sectionHeader}><h2 style={S.sectionTitle}>Alerts</h2></div>

    {locations.length === 0 ? <div style={S.placeholder}><Bell size={40} strokeWidth={1} /><div style={S.placeholderTitle}>No locations</div><div style={S.placeholderSub}>Add a location first to configure alerts.</div></div>
    : <>
      {locations.length > 1 && <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {locations.map(loc => <button key={loc.id} onClick={() => { setSelectedId(loc.id); setConfig({ ...loc }) }} style={{
          padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: "none",
          background: selectedId === loc.id ? T.accent + "22" : T.bgPanel,
          color: selectedId === loc.id ? T.accent : T.textDim
        }}>{loc.name || "Unnamed"}</button>)}
      </div>}

      {config && <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Text recipients */}
        <div style={{ ...CS.section, padding: "20px" }}>
          <h3 style={CS.sectionTitle}><Smartphone size={16} /> Text Recipients</h3>
          <div style={{ ...CS.hint, marginTop: "4px", marginBottom: "14px" }}>Up to five numbers. Tap VERIFY to send the confirmation text that enables alerts for a number.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(config.alertPhones || [""]).map((phone, i) => <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...CS.label, fontSize: "9px" }}>Phone Number {(config.alertPhones || [""]).length > 1 ? (i + 1) : ""}</label>
                <input style={{ ...CS.inputMono, color: T.accent, background: T.bgDeep }} value={phone} onChange={e => {
                  const phones = [...(config.alertPhones || [""])]
                  phones[i] = e.target.value
                  u("alertPhones", phones)
                }} placeholder="(555) 555-1234" />
              </div>
              <button onClick={async () => {
                if (!phone || phone.replace(/\D/g, "").length < 10) { alert("Enter a valid 10-digit phone number"); return }
                const dest = phone.startsWith("+") ? phone : "+1" + phone.replace(/\D/g, "")
                try {
                  const msg = (config.name || "WashBoard") + " - WashBoard alerts are now enabled for this number. You will receive a text when an alert condition is triggered at this location.\n\nReply STOP to opt out."
                  const sendAlert = httpsCallable(functions, "sendAlertSms")
                  const result = await sendAlert({ phone: dest, message: msg })
                  if (result.data?.success) alert("Confirmation text sent to " + dest)
                  else alert("Failed to send confirmation text")
                } catch (e) { alert("Error: " + e.message) }
              }} style={{ background: T.blue + "18", color: T.blue, border: "1px solid " + T.blue + "44", borderRadius: "6px", padding: "8px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", cursor: "pointer", whiteSpace: "nowrap", marginTop: "16px" }}>VERIFY</button>
              {(config.alertPhones || [""]).length > 1 && <button onClick={() => {
                const phones = [...(config.alertPhones || [""])]
                phones.splice(i, 1)
                u("alertPhones", phones)
              }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, padding: "4px", marginTop: "16px" }}><Trash2 size={14} /></button>}
            </div>)}
          </div>
          {(config.alertPhones || [""]).length < 5 && <button onClick={() => {
            const phones = [...(config.alertPhones || [""])]
            phones.push("")
            u("alertPhones", phones)
          }} style={{ marginTop: "8px", background: "none", border: "1px dashed " + T.border, borderRadius: "8px", padding: "8px 16px", fontSize: "11px", color: T.textDim, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><Plus size={12} /> Add another number</button>}

          <div style={{ marginTop: "20px", padding: "16px", background: T.bgDeep, borderRadius: "10px", border: "1px solid " + T.border }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer" }} onClick={() => u("smsConsent", !config.smsConsent)}>
              <div style={{ width: "22px", height: "22px", borderRadius: "4px", border: "2px solid " + (config.smsConsent ? T.accent : T.border), background: config.smsConsent ? T.accent + "22" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                {config.smsConsent && <Check size={14} color={T.accent} />}
              </div>
              <div style={{ fontSize: "12px", color: T.textSecondary, lineHeight: 1.7 }}>
                I agree to receive SMS alert notifications from <b style={{ color: T.textPrimary }}>WashBoard</b> at the phone number(s) listed above.
              </div>
            </div>
            <div style={{ marginTop: "12px", marginLeft: "34px", fontSize: "11px", color: T.textDim, lineHeight: 1.8 }}>
              By providing your phone number(s) and checking this box, you agree to receive SMS alert notifications from WashBoard. Message frequency may vary. Standard Message and Data Rates may apply. Reply STOP to opt out. Reply HELP for help. We will not share mobile information with third parties for promotional or marketing purposes. Consent is not a condition of purchase.
              <br /><br />
              <a href="https://washlevel.com/sms-terms" target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>SMS Terms and Conditions</a>
              {" "} | {" "}
              <a href="https://washlevel.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>Privacy Policy</a>
            </div>
          </div>
        </div>

        {/* Email recipients */}
        <div style={{ ...CS.section, padding: "20px" }}>
          <h3 style={CS.sectionTitle}><Mail size={16} /> Email Recipients</h3>
          <div style={{ ...CS.hint, marginTop: "4px", marginBottom: "14px" }}>Alerts sent from alerts@washboard.washlevel.com. No confirmation step required.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(config.alertEmails || [""]).map((email, i) => <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...CS.label, fontSize: "9px" }}>Email Address {(config.alertEmails || [""]).length > 1 ? (i + 1) : ""}</label>
                <input style={{ ...CS.input, color: T.textPrimary, background: T.bgDeep }} value={email} onChange={e => {
                  const emails = [...(config.alertEmails || [""])]
                  emails[i] = e.target.value
                  u("alertEmails", emails)
                }} placeholder="you@example.com" />
              </div>
              {(config.alertEmails || [""]).length > 1 && <button onClick={() => {
                const emails = [...(config.alertEmails || [""])]
                emails.splice(i, 1)
                u("alertEmails", emails)
              }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, padding: "4px", marginTop: "16px" }}><Trash2 size={14} /></button>}
            </div>)}
          </div>
          {(config.alertEmails || [""]).length < 5 && <button onClick={() => {
            const emails = [...(config.alertEmails || [""])]
            emails.push("")
            u("alertEmails", emails)
          }} style={{ marginTop: "8px", background: "none", border: "1px dashed " + T.border, borderRadius: "8px", padding: "8px 16px", fontSize: "11px", color: T.textDim, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><Plus size={12} /> Add another address</button>}
        </div>

        {/* Conditions */}
        <div style={{ ...CS.section, padding: "20px" }}>
          <h3 style={CS.sectionTitle}><Bell size={16} /> Alert Conditions</h3>
          <div style={{ ...CS.hint, marginTop: "4px", marginBottom: "14px" }}>Choose how you want to be notified for each condition. Repeat alerts are suppressed until the condition clears.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px", gap: "0", alignItems: "center" }}>
            <div />
            <div style={{ ...CS.label, textAlign: "center", marginBottom: "8px" }}>TEXT</div>
            <div style={{ ...CS.label, textAlign: "center", marginBottom: "8px" }}>EMAIL</div>
            {CONDITIONS.map((c, i) => <div key={c.key} style={{ display: "contents" }}>
              <div style={{ padding: "12px 0", borderTop: "1px solid " + T.border }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: T.textPrimary }}>{c.label}</div>
                <div style={{ fontSize: "11px", color: T.textDim, marginTop: "2px" }}>{c.desc}</div>
              </div>
              <div style={{ padding: "12px 0", borderTop: "1px solid " + T.border, display: "flex", justifyContent: "center" }}>
                <Toggle on={settingFor(c.key).sms} onClick={() => toggle(c.key, "sms")} />
              </div>
              <div style={{ padding: "12px 0", borderTop: "1px solid " + T.border, display: "flex", justifyContent: "center" }}>
                <Toggle on={settingFor(c.key).email} onClick={() => toggle(c.key, "email")} />
              </div>
            </div>)}
          </div>
        </div>

        {/* Thresholds */}
        <div style={{ ...CS.section, padding: "20px" }}>
          <h3 style={CS.sectionTitle}><Settings size={16} /> Thresholds</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
            <div>
              <label style={CS.label}>Battery Alert Threshold (%)</label>
              <input type="number" min="5" max="95" style={{ ...CS.inputMono, color: T.accent, background: T.bgDeep }}
                value={config.batteryAlertThreshold ?? 50}
                onChange={e => u("batteryAlertThreshold", parseInt(e.target.value) || 50)} />
              <div style={{ ...CS.hint, marginTop: "6px" }}>Alert when an iPad drops below this level</div>
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving} style={{ background: saving ? T.bgPanel : T.accent, color: saving ? T.textDim : T.bgDeep, border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, letterSpacing: "2px", cursor: saving ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          {saving ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> SAVING...</> : saved ? <><Check size={16} /> SAVED</> : <><Save size={16} /> SAVE ALERTS</>}
        </button>
      </div>}
    </>}
  </>
}


function PlaceholderTab({ icon: Icon, label }) {
  return <div style={S.placeholder}><Icon size={40} strokeWidth={1} /><div style={S.placeholderTitle}>{label}</div><div style={S.placeholderSub}>Under construction.</div></div>
}

// ═══════════════════════════════════════════
// APP
// ═══════════════════════════════════════════

const TAB_LABELS = { overview: "Bay Overview", config: "Bay Config", sessions: "Sessions", issues: "Issues", codes: "Codes", devices: "Devices", payments: "Payments", staff: "Staff Access", location: "Location", alerts: "Alerts", billing: "Billing" }
const TAB_ICONS = { config: Settings, sessions: BarChart3, issues: AlertTriangle, codes: KeyRound, devices: Smartphone, payments: CreditCard, staff: Users, location: Building2, alerts: Bell, billing: Receipt }

export default function App() {
  const [user, setUser] = useState(null), [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(() => window.location.hash.replace("#", "") || "overview"), [bays, setBays] = useState([])
  const [wbLocations, setWbLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState(() => localStorage.getItem("wb_selectedLocation") || "")
  useEffect(() => { window.location.hash = activeTab }, [activeTab])
  useEffect(() => { const onHash = () => { const h = window.location.hash.replace("#", ""); if (h && h !== activeTab) setActiveTab(h) }; window.addEventListener("hashchange", onHash); return () => window.removeEventListener("hashchange", onHash) }, [activeTab])
  // Raw owner-wide docs. Stats are derived per location in render so switching
  // locations is instant and needs no re-subscription.
  const [todaySessionDocs, setTodaySessionDocs] = useState([])
  const [openIssueDocs, setOpenIssueDocs] = useState([])

  useEffect(() => { const u = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false) }); return () => u() }, [])

  // Bays listener
  useEffect(() => {
    if (!user) { setBays([]); return }
    const q = query(collection(db, "bays"), where("ownerId", "==", user.uid))
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.displayName || a.id).localeCompare(b.displayName || b.id))
      setBays(list)
    })
    return () => unsub()
  }, [user])

  // Today's stats from sessions
  useEffect(() => {
    if (!user) return
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const q = query(collection(db, "sessions"), where("ownerId", "==", user.uid), where("startedAt", ">=", Timestamp.fromDate(today)))
    const unsub = onSnapshot(q, snap => {
      setTodaySessionDocs(snap.docs.map(d => d.data()))
    })
    return () => unsub()
  }, [user])

  // Issues count
  useEffect(() => {
    if (!user) return
    const q = query(collection(db, "issues"), where("ownerId", "==", user.uid), where("status", "==", "open"))
    const unsub = onSnapshot(q, snap => { setOpenIssueDocs(snap.docs.map(d => d.data())) })
    return () => unsub()
  }, [user])
  // WashBoard Locations
  useEffect(() => {
    if (!user) return
    const q = query(collection(db, "washboardLocations"), where("ownerId", "==", user.uid))
    const unsub = onSnapshot(q, snap => {
      const locs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setWbLocations(locs)
      if (locs.length > 0 && !selectedLocationId) { setSelectedLocationId(locs[0].id); localStorage.setItem("wb_selectedLocation", locs[0].id) }
    })
    return () => unsub()
  }, [user])

  // effectiveStatus is only evaluated on render. A dead iPad sends no more
  // snapshots, so without a tick its card would stay green indefinitely.
  const [, setStatusTick] = useState(0)
  useEffect(() => { const iv = setInterval(() => setStatusTick(t => t + 1), 15000); return () => clearInterval(iv) }, [])

  const handleSignOut = async () => { try { await signOut(auth) } catch (e) {} }

  if (authLoading) return <><GlobalStyle /><div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bgDeep, fontFamily: T.fontBody }}><div style={{ textAlign: "center" }}><h1 style={{ fontFamily: T.fontDisplay, fontSize: "24px", fontWeight: 700, color: T.accent, margin: "0 0 12px 0" }}>WashBoard</h1><div style={{ fontSize: "12px", color: T.textDim }}>Loading...</div></div></div></>
  if (!user) return <LoginScreen />

  // A stale id in localStorage (deleted location) must not blank the dashboard.
  const activeLocationId = wbLocations.some(l => l.id === selectedLocationId) ? selectedLocationId : ""
  // Bays with no real location stay visible everywhere so they are not lost;
  // saving one in Bay Config assigns it to the selected location.
  const locationBays = activeLocationId
    ? bays.filter(b => b.locationId === activeLocationId || !b.locationId || b.locationId === "default")
    : bays
  const activeBays = locationBays.filter(b => { const s = effectiveStatus(b); return s === "active" || s === "issue" }).length
  // Scope by which bay a doc belongs to, not the locationId copied onto it.
  // Older sessions and issues carry "" or "default" for location; bayId is
  // always present, and history follows the bay to its current location.
  const locationBayIds = new Set(locationBays.map(b => b.id))
  const scopedToday = todaySessionDocs.filter(s => locationBayIds.has(s.bayId))
  const todayStats = {
    revenue: scopedToday.reduce((sum, s) => sum + (s.totalCharge || 0), 0),
    sessions: scopedToday.length,
    issues: openIssueDocs.filter(x => locationBayIds.has(x.bayId)).length,
  }

  return <><GlobalStyle /><div style={S.app}>
    <Sidebar activeTab={activeTab} onTabChange={setActiveTab} user={user} onSignOut={handleSignOut} />
    <Topbar tabLabel={TAB_LABELS[activeTab]} todayRevenue={todayStats.revenue} todaySessions={todayStats.sessions} activeBays={activeBays} totalBays={locationBays.length} locations={wbLocations} selectedLocationId={selectedLocationId} onLocationChange={id => { setSelectedLocationId(id); localStorage.setItem("wb_selectedLocation", id) }} />
    <div style={S.main}>
      {activeTab === "overview" && <BayOverview bays={locationBays} todayStats={todayStats} onNavigateConfig={() => setActiveTab("config")} onNavigateSessions={() => setActiveTab("sessions")} onNavigateIssues={() => setActiveTab("issues")} onNavigateDevices={() => setActiveTab("devices")} />}
      {activeTab === "config" && <BayConfigTab bays={locationBays} ownerId={user.uid} locationId={activeLocationId} />}
      {activeTab === "sessions" && <SessionsTab ownerId={user.uid} bays={locationBays} />}
      {activeTab === "codes" && <CodesTab ownerId={user.uid} />}
      {activeTab === "issues" && <IssuesTab ownerId={user.uid} bays={locationBays} />}
      {activeTab === "devices" && <DevicesTab bays={locationBays} batteryThreshold={wbLocations.find(l => l.id === selectedLocationId)?.batteryAlertThreshold} />}
      {activeTab === "payments" && <PaymentsTab ownerId={user.uid} bays={locationBays} />}
      {activeTab === "staff" && <StaffTab ownerId={user.uid} />}
        {activeTab === "alerts" && <AlertsTab ownerId={user.uid} />}
      {activeTab === "location" && <LocationTab ownerId={user.uid} bays={bays} />}
      {activeTab === "billing" && <BillingTab bays={bays} />}
      {!["overview", "config", "sessions", "codes", "issues", "devices", "payments", "staff", "location", "alerts", "billing"].includes(activeTab) && <PlaceholderTab icon={TAB_ICONS[activeTab] || Construction} label={TAB_LABELS[activeTab]} />}
    </div>
  </div></>
}
