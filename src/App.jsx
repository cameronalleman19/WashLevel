// Paste into App.tsx, then in Dependencies panel add: firebase (10.8.0)

import React, { useState, useEffect, useRef, createContext, useContext, Component } from "react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import JsBarcode from "jsbarcode";
import { initializeApp, getApps } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import {
getAuth,
signInWithEmailAndPassword,
signOut,
onAuthStateChanged,
createUserWithEmailAndPassword,
sendPasswordResetEmail,
} from "firebase/auth";
import {
getFirestore,
collection,
doc,
setDoc,
addDoc,
getDoc,
getDocs,
updateDoc,
deleteDoc,
onSnapshot,
query,
where,
orderBy,
limit,
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
const functions = getFunctions(firebaseApp);
const storage = getStorage(firebaseApp);

const writeNotif = (userId, payload) =>
  addDoc(collection(db, "users", userId, "notifications"), { ...payload, read: false, createdAt: new Date().toISOString() });

// Reusable file upload helper
const uploadFile = async (file, path) => {
  const storageRef = ref(storage, path);
  if (file.type.startsWith("image/")) {
    // Compress images
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = async () => {
        const maxW = 1200;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          try {
            await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
            const url2 = await getDownloadURL(storageRef);
            URL.revokeObjectURL(url);
            resolve(url2);
          } catch(e) { reject(e); }
        }, "image/jpeg", 0.8);
      };
      img.onerror = reject;
      img.src = url;
    });
  } else {
    // PDFs and other files upload directly
    await uploadBytes(storageRef, file, { contentType: file.type });
    return await getDownloadURL(storageRef);
  }
};



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
loc1: { soapLevel: 62, rinseAid: 74, waxLevel: 55, waterPressure: 87, tempF: 68, conveyorRPM: 24, carsToday: 0 },
loc2: { soapLevel: 28, rinseAid: 18, waxLevel: 80, waterPressure: 91, tempF: 71, conveyorRPM: 22, carsToday: 0 },
loc3: { soapLevel: 85, rinseAid: 92, waxLevel: 66, waterPressure: 79, tempF: 66, conveyorRPM: 25, carsToday: 0 },
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
"manager@washlevel.com": { name: "Manager", role: "manager", locationId: null, color: "#6366f1" },
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

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);

const CAT = { supplies: { bg: "#fef3c7", color: "#b45309" }, equipment: { bg: "#dbeafe", color: "#1d4ed8" }, cleaning: { bg: "#d1fae5", color: "#065f46" }, chemicals: { bg: "#ede9fe", color: "#5b21b6" }, inspection: { bg: "#f0fdf4", color: "#15803d" } };
const PRI = { high: { bg: "#fee2e2", color: "#991b1b" }, medium: { bg: "#fef3c7", color: "#92400e" }, low: { bg: "#f1f5f9", color: "#64748b" } };
const STS = { pending: { bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8", label: "Pending" }, "in-progress": { bg: "#fef3c7", color: "#d97706", dot: "#f59e0b", label: "In Progress" }, "on-hold": { bg: "#fce7f3", color: "#be185d", dot: "#ec4899", label: "On Hold" }, done: { bg: "#d1fae5", color: "#059669", dot: "#10b981", label: "Done" } };
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
if (snap.exists()) {
  profile = snap.data();
  // Migrate existing account creators from manager to owner
  if (profile.role === "manager" && !profile.isTeamMember) {
    await updateDoc(doc(db, "users", fu.uid), { role: "owner" });
    profile = { ...profile, role: "owner" };
  }
} else await setDoc(doc(db, "users", fu.uid), { ...profile, email: fu.email });
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
<div style={{ height, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
<div style={{ height: "100%", width: `${Math.min(value || 0, 100)}%`, background: c, borderRadius: 99 }} />
</div>
);
};

const Avatar = ({ name = "", color = "#6366f1", size = 32 }) => {
const i = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
return <div style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff", fontWeight: 700, fontSize: size * 0.35, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i}</div>;
};

const StatCard = ({ icon, label, value, sub, accent = "#00d4aa", alert = false }) => (
  <div style={{
    background: "#fff",
    borderRadius: 14,
    padding: "18px 20px",
    boxShadow: alert ? "0 0 0 1.5px #fca5a5, 0 4px 16px rgba(0,0,0,0.06)" : "0 2px 12px rgba(0,0,0,0.06)",
    display: "flex", alignItems: "center", gap: 14,
    borderLeft: `3px solid ${alert ? "#ef4444" : accent}`,
    transition: "box-shadow 0.15s",
  }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: alert ? "#dc2626" : "#0f1f35", lineHeight: 1, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontWeight: 500 }}>{sub}</div>}
    </div>
    {icon && <div style={{ width: 36, height: 36, borderRadius: 9, background: alert ? "#fef2f2" : `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>}
  </div>
);

const Spinner = () => (

  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
    <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTop: "3px solid #1a3352", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}} input, textarea, select { color: #0f1f35 !important; background-color: #fff !important; } input::placeholder, textarea::placeholder { color: #94a3b8 !important; }`}</style>
  </div>
);

function Login({ defaultTab = "login", defaultEmail = "", ownerId = "", inviteBiz = "", inviteRole = "", debugRole = "" }) {
  const { login, signup } = useAuth();
  // Read params directly inside component as fallback
  const urlParams = new URLSearchParams(window.location.search);
  const urlRole = inviteRole || urlParams.get("role") || "";
  const urlBiz = inviteBiz || urlParams.get("biz") || "";
  const urlOwner = ownerId || urlParams.get("owner") || "";
  const [tab, setTab] = useState(defaultTab);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [bizName, setBizName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [checkingInvite, setCheckingInvite] = useState(false);

  useEffect(() => {
    if (defaultEmail && defaultEmail.includes("@")) {
      setTab("signup");
      const loadInvite = async () => {
        // Use URL params directly — no Firestore needed for unauthenticated users
        if (urlOwner || urlBiz) {
          setInviteData({
            bizName: urlBiz || "your team",
            ownerId: urlOwner,
            role: urlRole || "attendant",
            allowedLocations: []
          });
          return;
        }
        // Fallback: try Firestore
        try {
          const invSnap = await getDocs(query(collection(db, "invites"), where("email", "==", defaultEmail.toLowerCase())));
          if (!invSnap.empty) {
            const inv = invSnap.docs[0].data();
            setInviteData({ ...inv, bizName: inv.bizName || "your team", ownerId: inv.ownerId });
          }
        } catch(e) {}
      };
      loadInvite();
    }
  }, [defaultEmail]);

  const handleForgotPassword = async () => {
    if (!email) { setError("Enter your email address first."); return; }
    setResetLoading(true); setError("");
    try {
      const fn = httpsCallable(functions, "sendPasswordResetEmail");
      await fn({ email });
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
      const cred = await login(email, password);
      const uid = cred.user.uid;
      const inviteSnap = await getDocs(query(collection(db, "invites"), where("email", "==", email.toLowerCase()), where("status", "==", "pending")));
      if (!inviteSnap.empty) {
        const inviteDoc = inviteSnap.docs[0];
        const invite = inviteDoc.data();
        await updateDoc(doc(db, "users", uid), {
          ownerId: invite.ownerId,
          isTeamMember: true,
          role: invite.role || "attendant",
          allowedLocations: invite.allowedLocations || [],
          locationId: invite.locationId || null,
          updatedAt: new Date().toISOString()
        });
        await updateDoc(inviteDoc.ref, { status: "accepted", acceptedAt: new Date().toISOString() });
        window.location.reload();
        return;
      }
    } catch(e) {
      setError("Invalid email or password.");
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!name || !email || !password || (!bizName && !inviteData)) { setError("Please fill in all fields."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError(""); setLoading(true);
    try {
      const cred = await signup(email, password);
      const uid = cred.user.uid;
      // Check for invite by email regardless of status (in case already accepted from prev attempt)
      const inviteSnap = await getDocs(query(collection(db, "invites"), where("email", "==", email.toLowerCase())));
      const validInvite = inviteSnap.docs.find(d => d.data().ownerId);
      if (validInvite) {
        const inviteDoc = validInvite;
        inviteSnap.docs[0] = inviteDoc;
      }
      if (validInvite) {
        const invite = validInvite.data();
        await setDoc(doc(db, "users", uid), {
          uid, email, name, role: invite.role || "attendant",
          ownerId: invite.ownerId, locationId: invite.locationId || null,
          allowedLocations: invite.allowedLocations || {},
          color: "#0ea5e9", createdAt: new Date().toISOString(), isTeamMember: true,
          setupComplete: true
        });
        await updateDoc(validInvite.ref, { status: "accepted", acceptedAt: new Date().toISOString() });
        // Force auth state refresh so Dashboard loads with correct user data
        window.location.reload();
        return;
      } else {
        const locId = "loc_" + uid.slice(0, 8);
        await setDoc(doc(db, "locations", locId), {
          id: locId, name: bizName, address: "", zipCode: "", ownerId: uid,
          createdAt: new Date().toISOString()
        });
        await setDoc(doc(db, "users", uid), {
          uid, email, name, role: "owner", locationId: locId,
          bizName, color: "#6366f1", createdAt: new Date().toISOString()
        });
      }
    } catch(e) {
      if (e.message?.includes("email-already-in-use")) {
        setError("You already have a WashLevel account with this email. Sign in instead — you'll be prompted to accept the invite after logging in.");
        setTab("login");
      } else {
        setError(e.message || "Signup failed. Please try again.");
      }
    }
    setLoading(false);
  };

  const inp = { width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 9, fontSize: 14, outline: "none", boxSizing: "border-box", background: "#fafafa", color: "#0f1f35" };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 440, padding: "0 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#0f1f35", borderRadius: 14, padding: "10px 22px" }}>
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
                  background: tab === t ? "#fff" : "#f8fafc",
                  color: tab === t ? "#0f1f35" : "#94a3b8",
                  borderBottom: tab === t ? "2px solid #1a3352" : "2px solid transparent" }}>
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>
          <div style={{ padding: 28 }}>
            {tab === "login" ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com" style={inp} onKeyDown={e => e.key === "Enter" && handleLogin()} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Password</label>
                  <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="password" style={inp} onKeyDown={e => e.key === "Enter" && handleLogin()} />
                </div>
                {error && <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{error}</div>}
                <button onClick={handleLogin} disabled={loading} style={{ width: "100%", background: "#0f1f35", color: "#fff", border: "none", borderRadius: 9, padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  {loading ? "Signing in..." : "Sign In"}
                </button>
                {resetSent && <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginTop: 12 }}>Password reset email sent! Check your inbox.</div>}
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <span onClick={handleForgotPassword} style={{ fontSize: 13, color: "#64748b", cursor: "pointer", textDecoration: "underline" }}>
                    {resetLoading ? "Sending..." : "Forgot password?"}
                  </span>
                </div>
                <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: "#94a3b8" }}>
                  No account?{" "}
                  <span onClick={() => setTab("signup")} style={{ color: "#0f1f35", fontWeight: 600, cursor: "pointer" }}>Create one free</span>
                </div>
              </div>
            ) : (
              <div>
                {inviteData && (
                  <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0f1f35", marginBottom: 4 }}>You have been invited!</div>
                    <div style={{ fontSize: 13, color: "#15803d", marginBottom: 8 }}>
                      You are joining <b>{inviteData.bizName || "a team"}</b> as <b style={{ textTransform: "capitalize" }}>{inviteData.role}</b>.
                    </div>
                    {inviteData.allowedLocations?.length > 0 && (
                      <div style={{ fontSize: 12, color: "#166534", background: "#dcfce7", borderRadius: 6, padding: "4px 10px", display: "inline-block" }}>
                        {inviteData.allowedLocations.length} location{inviteData.allowedLocations.length > 1 ? "s" : ""} assigned
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#166534", marginTop: 8 }}>Fill in your name and create a password to get started.</div>
                  </div>
                )}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Your Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Alex Rivera" style={inp} />
                </div>
                {!inviteData && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Car Wash Name</label>
                  <input value={bizName} onChange={e => setBizName(e.target.value)} placeholder="e.g. Sunny Car Wash" style={inp} />
                </div>
                )}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com" style={inp}
                    onBlur={async () => {
                      if (!email.includes("@")) return;
                      setCheckingInvite(true);
                      try {
                        const invSnap = await getDocs(query(collection(db, "invites"), where("email", "==", email.toLowerCase()), where("status", "==", "pending")));
                        if (!invSnap.empty) {
                          const inv = invSnap.docs[0].data();
                          const ownerSnap = await getDoc(doc(db, "users", inv.ownerId));
                          const bizName = ownerSnap.exists() ? ownerSnap.data().bizName || ownerSnap.data().name : "";
                          setInviteData({ ...inv, bizName });
                        } else {
                          setInviteData(null);
                        }
                      } catch(e) {}
                      setCheckingInvite(false);
                    }}
                  />
                  {checkingInvite && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Checking invite...</div>}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Password</label>
                  <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="At least 6 characters" style={inp} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Confirm Password</label>
                  <input value={confirm} onChange={e => setConfirm(e.target.value)} type="password" placeholder="Repeat password" style={inp} onKeyDown={e => e.key === "Enter" && handleSignup()} />
                </div>
                {error && <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{error}</div>}
                <button onClick={handleSignup} disabled={loading} style={{ width: "100%", background: "#0f1f35", color: "#fff", border: "none", borderRadius: 9, padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  {loading ? "Creating account..." : "Create Account"}
                </button>
                <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#94a3b8" }}>By creating an account you agree to our <a href="/terms.html" target="_blank" style={{ color: "#0ea5e9", textDecoration: "underline" }}>Terms of Service</a>.</div>
                <div style={{ textAlign: "center", marginTop: 8, fontSize: 13, color: "#94a3b8" }}>
                  Already have an account?{" "}
                  <span onClick={() => setTab("login")} style={{ color: "#0f1f35", fontWeight: 600, cursor: "pointer" }}>Sign in</span>
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

  // Scroll input into view on mobile when focused
  useEffect(() => {
    if (!isMobile) return;
    const handleFocus = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        setTimeout(() => {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };
    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, [isMobile]);
const isManager = user?.role === "manager" || user?.role === "owner";
const locs = isManager ? locations : locations.filter(l => (user?.allowedLocations && Array.isArray(user.allowedLocations) ? user.allowedLocations.includes(l.id) : l.id === user?.locationId));
const isTechnician = user?.role === "technician";
const nav = [
{ id: "overview",   label: "Overview"   },
    ...(isManager ? [{ id: "alerts", label: "Notifications" }] : []),
...(isManager ? [{ id: "calendar", label: "Calendar" }] : []),
    ...(isManager || user?.carCountAccess ? [{ id: "carcounts", label: "Car Counts" }] : []),
...(user ? [{ id: "timeclock", label: "Time Clock" }] : []),
{ id: "tasks",      label: "Tasks"      },
...(isManager || user?.inventoryAccess ? [{ id: "inventory", label: "Inventory" }] : []),
...(isManager || user?.equipmentAccess ? [{ id: "equipment", label: "Equipment" }] : []),
...(isManager || user?.sensorAccess ? [{ id: "sensors", label: "Sensors" }] : []),
...(isManager ? [{ id: "settings", label: "Settings" }] : []),
];
const RC = { manager: "#6366f1", attendant: "#0ea5e9", technician: "#f59e0b", owner: "#10b981" };

return (
<>
{open && (
<div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
)}
<aside style={{
width: 260, flexShrink: 0, background: "#0f1f35", display: "flex", flexDirection: "column",
height: "100dvh", overflowY: "auto",
position: "fixed", left: 0, top: 0, zIndex: 50,
transform: open ? "translateX(0)" : "translateX(-100%)",
transition: "transform 0.25s ease",
boxShadow: open ? "6px 0 32px rgba(0,0,0,0.3)" : "none"
}}>
<div style={{ padding: "20px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
<span style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: "-0.3px" }}>WashLevel</span>
<span style={{ background: "#00d4aa", color: "#0f1f35", fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "2px 6px", letterSpacing: "0.05em" }}>PRO</span>
</div>
</div>
<div style={{ padding: "14px 12px 8px" }}>
<div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Location</div>
{isManager && (
<button onClick={() => { setLocId("all"); setView("overview"); if(isMobile) onClose(); }}
  style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 7, border: "none",
  background: locId === "all" ? "rgba(125,211,252,0.15)" : "transparent",
  color: locId === "all" ? "#7dd3fc" : "rgba(255,255,255,0.5)",
  cursor: "pointer", fontSize: 13, fontWeight: locId === "all" ? 700 : 400, marginBottom: 1,
  borderLeft: locId === "all" ? "2px solid #7dd3fc" : "2px solid transparent",
  display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
  All Locations
</button>
)}
{locs.map(l => (
<button key={l.id} onClick={() => setLocId(l.id)} style={{ width: "100%", textAlign: "left", padding: "9px 14px", borderRadius: 8, border: "none", background: locId === l.id ? "rgba(125,211,252,0.15)" : "transparent", color: locId === l.id ? "#7dd3fc" : "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontWeight: locId === l.id ? 700 : 400, marginBottom: 1, borderLeft: locId === l.id ? "2px solid #7dd3fc" : "2px solid transparent", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
{l.name}
</button>
))}
</div>
<div style={{ padding: "6px 12px", flex: 1, borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 4 }}>
<div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, marginTop: 10 }}>Menu</div>
{nav.map(item => (
<button key={item.id} onClick={() => { setView(item.id); if(isMobile) onClose(); }} style={{ width: "100%", textAlign: "left", padding: "9px 14px", borderRadius: 8, border: "none", background: view === item.id ? "rgba(125,211,252,0.15)" : "transparent", color: view === item.id ? "#7dd3fc" : "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontWeight: view === item.id ? 700 : 400, marginBottom: 1, borderLeft: view === item.id ? "2px solid #7dd3fc" : "2px solid transparent", transition: "all 0.15s" }}>
{item.label}
</button>
))}
</div>
<div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
<div onClick={() => { setView("settings"); if (typeof onClose === "function") onClose(); }} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer", padding: "6px 4px", borderRadius: 8 }}>
<Avatar name={user?.name || user?.email || ""} color={RC[user?.role] || "#6366f1"} size={34} />
<div style={{ minWidth: 0 }}>
<div style={{ color: "#fff", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name || user?.email}</div>
<div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textTransform: "capitalize" }}>{user?.role}</div>
</div>
</div>
<button onClick={logout} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", borderRadius: 8, padding: "8px 0", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>Sign Out</button>
</div>
</aside>
</>
);
}

// Semicircle analog pressure gauge. Arc runs from 8-o'clock to 4-o'clock (240°),
// zones: green 0-60, yellow 60-100, red 100-150 PSI.
function PressureGauge({ psi, size = 120, max = 150, showLabels = false }) {
  const R = size * 0.38;
  const CX = size / 2;
  const CY = size * 0.46;
  const C = 2 * Math.PI * R;
  const arcLen = C * (240 / 360);
  const sw = size * 0.075;
  const rot = `rotate(150 ${CX} ${CY})`;

  const gLen = arcLen * (60 / max);
  const yLen = arcLen * (40 / max);
  const rLen = arcLen * (50 / max);

  const v = Math.max(0, Math.min(max, psi ?? 0));
  const aDeg = 210 - (v / max) * 240;
  const aRad = aDeg * Math.PI / 180;
  const nR = R * 0.72;
  const svgH = Math.round(size * 0.72);

  return (
    <svg width={size} height={svgH} viewBox={`0 0 ${size} ${svgH}`} style={{ display: "block" }}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e2e8f0" strokeWidth={sw}
        strokeDasharray={`${arcLen} ${C - arcLen}`} transform={rot} />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#22c55e" strokeWidth={sw}
        strokeDasharray={`${gLen} ${C - gLen}`} strokeDashoffset={C} transform={rot} />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f59e0b" strokeWidth={sw}
        strokeDasharray={`${yLen} ${C - yLen}`} strokeDashoffset={C - gLen} transform={rot} />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#ef4444" strokeWidth={sw}
        strokeDasharray={`${rLen} ${C - rLen}`} strokeDashoffset={C - gLen - yLen} transform={rot} />
      <line x1={CX} y1={CY} x2={CX + nR * Math.cos(aRad)} y2={CY - nR * Math.sin(aRad)}
        stroke="#1a3352" strokeWidth={size * 0.025} strokeLinecap="round" />
      <circle cx={CX} cy={CY} r={size * 0.042} fill="#1a3352" />
      {showLabels && (
        <>
          <text x={CX - R * 0.9} y={CY + R * 0.65} fontSize={size * 0.085} fill="#94a3b8" textAnchor="middle">0</text>
          <text x={CX + R * 0.9} y={CY + R * 0.65} fontSize={size * 0.085} fill="#94a3b8" textAnchor="middle">{max}</text>
        </>
      )}
    </svg>
  );
}

function PsiChart({ data, height = 130 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [stickyIdx, setStickyIdx] = useState(null);
  const svgRef = useRef(null);

  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12 }}>
        No history data yet
      </div>
    );
  }
  const W = 400, H = 100;
  const pad = { t: 8, r: 8, b: 20, l: 30 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;

  const vals = data.map(d => parseFloat(d.value) || 0);
  const rawMin = Math.min(...vals), rawMax = Math.max(...vals);
  const span = rawMax - rawMin || 10;
  const minV = Math.max(0, rawMin - span * 0.1);
  const maxV = Math.min(200, rawMax + span * 0.15);

  const xFor = i => pad.l + (i / (data.length - 1)) * cW;
  const yFor = v => pad.t + cH - ((v - minV) / (maxV - minV)) * cH;

  const pts = data.map((d, i) => `${xFor(i)},${yFor(parseFloat(d.value) || 0)}`).join(" ");
  const fillPts = `${xFor(0)},${H - pad.b} ${pts} ${xFor(data.length - 1)},${H - pad.b}`;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const band = (lo, hi) => {
    const top = clamp(hi, minV, maxV), bot = clamp(lo, minV, maxV);
    if (top <= bot) return null;
    return { y: yFor(top), h: yFor(bot) - yFor(top) };
  };
  const green = band(0, 60), yellow = band(60, 100), red = band(100, 150);

  const yStep = maxV <= 60 ? 20 : maxV <= 120 ? 25 : 50;
  const ticks = [];
  for (let t = Math.ceil(minV / yStep) * yStep; t <= maxV; t += yStep) ticks.push(t);

  const fmt = ts => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmtDate = ts => new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });

  const getIdxFromEvent = (e) => {
    if (!svgRef.current || data.length < 2) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const chartStartPx = (pad.l / W) * rect.width;
    const chartEndPx = ((W - pad.r) / W) * rect.width;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left - chartStartPx) / (chartEndPx - chartStartPx)));
    return Math.round(frac * (data.length - 1));
  };

  const handlePointerMove = (e) => {
    const idx = getIdxFromEvent(e);
    if (idx !== null) setHoveredIdx(idx);
  };

  const handlePointerLeave = () => setHoveredIdx(null);

  const handleClick = (e) => {
    const idx = getIdxFromEvent(e);
    setStickyIdx(prev => (prev === idx ? null : idx));
  };

  const activeIdx = stickyIdx ?? hoveredIdx;
  const tooltipPt = activeIdx != null ? data[activeIdx] : null;
  const tooltipLeftPct = activeIdx != null ? Math.max(8, Math.min(88, Math.round((xFor(activeIdx) / W) * 100))) : null;
  const tooltipVal = tooltipPt ? parseFloat(tooltipPt.value) : null;
  const tooltipTs = tooltipPt?.timestamp;

  return (
    <div style={{ position: "relative", userSelect: "none", touchAction: "pan-y" }}>
      {tooltipPt && (
        <div style={{
          position: "absolute", top: 4, left: `${tooltipLeftPct}%`,
          transform: "translateX(-50%)",
          background: "#0f1f35", color: "#fff", borderRadius: 8,
          padding: "4px 9px", fontSize: 11, fontWeight: 600,
          whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none",
          lineHeight: 1.5,
        }}>
          {tooltipVal != null ? tooltipVal.toFixed(1) : "--"} PSI
          <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 5 }}>
            {fmtDate(tooltipTs)} {fmt(tooltipTs)}
          </span>
        </div>
      )}
      <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ display: "block", cursor: "crosshair" }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        {green && <rect x={pad.l} y={green.y} width={cW} height={green.h} fill="#22c55e" opacity={0.08} />}
        {yellow && <rect x={pad.l} y={yellow.y} width={cW} height={yellow.h} fill="#f59e0b" opacity={0.1} />}
        {red && <rect x={pad.l} y={red.y} width={cW} height={red.h} fill="#ef4444" opacity={0.08} />}
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.l} y1={yFor(t)} x2={W - pad.r} y2={yFor(t)} stroke="#e2e8f0" strokeWidth={0.5} />
            <text x={pad.l - 3} y={yFor(t) + 3} fontSize={7} fill="#94a3b8" textAnchor="end">{t}</text>
          </g>
        ))}
        <polygon points={fillPts} fill="#0ea5e9" opacity={0.07} />
        <polyline points={pts} fill="none" stroke="#0ea5e9" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {activeIdx != null && (
          <>
            <line x1={xFor(activeIdx)} y1={pad.t} x2={xFor(activeIdx)} y2={H - pad.b}
              stroke="#0f1f35" strokeWidth={0.75} strokeDasharray="3 2" opacity={0.35} />
            <circle cx={xFor(activeIdx)} cy={yFor(parseFloat(data[activeIdx].value) || 0)}
              r={3} fill="#0ea5e9" stroke="#fff" strokeWidth={1.5} />
          </>
        )}
        <circle cx={xFor(data.length - 1)} cy={yFor(parseFloat(data[data.length - 1].value) || 0)} r={2.5} fill="#0ea5e9" />
        <text x={pad.l} y={H - 2} fontSize={7} fill="#94a3b8">{fmt(data[0].timestamp)}</text>
        <text x={W - pad.r} y={H - 2} fontSize={7} fill="#94a3b8" textAnchor="end">{fmt(data[data.length - 1].timestamp)}</text>
      </svg>
    </div>
  );
}

function SensorDetailModal({ sensor, locId, onClose }) {
  const [range, setRange] = useState("6h");
  const [histData, setHistData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [minAlert, setMinAlert] = useState(sensor?.minAlert ?? "");
  const [maxAlert, setMaxAlert] = useState(sensor?.maxAlert ?? "");
  const [savingAlerts, setSavingAlerts] = useState(false);

  useEffect(() => {
    if (!sensor?.id || !locId) return;
    const hoursMap = { "1h": 1, "6h": 6, "24h": 24, "1w": 168 };
    const startISO = new Date(Date.now() - hoursMap[range] * 3600000).toISOString();
    setLoading(true);
    setHistData([]);
    getDocs(query(
      collection(db, "locations", locId, "sensorReadings", sensor.id, "history"),
      orderBy("timestamp", "desc"),
      limit(500)
    )).then(snap => {
      const pts = snap.docs.map(d => d.data()).filter(d => d.timestamp >= startISO).reverse();
      setHistData(pts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [sensor?.id, locId, range]);

  const psi = sensor.lastReading ?? sensor.value ?? null;
  const updatedAt = sensor.updatedAt ?? sensor.timestamp ?? null;
  const isPressure = sensor.type === "pressure" || sensor.unit === "PSI";

  const valueColor = psi == null ? "#94a3b8"
    : psi < 60 ? "#22c55e"
    : psi < 100 ? "#f59e0b"
    : "#ef4444";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#0f1f35" }}>{sensor.name || sensor.sensorId}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>ID: {sensor.sensorId || sensor.id} · {sensor.type || "sensor"}</div>
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
          {isPressure && <PressureGauge psi={psi} size={190} showLabels />}
          <div style={{ fontSize: 40, fontWeight: 800, color: valueColor, marginTop: isPressure ? -6 : 0, lineHeight: 1 }}>
            {psi != null ? (typeof psi === "number" ? psi.toFixed(1) : psi) : "--"}
          </div>
          <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 2 }}>{sensor.unit || "PSI"}</div>
          {updatedAt && (
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
              Updated {new Date(updatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[["1h","1H"],["6h","6H"],["24h","24H"],["1w","1W"]].map(([val, label]) => (
            <button key={val} onClick={() => setRange(val)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: range === val ? "#0f1f35" : "#f1f5f9", color: range === val ? "#fff" : "#64748b" }}>
              {label}
            </button>
          ))}
        </div>

        {loading
          ? <div style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>
          : <PsiChart data={histData} height={130} />
        }

        <div style={{ marginTop: 20, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Alert Thresholds</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>Min Alert ({sensor.unit || "PSI"})</label>
              <input
                type="number" value={minAlert} onChange={e => setMinAlert(e.target.value)}
                placeholder="e.g. 40"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>Max Alert ({sensor.unit || "PSI"})</label>
              <input
                type="number" value={maxAlert} onChange={e => setMaxAlert(e.target.value)}
                placeholder="e.g. 120"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <button
            disabled={savingAlerts}
            onClick={async () => {
              if (!sensor?.id || !locId) return;
              setSavingAlerts(true);
              try {
                await updateDoc(doc(db, "locations", locId, "chemSensors", sensor.id), {
                  minAlert: minAlert !== "" ? parseFloat(minAlert) : null,
                  maxAlert: maxAlert !== "" ? parseFloat(maxAlert) : null,
                });
              } finally {
                setSavingAlerts(false);
              }
            }}
            style={{ width: "100%", padding: "9px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", background: "#0f1f35", color: "#fff", opacity: savingAlerts ? 0.6 : 1 }}
          >
            {savingAlerts ? "Saving…" : "Save Thresholds"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SensorTilesPanel({ locId, uid, onNavigate, onSensorNavigate }) {
  const [chemSensors, setChemSensors] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [shellyDevices, setShellyDevices] = useState([]);
  const [shellyReadings, setShellyReadings] = useState({});
  const [spSensors, setSpSensors] = useState([]);
  const [spReadings, setSpReadings] = useState({});
  const [visibleSensors, setVisibleSensors] = useState(null);
  const [sensorOrder, setSensorOrder] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const dragKey = useRef(null);
  const dragOverKey = useRef(null);

  useEffect(() => {
    if (!locId) return;
    const unsub = onSnapshot(collection(db, "locations", locId, "chemSensors"), snap => {
      setChemSensors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [locId]);

  useEffect(() => {
    if (!locId || !uid) return;
    getDoc(doc(db, "users", uid, "integrations", "shelly")).then(snap => {
      if (!snap.exists() || snap.data().disconnected) return;
      const allDevices = snap.data().devices || [];
      const assignments = snap.data().assignments || {};
      const assigned = allDevices.filter(d => assignments[d.id] === locId || !assignments[d.id]);
      setShellyDevices(assigned);
    });
    const unsub = onSnapshot(collection(db, "locations", locId, "shellyReadings"), snap => {
      const r = {};
      snap.docs.forEach(d => { r[d.id] = d.data(); });
      setShellyReadings(r);
    });
    return () => unsub();
  }, [locId, uid]);

  useEffect(() => {
    if (!uid || !locId) return;
    getDoc(doc(db, "users", uid, "integrations", "sensorpush")).then(snap => {
      if (!snap.exists() || snap.data().disconnected) return;
      const { sensors: sensorList, assignments } = snap.data();
      if (!sensorList) return;
      const assigned = sensorList.filter(s => assignments?.[s.id] === locId);
      setSpSensors(assigned);
    });
    const unsub = onSnapshot(doc(db, "sensors", locId), snap => {
      if (snap.exists()) setSpReadings(snap.data());
    });
    return () => unsub();
  }, [uid, locId]);

  useEffect(() => {
    if (!uid || !locId) return;
    getDoc(doc(db, "users", uid, "prefs", "overviewSensors_" + locId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setVisibleSensors(data);
        if (data.__order) setSensorOrder(data.__order);
      }
    });
  }, [uid, locId]);

  const isVisible = (key) => {
    if (!visibleSensors) return true;
    return visibleSensors[key] !== false;
  };

  const toggleSensor = (key) => {
    const updated = { ...(visibleSensors || {}), [key]: !isVisible(key) };
    setVisibleSensors(updated);
    if (uid && locId) setDoc(doc(db, "users", uid, "prefs", "overviewSensors_" + locId), updated);
  };

  const allSensorsRaw = [
    ...chemSensors.map(s => ({ key: "chem_" + s.id, label: s.name || s.sensorId, type: "ChemLevel" })),
    ...shellyDevices.map(s => ({ key: "shelly_" + s.id, label: s.name || s.id, type: "Shelly" })),
    ...spSensors.map(s => ({ key: "sp_" + s.id, label: s.name, type: "SensorPush" })),
  ];

  // Apply saved order, appending any new sensors not yet in order
  const allSensors = sensorOrder.length
    ? [
        ...sensorOrder.map(k => allSensorsRaw.find(s => s.key === k)).filter(Boolean),
        ...allSensorsRaw.filter(s => !sensorOrder.includes(s.key)),
      ]
    : allSensorsRaw;

  const saveOrder = (newOrder) => {
    setSensorOrder(newOrder);
    if (uid && locId) setDoc(doc(db, "users", uid, "prefs", "overviewSensors_" + locId), { ...(visibleSensors || {}), __order: newOrder });
  };

  const handleDragStart = (key) => { dragKey.current = key; };
  const handleDragOver = (e, key) => { e.preventDefault(); dragOverKey.current = key; };
  const handleDrop = () => {
    if (!dragKey.current || dragKey.current === dragOverKey.current) return;
    const keys = allSensors.map(s => s.key);
    const from = keys.indexOf(dragKey.current);
    const to = keys.indexOf(dragOverKey.current);
    if (from === -1 || to === -1) return;
    const reordered = [...keys];
    reordered.splice(from, 1);
    reordered.splice(to, 0, dragKey.current);
    saveOrder(reordered);
    dragKey.current = null;
    dragOverKey.current = null;
  };

  const moveUp = (key) => {
    const keys = allSensors.map(s => s.key);
    const i = keys.indexOf(key);
    if (i <= 0) return;
    const reordered = [...keys];
    [reordered[i - 1], reordered[i]] = [reordered[i], reordered[i - 1]];
    saveOrder(reordered);
  };

  const moveDown = (key) => {
    const keys = allSensors.map(s => s.key);
    const i = keys.indexOf(key);
    if (i === -1 || i >= keys.length - 1) return;
    const reordered = [...keys];
    [reordered[i + 1], reordered[i]] = [reordered[i], reordered[i + 1]];
    saveOrder(reordered);
  };

  const hasAny = allSensors.length > 0;
  const hasAnyVisible = allSensors.filter(s => isVisible(s.key)).length > 0;

  // For rendering tiles in order
  const orderedVisible = allSensors.filter(s => isVisible(s.key));

  return (
    <div>
      {editMode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0f1f35" }}>Sensor Tiles</div>
              <button onClick={() => setEditMode(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>x</button>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Choose which sensors appear on the overview.</div>
            {allSensors.length === 0 && (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 13 }}>No sensors configured yet. Add them in the Sensors tab.</div>
            )}
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>Use arrows to reorder. Toggle to show/hide.</div>
            {allSensors.map((sensor, idx) => (
              <div key={sensor.key}
                draggable
                onDragStart={() => handleDragStart(sensor.key)}
                onDragOver={e => handleDragOver(e, sensor.key)}
                onDrop={handleDrop}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                  <button onClick={() => moveUp(sensor.key)} disabled={idx === 0}
                    style={{ background: idx === 0 ? "#f1f5f9" : "#e2e8f0", border: "none", borderRadius: 4, width: 24, height: 24, cursor: idx === 0 ? "default" : "pointer", fontSize: 12, color: idx === 0 ? "#d1d5db" : "#334155", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
                  <button onClick={() => moveDown(sensor.key)} disabled={idx === allSensors.length - 1}
                    style={{ background: idx === allSensors.length - 1 ? "#f1f5f9" : "#e2e8f0", border: "none", borderRadius: 4, width: 24, height: 24, cursor: idx === allSensors.length - 1 ? "default" : "pointer", fontSize: 12, color: idx === allSensors.length - 1 ? "#d1d5db" : "#334155", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{sensor.label}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{sensor.type}</div>
                </div>
                <div onClick={() => toggleSensor(sensor.key)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: isVisible(sensor.key) ? "#0f1f35" : "#e2e8f0", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: isVisible(sensor.key) ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
              </div>
            ))}
            <button onClick={() => setEditMode(false)} style={{ marginTop: 8, width: "100%", background: "#0f1f35", color: "#fff", border: "none", borderRadius: 9, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Done</button>
          </div>
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f1f35", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        Live Sensors
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#059669", background: "#d1fae5", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>LIVE</span>
        {hasAny && (
          <button onClick={() => setEditMode(true)} style={{ background: "#f1f5f9", color: "#334155", border: "1px solid #e5e7eb", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
        )}
      </div>

      {!hasAny && (
        <div style={{ textAlign: "center", padding: "20px 10px" }}>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>No sensors configured yet.</div>
          <button onClick={() => onNavigate("sensors")} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Set Up Sensors</button>
        </div>
      )}

      {hasAny && !hasAnyVisible && (
        <div style={{ textAlign: "center", padding: "16px 10px", color: "#94a3b8", fontSize: 13 }}>
          No sensors selected. Tap Edit to choose which to show.
        </div>
      )}

      {selectedSensor && <SensorDetailModal sensor={selectedSensor} locId={locId} onClose={() => setSelectedSensor(null)} />}

      {hasAnyVisible && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
          {orderedVisible.map(sensor => {
            if (sensor.key.startsWith("chem_")) {
              const s = chemSensors.find(c => "chem_" + c.id === sensor.key);
              if (!s) return null;
              const val = s.lastReading ?? s.lastWeight ?? null;
              const isPressure = s.type === "pressure" || s.unit === "PSI";
              const unit = s.unit || "PSI";
              const min = s.minAlert ?? 0;
              const max = s.maxAlert ?? 150;
              const pct = val != null && max > 0 ? Math.min(100, Math.round((val / max) * 100)) : null;
              const alert = val != null && (val < min || val > max);

              if (isPressure) {
                const valColor = val == null ? "#94a3b8" : val < 60 ? "#22c55e" : val < 100 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={sensor.key} onClick={() => setSelectedSensor(s)} style={{ background: alert ? "#fef2f2" : "#f8fafc", border: "1px solid " + (alert ? "#fca5a5" : "#e2e8f0"), borderRadius: 12, padding: "10px 8px 8px", cursor: "pointer", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || s.sensorId}</div>
                    <div style={{ margin: "0 auto", width: 84 }}><PressureGauge psi={val} size={84} /></div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: valColor, lineHeight: 1, marginTop: 1 }}>{val != null ? (typeof val === "number" ? val.toFixed(1) : val) : "--"}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8" }}>{unit}</div>
                    {s.updatedAt && <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{new Date(s.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
                  </div>
                );
              }

              return (
                <div key={sensor.key} onClick={() => setSelectedSensor(s)} style={{ background: alert ? "#fef2f2" : "#f4f6f8", border: "1px solid " + (alert ? "#fca5a5" : "#e2e8f0"), borderRadius: 10, padding: "12px 10px", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || s.sensorId}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: alert ? "#dc2626" : "#0f1f35" }}>{val != null ? val : "--"}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{unit}</div>
                  {pct != null && <div style={{ marginTop: 6, height: 4, background: "#e2e8f0", borderRadius: 2 }}><div style={{ height: 4, width: pct + "%", background: alert ? "#ef4444" : "#8b5cf6", borderRadius: 2 }} /></div>}
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>ChemLevel</div>
                </div>
              );
            }
            if (sensor.key.startsWith("shelly_")) {
              const s = shellyDevices.find(d => "shelly_" + d.id === sensor.key);
              if (!s) return null;
              const reading = shellyReadings[s.id];
              const state = reading?.state;
              const isAlert = s.alertOn !== "never" && state === (s.alertOn === "on" ? true : false);
              return (
                <div key={sensor.key} onClick={() => onSensorNavigate ? onSensorNavigate("shelly") : onNavigate("sensors")} style={{ background: isAlert ? "#fef2f2" : "#f4f6f8", border: "1px solid " + (isAlert ? "#fca5a5" : "#e2e8f0"), borderRadius: 10, padding: "12px 10px", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || s.id}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: state === true ? "#dc2626" : state === false ? "#10b981" : "#94a3b8" }}>
                    {state === true ? "ON" : state === false ? "OFF" : "--"}
                  </div>
                  {reading?.timestamp && <div style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(reading.timestamp).toLocaleTimeString()}</div>}
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Shelly</div>
                </div>
              );
            }
            if (sensor.key.startsWith("sp_")) {
              const s = spSensors.find(sp => "sp_" + sp.id === sensor.key);
              if (!s) return null;
              const temp = spReadings["sp_" + s.id + "_tempF"];
              const hum = spReadings["sp_" + s.id + "_humidity"];
              return (
                <div key={sensor.key} onClick={() => onSensorNavigate ? onSensorNavigate("sensorpush") : onNavigate("sensors")} style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "12px 10px", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#0369a1", fontWeight: 600, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#1e40af" }}>{temp != null ? temp + "F" : "--"}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{hum != null ? hum + "% RH" : ""}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>SensorPush</div>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

function Overview({ location, tasks, sensors, equipment, onNavigate, user, onSensorNavigate }) {
  const isManager = user?.role === "manager" || user?.role === "owner";
  const done = tasks.filter(t => t.status === "done").length;
  const inprog = tasks.filter(t => t.status === "in-progress").length;
  const eqBad = equipment.filter(e => e.status !== "ok").length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const [todaySummary, setTodaySummary] = useState(null);
  const today = new Date().toISOString().split("T")[0];
  const [editMode, setEditMode] = useState(false);

  const ALL_TILES = [
    { id: "cars",      label: "Cars Today",      type: "stat" },
    { id: "tasksDone", label: "Tasks Done",       type: "stat" },
    { id: "inprog",    label: "In Progress",      type: "stat" },
    { id: "equip",     label: "Equip Alerts",     type: "stat" },
    { id: "sensors",   label: "Live Sensors",     type: "panel" },
    { id: "equipment", label: "Equipment Status", type: "panel" },
    { id: "tasks",     label: "Open Tasks",       type: "panel" },
  ];

  const defaultVisible = ALL_TILES.reduce((acc, t) => ({ ...acc, [t.id]: true }), {});
  const [visible, setVisible] = useState(defaultVisible);

  useEffect(() => {
    if (!location?.id) return;
    getDoc(doc(db, "locations", location.id, "daySummaries", today))
      .then(snap => { if (snap.exists()) setTodaySummary(snap.data()); })
      .catch(() => {});
  }, [location?.id, today]);

  useEffect(() => {
    if (!user?.uid || !location?.id) return;
    getDoc(doc(db, "users", user.uid, "prefs", "overviewTiles_" + location.id))
      .then(snap => {
        if (snap.exists()) setVisible({ ...defaultVisible, ...snap.data() });
      })
      .catch(() => {});
  }, [user?.uid, location?.id]);

  const saveVisible = async (updated) => {
    setVisible(updated);
    if (!user?.uid || !location?.id) return;
    await setDoc(doc(db, "users", user.uid, "prefs", "overviewTiles_" + location.id), updated);
  };

  const toggleTile = (id) => saveVisible({ ...visible, [id]: !visible[id] });

  return (
    <div>
      {editMode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0f1f35" }}>Customize Overview</div>
              <button onClick={() => setEditMode(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1 }}>x</button>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Choose which tiles appear on your overview.</div>
            {ALL_TILES.map(tile => (
              <div key={tile.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{tile.label}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "capitalize" }}>{tile.type}</div>
                </div>
                <div onClick={() => toggleTile(tile.id)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: visible[tile.id] ? "#0f1f35" : "#e2e8f0", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: visible[tile.id] ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
              </div>
            ))}
            <button onClick={() => setEditMode(false)} style={{ marginTop: 20, width: "100%", background: "#0f1f35", color: "#fff", border: "none", borderRadius: 9, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Done</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f1f35", letterSpacing: "-0.4px" }}>{location?.name}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3, fontWeight: 500 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
        </div>
        <button onClick={() => setEditMode(true)} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", marginTop: 4, letterSpacing: "0.01em" }}>
          Edit Tiles
        </button>
      </div>

      {[visible.cars, visible.tasksDone, visible.inprog, visible.equip].some(Boolean) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))", gap: 13, marginBottom: 22 }}>
          {visible.cars && (isManager || user?.carCountAccess) && <div style={{ cursor: "pointer" }} onClick={() => onNavigate("carcounts")}><StatCard label="Cars Today" value={todaySummary?.carsWashed ?? "-"} accent="#00d4aa" /></div>}
          {visible.tasksDone && <div style={{ cursor: "pointer" }} onClick={() => onNavigate("tasks")}><StatCard label="Tasks Done" value={done + "/" + tasks.length} sub={pct + "% complete"} accent="#00d4aa" /></div>}
          {visible.inprog    && <div style={{ cursor: "pointer" }} onClick={() => onNavigate("all-tasks")}><StatCard label="In Progress" value={inprog} accent="#f59e0b" /></div>}
          {visible.equip && (isManager || user?.equipmentAccess) && <div style={{ cursor: "pointer" }} onClick={() => onNavigate("equipment")}><StatCard label="Equip Alerts" value={eqBad} alert={eqBad > 0} accent="#ef4444" /></div>}
        </div>
      )}

      {((visible.sensors && (isManager || user?.sensorAccess)) || (visible.equipment && (isManager || user?.equipmentAccess))) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18, marginBottom: 18 }}>
          {visible.sensors && (isManager || user?.sensorAccess) && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <SensorTilesPanel locId={location?.id} uid={user?.isTeamMember ? user?.ownerId : user?.uid} onNavigate={onNavigate} onSensorNavigate={onSensorNavigate} />
            </div>
          )}
          {visible.equipment && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#0f1f35", marginBottom: 14, letterSpacing: "-0.2px" }}>Equipment Status</div>
              {equipment.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 10px" }}>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>No equipment tracked yet.</div>
                  <button onClick={() => onNavigate("equipment")} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add Equipment</button>
                </div>
              ) : equipment.map(eq => {
                const s = EQS[eq.status] || EQS.ok;
                return (
                  <div key={eq.id} onClick={() => onNavigate("equipment")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: eq.status !== "ok" ? s.bg + "80" : "#fafafa", borderRadius: 8, border: `1px solid ${eq.status !== "ok" ? s.color + "40" : "#e2e8f0"}`, marginBottom: 7, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#e0f2fe"}
                    onMouseLeave={e => e.currentTarget.style.background = eq.status !== "ok" ? (EQS[eq.status] || EQS.ok).bg + "80" : "#fafafa"}>
                    <span style={{ fontWeight: 700, color: s.color, fontSize: 13, width: 16, textAlign: "center" }}>{s.icon}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#334155" }}>{eq.name}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{eq.nextService}</span>
                    <Pill label={s.label} bg={s.bg} color={s.color} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {visible.tasks && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }} onClick={() => onNavigate && onNavigate("tasks")}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#0f1f35", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", letterSpacing: "-0.2px" }}>
            Open Tasks <span style={{ fontSize: 12, color: "#00d4aa", fontWeight: 700 }}>View All →</span>
          </div>
          {tasks.filter(t => t.status !== "done").slice(0, 6).map((t, i, arr) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: STS[t.status]?.dot, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: "#334155", fontWeight: 500 }}>{t.title}</span>
              <Pill label={t.priority} bg={PRI[t.priority]?.bg} color={PRI[t.priority]?.color} />
              <span style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>{t.due}</span>
            </div>
          ))}
          {tasks.filter(t => t.status !== "done").length === 0 && <div style={{ textAlign: "center", color: "#10b981", fontWeight: 600, padding: "20px 0" }}>All tasks complete!</div>}
        </div>
      )}
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
    if (task.requirePhoto && photos.length === 0) {
      alert("A photo is required to complete this task. Please upload at least one photo.");
      return;
    }
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
          <div style={{ fontWeight: 700, fontSize: 17, color: "#0f1f35" }}>Complete Task</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>x</button>
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, padding: "8px 12px", background: "#f0fdf4", borderRadius: 8 }}>
          Completing: <b style={{ color: "#059669" }}>{task.title}</b>
        </div>

        {/* Photo upload */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Completion Photos</label>
          <input type="file" accept="image/*,video/*" multiple onChange={handlePhoto} style={{ fontSize: 12 }} />
          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {photos.map((url, i) => <img key={i} src={url} alt="completion" style={{ width: 70, height: 70, borderRadius: 6, objectFit: "cover" }} />)}
            </div>
          )}
        </div>

        {/* Parts used */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Parts / Materials Used</label>
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by name or part number..." style={{ ...inp, marginBottom: 8 }} />
          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>No inventory items found</div>
            ) : filtered.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#0f1f35" }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
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
                  <span style={{ fontSize: 12, color: "#64748b" }}>{item.unit}</span>
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

        {task.requirePhoto && photos.length === 0 && (
          <div style={{ background: "#fef9c3", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "#854d0e", fontWeight: 600 }}>
            Photo required — upload at least one photo to complete this task.
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleComplete} disabled={saving} style={{ flex: 1, background: task.requirePhoto && photos.length === 0 ? "#94a3b8" : "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Saving..." : "Mark Complete"}
          </button>
          <button onClick={onClose} style={{ flex: 1, background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, onStatus, onSaveNote, locId, onSelectMaterials, onEdit, onStartInspection, equipment }) {
const { user } = useAuth();
const [open, setOpen] = useState(false);
const [note, setNote] = useState(task.note || "");
const [showHistory, setShowHistory] = useState(false);
const [history, setHistory] = useState([]);
const [attachments, setAttachments] = useState(task.attachments || []);
const [uploading, setUploading] = useState(false);
const [uploadError, setUploadError] = useState("");

const handleFileUpload = async (file) => {
  if (!file || !locId) return;
  setUploading(true);
  setUploadError("");
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = "locations/" + locId + "/tasks/" + task.id + "/" + Date.now() + "_" + safeName;
    const url = await uploadFile(file, path);
    const newAttachments = [...attachments, { name: file.name, url, path, type: file.type, uploadedAt: new Date().toISOString() }];
    setAttachments(newAttachments);
    await updateDoc(doc(db, "locations", locId, "tasks", task.id), { attachments: newAttachments });
  } catch(e) {
    setUploadError("Upload failed: " + e.message);
  }
  setUploading(false);
};
const st = STS[task.status] || STS.pending;
const next = task.status === "pending" ? "in-progress" : task.status === "in-progress" ? "done" : "pending";
const nextLabel = task.status === "pending" ? "Start" : task.status === "in-progress" ? "Complete" : "Reopen";
const btnC = task.status === "pending" ? "#6366f1" : task.status === "in-progress" ? "#059669" : "#94a3b8";

const loadHistory = async () => {
if (!locId) return;
const snap = await getDocs(collection(db, "locations", locId, "tasks", task.id, "history"));
const entries = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.completedAt > a.completedAt ? 1 : -1);
setHistory(entries);
setShowHistory(true);
};

const handleStatus = async (e) => {
e.stopPropagation();
if (next === "done" && task.requirePhoto && !(task.mediaUrls?.length) && !(task.attachments?.length)) {
  alert("A photo is required to complete this task. Please open the task and upload a photo first.");
  return;
}
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

// Auto-create next occurrence for recurring tasks
if (task.recurrence && !task.recurrence.includes("cars")) {
  const nextDue = new Date();
  if (task.recurrence === "daily") nextDue.setDate(nextDue.getDate() + 1);
  else if (task.recurrence === "weekly") nextDue.setDate(nextDue.getDate() + 7);
  else if (task.recurrence === "monthly") nextDue.setMonth(nextDue.getMonth() + 1);
  else if (task.recurrence === "quarterly") nextDue.setMonth(nextDue.getMonth() + 3);
  else if (task.recurrence === "annually") nextDue.setFullYear(nextDue.getFullYear() + 1);
  const newId = "t" + Date.now();
  await setDoc(doc(db, "locations", locId, "tasks", newId), {
    ...task,
    id: newId,
    status: "pending",
    completedAt: null,
    completedBy: null,
    startedAt: null,
    archived: false,
    archivedAt: null,
    due: nextDue.toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    note: "",
    attachments: [],
  });
} else if (task.recurrence && task.recurrence.includes("cars") && task.equipmentId) {
  // Car-based recurrence — schedule next task based on equipment car count
  const carInterval = parseInt(task.recurrence.replace(/[^0-9]/g, "")) || 0;
  if (carInterval > 0) {
    try {
      const eqDoc = await getDoc(doc(db, "locations", locId, "equipment", task.equipmentId));
      const currentCars = eqDoc.exists() ? (eqDoc.data().carsCount || 0) : 0;
      const nextTargetCars = currentCars + carInterval;
      // Update equipment lastServiceCars so we can track progress
      await updateDoc(doc(db, "locations", locId, "equipment", task.equipmentId), {
        lastServiceCars: currentCars,
        lastService: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        updatedAt: new Date().toISOString(),
      });
      const newId = "t" + Date.now();
      await setDoc(doc(db, "locations", locId, "tasks", newId), {
        ...task,
        id: newId,
        status: "pending",
        completedAt: null,
        completedBy: null,
        startedAt: null,
        archived: false,
        archivedAt: null,
        due: null,
        nextCarsDue: nextTargetCars,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        note: "",
        attachments: [],
      });
    } catch(e) { console.log("Car recurrence error:", e.message); }
  }
} else if (task.recurrence && task.recurrence.includes("cars") && task.equipmentId) {
  // Car-based recurrence — schedule next task based on equipment car count
  const carInterval = parseInt(task.recurrence.replace(/[^0-9]/g, "")) || 0;
  if (carInterval > 0) {
    try {
      const eqDoc = await getDoc(doc(db, "locations", locId, "equipment", task.equipmentId));
      const currentCars = eqDoc.exists() ? (eqDoc.data().carsCount || 0) : 0;
      const nextTargetCars = currentCars + carInterval;
      // Update equipment lastServiceCars so we can track progress
      await updateDoc(doc(db, "locations", locId, "equipment", task.equipmentId), {
        lastServiceCars: currentCars,
        lastService: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        updatedAt: new Date().toISOString(),
      });
      const newId = "t" + Date.now();
      await setDoc(doc(db, "locations", locId, "tasks", newId), {
        ...task,
        id: newId,
        status: "pending",
        completedAt: null,
        completedBy: null,
        startedAt: null,
        archived: false,
        archivedAt: null,
        due: null,
        nextCarsDue: nextTargetCars,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        note: "",
        attachments: [],
      });
    } catch(e) { console.log("Car recurrence error:", e.message); }
  }
}
} else if (locId) {
const updates = { status: next, updatedAt: new Date().toISOString() };
if (next === "in-progress") updates.startedAt = new Date().toISOString();
if (next === "done") updates.completedAt = new Date().toISOString();
if (next === "pending") { updates.completedAt = null; updates.archived = false; } console.log("Reopening task", task.id, "locId:", locId, "updates:", updates);
await updateDoc(doc(db, "locations", locId, "tasks", task.id), updates);
} else {
onStatus(task.id, next);
}
};

const recurrenceLabel = task.recurrence ? "Repeats: " + task.recurrence : null;
const carsDueLabel = task.nextCarsDue ? "Due at " + Number(task.nextCarsDue).toLocaleString() + " cars" : null;

return (
<div style={{ background: task.status === "done" ? "#fafafa" : "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 8, overflow: "hidden", opacity: task.status === "done" ? 0.72 : 1 }}>
<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer" }} onClick={() => setOpen(!open)}>
<div style={{ width: 9, height: 9, borderRadius: "50%", background: st.dot, flexShrink: 0 }} />
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ fontWeight: 600, fontSize: 13.5, color: task.status === "done" ? "#94a3b8" : "#0f1f35", textDecoration: task.status === "done" ? "line-through" : "none", overflowWrap: "anywhere" }}>{task.title}</div>
<div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
<Pill label={task.category} bg={CAT[task.category]?.bg} color={CAT[task.category]?.color} />
<Pill label={task.priority} bg={PRI[task.priority]?.bg} color={PRI[task.priority]?.color} />
<span style={{ fontSize: 11, color: "#94a3b8" }}>{task.due && task.due.includes("-") ? new Date(task.due + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : task.due}</span>
{recurrenceLabel && <span style={{ fontSize: 11, color: "#6366f1", background: "#ede9fe", padding: "1px 7px", borderRadius: 99 }}>{recurrenceLabel}</span>}
{carsDueLabel && <span style={{ fontSize: 11, color: "#d97706", background: "#fef3c7", padding: "1px 7px", borderRadius: 99 }}>{carsDueLabel}</span>}
            {task.due && task.due.includes("-") && task.status !== "done" && new Date(task.due + "T23:59:59") < new Date() && (
              <span style={{ fontSize: 11, color: "#dc2626", background: "#fee2e2", padding: "1px 7px", borderRadius: 99, fontWeight: 700 }}>Overdue</span>
            )}
            {task.due && task.due.includes("-") && task.status !== "done" && new Date(task.due + "T23:59:59") < new Date() && (
              <span style={{ fontSize: 11, color: "#dc2626", background: "#fee2e2", padding: "1px 7px", borderRadius: 99, fontWeight: 700 }}>Overdue</span>
            )}
</div>
</div>
<div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "50%" }}>
          <button onClick={(e) => {
  e.stopPropagation();
  if ((task.type === "inspection" || task.category === "inspection") && task.status !== "done" && task.checklist?.length > 0 && onStartInspection) {
    onStartInspection(task);
  } else if (next === "done" && task.requirePhoto && !(task.mediaUrls?.length) && !(task.attachments?.length)) {
    alert("A photo is required to complete this task. Please use the Complete button inside the task to upload a photo first.");
  } else { handleStatus(e); }
}} style={{ background: task.type === "inspection" && task.status !== "done" ? "#15803d" : btnC, color: "#fff", border: "none", borderRadius: 6, padding: "5px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
  {task.type === "inspection" && task.status !== "done" ? "Inspect" : nextLabel}
</button>
{(user?.role === "manager" || user?.role === "owner") && task.status === "done" && !task.archived && (
  <button onClick={async (e) => {
    e.stopPropagation();
    await updateDoc(doc(db, "locations", locId, "tasks", task.id), { archived: true, archivedAt: new Date().toISOString() });
  }} style={{ background: "#d1fae5", color: "#065f46", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Approve</button>
)}
{(user?.role === "manager" || user?.role === "owner") && (
  <button onClick={e => { e.stopPropagation(); onEdit && onEdit(task); }} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Edit</button>
)}
{(user?.role === "manager" || user?.role === "owner") && (
  <button onClick={async (e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this task?")) return;
    await deleteDoc(doc(db, "locations", locId, "tasks", task.id));
  }} style={{ background: "none", color: "#dc2626", border: "1.5px solid #dc2626", borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <polyline points="3 6 5 6 21 6"/>
  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
  <path d="M10 11v6M14 11v6"/>
  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
</svg></button>
)}
          {task.status === "in-progress" && (
            <button onClick={e => { e.stopPropagation(); onStatus(task.id, "on-hold"); }} style={{ background: "#fce7f3", color: "#be185d", border: "1px solid #fbcfe8", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>On Hold</button>
          )}
        </div>
<span style={{ color: "#d1d5db", fontSize: 11 }}>{open ? "v" : ">"}</span>
</div>
{open && (
<div style={{ padding: "12px 14px 14px", borderTop: "1px solid #f3f4f6", background: "#fafbfc" }}>
<div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#64748b", marginBottom: 10 }}>
<span><b>Shift:</b> {task.shift}</span>
<span><b>Status:</b> <Pill label={st.label} bg={st.bg} color={st.color} /></span>
{task.equipmentId && equipment && <span><b>Equipment:</b> {equipment.find(e => e.id === task.equipmentId)?.name || task.equipmentId}</span>}
{task.completedBy && <span><b>Completed by:</b> {task.completedBy}</span>}
{task.completedAt && <span><b>Completed:</b> {new Date(task.completedAt).toLocaleDateString()}</span>}
{task.duration != null && <span><b>Duration:</b> {task.duration} min</span>}
</div>
<div style={{ marginBottom: 10 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>Notes</label>
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
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Attachments</label>
            {attachments.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>No attachments yet</div>}
            {attachments.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: "#f8fafc", borderRadius: 8, padding: 8 }}>
                {a.type?.startsWith("image/") ? (
                  <img src={a.url} alt={a.name} onClick={() => window.open(a.url)}
                    style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, cursor: "pointer", flexShrink: 0 }} />
                ) : (
                  <a href={a.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "#0369a1", textDecoration: "none", flex: 1 }}>
                    {a.name}
                  </a>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#334155", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(a.uploadedAt).toLocaleDateString()}</div>
                </div>
                {(user?.role === "manager" || user?.role === "owner") && (
                  <button onClick={async () => {
                    if (!window.confirm("Delete this attachment? This cannot be undone.")) return;
                    try {
                      const fileRef = ref(storage, a.path || a.url);
                      await deleteObject(fileRef);
                    } catch(e) {}
                    const updated = attachments.filter((_, j) => j !== i);
                    setAttachments(updated);
                    await updateDoc(doc(db, "locations", locId, "tasks", task.id), { attachments: updated });
                  }} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>Delete</button>
                )}
              </div>
            ))}
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: uploading ? "not-allowed" : "pointer", fontSize: 12, color: uploading ? "#94a3b8" : "#0369a1", fontWeight: 600, background: "#f0f9ff", padding: "6px 12px", borderRadius: 8, border: "1px solid #bae6fd" }}>
              {uploading ? "Uploading..." : "Add photo or file"}
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                onChange={e => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); e.target.value = ""; }} disabled={uploading} />
            </label>
            {uploading && <div style={{ fontSize: 11, color: "#0369a1", marginTop: 4 }}>Uploading, please wait...</div>}
{uploadError && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{uploadError}</div>}
          </div>
          
<div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
<button onClick={loadHistory} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "#64748b", cursor: "pointer" }}>
View History
</button>
{task.status === "in-progress" && onSelectMaterials && (
<button onClick={e => { e.stopPropagation(); onSelectMaterials(task); }} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "#059669", cursor: "pointer", fontWeight: 600 }}>
+ Materials Used
</button>
)}
</div>
{task.partsUsed && task.partsUsed.length > 0 && (
  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
    <span style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>Materials:</span>
    {task.partsUsed.map((p, i) => (
      <span key={i} style={{ fontSize: 10, background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>{p.name} x{p.qty}</span>
    ))}
  </div>
)}
{(task.category === "inspection" || task.type === "inspection") && task.status === "done" && task.checklist?.length > 0 && (
  <div style={{ marginTop: 12, marginBottom: 12 }}>
    <div style={{ fontWeight: 600, fontSize: 12, color: "#334155", marginBottom: 8 }}>Inspection Results</div>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <div style={{ background: "#dcfce7", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#15803d" }}>{task.checklist.filter(i => i.result === "good").length} Passed</div>
      {task.checklist.filter(i => i.result === "monitor").length > 0 && <div style={{ background: "#fef9c3", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#854d0e" }}>{task.checklist.filter(i => i.result === "monitor").length} Monitor</div>}
      {task.checklist.filter(i => i.result === "fail").length > 0 && <div style={{ background: "#fee2e2", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#dc2626" }}>{task.checklist.filter(i => i.result === "fail").length} Failed</div>}
    </div>
    {task.checklist.map((item, idx) => (
      <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
          background: item.result === "good" ? "#dcfce7" : item.result === "fail" ? "#fee2e2" : "#fef9c3",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
          color: item.result === "good" ? "#15803d" : item.result === "fail" ? "#dc2626" : "#854d0e" }}>
          {item.result === "good" ? "✓" : item.result === "fail" ? "✕" : "!"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#0f1f35" }}>{item.label}</div>
          {item.note && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{item.note}</div>}
          {item.photoUrl && <img src={item.photoUrl} alt="inspection" onClick={() => window.open(item.photoUrl)}
            style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, marginTop: 4, cursor: "pointer" }} />}
        </div>
      </div>
    ))}
  </div>
)}
{showHistory && (
<div style={{ marginTop: 12 }}>
<div style={{ fontWeight: 600, fontSize: 12, color: "#334155", marginBottom: 8 }}>Task History</div>
{history.length === 0 ? (
<div style={{ fontSize: 12, color: "#94a3b8" }}>No history yet.</div>
) : history.map(h => (
<div key={h.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 7, padding: "8px 12px", marginBottom: 6, fontSize: 12 }}>
<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
<span style={{ fontWeight: 600, color: "#334155" }}>{h.date}</span>
<span style={{ color: "#94a3b8" }}>{h.duration != null ? h.duration + " min" : ""}</span>
</div>
<div style={{ color: "#64748b" }}><b>By:</b> {h.completedBy}</div>
{h.note && <div style={{ color: "#334155", marginTop: 4, fontStyle: "italic" }}>{h.note}</div>}
</div>
))}
</div>
)}
</div>
)}
</div>
);
}

function Tasks({ tasks, onStatus, showAll, locationName, onAddTask, onSaveNote, locId, onSelectMaterials, onEdit, equipment }) {
const { user } = useAuth();
const [fStatus, setFS] = useState("all");
const [fCat, setFC] = useState("all");
const [inspectionTask, setInspectionTask] = useState(null);
const [showArchived, setShowArchived] = useState(false);
const [showHistory, setShowHistory] = useState(false);
const isManager = user?.role === "manager" || user?.role === "owner";
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const isTech = user?.role === "technician";
const isAttendant = user?.role === "attendant";
const mine = isManager ? tasks : tasks.filter(t =>
  t.shift === "everyone" || t.shift === user?.role ||
  (isTech && t.shift === "technician") ||
  (isAttendant && t.shift === "attendant")
);
const filtered = mine.filter(t => {
// Hide archived tasks unless showArchived
if (t.archived && !showArchived) return false;
// Hide completed tasks older than 7 days unless showArchived
if (t.status === "done" && !showArchived && t.completedAt && t.completedAt < sevenDaysAgo) return false;
if (fStatus === "overdue") {
  const today = new Date().toISOString().split("T")[0];
  if (t.status === "done") return false;
  if (!t.due || !t.due.includes("-") || t.due >= today) return false;
} else if (fStatus === "monitor") {
  const hasMonitor = t.checklist?.some(i => i.result === "monitor");
  if (!hasMonitor) return false;
} else if (fStatus !== "all" && t.status !== fStatus) return false;
if (fCat !== "all" && t.category !== fCat) return false;
return true;
});
const done = mine.filter(t => t.status === "done").length;
const pct = mine.length ? Math.round(done / mine.length * 100) : 0;

const chip = (val, cur, set, label) => (
<button onClick={() => set(val)} style={{ padding: "5px 12px", borderRadius: 99, border: "1px solid #e5e7eb", background: cur === val ? "#0f1f35" : "#fff", color: cur === val ? "#fff" : "#334155", fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
);

return (
<div>
<div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
<div>
<div style={{ fontSize: 20, fontWeight: 700, color: "#0f1f35" }}>"Tasks"</div>
<div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{locationName}</div>
</div>
<button onClick={onAddTask} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, WebkitAppearance: "none" }}>+ Add Task</button>
<button onClick={() => setShowHistory(true)} style={{ background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Task History</button>
</div>
<div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
  <select value={fStatus} onChange={e => setFS(e.target.value)} style={{ padding: "8px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#334155", background: "#fff", cursor: "pointer", outline: "none" }}>
    <option value="all">All Status</option>
    <option value="pending">Pending</option>
    <option value="in-progress">In Progress</option>
    <option value="done">Done</option>
    <option value="overdue">Overdue</option>
  </select>
  <select value={fCat} onChange={e => setFC(e.target.value)} style={{ padding: "8px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#334155", background: "#fff", cursor: "pointer", outline: "none" }}>
    <option value="all">All Types</option>
    <option value="cleaning">Cleaning</option>
    <option value="equipment">Equipment</option>
    <option value="maintenance">Maintenance</option>
    <option value="chemicals">Chemicals</option>
    <option value="supplies">Supplies</option>
    <option value="inspection">Inspection</option>
  </select>
</div>
  <div>
    {filtered.length === 0 ? (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f1f35", marginBottom: 6 }}>No tasks yet</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Add your first task to get started tracking work at this location.</div>
        <button onClick={onAddTask} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add First Task</button>
      </div>
    ) : filtered.map(t => <TaskRow key={t.id} task={t} onStatus={onStatus} onSaveNote={onSaveNote} locId={locId} onSelectMaterials={onSelectMaterials} onStartInspection={setInspectionTask} equipment={equipment} onEdit={onEdit} />)}
    {showHistory && (
  <TaskHistoryModal
    tasks={tasks}
    locId={locId}
    onClose={() => setShowHistory(false)}
  />
)}
{inspectionTask && locId && (
  <InspectionModal
    task={inspectionTask}
    locId={locId}
    user={user}
    onClose={() => setInspectionTask(null)}
    onComplete={() => setInspectionTask(null)}
  />
)}
{false && <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>No tasks match your filters.</div>}
  </div>
</div>

);
}

function Equipment({ equipment, locationName, locId, allTasks, onCreateTask, onNavigate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [newEq, setNewEq] = useState({ name: "", status: "ok", lastService: "", lastServiceCars: 0, nextService: "", nextServiceCars: "", carsCount: 0, tracksCarCount: false });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [eqFiles, setEqFiles] = useState({});
  const [eqUploading, setEqUploading] = useState({});
  const [editingFileName, setEditingFileName] = useState(null);
  const [fileNameEdit, setFileNameEdit] = useState("");
  const { user } = useAuth();

  const handleEqFileUpload = async (eqId, file) => {
    if (!file || !locId) return;
    setEqUploading(p => ({ ...p, [eqId]: true }));
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = "locations/" + locId + "/equipment/" + eqId + "/" + Date.now() + "_" + safeName;
      const url = await uploadFile(file, path);
      const newFile = { name: file.name, url, path, type: file.type, uploadedAt: new Date().toISOString() };
      const current = eqFiles[eqId] || [];
      const updated = [...current, newFile];
      setEqFiles(p => ({ ...p, [eqId]: updated }));
      await updateDoc(doc(db, "locations", locId, "equipment", eqId), { files: updated });
    } catch(e) { alert("Upload failed: " + e.message); }
    setEqUploading(p => ({ ...p, [eqId]: false }));
  };

  const [histories, setHistories] = useState({});

  const inp = { width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 4, background: "#fff", color: "#0f1f35" };

  const toggleExpand = async (eqId) => {
    const next = { ...expanded, [eqId]: !expanded[eqId] };
    setExpanded(next);
    if (next[eqId] && !histories[eqId]) {
      // Load equipment history entries
      const snap = await getDocs(collection(db, "locations", locId, "equipment", eqId, "history"));
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Load completed tasks linked to this equipment
      const tasksSnap = await getDocs(collection(db, "locations", locId, "tasks"));
      const linkedTasks = tasksSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => t.equipmentId === eqId && (t.status === "done" || t.archived));

      // For each completed task, load its history subcollection for notes/photos
      const taskEntries = [];
      for (const t of linkedTasks) {
        const histSnap = await getDocs(collection(db, "locations", locId, "tasks", t.id, "history"));
        const latestHist = histSnap.docs.map(d => d.data()).sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0];
        taskEntries.push({
          id: "task_" + t.id,
          type: "task",
          taskId: t.id,
          date: t.completedAt ? t.completedAt.split("T")[0] : t.updatedAt?.split("T")[0] || "",
          completedAt: t.completedAt || t.updatedAt,
          note: latestHist?.note || t.note || "",
          completedBy: t.completedBy || latestHist?.completedBy || "",
          duration: latestHist?.duration || t.duration || null,
          taskTitle: t.title,
          category: t.category,
          mediaUrls: t.mediaUrls || latestHist?.photos || [],
          partsUsed: latestHist?.partsUsed || [],
          items: latestHist?.items || t.checklist || [],
          failCount: latestHist?.failCount || 0,
          monitorCount: latestHist?.monitorCount || 0,
        });
      }

      const allEntries = [...entries, ...taskEntries].sort((a, b) => (b.completedAt || b.date || "").localeCompare(a.completedAt || a.date || ""));
      setHistories(p => ({ ...p, [eqId]: allEntries }));
    }
  };

  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null);

  const handleAdd = async () => {
    if (!newEq.name.trim()) return;
    setSaving(true);
    const id = "e" + Date.now();
    const washWords = ["wash", "clean", "rinse", "foam", "shine", "scrub", "spray", "buff", "gloss", "suds"];
    const washWord = washWords[Math.floor(Math.random() * washWords.length)];
    const eqEmailCode = newEq.tracksCarCount ? (washWord + Math.floor(1000 + Math.random() * 9000)) : null;
    await setDoc(doc(db, "locations", locId, "equipment", id), { ...newEq, id, note: "", manuals: [], emailCode: eqEmailCode, createdAt: new Date().toISOString() });
    setNewEq({ name: "", status: "ok", lastService: "", lastServiceCars: 0, nextService: "", nextServiceCars: "", carsCount: 0, tracksCarCount: false });
    setShowAdd(false);
    setSaving(false);
  };

  const handleSaveEdit = async (eqId) => {
    const eq = equipment.find(e => e.id === eqId);
    const washWords2 = ["wash", "clean", "rinse", "foam", "shine", "scrub", "spray", "buff", "gloss", "suds"];
    const washWord2 = washWords2[Math.floor(Math.random() * washWords2.length)];
    const updates = { ...editData, updatedAt: new Date().toISOString() };
    if (editData.tracksCarCount && !eq.emailCode) {
      updates.emailCode = washWord2 + Math.floor(1000 + Math.random() * 9000);
    }
    if (!editData.tracksCarCount) updates.emailCode = null;
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
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f1f35" }}>Equipment</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{locationName}</div>
        </div>
        {(user?.role === "manager" || user?.role === "owner") && <button onClick={() => setShowAdd(!showAdd)} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Equipment</button>}
      </div>

      {showAdd && (
        <div style={{ background: "#fff", border: "1.5px dashed #6366f1", borderRadius: 16, padding: 20, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#6366f1", marginBottom: 14 }}>New Equipment</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Name</label><input value={newEq.name} onChange={e => setNewEq(p => ({...p, name: e.target.value}))} placeholder="e.g. Conveyor Belt" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Status</label>
              <select value={newEq.status} onChange={e => setNewEq(p => ({...p, status: e.target.value}))} style={inp}>
                <option value="ok">OK</option><option value="warning">Warning</option><option value="error">Alert</option>
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Last Service Date</label><input value={newEq.lastService} onChange={e => setNewEq(p => ({...p, lastService: e.target.value}))} placeholder="e.g. Mar 15, 2026" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Car Count at Last Service</label><input type="number" value={newEq.lastServiceCars} onChange={e => setNewEq(p => ({...p, lastServiceCars: parseInt(e.target.value)||0}))} placeholder="0" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Next Service Date</label><input value={newEq.nextService} onChange={e => setNewEq(p => ({...p, nextService: e.target.value}))} placeholder="e.g. Apr 15, 2026" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Next Service at Cars</label><input type="number" value={newEq.nextServiceCars} onChange={e => setNewEq(p => ({...p, nextServiceCars: parseInt(e.target.value)||0}))} placeholder="e.g. 50000" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Current Car Count</label><input type="number" value={newEq.carsCount} onChange={e => setNewEq(p => ({...p, carsCount: parseInt(e.target.value)||0}))} placeholder="0" style={inp} /></div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={newEq.tracksCarCount} onChange={e => setNewEq(p => ({...p, tracksCarCount: e.target.checked}))} style={{ width: 16, height: 16, accentColor: "#0f1f35" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>Track car count for this equipment</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Generates a dedicated email address for automated car count logging</div>
            </div>
          </label>
          {newEq.tracksCarCount && (
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#0369a1" }}>
              A unique email address will be generated for this equipment when saved.
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleAdd} disabled={saving} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "Adding..." : "Add"}</button>
            <button onClick={() => setShowAdd(false)} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {selectedHistoryEntry && <TaskHistoryDetailModal entry={selectedHistoryEntry} onClose={() => setSelectedHistoryEntry(null)} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {equipment.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f1f35", marginBottom: 6 }}>No equipment added yet</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Track your car wash equipment, service schedules, and maintenance history.</div>
            {(user?.role === "manager" || user?.role === "owner") && <button onClick={() => setShowAdd(true)} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add First Equipment</button>}
          </div>
        ) : equipment.map(eq => {
          const s = EQS[eq.status] || EQS.ok;
          const isExpanded = expanded[eq.id];
          const isEditing = editingId === eq.id;
          const linkedTasks = (allTasks || []).filter(t => t.equipmentId === eq.id && t.status !== "done" && !t.archived);
          const eqHistory = histories[eq.id] || [];
          const files = eqFiles[eq.id] || eq.files || [];
          const carsSinceService = eq.carsCount && eq.lastServiceCars ? (eq.carsCount - eq.lastServiceCars).toLocaleString() : null;
          const carsUntilService = eq.nextServiceCars && eq.carsCount ? Math.max(0, eq.nextServiceCars - eq.carsCount).toLocaleString() : null;

          return (
            <div key={eq.id} style={{ background: "#fff", border: `1.5px solid ${eq.status !== "ok" ? s.color + "60" : "#e2e8f0"}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => toggleExpand(eq.id)}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>{eq.name}</div>
                    <Pill label={s.label} bg={s.bg} color={s.color} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6, fontSize: 12, color: "#64748b" }}>
                    <div style={{ background: "#f4f6f8", borderRadius: 6, padding: "6px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Last Service</div>
                      <div style={{ fontWeight: 600, color: "#334155" }}>{eq.lastService || "-"}</div>
                      {eq.lastServiceCars ? <div style={{ color: "#94a3b8" }}>at {Number(eq.lastServiceCars).toLocaleString()} cars</div> : null}
                    </div>
                    <div style={{ background: "#f4f6f8", borderRadius: 6, padding: "6px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Next Service</div>
                      <div style={{ fontWeight: 600, color: eq.nextService === "Overdue" ? "#ef4444" : "#334155" }}>{eq.nextService || "-"}</div>
                      {eq.nextServiceCars ? <div style={{ color: "#94a3b8" }}>or at {Number(eq.nextServiceCars).toLocaleString()} cars</div> : null}
                    </div>
                    <div style={{ background: "#f4f6f8", borderRadius: 6, padding: "6px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Total Cars</div>
                      <div style={{ fontWeight: 600, color: "#334155" }}>{(eq.carsCount || 0).toLocaleString()}</div>
                      {carsSinceService && <div style={{ color: "#94a3b8" }}>{carsSinceService} since last service</div>}
                    </div>
                    {carsUntilService && (
                      <div style={{ background: Number(carsUntilService.replace(/,/g,"")) < 1000 ? "#fee2e2" : "#f0fdf4", borderRadius: 6, padding: "6px 10px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Cars Until Service</div>
                        <div style={{ fontWeight: 700, color: Number(carsUntilService.replace(/,/g,"")) < 1000 ? "#ef4444" : "#059669" }}>{carsUntilService}</div>
                      </div>
                    )}
                  </div>
                  {eq.emailCode && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, background: "#f0f9ff", borderRadius: 7, padding: "7px 10px" }}>
                      <div style={{ fontSize: 11, color: "#0369a1" }}>Car count email: <b>{eq.emailCode}@washlevel.com</b></div>
                      <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(eq.emailCode + "@washlevel.com"); }}
                        style={{ background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: 4, padding: "2px 7px", fontSize: 10, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>Copy</button>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                  {(user?.role === "manager" || user?.role === "owner") && <button onClick={e => { e.stopPropagation(); setEditingId(isEditing ? null : eq.id); setEditData({ status: eq.status, lastService: eq.lastService||"", lastServiceCars: eq.lastServiceCars||0, nextService: eq.nextService||"", nextServiceCars: eq.nextServiceCars||0, carsCount: eq.carsCount||0, note: eq.note||"", tracksCarCount: eq.tracksCarCount||false }); }} style={{ background: "#f1f5f9", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#334155", fontWeight: 600 }}>Edit</button>}
                  <button onClick={e => { e.stopPropagation(); onCreateTask && onCreateTask(eq); }} style={{ background: "#ede9fe", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#6366f1", fontWeight: 600 }}>+ Task</button>
                  {(user?.role === "manager" || user?.role === "owner") && <button onClick={e => { e.stopPropagation(); handleDelete(eq.id); }} style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#dc2626", fontWeight: 600 }}>Delete</button>}
                </div>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>{isExpanded ? "v" : ">"}</span>
              </div>

              {/* Edit form */}
              {isEditing && (
                <div style={{ padding: "0 20px 16px", borderTop: "1px solid #f3f4f6", background: "#fafbfc" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginTop: 14, marginBottom: 12 }}>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Status</label>
                      <select value={editData.status} onChange={e => setEditData(p => ({...p, status: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }}>
                        <option value="ok">OK</option><option value="warning">Warning</option><option value="error">Alert</option>
                      </select>
                    </div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Current Car Count</label><input type="number" value={editData.carsCount} onChange={e => setEditData(p => ({...p, carsCount: parseInt(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Last Service Date</label><input value={editData.lastService} onChange={e => setEditData(p => ({...p, lastService: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Car Count at Last Service</label><input type="number" value={editData.lastServiceCars} onChange={e => setEditData(p => ({...p, lastServiceCars: parseInt(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Next Service Date</label><input value={editData.nextService} onChange={e => setEditData(p => ({...p, nextService: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Next Service at Cars</label><input type="number" value={editData.nextServiceCars} onChange={e => setEditData(p => ({...p, nextServiceCars: parseInt(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Notes</label>
                    <textarea value={editData.note} onChange={e => setEditData(p => ({...p, note: e.target.value}))} rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit", fontSize: 12, padding: "6px 8px" }} />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, cursor: "pointer" }}>
                    <input type="checkbox" checked={editData.tracksCarCount || false} onChange={e => setEditData(p => ({...p, tracksCarCount: e.target.checked}))} style={{ width: 16, height: 16, accentColor: "#0f1f35" }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f1f35" }}>Track car count for this equipment</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{eq.emailCode ? "Email: " + eq.emailCode + "@washlevel.com" : "Will generate a dedicated email address"}</div>
                    </div>
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleSaveEdit(eq.id)} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Expanded details */}
              {isExpanded && !isEditing && (<>
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f3f4f6" }}>
                  {eq.note && <div style={{ marginTop: 12, fontSize: 13, color: "#334155", fontStyle: "italic" }}>{eq.note}</div>}



                  {/* Linked tasks */}
                  {linkedTasks.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Linked Tasks ({linkedTasks.length})</div>
                      {linkedTasks.map(t => (
                        <div key={t.id} onClick={() => onNavigate && onNavigate("tasks")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12, borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
  onMouseEnter={e => e.currentTarget.style.background="#f0f9ff"}
  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: STS[t.status]?.dot || "#94a3b8", flexShrink: 0 }} />
                          <span style={{ flex: 1, color: "#334155" }}>{t.title}</span>
                          <Pill label={STS[t.status]?.label || t.status} bg={STS[t.status]?.bg || "#f1f5f9"} color={STS[t.status]?.color || "#64748b"} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* History */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Service History</div>
                    {eqHistory.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>No history yet. History is recorded automatically when you update service dates, car counts, or complete linked tasks.</div>
                    ) : eqHistory.map(h => (
                      <div key={h.id} onClick={() => h.type === "task" ? setSelectedHistoryEntry(h) : null}
                        style={{ padding: "8px 10px", background: h.type === "task" ? "#f0f9ff" : "#f4f6f8", borderRadius: 7, marginBottom: 6, fontSize: 12, cursor: h.type === "task" ? "pointer" : "default", border: h.type === "task" ? "1px solid #bae6fd" : "1px solid transparent" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2, alignItems: "center" }}>
                          <span style={{ fontWeight: 600, color: "#334155" }}>
                            {h.type === "task" ? (h.taskTitle || "Task") : h.type === "inspection" ? "Inspection" : "Service"} — {h.date || (h.completedAt ? new Date(h.completedAt).toLocaleDateString() : "")}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {h.type === "task" && <span style={{ fontSize: 10, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "2px 6px", fontWeight: 600 }}>{h.category || "task"}</span>}
                            {h.type === "inspection" && <span style={{ color: h.failCount > 0 ? "#dc2626" : (h.monitorCount > 0 ? "#d97706" : "#15803d"), fontWeight: 600 }}>
                              {h.failCount > 0 ? h.failCount + " failed" : h.monitorCount > 0 ? h.monitorCount + " to monitor" : "All passed"}
                            </span>}
                            {(user?.role === "manager" || user?.role === "owner") && h.type !== "task" && (
                              <button onClick={async (e) => {
                                e.stopPropagation();
                                if (!window.confirm("Delete this history entry?")) return;
                                await deleteDoc(doc(db, "locations", locId, "equipment", eq.id, "history", h.id));
                                setHistories(p => ({ ...p, [eq.id]: (p[eq.id] || []).filter(x => x.id !== h.id) }));
                              }} style={{ background: "none", color: "#dc2626", border: "1.5px solid #dc2626", borderRadius: 6, padding: "3px 6px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                                <TrashIcon />
                              </button>
                            )}
                            {h.type === "task" && <span style={{ fontSize: 11, color: "#0369a1" }}>View</span>}
                          </div>
                        </div>
                        <div style={{ color: "#64748b" }}>{h.completedBy ? "by " + h.completedBy : ""}{h.duration ? " · " + h.duration + " min" : ""}</div>
                        {h.note && <div style={{ color: "#334155", marginTop: 2, fontStyle: "italic" }}>{h.note}</div>}
                        {h.type === "inspection" && h.items && (
                          <div style={{ marginTop: 4 }}>
                            {h.items.filter(i => i.result !== "good").map((item, idx) => (
                              <div key={idx} style={{ marginTop: 6 }}>
                                <div style={{ fontSize: 11, color: item.result === "fail" ? "#dc2626" : "#d97706", fontWeight: 600 }}>
                                  {item.result === "fail" ? "x" : "!"} {item.label}{item.note ? ": " + item.note : ""}
                                </div>
                                {item.photoUrl && <img src={item.photoUrl} alt="inspection" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, marginTop: 4, cursor: "pointer" }} onClick={() => window.open(item.photoUrl)} />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f3f4f6" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#334155", marginBottom: 10 }}>Manuals & Documents</div>
                  {files.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>No files uploaded yet</div>}
                  {files.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: "#f8fafc", borderRadius: 8, padding: 8 }}>
                      {f.type?.startsWith("image/") ? (
                        <img src={f.url} alt={f.name} onClick={() => window.open(f.url)}
                          style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, cursor: "pointer", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 48, height: 48, background: "#e0e7ff", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, cursor: "pointer" }}
                          onClick={() => window.open(f.url)}>PDF</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {editingFileName === eq.id + "_" + i ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input value={fileNameEdit} onChange={e => setFileNameEdit(e.target.value)}
                              style={{ fontSize: 12, padding: "3px 6px", border: "1px solid #0369a1", borderRadius: 6, flex: 1, outline: "none" }}
                              onKeyDown={async e => {
                                if (e.key === "Enter") {
                                  const updated = files.map((fl, j) => j === i ? { ...fl, name: fileNameEdit } : fl);
                                  setEqFiles(p => ({ ...p, [eq.id]: updated }));
                                  await updateDoc(doc(db, "locations", locId, "equipment", eq.id), { files: updated });
                                  setEditingFileName(null);
                                }
                                if (e.key === "Escape") setEditingFileName(null);
                              }} autoFocus />
                            <button onClick={async () => {
                              const updated = files.map((fl, j) => j === i ? { ...fl, name: fileNameEdit } : fl);
                              setEqFiles(p => ({ ...p, [eq.id]: updated }));
                              await updateDoc(doc(db, "locations", locId, "equipment", eq.id), { files: updated });
                              setEditingFileName(null);
                            }} style={{ fontSize: 11, background: "#0f1f35", color: "#fff", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Save</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                            <button onClick={() => { setEditingFileName(eq.id + "_" + i); setFileNameEdit(f.name); }}
                              style={{ fontSize: 10, color: "#64748b", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>Edit</button>
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(f.uploadedAt).toLocaleDateString()}</div>
                      </div>
                      {(user?.role === "manager" || user?.role === "owner") && (
                        <button onClick={async () => {
                          if (!window.confirm("Delete this file? This cannot be undone.")) return;
                          try { await deleteObject(ref(storage, f.path || f.url)); } catch(e) {}
                          const updated = files.filter((_, j) => j !== i);
                          setEqFiles(p => ({ ...p, [eq.id]: updated }));
                          await updateDoc(doc(db, "locations", locId, "equipment", eq.id), { files: updated });
                        }} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>Delete</button>
                      )}
                    </div>
                  ))}
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: eqUploading[eq.id] ? "not-allowed" : "pointer", fontSize: 12, color: eqUploading[eq.id] ? "#94a3b8" : "#0369a1", fontWeight: 600, background: "#f0f9ff", padding: "6px 12px", borderRadius: 8, border: "1px solid #bae6fd" }}>
                    {eqUploading[eq.id] ? "Uploading..." : "Add photo or PDF"}
                    <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                      onChange={e => { if (e.target.files[0]) handleEqFileUpload(eq.id, e.target.files[0]); e.target.value = ""; }}
                      disabled={eqUploading[eq.id]} />
                  </label>
                </div>
              </>
              )}
            </div>
          );
        })}
        {equipment.length === 0 && !showAdd && <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>No equipment yet. Tap + Add Equipment to get started.</div>}
      </div>
    </div>
  );
}


// Shelly device capability detection
function getShellyCapabilities(typeCode) {
  if (!typeCode) return { inputs: 0, relays: 0, power: false, distance: false };
  const t = typeCode.toUpperCase();
  
  // Input-only devices - Shelly splits multi-channel devices into individual entries
  if (t.includes('SN-002') || t.includes('I4') || t.includes('SNS')) 
    return { inputs: 1, relays: 0, power: false, distance: false, label: "Digital Input" };
  if (t.includes('SN-001')) 
    return { inputs: 1, relays: 0, power: false, distance: false, label: "Digital Input" };
  
  // Relay + Input devices
  if (t.includes('S4SW-001') || t.includes('SHSW-1') || t.includes('SNSW-001')) 
    return { inputs: 1, relays: 1, power: false, distance: false, label: "Relay + Input" };
  if (t.includes('SNSW-002') || t.includes('SHSW-2') || t.includes('S4SW-002')) 
    return { inputs: 2, relays: 2, power: false, distance: false, label: "2-Channel Relay + Input" };
  
  // Power monitoring devices
  if (t.includes('SNPL') || t.includes('SHPLG') || t.includes('PLUG'))
    return { inputs: 0, relays: 1, power: true, distance: false, label: "Smart Plug" };
  if (t.includes('SPSW') || t.includes('PRO'))
    return { inputs: 1, relays: 1, power: true, distance: false, label: "Pro Relay" };
  
  // BLU distance
  if (t.includes('BLU') || t.includes('DIST'))
    return { inputs: 0, relays: 0, power: false, distance: true, label: "BLU Distance" };
  
  // Default - assume basic relay
  return { inputs: 1, relays: 1, power: false, distance: false, label: "Relay" };
}

function Sensors({ sensors, locationName, locId, onNavigate, uid, locations, initialTab, onTabChange }) {
  const user = { uid };
  const s = sensors || {};
  const [spSensors, setSpSensors] = useState([]);
  const [history, setHistory] = useState({});
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [chemDetailSensor, setChemDetailSensor] = useState(null);
  const [chemSensors, setChemSensors] = useState([]);
  const [activeTab, setActiveTab] = useState(initialTab || "sensorpush");
  const [shellyDevices, setShellyDevices] = useState([]);
  const [showAddShelly, setShowAddShelly] = useState(false);
  const [newShelly, setNewShelly] = useState({ name: "", deviceId: "", channel: 0, type: "input", alertOn: "on" });
  const [savingShelly, setSavingShelly] = useState(false);
  const [shellyReadings, setShellyReadings] = useState({});
  const [selectedShellyDevice, setSelectedShellyDevice] = useState(null);
  const [togglingShelly, setTogglingShelly] = useState(false);
  const [shellyCloud, setShellyCloud] = useState(null);
  const [shellyAuthKey, setShellyAuthKey] = useState("");
  const [shellyServer, setShellyServer] = useState("shelly-103-eu.shelly.cloud");
  const [connectingShelly, setConnectingShelly] = useState(false);
  const [shellyCloudDevices, setShellyCloudDevices] = useState([]);
  const [loadingCloudDevices, setLoadingCloudDevices] = useState(false);
  const [pollingShelly, setPollingShelly] = useState(false);
  const [shellyAssignments, setShellyAssignments] = useState({});
  const [hiddenShellyDevices, setHiddenShellyDevices] = useState([]);
  const [expandedDevice, setExpandedDevice] = useState(null);
  const [shellyOrder, setShellyOrder] = useState([]);
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid, "prefs", "shellyConfig")).then(snap => {
      if (snap.exists()) {
        setShellyAssignments(snap.data().assignments || {});
        setHiddenShellyDevices(snap.data().hidden || []);
      }
    });
    getDoc(doc(db, "users", uid, "integrations", "shelly")).then(snap => {
      if (snap.exists() && !snap.data().disconnected) {
        setShellyCloud(snap.data());
        loadShellyCloudDevices(snap.data());
      }
    });
  }, [uid]);

  const toggleShellyRelay = async (device, currentState) => {
    if (!shellyCloud) return;
    setTogglingShelly(true);
    try {
      const shellyProxy = httpsCallable(functions, "shellyCloudProxy");
      await shellyProxy({ 
        authKey: shellyCloud.authKey, 
        server: shellyCloud.server, 
        deviceId: device.id,
        action: "relay",
        turn: currentState ? "off" : "on",
        channel: 0
      });
      // Update local reading optimistically
      await setDoc(doc(db, "locations", locId, "shellyReadings", device.id), {
        state: !currentState, timestamp: new Date().toISOString(), online: true
      });
      setSelectedShellyDevice(d => d ? {...d, reading: {...(d.reading||{}), state: !currentState}} : null);
    } catch(e) { alert("Toggle failed: " + e.message); }
    setTogglingShelly(false);
  };

  const pollShellyDevices = async (creds, devices) => {
    if (!creds || !devices.length || pollingShelly) return;
    setPollingShelly(true);
    try {
      const shellyProxy = httpsCallable(functions, "shellyCloudProxy");
      for (const device of devices) {
        const result = await shellyProxy({ authKey: creds.authKey, server: creds.server, deviceId: device.deviceId });
        const data = result.data;
        if (data.isok && data.data) {
          const status = data.data.device_status;
          const online = data.data.online === true;
          const inputState = status?.["input:0"]?.state ?? null;
          const relayState = status?.["switch:0"]?.output ?? null;
          const power = status?.["switch:0"]?.apower ?? null;
          // state = input if input-only, relay if relay-only, relay if both
          const caps = getShellyCapabilities(device.type);
          const state = caps.relays > 0 ? relayState : inputState;
          await setDoc(doc(db, "locations", locId, "shellyReadings", device.id), {
            state, inputState, relayState, online, power, timestamp: new Date().toISOString()
          });
          console.log("Device", device.id, "online:", online, "state:", state);
          // Update cloud device online status in state
          setShellyCloudDevices(prev => prev.map(d => d.id === device.id ? {...d, online} : d));
        }
      }
    } catch(e) { console.log("Shelly poll error:", e.message); }
    setPollingShelly(false);
  };

  const loadShellyCloudDevices = async (creds) => {
    setLoadingCloudDevices(true);
    try {
      const shellyProxy = httpsCallable(functions, "shellyCloudProxy");
      const result = await shellyProxy({ authKey: creds.authKey, server: creds.server });
      const data = result.data;
      const devices = [];
      if (data.isok && data.data?.devices) {
        Object.values(data.data.devices).forEach(d => {
          devices.push({
            id: d.id, name: d.name || d.id,
            type: d.type || "unknown",
            online: d.cloud_online || false,
            gen: d.gen, ip: d.ip,
          });
        });
      }
      if (devices.length > 0) {
        setShellyCloudDevices(devices);
        // Save updated device list to Firestore
        setDoc(doc(db, "users", uid, "integrations", "shelly"), { devices }, { merge: true });
        setShellyOrder(prev => {
          // Keep existing order, add new devices at end
          const existing = prev.filter(id => devices.some(d => d.id === id));
          const newDevices = devices.filter(d => !prev.includes(d.id)).map(d => d.id);
          return [...existing, ...newDevices];
        });
        // Save latest readings to Firestore
        for (const device of devices) {
          if (!locId) continue;
          const state = device.inputs?.state ?? device.relays?.output ?? null;
          if (state !== null) {
            await setDoc(doc(db, "locations", locId, "shellyReadings", device.id), {
              state, timestamp: new Date().toISOString(), online: device.online
            });
          }
        }
      }
    } catch(e) { console.log("Shelly Cloud error:", e.message); }
    setLoadingCloudDevices(false);
  };

  const saveShellyConfig = async (assignments, hidden) => {
    await setDoc(doc(db, "users", uid, "prefs", "shellyConfig"), { assignments, hidden });
  };

  const assignDevice = async (deviceId, locationId) => {
    const newAssignments = { ...shellyAssignments, [deviceId]: locationId };
    setShellyAssignments(newAssignments);
    await saveShellyConfig(newAssignments, hiddenShellyDevices);
  };

  const hideDevice = async (deviceId) => {
    const newHidden = [...hiddenShellyDevices, deviceId];
    setHiddenShellyDevices(newHidden);
    await saveShellyConfig(shellyAssignments, newHidden);
  };

  const connectShellyCloud = async () => {
    if (!shellyAuthKey.trim()) return;
    setConnectingShelly(true);
    try {
      const shellyProxy = httpsCallable(functions, "shellyCloudProxy");
      const result = await shellyProxy({ authKey: shellyAuthKey.trim(), server: shellyServer });
      const data = result.data;
      if (data.verified || data.isok || (data.errors && data.errors.wrong_device_id)) {
        const creds = { authKey: shellyAuthKey.trim(), server: shellyServer, connectedAt: new Date().toISOString() };
        await setDoc(doc(db, "users", uid, "integrations", "shelly"), creds);
        setShellyCloud(creds);
      } else {
        alert("Connection failed. Check your Auth Key and server URL.");
      }
    } catch(e) { alert("Error: " + e.message + (e.details ? " - " + JSON.stringify(e.details) : "")); }
    setConnectingShelly(false);
  };

  useEffect(() => {
    if (!locId) return;
    const unsubShelly = onSnapshot(collection(db, "locations", locId, "shellyDevices"), snap => {
      const devs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setShellyDevices(devs);
      if (shellyCloud && devs.length > 0) pollShellyDevices(shellyCloud, devs);
    });
    return () => unsubShelly();
  }, [locId, shellyCloud]);

  // Load latest Shelly readings
  useEffect(() => {
    if (!locId) return;
    const unsub2 = onSnapshot(collection(db, "locations", locId, "shellyReadings"), snap => {
      const r = {};
      snap.docs.forEach(d => { r[d.id] = d.data(); });
      setShellyReadings(r);
    });
    return () => unsub2();
  }, [locId]);

  useEffect(() => {
    if (!locId) return;
    const unsub = onSnapshot(collection(db, "locations", locId, "sensorReadings"), snap => {
      const readings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChemSensors(readings);
    });
    return () => unsub();
  }, [locId]);

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [timeRange, setTimeRange] = useState("6h");
  const [latestReadings, setLatestReadings] = useState({});
  const rangeMs = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 };
  const historyCache = useRef({});

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
          // Re-authenticate with stored credentials to get fresh token
          const snap2 = await getDoc(doc(db, "users", user.uid, "integrations", "sensorpush"));
          const creds = snap2.data();
          // Always check if token needs refresh (older than 23 hours)
          const tokenAge = creds?.tokenUpdatedAt ? (Date.now() - new Date(creds.tokenUpdatedAt).getTime()) : Infinity;
          const needsRefresh = tokenAge > 2 * 60 * 60 * 1000;
          let token = accessToken;
          if ((creds?.email && creds?.password) && needsRefresh) {
            try {
              const reAuthRes = await fetch("https://api.sensorpush.com/api/v1/oauth/authorize", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: creds.email, password: creds.password })
              });
              const reAuthData = await reAuthRes.json();
              if (reAuthData.authorization) {
                const reTokenRes = await fetch("https://api.sensorpush.com/api/v1/oauth/accesstoken", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ authorization: reAuthData.authorization })
                });
                const reTokenData = await reTokenRes.json();
                if (reTokenData.accesstoken) {
                  token = reTokenData.accesstoken;
                  await updateDoc(doc(db, "users", user.uid, "integrations", "sensorpush"), {
                    accessToken: token, tokenUpdatedAt: new Date().toISOString()
                  });
                }
              }
            } catch(e) {}
          }
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
    const cacheKey = sensorId + "_" + r;
    const cached = historyCache.current[cacheKey];
    if (cached && Date.now() - cached.fetchedAt < 10 * 60 * 1000) {
      setHistory(p => ({ ...p, [sensorId]: cached.samples }));
      return;
    }
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
      const ordered = samples.slice().reverse();
      historyCache.current[cacheKey] = { samples: ordered, fetchedAt: Date.now() };
      setHistory(p => ({ ...p, [sensorId]: ordered }));
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
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f1f35" }}>Sensor Dashboard</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{locationName}</div>
        </div>
        {activeTab === "shelly" && <button onClick={() => setShowAddShelly(true)} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Device</button>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => { setActiveTab("sensorpush"); onTabChange?.("sensorpush"); }} style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: activeTab === "sensorpush" ? "#0f1f35" : "#f1f5f9", color: activeTab === "sensorpush" ? "#fff" : "#64748b" }}>SensorPush</button>
        <button onClick={() => { setActiveTab("chemlevel"); onTabChange?.("chemlevel"); }} style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: activeTab === "chemlevel" ? "#0f1f35" : "#f1f5f9", color: activeTab === "chemlevel" ? "#fff" : "#64748b" }}>ChemLevel</button>
        <button onClick={() => { setActiveTab("shelly"); onTabChange?.("shelly"); }} style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: activeTab === "shelly" ? "#0f1f35" : "#f1f5f9", color: activeTab === "shelly" ? "#fff" : "#64748b" }}>Shelly</button>
      </div>

      {activeTab === "chemlevel" && (
        <div>
          {chemDetailSensor && <SensorDetailModal sensor={chemDetailSensor} locId={locId} onClose={() => setChemDetailSensor(null)} />}

          {chemSensors.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#334155", marginBottom: 4 }}>No pressure sensors yet</div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>Sensors register automatically the first time your ESP32 posts data.</div>
              <div style={{ background: "#f4f6f8", borderRadius: 10, padding: 16, textAlign: "left", fontFamily: "monospace", fontSize: 12, color: "#334155" }}>
                <div style={{ fontWeight: 700, marginBottom: 6, fontFamily: "sans-serif", fontSize: 12 }}>Your location_id for this location:</div>
                <div style={{ background: "#e2e8f0", borderRadius: 6, padding: "8px 12px", userSelect: "all", letterSpacing: "0.02em" }}>{locId}</div>
                <div style={{ fontWeight: 700, margin: "12px 0 6px", fontFamily: "sans-serif", fontSize: 12 }}>ESP32 endpoint (pressureLevel):</div>
                POST https://us-central1-washlevel-c16d9.cloudfunctions.net/pressureLevel<br/>
                Header: x-washlevel-secret: pressurelevel2025<br/><br/>
                {"{"}"device_id": "carwash-pressure-01",<br/>
                &nbsp;"location_id": "{locId}",<br/>
                &nbsp;"sensor_label": "City Water Inlet",<br/>
                &nbsp;"city_water_psi": 62.4{"}"}
              </div>
            </div>
          )}

          {/* Pressure-type sensors: gauge tile grid */}
          {chemSensors.filter(s => s.type === "pressure" || s.unit === "PSI").length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
              {chemSensors.filter(s => s.type === "pressure" || s.unit === "PSI").map(sensor => {
                const val = sensor.value ?? null;
                const alert = val != null && ((sensor.minAlert != null && val < sensor.minAlert) || (sensor.maxAlert != null && val > sensor.maxAlert));
                const valColor = val == null ? "#94a3b8" : val < 60 ? "#22c55e" : val < 100 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={sensor.id} onClick={() => setChemDetailSensor(sensor)} style={{ background: alert ? "#fef2f2" : "#f8fafc", border: "1.5px solid " + (alert ? "#fca5a5" : "#e2e8f0"), borderRadius: 16, padding: "14px 12px 12px", cursor: "pointer", textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sensor.name || sensor.sensorId}</div>
                    <div style={{ margin: "0 auto", width: 110 }}><PressureGauge psi={val} size={110} /></div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: valColor, marginTop: 2, lineHeight: 1 }}>{val != null ? (typeof val === "number" ? val.toFixed(1) : val) : "--"}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>{sensor.unit || "PSI"}</div>
                    {sensor.timestamp && <div style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(sensor.timestamp).toLocaleTimeString()}</div>}
                    {alert && <div style={{ marginTop: 6, background: "#fee2e2", color: "#dc2626", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600 }}>⚠ Alert</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Non-pressure sensors: existing large card style */}
          {chemSensors.filter(s => s.type !== "pressure" && s.unit !== "PSI").map(sensor => {
            const isAlert = sensor.value < sensor.minAlert || sensor.value > sensor.maxAlert;
            const pct = Math.min(100, Math.max(0, ((sensor.value - 0) / ((sensor.maxAlert || 100) * 1.2)) * 100));
            return (
              <div key={sensor.id} onClick={() => setChemDetailSensor(sensor)} style={{ background: "#fff", border: isAlert ? "2px solid #dc2626" : "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 14, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>{sensor.name || sensor.sensorId}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>ID: {sensor.sensorId} · {sensor.type} · Last update: {sensor.timestamp ? new Date(sensor.timestamp).toLocaleTimeString() : "never"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: isAlert ? "#dc2626" : "#0f1f35" }}>{sensor.value ?? "--"}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{sensor.unit}</div>
                  </div>
                </div>
                <div style={{ background: "#f1f5f9", borderRadius: 999, height: 8, overflow: "hidden" }}>
                  <div style={{ width: pct + "%", height: "100%", background: isAlert ? "#dc2626" : "#22c55e", borderRadius: 999, transition: "width 0.5s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  <span>Min alert: {sensor.minAlert} {sensor.unit}</span>
                  <span>Max alert: {sensor.maxAlert} {sensor.unit}</span>
                </div>
                {isAlert && <div style={{ marginTop: 8, background: "#fee2e2", color: "#dc2626", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 600 }}>⚠️ Alert: Reading outside normal range</div>}
              </div>
            );
          })}
        </div>
      )}


      {activeTab === "shelly" && (
        <div>
          {!shellyCloud ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔌</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#334155", marginBottom: 4 }}>Shelly not connected</div>
              <div style={{ fontSize: 13 }}>Connect your Shelly Cloud account in Settings → Integrations</div>
            </div>
          ) : shellyCloudDevices.filter(d => !hiddenShellyDevices.includes(d.id) && (shellyAssignments[d.id] === locId || !shellyAssignments[d.id])).length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔌</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#334155", marginBottom: 4 }}>No devices assigned to this location</div>
              <div style={{ fontSize: 13 }}>Assign devices in Settings → Integrations → Shelly Cloud</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {(shellyOrder.length > 0
                ? shellyOrder.map(id => shellyCloudDevices.find(d => d.id === id)).filter(Boolean)
                : shellyCloudDevices
              ).filter(d => !hiddenShellyDevices.includes(d.id) && (shellyAssignments[d.id] === locId || !shellyAssignments[d.id])).map(device => {
                const reading = shellyReadings[device.id];
                const state = reading?.state;
                const caps = getShellyCapabilities(device.type);
                const isAlert = state === true && caps.inputs > 0;
                return (
                  <div key={device.id} onClick={() => setSelectedShellyDevice({...device, reading, caps})} style={{ background: "#fff", border: isAlert ? "2px solid #dc2626" : "1px solid #e5e7eb", borderRadius: 16, padding: 16, cursor: "pointer" }}>
                    <div style={{ fontSize: 12, color: device.online === true ? "#10b981" : device.online === false ? "#ef4444" : "#94a3b8", marginBottom: 4 }}>
                      {device.online === true ? "● Online" : device.online === false ? "● Offline" : "○ Checking..."} · {caps.label}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0f1f35", marginBottom: 8 }}>{device.name}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: state === true ? "#dc2626" : state === false ? "#10b981" : "#94a3b8" }}>
                      {state === true ? "ON" : state === false ? "OFF" : "--"}
                    </div>
                    {reading?.timestamp && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>Updated: {new Date(reading.timestamp).toLocaleTimeString()}</div>}
                    {isAlert && <div style={{ marginTop: 8, background: "#fee2e2", color: "#dc2626", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600 }}>⚠️ Alert</div>}
                  </div>
                );
              })}
            </div>
          )}
          {/* Shelly Device Detail Modal */}
          {selectedShellyDevice && (
            <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} onClick={() => setSelectedShellyDevice(null)} />
              <div style={{ position: "relative", background: "#fff", borderRadius: "20px 20px 0 0", padding: 24, maxHeight: "80vh", overflowY: "auto" }}>
                <div style={{ width: 36, height: 4, background: "#e2e8f0", borderRadius: 2, margin: "0 auto 20px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: "#0f1f35" }}>{selectedShellyDevice.name}</div>
                    <div style={{ fontSize: 12, color: selectedShellyDevice.online ? "#10b981" : "#94a3b8", marginTop: 2 }}>
                      {selectedShellyDevice.online ? "● Online" : "○ Offline"} · {selectedShellyDevice.caps?.label}
                    </div>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: selectedShellyDevice.reading?.state === true ? "#dc2626" : selectedShellyDevice.reading?.state === false ? "#10b981" : "#94a3b8" }}>
                    {selectedShellyDevice.reading?.state === true ? "ON" : selectedShellyDevice.reading?.state === false ? "OFF" : "--"}
                  </div>
                </div>
                <div style={{ background: "#f4f6f8", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Device Info</div>
                  <div style={{ fontSize: 13, color: "#334155" }}>Type: {selectedShellyDevice.type}</div>
                  <div style={{ fontSize: 13, color: "#334155" }}>ID: {selectedShellyDevice.id}</div>
                  {selectedShellyDevice.reading?.timestamp && (
                    <div style={{ fontSize: 13, color: "#334155" }}>Last update: {new Date(selectedShellyDevice.reading.timestamp).toLocaleString()}</div>
                  )}
                </div>
                {selectedShellyDevice.caps?.inputs > 0 && (
                  <div style={{ background: selectedShellyDevice.reading?.inputState ? "#fee2e2" : "#d1fae5", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 2 }}>Digital Input</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: selectedShellyDevice.reading?.inputState ? "#dc2626" : "#065f46" }}>
                          {selectedShellyDevice.reading?.inputState ? "⚠️ ACTIVE" : "✓ INACTIVE"}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                          {selectedShellyDevice.reading?.inputState ? "Signal detected on SW terminal" : "No signal on SW terminal"}
                        </div>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: selectedShellyDevice.reading?.inputState ? "#dc2626" : "#10b981" }}>
                        {selectedShellyDevice.reading?.inputState === true ? "ON" : selectedShellyDevice.reading?.inputState === false ? "OFF" : "--"}
                      </div>
                    </div>
                  </div>
                )}
                {selectedShellyDevice.caps?.relays > 0 && (
                  <div style={{ background: "#f4f6f8", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 12 }}>Relay Control</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: selectedShellyDevice.reading?.state ? "#10b981" : "#64748b" }}>
                          Relay is {selectedShellyDevice.reading?.state ? "ON" : "OFF"}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>Tap to toggle</div>
                      </div>
                      <button onClick={() => toggleShellyRelay(selectedShellyDevice, selectedShellyDevice.reading?.state)} disabled={togglingShelly}
                        style={{ background: selectedShellyDevice.reading?.state ? "#dc2626" : "#10b981", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: togglingShelly ? "not-allowed" : "pointer", opacity: togglingShelly ? 0.6 : 1 }}>
                        {togglingShelly ? "..." : selectedShellyDevice.reading?.state ? "Turn OFF" : "Turn ON"}
                      </button>
                    </div>
                  </div>
                )}
                <button onClick={() => setSelectedShellyDevice(null)}
                  style={{ width: "100%", background: "#0f1f35", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Manual devices still shown */}
          {shellyDevices.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#64748b", marginBottom: 10 }}>Manual Devices</div>
              {shellyDevices.map(device => {
                const reading = shellyReadings[device.id];
                const state = reading?.state;
                const isAlert = device.alertOn !== "never" && state === (device.alertOn === "on" ? true : false);
                return (
                  <div key={device.id} style={{ background: "#fff", border: isAlert ? "2px solid #dc2626" : "1px solid #e5e7eb", borderRadius: 16, padding: 16, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f1f35" }}>{device.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>ID: {device.deviceId} · Ch {device.channel} · {device.type}</div>
                        {reading?.timestamp && <div style={{ fontSize: 11, color: "#94a3b8" }}>Updated: {new Date(reading.timestamp).toLocaleTimeString()}</div>}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: state === true ? "#dc2626" : state === false ? "#10b981" : "#94a3b8" }}>
                        {state === true ? "ON" : state === false ? "OFF" : "--"}
                      </div>
                    </div>
                    {isAlert && <div style={{ marginTop: 8, background: "#fee2e2", color: "#dc2626", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 600 }}>⚠️ Alert: {device.name}</div>}
                    <button onClick={async () => { if (!window.confirm("Delete?")) return; await deleteDoc(doc(db, "locations", locId, "shellyDevices", device.id)); }}
                      style={{ marginTop: 8, background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Delete</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "sensorpush" && spSensors.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f1f35", marginBottom: 12 }}>SensorPush Sensors</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 13, marginBottom: 16 }}>
            {spSensors.map(sp => {
              const lr = latestReadings[sp.id];
              const temp = lr?.temperature ?? s.spTempF;
              const hum = lr?.humidity ?? s.spHumidity;
              return (
                <div key={sp.id} onClick={() => loadHistory(sp.id, timeRange)}
                  style={{ background: selectedSensor === sp.id ? "#eff6ff" : "#fff", border: selectedSensor === sp.id ? "2px solid #3b82f6" : "1px solid #e5e7eb", borderRadius: 16, padding: 16, cursor: "pointer" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0f1f35", marginBottom: 10 }}>{sp.name}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#3b82f6" }}>{temp != null ? temp + "F" : "--"}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>Temperature</div>
                    </div>
                    <div style={{ background: "#ecfeff", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#0891b2" }}>{hum != null ? hum + "%" : "--"}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>Humidity</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8, textAlign: "center" }}>Tap for history</div>
                </div>
              );
            })}
          </div>

          {selectedSensor && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f1f35" }}>{selSensor?.name}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["1h","6h","24h","7d"].map(r => (
                    <button key={r} onClick={() => { setTimeRange(r); loadHistory(selectedSensor, r); }}
                      style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 6,
                        background: timeRange === r ? "#0f1f35" : "#f1f5f9",
                        color: timeRange === r ? "#fff" : "#64748b", cursor: "pointer" }}>
                      {r === "7d" ? "1W" : r}
                    </button>
                  ))}
                </div>
              </div>
              {loadingHistory ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: 13 }}>Loading history...</div>
              ) : selHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: 13 }}>No data available</div>
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
                    const targetBars = timeRange === "7d" ? 42 : timeRange === "24h" ? 96 : 60;
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
                          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 9, color: "#94a3b8", width: 28, textAlign: "right", paddingBottom: 2, flexShrink: 0 }}>
                            <span>{maxV}{unit}</span><span>{midV}{unit}</span><span>{minV}{unit}</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
                              {filtered.map((pt, i) => {
                                const val = isTemp ? pt.temperature : pt.humidity;
                                const h = maxV === minV ? 50 : Math.round(((val - minV) / (maxV - minV)) * 70) + 10;
                                const time = timeRange === "7d"
                                  ? new Date(pt.observed).toLocaleDateString([], { month: "short", day: "numeric" }) + " " + new Date(pt.observed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                  : new Date(pt.observed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#94a3b8", marginTop: 3 }}>
                              <span>{timeRange === "7d"
                                ? new Date(selHistory[0]?.observed).toLocaleDateString([], { month: "short", day: "numeric" })
                                : new Date(selHistory[0]?.observed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              <span style={{ fontWeight: 600 }}>{timeRange === "7d" ? "Date" : "Time"}</span>
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


    </div>
  );
}

function TimeClock({ locId, locationName, allLocations }) {
  const { user } = useAuth();
  const [clockState, setClockState] = useState(null);
  const [locClocks, setLocClocks] = useState({});
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [teamHistory, setTeamHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("clock");
  const [payrollSettings, setPayrollSettings] = useState({ period: "biweekly", startDay: "monday" });
  const [editEntry, setEditEntry] = useState(null);
  const [editIn, setEditIn] = useState("");
  const [editOut, setEditOut] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [payrollPeriodStart, setPayrollPeriodStart] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [billingStart, setBillingStart] = useState("");
  const [billingEnd, setBillingEnd] = useState("");
  const [showBilling, setShowBilling] = useState(false);

  const isManager = user?.role === "manager" || user?.role === "owner" || !user?.isTeamMember;
  const today = new Date().toISOString().split("T")[0];
  const clockDocId = user?.uid + "_" + today;

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "timeclock", clockDocId), snap => {
      if (snap.exists()) { setClockState(snap.data()); setLocClocks(snap.data().locationTimes || {}); }
      else { setClockState(null); setLocClocks({}); }
      setLoading(false);
    });
    return unsub;
  }, [user?.uid, today]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(query(collection(db, "timeclock"), where("uid", "==", user.uid)), snap => {
      const mine = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date > a.date ? 1 : -1);
      setHistory(mine);
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user || !isManager) return;
    const managerUid = user.isTeamMember ? user.ownerId : user.uid;
    let unsubClock = () => {};
    getDocs(query(collection(db, "users"), where("ownerId", "==", managerUid))).then(membersSnap => {
      const allUids = [managerUid, ...membersSnap.docs.map(d => d.id)];
      const uids = [...new Set([...allUids, user.uid])];
      unsubClock = onSnapshot(
        query(collection(db, "timeclock"), where("uid", "in", uids.slice(0, 30))),
        snap => {
setTeamHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date > a.date ? 1 : -1));
        }
      );
    });
    return () => unsubClock();
  }, [user?.uid, isManager]);

  useEffect(() => {
    if (!user || !isManager) return;
    const loadPayroll = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && snap.data().payrollSettings) setPayrollSettings(snap.data().payrollSettings);
    };
    loadPayroll();
  }, [user?.uid]);

  const now = () => new Date().toISOString();
  const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
  const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const elapsed = (start, end) => {
    if (!start) return "0h 0m";
    const ms = (end ? new Date(end) : new Date()) - new Date(start);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h + "h " + m + "m";
  };
  const elapsedHrs = (start, end) => {
    if (!start || !end) return 0;
    return (new Date(end) - new Date(start)) / 3600000;
  };
  const entryMs = (e) => {
    if (e.sessions && e.sessions.length > 0) {
      return e.sessions.reduce((sum, s) => {
        if (!s.in || !s.out) return sum;
        return sum + (new Date(s.out) - new Date(s.in));
      }, 0);
    }
    if (!e.mainClockIn || !e.mainClockOut) return 0;
    return new Date(e.mainClockOut) - new Date(e.mainClockIn);
  };
  const totalHours = (entries) => {
    const ms = entries.reduce((sum, e) => sum + entryMs(e), 0);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h + "h " + m + "m";
  };
  const totalHrsNum = (entries) => entries.reduce((sum, e) => sum + entryMs(e) / 3600000, 0);

  const sessions = clockState?.sessions || (clockState?.mainClockIn ? [{ in: clockState.mainClockIn, out: clockState.mainClockOut || null }] : []);
  const lastSession = sessions[sessions.length - 1];
  const isClockedIn = lastSession && !lastSession.out;
  const isClockedOut = sessions.length > 0 && !isClockedIn;

  // Total hours across all sessions today
  const totalSessionMs = sessions.reduce((sum, s) => {
    if (!s.in) return sum;
    const out = s.out ? new Date(s.out) : new Date();
    return sum + (out - new Date(s.in));
  }, 0);
  const totalSessionHrs = (totalSessionMs / 3600000).toFixed(2);

  const myOwnerId = user?.isTeamMember ? user?.ownerId : user?.uid;

  const handleMainClock = async () => {
    const nowStr = now();
    if (!clockState || sessions.length === 0) {
      // First clock in of the day
      await setDoc(doc(db, "timeclock", clockDocId), {
        uid: user.uid, ownerId: myOwnerId, name: user.name || user.email, date: today,
        mainClockIn: nowStr, mainClockOut: null,
        sessions: [{ in: nowStr, out: null }],
        locationTimes: locClocks
      });
    } else if (isClockedIn) {
      // Clock out of current session
      const updatedSessions = sessions.map((s, i) => i === sessions.length - 1 ? { ...s, out: nowStr } : s);
      await updateDoc(doc(db, "timeclock", clockDocId), {
        mainClockOut: nowStr,
        sessions: updatedSessions
      });
    } else {
      // Start a new session
      const updatedSessions = [...sessions, { in: nowStr, out: null }];
      await updateDoc(doc(db, "timeclock", clockDocId), {
        mainClockIn: nowStr, mainClockOut: null,
        sessions: updatedSessions
      });
    }
  };

  const handleLocClock = async (lId) => {
    const current = locClocks[lId] || {};
    const updated = { ...locClocks };
    if (!current.in || current.out) {
      // Clocking IN to this location — auto clock out any other active location
      Object.keys(updated).forEach(otherId => {
        if (otherId !== lId && updated[otherId]?.in && !updated[otherId]?.out) {
          updated[otherId] = { ...updated[otherId], out: now() };
        }
      });
      updated[lId] = { in: now(), out: null };
    } else {
      // Clocking OUT of this location
      updated[lId] = { ...current, out: now() };
    }
    setLocClocks(updated);
    if (clockState) await updateDoc(doc(db, "timeclock", clockDocId), { locationTimes: updated });
    else await setDoc(doc(db, "timeclock", clockDocId), { uid: user.uid, ownerId: myOwnerId, name: user.name || user.email, date: today, mainClockIn: null, mainClockOut: null, locationTimes: updated });
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    setSavingEdit(true);
    const inIso = new Date(editEntry.date + "T" + editIn).toISOString();
    const outIso = editOut ? new Date(editEntry.date + "T" + editOut).toISOString() : null;
    await updateDoc(doc(db, "timeclock", editEntry.id), { mainClockIn: inIso, mainClockOut: outIso, editedBy: user.uid, editedAt: now() });
    setSavingEdit(false);
    setEditEntry(null);
  };

  const savePayrollSettings = async (settings) => {
    setPayrollSettings(settings);
    await updateDoc(doc(db, "users", user.uid), { payrollSettings: settings });
  };

  const historyByMonth = history.reduce((acc, e) => {
    const month = e.date?.slice(0, 7);
    if (!month) return acc;
    if (!acc[month]) acc[month] = [];
    acc[month].push(e);
    return acc;
  }, {});

  const getPayrollEntries = (startDate) => {
    if (!startDate) return [];
    const start = new Date(startDate + "T00:00:00");
    let end;
    if (payrollSettings.period === "weekly") end = new Date(start.getTime() + 7 * 86400000);
    else if (payrollSettings.period === "biweekly") end = new Date(start.getTime() + 14 * 86400000);
    else if (payrollSettings.period === "semimonthly") {
      const d = start.getDate();
      end = d <= 15 ? new Date(start.getFullYear(), start.getMonth(), 16) : new Date(start.getFullYear(), start.getMonth() + 1, 1);
    } else {
      end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    }
    return teamHistory.filter(e => {
      const d = new Date(e.date + "T12:00:00");
      return d >= start && d < end;
    });
  };

  const payrollEntries = getPayrollEntries(payrollPeriodStart);
  const payrollByEmployee = payrollEntries.reduce((acc, e) => {
    const key = e.uid;
    if (!acc[key]) acc[key] = { name: e.name || e.uid?.slice(0,8), entries: [] };
    acc[key].entries.push(e);
    return acc;
  }, {});

  const tabStyle = (t) => ({
    flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
    background: activeTab === t ? "#fff" : "#f8fafc",
    color: activeTab === t ? "#0f1f35" : "#94a3b8",
    borderBottom: activeTab === t ? "2px solid #1a3352" : "2px solid transparent"
  });

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f1f35" }}>Time Clock</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 20, background: "#f8fafc", borderRadius: "10px 10px 0 0", overflow: "hidden" }}>
        <button style={tabStyle("clock")} onClick={() => setActiveTab("clock")}>My Clock</button>
        <button style={tabStyle("history")} onClick={() => setActiveTab("history")}>My History</button>
        {(user?.role === "owner" || (isManager && user?.canViewTeam)) && <button style={tabStyle("team")} onClick={() => setActiveTab("team")}>Team</button>}
        {(user?.role === "owner" || (isManager && user?.payrollAccess)) && <button style={tabStyle("payroll")} onClick={() => setActiveTab("payroll")}>Payroll</button>}
      </div>

      {activeTab === "clock" && (
        <div>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, marginBottom: 18, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Today's Shift</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: isClockedIn ? "#059669" : "#0f1f35", marginBottom: 4 }}>
              {isClockedIn ? "Clocked In" : "Clocked Out"}
            </div>
            {isClockedIn && lastSession?.in && (
              <div style={{ fontSize: 22, fontWeight: 700, color: "#0ea5e9", marginBottom: 8 }}>{elapsed(lastSession.in, null)} this session</div>
            )}
            {sessions.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {sessions.map((s, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>
                    {fmt(s.in)} — {s.out ? fmt(s.out) : <span style={{ color: "#059669", fontWeight: 600 }}>Now</span>}
                    {s.in && <span style={{ color: "#94a3b8" }}> ({elapsed(s.in, s.out)})</span>}
                  </div>
                ))}
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1f35", marginTop: 6 }}>Total: {totalSessionHrs} hrs</div>
              </div>
            )}
            <button onClick={handleMainClock} style={{ background: isClockedIn ? "#ef4444" : "#059669", color: "#fff", border: "none", borderRadius: 10, padding: "14px 40px", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
              {isClockedIn ? "Clock Out" : "Clock In"}
            </button>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 6 }}>Location Billing</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Track time at each location separately.</div>
            {allLocations.map(loc => {
              const lc = locClocks[loc.id] || {};
              const active = lc.in && !lc.out;
              const done = lc.in && lc.out;
              return (
                <div key={loc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 8, background: active ? "#f0fdf4" : "#fafafa" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: active ? "#10b981" : done ? "#94a3b8" : "#e2e8f0", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#0f1f35" }}>{loc.name}</div>
                    {lc.in && <div style={{ fontSize: 11, color: "#64748b" }}>In: {fmt(lc.in)}{lc.out ? " | Out: " + fmt(lc.out) + " | " + elapsed(lc.in, lc.out) : " | " + elapsed(lc.in, null) + " elapsed"}</div>}
                  </div>
                  <button onClick={() => handleLocClock(loc.id)} style={{ background: active ? "#fee2e2" : "#f0fdf4", color: active ? "#dc2626" : "#059669", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {active ? "Stop" : done ? "Restart" : "Start"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 4 }}>My Hours</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>All time: <b>{totalHours(history)}</b></div>
          {Object.keys(historyByMonth).length === 0 && <div style={{ color: "#94a3b8", fontSize: 13 }}>No history yet.</div>}
          {Object.entries(historyByMonth).map(([month, entries]) => {
            const monthLabel = new Date(month + "-01T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
            return (
              <div key={month} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1f35" }}>{monthLabel}</div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{totalHours(entries)}</div>
                </div>
                {entries.map(e => (
                  <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35", marginBottom: 2 }}>{fmtDate(e.date)}</div>
                        {e.sessions && e.sessions.length > 0 ? (
                          e.sessions.map((s, i) => (
                            <div key={i} style={{ fontSize: 11, color: "#94a3b8" }}>
                              Session {i + 1}: {fmt(s.in)} — {s.out ? fmt(s.out) : <span style={{ color: "#059669" }}>Now</span>}
                              {s.in && <span> ({elapsed(s.in, s.out)})</span>}
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{fmt(e.mainClockIn)} — {e.mainClockOut ? fmt(e.mainClockOut) : "In progress"}</div>
                        )}
                        {e.editedBy && (
                          <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>Edited by manager</div>
                        )}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f1f35" }}>
                        {entryMs(e) > 0 ? (entryMs(e) / 3600000).toFixed(2) + " hrs" : elapsed(e.mainClockIn, e.mainClockOut)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "team" && (user?.role === "owner" || (isManager && user?.canViewTeam)) && (
        <div>

          {editEntry && (
            <div style={{ background: "#fff", border: "2px solid #1a3352", borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 12 }}>Edit Entry — {editEntry.name} — {fmtDate(editEntry.date)}</div>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>Clock In</label>
                  <input type="time" value={editIn} onChange={e => setEditIn(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>Clock Out</label>
                  <input type="time" value={editOut} onChange={e => setEditOut(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSaveEdit} disabled={savingEdit} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{savingEdit ? "Saving..." : "Save Changes"}</button>
                <button onClick={() => setEditEntry(null)} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 16 }}>Team Hours</div>
            {(() => {
              const byDate = teamHistory.reduce((acc, e) => { if (!acc[e.date]) acc[e.date] = []; acc[e.date].push(e); return acc; }, {});
              return Object.entries(byDate).map(([date, entries]) => (
                <div key={date} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>{fmtDate(date)}</div>
                  {entries.map(e => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#f8fafc", borderRadius: 8, marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{e.name || e.uid?.slice(0,8)}</div>
                        {(() => {
                          const ss = (e.sessions && e.sessions.length > 0)
                            ? e.sessions
                            : (e.mainClockIn ? [{ in: e.mainClockIn, out: e.mainClockOut }] : []);
                          const dayMs = ss.reduce((sum, s) => s.in && s.out ? sum + (new Date(s.out) - new Date(s.in)) : sum, 0);
                          const dayHrs = Math.floor(dayMs / 3600000);
                          const dayMin = Math.floor((dayMs % 3600000) / 60000);
                          return (
                            <div>
                              {ss.map((s, i) => (
                                <div key={i} style={{ fontSize: 11, color: "#94a3b8" }}>
                                  {ss.length > 1 && <span style={{ color: "#cbd5e1" }}>S{i+1}: </span>}
                                  {fmt(s.in)} — {s.out ? fmt(s.out) : <span style={{ color: "#10b981" }}>Active</span>}
                                  {s.in && s.out && <span style={{ color: "#64748b", marginLeft: 4 }}>({elapsed(s.in, s.out)})</span>}
                                </div>
                              ))}
                              {ss.length > 1 && dayMs > 0 && (
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#0f1f35", marginTop: 2 }}>
                                  Total: {dayHrs}h {dayMin}m
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {e.editedBy && (
                          <div style={{ fontSize: 10, color: "#f59e0b" }}>
                            Edited {e.editedAt ? new Date(e.editedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + new Date(e.editedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: e.mainClockOut ? "#0f1f35" : "#059669" }}>
                          {e.mainClockOut ? elapsed(e.mainClockIn, e.mainClockOut) : elapsed(e.mainClockIn, null)}
                        </div>
                        <button onClick={() => {
                          setEditEntry(e);
                          setEditIn(e.mainClockIn ? new Date(e.mainClockIn).toTimeString().slice(0,5) : "");
                          setEditOut(e.mainClockOut ? new Date(e.mainClockOut).toTimeString().slice(0,5) : "");
                        }} style={{ background: "#f1f5f9", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#334155" }}>Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {activeTab === "payroll" && (user?.role === "owner" || (isManager && user?.payrollAccess)) && (
        <div>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 16 }}>Payroll Settings</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Pay Period</label>
              <select value={payrollSettings.period} onChange={e => savePayrollSettings({ ...payrollSettings, period: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", background: "#fff" }}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="semimonthly">Semi-Monthly (1st and 15th)</option>
                <option value="monthly">Monthly</option>
<option value="quarterly">Quarterly</option>
<option value="annually">Annually</option>
              </select>
            </div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 16 }}>Payroll Report</div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>Period Start Date</label>
                <input type="date" value={payrollPeriodStart} onChange={e => { setPayrollPeriodStart(e.target.value); setShowReport(false); }}
                  style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <button onClick={() => setShowReport(true)} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                Generate Report
              </button>
              <button onClick={() => {
                const text = Object.entries(payrollByEmployee).map(([uid, emp]) => {
                  const hrs = totalHrsNum(emp.entries);
                  const lines = emp.entries.map(e => {
                    const ss = (e.sessions && e.sessions.length > 0) ? e.sessions : (e.mainClockIn ? [{ in: e.mainClockIn, out: e.mainClockOut }] : []);
                    const sessionLines = ss.map((s, i) => "  Session " + (i+1) + ": " + fmt(s.in) + " — " + (s.out ? fmt(s.out) : "active") + " (" + (s.in && s.out ? elapsed(s.in, s.out) : "ongoing") + ")").join("\n");
                    const dayMs = ss.reduce((sum, s) => s.in && s.out ? sum + (new Date(s.out) - new Date(s.in)) : sum, 0);
                    const dayHrs = Math.floor(dayMs / 3600000);
                    const dayMin = Math.floor((dayMs % 3600000) / 60000);
                    return fmtDate(e.date) + " — Total: " + dayHrs + "h " + dayMin + "m\n" + sessionLines;
                  }).join("\n");
                  return emp.name + "\nTotal: " + hrs.toFixed(2) + " hrs\n" + lines;
                }).join("\n\n");
                const blob = new Blob([text], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "payroll_" + payrollPeriodStart + ".txt"; a.click();
              }} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                Download
              </button>
            </div>
            {showReport && payrollPeriodStart && Object.keys(payrollByEmployee).length === 0 && (
              <div style={{ color: "#94a3b8", fontSize: 13 }}>No entries found for this period.</div>
            )}
            {showReport && Object.entries(payrollByEmployee).map(([uid, emp]) => {
              const hrs = totalHrsNum(emp.entries);
              const isOT = hrs > 40;
              return (
                <div key={uid} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>{emp.name}</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: isOT ? "#f59e0b" : "#0f1f35" }}>{hrs.toFixed(2)} hrs</div>
                      {isOT && <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>Overtime: {(hrs - 40).toFixed(2)} hrs over 40</div>}
                    </div>
                  </div>
                  {emp.entries.map(e => {
                    const daySessions = (e.sessions && e.sessions.length > 0)
                      ? e.sessions
                      : (e.mainClockIn ? [{ in: e.mainClockIn, out: e.mainClockOut }] : []);
                    const dayMs = daySessions.reduce((sum, s) => s.in && s.out ? sum + (new Date(s.out) - new Date(s.in)) : sum, 0);
                    const dayHrs = Math.floor(dayMs / 3600000);
                    const dayMin = Math.floor((dayMs % 3600000) / 60000);
                    return (
                    <div key={e.id} style={{ borderBottom: "1px solid #f3f4f6", padding: "8px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: daySessions.length > 1 ? 4 : 0 }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>{fmtDate(e.date)}</span>
                        <span style={{ fontWeight: 700, color: "#0f1f35" }}>{dayMs > 0 ? dayHrs + "h " + dayMin + "m" : "—"}</span>
                      </div>
                      {daySessions.map((s, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", paddingLeft: 10, marginBottom: 2 }}>
                          <span>Session {i + 1}</span>
                          <span>{fmt(s.in)} — {s.out ? fmt(s.out) : <span style={{ color: "#10b981" }}>Active</span>}</span>
                          <span style={{ color: "#64748b" }}>{s.in && s.out ? elapsed(s.in, s.out) : s.in ? "ongoing" : "—"}</span>
                        </div>
                      ))}
                    </div>
                  );
                  })}
                </div>
              );
            })}
          </div>

          {/* Location Billing Report */}
         <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginTop: 16 }}>
           <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 16 }}>Location Billing Report</div>
           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
             <div>
               <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>Start Date</label>
               <input type="date" value={billingStart} onChange={e => { setBillingStart(e.target.value); setShowBilling(false); }}
                 style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
             </div>
             <div>
               <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>End Date</label>
               <input type="date" value={billingEnd} onChange={e => { setBillingEnd(e.target.value); setShowBilling(false); }}
                 style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
             </div>
           </div>
           <button onClick={() => setShowBilling(true)} disabled={!billingStart || !billingEnd}
             style={{ background: billingStart && billingEnd ? "#6366f1" : "#e2e8f0", color: billingStart && billingEnd ? "#fff" : "#94a3b8", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: billingStart && billingEnd ? "pointer" : "not-allowed", marginBottom: 16 }}>
             Generate Location Report
           </button>
           {showBilling && billingStart && billingEnd && (() => {
             const allEntries = [...history, ...teamHistory];
             const billingEntries = allEntries.filter(e => e.date >= billingStart && e.date <= billingEnd);
             const locBilling = {};
             billingEntries.forEach(e => {
               const locTimes = e.locationTimes || {};
               Object.entries(locTimes).forEach(([lId, lt]) => {
                 if (!lt.in || !lt.out) return;
                 const hrs = (new Date(lt.out) - new Date(lt.in)) / 3600000;
                 if (!locBilling[lId]) locBilling[lId] = { employees: {} };
                 if (!locBilling[lId].employees[e.uid]) locBilling[lId].employees[e.uid] = { name: e.name || e.uid, hrs: 0, entries: [] };
                 locBilling[lId].employees[e.uid].hrs += hrs;
                 locBilling[lId].employees[e.uid].entries.push({ date: e.date, in: lt.in, out: lt.out, hrs });
               });
             });
             if (Object.keys(locBilling).length === 0) return <div style={{ color: "#94a3b8", fontSize: 13 }}>No location billing data for this period.</div>;
             return Object.entries(locBilling).map(([lId, locData]) => {
               const loc = allLocations.find(l => l.id === lId);
               const totalLocHrs = Object.values(locData.employees).reduce((sum, emp) => sum + emp.hrs, 0);
               return (
                 <div key={lId} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                     <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>{loc?.name || lId}</div>
                     <div style={{ fontSize: 16, fontWeight: 800, color: "#6366f1" }}>{totalLocHrs.toFixed(2)} hrs</div>
                   </div>
                   {Object.entries(locData.employees).map(([uid, emp]) => (
                     <div key={uid} style={{ marginBottom: 10 }}>
                       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                         <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{emp.name}</div>
                         <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1f35" }}>{emp.hrs.toFixed(2)} hrs</div>
                       </div>
                       {emp.entries.map((entry, i) => (
                         <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 4px 12px", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
                           <span style={{ color: "#64748b" }}>{fmtDate(entry.date)}</span>
                           <span style={{ color: "#94a3b8" }}>{fmt(entry.in)} — {fmt(entry.out)}</span>
                           <span style={{ fontWeight: 600, color: "#0f1f35" }}>{entry.hrs.toFixed(2)} hrs</span>
                         </div>
                       ))}
                     </div>
                   ))}
                 </div>
               );
             });
           })()}
         </div>
        </div>
      )}
    </div>
  );
}

// ADD TASK MODAL
function TaskHistoryDetailModal({ entry, onClose }) {
  if (!entry) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#0f1f35" }}>{entry.taskTitle}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>x</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {entry.completedAt && (
            <div style={{ background: "#f4f6f8", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Completed</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{new Date(entry.completedAt).toLocaleDateString()}</div>
            </div>
          )}
          {entry.completedBy && (
            <div style={{ background: "#f4f6f8", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Completed By</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{entry.completedBy}</div>
            </div>
          )}
          {entry.duration && (
            <div style={{ background: "#f4f6f8", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Duration</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{entry.duration} min</div>
            </div>
          )}
          {entry.category && (
            <div style={{ background: "#f4f6f8", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Category</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35", textTransform: "capitalize" }}>{entry.category}</div>
            </div>
          )}
        </div>
        {entry.note && (
          <div style={{ background: "#f4f6f8", borderRadius: 8, padding: "12px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>Notes</div>
            <div style={{ fontSize: 13, color: "#334155" }}>{entry.note}</div>
          </div>
        )}
        {entry.partsUsed && entry.partsUsed.length > 0 && (
          <div style={{ background: "#f4f6f8", borderRadius: 8, padding: "12px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>Parts Used</div>
            {entry.partsUsed.map((p, i) => (
              <div key={i} style={{ fontSize: 13, color: "#334155", marginBottom: 4 }}>{p.name} x{p.qty} {p.unit || ""}</div>
            ))}
          </div>
        )}
        {entry.mediaUrls && entry.mediaUrls.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>Photos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
              {entry.mediaUrls.map((url, i) => (
                <img key={i} src={url} alt="task photo" onClick={() => window.open(url)}
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, cursor: "pointer" }} />
              ))}
            </div>
          </div>
        )}
        {/* Inspection Results */}
        {entry.items && entry.items.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 10 }}>Inspection Results</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ background: "#dcfce7", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "#15803d" }}>
                {entry.items.filter(i => i.result === "good").length} Passed
              </div>
              {entry.items.filter(i => i.result === "monitor").length > 0 && (
                <div style={{ background: "#fef9c3", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "#854d0e" }}>
                  {entry.items.filter(i => i.result === "monitor").length} Monitor
                </div>
              )}
              {entry.items.filter(i => i.result === "fail").length > 0 && (
                <div style={{ background: "#fee2e2", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "#dc2626" }}>
                  {entry.items.filter(i => i.result === "fail").length} Failed
                </div>
              )}
            </div>
            {entry.items.map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                  background: item.result === "good" ? "#dcfce7" : item.result === "fail" ? "#fee2e2" : "#fef9c3",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                  color: item.result === "good" ? "#15803d" : item.result === "fail" ? "#dc2626" : "#854d0e" }}>
                  {item.result === "good" ? "✓" : item.result === "fail" ? "✕" : "!"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{item.label}</div>
                  {item.note && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{item.note}</div>}
                  {item.photoUrl && <img src={item.photoUrl} alt="inspection" onClick={() => window.open(item.photoUrl)}
                    style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, marginTop: 6, cursor: "pointer" }} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {!entry.note && !entry.items?.length && (!entry.mediaUrls || entry.mediaUrls.length === 0) && (!entry.partsUsed || entry.partsUsed.length === 0) && (
          <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>No notes or photos were added when this task was completed.</div>
        )}
      </div>
    </div>
  );
}

function TaskHistoryModal({ tasks, onClose, locId }) {
  const [sortBy, setSortBy] = useState("date");
  const [filterUser, setFilterUser] = useState("all");
  const [filterEquipment, setFilterEquipment] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    if (!locId) return;
    getDocs(collection(db, "locations", locId, "equipment")).then(snap => {
      setEquipmentList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [locId]);

  const doneTasks = tasks.filter(t => t.status === "done" || t.archived);
  const users = ["all", ...new Set(doneTasks.map(t => t.completedBy).filter(Boolean))];

  const filtered = doneTasks
    .filter(t => filterUser === "all" || t.completedBy === filterUser)
    .filter(t => filterEquipment === "all" || t.equipmentId === filterEquipment)
    .filter(t => filterCategory === "all" || t.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === "date") return (b.completedAt || b.updatedAt || "").localeCompare(a.completedAt || a.updatedAt || "");
      if (sortBy === "user") return (a.completedBy || "").localeCompare(b.completedBy || "");
      if (sortBy === "category") return (a.category || "").localeCompare(b.category || "");
      if (sortBy === "equipment") return (a.equipmentId || "").localeCompare(b.equipmentId || "");
      return 0;
    });

  const CAT_COLORS = { inspection: "#15803d", equipment: "#1d4ed8", cleaning: "#065f46", supplies: "#b45309", chemicals: "#5b21b6", maintenance: "#ef4444" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      {selectedEntry && <TaskHistoryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 500, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 20px 12px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#0f1f35" }}>Task History</div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, color: "#94a3b8", cursor: "pointer" }}>x</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", overflow: "visible" }}>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
             style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, color: "#334155", background: "#f8fafc" }}>
             <option value="all">All Types</option>
             <option value="cleaning">Cleaning</option>
             <option value="maintenance">Maintenance</option>
             <option value="chemicals">Chemicals</option>
             <option value="inspection">Inspection</option>
             <option value="equipment">Equipment</option>
           </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, color: "#334155", background: "#f8fafc" }}>
              <option value="date">Sort: Date</option>
              <option value="user">Sort: User</option>
              <option value="category">Sort: Category</option>
              <option value="equipment">Sort: Equipment</option>
            </select>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, color: "#334155", background: "#f8fafc" }}>
              {users.map(u => <option key={u} value={u}>{u === "all" ? "All Users" : u}</option>)}
            </select>
            <select value={filterEquipment} onChange={e => setFilterEquipment(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, color: "#334155", background: "#f8fafc" }}>
              <option value="all">All Equipment</option>
              {equipmentList.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: "12px 20px 24px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 14, padding: 40 }}>No completed tasks yet</div>
          ) : filtered.map(t => (
            <div key={t.id} onClick={async () => {
              // Load task history for inspection results
              let items = t.checklist || [];
              let note = t.note || "";
              let mediaUrls = t.mediaUrls || [];
              let partsUsed = [];
              let duration = t.duration || null;
              if (locId) {
                try {
                  const histSnap = await getDocs(collection(db, "locations", locId, "tasks", t.id, "history"));
                  const hist = histSnap.docs.map(d => d.data()).sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0];
                  if (hist) { items = hist.items || items; note = hist.note || note; mediaUrls = hist.photos || mediaUrls; partsUsed = hist.partsUsed || []; duration = hist.duration || duration; }
                } catch(e) {}
              }
              setSelectedEntry({ taskTitle: t.title, completedAt: t.completedAt, completedBy: t.completedBy, category: t.category, note, mediaUrls, partsUsed, duration, items });
            }} style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: t.archived ? "#94a3b8" : "#0f1f35", textDecoration: t.archived ? "line-through" : "none" }}>{t.title}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: CAT_COLORS[t.category] || "#64748b", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>{t.category}</span>
                    {t.completedBy && <span style={{ fontSize: 11, color: "#64748b" }}>by {t.completedBy}</span>}
                    {t.completedAt && <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(t.completedAt).toLocaleDateString()}</span>}
                    {t.archived && <span style={{ fontSize: 10, fontWeight: 600, color: "#059669", background: "#d1fae5", padding: "2px 6px", borderRadius: 4 }}>Approved</span>}
                    {t.equipmentId && equipmentList.find(e => e.id === t.equipmentId) && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#1d4ed8", background: "#dbeafe", padding: "2px 6px", borderRadius: 4 }}>{equipmentList.find(e => e.id === t.equipmentId).name}</span>
                    )}
                    {t.category === "inspection" && <span style={{ fontSize: 10, color: "#94a3b8" }}>Tap to view results</span>}
                  </div>
                </div>
                <span style={{ fontSize: 16, color: "#94a3b8", flexShrink: 0 }}>›</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InspectionModal({ task, locId, user, onClose, onComplete }) {
  const [items, setItems] = useState(
    (task.checklist || []).map(i => ({ ...i, result: null, note: "", photoUrl: null }))
  );
  const [saving, setSaving] = useState(false);
  const photoMapRef = useRef({});
  const noteMapRef = useRef({});

  const setResult = (id, result) => setItems(p => p.map(i => i.id === id ? { ...i, result } : i));
  const setNote = (id, note) => {
    noteMapRef.current[id] = note;
    setItems(p => p.map(i => i.id === id ? { ...i, note } : i));
  };
  const setPhoto = (id, photoUrl) => {
    photoMapRef.current[id] = photoUrl;
    setItems(p => p.map(i => i.id === id ? { ...i, photoUrl } : i));
  };

  const allRated = items.length > 0 && items.every(i => i.result !== null);
  const failCount = items.filter(i => i.result === "fail").length;

  const handlePhoto = async (id, file) => {
    if (!file) return;
    // Compress image before upload
    const canvas = document.createElement("canvas");
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      const maxW = 1200;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        try {
          const path = "locations/" + locId + "/inspections/" + task.id + "/" + id + "_" + Date.now() + ".jpg";
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
          const downloadUrl = await getDownloadURL(storageRef);
          setPhoto(id, downloadUrl);
        } catch(e) {
          // Fallback to base64 if storage fails
          const reader = new FileReader();
          reader.onload = ev => setPhoto(id, ev.target.result);
          reader.readAsDataURL(file);
        }
      }, "image/jpeg", 0.8);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleSubmit = async () => {
    if (!allRated || saving) return;

    // Require note AND photo for all failed items
    const failedItems = items.filter(i => i.result === "fail");
    const missingNote = failedItems.filter(i => !i.note?.trim());
    const missingPhoto = failedItems.filter(i => !i.photoUrl && !photoMapRef.current[i.id]);

    if (missingNote.length > 0) {
      alert("Please add a note for all failed items: " + missingNote.map(i => i.label).join(", "));
      return;
    }
    if (missingPhoto.length > 0) {
      alert("Please attach a photo for all failed items: " + missingPhoto.map(i => i.label).join(", "));
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();

    await updateDoc(doc(db, "locations", locId, "tasks", task.id), {
      status: "done", checklist: items,
      completedAt: now, completedBy: user?.name || user?.email || "Unknown",
      updatedAt: now
    });

    // Always write to task history subcollection
    const taskHistId = "insp" + Date.now();
    await setDoc(doc(db, "locations", locId, "tasks", task.id, "history", taskHistId), {
      id: taskHistId, type: "inspection", date: now.split("T")[0],
      completedAt: now,
      completedBy: user?.name || user?.email || "Unknown",
      taskTitle: task.title, items,
      failCount, monitorCount: items.filter(i => i.result === "monitor").length,
      createdAt: now
    });

    if (task.equipmentId) {
      const histId = "insp" + Date.now() + "eq";
      await setDoc(doc(db, "locations", locId, "equipment", task.equipmentId, "history", histId), {
        id: histId, type: "inspection", date: now.split("T")[0],
        completedBy: user?.name || user?.email || "Unknown",
        taskTitle: task.title, items,
        failCount, monitorCount: items.filter(i => i.result === "monitor").length,
        createdAt: now
      });
    }

    for (const item of items.filter(i => i.result === "fail")) {
      const newId = "t" + Date.now() + Math.random().toString(36).slice(2, 5);
      const photoUrl = photoMapRef.current[item.id] || item.photoUrl || null;
      const noteText = noteMapRef.current[item.id] || item.note || "";
      await setDoc(doc(db, "locations", locId, "tasks", newId), {
        id: newId, title: "Fix: " + item.label,
        category: "maintenance", priority: "high", status: "pending",
        shift: "everyone", due: now.split("T")[0],
        assignedRole: "manager", equipmentId: task.equipmentId || null,
        note: noteText,
        mediaUrls: photoUrl ? [photoUrl] : [],
        attachments: photoUrl ? [{ name: "Inspection photo", url: photoUrl, type: "image/jpeg", uploadedAt: now }] : [],
        inspectionSource: task.title,
        createdAt: now, updatedAt: now
      });
    }

    setSaving(false);
    onComplete();
    onClose();
  };

  const RBtn = ({ id, val, label, color, bg }) => {
    const active = items.find(i => i.id === id)?.result === val;
    return (
      <button type="button" onClick={() => setResult(id, val)} style={{
        flex: 1, padding: "8px 4px", borderRadius: 8, border: "2px solid",
        borderColor: active ? color : "#e2e8f0", background: active ? bg : "#fff",
        color: active ? color : "#94a3b8", fontWeight: 700, fontSize: 12, cursor: "pointer"
      }}>{label}</button>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 500, maxHeight: "85vh", overflowY: "auto", padding: "24px 20px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#0f1f35" }}>{task.title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, color: "#94a3b8", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>Inspection • {items.length} items</div>

        {items.map(item => {
          const cur = items.find(i => i.id === item.id);
          const needsNote = cur?.result === "monitor" || cur?.result === "fail";
          return (
            <div key={item.id} style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0f1f35", marginBottom: 10 }}>{item.label}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: needsNote ? 10 : 0 }}>
                <RBtn id={item.id} val="good" label="✓ Good" color="#15803d" bg="#f0fdf4" />
                <RBtn id={item.id} val="monitor" label="⚠ Monitor" color="#d97706" bg="#fffbeb" />
                <RBtn id={item.id} val="fail" label="✗ Fail" color="#dc2626" bg="#fef2f2" />
              </div>
              {needsNote && (
                <div>
                  {cur.result === "fail" && (
                    <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, marginBottom: 6 }}>Note and photo required for failed items</div>
                  )}
                  <textarea value={cur.note} onChange={e => setNote(item.id, e.target.value)}
                    placeholder={cur.result === "fail" ? "Describe what failed... (required)" : "Add notes..."}
                    rows={2} style={{ width: "100%", padding: "8px 10px", border: cur.result === "fail" && !cur.note?.trim() ? "1.5px solid #fca5a5" : "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 12, resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 8, color: "#0f1f35" }} />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: cur.result === "fail" && !cur.photoUrl ? "#dc2626" : "#0369a1", fontWeight: 600 }}>
                    {cur.photoUrl ? "Photo attached ✓" : cur.result === "fail" ? "Attach photo (required)" : "Attach photo"}
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                      onChange={e => handlePhoto(item.id, e.target.files[0])} />
                  </label>
                  {cur.photoUrl && <img src={cur.photoUrl} alt="inspection" style={{ width: "100%", borderRadius: 8, marginTop: 8, maxHeight: 180, objectFit: "cover" }} />}
                </div>
              )}
            </div>
          );
        })}

        {failCount > 0 && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
            {failCount} failed item{failCount > 1 ? "s" : ""} — task{failCount > 1 ? "s" : ""} will be auto-created for managers
          </div>
        )}

        <button onClick={handleSubmit} disabled={!allRated || saving} style={{
          width: "100%", padding: 14,
          background: !allRated ? "#e2e8f0" : failCount > 0 ? "#dc2626" : "#0f1f35",
          color: !allRated ? "#94a3b8" : "#fff",
          border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15,
          cursor: !allRated ? "not-allowed" : "pointer"
        }}>
          {saving ? "Saving..." : !allRated ? "Rate all items to submit" : failCount > 0 ? `Submit with ${failCount} Failure${failCount > 1 ? "s" : ""}` : "Submit Inspection"}
        </button>
      </div>
    </div>
  );
}

function AddTaskModal({ locId, onClose, onAdd, preset, user, editTask }) {
const [title, setTitle] = useState(editTask?.title || "");
const [category, setCategory] = useState(editTask?.category || "cleaning");
const [priority, setPriority] = useState(editTask?.priority || "medium");
const [shift, setShift] = useState(editTask?.shift || "everyone");
const [due, setDue] = useState(editTask?.due || new Date().toISOString().split("T")[0]);
const [saving, setSaving] = useState(false);
  const [requirePhoto, setRequirePhoto] = useState(editTask?.requirePhoto || false);
  const [equipmentId, setEquipmentId] = useState(preset?.id || "");
  const [equipmentList, setEquipmentList] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [assignTo, setAssignTo] = useState(editTask?.assignedUserId || editTask?.shift || "everyone");

  useEffect(() => {
    if (!user?.uid) return;
    const ownerId = user.isTeamMember ? user.ownerId : user.uid;
    getDocs(query(collection(db, "users"), where("ownerId", "==", ownerId))).then(snap => {
      const members = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      const allMembers = members.some(m => m.uid === user.uid) ? members : [{ uid: user.uid, name: user.name || user.email, role: user.role }, ...members];
      setTeamMembers(allMembers);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!locId) return;
    getDocs(collection(db, "locations", locId, "equipment")).then(snap => {
      setEquipmentList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [locId]);

  const [recurrence, setRecurrence] = useState("");
const [customCars, setCustomCars] = useState("");
const [checklistItems, setChecklistItems] = useState([]);
const [newCheckItem, setNewCheckItem] = useState("");

const addCheckItem = () => {
  if (!newCheckItem.trim()) return;
  setChecklistItems(p => [...p, { id: "ci" + Date.now(), label: newCheckItem.trim() }]);
  setNewCheckItem("");
};
const removeCheckItem = (id) => setChecklistItems(p => p.filter(i => i.id !== id));

const handleSubmit = async (e) => {
e.preventDefault();
if (!title.trim()) return;
setSaving(true);
const id = "t" + Date.now();
const resolvedUserId = (assignTo && !["everyone","attendant","technician","manager","user",""].includes(assignTo)) ? assignTo : null;
    const resolvedUserName = resolvedUserId ? (teamMembers.find(m => m.uid === resolvedUserId)?.name || teamMembers.find(m => m.uid === resolvedUserId)?.email || "") : null;
    if (editTask) {
      await updateDoc(doc(db, "locations", locId, "tasks", editTask.id), {
        title: title.trim(), category, priority, shift: resolvedUserId ? "user" : shift, due,
        assignedUserId: resolvedUserId || null, assignedUserName: resolvedUserName || null,
        recurrence: recurrence || null, requirePhoto, updatedAt: new Date().toISOString(),
      });
      setSaving(false); onClose(); return;
    }
    // Calculate nextCarsDue if car-based recurrence and equipment selected
    let nextCarsDue = null;
    if (recurrence && recurrence.includes("cars") && equipmentId) {
      const carInterval = parseInt(recurrence.replace(/[^0-9]/g, "")) || 0;
      if (carInterval > 0) {
        try {
          const eqDoc = await getDoc(doc(db, "locations", locId, "equipment", equipmentId));
          const currentCars = eqDoc.exists() ? (eqDoc.data().carsCount || 0) : 0;
          nextCarsDue = currentCars + carInterval;
        } catch(e) { console.log("nextCarsDue error:", e.message); }
      }
    }

    const task = { id, title: title.trim(), category, priority, shift: resolvedUserId ? "user" : shift, due, assignedUserId: resolvedUserId || null, assignedUserName: resolvedUserName || null, status: "pending", assignedRole: "attendant", recurrence: recurrence || null, equipmentId: equipmentId || null, nextCarsDue, requirePhoto, ...(category === "inspection" ? { type: "inspection", checklist: checklistItems } : {}), equipmentId: equipmentId || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
await setDoc(doc(db, "locations", locId, "tasks", id), task);
// Notify assigned user
if (resolvedUserId) {
  try {
    await writeNotif(resolvedUserId, { type: "task_assigned", title: "New task assigned to you", body: title.trim(), locationId: locId, taskId: id });
  } catch(e) { console.log("Notif error:", e.message); }
}

// Notify all users with access to this location who have newTaskAlert enabled
try {
  const ownerId = user?.isTeamMember ? user?.ownerId : user?.uid;
  const teamSnap = await getDocs(query(collection(db, "users"), where("ownerId", "==", ownerId)));
  const allUsers = [...teamSnap.docs];
  for (const memberDoc of allUsers) {
    if (memberDoc.id === resolvedUserId) continue;
    const md = memberDoc.data();
    const hasAccess = !md.allowedLocations || md.allowedLocations.includes(locId);
    if (!hasAccess) continue;
    const prefsSnap = await getDoc(doc(db, "users", memberDoc.id, "prefs", "alerts"));
    const prefs = prefsSnap.exists() ? prefsSnap.data() : {};
    if (prefs.newTaskAlert) {
      await writeNotif(memberDoc.id, { type: "new_task", title: "New task added", body: title.trim(), locationId: locId, taskId: id });
    }
  }
  // Also notify current user if they have newTaskAlert on
  const myPrefsSnap = await getDoc(doc(db, "users", user.uid, "prefs", "alerts"));
  const myPrefs = myPrefsSnap.exists() ? myPrefsSnap.data() : {};
  if (myPrefs.newTaskAlert) {
    await writeNotif(user.uid, { type: "new_task", title: "New task added", body: title.trim(), locationId: locId, taskId: id });
  }
} catch(e) { console.log("Location notif error:", e.message); }

setSaving(false);
onClose();
};

const inp = { width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fafafa", marginTop: 4, color: "#0f1f35" };
const sel = { ...inp, cursor: "pointer" };

return (
<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
<div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflowY: "auto", maxHeight: "90vh" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
<div style={{ fontWeight: 700, fontSize: 17, color: "#0f1f35" }}>Add New Task</div>
<button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>x</button>
</div>
<form onSubmit={handleSubmit}>
<div style={{ marginBottom: 14 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Task Title</label>
<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Restock soap dispensers" required style={inp} />
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 14 }}>
<div>
<label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Category</label>
<select value={category} onChange={e => setCategory(e.target.value)} style={sel}>
<option value="cleaning">Cleaning</option>
<option value="maintenance">Maintenance</option>
<option value="chemicals">Chemicals</option>
<option value="inspection">Inspection</option>
</select>
</div>
<div>
<label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Priority</label>
<select value={priority} onChange={e => setPriority(e.target.value)} style={sel}>
<option value="high">High</option>
<option value="medium">Medium</option>
<option value="low">Low</option>
</select>
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
<div>
<label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Assigned To</label>
<select value={assignTo} onChange={e => {
  const val = e.target.value;
  setAssignTo(val);
  if (["everyone","attendant","technician","manager"].includes(val)) {
    setShift(val);
  } else {
    setShift("user");
  }
}} style={sel}>
<option value="everyone">Everyone</option>
<option value="attendant">Attendants</option>
<option value="technician">Technicians</option>
<option value="manager">Managers</option>
{teamMembers.length > 0 && <option disabled>── Specific Person ──</option>}
{teamMembers.map(m => <option key={m.uid} value={m.uid}>{m.name || m.email} — {m.role}</option>)}
</select>
</div>
<div>
<label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Due Date</label>
<input type="date" value={due} onChange={e => setDue(e.target.value)} style={inp} />
</div>
</div>
<div style={{ marginBottom: 14 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Link to Equipment (optional)</label>
            <select value={equipmentId} onChange={e => setEquipmentId(e.target.value)} style={sel}>
              <option value="">None</option>
              {equipmentList.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
          </div>
{category === "inspection" && (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 8 }}>Checklist Items</label>
    {checklistItems.map(item => (
      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, background: "#f8fafc", borderRadius: 8, padding: "6px 10px" }}>
        <span style={{ flex: 1, fontSize: 13, color: "#334155" }}>{item.label}</span>
        <button type="button" onClick={() => removeCheckItem(item.id)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>×</button>
      </div>
    ))}
    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
      <input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
        onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCheckItem())}
        placeholder="Add checklist item..." style={{ ...inp, flex: 1, marginTop: 0, color: "#0f1f35" }} />
      <button type="button" onClick={addCheckItem}
        style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", fontSize: 13, cursor: "pointer" }}>+</button>
    </div>
    {checklistItems.length === 0 && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>Add items to inspect</div>}
  </div>
)}
          <div style={{ marginBottom: 14 }}>
              {(() => {
                const selectedEq = equipmentList.find(e => e.id === equipmentId);
                const showCarOptions = selectedEq?.tracksCarCount === true;
                // If car recurrence was set but equipment changed to non-tracking, clear it
                return (
                  <>
                    <select value={recurrence.startsWith("every") && !["every 100 cars","every 250 cars","every 500 cars","every 1000 cars","every 2500 cars","every 5000 cars"].includes(recurrence) ? "custom_cars" : recurrence} onChange={e => {
                      if (e.target.value === "custom_cars") { setRecurrence("custom_cars"); }
                      else { setRecurrence(e.target.value); setCustomCars(""); }
                    }} style={sel}>
                      <option value="">No recurrence</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annually">Annually</option>
                      {showCarOptions && <>
                        <option value="every 500 cars">Every 500 cars</option>
                        <option value="every 1000 cars">Every 1,000 cars</option>
                        <option value="every 2500 cars">Every 2,500 cars</option>
                        <option value="every 5000 cars">Every 5,000 cars</option>
                        <option value="every 7500 cars">Every 7,500 cars</option>
                        <option value="every 10000 cars">Every 10,000 cars</option>
                        <option value="custom_cars">Custom car count...</option>
                      </>}
                    </select>
                    {!showCarOptions && equipmentId && (
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Car count recurrence is only available for equipment with car tracking enabled.</div>
                    )}
                    {!equipmentId && (
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Link to car-tracking equipment above to unlock car count recurrence.</div>
                    )}
                    {(recurrence === "custom_cars" || (customCars && recurrence.includes("cars"))) && showCarOptions && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <span style={{ fontSize: 13, color: "#334155" }}>Every</span>
                        <input type="number" min="1" value={customCars} onChange={e => {
                          setCustomCars(e.target.value);
                          setRecurrence(e.target.value ? "every " + e.target.value + " cars" : "custom_cars");
                        }} placeholder="e.g. 750" style={{ ...inp, width: 100, marginTop: 0, color: "#0f1f35" }} />
                        <span style={{ fontSize: 13, color: "#334155" }}>cars</span>
                      </div>
                    )}
                  </>
                );
              })()}
</div>
<label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, cursor: "pointer", padding: "10px 12px", background: requirePhoto ? "#fef9c3" : "#f8fafc", borderRadius: 10, border: requirePhoto ? "1px solid #f59e0b" : "1px solid #e2e8f0" }}>
  <input type="checkbox" checked={requirePhoto} onChange={e => setRequirePhoto(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#0f1f35" }} />
  <div>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>Require photo to complete</div>
    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Staff must upload a photo before marking this task done</div>
  </div>
</label>
<div style={{ display: "flex", gap: 10 }}>
<button type="submit" disabled={saving} style={{ flex: 1, background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
{saving ? "Adding..." : "Add Task"}
</button>
<button type="button" onClick={onClose} style={{ flex: 1, background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
</div>
</form>
</div>
</div>
);
}

//  INVENTORY
const SCANNER_ID = "washlevel-barcode-scanner";

function BarcodeScanner({ onScan, onClose }) {
  useEffect(() => {
    let html5Qr = null;
    let scanned = false;
    const timer = setTimeout(() => {
      html5Qr = new Html5Qrcode(SCANNER_ID);
      html5Qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          if (scanned) return;
          scanned = true;
          onScan(decodedText);
        },
        () => {}
      ).catch(err => console.log("Scanner start error:", err));
    }, 300);

    return () => {
      clearTimeout(timer);
      if (html5Qr) html5Qr.stop().catch(() => {});
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 400, margin: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#0f1f35" }}>Scan Barcode</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12, textAlign: "center" }}>Point camera at barcode</div>
        <div id={SCANNER_ID} style={{ width: "100%", borderRadius: 10, overflow: "hidden" }} />
      </div>
    </div>
  );
}


function InventoryTransferModal({ item, fromLocId, locations, onClose, user }) {
  const [toLocId, setToLocId] = useState("");
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const ownerId = user?.isTeamMember ? user?.ownerId : user?.uid;

  const otherLocs = locations.filter(l => l.id !== fromLocId);

  const handleTransfer = async () => {
    if (!toLocId || qty <= 0) return;
    if (qty > item.quantity) { alert("Not enough stock to transfer."); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const fromLoc = locations.find(l => l.id === fromLocId);
    const toLoc = locations.find(l => l.id === toLocId);

    try {
      // Deduct from source
      const newFromQty = item.quantity - qty;
      await updateDoc(doc(db, "locations", fromLocId, "inventory", item.id), {
        quantity: newFromQty, updatedAt: now
      });

      // Log history at source
      await setDoc(doc(db, "locations", fromLocId, "inventory", item.id, "history", "tr" + Date.now()), {
        type: "transfer_out", quantity: -qty, newQuantity: newFromQty,
        toLocation: toLoc?.name || toLocId,
        note: "Transferred " + qty + " " + item.unit + " to " + (toLoc?.name || toLocId),
        timestamp: now, by: user?.name || user?.email || "Unknown"
      });

      // Check if item exists at destination
      const destSnap = await getDocs(collection(db, "locations", toLocId, "inventory"));
      const existing = destSnap.docs.find(d => {
        const data = d.data();
        return data.name?.toLowerCase() === item.name?.toLowerCase() ||
               (item.partNumber && data.partNumber === item.partNumber);
      });

      if (existing) {
        // Add to existing item
        const newToQty = (existing.data().quantity || 0) + qty;
        await updateDoc(doc(db, "locations", toLocId, "inventory", existing.id), {
          quantity: newToQty, updatedAt: now
        });
        // Log history at destination
        await setDoc(doc(db, "locations", toLocId, "inventory", existing.id, "history", "tr" + Date.now()), {
          type: "transfer_in", quantity: qty, newQuantity: newToQty,
          fromLocation: fromLoc?.name || fromLocId,
          note: "Received " + qty + " " + item.unit + " from " + (fromLoc?.name || fromLocId),
          timestamp: now, by: user?.name || user?.email || "Unknown"
        });
      } else {
        // Create new item at destination
        const newId = "inv" + Date.now();
        await setDoc(doc(db, "locations", toLocId, "inventory", newId), {
          ...item, id: newId, quantity: qty, createdAt: now, updatedAt: now
        });
        // Log history
        await setDoc(doc(db, "locations", toLocId, "inventory", newId, "history", "tr" + Date.now()), {
          type: "transfer_in", quantity: qty, newQuantity: qty,
          fromLocation: fromLoc?.name || fromLocId,
          note: "Received " + qty + " " + item.unit + " from " + (fromLoc?.name || fromLocId),
          timestamp: now, by: user?.name || user?.email || "Unknown"
        });
      }

      setSaving(false);
      onClose();
    } catch(e) {
      alert("Transfer failed: " + e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#0f1f35" }}>Transfer Stock</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>x</button>
        </div>
        <div style={{ background: "#f4f6f8", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1f35" }}>{item.name}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Available: {item.quantity} {item.unit}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Transfer To</label>
          <select value={toLocId} onChange={e => setToLocId(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", background: "#fff", color: "#0f1f35" }}>
            <option value="">Select location...</option>
            {otherLocs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Quantity to Transfer</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))}
              style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f1f5f9", fontSize: 18, cursor: "pointer", fontWeight: 700 }}>-</button>
            <input type="number" min="1" max={item.quantity} value={qty} onChange={e => setQty(Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
              style={{ flex: 1, padding: "8px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 18, fontWeight: 700, textAlign: "center", outline: "none", color: "#0f1f35" }} />
            <button onClick={() => setQty(q => Math.min(item.quantity, q + 1))}
              style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f1f5f9", fontSize: 18, cursor: "pointer", fontWeight: 700 }}>+</button>
            <span style={{ fontSize: 13, color: "#64748b" }}>{item.unit}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleTransfer} disabled={!toLocId || saving}
            style={{ flex: 1, background: !toLocId ? "#e2e8f0" : "#0f1f35", color: !toLocId ? "#94a3b8" : "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: !toLocId ? "not-allowed" : "pointer" }}>
            {saving ? "Transferring..." : "Transfer"}
          </button>
          <button onClick={onClose} style={{ flex: 1, background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Inventory({ locId, locationName, user, locations = [] }) {
  const ownerId = user?.isTeamMember ? user?.ownerId : user?.uid;
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [newItem, setNewItem] = useState({ name: "", category: "chemicals", quantity: 0, unit: "gal", lowThreshold: 5, partNumber: "", costPerUnit: 0, reorderAt: 0, vendorId: "" });
  const [activeTab, setActiveTab] = useState("inventory");
  const [vendors, setVendors] = useState([]);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: "", phone: "", email: "", website: "", accountNumber: "", notes: "" });
  const [savingVendor, setSavingVendor] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [editVendorData, setEditVendorData] = useState({});
  const [saving, setSaving] = useState(false);
  const [expandedVendors, setExpandedVendors] = useState({});
  const [transferItem, setTransferItem] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState("inventory"); // "inventory" or "attach"
  const [scanResult, setScanResult] = useState(null);
  const [scanQtyPrompt, setScanQtyPrompt] = useState(null); // { item, barcode }
  const [scanQty, setScanQty] = useState(1);
  const [attachingBarcode, setAttachingBarcode] = useState(null); // itemId being attached
  const [savingEdit, setSavingEdit] = useState(false);
  const [savedEdit, setSavedEdit] = useState(false);
  const [showItemHistory, setShowItemHistory] = useState(false);
  const [itemHistory, setItemHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!locId) return;
    const unsubV = onSnapshot(collection(db, "users", ownerId, "vendors"), snap => {
      setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.name||"").localeCompare(b.name||"")));
    });
    return () => unsubV();
  }, [locId]);

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
    const itemToSave = { ...newItem, id, createdAt: new Date().toISOString() };
    if (newItem.generateBarcode && !newItem.barcode) {
      itemToSave.barcode = "WL-" + id;
    }
    delete itemToSave.generateBarcode;
    await setDoc(doc(db, "locations", locId, "inventory", id), itemToSave);
    setNewItem({ name: "", category: "chemicals", quantity: 0, unit: "gal", lowThreshold: 5, partNumber: "", costPerUnit: 0, reorderAt: 0, vendorId: "", barcode: "", generateBarcode: false });
    setShowAdd(false);
    setSaving(false);
  };

  const handleUpdate = async (itemId, qty) => {
    const val = parseFloat(qty);
    if (isNaN(val)) return;
    const item = items.find(i => i.id === itemId);
    const qtyBefore = item?.quantity || 0;
    const delta = val - qtyBefore;
    await updateDoc(doc(db, "locations", locId, "inventory", itemId), { quantity: val, updatedAt: new Date().toISOString() });
    await logInventoryHistory(itemId, delta >= 0 ? "add" : "remove", delta, qtyBefore, val, "Manual adjustment");
  };

  const handleSaveEdit = async (itemId) => {
    setSavingEdit(true);
    const dataToSave = { ...editData, updatedAt: new Date().toISOString() };
    if (editData.generateBarcode && !items.find(i => i.id === itemId)?.barcode) {
      dataToSave.barcode = "WL-" + itemId;
    }
    delete dataToSave.generateBarcode;
    await updateDoc(doc(db, "locations", locId, "inventory", itemId), dataToSave);
    const item = items.find(i => i.id === itemId);
    const qtyBefore = item?.quantity || 0;
    const qtyAfter = editData.quantity ?? qtyBefore;
    const delta = qtyAfter - qtyBefore;
    if (delta !== 0) await logInventoryHistory(itemId, delta > 0 ? "add" : "remove", delta, qtyBefore, qtyAfter, "Edited");
    setSavingEdit(false);
    setSavedEdit(true);
    setTimeout(() => { setSavedEdit(false); setEditingId(null); }, 1000);
  };

  const logInventoryHistory = async (itemId, type, delta, quantityBefore, quantityAfter, note = "") => {
    try {
      await addDoc(collection(db, "locations", locId, "inventory", itemId, "history"), {
        type, delta, quantityBefore, quantityAfter,
        userId: user?.uid || "unknown",
        userName: user?.name || user?.email || "Unknown",
        timestamp: new Date().toISOString(),
        note,
      });
    } catch(e) { console.log("History log error:", e.message); }
  };

  const printBarcode = (item) => {
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Barcode - ${item.name}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
        h2 { font-size: 18px; margin-bottom: 8px; }
        p { font-size: 13px; color: #666; margin: 4px 0; }
        svg { margin: 16px auto; display: block; }
        @media print { button { display: none; } }
      </style></head>
      <body>
        <h2>${item.name}</h2>
        ${item.partNumber ? `<p>Part #: ${item.partNumber}</p>` : ""}
        <svg id="barcode"></svg>
        <p style="font-size:11px;color:#999;margin-top:8px">${item.barcode}</p>
        <br/><button onclick="window.print()" style="padding:10px 24px;font-size:14px;cursor:pointer;background:#0f1f35;color:#fff;border:none;border-radius:8px;">Print</button>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <script>JsBarcode("#barcode", "${item.barcode}", { format: "CODE128", width: 2, height: 80, displayValue: false });</script>
      </body></html>
    `);
    win.document.close();
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
  const [expandedCats, setExpandedCats] = useState({ chemicals: false, parts: false, "vending supplies": false });
  const CAT_COLORS2 = { chemicals: "#8b5cf6", parts: "#3b82f6", "vending supplies": "#f59e0b" };
  const UNITS = ["gal", "L", "oz", "lbs", "units", "rolls", "boxes"];
  const inp = { padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 7, fontSize: 13, background: "#fafafa", outline: "none", width: "100%", boxSizing: "border-box", marginTop: 4, color: "#0f1f35" };

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f1f35" }}>Inventory</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{locationName}</div>
        </div>
        {activeTab === "vendors" && (user?.role === "manager" || user?.role === "owner") && <button onClick={() => setShowAddVendor(true)} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Vendor</button>}
        {activeTab === "inventory" && (user?.role === "manager" || user?.role === "owner") && <div style={{ display: "flex", gap: 8 }}><button onClick={() => { setScanMode("inventory"); setShowScanner(true); }} style={{ background: "#f0fdf4", color: "#059669", border: "1.5px solid #bbf7d0", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📷 Scan</button><button onClick={() => setShowAdd(!showAdd)} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Item</button></div>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["inventory", "reorder", "vendors"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: activeTab === tab ? "#0f1f35" : "#f1f5f9",
            color: activeTab === tab ? "#fff" : "#64748b" }}>
            {tab === "inventory" ? "All Items" : tab === "reorder" ? "Reorder List" : "Vendors"}
          </button>
        ))}
      </div>

      {activeTab === "inventory" && (
       <div style={{ position: "relative", marginBottom: 14 }}>
         <input
           value={searchQuery}
           onChange={e => setSearchQuery(e.target.value)}
           onFocus={() => setSearchFocused(true)}
           onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
           placeholder="Search by name or part number..."
           style={{ width: "100%", padding: "10px 14px 10px 36px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fff", color: "#0f1f35" }}
         />
         <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 14 }}>⌕</div>
         {searchQuery && <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16 }}>×</button>}
         {searchFocused && searchQuery.length > 0 && (
           <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", zIndex: 100, maxHeight: 240, overflowY: "auto", marginTop: 4 }}>
             {items.filter(i =>
               i.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               i.partNumber?.toLowerCase().includes(searchQuery.toLowerCase())
             ).slice(0, 8).map(i => (
               <div key={i.id} onMouseDown={() => { setSearchQuery(i.name); setSearchFocused(false); }}
                 style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                 onMouseEnter={e => e.currentTarget.style.background = "#f4f6f8"}
                 onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                 <div>
                   <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{i.name}</div>
                   {i.partNumber && <div style={{ fontSize: 11, color: "#6366f1" }}>Part #: {i.partNumber}</div>}
                 </div>
                 <div style={{ fontSize: 12, color: "#94a3b8" }}>{i.quantity} {i.unit}</div>
               </div>
             ))}
             {items.filter(i =>
               i.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               i.partNumber?.toLowerCase().includes(searchQuery.toLowerCase())
             ).length === 0 && (
               <div style={{ padding: "12px 14px", fontSize: 13, color: "#94a3b8" }}>No items found</div>
             )}
           </div>
         )}
       </div>
     )}
     {activeTab === "inventory" && <>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={(barcode) => {
            setShowScanner(false);
            setTimeout(() => {
              try {
                if (scanMode === "inventory") {
                  const found = items.find(i => i.barcode === barcode);
                  if (found) {
                    setScanQtyPrompt({ item: found, barcode });
                    setScanQty(1);
                  } else {
                    setScanResult({ barcode, found: false });
                  }
                } else if (scanMode === "attach" && attachingBarcode) {
                  if (attachingBarcode === "__new__") {
                    setNewItem(p => ({...p, barcode}));
                  } else {
                    updateDoc(doc(db, "locations", locId, "inventory", attachingBarcode), { barcode, updatedAt: new Date().toISOString() });
                  }
                  setAttachingBarcode(null);
                }
              } catch(e) { console.error("Scan error:", e); }
            }, 300);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Scan Quantity Prompt */}
      {scanQtyPrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f1f35", marginBottom: 4 }}>{scanQtyPrompt.item.name}</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Current Stock (tap to correct)</div>
              <input type="number" value={scanQtyPrompt.item.quantity}
                onChange={e => setScanQtyPrompt(p => ({...p, item: {...p.item, quantity: parseFloat(e.target.value)||0}}))}
                style={{ width: "100%", padding: "10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 20, fontWeight: 700, textAlign: "center", outline: "none", boxSizing: "border-box", color: "#0f1f35" }} />
              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 4 }}>{scanQtyPrompt.item.unit}</div>
            </div>

            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Adjust quantity</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setScanQty(q => q - 1)}
                  style={{ width: 40, height: 40, borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#f1f5f9", fontSize: 20, fontWeight: 700, cursor: "pointer", color: "#dc2626" }}>−</button>
                <input type="number" value={scanQty}
                  onChange={e => setScanQty(parseFloat(e.target.value) || 0)}
                  style={{ flex: 1, padding: "10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 22, fontWeight: 700, textAlign: "center", outline: "none", color: scanQty > 0 ? "#059669" : scanQty < 0 ? "#dc2626" : "#334155" }} />
                <button onClick={() => setScanQty(q => q + 1)}
                  style={{ width: 40, height: 40, borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#f1f5f9", fontSize: 20, fontWeight: 700, cursor: "pointer", color: "#059669" }}>+</button>
              </div>
              {scanQty !== 0 && <div style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 6 }}>New total: {scanQtyPrompt.item.quantity + scanQty} {scanQtyPrompt.item.unit}</div>}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => {
                const qtyBefore = scanQtyPrompt.item.quantity;
                const newQty = qtyBefore + scanQty;
                await updateDoc(doc(db, "locations", locId, "inventory", scanQtyPrompt.item.id), { quantity: newQty, updatedAt: new Date().toISOString() });
                await logInventoryHistory(scanQtyPrompt.item.id, scanQty >= 0 ? "add" : "remove", scanQty, qtyBefore, newQty, "Scanned");
                setScanQtyPrompt(null);
                setScanQty(1);
              }} style={{ flex: 1, background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Update Inventory</button>
              <button onClick={() => { setScanQtyPrompt(null); setScanQty(1); }} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 8, padding: "12px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory History Modal */}
      {showItemHistory && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480, maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0f1f35" }}>Inventory History</div>
              <button onClick={() => setShowItemHistory(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {loadingHistory ? (
                <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>Loading...</div>
              ) : itemHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>No history yet</div>
              ) : itemHistory.map(h => (
                <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: h.delta > 0 ? "#059669" : h.delta < 0 ? "#dc2626" : "#0ea5e9", background: h.delta > 0 ? "#f0fdf4" : h.delta < 0 ? "#fef2f2" : "#f0f9ff", padding: "2px 8px", borderRadius: 6 }}>
                        {h.delta > 0 ? "+" + h.delta : h.delta === 0 ? "Set" : h.delta}
                      </span>
                      <span style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>{h.quantityBefore} → {h.quantityAfter}</span>
                      {h.note && <span style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>{h.note}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{h.userName} · {new Date(h.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Barcode Not Found */}
      {scanResult && !scanResult.found && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#92400e" }}>Barcode not found</div>
            <div style={{ fontSize: 11, color: "#b45309", marginTop: 2 }}>{scanResult.barcode}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setNewItem(p => ({...p, barcode: scanResult.barcode})); setShowAdd(true); setScanResult(null); }}
              style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Add Item</button>
            <button onClick={() => setScanResult(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" }}>×</button>
          </div>
        </div>
      )}


      {showAdd && (
        <div style={{ background: "#fff", border: "1.5px dashed #6366f1", borderRadius: 16, padding: 20, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#6366f1", marginBottom: 14 }}>New Inventory Item</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Item Name</label><input value={newItem.name} onChange={e => setNewItem(p => ({...p, name: e.target.value}))} placeholder="e.g. Tire Shine" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Part Number</label><input value={newItem.partNumber} onChange={e => setNewItem(p => ({...p, partNumber: e.target.value}))} placeholder="e.g. SHP-4421" style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Category</label>
              <select value={newItem.category} onChange={e => setNewItem(p => ({...p, category: e.target.value}))} style={inp}>
                <option value="chemicals">Chemicals</option>
<option value="inspection">Inspection</option>
                <option value="parts">Parts</option>
                <option value="vending supplies">Vending Supplies</option>
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Quantity</label><input type="number" value={newItem.quantity} onChange={e => setNewItem(p => ({...p, quantity: parseFloat(e.target.value)||0}))} style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Unit</label>
              <select value={newItem.unit} onChange={e => setNewItem(p => ({...p, unit: e.target.value}))} style={inp}>
                {UNITS.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase()+u.slice(1)}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Vendor</label><select value={newItem.vendorId || ""} onChange={e => setNewItem(p => ({...p, vendorId: e.target.value}))} style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", background: "#fff", color: "#0f1f35" }}><option value="">No vendor</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Low Stock Alert</label><input type="number" value={newItem.lowThreshold} onChange={e => setNewItem(p => ({...p, lowThreshold: parseFloat(e.target.value)||0}))} style={inp} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Reorder At (qty)</label><input type="number" value={newItem.reorderAt || ""} onChange={e => setNewItem(p => ({...p, reorderAt: parseFloat(e.target.value)||0}))} placeholder="e.g. 5" style={inp} /></div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Barcode</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "nowrap" }}>
                {newItem.barcode ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#059669", fontWeight: 600, flex: 1 }}>✓ {newItem.barcode}</div>
                    <button onClick={() => { setAttachingBarcode("__new__"); setScanMode("attach"); setShowScanner(true); }} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Rescan</button>
                    <button onClick={() => setNewItem(p => ({...p, barcode: ""}))} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Remove</button>
                  </div>
                ) : (
                  <button onClick={() => { setAttachingBarcode("__new__"); setScanMode("attach"); setShowScanner(true); }} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>📷 Scan Existing</button>
                )}
                {!newItem.barcode && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#334155", fontWeight: 600 }}>
                    <input type="checkbox" checked={newItem.generateBarcode || false} onChange={e => setNewItem(p => ({...p, generateBarcode: e.target.checked}))} style={{ width: 15, height: 15, accentColor: "#0f1f35" }} />
                    Generate barcode
                  </label>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleAdd} disabled={saving} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "Adding..." : "Add Item"}</button>
            <button onClick={() => setShowAdd(false)} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {items.filter(i => i.quantity <= i.lowThreshold).length > 0 && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#991b1b", fontWeight: 500 }}>
          Low stock: {items.filter(i => i.quantity <= i.lowThreshold).map(i => i.name).join(", ")}
        </div>
      )}

      {CAT_GROUPS.map(cat => {
        const group = items.filter(i => i.category === cat && (!searchQuery || i.name?.toLowerCase().includes(searchQuery.toLowerCase()) || i.partNumber?.toLowerCase().includes(searchQuery.toLowerCase())));
        if (!group.length) return null;
        const isExpanded = expandedCats[cat] !== false;
        return (
          <div key={cat} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
            <div onClick={() => setExpandedCats(p => ({...p, [cat]: !isExpanded}))}
              style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: isExpanded ? "#fff" : "#f4f6f8" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: CAT_COLORS2[cat] || "#334155", textTransform: "capitalize" }}>
                {cat} <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>({group.length} item{group.length !== 1 ? "s" : ""})</span>
              </div>
              <span style={{ color: "#94a3b8", fontSize: 14 }}>{isExpanded ? "▲" : "▼"}</span>
            </div>
            {isExpanded && <div style={{ padding: "0 20px 16px" }}>
            {group.map(item => {
              const low = item.quantity <= item.lowThreshold;
              const isEditing = editingId === item.id;
              return (
                <div key={item.id} style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 12, marginBottom: 12 }}>
                  {isEditing ? (
                    <div style={{ background: "#f4f6f8", borderRadius: 8, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#334155" }}>Editing: {item.name}</div>
                        <button onClick={async () => { const next = !showItemHistory; setShowItemHistory(next); if (next) { setLoadingHistory(true); const snap = await getDocs(collection(db, "locations", locId, "inventory", item.id, "history")); setItemHistory(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => b.timestamp.localeCompare(a.timestamp))); setLoadingHistory(false); } }} style={{ background: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>History</button>
                      </div>
                        <button onClick={async () => { const next = !showItemHistory; setShowItemHistory(next); if (next) { setLoadingHistory(true); const snap = await getDocs(collection(db, "locations", locId, "inventory", item.id, "history")); setItemHistory(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => b.timestamp.localeCompare(a.timestamp))); setLoadingHistory(false); } }} style={{ background: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>History</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 10 }}>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Name</label><input value={editData.name || ""} onChange={e => setEditData(p => ({...p, name: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Part Number</label><input value={editData.partNumber || ""} onChange={e => setEditData(p => ({...p, partNumber: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Category</label>
                          <select value={editData.category || "chemicals"} onChange={e => setEditData(p => ({...p, category: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }}>
                            <option value="chemicals">Chemicals</option>
                            <option value="parts">Parts</option>
                            <option value="vending supplies">Vending Supplies</option>
                          </select>
                        </div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Quantity</label><input type="number" value={editData.quantity || 0} onChange={e => setEditData(p => ({...p, quantity: parseFloat(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Unit</label>
                          <select value={editData.unit || "gal"} onChange={e => setEditData(p => ({...p, unit: e.target.value}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Vendor</label><select value={editData.vendorId || ""} onChange={e => setEditData(p => ({...p, vendorId: e.target.value}))} style={{ width: "100%", padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: 7, fontSize: 13, outline: "none", background: "#fff", color: "#0f1f35" }}><option value="">No vendor</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Low Stock Alert</label><input type="number" value={editData.lowThreshold || 0} onChange={e => setEditData(p => ({...p, lowThreshold: parseFloat(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Reorder At</label><input type="number" value={editData.reorderAt || ""} onChange={e => setEditData(p => ({...p, reorderAt: parseFloat(e.target.value)||0}))} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Barcode</label>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "nowrap" }}>
                            {item.barcode ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                                <div style={{ fontSize: 11, color: "#059669", fontWeight: 600, flex: 1 }}>✓ {item.barcode}</div>
                                <button onClick={() => { setAttachingBarcode(item.id); setScanMode("attach"); setShowScanner(true); }} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 5, padding: "3px 7px", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Rescan</button>
                                <button onClick={() => updateDoc(doc(db, "locations", locId, "inventory", item.id), { barcode: null })} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 5, padding: "3px 7px", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Remove</button>
                                <button onClick={() => printBarcode(item)} style={{ background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", borderRadius: 5, padding: "3px 7px", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>🖨️ Print</button>
                              </div>
                            ) : (
                              <button onClick={() => { setAttachingBarcode(item.id); setScanMode("attach"); setShowScanner(true); }} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 5, padding: "5px 8px", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>📷 Scan Existing</button>
                            )}
                            {!item.barcode && (
                              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 10, color: "#334155", fontWeight: 600 }}>
                                <input type="checkbox" checked={editData.generateBarcode || false} onChange={e => setEditData(p => ({...p, generateBarcode: e.target.checked}))} style={{ width: 13, height: 13, accentColor: "#0f1f35" }} />
                                Generate
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <button onClick={() => handleSaveEdit(item.id)} disabled={savingEdit} style={{ flex: 1, background: savedEdit ? "#10b981" : "#0f1f35", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{savingEdit ? "Saving..." : savedEdit ? "Saved!" : "Save"}</button>
                        <button onClick={() => setEditingId(null)} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                      </div>
                      <button onClick={() => { setTransferItem(item); setEditingId(null); }} style={{ width: "100%", background: "#ede9fe", color: "#6366f1", border: "1px solid #c4b5fd", borderRadius: 6, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Transfer Stock to Another Location</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#0f1f35" }}>{item.name}</div>
                        {item.partNumber && <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, marginTop: 1 }}>Part #: {item.partNumber}</div>}
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
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
                        <button onClick={() => handleUpdate(item.id, Math.max(0, item.quantity - 1))} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #e5e7eb", background: "#f1f5f9", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                        <div style={{ textAlign: "center", minWidth: 65 }}>
                          <span style={{ fontWeight: 700, fontSize: 16, color: low ? "#ef4444" : "#0f1f35" }}>{item.quantity}</span>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}> {item.unit}</span>
                        </div>
                        <button onClick={() => handleUpdate(item.id, item.quantity + 1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #e5e7eb", background: "#f1f5f9", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                        {(user?.role === "manager" || user?.role === "owner") && <button onClick={() => { setEditingId(item.id); setEditData({ name: item.name, partNumber: item.partNumber||"", category: item.category||"chemicals", quantity: item.quantity, unit: item.unit||"gal", costPerUnit: item.costPerUnit||0, lowThreshold: item.lowThreshold||0, reorderAt: item.reorderAt||0, vendorId: item.vendorId||"" }); }} style={{ background: "#0f1f35", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#fff", fontWeight: 600 }}>Edit</button>}
                        {(user?.role === "manager" || user?.role === "owner") && <button onClick={() => handleDelete(item.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#dc2626", fontWeight: 600 }}>Del</button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>}
          </div>
        );
      })}
      {items.length === 0 && !showAdd && <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>No inventory items yet. Tap + Add Item to get started.</div>}
      </>}

      {activeTab === "reorder" && (
        <div>
          {(() => {
            const lowItems = items.filter(i => i.reorderAt > 0 && i.quantity <= i.reorderAt);
            if (lowItems.length === 0) return <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>No items need reordering right now.</div>;
            const byVendor = {};
            lowItems.forEach(item => {
              const v = vendors.find(v => v.id === item.vendorId);
              const key = v ? v.id : "unassigned";
              if (!byVendor[key]) byVendor[key] = { vendor: v || null, items: [] };
              byVendor[key].items.push(item);
            });
            return Object.values(byVendor).map((group, gi) => (
              <div key={gi} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 4 }}>
                  {group.vendor ? group.vendor.name : "No Vendor Assigned"}
                </div>
                {group.vendor && (
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {group.vendor.phone && <span>{group.vendor.phone}</span>}
                    {group.vendor.email && <span>{group.vendor.email}</span>}
                    {group.vendor.accountNumber && <span>Acct: {group.vendor.accountNumber}</span>}
                  </div>
                )}
                {group.items.map(item => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>Have: {item.quantity} {item.unit} — Reorder at: {item.reorderAt}{item.partNumber ? " | #" + item.partNumber : ""}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, background: "#fee2e2", padding: "3px 8px", borderRadius: 6 }}>LOW</div>
                  </div>
                ))}
              </div>
            ));
          })()}
        </div>
      )}

      {transferItem && <InventoryTransferModal item={transferItem} fromLocId={locId} locations={locations} user={user} onClose={() => setTransferItem(null)} />}
      {activeTab === "vendors" && (
        <div>
          {showAddVendor && (
            <div style={{ background: "#fff", border: "1.5px dashed #6366f1", borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#6366f1", marginBottom: 12 }}>Add Vendor</div>
              {[["name","Vendor Name *","text"],["phone","Phone","tel"],["email","Email","email"],["website","Website","text"],["accountNumber","Account #","text"]].map(([field,label,type]) => (
                <div key={field} style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>{label}</label>
                  <input type={type} value={newVendor[field]} onChange={e => setNewVendor(p => ({...p, [field]: e.target.value}))}
                    style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: "#0f1f35", background: "#fff" }} />
                </div>
              ))}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Notes</label>
                <textarea value={newVendor.notes} onChange={e => setNewVendor(p => ({...p, notes: e.target.value}))}
                  rows={2} style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "none", color: "#0f1f35", background: "#fff" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={async () => {
                  if (!newVendor.name.trim()) return;
                  setSavingVendor(true);
                  const id = "ven" + Date.now();
                  await setDoc(doc(db, "users", ownerId, "vendors", id), { ...newVendor, id, createdAt: new Date().toISOString() });
                  setNewVendor({ name: "", phone: "", email: "", website: "", accountNumber: "", notes: "" });
                  setShowAddVendor(false);
                  setSavingVendor(false);
                }} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{savingVendor ? "Saving..." : "Save Vendor"}</button>
                <button onClick={() => setShowAddVendor(false)} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}
          {!showAddVendor && vendors.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>No vendors yet. Click + Add Vendor to get started.</div>}
          {vendors.map(v => (
            <div key={v.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, marginBottom: 12 }}>
              {editingVendorId === v.id ? (
                <div>
                  {[["name","Vendor Name","text"],["phone","Phone","tel"],["email","Email","email"],["website","Website","text"],["accountNumber","Account #","text"]].map(([field,label,type]) => (
                    <div key={field} style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 2 }}>{label}</label>
                      <input type={type} value={editVendorData[field] || ""} onChange={e => setEditVendorData(p => ({...p, [field]: e.target.value}))}
                        style={{ width: "100%", padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box", color: "#0f1f35" }} />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={async () => {
                      await updateDoc(doc(db, "users", ownerId, "vendors", v.id), { ...editVendorData, updatedAt: new Date().toISOString() });
                      setEditingVendorId(null);
                    }} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingVendorId(null)} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>{v.name}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setEditingVendorId(v.id); setEditVendorData({...v}); }} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Edit</button>
                      <button onClick={async () => { if (!window.confirm("Delete vendor?")) return; await deleteDoc(doc(db, "users", ownerId, "vendors", v.id)); }} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Delete</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {v.phone && <span>{v.phone}</span>}
                    {v.email && <span>{v.email}</span>}
                    {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" style={{ color: "#0369a1" }}>{v.website}</a>}
                    {v.accountNumber && <span>Acct: {v.accountNumber}</span>}
                  </div>
                  {v.notes && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>{v.notes}</div>}
                  {(() => {
                    const vendorItems = items.filter(i => i.vendorId === v.id);
                    return (
                      <div style={{ marginTop: 8 }}>
                        <div onClick={() => setExpandedVendors(p => ({...p, [v.id]: !p[v.id]}))} style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          {vendorItems.length} item{vendorItems.length !== 1 ? "s" : ""} assigned {vendorItems.length > 0 ? (expandedVendors[v.id] ? "▲" : "▼") : ""}
                        </div>
                        {expandedVendors[v.id] && vendorItems.length > 0 && (
                          <div style={{ marginTop: 8, borderTop: "1px solid #f3f4f6", paddingTop: 8 }}>
                            {vendorItems.map(item => (
                              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f9fafb" }}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f1f35" }}>{item.name}</div>
                                  {item.partNumber && <div style={{ fontSize: 11, color: "#94a3b8" }}>Part #: {item.partNumber}</div>}
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: item.quantity <= (item.lowThreshold || 0) ? "#dc2626" : "#059669" }}>{item.quantity} {item.unit}</div>
                                  {item.costPerUnit ? <div style={{ fontSize: 11, color: "#94a3b8" }}>${item.costPerUnit}/{item.unit}</div> : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialsModal({ locId, task, onClose }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [writeIns, setWriteIns] = useState([{ name: "", qty: "", unit: "" }]);
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!locId) return;
    getDocs(collection(db, "locations", locId, "inventory")).then(snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [locId]);

  const handleQty = (id, val) => setSelected(p => ({ ...p, [id]: parseFloat(val) || 0 }));

  const handleScan = (barcode) => {
    setShowScanner(false);
    const found = items.find(i => i.barcode === barcode);
    if (found) {
      setSelected(p => ({ ...p, [found.id]: (p[found.id] || 0) + 1 }));
    } else {
      alert("No inventory item found with that barcode.");
    }
  };

  const filteredItems = items.filter(i =>
    !searchQuery ||
    i.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.partNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedItems = items.filter(i => selected[i.id] > 0);

  const addWriteIn = () => setWriteIns(p => [...p, { name: "", qty: "", unit: "" }]);
  const updateWriteIn = (idx, field, val) => setWriteIns(p => p.map((w, i) => i === idx ? { ...w, [field]: val } : w));
  const removeWriteIn = (idx) => setWriteIns(p => p.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    for (const [itemId, qty] of Object.entries(selected)) {
      if (qty <= 0) continue;
      const item = items.find(i => i.id === itemId);
      if (!item) continue;
      const newQty = Math.max(0, item.quantity - qty);
      await updateDoc(doc(db, "locations", locId, "inventory", itemId), { quantity: newQty, updatedAt: new Date().toISOString() });
      await addDoc(collection(db, "locations", locId, "inventory", itemId, "history"), {
        type: "task_use", delta: -qty, quantityBefore: item.quantity, quantityAfter: newQty,
        timestamp: new Date().toISOString(), note: "Used on task: " + (task?.title || ""), taskId: task?.id || ""
      });
    }
    const usedItems = Object.entries(selected).filter(([, qty]) => qty > 0).map(([itemId, qty]) => {
      const item = items.find(i => i.id === itemId);
      return { itemId, name: item?.name || itemId, qty, unit: item?.unit || "" };
    });
    const validWriteIns = writeIns.filter(w => w.name.trim() && parseFloat(w.qty) > 0).map(w => ({
      name: w.name.trim(), qty: parseFloat(w.qty), unit: w.unit || "", writeIn: true
    }));
    const allUsed = [...usedItems, ...validWriteIns];
    const existingParts = task.partsUsed || [];
    const mergedParts = [...existingParts];
    for (const newItem of allUsed) {
      const idx = mergedParts.findIndex(p => p.itemId ? p.itemId === newItem.itemId : p.name === newItem.name);
      if (idx >= 0) mergedParts[idx] = { ...mergedParts[idx], qty: mergedParts[idx].qty + newItem.qty };
      else mergedParts.push(newItem);
    }
    await updateDoc(doc(db, "locations", locId, "tasks", task.id), { partsUsed: mergedParts, updatedAt: new Date().toISOString() });
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 20px 12px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f1f35" }}>Materials Used</div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>x</button>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>{task?.title}</div>

          {/* Scan + Search */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={() => setShowScanner(true)}
              style={{ background: "#f0fdf4", color: "#059669", border: "1.5px solid #bbf7d0", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              Scan
            </button>
          </div>
          {/* Search bar */}
          <div style={{ position: "relative", marginBottom: 8 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)} onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder="Search inventory by name or part #..."
              style={{ width: "100%", padding: "9px 14px 9px 34px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box", color: "#0f1f35" }} />
            <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>⌕</div>
            {searchQuery && <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16 }}>×</button>}
            {searchFocused && searchQuery && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", zIndex: 200, maxHeight: 200, overflowY: "auto", marginTop: 4 }}>
                {filteredItems.slice(0, 8).map(i => (
                  <div key={i.id} onMouseDown={() => { setSearchQuery(""); setSelected(p => ({ ...p, [i.id]: 1 })); }}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f4f6f8"}
                    onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{i.name}</div>
                      {i.partNumber && <div style={{ fontSize: 11, color: "#6366f1" }}>Part #: {i.partNumber}</div>}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{i.quantity} {i.unit}</div>
                  </div>
                ))}
                {filteredItems.length === 0 && <div style={{ padding: "12px 14px", fontSize: 13, color: "#94a3b8" }}>No items found</div>}
              </div>
            )}
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "12px 20px", flex: 1 }}>
          {/* Selected inventory items */}
          {selectedItems.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>From Inventory</div>
              {selectedItems.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#0f1f35" }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>Available: {item.quantity} {item.unit}</div>
                  </div>
                  <input type="number" min="0" max={item.quantity} value={selected[item.id] || ""}
                    onChange={e => handleQty(item.id, e.target.value)}
                    style={{ width: 60, padding: "5px 8px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 13, outline: "none", textAlign: "center", color: "#0f1f35" }} />
                  <span style={{ fontSize: 12, color: "#64748b", minWidth: 24 }}>{item.unit}</span>
                  <button onClick={() => setSelected(p => { const n = {...p}; delete n[item.id]; return n; })}
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {selectedItems.length === 0 && !searchQuery && (
            <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: 13 }}>Search above to find inventory items</div>
          )}

          {/* Write-in section */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Other Materials (write-in)</div>
            {writeIns.map((w, idx) => (
              <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                <input value={w.name} onChange={e => updateWriteIn(idx, "name", e.target.value)}
                  placeholder="Material name..."
                  style={{ flex: 2, padding: "7px 10px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 12, outline: "none", color: "#0f1f35" }} />
                <input type="number" value={w.qty} onChange={e => updateWriteIn(idx, "qty", e.target.value)}
                  placeholder="Qty"
                  style={{ width: 52, padding: "7px 8px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 12, outline: "none", textAlign: "center", color: "#0f1f35" }} />
                <input value={w.unit} onChange={e => updateWriteIn(idx, "unit", e.target.value)}
                  placeholder="Unit"
                  style={{ width: 48, padding: "7px 8px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 12, outline: "none", color: "#0f1f35" }} />
                {writeIns.length > 1 && <button onClick={() => removeWriteIn(idx)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>×</button>}
              </div>
            ))}
            <button onClick={addWriteIn} style={{ fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}>+ Add another</button>
          </div>
        </div>

        <div style={{ padding: "12px 20px 20px", borderTop: "1px solid #f1f5f9", flexShrink: 0, display: "flex", gap: 10 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Saving..." : "Save Materials"}
          </button>
          <button onClick={onClose} style={{ flex: 1, background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
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

// Reset weather when location changes
useEffect(() => {
  setWeather({});
  if (selectedDate && location?.zipCode) fetchWeather(selectedDate);
}, [locId, location?.zipCode]);
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
<div style={{ fontSize: 20, fontWeight: 700, color: "#0f1f35" }}>Calendar</div>
<div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{locationName}</div>
</div>

  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
    {/* Calendar grid */}
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 14 }}>{"<"}</button>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#0f1f35" }}>{monthName}</div>
        <button onClick={nextMonth} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 14 }}>{">"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 8 }}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94a3b8", padding: "4px 0" }}>{d}</div>
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
              background: isToday ? "#0f1f35" : isSelected ? "#e0e7ff" : hasSummary ? "#f0fdf4" : "#fafafa",
              color: isToday ? "#fff" : "#0f1f35",
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
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
      {!location?.zipCode && (
    <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#92400e" }}>
      No zip code set for this location. Add one in Settings to enable weather data.
    </div>
  )}
  {!selectedDate ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#128197;</div>
          Select a date to view summary
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 16 }}>
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
                <div style={{ fontSize: 11, color: "#64748b" }}>Cars Washed</div>
              </div>
              <div style={{ background: "#ede9fe", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#7c3aed" }}>{summary.tasksDone}/{summary.tasksTotal}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Tasks Done</div>
              </div>
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>Notes / Issues</label>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={4} placeholder="Add notes about this day..." style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 12, resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          </div>
          <button onClick={handleSaveNote} disabled={savingNote} style={{ width: "100%", background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{savingNote ? "Saving..." : "Save Notes"}</button>
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
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f1f35" }}>All Locations Overview</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
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
            <div key={loc.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#0f1f35" }}>{loc.name}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {alerts > 0 && <span style={{ background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{alerts} alert{alerts > 1 ? "s" : ""}</span>}
                  {overdue > 0 && <span style={{ background: "#fef3c7", color: "#d97706", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{overdue} overdue</span>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ background: "#f0f9ff", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#0369a1" }}>{locSensors.carsToday || 0}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Cars Today</div>
                </div>
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>{pct}%</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Tasks Done</div>
                </div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                  <span>Task Progress</span><span>{done}/{locTasks.length}</span>
                </div>
                <div style={{ height: 6, background: "#e2e8f0", borderRadius: 99 }}>
                  <div style={{ height: "100%", width: pct + "%", background: pct === 100 ? "#10b981" : "#6366f1", borderRadius: 99 }} />
                </div>
              </div>
              {[
                { label: "Soap", val: locSensors.soapLevel, c: "#8b5cf6" },
                { label: "Rinse Aid", val: locSensors.rinseAid, c: "#0ea5e9" },
              ].map(s => s.val != null && (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: "#64748b", width: 50 }}>{s.label}</span>
                  <div style={{ flex: 1, height: 4, background: "#e2e8f0", borderRadius: 99 }}>
                    <div style={{ height: "100%", width: s.val + "%", background: s.val < 30 ? "#ef4444" : s.c, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 11, color: s.val < 30 ? "#ef4444" : "#64748b", fontWeight: 600, width: 28 }}>{s.val}%</span>
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
        password,
        accessToken: tokenData.accesstoken,
        tokenUpdatedAt: new Date().toISOString(),
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

  const inp = { width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", color: "#0f1f35", background: "#fff", boxSizing: "border-box", marginTop: 6 };

  if (loadingConfig) return <div style={{ padding: 20, color: "#94a3b8", fontSize: 13 }}>Loading...</div>;

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>SensorPush</div>
        {connected && <span style={{ background: "#d1fae5", color: "#065f46", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>Connected</span>}
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Temperature and humidity sensors</div>
      {!connected ? (
        <div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>SensorPush Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com" style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="password" style={inp} />
          </div>
          {error && <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button onClick={handleConnect} disabled={connecting} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}>
            {connecting ? "Connecting..." : "Connect SensorPush"}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
            Connected as <strong>{email}</strong>. Assign sensors to locations below.
          </div>
          {sensors.length === 0 && <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>No sensors found on your account.</div>}
          {sensors.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "10px 12px", background: "#f8fafc", borderRadius: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.id}</div>
              </div>
              <select value={assignments[s.id] || ""} onChange={e => setAssignments(p => ({ ...p, [s.id]: e.target.value }))}
                style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: 7, fontSize: 12, outline: "none", color: "#334155", background: "#fff" }}>
                <option value="">Unassigned</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          ))}
          {sensors.length > 0 && (
            <button onClick={handleSaveAssignments} disabled={saving} style={{ background: savedMsg ? "#10b981" : "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%", marginTop: 8 }}>
              {saving ? "Saving..." : savedMsg ? "Saved!" : "Save Assignments"}
            </button>
          )}
          <button onClick={handleDisconnect} style={{ background: "none", color: "#ef4444", border: "none", fontSize: 12, cursor: "pointer", marginTop: 12, padding: 0 }}>Disconnect SensorPush</button>
        </div>
      )}
    </div>
  );
}

function ShellyIntegration({ locations }) {
  const { user } = useAuth();
  const [authKey, setAuthKey] = useState("");
  const [server, setServer] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [devices, setDevices] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [hidden, setHidden] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "integrations", "shelly"));
        if (snap.exists() && !snap.data().disconnected) {
          const data = snap.data();
          setConnected(true);
          setAuthKey(data.authKey || "");
          setServer(data.server || "");
          // Load devices from Shelly Cloud
          if (data.authKey && data.server) {
            try {
              const shellyProxy = httpsCallable(functions, "shellyCloudProxy");
              const result = await shellyProxy({ authKey: data.authKey, server: data.server });
              const rd = result.data;
              if (rd.isok && rd.data?.devices) {
                const deviceList = Object.values(rd.data.devices).map(d => ({
                  id: d.id, name: d.name || d.id, type: d.type || "unknown", online: d.cloud_online || false
                }));
                setDevices(deviceList);
                // Update stored devices
                await updateDoc(doc(db, "users", user.uid, "integrations", "shelly"), { devices: deviceList });
              } else {
                setDevices(data.devices || []);
              }
            } catch(e) { setDevices(data.devices || []); }
          }
        }
        const configSnap = await getDoc(doc(db, "users", user.uid, "prefs", "shellyConfig"));
        if (configSnap.exists()) {
          setAssignments(configSnap.data().assignments || {});
          setHidden(configSnap.data().hidden || []);
        }
      } catch(e) {}
      setLoading(false);
    };
    load();
  }, []);

  const handleConnect = async () => {
    if (!authKey.trim() || !server.trim()) return;
    setConnecting(true);
    try {
      const shellyProxy = httpsCallable(functions, "shellyCloudProxy");
      const result = await shellyProxy({ authKey: authKey.trim(), server: server.trim() });
      const data = result.data;
      if (data.isok || data.verified || (data.errors && data.errors.wrong_device_id)) {
        // Load devices
        let deviceList = [];
        if (data.isok && data.data?.devices) {
          deviceList = Object.values(data.data.devices).map(d => ({
            id: d.id, name: d.name || d.id, type: d.type || "unknown", online: d.cloud_online || false
          }));
        }
        const creds = { authKey: authKey.trim(), server: server.trim(), connectedAt: new Date().toISOString(), devices: deviceList };
        await setDoc(doc(db, "users", user.uid, "integrations", "shelly"), creds);
        setConnected(true);
        setDevices(deviceList);
      } else {
        alert("Connection failed. Check your Auth Key and server URL.");
      }
    } catch(e) { alert("Error: " + e.message); }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect Shelly Cloud?")) return;
    await updateDoc(doc(db, "users", user.uid, "integrations", "shelly"), { disconnected: true });
    setConnected(false);
    setDevices([]);
  };

  const saveConfig = async (newAssignments, newHidden) => {
    await setDoc(doc(db, "users", user.uid, "prefs", "shellyConfig"), { assignments: newAssignments, hidden: newHidden });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const visibleDevices = devices.filter(d => !hidden.includes(d.id));

  if (loading) return <div style={{ color: "#94a3b8", padding: 20 }}>Loading...</div>;

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>Shelly Cloud</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Monitor Shelly relays and inputs</div>
        </div>
        {connected && <span style={{ background: "#d1fae5", color: "#065f46", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>Connected</span>}
      </div>

      {!connected ? (
        <div>
          <div style={{ fontSize: 12, color: "#64748b", background: "#f4f6f8", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <b>Find your Auth Key:</b> Shelly App → User Settings → Authorization cloud key
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Server URL <span style={{ fontWeight: 400 }}>(e.g. shelly-256-eu.shelly.cloud)</span></label>
            <input value={server} onChange={e => setServer(e.target.value.replace("https://",""))} placeholder="shelly-256-eu.shelly.cloud"
              style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: "#0f1f35", background: "#fff" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Auth Key</label>
            <input value={authKey} onChange={e => setAuthKey(e.target.value)} placeholder="Paste your Auth Key"
              style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: "#0f1f35", background: "#fff" }} />
          </div>
          <button onClick={handleConnect} disabled={connecting || !authKey || !server}
            style={{ background: authKey && server ? "#0f1f35" : "#e2e8f0", color: authKey && server ? "#fff" : "#94a3b8", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: authKey && server ? "pointer" : "not-allowed" }}>
            {connecting ? "Connecting..." : "Connect Shelly Cloud"}
          </button>
        </div>
      ) : (
        <div>
          {visibleDevices.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>No devices found. Try refreshing.</div>
          ) : (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Assign devices to locations:</div>
              {visibleDevices.map(device => (
                <div key={device.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{device.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{device.type}</div>
                  </div>
                  <select value={assignments[device.id] || ""} onChange={e => setAssignments(a => ({...a, [device.id]: e.target.value}))}
                    style={{ padding: "5px 8px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 12, outline: "none", background: "#fff", color: "#0f1f35", maxWidth: 180 }}>
                    <option value="">No location</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <button onClick={() => { const h = [...hidden, device.id]; setHidden(h); saveConfig(assignments, h); }}
                    style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>
                </div>
              ))}
              <button onClick={() => saveConfig(assignments, hidden)}
                style={{ marginTop: 14, background: savedMsg ? "#10b981" : "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {savedMsg ? "Saved!" : "Save Assignments"}
              </button>
            </div>
          )}
          <button onClick={handleDisconnect} style={{ background: "none", color: "#ef4444", border: "none", fontSize: 12, cursor: "pointer", marginTop: 12, padding: 0, display: "block" }}>
            Disconnect Shelly Cloud
          </button>
        </div>
      )}
    </div>
  );
}


function SpSensorMini({ sensors, onNavigate, locId, uid }) {
  const user = { uid };
  const [spSensors, setSpSensors] = useState([]);
  const [latestReadings, setLatestReadings] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "integrations", "sensorpush"));
        if (!snap.exists() || snap.data().disconnected) return;
        const { sensors: sensorList, assignments, accessToken } = snap.data();
        if (!sensorList) return;
        const assigned = sensorList.filter(s => assignments?.[s.id] === locId);
        setSpSensors(assigned);
        if (!accessToken || !assigned.length) return;
        const tokenRes = await fetch("https://api.sensorpush.com/api/v1/oauth/accesstoken", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorization: accessToken })
        });
        const tokenData = await tokenRes.json();
        const token = tokenData.accesstoken || accessToken;
        const sampRes = await fetch("https://api.sensorpush.com/api/v1/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": token },
          body: JSON.stringify({ sensors: assigned.map(s => s.id), limit: 1 })
        });
        const sampData = await sampRes.json();
        const readings = {};
        assigned.forEach(sp => {
          const latest = sampData.sensors?.[sp.id]?.[0];
          if (latest) readings[sp.id] = {
            temp: latest.temperature != null ? Math.round(latest.temperature * 10) / 10 : null,
            hum: latest.humidity != null ? Math.round(latest.humidity * 10) / 10 : null
          };
        });
        setLatestReadings(readings);
      } catch(e) {}
    };
    load();
  }, [locId, uid]);

  if (!spSensors.length) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>SensorPush</div>
      {spSensors.map(sp => {
        const reading = latestReadings[sp.id] || {};
        const temp = reading.temp;
        const hum = reading.hum;
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
const [sortedLocs, setSortedLocs] = useState([]);
const [locEquipment, setLocEquipment] = useState({});

useEffect(() => {
  if (!locations.length) return;
  locations.forEach(loc => {
    getDocs(collection(db, "locations", loc.id, "equipment")).then(snap => {
      const eqs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.tracksCarCount && e.emailCode);
      if (eqs.length) setLocEquipment(p => ({ ...p, [loc.id]: eqs }));
    });
  });
}, [locations.length]);
useEffect(() => {
  setSortedLocs([...locations].sort((a, b) => (a.order || 0) - (b.order || 0)));
}, [locations]);
const moveLocation = async (idx, dir) => {
  const updated = [...sortedLocs];
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= updated.length) return;
  [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
  setSortedLocs(updated);
  for (let i = 0; i < updated.length; i++) {
    await updateDoc(doc(db, "locations", updated[i].id), { order: i });
  }
};
const [profileName, setProfileName] = useState(user?.name || user?.email?.split("@")[0] || "");
const [profileSaved, setProfileSaved] = useState(false);
const [newEmail, setNewEmail] = useState("");
const [emailMsg, setEmailMsg] = useState("");
const [emailSaving, setEmailSaving] = useState(false);

const handleSaveEmail = async () => {
  if (!newEmail.trim() || !newEmail.includes("@")) return;
  setEmailSaving(true);
  try {
    await updateDoc(doc(db, "users", user.uid), { email: newEmail.trim() });
    await refreshUser();
    setEmailMsg("Notification email updated! Login email unchanged.");
    setNewEmail("");
  } catch(e) {
    setEmailMsg("Error: " + e.message);
  }
  setEmailSaving(false);
  setTimeout(() => setEmailMsg(""), 4000);
};

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
const ownerId = user.isTeamMember ? user.ownerId : user.uid;
await setDoc(doc(db, "locations", newId), { id: newId, name, address, zipCode, ownerId });
if (user.isTeamMember) {
  const newAllowed = [...(user.allowedLocations || []), newId];
  await updateDoc(doc(db, "users", user.uid), { allowedLocations: newAllowed });
}
} else {
await onUpdateLocation(locId, { name, address, zipCode });
}
setEditing(null);
setSaved(true);
setTimeout(() => setSaved(false), 2000);
};

const inp = { width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 6, background: "#fafafa", color: "#0f1f35" };

return (
<div>
<div style={{ marginBottom: 22 }}>
<div style={{ fontSize: 20, fontWeight: 700, color: "#0f1f35" }}>Settings</div>
<div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>Manage locations and preferences</div>
</div>
<div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 18 }}>
  <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 16 }}>Your Profile</div>
  <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Display Name</label>
    <input value={profileName} onChange={e => setProfileName(e.target.value)}
      style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 6, background: "#fafafa", color: "#0f1f35" }}
      placeholder="Your name" />
  </div>
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Email</label>
    <div style={{ padding: "9px 12px", background: "#f1f5f9", borderRadius: 8, fontSize: 13, color: "#64748b", marginTop: 6 }}>{user?.email}</div>
  </div>
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Update Email</label>
    <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@email.com" type="email"
      style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 6, background: "#fafafa", color: "#0f1f35" }} />
    {emailMsg && <div style={{ fontSize: 12, color: emailMsg.includes("Error") ? "#dc2626" : "#059669", marginTop: 6 }}>{emailMsg}</div>}
    <button onClick={handleSaveEmail} disabled={emailSaving || !newEmail}
      style={{ marginTop: 8, background: newEmail ? "#0ea5e9" : "#e2e8f0", color: newEmail ? "#fff" : "#94a3b8", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: newEmail ? "pointer" : "not-allowed" }}>
      {emailSaving ? "Updating..." : "Update Email"}
    </button>
  </div>
  <button onClick={handleSaveProfile} style={{ background: profileSaved ? "#10b981" : "#0f1f35", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
    {profileSaved ? "Saved!" : "Save Profile"}
  </button>
</div>
{(user?.role === "manager" || user?.role === "owner") && <TeamMembers user={user} locations={locations} />}
{saved && (
<div style={{ background: "#d1fae5", color: "#065f46", padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
Changes saved!
</div>
)}
<div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 18 }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
<div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>Locations</div>
<button onClick={() => setEditing("**new**")} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Add Location</button>
</div>
{sortedLocs.map((loc, idx) => (
<div key={loc.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
<div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginBottom: 4 }}>
  <button onClick={() => moveLocation(idx, -1)} disabled={idx === 0} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "2px 8px", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#d1d5db" : "#64748b", fontSize: 12 }}>↑</button>
  <button onClick={() => moveLocation(idx, 1)} disabled={idx === sortedLocs.length - 1} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "2px 8px", cursor: idx === sortedLocs.length - 1 ? "default" : "pointer", color: idx === sortedLocs.length - 1 ? "#d1d5db" : "#64748b", fontSize: 12 }}>↓</button>
</div>
{editing === loc.id ? (
<div>
<div style={{ marginBottom: 12 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Location Name</label>
<input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="e.g. North Station" />
</div>
<div style={{ marginBottom: 12 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Address</label>
<input value={address} onChange={e => setAddress(e.target.value)} style={inp} placeholder="e.g. 1240 N. Highway Blvd" />
</div>
<div style={{ marginBottom: 14 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Zip Code (for weather)</label>
<input value={zipCode} onChange={e => setZipCode(e.target.value)} style={inp} placeholder="e.g. 90210" maxLength={5} />
</div>
<div style={{ display: "flex", gap: 8 }}>
<button onClick={() => handleSave(loc.id)} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
<button onClick={() => setEditing(null)} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
</div>
</div>
) : (
<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
<div style={{ flex: 1 }}>
<div style={{ fontWeight: 600, fontSize: 14, color: "#0f1f35" }}>{loc.name}</div>
<div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{loc.address || "No address set"}</div>

{(locEquipment[loc.id] || []).map(eq => (
  <div key={eq.id} style={{ fontSize: 11, color: "#6366f1", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
    <span>{eq.name} email: <b>{eq.emailCode}@washlevel.com</b></span>
    <button onClick={() => navigator.clipboard.writeText(eq.emailCode + "@washlevel.com")}
      style={{ background: "#ede9fe", color: "#6366f1", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Copy</button>
  </div>
))}
</div>
<div style={{ display: "flex", gap: 8 }}>
  <button onClick={() => startEdit(loc)} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit</button>
  {user?.role === "owner" && locations.length > 1 && (
    <button onClick={async () => {
      if (!window.confirm("Delete " + loc.name + "? This cannot be undone.")) return;
      await deleteDoc(doc(db, "locations", loc.id));
    }} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Delete</button>
  )}
</div>
</div>
)}
</div>
))}
{editing === "**new**" && (
<div style={{ border: "1.5px dashed #6366f1", borderRadius: 10, padding: 16, marginBottom: 12, background: "#f5f3ff" }}>
<div style={{ fontWeight: 600, fontSize: 13, color: "#6366f1", marginBottom: 12 }}>New Location</div>
<div style={{ marginBottom: 12 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Location Name</label>
<input value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 4, background: "#fff", color: "#0f1f35" }} placeholder="e.g. East Side Wash" />
</div>
<div style={{ marginBottom: 12 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Address</label>
<input value={address} onChange={e => setAddress(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 4, background: "#fff", color: "#0f1f35" }} placeholder="e.g. 999 Main St" />
</div>
<div style={{ marginBottom: 14 }}>
<label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Zip Code (for weather)</label>
<input value={zipCode} onChange={e => setZipCode(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 4, background: "#fff", color: "#0f1f35" }} placeholder="e.g. 90210" maxLength={5} />
</div>
<div style={{ display: "flex", gap: 8 }}>
<button onClick={() => handleSave("**new**")} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Create</button>
<button onClick={() => setEditing(null)} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
</div>
</div>
)}
</div>
<div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 18 }}>
<div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 16 }}>Integrations</div>
<SensorPushIntegration locations={locations} />
            <ShellyIntegration locations={locations} />
</div>

</div>
);
}

function CarCounts({ locations }) {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [counts, setCounts] = useState({});
  const [eqCounts, setEqCounts] = useState({});
  const [saved, setSaved] = useState({});
  const [saving, setSaving] = useState({});
  const [loaded, setLoaded] = useState({});
  const [locEquipment, setLocEquipment] = useState({});
  const [activeTab, setActiveTab] = useState("daily");
  const [monthlyData, setMonthlyData] = useState({});
  const [yearlyData, setYearlyData] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));
  const [monthlyLoaded, setMonthlyLoaded] = useState(false);
  const [yearlyLoaded, setYearlyLoaded] = useState(false);

  useEffect(() => {
    if (!locations.length || !selectedDate) return;
    setLoaded({});
    locations.forEach(async loc => {
      const [eqSnap, daySnap] = await Promise.all([
        getDocs(collection(db, "locations", loc.id, "equipment")),
        getDoc(doc(db, "locations", loc.id, "daySummaries", selectedDate)),
      ]);
      const eqs = eqSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.tracksCarCount);
      if (eqs.length) setLocEquipment(p => ({ ...p, [loc.id]: eqs }));

      const data = daySnap.exists() ? daySnap.data() : {};
      const cars = data.carsWashed ?? "";
      setCounts(p => ({ ...p, [loc.id]: cars === 0 ? "0" : cars || "" }));

      const eqData = data.equipment || {};
      const hasEqData = Object.keys(eqData).length > 0;
      if (hasEqData) {
        Object.entries(eqData).forEach(([eqId, d]) => {
          setEqCounts(p => ({ ...p, [loc.id + "_" + eqId]: d.carsWashed ?? "" }));
        });
      }
      if (!hasEqData && eqs.length === 1 && cars !== "") {
        // Location total set (e.g. from email) but no per-equipment breakdown — assign to the single tracking piece
        setEqCounts(p => ({ ...p, [loc.id + "_" + eqs[0].id]: parseInt(cars) || 0 }));
      }

      setLoaded(p => ({ ...p, [loc.id]: true }));
    });
  }, [selectedDate, locations.length]);


  useEffect(() => {
    if (activeTab !== "monthly" || !locations.length || !selectedMonth) return;
    setMonthlyLoaded(false);
    const loadMonthly = async () => {
      const [year, month] = selectedMonth.split("-");
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
      const result = {};
      for (const loc of locations) {
        const snaps = await getDocs(collection(db, "locations", loc.id, "daySummaries"));
        const dataMap = {};
        const eqMap = {};
        snaps.docs.forEach(d => { dataMap[d.id] = d.data().carsWashed || 0; const eq = d.data().equipment || {}; Object.entries(eq).forEach(([eqId, v]) => { eqMap[eqId] = eqMap[eqId] || {}; eqMap[eqId][d.id] = v.carsWashed || 0; }); });
        const days = [];
        let total = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const ds = year + "-" + month + "-" + String(d).padStart(2, "0");
          const cars = dataMap[ds] || 0;
          days.push({ date: ds, cars });
          total += cars;
        }
        result[loc.id] = { total, days, eqMap };
      }
      setMonthlyData(result);
      setMonthlyLoaded(true);
    };
    loadMonthly();
  }, [activeTab, selectedMonth, locations.length]);

  useEffect(() => {
    if (activeTab !== "yearly" || !locations.length || !selectedYear || yearlyLoaded) return;
    setYearlyLoaded(false);
    const loadYearly = async () => {
      const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const result = {};
      for (const loc of locations) {
        const snaps = await getDocs(collection(db, "locations", loc.id, "daySummaries"));
        const dataMap = {};
        snaps.docs.forEach(d => { dataMap[d.id] = d.data().carsWashed || 0; });
        const eqMapY = {};
        snaps.docs.forEach(d => { dataMap[d.id] = d.data().carsWashed || 0; const eq = d.data().equipment || {}; Object.entries(eq).forEach(([eqId, v]) => { eqMapY[eqId] = eqMapY[eqId] || {}; eqMapY[eqId][d.id] = v.carsWashed || 0; }); });
        const months = [];
        let yearTotal = 0;
        for (let m = 1; m <= 12; m++) {
          const ms = selectedYear + "-" + String(m).padStart(2, "0");
          const dim = new Date(parseInt(selectedYear), m, 0).getDate();
          let mt = 0;
          for (let d = 1; d <= dim; d++) {
            mt += dataMap[ms + "-" + String(d).padStart(2, "0")] || 0;
          }
          months.push({ month: ms, label: mn[m-1], cars: mt });
          yearTotal += mt;
        }
        result[loc.id] = { total: yearTotal, months, eqMap: eqMapY };
      }
      setYearlyData(result);
      setYearlyLoaded(true);
    };
    loadYearly();
  }, [activeTab, selectedYear, locations.length]);


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

  const handleSaveEq = async (locId, eqId) => {
    const key = locId + "_" + eqId;
    const val = parseInt(eqCounts[key]) || 0;
    setSaving(p => ({ ...p, [key]: true }));

    // Write equipment-specific count.
    // setDoc with dotted string keys creates literal field names, not nested paths — use updateDoc
    // (which interprets dotted keys as nested paths) so data.equipment[eqId] reads correctly.
    const summaryRef = doc(db, "locations", locId, "daySummaries", selectedDate);
    const summarySnap = await getDoc(summaryRef);
    if (summarySnap.exists()) {
      await updateDoc(summaryRef, {
        [`equipment.${eqId}.carsWashed`]: val,
        [`equipment.${eqId}.date`]: selectedDate,
        [`equipment.${eqId}.updatedAt`]: new Date().toISOString(),
        date: selectedDate, updatedAt: new Date().toISOString(),
      });
    } else {
      await setDoc(summaryRef, {
        equipment: { [eqId]: { carsWashed: val, date: selectedDate, updatedAt: new Date().toISOString() } },
        date: selectedDate, updatedAt: new Date().toISOString(),
      });
    }

    // Recalculate location total from all equipment counts
    const snap = await getDoc(doc(db, "locations", locId, "daySummaries", selectedDate));
    const eqData = snap.exists() ? (snap.data().equipment || {}) : {};
    const locTotal = Object.values(eqData).reduce((sum, e) => sum + (e.carsWashed || 0), 0);
    await setDoc(doc(db, "locations", locId, "daySummaries", selectedDate), {
      carsWashed: locTotal, updatedAt: new Date().toISOString(),
    }, { merge: true });
    setCounts(p => ({ ...p, [locId]: locTotal }));

    // Update equipment lifetime car count
    const eqRef = doc(db, "locations", locId, "equipment", eqId);
    const eqDoc = await getDoc(eqRef);
    if (eqDoc.exists()) {
      const eqData = eqDoc.data();
      // Get previous day's count for this equipment to calculate delta
      const prevDaySnap = await getDoc(doc(db, "locations", locId, "daySummaries", selectedDate));
      const prevVal = prevDaySnap.exists() ? (prevDaySnap.data().equipment?.[eqId]?.carsWashed || 0) : 0;
      const delta = val - prevVal;
      const newCarsCount = Math.max(0, (eqData.carsCount || 0) + delta);
      await updateDoc(eqRef, { carsCount: newCarsCount, updatedAt: new Date().toISOString() });

      // Check if any car-recurrence tasks for this equipment are now due
      const tasksSnap = await getDocs(collection(db, "locations", locId, "tasks"));
      const allCarTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(t => t.equipmentId === eqId && t.nextCarsDue && t.status !== "done");

      // Load owner alert prefs
      const ownerId = user?.isTeamMember ? user?.ownerId : user?.uid;
      const prefsSnap = await getDoc(doc(db, "users", ownerId, "prefs", "alerts"));
      const alertPrefs = prefsSnap.exists() ? prefsSnap.data() : {};

      for (const t of allCarTasks) {
        const carsRemaining = t.nextCarsDue - newCarsCount;

        if (newCarsCount >= t.nextCarsDue) {
          await updateDoc(doc(db, "locations", locId, "tasks", t.id), {
            due: new Date().toISOString().split("T")[0],
            updatedAt: new Date().toISOString(),
          });
          // Notify if enabled
          if (alertPrefs.carRecurrenceDueAlert !== false) {
            try {
              await writeNotif(ownerId, { type: "car_recurrence_due", title: "Task Due: " + t.title, body: eqDoc.data().name + " has reached " + newCarsCount.toLocaleString() + " cars. " + t.title + " is now due.", locationId: locId, taskId: t.id });
            } catch(e) {}
          }
        }

        // Warning notification
        const warningThreshold = alertPrefs.carRecurrenceWarningCars || 300;
        if (alertPrefs.carRecurrenceWarningAlert && carsRemaining > 0 && carsRemaining <= warningThreshold) {
          try {
            await writeNotif(ownerId, { type: "car_recurrence_warning", title: "Upcoming: " + t.title, body: eqDoc.data().name + " is " + carsRemaining.toLocaleString() + " cars away from " + t.title + ".", locationId: locId, taskId: t.id });
          } catch(e) {}
        }
      }
    }

    setSaving(p => ({ ...p, [key]: false }));
    setSaved(p => ({ ...p, [key]: true }));
    setTimeout(() => setSaved(p => ({ ...p, [key]: false })), 2000);
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
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f1f35" }}>Car Counts</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>Log daily car counts per location</div>
      </div>
      <div style={{ display: "flex", background: "#f8fafc", borderRadius: "10px 10px 0 0", borderBottom: "1px solid #e5e7eb", marginBottom: 18, overflow: "hidden" }}>
        {["daily", "monthly", "yearly"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
              background: activeTab === tab ? "#fff" : "#f8fafc",
              color: activeTab === tab ? "#0f1f35" : "#94a3b8",
              borderBottom: activeTab === tab ? "2px solid #1a3352" : "2px solid transparent",
              textTransform: "capitalize" }}>
            {tab}
          </button>
        ))}
      </div>
      <div style={{ display: activeTab === "daily" ? "block" : "none" }}>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => goDay(-1)} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 16, cursor: "pointer", color: "#334155", fontWeight: 700 }}>{"<"}</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>{displayDate}</div>
          {isToday && <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600, marginTop: 2 }}>Today</div>}
        </div>
        <button onClick={() => goDay(1)} disabled={isToday} style={{ background: isToday ? "#f8fafc" : "#f1f5f9", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 16, cursor: isToday ? "not-allowed" : "pointer", color: isToday ? "#d1d5db" : "#334155", fontWeight: 700 }}>{">"}</button>
      </div>
      <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Jump to date:</label>
        <input type="date" value={selectedDate} max={today} onChange={e => e.target.value && setSelectedDate(e.target.value)}
          style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", color: "#0f1f35", background: "#fff" }} />
        {!isToday && <button onClick={() => setSelectedDate(today)} style={{ background: "#f1f5f9", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#334155" }}>Today</button>}
      </div>
      <div style={{ background: "linear-gradient(135deg, #1a3352, #0ea5e9)", borderRadius: 12, padding: "14px 20px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>Total Cars</div>
        <div style={{ color: "#fff", fontSize: 28, fontWeight: 800 }}>{totalCars}</div>
      </div>
      {locations.map(loc => {
        const eqs = locEquipment[loc.id] || [];
        const hasEq = eqs.length > 0;
        return (
          <div key={loc.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>{loc.name}</div>
              {saved[loc.id] && <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>Saved!</span>}
            </div>

            {hasEq ? (
              // Per-equipment count inputs
              <>
                {eqs.map(eq => {
                  const key = loc.id + "_" + eq.id;
                  return (
                    <div key={eq.id} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>{eq.name}</div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <button onClick={() => setEqCounts(p => ({ ...p, [key]: Math.max(0, (parseInt(p[key]) || 0) - 1) }))}
                          style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 40, height: 40, fontSize: 20, cursor: "pointer", color: "#334155", fontWeight: 700 }}>-</button>
                        <input type="text" inputMode="numeric" pattern="[0-9]*"
                          value={loaded[loc.id] ? (eqCounts[key] ?? "") : ""}
                          placeholder={loaded[loc.id] ? "0" : "..."}
                          onChange={e => setEqCounts(p => ({ ...p, [key]: e.target.value.replace(/[^0-9]/g, "") }))}
                          style={{ flex: 1, minWidth: 0, padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 22, fontWeight: 700, textAlign: "center", outline: "none", color: "#0f1f35", background: "#fafafa", boxSizing: "border-box" }} />
                        <button onClick={() => setEqCounts(p => ({ ...p, [key]: (parseInt(p[key]) || 0) + 1 }))}
                          style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 40, height: 40, fontSize: 20, cursor: "pointer", color: "#334155", fontWeight: 700 }}>+</button>
                      </div>
                      <button onClick={() => handleSaveEq(loc.id, eq.id)} disabled={saving[key]}
                        style={{ width: "100%", marginTop: 8, background: saved[key] ? "#10b981" : "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {saving[key] ? "Saving..." : saved[key] ? "Saved!" : "Save " + eq.name + " Count"}
                      </button>
                    </div>
                  );
                })}
                <div style={{ marginTop: 8, padding: "10px 14px", background: "#f4f6f8", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 15, color: "#0f1f35", fontWeight: 700 }}>Location Total</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#0f1f35" }}>{counts[loc.id] || 0}</span>
                </div>
              </>
            ) : (
              // Single location count input (existing behavior)
              <>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={() => setCounts(p => ({ ...p, [loc.id]: Math.max(0, (parseInt(p[loc.id]) || 0) - 1) }))}
                    style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 40, height: 40, fontSize: 20, cursor: "pointer", color: "#334155", fontWeight: 700 }}>-</button>
                  <input type="text" inputMode="numeric" pattern="[0-9]*"
                    value={loaded[loc.id] ? (counts[loc.id] ?? "") : ""}
                    placeholder={loaded[loc.id] ? "0" : "..."}
                    onChange={e => setCounts(p => ({ ...p, [loc.id]: e.target.value.replace(/[^0-9]/g, "") }))}
                    style={{ flex: 1, minWidth: 0, padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 22, fontWeight: 700, textAlign: "center", outline: "none", color: "#0f1f35", background: "#fafafa", boxSizing: "border-box" }} />
                  <button onClick={() => setCounts(p => ({ ...p, [loc.id]: (parseInt(p[loc.id]) || 0) + 1 }))}
                    style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 40, height: 40, fontSize: 20, cursor: "pointer", color: "#334155", fontWeight: 700 }}>+</button>
                </div>
                <button onClick={() => handleSave(loc.id)} disabled={saving[loc.id]}
                  style={{ width: "100%", marginTop: 12, background: saved[loc.id] ? "#10b981" : "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  {saving[loc.id] ? "Saving..." : saved[loc.id] ? "Saved!" : "Save Count"}
                </button>
              </>
            )}
          </div>
        );
      })}
      </div>
      {/* Monthly View */}
      {activeTab === "monthly" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Month:</label>
            <input type="month" value={selectedMonth} max={today.slice(0, 7)}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", color: "#0f1f35", background: "#fff" }} />
          </div>
          {!monthlyLoaded ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading...</div>
          ) : (
            <div>
              <div style={{ background: "linear-gradient(135deg, #1a3352, #0ea5e9)", borderRadius: 12, padding: "14px 20px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>Monthly Total</div>
                <div style={{ color: "#fff", fontSize: 28, fontWeight: 800 }}>{Object.values(monthlyData).reduce((s, l) => s + (l.total || 0), 0).toLocaleString()}</div>
              </div>
              {locations.map(loc => {
                const d = monthlyData[loc.id];
                if (!d) return null;
                return (
                  <div key={loc.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>{loc.name}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#0f1f35" }}>{d.total.toLocaleString()}</div>
                    </div>
                    {locEquipment[loc.id] && locEquipment[loc.id].length > 1 ? (
                      // Multiple equipment - show one calendar per equipment
                      locEquipment[loc.id].map(eq => {
                        const eqDays = d.days.map(day => ({ ...day, cars: (d.eqMap[eq.id] || {})[day.date] || 0 }));
                        return (
                          <div key={eq.id} style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>{eq.name}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))", gap: 6 }}>
                              {eqDays.map(day => (
                                <div key={day.date} style={{ background: day.cars > 0 ? "#f0f9ff" : "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(day.date + "T12:00:00").getDate()}</div>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: day.cars > 0 ? "#0f1f35" : "#d1d5db" }}>{day.cars > 0 ? day.cars : "-"}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      // Single equipment or no equipment - show location total calendar
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))", gap: 6 }}>
                        {d.days.map(day => (
                          <div key={day.date} style={{ background: day.cars > 0 ? "#f0f9ff" : "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(day.date + "T12:00:00").getDate()}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: day.cars > 0 ? "#0f1f35" : "#d1d5db" }}>{day.cars > 0 ? day.cars : "-"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Yearly View */}
      {activeTab === "yearly" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Year:</label>
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
              style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", color: "#0f1f35", background: "#fff" }}>
              {[today.slice(0, 4), String(parseInt(today.slice(0, 4)) - 1), String(parseInt(today.slice(0, 4)) - 2)].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {!yearlyLoaded ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading...</div>
          ) : (
            <div>
              <div style={{ background: "linear-gradient(135deg, #1a3352, #0ea5e9)", borderRadius: 12, padding: "14px 20px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>Yearly Total</div>
                <div style={{ color: "#fff", fontSize: 28, fontWeight: 800 }}>{Object.values(yearlyData).reduce((s, l) => s + (l.total || 0), 0).toLocaleString()}</div>
              </div>
              {locations.map(loc => {
                const d = yearlyData[loc.id];
                if (!d) return null;
                return (
                  <div key={loc.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>{loc.name}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#0f1f35" }}>{d.total.toLocaleString()}</div>
                    </div>
                    {locEquipment[loc.id] && locEquipment[loc.id].length > 1 ? (
                      locEquipment[loc.id].map(eq => {
                        const eqMonths = d.months.map(m => ({
                          ...m,
                          cars: Object.entries(d.eqMap[eq.id] || {}).filter(([k]) => k.startsWith(m.month)).reduce((s, [, v]) => s + v, 0)
                        }));
                        return (
                          <div key={eq.id} style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>{eq.name}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                              {eqMonths.map(m => (
                                <div key={m.month} style={{ background: m.cars > 0 ? "#f0f9ff" : "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{m.label}</div>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: m.cars > 0 ? "#0f1f35" : "#d1d5db", marginTop: 4 }}>{m.cars > 0 ? m.cars.toLocaleString() : "-"}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                        {d.months.map(m => (
                          <div key={m.month} style={{ background: m.cars > 0 ? "#f0f9ff" : "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{m.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: m.cars > 0 ? "#0f1f35" : "#d1d5db", marginTop: 4 }}>{m.cars > 0 ? m.cars.toLocaleString() : "-"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function TeamMembers({ user, locations }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [editingMember, setEditingMember] = useState(null);
  const [editLocs, setEditLocs] = useState([]);
  const [editRole, setEditRole] = useState("attendant");
  const [editPayrollAccess, setEditPayrollAccess] = useState(false);
  const [editCarCountAccess, setEditCarCountAccess] = useState(false);
  const [editSensorAccess, setEditSensorAccess] = useState(false);
  const [editInventoryAccess, setEditInventoryAccess] = useState(false);
  const [editEquipmentAccess, setEditEquipmentAccess] = useState(false);
  const [editCanViewTeam, setEditCanViewTeam] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
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
        const memSnap = await getDocs(query(collection(db, "users"), where("ownerId", "==", user.uid)));

        setMembers(memSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
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
        allowedLocations: inviteLocs, status: "pending", bizName: user.bizName || user.name || "", createdAt: new Date().toISOString()
      });
      // Also send invite email automatically
      try {
        const sendInvite = httpsCallable(functions, "sendInviteEmail");
        const biz = user.bizName || user.name || "WashLevel";
        const mgr = user.name || user.email || "Your Manager";
        await sendInvite({ 
          inviteEmail: inviteEmail.toLowerCase(), inviteRole: inviteRole || "attendant", bizName: biz, managerName: mgr, ownerId: user.uid, inviteRole: inviteRole || "attendant" });
      } catch(e) { console.log("Email send error:", e.message); }
      setSent(true); setInviteEmail(""); setInviteLocs([]);
      setTimeout(() => setSent(false), 3000);
    } catch(e) { setError("Failed to send invite."); }
    setSending(false);
  };

  const handleRemove = async (uid, name) => {
    if (!window.confirm("Remove " + name + " from your team? They will lose access immediately.")) return;
    await updateDoc(doc(db, "users", uid), { 
      ownerId: null, 
      isTeamMember: false,
      allowedLocations: [],
      role: "attendant",
      removedAt: new Date().toISOString()
    });
    setMembers(p => p.filter(m => m.uid !== uid));
  };

  const toggleLoc = (locId) => setInviteLocs(p => p.includes(locId) ? p.filter(l => l !== locId) : [...p, locId]);
  const inp = { width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 6, background: "#fafafa", color: "#0f1f35" };

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 4 }}>Team Members</div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Invite staff to access your dashboard</div>
      {editingMember && (
        <div style={{ background: "#f0f9ff", border: "2px solid #0ea5e9", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0369a1", marginBottom: 12 }}>Edit Access — {editingMember.name || editingMember.email}</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Role</label>
            <select value={editRole} onChange={e => setEditRole(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", background: "#fff", color: "#0f1f35", marginTop: 6 }}>
              <option value="attendant">Attendant — Limited access</option>
              <option value="technician">Technician — Equipment & tasks</option>
              {user?.role === "owner" && <option value="manager">Manager — Full access</option>}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Location Access</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button onClick={() => setEditLocs(locations.map(l => l.id))}
                style={{ fontSize: 11, background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>All</button>
              <button onClick={() => setEditLocs([])}
                style={{ fontSize: 11, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>None</button>
            </div>
            {locations.map(l => (
              <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={editLocs.includes(l.id)}
                  onChange={() => setEditLocs(p => p.includes(l.id) ? p.filter(x => x !== l.id) : [...p, l.id])}
                  style={{ width: 15, height: 15, accentColor: "#0f1f35" }} />
                <span style={{ fontSize: 13, color: "#334155" }}>{l.name}</span>
              </label>
            ))}
          </div>
          {(editRole === "manager" && user?.role === "owner") && (
            <>
            <div style={{ marginBottom: 14, padding: "12px 14px", background: "#f4f6f8", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>Payroll Access</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Allow this manager to view and manage payroll</div>
                </div>
                <div onClick={() => setEditPayrollAccess(p => !p)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: editPayrollAccess ? "#0f1f35" : "#e2e8f0", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: editPayrollAccess ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 14, padding: "12px 14px", background: "#f4f6f8", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>Team Access</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Allow this manager to view the Team tab in Time Clock</div>
                </div>
                <div onClick={() => setEditCanViewTeam(p => !p)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: editCanViewTeam ? "#0f1f35" : "#e2e8f0", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: editCanViewTeam ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
              </div>
            </div>
            </>
          )}
          {editRole !== "manager" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 8 }}>Section Access</div>
              {[
                { state: editCarCountAccess, set: setEditCarCountAccess, label: "Car Counts", desc: "View car count data and reports" },
                { state: editSensorAccess, set: setEditSensorAccess, label: "Sensors", desc: "View pressure and chemical sensors" },
                { state: editInventoryAccess, set: setEditInventoryAccess, label: "Inventory", desc: "View and manage inventory" },
                { state: editEquipmentAccess, set: setEditEquipmentAccess, label: "Equipment", desc: "View and manage equipment" },
              ].map(({ state, set, label, desc }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f4f6f8", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{label}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{desc}</div>
                  </div>
                  <div onClick={() => set(p => !p)}
                    style={{ width: 44, height: 24, borderRadius: 12, background: state ? "#0f1f35" : "#e2e8f0", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                    <div style={{ position: "absolute", top: 2, left: state ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={async () => {
              setSavingEdit(true);
              const payrollAccess = editRole === "manager" ? editPayrollAccess : false;
              const canViewTeam = editRole === "manager" ? editCanViewTeam : false;
              const carCountAccess = editRole === "manager" ? true : editCarCountAccess;
              const sensorAccess = editRole === "manager" ? true : editSensorAccess;
              const inventoryAccess = editRole === "manager" ? true : editInventoryAccess;
              const equipmentAccess = editRole === "manager" ? true : editEquipmentAccess;
              try {
                await updateDoc(doc(db, "users", editingMember.uid), { allowedLocations: editLocs, role: editRole, payrollAccess, canViewTeam, carCountAccess, sensorAccess, inventoryAccess, equipmentAccess, updatedAt: new Date().toISOString() });
                setEditingMember(null);
                setMembers(p => p.map(m => m.uid === editingMember.uid ? { ...m, allowedLocations: editLocs, role: editRole, payrollAccess, canViewTeam, carCountAccess, sensorAccess, inventoryAccess, equipmentAccess } : m));
              } catch(e) { alert("Save error: " + e.message); }
              setSavingEdit(false);
            }} disabled={savingEdit}
              style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={() => setEditingMember(null)}
              style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
      {members.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 8 }}>Active Members</div>
          {members.map(m => (
            <div key={m.uid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{m.name || m.email}</div>
                  {m.role === "owner" && <span style={{ fontSize: 10, fontWeight: 700, background: "#0f1f35", color: "#fff", borderRadius: 4, padding: "1px 6px" }}>OWNER</span>}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {m.email} — <span style={{ textTransform: "capitalize" }}>{m.role}</span>
                  {m.payrollAccess ? " · Payroll access" : ""}
                </div>
              </div>
              {m.role !== "owner" && (
                <button onClick={() => handleRemove(m.uid, m.name || m.email)} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Remove</button>
              )}
              {m.role !== "owner" && (
                <button onClick={() => { setEditingMember(m); setEditLocs(m.allowedLocations || []); setEditRole(m.role || "attendant"); setEditPayrollAccess(m.payrollAccess || false);
        setEditCanViewTeam(m.canViewTeam || false); setEditCarCountAccess(m.carCountAccess || false); setEditSensorAccess(m.sensorAccess || false); setEditInventoryAccess(m.inventoryAccess || false); setEditEquipmentAccess(m.equipmentAccess || false); }}
                  style={{ background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit Access</button>
              )}
            </div>
          ))}
        </div>
      )}
      {invites.filter(i => i.status === "pending").length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 8 }}>Pending Invites</div>
          {invites.filter(i => i.status === "pending").map(inv => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#fffbeb", borderRadius: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{inv.email}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{inv.role} — Pending</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => {
                  const msg = "You have been invited to join " + (user.bizName || "our team") + " on WashLevel. Create your account at https://washlevel.com using this email address: " + inv.email;
                  navigator.clipboard.writeText(msg);
                }} style={{ background: "#f0f9ff", color: "#0369a1", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Copy</button>
                <button onClick={async () => {
                  try {
                    const sendInvite = httpsCallable(functions, "sendInviteEmail");
                    await sendInvite({ inviteEmail: inv.email, inviteRole: inv.role, bizName: user.bizName || user.name, managerName: user.name, ownerId: user.uid });
                    alert("Invite email sent to " + inv.email);
                  } catch(e) { alert("Could not send email: " + e.message); }
                }} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Send Email</button>
                <button onClick={async () => {
                  if (!window.confirm("Delete this invite?")) return;
                  await deleteDoc(doc(db, "invites", inv.id));
                }} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 10 }}>Send Invite</div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Email Address</label>
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} type="email" placeholder="staff@email.com" style={inp} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Role</label>
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...inp, marginTop: 6 }}>
            <option value="attendant">Attendant - Limited access</option>
            <option value="technician">Technician - Equipment access</option>
            {user?.role === "owner" && <option value="manager">Manager - Full access</option>}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Location Access</label>
          {locations.map(l => (
            <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={inviteLocs.includes(l.id)} onChange={() => toggleLoc(l.id)} style={{ width: 15, height: 15, accentColor: "#0f1f35" }} />
              <span style={{ fontSize: 13, color: "#334155" }}>{l.name}</span>
            </label>
          ))}
        </div>
        {error && <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {sent && <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 10 }}>Invite saved! Have them create an account at WashLevel.com with this email.</div>}
        <button onClick={handleInvite} disabled={sending} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}>
          {sending ? "Saving..." : "Send Invite"}
        </button>
      </div>
    </div>
  );
}

function SetupWizard({ user, logout }) {
  const [step, setStep] = useState(1);
  const [bizName, setBizName] = useState("");
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!bizName.trim()) return;
    setSaving(true);
    const locId = "loc_" + Date.now();
    await setDoc(doc(db, "locations", locId), {
      id: locId, name: bizName, address, zipCode,
      ownerId: user.uid, createdAt: new Date().toISOString()
    });
    await updateDoc(doc(db, "users", user.uid), { locationId: locId, setupComplete: true });
    setSaving(false);
    setStep(3);
  };

  const inp = { width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 9, fontSize: 14, outline: "none", boxSizing: "border-box", background: "#fff", color: "#0f1f35", marginTop: 6 };

  return (
    <div style={{ minHeight: "100dvh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#0f1f35", borderRadius: 14, padding: "10px 22px", marginBottom: 12 }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>WashLevel</span>
            <span style={{ background: "#0ea5e9", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "2px 6px" }}>PRO</span>
          </div>
          {/* Step indicator */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
            {[1,2,3].map(s => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: step >= s ? "#0f1f35" : "#e2e8f0", color: step >= s ? "#fff" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{s}</div>
                {s < 3 && <div style={{ width: 40, height: 2, background: step > s ? "#0f1f35" : "#e2e8f0" }} />}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: 32 }}>
          {step === 1 && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#0f1f35", marginBottom: 6 }}>Welcome, {user?.name?.split(" ")[0] || "there"}!</div>
              <div style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>Let's get your car wash set up. It only takes a minute.</div>
              <div style={{ background: "#f0f9ff", borderRadius: 10, padding: 16, marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", marginBottom: 8 }}>What you'll set up:</div>
                {["Your first wash location", "Dashboard overview", "Team & time clock"].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>
                    </div>
                    <span style={{ fontSize: 13, color: "#334155" }}>{item}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(2)} style={{ width: "100%", background: "#0f1f35", color: "#fff", border: "none", borderRadius: 10, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                Get Started
              </button>
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <span onClick={logout} style={{ fontSize: 12, color: "#94a3b8", cursor: "pointer", textDecoration: "underline" }}>Sign out</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#0f1f35", marginBottom: 6 }}>Your First Location</div>
              <div style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>You can add more locations later in Settings.</div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Car Wash Name *</label>
                <input value={bizName} onChange={e => setBizName(e.target.value)} placeholder="e.g. Sunny Car Wash - Main St" style={inp} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Address</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 123 Main Street" style={inp} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Zip Code <span style={{ color: "#94a3b8", fontWeight: 400 }}>(for weather data)</span></label>
                <input value={zipCode} onChange={e => setZipCode(e.target.value)} placeholder="e.g. 37201" maxLength={5} style={inp} />
              </div>
              <button onClick={handleCreate} disabled={!bizName.trim() || saving}
                style={{ width: "100%", background: bizName.trim() ? "#0f1f35" : "#e2e8f0", color: bizName.trim() ? "#fff" : "#94a3b8", border: "none", borderRadius: 10, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: bizName.trim() ? "pointer" : "not-allowed" }}>
                {saving ? "Setting up..." : "Create Location"}
              </button>
              <button onClick={() => setStep(1)} style={{ width: "100%", background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", marginTop: 10 }}>Back</button>
            </div>
          )}

          {step === 3 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#0f1f35", marginBottom: 8 }}>You're all set!</div>
              <div style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>Your dashboard is ready. Here are a few things to do next:</div>
              <div style={{ textAlign: "left", marginBottom: 24 }}>
                {[
                  { title: "Add your team", desc: "Invite staff in Settings → Team Members" },
                  { title: "Set up inventory", desc: "Track chemicals and supplies" },
                  { title: "Log car counts", desc: "Track daily wash numbers" },
                  { title: "Connect sensors", desc: "Link SensorPush in Settings → Integrations" },
                ].map(item => (
                  <div key={item.title} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => window.location.reload()} style={{ width: "100%", background: "#0f1f35", color: "#fff", border: "none", borderRadius: 10, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                Go to My Dashboard
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Owner-only danger zone */}
      {user?.role === "owner" && (
        <div style={{ background: "#fff", border: "1px solid #fca5a5", borderRadius: 16, padding: 20, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#dc2626", marginBottom: 4 }}>Danger Zone</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>These actions are irreversible. Only the account owner can perform them.</div>
          <button onClick={async () => {
            const confirmed = window.confirm("Are you sure you want to delete your entire WashLevel account? This will permanently delete all locations, tasks, equipment, and data. This cannot be undone.");
            if (!confirmed) return;
            const double = window.confirm("This is your final confirmation. Delete everything?");
            if (!double) return;
            try {
              // Delete all locations
              for (const loc of locations) {
                await deleteDoc(doc(db, "locations", loc.id));
              }
              // Delete user doc
              await deleteDoc(doc(db, "users", user.uid));
              alert("Account deleted. You will be signed out.");
              window.location.reload();
            } catch(e) { alert("Error: " + e.message); }
          }} style={{ background: "#fee2e2", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Delete Account
          </button>
        </div>
      )}

    </div>
  );
}

function AlertSettings({ locId, locations, user, setView, setLocId }) {
  const [prefs, setPrefs] = useState(null);
  const [notifTab, setNotifTab] = useState("inbox");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      query(collection(db, "users", user.uid, "notifications"), orderBy("createdAt", "desc")),
      snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [user?.uid]);

  const markRead = async (notifId) => {
    await updateDoc(doc(db, "users", user.uid, "notifications", notifId), { read: true });
  };

  const [chemSensors, setChemSensors] = useState([]);
  const [shellySensors, setShellySensors] = useState([]);
  const [spSensors, setSpSensors] = useState([]);
  const [spAlerts, setSpAlerts] = useState({});

  useEffect(() => {
    if (!locId || !user?.uid) return;
    const unsub1 = onSnapshot(collection(db, "locations", locId, "chemSensors"), snap => {
      setChemSensors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(collection(db, "locations", locId, "shellyDevices"), snap => {
      setShellySensors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    // Load SensorPush sensors from user integrations
    getDoc(doc(db, "users", user.uid, "integrations", "sensorpush")).then(snap => {
      if (snap.exists()) {
        const { sensors } = snap.data();
        if (sensors) setSpSensors(Object.values(sensors));
      }
    });
    // Load SensorPush alert thresholds
    getDoc(doc(db, "users", user.uid, "prefs", "sensorAlerts")).then(snap => {
      if (snap.exists()) setSpAlerts(snap.data());
    });
    return () => { unsub1(); unsub2(); };
  }, [locId, user?.uid]);

  const saveSpAlert = async (sensorId, field, value) => {
    const updated = { ...spAlerts, [sensorId]: { ...(spAlerts[sensorId] || {}), [field]: Number(value) } };
    setSpAlerts(updated);
    await setDoc(doc(db, "users", user.uid, "prefs", "sensorAlerts"), updated);
  };


  const defaults = {
    dailySummaryEnabled: false,
    dailySummaryTime: "07:00",
    summaryEmail: "",
    includeCounts: true,
    includeTasksDone: true,
    includeOpenTasks: true,
    includeTaskNames: true,
    includeOverdue: true,
    includeEquipment: true,
    overdueTasksAlert: true,
    lowInventoryAlert: true,
    equipmentAlert: true,
    newTaskAlert: false,
    sensorPushAlert: true,
    chemLevelAlert: true,
    shellyAlert: true,
    carRecurrenceDueAlert: true,
    carRecurrenceWarningAlert: false,
    carRecurrenceWarningCars: 300,
  };

  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid, "prefs", "alerts")).then(snap => {
      setPrefs(snap.exists() ? { ...defaults, ...snap.data() } : defaults);
    });
  }, [user?.uid]);

  const update = (key, val) => setPrefs(p => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    await setDoc(doc(db, "users", user.uid, "prefs", "alerts"), prefs);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!prefs) return <div style={{ padding: 40, color: "#94a3b8", textAlign: "center" }}>Loading...</div>;

  const Toggle = ({ k }) => (
    <div onClick={() => update(k, !prefs[k])}
      style={{ width: 44, height: 24, borderRadius: 12, background: prefs[k] ? "#0f1f35" : "#e2e8f0", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
      <div style={{ position: "absolute", top: 2, left: prefs[k] ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </div>
  );

  const Row = ({ label, desc, k }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <div style={{ flex: 1, marginRight: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f35" }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{desc}</div>}
      </div>
      <Toggle k={k} />
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f1f35", marginBottom: 12 }}>Notifications</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setNotifTab("inbox")} style={{ padding: "7px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: notifTab === "inbox" ? "#0f1f35" : "#f1f5f9", color: notifTab === "inbox" ? "#fff" : "#64748b" }}>Inbox {notifications.filter(n => !n.read).length > 0 ? "(" + notifications.filter(n => !n.read).length + ")" : ""}</button>
        <button onClick={() => setNotifTab("settings")} style={{ padding: "7px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: notifTab === "settings" ? "#0f1f35" : "#f1f5f9", color: notifTab === "settings" ? "#fff" : "#64748b" }}>Alert Settings</button>
      </div>
      <div style={{ display: notifTab === "inbox" ? "block" : "none" }}>
        {notifications.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#0f1f35", marginBottom: 4 }}>No notifications yet</div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>Task assignments and alerts will appear here</div>
          </div>
        ) : notifications.map(n => (
          <div key={n.id} style={{ background: n.read ? "#fff" : "#eff6ff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, marginBottom: 10, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ fontSize: 20 }}>📋</div>
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => {
              markRead(n.id);
              if (n.locationId) setLocId(n.locationId);
              if (n.view) setView(n.view);
              else if (n.type === "sensor_alert") setView("sensors");
              else if (n.locationId) setView("tasks");
            }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0f1f35" }}>{n.title}</div>
              <div style={{ fontSize: 13, color: "#334155", marginTop: 2 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              {!n.read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />}
              <button onClick={async () => { await deleteDoc(doc(db, "users", user.uid, "notifications", n.id)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: 2 }}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: notifTab === "settings" ? "block" : "none" }}>

      {/* Daily Summary Email */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35" }}>Daily Summary Email</div>
          <Toggle k="dailySummaryEnabled" />
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
          Receive a morning recap of the previous day
        </div>
        {prefs.dailySummaryEnabled && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>Send at</label>
              <input type="time" value={prefs.dailySummaryTime} onChange={e => update("dailySummaryTime", e.target.value)}
                style={{ padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none" }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 10 }}>Include in summary:</div>
            {(user?.role === "manager" || user?.role === "owner") && <Row label="Car counts" desc="Yesterday's wash counts per location" k="includeCounts" />}
            <Row label="Tasks completed" desc="Tasks finished yesterday" k="includeTasksDone" />
            <Row label="Open tasks" desc="All currently pending or in-progress tasks" k="includeOpenTasks" />
            <Row label="Show task names" desc="List individual task names (completed and open)" k="includeTaskNames" />
            <Row label="Overdue tasks" desc="Tasks past their due date" k="includeOverdue" />
            {(user?.role === "manager" || user?.role === "owner") && <Row label="Equipment alerts" desc="Any equipment in warning or alert status" k="includeEquipment" />}
          </>
        )}
      </div>

      {/* Instant Alerts */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 4 }}>Instant Alerts</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Get notified immediately when these occur</div>
        <Row label="Overdue tasks" desc="Task passes due date without completion" k="overdueTasksAlert" />
        {(user?.role === "manager" || user?.role === "owner") && <Row label="Low inventory" desc="Item falls below low stock threshold" k="lowInventoryAlert" />}
        {(user?.role === "manager" || user?.role === "owner") && <Row label="Equipment alerts" desc="Equipment status changes to warning or alert" k="equipmentAlert" />}
        <Row label="New task assigned" desc="New task added at your location" k="newTaskAlert" />
      </div>

      {/* Sensor Alerts */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 4 }}>Sensor Alerts</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Get notified when sensor readings exceed thresholds</div>

        <Row label="ChemLevel alerts" desc="Pressure sensor outside min/max range" k="chemLevelAlert" />
        {prefs.chemLevelAlert && (
          <div style={{ background: "#f4f6f8", borderRadius: 10, padding: 14, marginBottom: 16, marginTop: -8 }}>
            {chemSensors.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>No ChemLevel sensors found for this location. Add them in Sensors → ChemLevel tab.</div>}
            {chemSensors.map(s => (
              <div key={s.id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>{s.name || s.sensorId}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: "#64748b" }}>Min ({s.unit || "PSI"})</label>
                    <input type="number" defaultValue={s.minAlert} onBlur={async e => {
                      await updateDoc(doc(db, "locations", locId, "chemSensors", s.id), { minAlert: Number(e.target.value) });
                    }} style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, outline: "none", color: "#0f1f35", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: "#64748b" }}>Max ({s.unit || "PSI"})</label>
                    <input type="number" defaultValue={s.maxAlert} onBlur={async e => {
                      await updateDoc(doc(db, "locations", locId, "chemSensors", s.id), { maxAlert: Number(e.target.value) });
                    }} style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, outline: "none", color: "#0f1f35", boxSizing: "border-box" }} />
                  </div>
                </div>
              </div>
            ))}
            {chemSensors.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>No ChemLevel sensors configured yet. Add them in the Sensors tab.</div>}
          </div>
        )}

        <Row label="Shelly alerts" desc="Digital input or distance sensor triggered" k="shellyAlert" />
        {prefs.shellyAlert && (
          <div style={{ background: "#f4f6f8", borderRadius: 10, padding: 14, marginBottom: 16, marginTop: -8 }}>
            {shellySensors.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>No Shelly devices found for this location. Add them in Sensors → Shelly tab.</div>}
            {shellySensors.map(s => (
              <div key={s.id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>{s.name} ({s.type})</div>
                {s.type === "blu_distance" ? (
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "#64748b" }}>Min Distance (inches)</label>
                      <input type="number" defaultValue={s.minAlert || 2} onBlur={async e => {
                        await updateDoc(doc(db, "locations", locId, "shellyDevices", s.id), { minAlert: Number(e.target.value) });
                      }} style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, outline: "none", color: "#0f1f35", boxSizing: "border-box" }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <label style={{ fontSize: 11, color: "#64748b" }}>Alert when signal is:</label>
                    <select defaultValue={s.alertOn || "on"} onBlur={async e => {
                      await updateDoc(doc(db, "locations", locId, "shellyDevices", s.id), { alertOn: e.target.value });
                    }} style={{ padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, outline: "none", background: "#fff", color: "#0f1f35" }}>
                      <option value="on">ON</option>
                      <option value="off">OFF</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Row label="SensorPush alerts" desc="Temperature or humidity out of range" k="sensorPushAlert" />
        {prefs.sensorPushAlert && (
          <div style={{ background: "#f4f6f8", borderRadius: 10, padding: 14, marginBottom: 16, marginTop: -8 }}>
            {spSensors.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>No SensorPush sensors found. Connect SensorPush in the Sensors tab.</div>}
            {spSensors.map(s => (
              <div key={s.id} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>{s.name}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "#64748b" }}>Min Temp (°F)</label>
                    <input type="number" defaultValue={spAlerts[s.id]?.minTemp ?? ""} onBlur={e => saveSpAlert(s.id, "minTemp", e.target.value)}
                      placeholder="e.g. 32" style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, outline: "none", color: "#0f1f35", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#64748b" }}>Max Temp (°F)</label>
                    <input type="number" defaultValue={spAlerts[s.id]?.maxTemp ?? ""} onBlur={e => saveSpAlert(s.id, "maxTemp", e.target.value)}
                      placeholder="e.g. 100" style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, outline: "none", color: "#0f1f35", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#64748b" }}>Min Humidity (%)</label>
                    <input type="number" defaultValue={spAlerts[s.id]?.minHumidity ?? ""} onBlur={e => saveSpAlert(s.id, "minHumidity", e.target.value)}
                      placeholder="e.g. 20" style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, outline: "none", color: "#0f1f35", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#64748b" }}>Max Humidity (%)</label>
                    <input type="number" defaultValue={spAlerts[s.id]?.maxHumidity ?? ""} onBlur={e => saveSpAlert(s.id, "maxHumidity", e.target.value)}
                      placeholder="e.g. 80" style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, outline: "none", color: "#0f1f35", boxSizing: "border-box" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Car Recurrence Alerts */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f1f35", marginBottom: 4 }}>Equipment Car Count Alerts</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Get notified when car-based recurring tasks are due or approaching</div>
        <Row label="Task due alert" desc="Notify when a car-recurrence task becomes due" k="carRecurrenceDueAlert" />
        <Row label="Upcoming task warning" desc="Notify when a task is approaching its car count threshold" k="carRecurrenceWarningAlert" />
        {prefs.carRecurrenceWarningAlert && (
          <div style={{ background: "#f4f6f8", borderRadius: 10, padding: 14, marginBottom: 16, marginTop: -8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Warn me when within this many cars:</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="number" min="50" max="2000" value={prefs.carRecurrenceWarningCars || 300}
                onChange={e => update("carRecurrenceWarningCars", parseInt(e.target.value) || 300)}
                style={{ width: 100, padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 14, fontWeight: 700, outline: "none", color: "#0f1f35" }} />
              <span style={{ fontSize: 13, color: "#64748b" }}>cars remaining</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={save} style={{ background: "#0f1f35", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Saving..." : saved ? "Saved!" : "Save Preferences"}
        </button>
        <button onClick={async () => {
          setSaving(true);
          try {
            const sendTestSummary = httpsCallable(functions, "sendDailySummary");
            await sendTestSummary({ uid: user.uid, test: true });
            alert("Test email sent to " + (user.email || "your email") + "!");
          } catch(e) { alert("Error: " + e.message); }
          setSaving(false);
        }} style={{ background: "#fff", color: "#0f1f35", border: "2px solid #1a3352", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Send Test Email
        </button>
      </div>
      </div>
    </div>
  );
}

function AllLocations({ locations, tasks, setLocId, setView }) {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const [daySummaries, setDaySummaries] = useState({});

  useEffect(() => {
    if (!locations.length) return;
    const fetchAll = async () => {
      const summaries = {};
      for (const loc of locations) {
        const snap = await getDoc(doc(db, "locations", loc.id, "daySummaries", today));
        const snapY = await getDoc(doc(db, "locations", loc.id, "daySummaries", yesterday));
        summaries[loc.id] = {
          today: snap.exists() ? snap.data() : null,
          yesterday: snapY.exists() ? snapY.data() : null
        };
      }
      setDaySummaries(summaries);
    };
    fetchAll();
  }, [locations]);

  const totalCarsToday = locations.reduce((sum, loc) => sum + (daySummaries[loc.id]?.today?.carsWashed || 0), 0);
  const totalCarsYesterday = locations.reduce((sum, loc) => sum + (daySummaries[loc.id]?.yesterday?.carsWashed || 0), 0);
  const allTasks = Object.values(tasks).flat();
  const openTasks = allTasks.filter(t => t.status !== "done");
  const overdueTasks = openTasks.filter(t => t.dueDate && t.dueDate < today);

  return (
    <div style={{ padding: "20px 16px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f1f35", marginBottom: 4 }}>All Locations</div>
      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>{locations.length} locations</div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Cars Today</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#0f1f35" }}>{totalCarsToday}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Yesterday: {totalCarsYesterday}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Open Tasks</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: overdueTasks.length > 0 ? "#dc2626" : "#0f1f35" }}>{openTasks.length}</div>
          <div style={{ fontSize: 11, color: overdueTasks.length > 0 ? "#dc2626" : "#94a3b8", marginTop: 2 }}>{overdueTasks.length} overdue</div>
        </div>
      </div>

      {/* Per Location Breakdown */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 12 }}>By Location</div>
      {locations.map(loc => {
        const carsToday = daySummaries[loc.id]?.today?.carsWashed || 0;
        const carsYesterday = daySummaries[loc.id]?.yesterday?.carsWashed || 0;
        const locTasks = tasks[loc.id] || [];
        const locOpen = locTasks.filter(t => t.status !== "done");
        const locOverdue = locOpen.filter(t => t.dueDate && t.dueDate < today);
        return (
          <div key={loc.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0f1f35" }}>{loc.name}</div>
              {locOverdue.length > 0 && (
                <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                  {locOverdue.length} overdue
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div onClick={() => { setLocId(loc.id); setView("carcounts"); }}
                style={{ background: "#f4f6f8", borderRadius: 8, padding: 10, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background="#e0f2fe"}
                onMouseLeave={e => e.currentTarget.style.background="#f4f6f8"}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Cars Today</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#0f1f35" }}>{carsToday}</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>Yesterday: {carsYesterday}</div>
              </div>
              <div onClick={() => { setLocId(loc.id); setView("tasks"); }}
                style={{ background: "#f4f6f8", borderRadius: 8, padding: 10, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background="#fef3c7"}
                onMouseLeave={e => e.currentTarget.style.background="#f4f6f8"}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Open Tasks</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: locOverdue.length > 0 ? "#dc2626" : "#0f1f35" }}>{locOpen.length}</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>{locTasks.length} total</div>
              </div>
            </div>
            {locOpen.length > 0 && (
              <div style={{ marginTop: 10, borderTop: "1px solid #f3f4f6", paddingTop: 8 }}>
                {locOpen.slice(0, 3).map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.dueDate && t.dueDate < today ? "#dc2626" : "#f59e0b", flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: "#334155" }}>{t.title}</div>
                  </div>
                ))}
                {locOpen.length > 3 && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>+{locOpen.length - 3} more</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Dashboard() {
const { user, logout } = useAuth();
const [locations, setLocations] = useState([]);
const [tasks, setTasks] = useState({});
const [sensors, setSensors] = useState({});
const [equipment, setEquipment] = useState({});
const [view, setView] = useState(() => new URLSearchParams(window.location.search).get("view") || "overview");
const [locId, setLocId] = useState(() => new URLSearchParams(window.location.search).get("loc") || null);
const [ready, setReady] = useState(false);
const [showAddTask, setShowAddTask] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sensorTab, setSensorTab] = useState(() => new URLSearchParams(window.location.search).get("tab") || "sensorpush");

  useEffect(() => {
    if (!locId) return;
    const params = new URLSearchParams();
    params.set("view", view);
    params.set("loc", locId);
    if (view === "sensors") params.set("tab", sensorTab);
    window.history.replaceState(null, "", "?" + params.toString());
  }, [view, locId, sensorTab]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      collection(db, "users", user.uid, "notifications"),
      snap => setUnreadCount(snap.docs.filter(d => !d.data().read).length)
    );
    return () => unsub();
  }, [user?.uid]);
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
  const ownerId = user.isTeamMember ? user.ownerId : user.uid;
  const allowedLocs = user.allowedLocations || [];

  if (user.isTeamMember) {
    // Team members: fetch only their allowed locations individually.
    // A collection query for all owner locations fails Firestore security rules
    // when the team member doesn't have access to every document in the result set.
    if (!allowedLocs.length) {
      setReady(true);
      return;
    }
    const locMap = {};
    const unsubs = allowedLocs.map(id =>
      onSnapshot(
        doc(db, "locations", id),
        snap => {
          if (snap.exists()) locMap[id] = { id: snap.id, ...snap.data() };
          else delete locMap[id];
          const locs = Object.values(locMap).sort((a, b) => (a.order || 0) - (b.order || 0));
          setLocations(locs);
          setLocId(cur => cur || user.locationId || locs[0]?.id);
          setReady(true);
        },
        () => setReady(true)
      )
    );
    return () => unsubs.forEach(u => u());
  }

  const unsub = onSnapshot(
    query(collection(db, "locations"), where("ownerId", "==", ownerId)),
    snap => {
      const locs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
      setLocations(locs);
      setLocId(id => id || user.locationId || locs[0]?.id);
      setReady(true);
    },
    err => {
      console.error("Locations query error:", err);
      setReady(true);
    }
  );
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
          locUpdates[locId]["sp_" + sensorId + "_tempF"] = latest.temperature != null ? Math.round(latest.temperature * 10) / 10 : null;
          locUpdates[locId]["sp_" + sensorId + "_humidity"] = latest.humidity != null ? Math.round(latest.humidity * 10) / 10 : null;
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
if (user?.setupComplete === false && !locations.length) return <SetupWizard user={user} logout={logout} />;
const curLoc = locations.find(l => l.id === locId);
const curTasks = tasks[locId] || [];
const curSens = sensors[locId] || null;
const curEquip = equipment[locId] || [];

return (
<div style={{ height: "100dvh", background: "#f4f6f8", overflow: "hidden" }}>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
<Sidebar locations={locations} view={view} setView={setView} locId={locId} setLocId={setLocId} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
<main style={{ overflowY: "auto", height: "100dvh", padding: "16px", paddingTop: "64px", boxSizing: "border-box", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      {(
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 48, background: "#0f1f35", display: "flex", alignItems: "center", paddingLeft: 12, paddingRight: 8, zIndex: 30, boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ width: 22, height: 2, background: "#fff", borderRadius: 2 }} />
            <div style={{ width: 22, height: 2, background: "#fff", borderRadius: 2 }} />
            <div style={{ width: 22, height: 2, background: "#fff", borderRadius: 2 }} />
          </button>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}><span style={{ color: "#fff", fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px" }}>WashLevel</span><span style={{ background: "#00d4aa", color: "#0f1f35", fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "2px 6px", letterSpacing: "0.05em" }}>PRO</span></div><button onClick={() => setView("alerts")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 8, position: "relative" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>{unreadCount > 0 && <span style={{ position: "absolute", top: 4, right: 4, background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", boxSizing: "border-box" }}>{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>
        </div>
      )}
{locId === "all" && <AllLocations locations={locations} tasks={tasks} setLocId={setLocId} setView={setView} />}
{locId !== "all" && view === "overview" && <Overview location={curLoc} tasks={curTasks} sensors={curSens} equipment={curEquip} onNavigate={setView} user={user} onSensorNavigate={(tab) => { setSensorTab(tab); setTimeout(() => setView("sensors"), 0); }} />}
{view === "tasks"     && <Tasks tasks={curTasks} onStatus={handleStatus} onEdit={t => { setEditTask(t); setShowAddTask(true); }} showAll={false} locationName={curLoc?.name} onAddTask={() => setShowAddTask(true)} onSaveNote={handleSaveNote} locId={locId} onSelectMaterials={setMaterialsTask} equipment={curEquip} />}
{view === "all-tasks" && <Tasks tasks={curTasks} onStatus={handleStatus} onEdit={t => { setEditTask(t); setShowAddTask(true); }} showAll={true} locationName={curLoc?.name} onAddTask={() => setShowAddTask(true)} onSaveNote={handleSaveNote} locId={locId} onSelectMaterials={setMaterialsTask} equipment={curEquip} />}
{view === "timeclock" && <TimeClock locId={locId} locationName={curLoc?.name} allLocations={locations} />}
{view === "inventory" && <Inventory locId={locId} locationName={curLoc?.name} user={user} locations={locations} />}
{view === "equipment" && <Equipment equipment={curEquip} locationName={curLoc?.name} locId={locId} allTasks={curTasks} onCreateTask={eq => { setTaskPreset(eq); setShowAddTask(true); }} onNavigate={setView} />}
        {view === "alerts" && (
  <AlertSettings locId={locId} locations={locations} user={user} setView={setView} setLocId={setLocId} />
)}
{view === "calendar"  && <Calendar locId={locId} locationName={curLoc?.name} tasks={curTasks} sensors={curSens} location={curLoc} />}
        {view === "carcounts" && <CarCounts locations={locations} />}
{view === "sensors"   && <Sensors sensors={curSens} locationName={curLoc?.name} locId={locId} onNavigate={setView} uid={user?.isTeamMember ? user?.ownerId : user?.uid} locations={locations} initialTab={sensorTab} onTabChange={setSensorTab} />}
{view === "settings"  && <Settings locations={locations} onUpdateLocation={handleUpdateLocation} user={user} />}
</main>
{showAddTask && <AddTaskModal locId={locId} onClose={() => { setShowAddTask(false); setTaskPreset(null); setEditTask(null); }} onAdd={() => {}} preset={taskPreset} user={user} editTask={editTask} />}
{materialsTask && <MaterialsModal locId={locId} task={materialsTask} onClose={() => setMaterialsTask(null)} />}
</div>
);
}

function AppInner() {
const { user, loading, refreshUser } = useAuth();
const [pendingInvite, setPendingInvite] = useState(null);
const [acceptingInvite, setAcceptingInvite] = useState(false);

useEffect(() => {
  if (!user) { setPendingInvite(null); return; }
  getDocs(query(collection(db, "invites"), where("email", "==", user.email.toLowerCase()), where("status", "==", "pending")))
    .then(async snap => {
      if (snap.empty) return;
      const inv = snap.docs[0];
      const invData = inv.data();
      if (invData.ownerId === user.uid) return; // their own invite
      const ownerSnap = await getDoc(doc(db, "users", invData.ownerId));
      const bizName = ownerSnap.exists() ? ownerSnap.data().bizName || ownerSnap.data().name : "a team";
      setPendingInvite({ ...invData, inviteRef: inv.ref, bizName });
    });
}, [user?.uid]);

if (loading) return <Spinner />;

if (user && pendingInvite) {
  const handleAccept = async () => {
    setAcceptingInvite(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid, email: user.email, name: user.name || user.email,
        role: pendingInvite.role || "attendant",
        ownerId: pendingInvite.ownerId,
        locationId: pendingInvite.locationId || null,
        allowedLocations: pendingInvite.allowedLocations || [],
        color: "#0ea5e9", isTeamMember: true, setupComplete: true,
        createdAt: new Date().toISOString()
      });
      await updateDoc(pendingInvite.inviteRef, { status: "accepted", acceptedAt: new Date().toISOString() });
      await refreshUser();
      setPendingInvite(null);
    } catch(e) { alert("Error accepting invite: " + e.message); }
    setAcceptingInvite(false);
  };
  const handleDecline = () => setPendingInvite(null);
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: 32, maxWidth: 440, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f1f35", marginBottom: 6 }}>You've been invited!</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>
            <b>{pendingInvite.bizName}</b> has invited you to join as <b>{pendingInvite.role || "attendant"}</b>.
          </div>
        </div>
        <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 10, padding: "12px 16px", marginBottom: 24, fontSize: 13, color: "#713f12" }}>
          <b>Heads up:</b> Accepting will replace your current WashLevel account data and add you to this organization. Any locations or data you created independently will be removed.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleAccept} disabled={acceptingInvite} style={{ flex: 1, background: "#0f1f35", color: "#fff", border: "none", borderRadius: 9, padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {acceptingInvite ? "Accepting..." : "Accept Invite"}
          </button>
          <button onClick={handleDecline} style={{ flex: 1, background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 9, padding: "13px 0", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

if (user) return <Dashboard />;
const params = new URLSearchParams(window.location.search);
const inviteEmail = params.get("invite");
const inviteOwner = params.get("owner");
return <Login defaultTab={inviteEmail ? "signup" : "login"} defaultEmail={inviteEmail || ""} ownerId={inviteOwner || ""} />;
}

export default function App() {
return <AuthProvider><AppInner /></AuthProvider>;
}
