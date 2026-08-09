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
    consumerId: (html.match(/\/consumer\/([0-9a-fA-F-]{36})/) || [null, null])[1],
    fetched: Date.now()
  };
}

function normPlate(p){ return (p||"").toUpperCase().replace(/[^A-Z0-9]/g,"").replace(/0/g,"O").replace(/8/g,"B").replace(/1/g,"I").replace(/5/g,"S").replace(/2/g,"Z"); }
function editDist(a,b){ if(Math.abs(a.length-b.length)>1) return 9; const m=[]; for(let i=0;i<=a.length;i++){m[i]=[i];} for(let j=0;j<=b.length;j++){m[0][j]=j;} for(let i=1;i<=a.length;i++){for(let j=1;j<=b.length;j++){m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));}} return m[a.length][b.length]; }

function calcPerMonth(e){ const h = (e.washHistory && e.washHistory.length) ? e.washHistory : e.history.filter(x => x.lp && x.lp !== "N/A"); if(!h.length) return 0; const spanMs = h.length > 1 ? (h[0].t - h[h.length - 1].t) : 0; return h.length / Math.max(spanMs / 2592000000, 1); }

function recommend(e){
  const onPlan = (lp) => e.plates.some(p => lp && (lp === p || editDist(normPlate(lp), normPlate(p)) <= 1));
  const lastUse = e.history.length ? e.history[0].t : 0;
  const offPlan = e.history.filter(h => h.lp && !onPlan(h.lp));
  const onPlanUses = e.history.filter(h => h.lp && onPlan(h.lp));
  if (!lastUse) return {verdict: "REVIEW", cls: "rec-mid", why: "No payment history parsed - review manually"};
  if (vDays(lastUse) > 21) return {verdict: "DO NOT TRIGGER", cls: "rec-no", why: "No pass use in over 3 weeks (dormant)"};
  const perMonth = calcPerMonth(e);
  if (perMonth < 3) return {verdict: "DO NOT TRIGGER", cls: "rec-no", why: "Low usage - about " + perMonth.toFixed(1) + " washes/month on average"};
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
      await enrichConsumer(d);
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
        "<div class=\"via-row\">Last pass use: " + vEsc(lastUse) + " | Washes/month (computed): " + calcPerMonth(e).toFixed(1) + " | Vac/self-serve uses 12mo: " + (e.otherUses || 0) + " | Use count: " + vEsc(e.useCount) + "</div>" +
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
  bindZoom();
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
      try { await viaHistLog(e, kind === "trigger" ? "trigger" : "close"); } catch(_){}
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

function bindZoom(){
  let z = document.getElementById("viaZoom");
  if (!z){ z = document.createElement("img"); z.id = "viaZoom"; z.style.display = "none"; document.body.appendChild(z); }
  document.querySelectorAll(".via-photos img").forEach(img => {
    img.addEventListener("mouseenter", () => { z.src = img.src; z.style.display = "block"; });
    img.addEventListener("mousemove", (ev) => { z.style.left = Math.min(ev.pageX + 24, window.scrollX + window.innerWidth - 1220) + "px"; z.style.top = (ev.pageY - 100) + "px"; });
    img.addEventListener("mouseleave", () => { z.style.display = "none"; });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await viaLoad();
  renderViaList();
  V$("viaSyncBtn").addEventListener("click", viaSync);
});

async function enrichConsumer(d){
  if (!d.consumerId) return;
  try {
    const end = new Date();
    const start = new Date(end); start.setMonth(start.getMonth() - 12);
    const body = "currentPage=1&itemsPerPage=500&PaymentType=&SiteId=&DeviceId=&StartDate=" + start.toLocaleDateString("en-CA") + "&EndDate=" + end.toLocaleDateString("en-CA") + "&LicensePlateNum=&Code=&MaskedCardNumber=&ConsumerFirstName=&ConsumerLastName=&ConsumerId=" + d.consumerId;
    const res = await fetch(VBASE + "/Payment/IndexFilterTable", {method: "POST", credentials: "include", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: body});
    if (!res.ok) return;
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const rows = Array.from(doc.querySelectorAll("tr"));
    let tsIdx = -1, lpIdx = -1, mIdx = -1;
    for (const r of rows){
      const cells = Array.from(r.children);
      cells.forEach((c, i) => {
        const t = c.textContent.trim().toLowerCase();
        if (c.tagName === "TH" && tsIdx === -1 && /timestamp|date/.test(t)) tsIdx = i;
        if (c.tagName === "TH" && lpIdx === -1 && /license|lp\b|plate/.test(t)) lpIdx = i;
        if (c.tagName === "TH" && mIdx === -1 && t === "method") mIdx = i;
      });
      if (tsIdx >= 0 && lpIdx >= 0) break;
    }
    const washes = [];
    let others = 0;
    for (const r of rows){
      const cells = Array.from(r.children);
      if (!cells.length || cells[0].tagName === "TH") continue;
      let ts = "";
      if (tsIdx >= 0 && cells[tsIdx]) ts = cells[tsIdx].textContent.trim();
      if (!/^\d{2}\/\d{2}\/\d{4}/.test(ts)){
        const alt = cells.map(c => c.textContent.trim()).find(x => /^\d{2}\/\d{2}\/\d{4}/.test(x));
        if (alt) ts = alt; else continue;
      }
      let lp = "";
      if (lpIdx >= 0 && cells[lpIdx]) lp = cells[lpIdx].textContent.trim();
      const p = ts.split(/[\/ :]/);
      const t = new Date(p[2], p[0] - 1, p[1], p[3] || 0, p[4] || 0, p[5] || 0).getTime();
      const plate = (lp || "").toUpperCase();
      const method = (mIdx >= 0 && cells[mIdx]) ? cells[mIdx].textContent.trim() : "";
      if (plate && plate !== "N/A" && plate !== "-") washes.push({t: t, lp: plate});
      else if (/vac|self serve/i.test(method)) others++;
    }
    washes.sort((a, b) => b.t - a.t);
    if (washes.length || others){ d.washHistory = washes; d.otherUses = others; }
  } catch(err){}
}

/* ===== VIA Decision History (Sidecar) ===== */
const VIA_HIST_KEY = "viaHistory";

async function viaHistAll(){
  const o = await chrome.storage.local.get(VIA_HIST_KEY);
  return o[VIA_HIST_KEY] || [];
}

async function viaHistLog(e, action){
  const rec = { ts: Date.now(), action: action };
  for (const k in e){
    const v = e[k];
    if (v == null) continue;
    if (typeof v === "object" || typeof v === "function") continue;
    if (typeof v === "string" && (k.toLowerCase().indexOf("photo") >= 0 || k.toLowerCase().indexOf("image") >= 0 || v.length > 300)) continue;
    rec[k] = v;
  }
  try {
    if (typeof recommend === "function"){
      var r = recommend(e);
      rec.rec = (typeof r === "string") ? r : (r && (r.text || r.label || r.action || JSON.stringify(r)));
    }
  } catch(_){}
  const hist = await viaHistAll();
  hist.push(rec);
  if (hist.length > 2000) hist.splice(0, hist.length - 2000);
  await chrome.storage.local.set({ [VIA_HIST_KEY]: hist });
  try { renderViaHistory(); } catch(_){}
}

function viaHistEsc(s){
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function renderViaHistory(){
  const anchor = document.getElementById("viaCards");
  if (!anchor) return;
  if (!document.getElementById("viaHistCss")){
    const st = document.createElement("style");
    st.id = "viaHistCss";
    st.textContent = ".via-hist{border-collapse:collapse;width:100%;margin-top:8px}" +
      ".via-hist th,.via-hist td{border-bottom:1px solid #e3e3e3;padding:6px 10px;text-align:left;font-size:13px;color:inherit}" +
      ".via-hist th{background:rgba(127,127,127,.18);color:inherit;font-weight:700}" +
      ".via-hist-trigger{color:#ff6b6b;font-weight:600}" +
      ".via-hist-close{color:#4ade80;font-weight:600}" +
      ".via-hist-summary{margin:6px 0;opacity:.75;font-size:13px}" +
      ".via-hist-empty{opacity:.7;font-size:13px;margin:8px 0}";
    document.head.appendChild(st);
  }
  let box = document.getElementById("viaHistBox");
  if (!box){
    box = document.createElement("div");
    box.id = "viaHistBox";
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
  }
  const hist = (await viaHistAll()).slice().reverse();
  const trig = hist.filter(h => h.action === "trigger").length;
  const closed = hist.length - trig;
  const byName = {};
  hist.forEach(h => {
    const n = ((h.firstName || "") + " " + (h.lastName || "")).trim() || "Unknown";
    byName[n] = (byName[n] || 0) + 1;
  });
  let html = "<h2>VIA decision history</h2>";
  html += "<div class='via-hist-summary'>" + hist.length + " decisions logged &mdash; " + trig + " triggered, " + closed + " closed</div>";
  if (!hist.length){
    html += "<div class='via-hist-empty'>No decisions logged yet. The next trigger or close will appear here.</div>";
  } else {
    html += "<table class='via-hist'><tr><th>When</th><th>Member</th><th>Action</th><th>Sidecar said</th><th>Times seen</th></tr>";
    hist.slice(0, 150).forEach(h => {
      const n = ((h.firstName || "") + " " + (h.lastName || "")).trim() || "Unknown";
      html += "<tr><td>" + new Date(h.ts).toLocaleString() + "</td>" +
        "<td>" + viaHistEsc(n) + "</td>" +
        "<td class='via-hist-" + h.action + "'>" + (h.action === "trigger" ? "Triggered" : "Closed") + "</td>" +
        "<td>" + (h.rec ? viaHistEsc(h.rec) : "&ndash;") + "</td>" +
        "<td>" + byName[n] + "</td></tr>";
    });
    html += "</table>";
  }
  box.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => { renderViaHistory(); });
