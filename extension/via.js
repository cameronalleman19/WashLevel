const VBASE = "https://admin.dencar.sancsoft.net";
const V$ = (id) => document.getElementById(id);
let viaData = {};
let viaNotes = {};
let viaSeen = {};

function vEsc(s){ const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
function vDays(ts){ return (Date.now() - ts) / 86400000; }

function htmlToLines(html){
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .split("\n").map(x => x.trim()).filter(Boolean);
}

function fieldAfter(lines, label){
  const i = lines.findIndex(l => l.toLowerCase() === label.toLowerCase());
  return i >= 0 && i + 1 < lines.length ? lines[i + 1] : "";
}

function parseDetail(html, id){
  const lines = htmlToLines(html);
  const plates = [];
  let pi = lines.findIndex(l => l === "Plates");
  if (pi >= 0){
    for (let i = pi + 1; i < lines.length; i++){
      const l = lines[i];
      if (["Last Name", "Vehicle Nicknames", "Customer Pass Id", "Payment Trigger", "Average Wash Usage", "Use Count", "Customer Response"].includes(l)) break;
      if (/^[A-Z0-9 -]{2,10}$/i.test(l)) plates.push(l.toUpperCase());
    }
  }
  const history = [];
  for (let i = 0; i < lines.length - 1; i++){
    if (lines[i] === "Timestamp" && /^\d{2}\/\d{2}\/\d{4}/.test(lines[i + 1] || "")){
      const ts = lines[i + 1];
      let lp = "";
      for (let j = i + 2; j < Math.min(i + 6, lines.length); j++){
        if (lines[j] === "LP Number"){ lp = (lines[j + 1] && !/^Timestamp$/.test(lines[j + 1])) ? lines[j + 1] : ""; break; }
      }
      const p = ts.split(/[\/ :]/);
      const t = new Date(p[2], p[0] - 1, p[1], p[3] || 0, p[4] || 0, p[5] || 0).getTime();
      history.push({ts: ts, t: t, lp: (lp || "").toUpperCase()});
    }
  }
  history.sort((a, b) => b.t - a.t);
  const trigM = html.match(/consumerpassexceptions\/trigger\/([0-9a-fA-F-]{36})/);
  const closeM = html.match(/consumerpassexceptions\/closeexception\/([0-9a-fA-F-]{36})/);
  const imgs = [];
  const imre = /https:\/\/s3[^"'\s]*payments_(driver|license)\/([0-9a-fA-F-]{36})[^"'\s]*/g;
  let m;
  while ((m = imre.exec(html))){ imgs.push({kind: m[1], pid: m[2], url: m[0].replace(/&amp;/g, "&")}); }
  return {
    id: id,
    firstName: fieldAfter(lines, "First Name"),
    lastName: fieldAfter(lines, "Last Name"),
    passName: fieldAfter(lines, "Pass Name"),
    rating: fieldAfter(lines, "Exception Rating"),
    vehicleCount: parseInt(fieldAfter(lines, "Vehicle Count")) || 0,
    avgUsage: parseFloat(fieldAfter(lines, "Average Wash Usage")) || 0,
    useCount: fieldAfter(lines, "Use Count"),
    consumerPassId: fieldAfter(lines, "Consumer Pass Id"),
    plates: plates,
    history: history,
    imgs: imgs,
    triggerId: trigM ? trigM[1] : null,
    closeId: closeM ? closeM[1] : null,
    fetched: Date.now()
  };
}

function recommend(e){
  const onPlan = (lp) => e.plates.some(p => lp && (lp === p || lp.replace(/[^A-Z0-9]/g, "") === p.replace(/[^A-Z0-9]/g, "")));
  const lastUse = e.history.length ? e.history[0].t : 0;
  const offPlan = e.history.filter(h => h.lp && !onPlan(h.lp));
  const onPlanUses = e.history.filter(h => h.lp && onPlan(h.lp));
  if (!lastUse) return {verdict: "REVIEW", cls: "rec-mid", why: "No payment history parsed - review manually"};
  if (vDays(lastUse) > 21) return {verdict: "DO NOT TRIGGER", cls: "rec-no", why: "No pass use in over 3 weeks (dormant)"};
  if (e.vehicleCount === 1 && offPlan.length && onPlanUses.length){
    const gap = Math.abs(offPlan[0].t - onPlanUses[0].t) / 86400000;
    if (gap <= 1.5) return {verdict: "TRIGGER", cls: "rec-yes", why: "Single-vehicle plan; off-plan wash within a day of on-plan wash (likely sharing)"};
  }
  if (e.vehicleCount >= 2 && e.avgUsage < 4) return {verdict: "LET SLIDE", cls: "rec-mid", why: e.vehicleCount + " vehicles on plan, low usage - good repeat customer"};
  if (offPlan.length) return {verdict: "TRIGGER", cls: "rec-yes", why: "Active user washing off-plan vehicle (" + vEsc(offPlan[0].lp) + ")"};
  return {verdict: "REVIEW", cls: "rec-mid", why: "No off-plan plate detected in recent history"};
}

async function viaLoad(){
  const st = await chrome.storage.local.get(["viaData", "viaNotes", "viaSeen"]);
  viaData = st.viaData || {};
  viaNotes = st.viaNotes || {};
  viaSeen = st.viaSeen || {};
}
async function viaSave(){ await chrome.storage.local.set({viaData: viaData, viaNotes: viaNotes, viaSeen: viaSeen}); }

async function viaSync(){
  V$("viaSyncBtn").disabled = true;
  V$("viaStatus").textContent = "Loading exception list...";
  try {
    const res = await fetch(VBASE + "/consumerpassexceptions/", {credentials: "include"});
    const html = await res.text();
    if (/type="password"/i.test(html)){ V$("viaStatus").textContent = "Not logged into Dencar."; V$("viaSyncBtn").disabled = false; return; }
    const ids = [];
    const re = /consumerpassexceptions\/([0-9a-fA-F-]{36})/g;
    let m;
    while ((m = re.exec(html))){ if (!ids.includes(m[1])) ids.push(m[1]); }
    if (!ids.length){ V$("viaStatus").textContent = "No open exceptions found."; viaData = {}; await viaSave(); renderViaList(); V$("viaSyncBtn").disabled = false; return; }
    const fresh = {};
    for (let i = 0; i < ids.length; i++){
      V$("viaStatus").textContent = "Loading exception " + (i + 1) + " / " + ids.length;
      const r2 = await fetch(VBASE + "/consumerpassexceptions/" + ids[i] + "/", {credentials: "include"});
      const d = parseDetail(await r2.text(), ids[i]);
      fresh[ids[i]] = d;
      const key = d.consumerPassId || ids[i];
      viaSeen[key] = viaSeen[key] || {};
      viaSeen[key][ids[i]] = Date.now();
      await new Promise(r => setTimeout(r, 150));
    }
    viaData = fresh;
    await viaSave();
    V$("viaStatus").textContent = "Loaded " + ids.length + " open exceptions.";
    renderViaList();
  } catch(e){
    V$("viaStatus").textContent = "VIA sync failed: " + e.message;
  }
  V$("viaSyncBtn").disabled = false;
}

function renderViaList(){
  const wrap = V$("viaCards");
  wrap.innerHTML = "";
  const ids = Object.keys(viaData);
  if (!ids.length){ wrap.innerHTML = "<div class=\"via-empty\">No open exceptions loaded. Press Sync VIA.</div>"; return; }
  for (const id of ids){
    const e = viaData[id];
    const rec = recommend(e);
    const seenCount = Object.keys(viaSeen[e.consumerPassId || id] || {}).length;
    const lastUse = e.history.length ? e.history[0].ts : "unknown";
    const driver = e.imgs.find(x => x.kind === "driver");
    const plate = e.imgs.find(x => x.kind === "license");
    const div = document.createElement("div");
    div.className = "via-card";
    div.innerHTML =
      "<div class=\"via-photos\">" +
        (driver ? "<img src=\"" + driver.url + "\" loading=\"lazy\">" : "<div class=\"noimg\">no photo</div>") +
        (plate ? "<img src=\"" + plate.url + "\" loading=\"lazy\">" : "<div class=\"noimg\">no plate</div>") +
      "</div>" +
      "<div class=\"via-info\">" +
        "<div class=\"via-name\">" + vEsc(e.firstName + " " + e.lastName) + " <span class=\"via-pass\">(" + vEsc(e.passName) + ")</span></div>" +
        "<div class=\"via-row\">Plates on plan: <strong>" + vEsc(e.plates.join(", ") || "none parsed") + "</strong> | Vehicles: " + e.vehicleCount + "</div>" +
        "<div class=\"via-row\">Last pass use: " + vEsc(lastUse) + " | Avg usage: " + e.avgUsage.toFixed(1) + " | Use count: " + vEsc(e.useCount) + "</div>" +
        "<div class=\"via-row\">Exceptions seen for this member: " + seenCount + "</div>" +
        "<div class=\"via-rec " + rec.cls + "\">" + rec.verdict + "</div>" +
        "<div class=\"via-why\">" + rec.why + "</div>" +
        "<div class=\"via-history\">" + e.history.slice(0, 5).map(h => vEsc(h.ts) + " - " + vEsc(h.lp || "?")).join("<br>") + "</div>" +
        "<textarea class=\"via-note\" data-id=\"" + id + "\" placeholder=\"Notes for this exception...\">" + vEsc(viaNotes[id] || "") + "</textarea>" +
        "<div class=\"via-actions\">" +
          (e.triggerId ? "<button class=\"via-trigger\" data-id=\"" + id + "\">Trigger Exception</button>" : "") +
          (e.closeId ? "<button class=\"via-close-ex\" data-id=\"" + id + "\">Close Exception</button>" : "") +
          "<a class=\"via-open\" href=\"" + VBASE + "/consumerpassexceptions/" + id + "/\" target=\"_blank\">Open in Dencar</a>" +
        "</div>" +
      "</div>";
    wrap.appendChild(div);
  }
  wrap.querySelectorAll(".via-note").forEach(t => {
    t.addEventListener("change", async () => { viaNotes[t.dataset.id] = t.value; await viaSave(); });
  });
  wrap.querySelectorAll(".via-trigger").forEach(b => {
    b.addEventListener("click", () => viaAction(b.dataset.id, "trigger", b));
  });
  wrap.querySelectorAll(".via-close-ex").forEach(b => {
    b.addEventListener("click", () => viaAction(b.dataset.id, "close", b));
  });
}

async function viaAction(id, kind, btn){
  const e = viaData[id];
  if (!e) return;
  const actionId = kind === "trigger" ? e.triggerId : e.closeId;
  if (!actionId) return;
  const label = kind === "trigger" ? "TRIGGER the exception" : "CLOSE the exception";
  if (!confirm("Are you sure you want to " + label + " for " + e.firstName + " " + e.lastName + "? This happens on Dencar immediately.")) return;
  btn.disabled = true;
  btn.textContent = "Working...";
  try {
    const path = kind === "trigger" ? "trigger" : "closeexception";
    const method = kind === "trigger" ? "POST" : "DELETE";
    const res = await fetch(VBASE + "/consumerpassexceptions/" + path + "/" + actionId + "/", {method: method, credentials: "include"});
    if (res.ok){
      viaNotes[id] = ((viaNotes[id] || "") + "\n[" + new Date().toLocaleString() + "] " + (kind === "trigger" ? "Triggered" : "Closed") + " via Sidecar").trim();
      delete viaData[id];
      await viaSave();
      renderViaList();
      V$("viaStatus").textContent = (kind === "trigger" ? "Exception triggered." : "Exception closed.");
    } else {
      btn.disabled = false;
      btn.textContent = kind === "trigger" ? "Trigger Exception" : "Close Exception";
      V$("viaStatus").textContent = "Action failed (" + res.status + ") - use Open in Dencar.";
    }
  } catch(err){
    btn.disabled = false;
    btn.textContent = kind === "trigger" ? "Trigger Exception" : "Close Exception";
    V$("viaStatus").textContent = "Action failed: " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await viaLoad();
  renderViaList();
  V$("viaSyncBtn").addEventListener("click", viaSync);
});
