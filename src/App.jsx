// Paste into App.tsx, then in Dependencies panel add: firebase (10.8.0)

import { useState, useEffect, createContext, useContext, Component } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
getAuth,
signInWithEmailAndPassword,
signOut,
onAuthStateChanged,
} from "firebase/auth";
import {
getFirestore,
collection,
doc,
setDoc,
getDoc,
getDocs,
updateDoc,
onSnapshot,
query,
where,
} from "firebase/firestore";

const firebaseConfig = {
apiKey: "AIzaSyDzPJI6OzB4KFpRgXv1uv3jNUEK7dr8oMQ",
authDomain: "washlevel-c16d9.firebaseapp.com",
projectId: "washlevel-c16d9",
storageBucket: "washlevel-c16d9.firebasestorage.app",
messagingSenderId: "756159059921",
appId: "1:756159059921:web:9c9f2948e4bdd21945b2f0",
};

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const LOCATIONS = [
{ id: "loc1", name: "North Station", address: "1240 N. Highway Blvd" },
{ id: "loc2", name: "Downtown Express", address: "88 Central Ave" },
{ id: "loc3", name: "Southside Wash", address: "5500 South Park Dr" },
];

const SEED_TASKS = {
loc1: [
{ id: "t1", title: "Restock soap dispensers", category: "supplies", priority: "high", status: "pending", assignedRole: "attendant", due: "09:00 AM", shift: "opening" },
{ id: "t2", title: "Inspect brush rollers", category: "equipment", priority: "high", status: "in-progress", assignedRole: "technician", due: "10:00 AM", shift: "opening" },
{ id: "t3", title: "Clean vacuum stations 1-4", category: "cleaning", priority: "medium", status: "pending", assignedRole: "attendant", due: "11:00 AM", shift: "midday" },
{ id: "t4", title: "Check chemical levels - Bay A", category: "chemicals", priority: "high", status: "done", assignedRole: "technician", due: "08:00 AM", shift: "opening" },
{ id: "t5", title: "Wipe down pay kiosks", category: "cleaning", priority: "low", status: "pending", assignedRole: "attendant", due: "12:00 PM", shift: "midday" },
{ id: "t6", title: "Test conveyor belt tension", category: "equipment", priority: "medium", status: "pending", assignedRole: "technician", due: "02:00 PM", shift: "afternoon" },
{ id: "t7", title: "Water softener salt check", category: "chemicals", priority: "medium", status: "pending", assignedRole: "technician", due: "03:00 PM", shift: "afternoon" },
{ id: "t8", title: "Sweep & squeegee entrance", category: "cleaning", priority: "low", status: "done", assignedRole: "attendant", due: "08:30 AM", shift: "opening" },
],
loc2: [
{ id: "t9", title: "Fill rinse aid tank", category: "chemicals", priority: "high", status: "in-progress", assignedRole: "attendant", due: "09:30 AM", shift: "opening" },
{ id: "t10", title: "Sweep entrance area", category: "cleaning", priority: "low", status: "done", assignedRole: "attendant", due: "08:00 AM", shift: "opening" },
{ id: "t11", title: "Lubricate door tracks", category: "equipment", priority: "medium", status: "pending", assignedRole: "attendant", due: "01:00 PM", shift: "afternoon" },
{ id: "t12", title: "Check nozzle spray pattern", category: "equipment", priority: "high", status: "pending", assignedRole: "attendant", due: "10:00 AM", shift: "opening" },
],
loc3: [
{ id: "t13", title: "Replace air freshener units", category: "supplies", priority: "medium", status: "pending", assignedRole: "attendant", due: "10:00 AM", shift: "opening" },
{ id: "t14", title: "Inspect undercarriage nozzles", category: "equipment", priority: "high", status: "pending", assignedRole: "attendant", due: "09:00 AM", shift: "opening" },
{ id: "t15", title: "Clean drainage grates", category: "cleaning", priority: "medium", status: "done", assignedRole: "attendant", due: "07:30 AM", shift: "opening" },
{ id: "t16", title: "Restock paper towels & trash", category: "supplies", priority: "low", status: "pending", assignedRole: "attendant", due: "11:00 AM", shift: "midday" },
],
};

const SEED_SENSORS = {
loc1: { soapLevel: 62, rinseAid: 74, waxLevel: 55, waterPressure: 87, tempF: 68, conveyorRPM: 24, carsToday: 142 },
loc2: { soapLevel: 28, rinseAid: 18, waxLevel: 80, waterPressure: 91, tempF: 71, conveyorRPM: 22, carsToday: 98 },
loc3: { soapLevel: 85, rinseAid: 92, waxLevel: 66, waterPressure: 79, tempF: 66, conveyorRPM: 25, carsToday: 73 },
};

const SEED_EQUIPMENT = {
loc1: [
{ id: "e1", name: "Conveyor Belt", status: "ok", lastService: "Mar 15", nextService: "Apr 15" },
{ id: "e2", name: "Brush Rollers", status: "warning", lastService: "Mar 01", nextService: "Apr 01" },
{ id: "e3", name: "High-Pressure Arch", status: "ok", lastService: "Mar 20", nextService: "Apr 20" },
{ id: "e4", name: "Dryer Blowers", status: "ok", lastService: "Mar 10", nextService: "Apr 10" },
{ id: "e5", name: "Chemical Injectors", status: "ok", lastService: "Mar 22", nextService: "Apr 22" },
],
loc2: [
{ id: "e6", name: "Conveyor Belt", status: "ok", lastService: "Mar 18", nextService: "Apr 18" },
{ id: "e7", name: "Brush Rollers", status: "ok", lastService: "Mar 12", nextService: "Apr 12" },
{ id: "e8", name: "High-Pressure Arch", status: "error", lastService: "Mar 05", nextService: "Overdue" },
{ id: "e9", name: "Dryer Blowers", status: "ok", lastService: "Mar 17", nextService: "Apr 17" },
],
loc3: [
{ id: "e10", name: "Conveyor Belt", status: "ok", lastService: "Mar 21", nextService: "Apr 21" },
{ id: "e11", name: "Brush Rollers", status: "ok", lastService: "Mar 14", nextService: "Apr 14" },
{ id: "e12", name: "Undercarriage Wash", status: "warning", lastService: "Feb 28", nextService: "Mar 28" },
{ id: "e13", name: "Chemical Injectors", status: "ok", lastService: "Mar 19", nextService: "Apr 19" },
],
};

const DEMO_PROFILES = {
"manager@washlevel.com": { name: "Alex Rivera", role: "manager", locationId: null, color: "#6366f1" },
"jordan@washlevel.com": { name: "Jordan Lee", role: "attendant", locationId: "loc1", color: "#0ea5e9" },
"casey@washlevel.com": { name: "Casey Kim", role: "technician", locationId: "loc1", color: "#f59e0b" },
"sam@washlevel.com": { name: "Sam Torres", role: "attendant", locationId: "loc2", color: "#10b981" },
"morgan@washlevel.com": { name: "Morgan Blake", role: "attendant", locationId: "loc3", color: "#ec4899" },
};

let seeding = false;
async function seedDatabase() {
if (seeding) return;
seeding = true;
try {
const snap = await getDocs(collection(db, "locations"));
if (!snap.empty) return;
for (const loc of LOCATIONS) {
await setDoc(doc(db, "locations", loc.id), loc);
for (const task of SEED_TASKS[loc.id] || []) {
await setDoc(doc(db, "locations", loc.id, "tasks", task.id), {
...task, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});
}
await setDoc(doc(db, "sensors", loc.id), { ...SEED_SENSORS[loc.id], updatedAt: new Date().toISOString() });
for (const eq of SEED_EQUIPMENT[loc.id] || []) {
await setDoc(doc(db, "locations", loc.id, "equipment", eq.id), eq);
}
}
} catch (e) {
console.error("Seed error:", e);
} finally {
seeding = false;
}
}

const CAT = { supplies: { bg: "#fef3c7", color: "#b45309" }, equipment: { bg: "#dbeafe", color: "#1d4ed8" }, cleaning: { bg: "#d1fae5", color: "#065f46" }, chemicals: { bg: "#ede9fe", color: "#5b21b6" } };
const PRI = { high: { bg: "#fee2e2", color: "#991b1b" }, medium: { bg: "#fef3c7", color: "#92400e" }, low: { bg: "#f3f4f6", color: "#6b7280" } };
const STS = { pending: { bg: "#f3f4f6", color: "#6b7280", dot: "#9ca3af", label: "Pending" }, "in-progress": { bg: "#fef3c7", color: "#d97706", dot: "#f59e0b", label: "In Progress" }, "on-hold": { bg: "#fce7f3", color: "#be185d", dot: "#ec4899", label: "On Hold" }, done: { bg: "#d1fae5", color: "#059669", dot: "#10b981", label: "Done" } };
const EQS = { ok: { bg: "#d1fae5", color: "#059669", icon: "?", label: "OK" }, warning: { bg: "#fef3c7", color: "#d97706", icon: "!", label: "Warning" }, error: { bg: "#fee2e2", color: "#dc2626", icon: "?", label: "Alert" } };

//  RESPONSIVE HOOK
function useIsMobile() {
const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
useEffect(() => {
const handler = () => setIsMobile(window.innerWidth < 768);
window.addEventListener("resize", handler);
return () => window.removeEventListener("resize", handler);
}, []);
return isMobile;
}

const AuthCtx = createContext(null);

function AuthProvider({ children }) {
const [user, setUser] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
const unsub = onAuthStateChanged(auth, async (fu) => {
if (fu) {
let profile = DEMO_PROFILES[fu.email] || { name: fu.email, role: "attendant", locationId: "loc1", color: "#6366f1" };
try {
const snap = await getDoc(doc(db, "users", fu.uid));
if (snap.exists()) profile = snap.data();
else await setDoc(doc(db, "users", fu.uid), { ...profile, email: fu.email });
} catch (e) {}
setUser({ uid: fu.uid, email: fu.email, ...profile });
} else {
setUser(null);
}
setLoading(false);
});
return unsub;
}, []);

const refreshUser = async () => {
    if (!auth.currentUser) return;
    const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (snap.exists()) setUser(u => ({ ...u, ...snap.data() }));
  };

return (
<AuthCtx.Provider value={{
user, loading,
login: (e, p) => signInWithEmailAndPassword(auth, e, p),
logout: () => signOut(auth),
signup: (e, p) => createUserWithEmailAndPassword(auth, e, p),
refreshUser,
}}>
{!loading && children}
</AuthCtx.Provider>
);
}

const useAuth = () => useContext(AuthCtx);

const Pill = ({ label, bg, color }) => (
<span style={{ background: bg, color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, textTransform: "capitalize", whiteSpace: "nowrap" }}>{label}</span>
);

const Bar = ({ value, color = "#3b82f6", height = 6 }) => {
const c = value < 25 ? "#ef4444" : value < 45 ? "#f59e0b" : color;
return (
<div style={{ height, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
<div style={{ height: "100%", width: `${Math.min(value || 0, 100)}%`, background: c, borderRadius: 99 }} />
</div>
);
};

const Avatar = ({ name = "", color = "#6366f1", size = 32 }) => {
const i = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
return <div style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff", fontWeight: 700, fontSize: size * 0.35, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i}</div>;
};

const StatCard = ({ icon, label, value, sub, accent = "#3b82f6", alert = false }) => (

  <div style={{ background: "#fff", border: alert ? "1.5px solid #fca5a5" : "1px solid #e5e7eb", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
    <div style={{ width: 42, height: 42, borderRadius: 10, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: alert ? "#dc2626" : "#111827", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

const Spinner = () => (

  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
    <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTop: "3px solid #1a3352", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

function Login() {
  const { login, signup } = useAuth();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [bizName, setBizName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) { setError("Enter your email address first."); return; }
    setResetLoading(true); setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch(e) {
      setError("Could not send reset email. Check the address and try again.");
    }
    setResetLoading(false);
  };

  const handleLogin = async () => {
    if (!email || !password) return;
    setError(""); setLoading(true);
    try {
      await login(email, password);
    } catch(e) {
      setError("Invalid email or password.");
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!name || !email || !password || !bizName) { setError("Please fill in all fields."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError(""); setLoading(true);
    try {
      const cred = await signup(email, password);
      const uid = cred.user.uid;
      const inviteSnap = await getDocs(query(collection(db, "invites"), where("email", "==", email.toLowerCase()), where("status", "==", "pending")));
      if (!inviteSnap.empty) {
        const invite = inviteSnap.docs[0].data();
        await setDoc(doc(db, "users", uid), {
          uid, email, name, role: invite.role || "attendant",
          ownerId: invite.ownerId, locationId: invite.locationId || null,
          allowedLocations: invite.allowedLocations || [],
          color: "#0ea5e9", createdAt: new Date().toISOString(), isTeamMember: true
        });
        await updateDoc(inviteSnap.docs[0].ref, { status: "accepted", acceptedAt: new Date().toISOString() });
      } else {
        const locId = "loc_" + uid.slice(0, 8);
        await setDoc(doc(db, "locations", locId), {
          id: locId, name: bizName, address: "", zipCode: "", ownerId: uid,
          createdAt: new Date().toISOString()
        });
        await setDoc(doc(db, "users", uid), {
          uid, email, name, role: "manager", locationId: locId,
          bizName, color: "#6366f1", createdAt: new Date().toISOString()
        });
      }
    } catch(e) {
      setError(e.message?.includes("email-already-in-use") ? "An account with this email already exists." : "Signup failed. Please try again.");
    }
    setLoading(false);
  };

  const inp = { width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 9, fontSize: 14, outline: "none", boxSizing: "border-box", background: "#fafafa" };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 440, padding: "0 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#1a3352", borderRadius: 14, padding: "10px 22px" }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>WashLevel</span>
            <span style={{ background: "#0ea5e9", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "2px 6px" }}>PRO</span>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>Car Wash Operations Platform</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
            {["login","signup"].map(t => (
              <button key={t} onClick={() => { setTab(t); setError(""); }}
                style={{ flex: 1, padding: "14px 0", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
                  background: tab === t ? "#fff" : "#f9fafb",
                  color: tab === t ? "#1a3352" : "#9ca3af",
                  borderBottom: tab === t ? "2px solid #1a3352" : "2px solid transparent" }}>
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>
          <div style={{ padding: 28 }}>
            {tab === "login" ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com" style={inp} onKeyDown={e => e.key === "Enter" && handleLogin()} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Password</label>
                  <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="password" style={inp} onKeyDown={e => e.key === "Enter" && handleLogin()} />
                </div>
                {error && <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{error}</div>}
                <button onClick={handleLogin} disabled={loading} style={{ width: "100%", background: "#1a3352", color: "#fff", border: "none", borderRadius: 9, padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  {loading ? "Signing in..." : "Sign In"}
                </button>
                {resetSent && <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginTop: 12 }}>Password reset email sent! Check your inbox.</div>}
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <span onClick={handleForgotPassword} style={{ fontSize: 13, color: "#6b7280", cursor: "pointer", textDecoration: "underline" }}>
                    {resetLoading ? "Sending..." : "Forgot password?"}
                  </span>
                </div>
                <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: "#9ca3af" }}>
                  No account?{" "}
                  <span onClick={() => setTab("signup")} style={{ color: "#1a3352", fontWeight: 600, cursor: "pointer" }}>Create one free</span>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Your Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Alex Rivera" style={inp} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Car Wash Name</label>
                  <input value={bizName} onChange={e => setBizName(e.target.value)} placeholder="e.g. Sunny Car Wash" style={inp} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com" style={inp} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Password</label>
                  <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="At least 6 characters" style={inp} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Confirm Password</label>
                  <input value={confirm} onChange={e => setConfirm(e.target.value)} type="password" placeholder="Repeat password" style={inp} onKeyDown={e => e.key === "Enter" && handleSignup()} />
                </div>
                {error && <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{error}</div>}
                <button onClick={handleSignup} disabled={loading} style={{ width: "100%", background: "#1a3352", color: "#fff", border: "none", borderRadius: 9, padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  {loading ? "Creating account..." : "Create Account"}
                </button>
                <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#9ca3af" }}>By creating an account you agree to our terms of service.</div>
                <div style={{ textAlign: "center", marginTop: 8, fontSize: 13, color: "#9ca3af" }}>
                  Already have an account?{" "}
                  <span onClick={() => setTab("login")} style={{ color: "#1a3352", fontWeight: 600, cursor: "pointer" }}>Sign in</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ locations, view, setView, locId, setLocId, open, onClose }) {
const { user, logout } = useAuth();
const isMobile = useIsMobile();
const isManager = user?.role === "manager";
const locs = isManager ? locations : locations.filter(l => l.id === user?.locationId);
const nav = [
{ id: "overview",   label: "Overview"   },
    ...(isManager ? [{ id: "alerts", label: "Alerts" }] : []),
{ id: "calendar",   label: "Calendar"   },
    { id: "carcounts",  label: "Car Counts" },
{ id: "timeclock",  label: "Time Clock" },
{ id: "tasks",      label: "Tasks"      },
{ id: "inventory",  label: "Inventory"  },
{ id: "equipment",  label: "Equipment"  },
{ id: "sensors",    label: "Sensors"    },
...(isManager ? [{ id: "settings", label: "Settings" }] : []),
];
const RC = { manager: "#6366f1", attendant: "#0ea5e9", technician: "#f59e0b" };

return (
<>
{isMobile && open && (
<div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
)}
<aside style={{
width: 220, flexShrink: 0, background: "#1a3352", display: "flex", flexDirection: "column",
height: "100vh", overflowY: "auto",
...(isMobile ? {
position: "fixed", left: 0, top: 0, zIndex: 50,
transform: open ? "translateX(0)" : "translateX(-100%)",
transition: "transform 0.25s ease",
boxShadow: "4px 0 24px rgba(0,0,0,0.25)",
} : {})
}}>
<div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
<span style={{ fontSize: 20 }}>?</span>
<span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>WashLevel</span>
<span style={{ background: "#0ea5e9", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 3, padding: "2px 5px" }}>PRO</span>
</div>
</div>
<div style={{ padding: "14px 12px 8px" }}>
<div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Location</div>
{locs.map(l => (
<button key={l.id} onClick={() => setLocId(l.id)} style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 7, border: "none", background: locId === l.id ? "rgba(255,255,255,0.1)" : "transparent", color: locId === l.id ? "#fff" : "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontWeight: locId === l.id ? 600 : 400, marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
<span style={{ width: 7, height: 7, borderRadius: "50%", background: locId === l.id ? "#34d399" : "rgba(255,255,255,0.15)", flexShrink: 0 }} />{l.name}
</button>
))}
</div>
<div style={{ padding: "6px 12px", flex: 1, borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 4 }}>
<div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, marginTop: 10 }}>Menu</div>
{nav.map(item => (
<button key={item.id} onClick={() => { setView(item.id); if(isMobile) onClose(); }} style={{ width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 7, border: "none", background: view === item.id ? "#0ea5e9" : "transparent", color: view === item.id ? "#fff" : "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 13, fontWeight: view === item.id ? 600 : 400, marginBottom: 2 }}>
{item.label}
</button>
))}
</div>
<div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
<div onClick={() => { setView("settings"); if (typeof onClose === "function") onClose(); }} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
<Avatar name={user?.name || user?.email || ""} color={RC[user?.role] || "#6366f1"} size={34} />
<div style={{ minWidth: 0 }}>
<div style={{ color: "#fff", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name || user?.email}</div>
<div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textTransform: "capitalize" }}>{user?.role}</div>
</div>
</div>
<button onClick={logout} style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "none", color: "rgba(255,255,255,0.6)", borderRadius: 7, padding: "8px 0", fontSize: 12, cursor: "pointer" }}>Sign Out</button>
</div>
</aside>
</>
);
}

function Overview({ location, tasks, sensors, equipment, onNavigate, user }) {
const done = tasks.filter(t => t.status === "done").length;
const inprog = tasks.filter(t => t.status === "in-progress").length;
const eqBad = equipment.filter(e => e.status !== "ok").length;
const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;

return (
<div>
<div style={{ marginBottom: 22 }}>
<div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{location?.name} - Overview</div>
<div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))", gap: 13, marginBottom: 22 }}>
<div style={{ cursor: "pointer" }} onClick={() => onNavigate("carcounts")}><StatCard label="Cars Today" value={sensors?.carsToday ?? "-"} accent="#0ea5e9" /></div>
<div style={{ cursor: "pointer" }} onClick={() => onNavigate("tasks")}><StatCard label="Tasks Done" value={done + "/" + tasks.length} sub={pct + "% complete"} accent="#10b981" /></div>
<div style={{ cursor: "pointer" }} onClick={() => onNavigate("all-tasks")}><StatCard label="In Progress" value={inprog} accent="#f59e0b" /></div>
<div style={{ cursor: "pointer" }} onClick={() => onNavigate("equipment")}><StatCard label="Equip Alerts" value={eqBad} alert={eqBad > 0} accent="#ef4444" /></div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18, marginBottom: 18 }}>
<div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
<div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
<span>?</span> Live Sensors
<span style={{ marginLeft: "auto", fontSize: 11, color: "#059669", background: "#d1fae5", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>LIVE</span>
</div>
{[
{ label: "Soap Level", val: sensors?.soapLevel, c: "#8b5cf6" },
{ label: "Rinse Aid", val: sensors?.rinseAid, c: "#0ea5e9" },
{ label: "Wax Level", val: sensors?.waxLevel, c: "#f59e0b" },
{ label: "Water Pressure", val: sensors?.waterPressure, c: "#10b981" },
].map(s => (
<div key={s.label} style={{ marginBottom: 14 }}>
<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
<span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{s.label}</span>
<span style={{ fontSize: 13, fontWeight: 700, color: (s.val ?? 100) < 30 ? "#ef4444" : "#111827" }}>{s.val ?? "-"}%</span>
</div>
<Bar value={s.val ?? 0} color={s.c} />
</div>
))}
          <SpSensorMini sensors={sensors} onNavigate={onNavigate} locId={location?.id} uid={user?.uid} />
{sensors && <div style={{ marginTop: 6, padding: "10px 12px", background: "#f0f9ff", borderRadius: 8, fontSize: 12, color: "#0369a1" }}>Temp: <b>{sensors.tempF}?F</b> Conveyor: <b>{sensors.conveyorRPM} RPM</b></div>}
</div>
<div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
<div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 14 }}>Equipment Status</div>
{equipment.map(eq => {
const s = EQS[eq.status] || EQS.ok;
return (
<div key={eq.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: eq.status !== "ok" ? s.bg + "80" : "#fafafa", borderRadius: 8, border: `1px solid ${eq.status !== "ok" ? s.color + "40" : "#e5e7eb"}`, marginBottom: 7 }}>
<span style={{ fontWeight: 700, color: s.color, fontSize: 13, width: 16, textAlign: "center" }}>{s.icon}</span>
<span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#374151" }}>{eq.name}</span>
<span style={{ fontSize: 11, color: "#9ca3af" }}>{eq.nextService}</span>
<Pill label={s.label} bg={s.bg} color={s.color} />
</div>
);
})}
</div>
</div>
<div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
<div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 14 }}>? Open Tasks</div>
{tasks.filter(t => t.status !== "done").slice(0, 6).map((t, i, arr) => (
<div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none" }}>
<div style={{ width: 8, height: 8, borderRadius: "50%", background: STS[t.status]?.dot, flexShrink: 0 }} />
<span style={{ flex: 1, fontSize: 13, color: "#374151", fontWeight: 500 }}>{t.title}</span>
<Pill label={t.priority} bg={PRI[t.priority]?.bg} color={PRI[t.priority]?.color} />
<span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>{t.due}</span>
</div>
))}
{tasks.filter(t => t.status !== "done").length === 0 && <div style={{ textAlign: "center", color: "#10b981", fontWeight: 600, padding: "20px 0" }}>? All tasks complete!</div>}
</div>
</div>
);
}

function CompleteTaskModal({ task, locId, note, user, onClose, onDone }) {
  const [partsUsed, setPartsUsed] = useState({});
  const [inventory, setInventory] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!locId) return;
    getDocs(collection(db, "locations", locId, "inventory")).then(snap => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [locId]);

  const handlePhoto = async (e) => {
    const files = Array.from(e.target.files);
    const urls = [];
    for (const file of files) {
      const reader = new FileReader();
      await new Promise(r => { reader.onload = () => { urls.push(reader.result); r(); }; reader.readAsDataURL(file); });
    }
    setPhotos(p => [...p, ...urls]);
  };

  const handleComplete = async () => {
    setSaving(true);
    const duration = task.startedAt ? Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000) : null;
    const histId = "h" + Date.now();

    // Deduct parts from inventory
    const usedItems = [];
    for (const [itemId, qty] of Object.entries(partsUsed)) {
      if (!qty || qty <= 0) continue;
      const item = inventory.find(i => i.id === itemId);
      if (!item) continue;
      const newQty = Math.max(0, item.quantity - qty);
      await updateDoc(doc(db, "locations", locId, "inventory", itemId), { quantity: newQty, updatedAt: new Date().toISOString() });
      usedItems.push({ name: item.name, partNumber: item.partNumber || "", qty, unit: item.unit, costPerUnit: item.costPerUnit || 0 });
    }

    // Save history
    await setDoc(doc(db, "locations", locId, "tasks", task.id, "history", histId), {
      completedAt: new Date().toISOString(),
      completedBy: user?.name || user?.email || "Unknown",
      completedById: user?.uid,
      note,
      duration,
      date: new Date().toLocaleDateString(),
      partsUsed: usedItems,
      photos,
    });

    // Update task
    await updateDoc(doc(db, "locations", locId, "tasks", task.id), {
      status: "done",
      completedAt: new Date().toISOString(),
      completedBy: user?.name || user?.email,
      duration,
      updatedAt: new Date().toISOString(),
      note,
      mediaUrls: photos.length ? photos : (task.mediaUrls || []),
    });

    setSaving(false);
    onDone();
  };

  const filtered = inventory.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.partNumber && i.partNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const inp = { width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fff" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#111827" }}>Complete Task</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>x</button>
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, padding: "8px 12px", background: "#f0fdf4", borderRadius: 8 }}>
          Completing: <b style={{ color: "#059669" }}>{task.title}</b>
        </div>

        {/* Photo upload */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Completion Photos</label>
          <input type="file" accept="image/*,video/*" multiple onChange={handlePhoto} style={{ fontSize: 12 }} />
          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {photos.map((url, i) => <img key={i} src={url} alt="completion" style={{ width: 70, height: 70, borderRadius: 6, objectFit: "cover" }} />)}
            </div>
          )}
        </div>

        {/* Parts used */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Parts / Materials Used</label>
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by name or part number..." style={{ ...inp, marginBottom: 8 }} />
          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>No inventory items found</div>
            ) : filtered.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    {item.partNumber && <span style={{ marginRight: 8 }}>#{item.partNumber}</span>}
                    {item.costPerUnit ? <span>${item.costPerUnit}/{item.unit}</span> : null}
                    <span style={{ marginLeft: 8 }}>Stock: {item.quantity} {item.unit}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number" min="0" max={item.quantity}
                    value={partsUsed[item.id] || ""}
                    onChange={e => setPartsUsed(p => ({ ...p, [item.id]: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                    style={{ width: 60, padding: "4px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, outline: "none" }}
                  />
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{item.unit}</span>
                </div>
              </div>
            ))}
          </div>
          {Object.values(partsUsed).some(v => v > 0) && (
            <div style={{ marginTop: 8, padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, fontSize: 12, color: "#059669" }}>
              Total cost: ${ Object.entries(partsUsed).reduce((sum, [id, qty]) => {
                const item = inventory.find(i => i.id === id);
                return sum + (item?.costPerUnit || 0) * (qty || 0);
              }, 0).toFixed(2)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleComplete} disabled={saving} style={{ flex: 1, background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Saving..." : "Mark Complete"}
          </button>
          <button onClick={onClose} style={{ flex: 1, background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, onStatus, onSaveNote, locId, onSelectMaterials }) {
const [open, setOpen] = useState(false);
const [note, setNote] = useState(task.note || "");
const [showHistory, setShowHistory] = useState(false);
const [history, setHistory] = useState([]);
const { user } = useAuth();
const st = STS[task.status] || STS.pending;
const next = task.status === "pending" ? "in-progress" : task.status === "in-progress" ? "done" : "pending";
const nextLabel = task.status === "pending" ? "Start" : task.status === "in-progress" ? "Complete" : "Reopen";
const btnC = task.status === "pending" ? "#6366f1" : task.status === "in-progress" ? "#059669" : "#9ca3af";

const loadHistory = async () => {
if (!locId) return;
const snap = await getDocs(collection(db, "locations", locId, "tasks", task.id, "history"));
const entries = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.completedAt > a.completedAt ? 1 : -1);
setHistory(entries);
setShowHistory(true);
};

const handleStatus = async (e) => {
e.stopPropagation();
if (next === "done" && locId) {
const histId = "h" + Date.now();
const duration = task.startedAt ? Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000) : null;
await setDoc(doc(db, "locations", locId, "tasks", task.id, "history", histId), {
completedAt: new Date().toISOString(),
completedBy: user?.name || user?.email || "Unknown",
completedById: user?.uid,
note: note,
duration: duration,
date: new Date().toLocaleDateString(),
});
await updateDoc(doc(db, "locations", locId, "tasks", task.id), {
status: "done",
completedAt: new Date().toISOString(),
completedBy: user?.name || user?.email,
duration: duration,
updatedAt: new Date().toISOString(),
note: note,
});
} else if (next === "in-progress" && locId) {
await updateDoc(doc(db, "locations", locId, "tasks", task.id), {
status: "in-progress",
startedAt: new Date().toISOString(),
updatedAt: new Date().toISOString(),
});
} else {
onStatus(task.id, next);
}
};

const recurrenceLabel = task.recurrence ? "Repeats: " + task.recurrence : null;

return (
<div style={{ background: task.status === "done" ? "#fafafa" : "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 8, overflow: "hidden", opacity: task.status === "done" ? 0.72 : 1 }}>
<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer" }} onClick={() => setOpen(!open)}>
<div style={{ width: 9, height: 9, borderRadius: "50%", background: st.dot, flexShrink: 0 }} />
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ fontWeight: 600, fontSize: 13.5, color: task.status === "done" ? "#9ca3af" : "#111827", textDecoration: task.status === "done" ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</div>
<div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
<Pill label={task.category} bg={CAT[task.category]?.bg} color={CAT[task.category]?.color} />
<Pill label={task.priority} bg={PRI[task.priority]?.bg} color={PRI[task.priority]?.color} />
<span style={{ fontSize: 11, color: "#9ca3af" }}>{task.due && task.due.includes("-") ? new Date(task.due + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : task.due}</span>
{recurrenceLabel && <span style={{ fontSize: 11, color: "#6366f1", background: "#ede9fe", padding: "1px 7px", borderRadius: 99 }}>{recurrenceLabel}</span>}
            {task.due && task.due.includes("-") && task.status !== "done" && new Date(task.due + "T23:59:59") < new Date() && (
              <span style={{ fontSize: 11, color: "#dc2626", background: "#fee2e2", padding: "1px 7px", borderRadius: 99, fontWeight: 700 }}>Overdue</span>
            )}
            {task.due && task.due.includes("-") && task.status !== "done" && new Date(task.due + "T23:59:59") < new Date() && (
              <span style={{ fontSize: 11, color: "#dc2626", background: "#fee2e2", padding: "1px 7px", borderRadius: 99, fontWeight: 700 }}>Overdue</span>
            )}
</div>
</div>
<div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={handleStatus} style={{ background: btnC, color: "#fff", border: "none", borderRadius: 6, padding: "5px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{nextLabel}</button>
          {task.status === "in-progress" && (
            <button onClick={e => { e.stopPropagation(); onStatus(task.id, "on-hold"); }} style={{ background: "#fce7f3", color: "#be185d", border: "1px solid #fbcfe8", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>On Hold</button>
          )}
        </div>
<span style={{ color: "#d1d5db", fontSize: 11 }}>{open ? "v" : ">"}</span>
</div>
{open && (
<div style={{ padding: "12px 14px 14px", borderTop: "1px solid #f3f4f6", background: "#fafbfc" }}>
<div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
<span><b>Shift:</b> {task.shift}</span>
<span><b>Status:</b> <Pill label={st.label} bg={st.bg} color={st.color} /></span>
{task.completedBy && <span><b>Completed by:</b> {task.completedBy}</span>}
{task.completedAt && <span><b>Completed:</b> {new Date(task.completedAt).toLocaleDateString()}</span>}
{task.duration != null && <span><b>Duration:</b> {task.duration} min</span>}
</div>
<div style={{ marginBottom: 10 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Notes</label>
<textarea
value={note}
onChange={e => setNote(e.target.value)}
onBlur={() => onSaveNote && onSaveNote(task.id, note)}
placeholder="Add notes about this task..."
rows={2}
style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 12, resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
/>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Photos / Videos</label>
            <input type="file" accept="image/*,video/*" multiple onChange={async e => {
              const files = Array.from(e.target.files);
              if (!files.length || !locId) return;
              const urls = [];
              for (const file of files) {
                const reader = new FileReader();
                await new Promise(r => { reader.onload = () => { urls.push(reader.result); r(); }; reader.readAsDataURL(file); });
              }
              const existing = task.mediaUrls || [];
              await updateDoc(doc(db, "locations", locId, "tasks", task.id), { mediaUrls: [...existing, ...urls], updatedAt: new Date().toISOString() });
            }} style={{ fontSize: 12, color: "#374151" }} />
            {task.mediaUrls && task.mediaUrls.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {task.mediaUrls.map((url, i) => (
                  <img key={i} src={url} alt="task media" style={{ width: 70, height: 70, borderRadius: 6, objectFit: "cover", cursor: "pointer" }} onClick={() => window.open(url, "_blank")} />
                ))}
              </div>
            )}
</div>
<div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
<button onClick={loadHistory} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
View History
</button>
{task.status === "in-progress" && onSelectMaterials && (
<button onClick={e => { e.stopPropagation(); onSelectMaterials(task); }} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "#059669", cursor: "pointer", fontWeight: 600 }}>
+ Materials Used
</button>
)}
</div>
{showHistory && (
<div style={{ marginTop: 12 }}>
<div style={{ fontWeight: 600, fontSize: 12, color: "#374151", marginBottom: 8 }}>Task History</div>
{history.length === 0 ? (
<div style={{ fontSize: 12, color: "#9ca3af" }}>No history yet.</div>
) : history.map(h => (
<div key={h.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 7, padding: "8px 12px", marginBottom: 6, fontSize: 12 }}>
<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
<span style={{ fontWeight: 600, color: "#374151" }}>{h.date}</span>
<span style={{ color: "#9ca3af" }}>{h.duration != null ? h.duration + " min" : ""}</span>
</div>
<div style={{ color: "#6b7280" }}><b>By:</b> {h.completedBy}</div>
{h.note && <div style={{ color: "#374151", marginTop: 4, fontStyle: "italic" }}>{h.note}</div>}
</div>
))}
</div>
)}
</div>
)}
</div>
);
}

function Tasks({ tasks, onStatus, showAll, locationName, onAddTask, onSaveNote, locId, onSelectMaterials }) {
const { user } = useAuth();
const [fStatus, setFS] = useState("all");
const [fCat, setFC] = useState("all");

const mine = tasks; // All tasks are globally visible
const filtered = mine.filter(t => {
if (fStatus !== "all" && t.status !== fStatus) return false;
if (fCat !== "all" && t.category !== fCat) return false;
return true;
});
const done = mine.filter(t => t.status === "done").length;
const pct = mine.length ? Math.round(done / mine.length * 100) : 0;

const chip = (val, cur, set, label) => (
<button onClick={() => set(val)} style={{ padding: "5px 12px", borderRadius: 99, border: "1px solid #e5e7eb", background: cur === val ? "#1a3352" : "#fff", color: cur === val ? "#fff" : "#374151", fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
);

return (
<div>
<div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
<div>
<div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>"Tasks"</div>
<div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>{locationName}</div>
</div>
<button onClick={onAddTask} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>+ Add Task</button>
</div>
<div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
<span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Today's Progress</span>
<span style={{ fontSize: 13, fontWeight: 700 }}>{done}/{mine.length} ({pct}%)</span>
</div>
<Bar value={pct} color={pct === 100 ? "#10b981" : "#6366f1"} height={8} />
</div>
<div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 18 }}>
{chip("all", fStatus, setFS, "All")} {chip("pending", fStatus, setFS, "Pending")} {chip("in-progress", fStatus, setFS, "In Progress")} {chip("done", fStatus, setFS, "Done")}
<div style={{ width: 1, background: "#e5e7eb" }} />
{["all", "cleaning", "equipment", "chemicals", "supplies"].map(c => chip(c, fCat, setFC, c === "all" ? "All Types" : c.charAt(0).toUpperCase() + c.slice(1)))}

  </div>
  <div>
    {filtered.map(t => <TaskRow key={t.id} task={t} onStatus={onStatus} onSaveNote={onSaveNote} locId={locId} onSelectMaterials={onSelectMaterials} />)}
    {filtered.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>No tasks match your filters.</div>}
  </div>
</div>

);
}

function Equipment({ equipment, locationName, locId, allTasks, onCreateTask }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newEq, setNewEq] = useState({ name: "", status: "ok", lastService: "", lastServiceCars: 0, nextService: "", nextServiceCars: "", carsCount: 0 });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [histories, setHistories] = useState({});

  const inp = { width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 4, background: "#fff" };

  const toggleExpand = async (eqId) => {
    const next = { ...expanded, [eqId]: !expanded[eqId] };
    setExpanded(next);
    if (next[eqId] && !histories[eqId]) {
      const snap = await getDocs(collection(db, "locations", locId, "equipment", eqId, "history"));
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date > a.date ? 1 : -1);
      setHistories(p => ({ ...p, [eqId]: entries }));
    }
  };

  const handleAdd = async () => {
    if (!newEq.name.trim()) return;
    setSaving(true);
    const id = "e" + Date.now();
    await setDoc(doc(db, "locations", locId, "equipment", id), { ...newEq, id, note: "", manuals: [], createdAt: new Date().toISOString() });
    setNewEq({ name: "", status: "ok", lastService: "", lastServiceCars: 0, nextService: "", nextServiceCars: "", carsCount: 0 });
    setShowAdd(false);
    setSaving(false);
  };

  const handleSaveEdit = async (eqId) => {
    const eq = equipment.find(e => e.id === eqId);
    const updates = { ...editData, updatedAt: new Date().toISOString() };
    await updateDoc(doc(db, "locations", locId, "equipment", eqId), updates);
    // Log to history if car count or service date changed
    const changed = [];
    if (editData.carsCount !== eq.carsCount) changed.push("Car count updated to " + Number(editData.carsCount).toLocaleString());
    if (editData.lastService !== eq.lastService) changed.push("Last service: " + editData.lastService + " at " + Number(editData.lastServiceCars||0).toLocaleString() + " cars");
    if (changed.length) {
      const histId = "h" + Date.now();
      await setDoc(doc(db, "locations", locId, "equipment", eqId, "history", histId), {
        date: new Date().toISOString().split("T")[0],
        note: changed.join(" | "),
        type: "edit",
        createdAt: new Date().toISOString(),
      });
      setHistories(p => ({ ...p, [eqId]: null }));
    }
    setEditingId(null);
  };

  const handleDelete = async (eqId) => {
    if (!window.confirm("Delete this equipment?")) return;
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, "locations", locId, "equipment", eqId));
  };

  const handleManualUpload = async (e, eqId, eq) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const manuals = eq.manuals || [];
      await updateDoc(doc(db, "locations", locId, "equipment", eqId), {
        manuals: [...manuals, { name: file.name, url: reader.result, uploadedAt: new Date().toISOString() }]
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div style={{ marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Equipment</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>{locationName}</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Equipment</button>
      </div>

      {showAdd && (
        <div style={{ background: "#fff", border: "1.5px dashed #6366f1", borderRadius: 12, padding: 20, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#6366f1", marginBottom: 14 }}>New Equipment</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Name</label><input value={newEq.name} onChange={e => setNewEq(p => ({...p, name: e.target.value}))} placeholder="e.g. Conveyor Belt" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Status</label>
              <select value={newEq.status} onChange={e => setNewEq(p => ({...p, status: e.target.value}))} style={inp}>
                <option value="ok">OK</option><option value="warning">Warning</option><option value="error">Alert</option>
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Last Service Date</label><input value={newEq.lastService} onChange={e => setNewEq(p => ({...p, lastService: e.target.value}))} placeholder="e.g. Mar 15, 2026" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Car Count at Last Service</label><input type="number" value={newEq.lastServiceCars} onChange={e => setNewEq(p => ({...p, lastServiceCars: parseInt(e.target.value)||0}))} placeholder="0" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Next Service Date</label><input value={newEq.nextService} onChange={e => setNewEq(p => ({...p, nextService: e.target.value}))} placeholder="e.g. Apr 15, 2026" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Next Service at Cars</label><input type="number" value={newEq.nextServiceCars} onChange={e => setNewEq(p => ({...p, nextServiceCars: parseInt(e.target.value)||0}))} placeholder="e.g. 50000" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Current Car Count</label><input type="number" value={newEq.carsCount} onChange={e => setNewEq(p => ({...p, carsCount: parseInt(e.target.value)||0}))} placeholder="0" style={inp} /></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleAdd} disabled={saving} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "Adding..." : "Add"}</button>
            <button onClick={() => setShowAdd(false)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {equipment.map(eq => {
          const s = EQS[eq.status] || EQS.ok;
          const isExpanded = expanded[eq.id];
          const isEditing = editingId === eq.id;
          const linkedTasks = (allTasks || []).filter(t => t.equipmentId === eq.id);
          const eqHistory = histories[eq.id] || [];
          const carsSinceService = eq.carsCount && eq.lastServiceCars ? (eq.carsCount - eq.lastServiceCars).toLocaleString() : null;
          const carsUntilService = eq.nextServiceCars && eq.carsCount ? Math.max(0, eq.nextServiceCars - eq.carsCount).toLocaleString() : null;

          return (
            <div key={eq.id} style={{ background: "#fff", border: `1.5px solid ${eq.status !== "ok" ? s.color + "60" : "#e5e7eb"}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => toggleExpand(eq.id)}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{eq.name}</div>
                    <Pill label={s.label} bg={s.bg} color={s.color} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6, fontSize: 12, color: "#6b7280" }}>
                    <div style={{ background: "#f8fafc", borderRadius: 6, padding: "6px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Last Service</div>
                      <div style={{ fontWeight: 600, color: "#374151" }}>{eq.lastService || "-"}</div>
                      {eq.lastServiceCars ? <div style={{ color: "#9ca3af" }}>at {Number(eq.lastServiceCars).toLocaleString()} cars</div> : null}
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: 6, padding: "6px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Next Service</div>
                      <div style={{ fontWeight: 600, color: eq.nextService === "Overdue" ? "#ef4444" : "#374151" }}>{eq.nextService || "-"}</div>
                      {eq.nextServiceCars ? <div style={{ color: "#9ca3af" }}>or at {Number(eq.nextServiceCars).toLocaleString()} cars</div> : null}
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: 6, padding: "6px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Total Cars</div>
                      <div style={{ fontWeight: 600, color: "#374151" }}>{(eq.carsCount || 0).toLocaleString()}</div>
                      {carsSinceService && <div style={{ color: "#9ca3af" }}>{carsSinceService} since last service</div>}
                    </div>
                    {carsUntilService && (
                      <div style={{ background: Number(carsUntilService.replace(/,/g,"")) < 1000 ? "#fee2e2" : "#f0fdf4", borderRadius: 6, padding: "6px 10px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Cars Until Service</div>
                        <div style={{ fontWeight: 700, color: Number(carsUntilService.replace(/,/g,"")) < 1000 ? "#ef4444" : "#059669" }}>{carsUntilService}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); setEditingId(isEditing ? null : eq.id); setEditData({ status: eq.status, lastService: eq.lastService||"", lastServiceCars: eq.lastServiceCars||0, nextService: eq.nextService||"", nextServiceCars: eq.nextServiceCars||0, carsCount: eq.carsCount||0, note: eq.note||"" }); }} style={{ background: "#f3f4f6", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#374151", fontWeight: 600 }}>Edit</button>
                  <button onClick={e => { e.stopPropagation(); onCreateTask && onCreateTask(eq); }} style={{ background: "#ede9fe", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#6366f1", fontWeight: 600 }}>+ Task</button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(eq.id); }} style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#dc2626", fontWeight: 600 }}>Delete</button>
                </div>
                <span style={{ color: "#9ca3af", fontSize: 12 }}>{isExpanded ? "v" : ">"}</span>
              </div>

              {/* Edit form */}
              {isEditing && (
                <div style={{ padding: "0 20px 16px", borderTop: "1px solid #f3f4f6", background: "#fafbfc" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginTop: 14, marginBottom: 12 }}>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Status</label>
                      <select value={editData.status} onChange={e => setEditData(p => ({...p, status: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }}>
                        <option value="ok">OK</option><option value="warning">Warning</option><option value="error">Alert</option>
                      </select>
                    </div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Current Car Count</label><input type="number" value={editData.carsCount} onChange={e => setEditData(p => ({...p, carsCount: parseInt(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Last Service Date</label><input value={editData.lastService} onChange={e => setEditData(p => ({...p, lastService: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Car Count at Last Service</label><input type="number" value={editData.lastServiceCars} onChange={e => setEditData(p => ({...p, lastServiceCars: parseInt(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Next Service Date</label><input value={editData.nextService} onChange={e => setEditData(p => ({...p, nextService: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Next Service at Cars</label><input type="number" value={editData.nextServiceCars} onChange={e => setEditData(p => ({...p, nextServiceCars: parseInt(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Notes</label>
                    <textarea value={editData.note} onChange={e => setEditData(p => ({...p, note: e.target.value}))} rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit", fontSize: 12, padding: "6px 8px" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleSaveEdit(eq.id)} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Expanded details */}
              {isExpanded && !isEditing && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f3f4f6" }}>
                  {eq.note && <div style={{ marginTop: 12, fontSize: 13, color: "#374151", fontStyle: "italic" }}>{eq.note}</div>}

                  {/* Manuals */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Manuals & Documents</div>
                    <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={e => handleManualUpload(e, eq.id, eq)} style={{ fontSize: 12 }} />
                    {eq.manuals && eq.manuals.length > 0 && eq.manuals.map((m, i) => (
                      <a key={i} href={m.url} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 12, color: "#0ea5e9", marginTop: 4 }}>[File] {m.name}</a>
                    ))}
                  </div>

                  {/* Linked tasks */}
                  {linkedTasks.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Linked Tasks ({linkedTasks.length})</div>
                      {linkedTasks.map(t => (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12, borderBottom: "1px solid #f3f4f6" }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: STS[t.status]?.dot || "#9ca3af", flexShrink: 0 }} />
                          <span style={{ flex: 1, color: "#374151" }}>{t.title}</span>
                          <Pill label={STS[t.status]?.label || t.status} bg={STS[t.status]?.bg || "#f3f4f6"} color={STS[t.status]?.color || "#6b7280"} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* History */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Service History</div>
                    {eqHistory.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>No history yet. History is recorded automatically when you update service dates or car counts.</div>
                    ) : eqHistory.map(h => (
                      <div key={h.id} style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: 7, marginBottom: 6, fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, color: "#374151" }}>{h.date}</span>
                        </div>
                        <div style={{ color: "#6b7280" }}>{h.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {equipment.length === 0 && !showAdd && <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>No equipment yet. Tap + Add Equipment to get started.</div>}
      </div>
    </div>
  );
}

function Sensors({ sensors, locationName, locId, onNavigate, uid }) {
  const user = { uid };
  const s = sensors || {};
  const [spSensors, setSpSensors] = useState([]);
  const [history, setHistory] = useState({});
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [timeRange, setTimeRange] = useState("6h");
  const [latestReadings, setLatestReadings] = useState({});
  const rangeMs = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 };

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "integrations", "sensorpush"));
        if (!snap.exists() || snap.data().disconnected) return;
        const { accessToken, assignments, sensors: sensorList } = snap.data();
        if (!sensorList) return;
        const assigned = sensorList.filter(s => assignments[s.id] === locId);
        setSpSensors(assigned);
      } catch(e) {}
    };
    if (locId) load().then(() => {});
  }, [locId]);

  // Auto-load history for all sensors on mount
  useEffect(() => {
    if (spSensors.length > 0) {
      spSensors.forEach(async sp => {
        // Fetch latest reading for tile display
        try {
          const snap = await getDoc(doc(db, "users", user.uid, "integrations", "sensorpush"));
          const { accessToken } = snap.data();
          const tokenRes = await fetch("https://api.sensorpush.com/api/v1/oauth/accesstoken", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ authorization: accessToken })
          });
          const tokenData = await tokenRes.json();
          const token = tokenData.accesstoken || accessToken;
          const sampRes = await fetch("https://api.sensorpush.com/api/v1/samples", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": token },
            body: JSON.stringify({ sensors: [sp.id], limit: 1 })
          });
          const sampData = await sampRes.json();
          const latest = sampData.sensors?.[sp.id]?.[0];
          if (latest) {
            setLatestReadings(p => ({ ...p, [sp.id]: {
              temperature: latest.temperature != null ? Math.round(latest.temperature * 10) / 10 : null,
              humidity: latest.humidity != null ? Math.round(latest.humidity * 10) / 10 : null
            }}));
          }
        } catch(e) {}
        loadHistory(sp.id, timeRange);
      });
    }
  }, [spSensors.length]);

  const loadHistory = async (sensorId, range) => {
    const r = range || timeRange;
    setSelectedSensor(sensorId);
    setLoadingHistory(true);
    setHistory(p => ({ ...p, [sensorId]: undefined }));
    try {
      const snap = await getDoc(doc(db, "users", user.uid, "integrations", "sensorpush"));
      const { accessToken } = snap.data();
      const tokenRes = await fetch("https://api.sensorpush.com/api/v1/oauth/accesstoken", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorization: accessToken })
      });
      const tokenData = await tokenRes.json();
      const token = tokenData.accesstoken || accessToken;
      const stop = new Date().toISOString();
      const start = new Date(Date.now() - (rangeMs[r] || 6) * 60 * 60 * 1000).toISOString();
      const sampRes = await fetch("https://api.sensorpush.com/api/v1/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": token },
        body: JSON.stringify({ sensors: [sensorId], limit: r === "7d" ? 10080 : r === "24h" ? 1440 : r === "6h" ? 360 : 60, startTime: start, stopTime: stop })
      });
      const sampData = await sampRes.json();
      const samples = sampData.sensors?.[sensorId] || [];
      setHistory(p => ({ ...p, [sensorId]: samples.slice().reverse() }));
    } catch(e) { console.log("History error:", e); }
    setLoadingHistory(false);
  };

  const cards = [
    { label: "Soap Level", val: s.soapLevel, unit: "%", color: "#8b5cf6", low: 30 },
    { label: "Rinse Aid", val: s.rinseAid, unit: "%", color: "#0ea5e9", low: 25 },
    { label: "Wax Level", val: s.waxLevel, unit: "%", color: "#f59e0b", low: 20 },
    { label: "Water Pressure", val: s.waterPressure, unit: "%", color: "#10b981", low: 60 },
    { label: "Water Temp", val: s.tempF, unit: "F", color: "#3b82f6", low: 0 },
    { label: "Conveyor Speed", val: s.conveyorRPM, unit: " RPM", color: "#6366f1", low: 0 },
    { label: "Cars Today", val: s.carsToday, unit: "", color: "#059669", low: 0 },
  ];

  const selHistory = selectedSensor ? (history[selectedSensor] || []) : [];
  const selSensor = spSensors.find(s => s.id === selectedSensor);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Sensor Dashboard</div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>{locationName}</div>
      </div>

      {spSensors.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>SensorPush Sensors</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 13, marginBottom: 16 }}>
            {spSensors.map(sp => {
              const lr = latestReadings[sp.id];
              const temp = lr?.temperature ?? s.spTempF;
              const hum = lr?.humidity ?? s.spHumidity;
              return (
                <div key={sp.id} onClick={() => loadHistory(sp.id, timeRange)}
                  style={{ background: selectedSensor === sp.id ? "#eff6ff" : "#fff", border: selectedSensor === sp.id ? "2px solid #3b82f6" : "1px solid #e5e7eb", borderRadius: 12, padding: 16, cursor: "pointer" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 10 }}>{sp.name}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#3b82f6" }}>{temp != null ? temp + "F" : "--"}</div>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>Temperature</div>
                    </div>
                    <div style={{ background: "#ecfeff", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#0891b2" }}>{hum != null ? hum + "%" : "--"}</div>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>Humidity</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8, textAlign: "center" }}>Tap for history</div>
                </div>
              );
            })}
          </div>

          {selectedSensor && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{selSensor?.name}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["1h","6h","24h","7d"].map(r => (
                    <button key={r} onClick={() => { setTimeRange(r); loadHistory(selectedSensor, r); }}
                      style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 6,
                        background: timeRange === r ? "#1a3352" : "#f3f4f6",
                        color: timeRange === r ? "#fff" : "#6b7280", cursor: "pointer" }}>
                      {r === "7d" ? "1W" : r}
                    </button>
                  ))}
                </div>
              </div>
              {loadingHistory ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#9ca3af", fontSize: 13 }}>Loading history...</div>
              ) : selHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#9ca3af", fontSize: 13 }}>No data available</div>
              ) : (
                <div>
                  {["temp","hum"].map(chartType => {
                    const isTemp = chartType === "temp";
                    const vals = selHistory.map(p => isTemp ? p.temperature : p.humidity).filter(v => v != null);
                    const minV = Math.min(...vals); const maxV = Math.max(...vals);
                    const midV = Math.round((minV + maxV) / 2);
                    const unit = isTemp ? "F" : "%";
                    const color = isTemp ? "#3b82f6" : "#0891b2";
                    const darkColor = isTemp ? "#1e40af" : "#0e7490";
                    const label = isTemp ? "Temperature (F)" : "Humidity (%)";
                    const targetBars = timeRange === "7d" ? 168 : timeRange === "24h" ? 96 : 60;
                    const filtered = selHistory.filter((_, i) => i % Math.max(1, Math.floor(selHistory.length / targetBars)) === 0);
                    return (
                      <div key={chartType} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 4 }}>{label}</div>
                        <div style={{ height: 24, marginBottom: 4 }}>
                          {tooltip?.chart === chartType && (
                            <div style={{ background: darkColor, color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, display: "inline-block", pointerEvents: "none" }}>
                              {tooltip.val}{unit} — {tooltip.time}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6, overflowX: "hidden" }}>
                          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 9, color: "#9ca3af", width: 28, textAlign: "right", paddingBottom: 2, flexShrink: 0 }}>
                            <span>{maxV}{unit}</span><span>{midV}{unit}</span><span>{minV}{unit}</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
                              {filtered.map((pt, i) => {
                                const val = isTemp ? pt.temperature : pt.humidity;
                                const h = maxV === minV ? 50 : Math.round(((val - minV) / (maxV - minV)) * 70) + 10;
                                const time = new Date(pt.observed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                                const isActive = tooltip?.chart === chartType && tooltip?.i === i;
                                return (
                                  <div key={i}
                                    onMouseEnter={() => setTooltip({ chart: chartType, val, time, i })}
                                    onPointerDown={() => setTooltip({ chart: chartType, val, time, i })}
                                    onMouseLeave={() => setTooltip(null)}
                                    onClick={() => setTooltip(isActive ? null : { chart: chartType, val, time, i })}
                                    style={{ flex: 1, height: h, background: isActive ? darkColor : color, borderRadius: "2px 2px 0 0", minWidth: 3, cursor: "pointer", transition: "background 0.1s" }} />
                                );
                              })}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9ca3af", marginTop: 3 }}>
                              <span>{new Date(selHistory[0]?.observed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              <span style={{ fontWeight: 600 }}>Time</span>
                              <span>Now</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "11px 16px", marginBottom: 20, fontSize: 13, color: "#92400e" }}>
        <b>Sensor Integration Ready</b> - Connect IoT hardware to populate live data.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 13 }}>
        {cards.filter(c => c.val != null).map(c => (
          <div key={c.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: c.val < c.low ? "#ef4444" : c.color }}>{c.val}{c.unit}</div>
            {c.unit === "%" && <Bar value={c.val} color={c.val < c.low ? "#ef4444" : c.color} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeClock({ locId, locationName, allLocations }) {
const { user } = useAuth();
const [clockState, setClockState] = useState(null); // loaded from Firestore
const [locClocks, setLocClocks] = useState({});
const [loading, setLoading] = useState(true);
const [history, setHistory] = useState([]);

const today = new Date().toISOString().split("T")[0];
const clockDocId = user?.uid + "_" + today;

useEffect(() => {
if (!user) return;
const unsub = onSnapshot(doc(db, "timeclock", clockDocId), snap => {
if (snap.exists()) {
setClockState(snap.data());
setLocClocks(snap.data().locationTimes || {});
} else {
setClockState(null);
setLocClocks({});
}
setLoading(false);
});
return unsub;
}, [user?.uid, today]);

useEffect(() => {
if (!user) return;
const unsub = onSnapshot(collection(db, "timeclock"), snap => {
const entries = snap.docs
.filter(d => d.id.startsWith(user.uid + "_"))
.map(d => ({ id: d.id, ...d.data() }))
.sort((a, b) => b.date > a.date ? 1 : -1)
.slice(0, 7);
setHistory(entries);
});
return unsub;
}, [user?.uid]);

const now = () => new Date().toISOString();
const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
const elapsed = (start, end) => {
if (!start) return "0h 0m";
const ms = (end ? new Date(end) : new Date()) - new Date(start);
const h = Math.floor(ms / 3600000);
const m = Math.floor((ms % 3600000) / 60000);
return h + "h " + m + "m";
};

const handleMainClock = async () => {
if (!clockState || !clockState.mainClockIn) {
await setDoc(doc(db, "timeclock", clockDocId), {
uid: user.uid, name: user.name, date: today,
mainClockIn: now(), mainClockOut: null, locationTimes: locClocks,
});
} else if (!clockState.mainClockOut) {
await updateDoc(doc(db, "timeclock", clockDocId), { mainClockOut: now() });
} else {
await updateDoc(doc(db, "timeclock", clockDocId), { mainClockIn: now(), mainClockOut: null });
}
};

const handleLocClock = async (lId) => {
const current = locClocks[lId] || {};
const updated = { ...locClocks };
if (!current.in) {
updated[lId] = { in: now(), out: null };
} else if (!current.out) {
updated[lId] = { ...current, out: now() };
} else {
updated[lId] = { in: now(), out: null };
}
setLocClocks(updated);
if (clockState) {
await updateDoc(doc(db, "timeclock", clockDocId), { locationTimes: updated });
} else {
await setDoc(doc(db, "timeclock", clockDocId), {
uid: user.uid, name: user.name, date: today,
mainClockIn: null, mainClockOut: null, locationTimes: updated,
});
}
};

const isClockedIn = clockState?.mainClockIn && !clockState?.mainClockOut;
const isClockedOut = clockState?.mainClockIn && clockState?.mainClockOut;

if (loading) return <Spinner />;

return (
<div>
<div style={{ marginBottom: 22 }}>
<div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Time Clock</div>
<div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
</div>

  {/* Main clock in/out */}
  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, marginBottom: 18, textAlign: "center" }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Today's Shift</div>
    <div style={{ fontSize: 32, fontWeight: 800, color: isClockedIn ? "#059669" : "#111827", marginBottom: 4 }}>
      {isClockedIn ? "Clocked In" : isClockedOut ? "Shift Complete" : "Not Clocked In"}
    </div>
    {clockState?.mainClockIn && (
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
        In: {fmt(clockState.mainClockIn)}
        {clockState.mainClockOut && <span> &nbsp;|&nbsp; Out: {fmt(clockState.mainClockOut)}</span>}
      </div>
    )}
    {isClockedIn && (
      <div style={{ fontSize: 22, fontWeight: 700, color: "#0ea5e9", marginBottom: 12 }}>
        {elapsed(clockState.mainClockIn, null)} elapsed
      </div>
    )}
    {isClockedOut && (
      <div style={{ fontSize: 18, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
        Total: {elapsed(clockState.mainClockIn, clockState.mainClockOut)}
      </div>
    )}
    <button onClick={handleMainClock} style={{
      background: isClockedIn ? "#ef4444" : "#059669",
      color: "#fff", border: "none", borderRadius: 10, padding: "14px 40px",
      fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 8,
    }}>
      {isClockedIn ? "Clock Out" : isClockedOut ? "Start New Shift" : "Clock In"}
    </button>
  </div>

  {/* Location billing clocks */}
  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 18 }}>
    <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 6 }}>Location Billing</div>
    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>Track time at each location separately for accurate billing. Independent from your main shift clock.</div>
    {allLocations.map(loc => {
      const lc = locClocks[loc.id] || {};
      const active = lc.in && !lc.out;
      const done = lc.in && lc.out;
      return (
        <div key={loc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 8, background: active ? "#f0fdf4" : "#fafafa" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: active ? "#10b981" : done ? "#9ca3af" : "#e5e7eb", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{loc.name}</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              {lc.in ? "In: " + fmt(lc.in) : "Not started"}
              {lc.out ? " | Out: " + fmt(lc.out) + " | " + elapsed(lc.in, lc.out) : active ? " | " + elapsed(lc.in, null) + " elapsed" : ""}
            </div>
          </div>
          <button onClick={() => handleLocClock(loc.id)} style={{
            background: active ? "#ef4444" : "#1a3352",
            color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            {active ? "Stop" : done ? "Restart" : "Start"}
          </button>
        </div>
      );
    })}
  </div>

  {/* History */}
  {history.length > 0 && (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14 }}>Recent Shifts</div>
      {history.map(entry => (
        <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
          <span style={{ color: "#374151", fontWeight: 500 }}>{entry.date}</span>
          <span style={{ color: "#6b7280" }}>
            {fmt(entry.mainClockIn)} - {entry.mainClockOut ? fmt(entry.mainClockOut) : "In progress"}
          </span>
          <span style={{ fontWeight: 600, color: "#111827" }}>{elapsed(entry.mainClockIn, entry.mainClockOut)}</span>
        </div>
      ))}
    </div>
  )}
</div>

);
}

// ADD TASK MODAL
function AddTaskModal({ locId, onClose, onAdd, preset }) {
const [title, setTitle] = useState("");
const [category, setCategory] = useState("cleaning");
const [priority, setPriority] = useState("medium");
const [shift, setShift] = useState("everyone");
const [due, setDue] = useState(new Date().toISOString().split("T")[0]);
const [saving, setSaving] = useState(false);
  const [equipmentId, setEquipmentId] = useState(preset?.id || "");
  const [equipmentList, setEquipmentList] = useState([]);

  useEffect(() => {
    if (!locId) return;
    getDocs(collection(db, "locations", locId, "equipment")).then(snap => {
      setEquipmentList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [locId]);

  const [recurrence, setRecurrence] = useState("");

const handleSubmit = async (e) => {
e.preventDefault();
if (!title.trim()) return;
setSaving(true);
const id = "t" + Date.now();
const task = { id, title: title.trim(), category, priority, shift, due, status: "pending", assignedRole: "attendant", recurrence: recurrence || null, equipmentId: equipmentId || null, equipmentId: equipmentId || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
await setDoc(doc(db, "locations", locId, "tasks", id), task);
setSaving(false);
onClose();
};

const inp = { width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fafafa", marginTop: 4 };
const sel = { ...inp, cursor: "pointer" };

return (
<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
<div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
<div style={{ fontWeight: 700, fontSize: 17, color: "#111827" }}>Add New Task</div>
<button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>x</button>
</div>
<form onSubmit={handleSubmit}>
<div style={{ marginBottom: 14 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Task Title</label>
<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Restock soap dispensers" required style={inp} />
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 14 }}>
<div>
<label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Category</label>
<select value={category} onChange={e => setCategory(e.target.value)} style={sel}>
<option value="cleaning">Cleaning</option>
<option value="equipment">Equipment</option>
<option value="chemicals">Chemicals</option>
<option value="parts">Parts</option>
</select>
</div>
<div>
<label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Priority</label>
<select value={priority} onChange={e => setPriority(e.target.value)} style={sel}>
<option value="high">High</option>
<option value="medium">Medium</option>
<option value="low">Low</option>
</select>
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
<div>
<label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Assigned To</label>
<select value={shift} onChange={e => setShift(e.target.value)} style={sel}>
<option value="everyone">Everyone</option>
                <option value="attendant">Attendants</option>
                <option value="technician">Technicians</option>
                <option value="manager">Managers</option>
</select>
</div>
<div>
<label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Due Date</label>
<input type="date" value={due} onChange={e => setDue(e.target.value)} style={inp} />
</div>
</div>
<div style={{ marginBottom: 14 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Link to Equipment (optional)</label>
            <select value={equipmentId} onChange={e => setEquipmentId(e.target.value)} style={sel}>
              <option value="">None</option>
              {equipmentList.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
              <select value={recurrence} onChange={e => setRecurrence(e.target.value)} style={sel}>
<option value="">No recurrence</option>
<option value="daily">Daily</option>
<option value="weekly">Weekly</option>
<option value="monthly">Monthly</option>
<option value="quarterly">Quarterly</option>
<option value="every 100 cars">Every 100 cars</option>
<option value="every 500 cars">Every 500 cars</option>
<option value="every 1000 cars">Every 1,000 cars</option>
</select>
</div>
<div style={{ display: "flex", gap: 10 }}>
<button type="submit" disabled={saving} style={{ flex: 1, background: "#1a3352", color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
{saving ? "Adding..." : "Add Task"}
</button>
<button type="button" onClick={onClose} style={{ flex: 1, background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
</div>
</form>
</div>
</div>
);
}

//  INVENTORY
function Inventory({ locId, locationName }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [newItem, setNewItem] = useState({ name: "", category: "chemicals", quantity: 0, unit: "gal", lowThreshold: 5, partNumber: "", costPerUnit: 0, reorderAt: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!locId) return;
    const unsub = onSnapshot(collection(db, "locations", locId, "inventory"), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.name.localeCompare(b.name)));
    });
    return unsub;
  }, [locId]);

  const handleAdd = async () => {
    if (!newItem.name.trim()) return;
    setSaving(true);
    const id = "inv" + Date.now();
    await setDoc(doc(db, "locations", locId, "inventory", id), { ...newItem, id, createdAt: new Date().toISOString() });
    setNewItem({ name: "", category: "chemicals", quantity: 0, unit: "gal", lowThreshold: 5, partNumber: "", costPerUnit: 0, reorderAt: 0 });
    setShowAdd(false);
    setSaving(false);
  };

  const handleUpdate = async (itemId, qty) => {
    const val = parseFloat(qty);
    if (isNaN(val)) return;
    await updateDoc(doc(db, "locations", locId, "inventory", itemId), { quantity: val, updatedAt: new Date().toISOString() });
  };

  const handleSaveEdit = async (itemId) => {
    await updateDoc(doc(db, "locations", locId, "inventory", itemId), { ...editData, updatedAt: new Date().toISOString() });
    setEditingId(null);
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm("Delete this item?")) return;
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, "locations", locId, "inventory", itemId));
  };

  const handleReorder = (item) => {
    alert("Reorder flagged: " + item.name + (item.partNumber ? " (Part #: " + item.partNumber + ")" : ""));
  };

  const CAT_GROUPS = ["chemicals", "parts", "vending supplies"];
  const CAT_COLORS2 = { chemicals: "#8b5cf6", parts: "#3b82f6", "vending supplies": "#f59e0b" };
  const UNITS = ["gal", "L", "oz", "lbs", "units", "rolls", "boxes"];
  const inp = { padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 7, fontSize: 13, background: "#fafafa", outline: "none", width: "100%", boxSizing: "border-box", marginTop: 4 };

  return (
    <div>
      <div style={{ marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Inventory</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>{locationName}</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Item</button>
      </div>

      {showAdd && (
        <div style={{ background: "#fff", border: "1.5px dashed #6366f1", borderRadius: 12, padding: 20, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#6366f1", marginBottom: 14 }}>New Inventory Item</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Item Name</label><input value={newItem.name} onChange={e => setNewItem(p => ({...p, name: e.target.value}))} placeholder="e.g. Tire Shine" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Part Number</label><input value={newItem.partNumber} onChange={e => setNewItem(p => ({...p, partNumber: e.target.value}))} placeholder="e.g. SHP-4421" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Category</label>
              <select value={newItem.category} onChange={e => setNewItem(p => ({...p, category: e.target.value}))} style={inp}>
                <option value="chemicals">Chemicals</option>
                <option value="parts">Parts</option>
                <option value="vending supplies">Vending Supplies</option>
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Quantity</label><input type="number" value={newItem.quantity} onChange={e => setNewItem(p => ({...p, quantity: parseFloat(e.target.value)||0}))} style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Unit</label>
              <select value={newItem.unit} onChange={e => setNewItem(p => ({...p, unit: e.target.value}))} style={inp}>
                {UNITS.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase()+u.slice(1)}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Cost Per Unit ($)</label><input type="number" step="0.01" value={newItem.costPerUnit || ""} onChange={e => setNewItem(p => ({...p, costPerUnit: parseFloat(e.target.value)||0}))} placeholder="0.00" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Low Stock Alert</label><input type="number" value={newItem.lowThreshold} onChange={e => setNewItem(p => ({...p, lowThreshold: parseFloat(e.target.value)||0}))} style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Reorder At (qty)</label><input type="number" value={newItem.reorderAt || ""} onChange={e => setNewItem(p => ({...p, reorderAt: parseFloat(e.target.value)||0}))} placeholder="e.g. 5" style={inp} /></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleAdd} disabled={saving} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "Adding..." : "Add Item"}</button>
            <button onClick={() => setShowAdd(false)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {items.filter(i => i.quantity <= i.lowThreshold).length > 0 && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#991b1b", fontWeight: 500 }}>
          Low stock: {items.filter(i => i.quantity <= i.lowThreshold).map(i => i.name).join(", ")}
        </div>
      )}

      {CAT_GROUPS.map(cat => {
        const group = items.filter(i => i.category === cat);
        if (!group.length) return null;
        return (
          <div key={cat} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: CAT_COLORS2[cat] || "#374151", marginBottom: 14, textTransform: "capitalize" }}>{cat}</div>
            {group.map(item => {
              const low = item.quantity <= item.lowThreshold;
              const isEditing = editingId === item.id;
              return (
                <div key={item.id} style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 12, marginBottom: 12 }}>
                  {isEditing ? (
                    <div style={{ background: "#f8fafc", borderRadius: 8, padding: 14 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 10 }}>Editing: {item.name}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 10 }}>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Name</label><input value={editData.name || ""} onChange={e => setEditData(p => ({...p, name: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Part Number</label><input value={editData.partNumber || ""} onChange={e => setEditData(p => ({...p, partNumber: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Category</label>
                          <select value={editData.category || "chemicals"} onChange={e => setEditData(p => ({...p, category: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }}>
                            <option value="chemicals">Chemicals</option>
                            <option value="parts">Parts</option>
                            <option value="vending supplies">Vending Supplies</option>
                          </select>
                        </div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Quantity</label><input type="number" value={editData.quantity || 0} onChange={e => setEditData(p => ({...p, quantity: parseFloat(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Unit</label>
                          <select value={editData.unit || "gal"} onChange={e => setEditData(p => ({...p, unit: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Cost Per Unit ($)</label><input type="number" step="0.01" value={editData.costPerUnit || ""} onChange={e => setEditData(p => ({...p, costPerUnit: parseFloat(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Low Stock Alert</label><input type="number" value={editData.lowThreshold || 0} onChange={e => setEditData(p => ({...p, lowThreshold: parseFloat(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Reorder At</label><input type="number" value={editData.reorderAt || ""} onChange={e => setEditData(p => ({...p, reorderAt: parseFloat(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleSaveEdit(item.id)} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{item.name}</div>
                        {item.partNumber && <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, marginTop: 1 }}>Part #: {item.partNumber}</div>}
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                          {item.costPerUnit ? <span>${item.costPerUnit}/{item.unit} </span> : null}
                          {item.reorderAt ? <span> Reorder at: {item.reorderAt}</span> : null}
                        </div>
                        {low && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                            <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>LOW STOCK</span>
                            <button onClick={() => handleReorder(item)} style={{ fontSize: 10, background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 4, padding: "1px 7px", cursor: "pointer", fontWeight: 600 }}>Flag Reorder</button>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => handleUpdate(item.id, Math.max(0, item.quantity - 1))} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #e5e7eb", background: "#f3f4f6", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                        <div style={{ textAlign: "center", minWidth: 65 }}>
                          <span style={{ fontWeight: 700, fontSize: 16, color: low ? "#ef4444" : "#111827" }}>{item.quantity}</span>
                          <span style={{ fontSize: 12, color: "#9ca3af" }}> {item.unit}</span>
                        </div>
                        <button onClick={() => handleUpdate(item.id, item.quantity + 1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #e5e7eb", background: "#f3f4f6", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                        <button onClick={() => { setEditingId(item.id); setEditData({ name: item.name, partNumber: item.partNumber||"", category: item.category||"chemicals", quantity: item.quantity, unit: item.unit||"gal", costPerUnit: item.costPerUnit||0, lowThreshold: item.lowThreshold||0, reorderAt: item.reorderAt||0 }); }} style={{ background: "#1a3352", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#fff", fontWeight: 600 }}>Edit</button>
                        <button onClick={() => handleDelete(item.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#dc2626", fontWeight: 600 }}>Del</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      {items.length === 0 && !showAdd && <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>No inventory items yet. Tap + Add Item to get started.</div>}
    </div>
  );
}

function MaterialsModal({ locId, task, onClose }) {
const [items, setItems] = useState([]);
const [selected, setSelected] = useState({});
const [saving, setSaving] = useState(false);

useEffect(() => {
if (!locId) return;
getDocs(collection(db, "locations", locId, "inventory")).then(snap => {
setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});
}, [locId]);

const handleQty = (id, val) => {
setSelected(p => ({ ...p, [id]: parseFloat(val) || 0 }));
};

const handleSave = async () => {
setSaving(true);
for (const [itemId, qty] of Object.entries(selected)) {
if (qty <= 0) continue;
const item = items.find(i => i.id === itemId);
if (!item) continue;
const newQty = Math.max(0, item.quantity - qty);
await updateDoc(doc(db, "locations", locId, "inventory", itemId), { quantity: newQty, updatedAt: new Date().toISOString() });
}
setSaving(false);
onClose();
};

const inp = { width: 70, padding: "5px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, outline: "none" };

return (
<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
<div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "80vh", overflowY: "auto" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
<div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>Materials Used</div>
<button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>x</button>
</div>
<div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Task: <b>{task?.title}</b></div>
{items.length === 0 ? (
<div style={{ color: "#9ca3af", fontSize: 13 }}>No inventory items found. Add items in the Inventory section first.</div>
) : items.map(item => (
<div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
<div style={{ flex: 1 }}>
<div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
<div style={{ fontSize: 12, color: "#9ca3af" }}>Available: {item.quantity} {item.unit}</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
<span>Used:</span>
<input type="number" min="0" max={item.quantity} value={selected[item.id] || ""} onChange={e => handleQty(item.id, e.target.value)} placeholder="0" style={inp} />
<span>{item.unit}</span>
</div>
</div>
))}
<div style={{ display: "flex", gap: 10, marginTop: 20 }}>
<button onClick={handleSave} disabled={saving} style={{ flex: 1, background: "#1a3352", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving..." : "Deduct from Inventory"}</button>
<button onClick={onClose} style={{ flex: 1, background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
</div>
</div>
</div>
);
}

//  CALENDAR
function Calendar({ locId, locationName, tasks, sensors, location }) {
const [currentDate, setCurrentDate] = useState(new Date());
const [selectedDate, setSelectedDate] = useState(null);
const [daySummaries, setDaySummaries] = useState({});
const [weather, setWeather] = useState({});
const [selectedSummary, setSelectedSummary] = useState(null);
const [noteText, setNoteText] = useState("");
const [savingNote, setSavingNote] = useState(false);

const year = currentDate.getFullYear();
const month = currentDate.getMonth();
const today = new Date().toISOString().split("T")[0];

useEffect(() => {
if (!locId) return;
const unsub = onSnapshot(collection(db, "locations", locId, "daySummaries"), snap => {
const summaries = {};
snap.docs.forEach(d => { summaries[d.id] = d.data(); });
setDaySummaries(summaries);
});
return unsub;
}, [locId]);

const fetchWeather = async (dateStr) => {
    const zip = location?.zipCode;
    if (!zip) return;
    try {
      const geoRes = await fetch("https://api.zippopotam.us/us/" + zip);
      if (!geoRes.ok) return;
      const geoData = await geoRes.json();
      if (!geoData.places?.length) return;
      const latitude = parseFloat(geoData.places[0].latitude);
      const longitude = parseFloat(geoData.places[0].longitude);
      const today = new Date().toISOString().split("T")[0];
      const isPast = dateStr < today;
      const endpoint = isPast
        ? "https://archive-api.open-meteo.com/v1/archive?latitude=" + latitude + "&longitude=" + longitude + "&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,rain_sum,snowfall_sum&timezone=auto&start_date=" + dateStr + "&end_date=" + dateStr
        : "https://api.open-meteo.com/v1/forecast?latitude=" + latitude + "&longitude=" + longitude + "&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,rain_sum,snowfall_sum&timezone=auto&start_date=" + dateStr + "&end_date=" + dateStr;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.daily) {
        const code = data.daily.weathercode?.[0] ?? 0;
        const max = Math.round((data.daily.temperature_2m_max?.[0] ?? 0) * 9/5 + 32);
        const min = Math.round((data.daily.temperature_2m_min?.[0] ?? 0) * 9/5 + 32);
        const desc = code <= 1 ? "Sunny" : code <= 3 ? "Partly Cloudy" : code <= 48 ? "Foggy" : code <= 67 ? "Rainy" : code <= 77 ? "Snowy" : "Stormy";
        const precipMM = data.daily.precipitation_sum?.[0] ?? 0;
        const rainMM = data.daily.rain_sum?.[0] ?? 0;
        const snowMM = data.daily.snowfall_sum?.[0] ?? 0;
        const precipIn = Math.round(precipMM * 0.03937 * 100) / 100;
        const precipType = snowMM > 0 ? "Snow" : rainMM > 0 ? "Rain" : precipMM > 0 ? "Mixed" : "None";
        setWeather(p => ({ ...p, [dateStr]: { max, min, desc, precip: precipIn, precipType } }));
      }
    } catch(e) { console.log("Weather fetch error:", e.message, e); }
  };

const handleSelectDate = async (dateStr) => {
setSelectedDate(dateStr);
setNoteText(daySummaries[dateStr]?.note || "");
// Try to get weather - use default coords if no location coords
fetchWeather(dateStr);
// Auto-save day summary if today
if (dateStr === today) {
const doneTasks = tasks.filter(t => t.status === "done").length;
const totalTasks = tasks.length;
await setDoc(doc(db, "locations", locId, "daySummaries", dateStr), {
date: dateStr,
carsWashed: sensors?.carsToday || 0,
tasksDone: doneTasks,
tasksTotal: totalTasks,
equipmentAlerts: 0,
updatedAt: new Date().toISOString(),
}, { merge: true });
}
setSelectedSummary(daySummaries[dateStr] || null);
};

const handleSaveNote = async () => {
if (!selectedDate) return;
setSavingNote(true);
await setDoc(doc(db, "locations", locId, "daySummaries", selectedDate), { note: noteText, date: selectedDate, updatedAt: new Date().toISOString() }, { merge: true });
setSavingNote(false);
};

const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

const daysInMonth = getDaysInMonth(year, month);
const firstDay = getFirstDayOfMonth(year, month);
const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

const dateStr = (d) => year + "-" + String(month + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");

const summary = selectedDate ? (daySummaries[selectedDate] || {}) : null;
const selWeather = selectedDate ? weather[selectedDate] : null;

return (
<div>
<div style={{ marginBottom: 22 }}>
<div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Calendar</div>
<div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>{locationName}</div>
</div>

  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
    {/* Calendar grid */}
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 14 }}>{"<"}</button>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>{monthName}</div>
        <button onClick={nextMonth} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 14 }}>{">"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 8 }}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9ca3af", padding: "4px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {Array(firstDay).fill(null).map((_, i) => <div key={"e"+i} />)}
        {Array(daysInMonth).fill(null).map((_, i) => {
          const d = i + 1;
          const ds = dateStr(d);
          const isToday = ds === today;
          const isSelected = ds === selectedDate;
          const hasSummary = !!daySummaries[ds];
          const isPast = ds < today;
          return (
            <button key={d} onClick={() => handleSelectDate(ds)} style={{
              aspectRatio: "1", borderRadius: 8, border: isSelected ? "2px solid #1a3352" : "1px solid transparent",
              background: isToday ? "#1a3352" : isSelected ? "#e0e7ff" : hasSummary ? "#f0fdf4" : "#fafafa",
              color: isToday ? "#fff" : "#111827",
              cursor: "pointer", fontSize: 13, fontWeight: isToday || isSelected ? 700 : 400,
              display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 2,
              padding: "4px 2px",
            }}>
              {d}
              {hasSummary && <div style={{ width: 4, height: 4, borderRadius: "50%", background: isToday ? "#34d399" : "#10b981" }} />}
            </button>
          );
        })}
      </div>
    </div>

    {/* Day summary panel */}
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
      {!location?.zipCode && (
    <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#92400e" }}>
      No zip code set for this location. Add one in Settings to enable weather data.
    </div>
  )}
  {!selectedDate ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#128197;</div>
          Select a date to view summary
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 16 }}>
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </div>
          {selWeather && (
            <div style={{ background: "#f0f9ff", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: "#0369a1" }}>{selWeather.desc}</div>
                  {weather["debug"] && <div style={{ fontSize: 10, color: "#999", wordBreak: "break-all" }}>{weather["debug"]}</div>}
              <div style={{ color: "#0284c7" }}>High {selWeather.max}F / Low {selWeather.min}F</div>
                  <div style={{ color: "#0369a1", marginTop: 4, fontSize: 12 }}>
                    {selWeather.precipType === "Snow" ? "Snowfall" : "Precipitation"}: {selWeather.precip !== undefined ? (selWeather.precip > 0 ? selWeather.precip + '"' : "None") : selWeather.desc ? "0\"" : "Loading..."}
                  </div>
            </div>
          )}
          {summary?.carsWashed != null && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>{summary.carsWashed}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Cars Washed</div>
              </div>
              <div style={{ background: "#ede9fe", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#7c3aed" }}>{summary.tasksDone}/{summary.tasksTotal}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Tasks Done</div>
              </div>
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Notes / Issues</label>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={4} placeholder="Add notes about this day..." style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 12, resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          </div>
          <button onClick={handleSaveNote} disabled={savingNote} style={{ width: "100%", background: "#1a3352", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{savingNote ? "Saving..." : "Save Notes"}</button>
        </div>
      )}
    </div>
  </div>
</div>

);
}


function MultiLocOverview({ locations, tasks, sensors, equipment, onNavigate }) {
  const totalCars = locations.reduce((sum, loc) => sum + (sensors[loc.id]?.carsToday || 0), 0);
  const totalDone = locations.reduce((sum, loc) => sum + (tasks[loc.id] || []).filter(t => t.status === "done").length, 0);
  const totalTasks = locations.reduce((sum, loc) => sum + (tasks[loc.id] || []).length, 0);
  const totalAlerts = locations.reduce((sum, loc) => sum + (equipment[loc.id] || []).filter(e => e.status !== "ok").length, 0);
  const overdueTasks = locations.reduce((sum, loc) => sum + (tasks[loc.id] || []).filter(t => t.status !== "done" && t.due && t.due.includes("-") && new Date(t.due + "T23:59:59") < new Date()).length, 0);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>All Locations Overview</div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
      </div>

      {/* Total stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 13, marginBottom: 24 }}>
        <StatCard label="Total Cars Today" value={totalCars} accent="#0ea5e9" />
        <StatCard label="Tasks Complete" value={totalDone + "/" + totalTasks} sub={totalTasks ? Math.round(totalDone/totalTasks*100) + "%" : "0%"} accent="#10b981" />
        <StatCard label="Equip Alerts" value={totalAlerts} alert={totalAlerts > 0} accent="#ef4444" />
        <StatCard label="Overdue Tasks" value={overdueTasks} alert={overdueTasks > 0} accent="#f59e0b" />
      </div>

      {/* Per-location cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {locations.map(loc => {
          const locTasks = tasks[loc.id] || [];
          const locSensors = sensors[loc.id] || {};
          const locEquip = equipment[loc.id] || [];
          const done = locTasks.filter(t => t.status === "done").length;
          const pct = locTasks.length ? Math.round(done/locTasks.length*100) : 0;
          const alerts = locEquip.filter(e => e.status !== "ok").length;
          const overdue = locTasks.filter(t => t.status !== "done" && t.due && t.due.includes("-") && new Date(t.due + "T23:59:59") < new Date()).length;

          return (
            <div key={loc.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>{loc.name}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {alerts > 0 && <span style={{ background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{alerts} alert{alerts > 1 ? "s" : ""}</span>}
                  {overdue > 0 && <span style={{ background: "#fef3c7", color: "#d97706", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{overdue} overdue</span>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ background: "#f0f9ff", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#0369a1" }}>{locSensors.carsToday || 0}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Cars Today</div>
                </div>
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>{pct}%</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Tasks Done</div>
                </div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                  <span>Task Progress</span><span>{done}/{locTasks.length}</span>
                </div>
                <div style={{ height: 6, background: "#e5e7eb", borderRadius: 99 }}>
                  <div style={{ height: "100%", width: pct + "%", background: pct === 100 ? "#10b981" : "#6366f1", borderRadius: 99 }} />
                </div>
              </div>
              {[
                { label: "Soap", val: locSensors.soapLevel, c: "#8b5cf6" },
                { label: "Rinse Aid", val: locSensors.rinseAid, c: "#0ea5e9" },
              ].map(s => s.val != null && (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: "#6b7280", width: 50 }}>{s.label}</span>
                  <div style={{ flex: 1, height: 4, background: "#e5e7eb", borderRadius: 99 }}>
                    <div style={{ height: "100%", width: s.val + "%", background: s.val < 30 ? "#ef4444" : s.c, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 11, color: s.val < 30 ? "#ef4444" : "#6b7280", fontWeight: 600, width: 28 }}>{s.val}%</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function SensorPushIntegration({ locations }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [sensors, setSensors] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "integrations", "sensorpush"));
        if (snap.exists()) {
          const data = snap.data();
          if (data.accessToken) {
            setConnected(true);
            setEmail(data.email || "");
            if (data.sensors) setSensors(data.sensors);
            if (data.assignments) setAssignments(data.assignments);
          }
        }
      } catch(e) {}
      setLoadingConfig(false);
    };
    load();
  }, []);

  const handleConnect = async () => {
    if (!email || !password) return;
    setConnecting(true);
    setError("");
    try {
      const authRes = await fetch("https://api.sensorpush.com/api/v1/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const authData = await authRes.json();
      if (!authData.authorization) throw new Error(authData.message || "Invalid credentials");
      const tokenRes = await fetch("https://api.sensorpush.com/api/v1/oauth/accesstoken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorization: authData.authorization })
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.accesstoken) throw new Error("Could not get access token");
      const sensRes = await fetch("https://api.sensorpush.com/api/v1/devices/sensors", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": tokenData.accesstoken },
        body: JSON.stringify({})
      });
      const sensData = await sensRes.json();
      const sensorList = Object.entries(sensData).map(([id, s]) => ({
        id, name: s.name, active: s.active
      }));
      await setDoc(doc(db, "users", user.uid, "integrations", "sensorpush"), {
        email,
        accessToken: tokenData.accesstoken,
        sensors: sensorList,
        assignments: assignments,
        updatedAt: new Date().toISOString()
      });
      setSensors(sensorList);
      setConnected(true);
    } catch(e) {
      setError(e.message || "Connection failed. Check credentials.");
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    await setDoc(doc(db, "users", user.uid, "integrations", "sensorpush"), { disconnected: true }, { merge: false });
    setConnected(false);
    setSensors([]);
    setAssignments({});
    setEmail("");
    setPassword("");
  };

  const handleSaveAssignments = async () => {
    setSaving(true);
    await updateDoc(doc(db, "users", user.uid, "integrations", "sensorpush"), { assignments });
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const inp = { width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", color: "#111827", background: "#fff", boxSizing: "border-box", marginTop: 6 };

  if (loadingConfig) return <div style={{ padding: 20, color: "#9ca3af", fontSize: 13 }}>Loading...</div>;

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>SensorPush</div>
        {connected && <span style={{ background: "#d1fae5", color: "#065f46", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>Connected</span>}
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>Temperature and humidity sensors</div>
      {!connected ? (
        <div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>SensorPush Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com" style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="password" style={inp} />
          </div>
          {error && <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button onClick={handleConnect} disabled={connecting} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}>
            {connecting ? "Connecting..." : "Connect SensorPush"}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
            Connected as <strong>{email}</strong>. Assign sensors to locations below.
          </div>
          {sensors.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>No sensors found on your account.</div>}
          {sensors.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "10px 12px", background: "#f9fafb", borderRadius: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{s.id}</div>
              </div>
              <select value={assignments[s.id] || ""} onChange={e => setAssignments(p => ({ ...p, [s.id]: e.target.value }))}
                style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: 7, fontSize: 12, outline: "none", color: "#374151", background: "#fff" }}>
                <option value="">Unassigned</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          ))}
          {sensors.length > 0 && (
            <button onClick={handleSaveAssignments} disabled={saving} style={{ background: savedMsg ? "#10b981" : "#1a3352", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%", marginTop: 8 }}>
              {saving ? "Saving..." : savedMsg ? "Saved!" : "Save Assignments"}
            </button>
          )}
          <button onClick={handleDisconnect} style={{ background: "none", color: "#ef4444", border: "none", fontSize: 12, cursor: "pointer", marginTop: 12, padding: 0 }}>Disconnect SensorPush</button>
        </div>
      )}
    </div>
  );
}

function SpSensorMini({ sensors, onNavigate, locId, uid }) {
  const user = { uid };
  const s = sensors || {};
  const [spSensors, setSpSensors] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "integrations", "sensorpush"));
        if (!snap.exists() || snap.data().disconnected) return;
        const { sensors: sensorList, assignments } = snap.data();
        if (!sensorList) return;
        setSpSensors(sensorList.filter(s => assignments?.[s.id] === locId));
      } catch(e) {}
    };
    load();
  }, [locId]);

  if (!spSensors.length) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>SensorPush</div>
      {spSensors.map(sp => {
        const reading = s["sp_" + sp.id] || {};
        const temp = reading.tempF ?? s.spTempF;
        const hum = reading.humidity ?? s.spHumidity;
        return (
          <div key={sp.id} onClick={() => onNavigate("sensors")}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "#f0f9ff", borderRadius: 8, marginBottom: 6, cursor: "pointer" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1e40af" }}>{sp.name}</span>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 700 }}>{temp != null ? temp + "F" : "--"}</span>
              <span style={{ fontSize: 12, color: "#0891b2", fontWeight: 700 }}>{hum != null ? hum + "%" : "--"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function Settings({ locations, onUpdateLocation, user }) {
const { refreshUser } = useAuth();
const [editing, setEditing] = useState(null);
const [name, setName] = useState("");
const [address, setAddress] = useState("");
const [zipCode, setZipCode] = useState("");
const [saved, setSaved] = useState(false);
const [profileName, setProfileName] = useState(user?.name || user?.email?.split("@")[0] || "");
const [profileSaved, setProfileSaved] = useState(false);

const handleSaveProfile = async () => {
  if (!profileName.trim()) return;
  await updateDoc(doc(db, "users", user.uid), { name: profileName, updatedAt: new Date().toISOString() });
  await refreshUser();
  setProfileSaved(true);
  setTimeout(() => setProfileSaved(false), 2000);
};

const startEdit = (loc) => {
setEditing(loc.id);
setName(loc.name);
setAddress(loc.address || "");
setZipCode(loc.zipCode || "");
setSaved(false);
};

const handleSave = async (locId) => {
if (locId === "**new**") {
const newId = "loc" + Date.now();
await setDoc(doc(db, "locations", newId), { id: newId, name, address, zipCode });
} else {
await onUpdateLocation(locId, { name, address, zipCode });
}
setEditing(null);
setSaved(true);
setTimeout(() => setSaved(false), 2000);
};

const inp = { width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 6, background: "#fafafa" };

return (
<div>
<div style={{ marginBottom: 22 }}>
<div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Settings</div>
<div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>Manage locations and preferences</div>
</div>
<div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 18 }}>
  <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 16 }}>Your Profile</div>
  <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Display Name</label>
    <input value={profileName} onChange={e => setProfileName(e.target.value)}
      style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 6, background: "#fafafa" }}
      placeholder="Your name" />
  </div>
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Email</label>
    <div style={{ padding: "9px 12px", background: "#f3f4f6", borderRadius: 8, fontSize: 13, color: "#6b7280", marginTop: 6 }}>{user?.email}</div>
  </div>
  <button onClick={handleSaveProfile} style={{ background: profileSaved ? "#10b981" : "#1a3352", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
    {profileSaved ? "Saved!" : "Save Profile"}
  </button>
</div>
{!user?.isTeamMember && <TeamMembers user={user} locations={locations} />}
<div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 18 }}>
  <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 16 }}>Your Profile</div>
  <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Display Name</label>
    <input value={profileName} onChange={e => setProfileName(e.target.value)}
      style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 6, background: "#fafafa" }}
      placeholder="Your name" />
  </div>
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Email</label>
    <div style={{ padding: "9px 12px", background: "#f3f4f6", borderRadius: 8, fontSize: 13, color: "#6b7280", marginTop: 6 }}>{user?.email}</div>
  </div>
  <button onClick={handleSaveProfile} style={{ background: profileSaved ? "#10b981" : "#1a3352", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
    {profileSaved ? "Saved!" : "Save Profile"}
  </button>
</div>
{saved && (
<div style={{ background: "#d1fae5", color: "#065f46", padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
Changes saved!
</div>
)}
<div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 18 }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
<div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Locations</div>
<button onClick={() => setEditing("**new**")} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Add Location</button>
</div>
{locations.map(loc => (
<div key={loc.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
{editing === loc.id ? (
<div>
<div style={{ marginBottom: 12 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Location Name</label>
<input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="e.g. North Station" />
</div>
<div style={{ marginBottom: 12 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Address</label>
<input value={address} onChange={e => setAddress(e.target.value)} style={inp} placeholder="e.g. 1240 N. Highway Blvd" />
</div>
<div style={{ marginBottom: 14 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Zip Code (for weather)</label>
<input value={zipCode} onChange={e => setZipCode(e.target.value)} style={inp} placeholder="e.g. 90210" maxLength={5} />
</div>
<div style={{ display: "flex", gap: 8 }}>
<button onClick={() => handleSave(loc.id)} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
<button onClick={() => setEditing(null)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
</div>
</div>
) : (
<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
<div style={{ flex: 1 }}>
<div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{loc.name}</div>
<div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{loc.address || "No address set"}</div>
</div>
<button onClick={() => startEdit(loc)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit</button>
</div>
)}
</div>
))}
{editing === "**new**" && (
<div style={{ border: "1.5px dashed #6366f1", borderRadius: 10, padding: 16, marginBottom: 12, background: "#f5f3ff" }}>
<div style={{ fontWeight: 600, fontSize: 13, color: "#6366f1", marginBottom: 12 }}>New Location</div>
<div style={{ marginBottom: 12 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Location Name</label>
<input value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 4, background: "#fff" }} placeholder="e.g. East Side Wash" />
</div>
<div style={{ marginBottom: 12 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Address</label>
<input value={address} onChange={e => setAddress(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 4, background: "#fff" }} placeholder="e.g. 999 Main St" />
</div>
<div style={{ marginBottom: 14 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Zip Code (for weather)</label>
<input value={zipCode} onChange={e => setZipCode(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 4, background: "#fff" }} placeholder="e.g. 90210" maxLength={5} />
</div>
<div style={{ display: "flex", gap: 8 }}>
<button onClick={() => handleSave("**new**")} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Create</button>
<button onClick={() => setEditing(null)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
</div>
</div>
)}
</div>
<div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 18 }}>
<div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 16 }}>Integrations</div>
<SensorPushIntegration locations={locations} />
</div>
<div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
<div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 8 }}>Coming Soon</div>
<div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.7 }}>
User management, task templates, and notification preferences will be available in the full production version.
</div>
</div>
</div>
);
}


function CarCounts({ locations }) {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [counts, setCounts] = useState({});
  const [saved, setSaved] = useState({});
  const [saving, setSaving] = useState({});
  const [loaded, setLoaded] = useState({});

  useEffect(() => {
    if (!selectedDate) return;
    setLoaded({});
    locations.forEach(async loc => {
      const snap = await getDoc(doc(db, "locations", loc.id, "daySummaries", selectedDate));
      const cars = snap.exists() ? (snap.data().carsWashed ?? "") : "";
      setCounts(p => ({ ...p, [loc.id]: cars === 0 ? "0" : cars || "" }));
      setLoaded(p => ({ ...p, [loc.id]: true }));
    });
  }, [selectedDate, locations.length]);

  const handleSave = async (locId) => {
    const val = parseInt(counts[locId]) || 0;
    setSaving(p => ({ ...p, [locId]: true }));
    await setDoc(doc(db, "locations", locId, "daySummaries", selectedDate), {
      carsWashed: val, date: selectedDate, updatedAt: new Date().toISOString(),
    }, { merge: true });
    setSaving(p => ({ ...p, [locId]: false }));
    setSaved(p => ({ ...p, [locId]: true }));
    setTimeout(() => setSaved(p => ({ ...p, [locId]: false })), 2000);
  };

  const totalCars = Object.values(counts).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  const goDay = (offset) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split("T")[0]);
  };
  const displayDate = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const isToday = selectedDate === today;

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Car Counts</div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>Log daily car counts per location</div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => goDay(-1)} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 16, cursor: "pointer", color: "#374151", fontWeight: 700 }}>{"<"}</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{displayDate}</div>
          {isToday && <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600, marginTop: 2 }}>Today</div>}
        </div>
        <button onClick={() => goDay(1)} disabled={isToday} style={{ background: isToday ? "#f9fafb" : "#f3f4f6", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 16, cursor: isToday ? "not-allowed" : "pointer", color: isToday ? "#d1d5db" : "#374151", fontWeight: 700 }}>{">"}</button>
      </div>
      <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Jump to date:</label>
        <input type="date" value={selectedDate} max={today} onChange={e => e.target.value && setSelectedDate(e.target.value)}
          style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", color: "#111827", background: "#fff" }} />
        {!isToday && <button onClick={() => setSelectedDate(today)} style={{ background: "#f3f4f6", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Today</button>}
      </div>
      <div style={{ background: "linear-gradient(135deg, #1a3352, #0ea5e9)", borderRadius: 12, padding: "14px 20px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>Total Cars</div>
        <div style={{ color: "#fff", fontSize: 28, fontWeight: 800 }}>{totalCars}</div>
      </div>
      {locations.map(loc => (
        <div key={loc.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{loc.name}</div>
            {saved[loc.id] && <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>Saved!</span>}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setCounts(p => ({ ...p, [loc.id]: Math.max(0, (parseInt(p[loc.id]) || 0) - 1) }))}
              style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 40, height: 40, fontSize: 20, cursor: "pointer", color: "#374151", fontWeight: 700 }}>-</button>
            <input type="number" min="0"
              value={loaded[loc.id] ? (counts[loc.id] ?? "") : ""}
              placeholder={loaded[loc.id] ? "0" : "..."}
              onChange={e => setCounts(p => ({ ...p, [loc.id]: e.target.value }))}
              style={{ flex: 1, padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 22, fontWeight: 700, textAlign: "center", outline: "none", color: "#111827", background: "#fafafa" }} />
            <button onClick={() => setCounts(p => ({ ...p, [loc.id]: (parseInt(p[loc.id]) || 0) + 1 }))}
              style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 40, height: 40, fontSize: 20, cursor: "pointer", color: "#374151", fontWeight: 700 }}>+</button>
          </div>
          <button onClick={() => handleSave(loc.id)} disabled={saving[loc.id]}
            style={{ width: "100%", marginTop: 12, background: saved[loc.id] ? "#10b981" : "#1a3352", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {saving[loc.id] ? "Saving..." : saved[loc.id] ? "Saved!" : "Save Count"}
          </button>
        </div>
      ))}
    </div>
  );
}

function TeamMembers({ user, locations }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("attendant");
  const [inviteLocs, setInviteLocs] = useState([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);

  useEffect(() => {
    const loadTeam = async () => {
      try {
        const memSnap = await getDocs(query(collection(db, "users"), where("ownerId", "==", user.uid), where("isTeamMember", "==", true)));
        setMembers(memSnap.docs.map(d => d.data()));
        const invSnap = await getDocs(query(collection(db, "invites"), where("ownerId", "==", user.uid)));
        setInvites(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(e) {}
    };
    loadTeam();
  }, [sent]);

  const handleInvite = async () => {
    if (!inviteEmail.includes("@")) { setError("Enter a valid email."); return; }
    setSending(true); setError("");
    try {
      await setDoc(doc(db, "invites", inviteEmail.toLowerCase() + "_" + user.uid), {
        email: inviteEmail.toLowerCase(), ownerId: user.uid, role: inviteRole,
        allowedLocations: inviteLocs, status: "pending", createdAt: new Date().toISOString()
      });
      setSent(true); setInviteEmail(""); setInviteLocs([]);
      setTimeout(() => setSent(false), 3000);
    } catch(e) { setError("Failed to send invite."); }
    setSending(false);
  };

  const handleRemove = async (uid) => {
    await updateDoc(doc(db, "users", uid), { ownerId: null, isTeamMember: false });
    setMembers(p => p.filter(m => m.uid !== uid));
  };

  const toggleLoc = (locId) => setInviteLocs(p => p.includes(locId) ? p.filter(l => l !== locId) : [...p, locId]);
  const inp = { width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 6, background: "#fafafa" };

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 4 }}>Team Members</div>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>Invite staff to access your dashboard</div>
      {members.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Active Members</div>
          {members.map(m => (
            <div key={m.uid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#f9fafb", borderRadius: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{m.name || m.email}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{m.email} — {m.role}</div>
              </div>
              <button onClick={() => handleRemove(m.uid)} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Remove</button>
            </div>
          ))}
        </div>
      )}
      {invites.filter(i => i.status === "pending").length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Pending Invites</div>
          {invites.filter(i => i.status === "pending").map(inv => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#fffbeb", borderRadius: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{inv.email}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{inv.role} — Pending</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Send Invite</div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Email Address</label>
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} type="email" placeholder="staff@email.com" style={inp} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Role</label>
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...inp, marginTop: 6 }}>
            <option value="attendant">Attendant - Limited access</option>
            <option value="manager">Manager - Full access</option>
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Location Access</label>
          {locations.map(l => (
            <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={inviteLocs.includes(l.id)} onChange={() => toggleLoc(l.id)} style={{ width: 15, height: 15, accentColor: "#1a3352" }} />
              <span style={{ fontSize: 13, color: "#374151" }}>{l.name}</span>
            </label>
          ))}
        </div>
        {error && <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {sent && <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 10 }}>Invite saved! Have them create an account at WashLevel.com with this email.</div>}
        <button onClick={handleInvite} disabled={sending} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}>
          {sending ? "Saving..." : "Send Invite"}
        </button>
      </div>
    </div>
  );
}
function Dashboard() {
const { user } = useAuth();
const [locations, setLocations] = useState([]);
const [tasks, setTasks] = useState({});
const [sensors, setSensors] = useState({});
const [equipment, setEquipment] = useState({});
const [view, setView] = useState("overview");
const [locId, setLocId] = useState(null);
const [ready, setReady] = useState(false);
const [showAddTask, setShowAddTask] = useState(false);
const [materialsTask, setMaterialsTask] = useState(null);
  const [taskPreset, setTaskPreset] = useState(null);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertSaved, setAlertSaved] = useState(false);

  const handleSaveAlertEmail = async () => {
    if (!alertEmail.includes("@")) return;
    await updateDoc(doc(db, "users", user.uid), { alertEmail, updatedAt: new Date().toISOString() });
    setAlertSaved(true);
    setTimeout(() => setAlertSaved(false), 3000);
  };
const [sidebarOpen, setSidebarOpen] = useState(false);
const isMobile = useIsMobile();

useEffect(() => {
if (!user) return;
const unsub = onSnapshot(query(collection(db, "locations"), where("ownerId", "==", user.uid)), snap => {
const allLocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
const locs = user.isTeamMember && allowedLocs.length ? allLocs.filter(l => allowedLocs.includes(l.id)) : allLocs;
setLocations(locs);
setLocId(id => id || user.locationId || locs[0]?.id);
setReady(true);
});
return unsub;
}, [user?.uid]);

useEffect(() => {
if (!locations.length) return;
const unsubs = [
...locations.map(loc => onSnapshot(collection(db, "locations", loc.id, "tasks"), snap => setTasks(p => ({ ...p, [loc.id]: snap.docs.map(d => ({ id: d.id, ...d.data() })) })))),
...locations.map(loc => onSnapshot(collection(db, "locations", loc.id, "equipment"), snap => setEquipment(p => ({ ...p, [loc.id]: snap.docs.map(d => ({ id: d.id, ...d.data() })) })))),
...locations.map(loc => onSnapshot(collection(db, "locations", loc.id, "inventory"), snap => setInventory(p => ({ ...p, [loc.id]: snap.docs.map(d => ({ id: d.id, ...d.data() })) })))),
      ...locations.map(loc => onSnapshot(doc(db, "sensors", loc.id), snap => snap.exists() && setSensors(p => ({ ...p, [loc.id]: snap.data() })))),
];
return () => unsubs.forEach(u => u());
}, [locations.length]);


  // SensorPush background polling
  useEffect(() => {
    const pollSensorPush = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "integrations", "sensorpush"));
        if (!snap.exists() || snap.data().disconnected) return;
        const { accessToken, assignments, sensors: sensorList } = snap.data();
        if (!accessToken || !assignments) return;
        const tokenRes = await fetch("https://api.sensorpush.com/api/v1/oauth/accesstoken", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorization: accessToken })
        });
        const tokenData = await tokenRes.json();
        const token = tokenData.accesstoken || accessToken;
        const sampRes = await fetch("https://api.sensorpush.com/api/v1/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": token },
          body: JSON.stringify({ limit: 1 })
        });
        const sampData = await sampRes.json();
        const locUpdates = {};
        Object.entries(assignments).forEach(([sensorId, locId]) => {
          if (!locId) return;
          const samples = sampData.sensors?.[sensorId];
          if (!samples?.length) return;
          const latest = samples[0];
          if (!locUpdates[locId]) locUpdates[locId] = {};
          locUpdates[locId].spTempF = latest.temperature != null ? Math.round(latest.temperature * 10) / 10 : null;
          locUpdates[locId].spHumidity = latest.humidity != null ? Math.round(latest.humidity * 10) / 10 : null;
        });
        await Promise.all(Object.entries(locUpdates).map(([locId, data]) =>
          setDoc(doc(db, "sensors", locId), { ...data, spUpdatedAt: new Date().toISOString() }, { merge: true })
        ));
        if (tokenData.accesstoken) {
          await updateDoc(doc(db, "users", user.uid, "integrations", "sensorpush"), { accessToken: tokenData.accesstoken });
        }
      } catch(e) { console.log("SensorPush poll error:", e.message); }
    };
    pollSensorPush();
    const interval = setInterval(pollSensorPush, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateLocation = async (locId, updates) => {
await updateDoc(doc(db, "locations", locId), updates);
};

const handleStatus = async (taskId, newStatus) => {
if (!locId) return;
await updateDoc(doc(db, "locations", locId, "tasks", taskId), { status: newStatus, updatedAt: new Date().toISOString() });
};

const handleSaveNote = async (taskId, note) => {
if (!locId) return;
await updateDoc(doc(db, "locations", locId, "tasks", taskId), { note, updatedAt: new Date().toISOString() });
};

if (!ready) return <Spinner />;
if (!locId || !locations.length) if (user?.role === "manager" && !locations.length) return <Spinner />; else return (
  <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ textAlign: "center", maxWidth: 400, padding: 32 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚗</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Welcome to WashLevel!</div>
      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>Let's set up your first car wash location to get started.</div>
      <button onClick={async () => {
        const locId = "loc_" + Date.now();
        await setDoc(doc(db, "locations", locId), {
          id: locId, name: "My Car Wash", address: "", zipCode: "",
          ownerId: user.uid, createdAt: new Date().toISOString()
        });
        await updateDoc(doc(db, "users", user.uid), { locationId: locId });
      }} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 10, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        Create My First Location
      </button>
      <div style={{ marginTop: 16, fontSize: 13, color: "#6b7280" }}>Signed in as <b>{user.email}</b></div>
      <div style={{ marginTop: 10 }}>
        <button onClick={() => logout()} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>Sign out and use a different account</button>
      </div>
    </div>
  </div>
);

const curLoc = locations.find(l => l.id === locId);
const curTasks = tasks[locId] || [];
const curSens = sensors[locId] || null;
const curEquip = equipment[locId] || [];

return (
<div style={{ display: "flex", height: "100vh", background: "#f8fafc", overflow: "hidden" }}>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
<Sidebar locations={locations} view={view} setView={setView} locId={locId} setLocId={setLocId} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
<main style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px" : "28px 32px", paddingTop: isMobile ? "56px" : undefined }}>
      {isMobile && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 48, background: "#1a3352", display: "flex", alignItems: "center", paddingLeft: 12, zIndex: 30 }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ width: 22, height: 2, background: "#fff", borderRadius: 2 }} />
            <div style={{ width: 22, height: 2, background: "#fff", borderRadius: 2 }} />
            <div style={{ width: 22, height: 2, background: "#fff", borderRadius: 2 }} />
          </button>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginLeft: 8 }}>WashLevel</span>
          <span style={{ background: "#0ea5e9", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 3, padding: "2px 5px", marginLeft: 6 }}>PRO</span>
        </div>
      )}
{view === "overview" && <Overview location={curLoc} tasks={curTasks} sensors={curSens} equipment={curEquip} onNavigate={setView} user={user} />}
{view === "tasks"     && <Tasks tasks={curTasks} onStatus={handleStatus} showAll={false} locationName={curLoc?.name} onAddTask={() => setShowAddTask(true)} onSaveNote={handleSaveNote} locId={locId} onSelectMaterials={setMaterialsTask} />}
{view === "all-tasks" && <Tasks tasks={curTasks} onStatus={handleStatus} showAll={true} locationName={curLoc?.name} onAddTask={() => setShowAddTask(true)} onSaveNote={handleSaveNote} locId={locId} onSelectMaterials={setMaterialsTask} />}
{view === "timeclock" && <TimeClock locId={locId} locationName={curLoc?.name} allLocations={locations} />}
{view === "inventory" && <Inventory locId={locId} locationName={curLoc?.name} />}
{view === "equipment" && <Equipment equipment={curEquip} locationName={curLoc?.name} locId={locId} allTasks={curTasks} onCreateTask={eq => { setTaskPreset(eq); setShowAddTask(true); }} />}
        {view === "alerts" && (
          <div style={{ maxWidth: 600 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Alert Settings</div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>Configure how and when you receive notifications</div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 4 }}>Email Notifications</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>Email delivery will be activated in a future update.</div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Email Address</label>
              <input value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="your@email.com" type="email" style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", color: "#111827", background: "#fff", boxSizing: "border-box", marginBottom: 12 }} />
              <button onClick={handleSaveAlertEmail} style={{ background: "#1a3352", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{alertSaved ? "Saved!" : "Save Email"}</button>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14 }}>Alert Frequency</div>
              {["Immediately", "Daily Digest", "Weekly Summary"].map(opt => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer" }}>
                  <input type="checkbox" defaultChecked={opt === "Immediately"} style={{ width: 16, height: 16, accentColor: "#1a3352", cursor: "pointer" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{opt}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{opt === "Immediately" ? "Notified as soon as triggered" : opt === "Daily Digest" ? "Summary every morning at 7am" : "Weekly summary every Monday"}</div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14 }}>Alert Preferences</div>
              {[
                { label: "Overdue Tasks", desc: "Task passes due date without completion" },
                { label: "Low Inventory", desc: "Item falls below low stock threshold" },
                { label: "Low Sensor Readings", desc: "Chemical or fluid levels drop too low" },
                { label: "Equipment Alerts", desc: "Equipment status changes to warning or alert" },
                { label: "New Task Created", desc: "New task added at your location" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{item.desc}</div>
                  </div>
                  <input type="checkbox" defaultChecked style={{ width: 18, height: 18, accentColor: "#1a3352", cursor: "pointer" }} />
                </div>
              ))}
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 4 }}>Quiet Hours</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>No alerts during these hours</div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>From</label>
                  <input type="time" defaultValue="22:00" style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ fontSize: 13, color: "#9ca3af", paddingTop: 20 }}>to</div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>To</label>
                  <input type="time" defaultValue="07:00" style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
            </div>
          </div>
        )}
        {view === "calendar"  && <Calendar locId={locId} locationName={curLoc?.name} tasks={curTasks} sensors={curSens} location={curLoc} />}
        {view === "carcounts" && <CarCounts locations={locations} />}
{view === "sensors"   && <Sensors sensors={curSens} locationName={curLoc?.name} locId={locId} onNavigate={setView} uid={user?.uid} />}
{view === "settings"  && <Settings locations={locations} onUpdateLocation={handleUpdateLocation} user={user} />}
</main>
{showAddTask && <AddTaskModal locId={locId} onClose={() => { setShowAddTask(false); setTaskPreset(null); }} onAdd={() => {}} preset={taskPreset} />}
{materialsTask && <MaterialsModal locId={locId} task={materialsTask} onClose={() => setMaterialsTask(null)} />}
</div>
);
}

function AppInner() {
const { user, loading } = useAuth();
if (loading) return <Spinner />;
return user ? <Dashboard /> : <Login />;
}

export default function App() {
return <AuthProvider><AppInner /></AuthProvider>;
}
