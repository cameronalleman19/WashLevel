const BASE = "https://admin.dencar.sancsoft.net";
const DAYS_BACK = 90;
const REPORT_PATHS = ["/", "/Home", "/Home/Index", "/DailyReports", "/Home/DailyReports", "/Reports/DailyReports", "/DailyReport"];
const $ = (id) => document.getElementById(id);

let hist = {};
let sites = [];

function fmtMoney(n){ return "$" + (n || 0).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
function ds(d){ return d.toLocaleDateString("en-CA"); }
function num(s){ const m = String(s).replace(/[$,]/g, "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; }
function setStatus(msg){ $("status").textContent = msg; }
function dedupe(arr){ const seen = {}; const out = []; for (const s of arr){ if (!seen[s.id]){ seen[s.id] = 1; out.push(s); } } return out; }

async function load(){
  const st = await chrome.storage.local.get(["hist", "sites", "lastSync"]);
  hist = st.hist || {};
  sites = st.sites || [];
  if (st.lastSync) $("lastSync").textContent = "Last sync: " + new Date(st.lastSync).toLocaleString();
}
async function save(){ await chrome.storage.local.set({hist: hist, sites: sites, lastSync: Date.now()}); }

async function discoverSites(){
  const re = /<option[^>]*value="([0-9a-fA-F-]{36})"[^>]*>\s*([^<]+?)\s*<\/option>/g;
  for (const p of REPORT_PATHS){
    try {
      const res = await fetch(BASE + p, {credentials: "include"});
      const html = await res.text();
      if (/login/i.test(res.url) || /type="password"/i.test(html)) continue;
      const found = [];
      let m;
      while ((m = re.exec(html))) found.push({id: m[1], name: m[2].trim()});
      if (found.length) return dedupe(found).filter(s => !/customer level/i.test(s.name));
    } catch(e){}
  }
  return [];
}

async function fetchDay(siteId, date){
  try {
    const res = await fetch(BASE + "/IndexFilterTableDaily", {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: "StartDate=" + date + "&SiteId=" + siteId
    });
    if (!res.ok) return null;
    return parseReport(await res.text(), siteId, date);
  } catch(e){ return null; }
}

function parseReport(html, siteId, date){
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return null;
  const rows = Array.from(table.querySelectorAll("tr"));
  const headRow = rows.find(r => r.querySelector("th") && /Timestamp/i.test(r.textContent));
  if (!headRow) return null;
  const headers = Array.from(headRow.children).map(c => c.textContent.trim());
  const sumRow = rows.find(r => /Daily Sum Total/i.test(r.textContent));
  const countRow = rows.find(r => /Daily Count Total/i.test(r.textContent));
  const mapRow = (row) => {
    const out = {};
    if (!row) return out;
    const cells = Array.from(row.children);
    for (let i = 1; i < cells.length && i < headers.length; i++) out[headers[i]] = cells[i].textContent.trim();
    return out;
  };
  const sums = mapRow(sumRow);
  const counts = mapRow(countRow);
  return {
    date: date, siteId: siteId,
    revenue: sumRow ? num(sumRow.children[0].textContent) : 0,
    cash: num(sums["Cash"]), credit: num(sums["Credit Card"]),
    sales: num(counts["Sales"]), washes: num(counts["Washes"]), perWash: num(counts["$/ Wash"]),
    passUse: num(counts["Pass Use"]), vacPassUse: num(counts["Vac Pass Use"]),
    passRenew: num(counts["Pass Renew"]), newPass: num(counts["New Pass"]),
    declined: num(counts["Declined"]), passCancelled: num(counts["Pass Cancelled"]),
    renewFailure: num(counts["Renew Failure"]),
    viaTrig: num(counts["VIA Trig"]), viaOops: num(counts["VIA Oops"]),
    viaPay: num(counts["VIA Pay"]), viaRep: num(counts["VIA Rep"]), viaAdd: num(counts["VIA Add"])
  };
}

async function sync(){
  $("syncBtn").disabled = true;
  setStatus("Discovering sites...");
  const found = await discoverSites();
  if (found.length) sites = found;
  if (!sites.length){
    setStatus("Not logged in or site detection failed. Log into admin.dencar.sancsoft.net in this browser, then press Sync again.");
    $("syncBtn").disabled = false;
    return;
  }
  const today = new Date();
  const todayStr = ds(today);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const yestStr = ds(yest);
  const dates = [];
  for (let i = DAYS_BACK - 1; i >= 0; i--){ const d = new Date(today); d.setDate(d.getDate() - i); dates.push(ds(d)); }
  const tasks = [];
  for (const s of sites){
    hist[s.id] = hist[s.id] || {};
    for (const dt of dates){ if (!hist[s.id][dt] || dt === todayStr || dt === yestStr) tasks.push([s.id, dt]); }
  }
  let done = 0;
  for (const t of tasks){
    setStatus("Syncing " + (done + 1) + " / " + tasks.length);
    const rec = await fetchDay(t[0], t[1]);
    if (rec) hist[t[0]][t[1]] = rec;
    done++;
    if (done % 20 === 0){ await save(); render(); }
    await new Promise(r => setTimeout(r, 120));
  }
  await save();
  $("lastSync").textContent = "Last sync: " + new Date().toLocaleString();
  setStatus("Done. Synced " + tasks.length + " reports.");
  $("syncBtn").disabled = false;
  render();
}

function totalsByDate(){
  const out = {};
  for (const sid of Object.keys(hist)){
    for (const dt of Object.keys(hist[sid])){ out[dt] = (out[dt] || 0) + (hist[sid][dt].revenue || 0); }
  }
  return out;
}

function siteAvgWeekday(sid, refDate){
  const vals = [];
  for (let i = 7; i <= 35; i += 7){
    const d = new Date(refDate); d.setDate(d.getDate() - i);
    const r = (hist[sid] || {})[ds(d)];
    if (r) vals.push(r.revenue || 0);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function projection(byDate){
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = ds(today);
  let mtd = 0;
  for (const dt of Object.keys(byDate)){ if (dt.slice(0, 7) === todayStr.slice(0, 7) && dt <= todayStr) mtd += byDate[dt]; }
  const wk = [[], [], [], [], [], [], []];
  for (let i = 1; i <= 56; i++){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const v = byDate[ds(d)];
    if (v !== undefined) wk[d.getDay()].push(v);
  }
  const avg = wk.map(a => a.length ? a.reduce((x, b) => x + b, 0) / a.length : 0);
  let rest = 0;
  for (let day = today.getDate() + 1; day <= daysInMonth; day++){ rest += avg[new Date(y, m, day).getDay()]; }
  const todayRemain = Math.max(0, avg[today.getDay()] - (byDate[todayStr] || 0));
  return {mtd: mtd, projected: mtd + todayRemain + rest};
}

function render(){
  const today = new Date();
  const todayStr = ds(today);
  const byDate = totalsByDate();
  const wkStart = new Date(today); wkStart.setDate(wkStart.getDate() - today.getDay());
  let wtd = 0;
  for (const dt of Object.keys(byDate)){ if (dt >= ds(wkStart) && dt <= todayStr) wtd += byDate[dt]; }
  const p = projection(byDate);
  $("sumToday").textContent = fmtMoney(byDate[todayStr] || 0);
  $("sumWtd").textContent = fmtMoney(wtd);
  $("sumMtd").textContent = fmtMoney(p.mtd);
  $("sumProj").textContent = fmtMoney(p.projected);
  renderSiteCards(todayStr, today);
  renderChart(byDate, today);
  renderVia(today);
  renderAnomalies(today);
}

function renderSiteCards(todayStr, today){
  const wrap = $("siteCards");
  wrap.innerHTML = "";
  for (const s of sites){
    const r = (hist[s.id] || {})[todayStr] || {};
    const avg = siteAvgWeekday(s.id, today);
    const rev = r.revenue || 0;
    const delta = avg ? Math.round((rev - avg) / avg * 100) : 0;
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = "<h3>" + s.name + "</h3>" +
      "<div class=\"big\">" + fmtMoney(rev) + "</div>" +
      "<div class=\"row\"><span>Washes: " + (r.washes || 0) + "</span><span>$/wash: " + fmtMoney(r.perWash || 0) + "</span></div>" +
      "<div class=\"row\"><span>Renews: " + (r.passRenew || 0) + "</span><span>New: " + (r.newPass || 0) + "</span><span>Declined: " + (r.declined || 0) + "</span></div>" +
      "<div class=\"delta " + (delta >= 0 ? "up" : "down") + "\">" + (avg ? (delta >= 0 ? "+" : "") + delta + "% vs 4wk avg" : "no history yet") + "</div>";
    wrap.appendChild(div);
  }
}

function renderChart(byDate, today){
  const c = $("chart");
  const ctx = c.getContext("2d");
  const labels = [], vals = [];
  for (let i = 29; i >= 0; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = ds(d);
    labels.push(k.slice(5));
    vals.push(byDate[k] || 0);
  }
  const W = c.width = c.clientWidth * 2;
  const H = c.height = 360;
  ctx.clearRect(0, 0, W, H);
  const max = Math.max.apply(null, vals.concat([1]));
  const padL = 80, padB = 40, padT = 20, padR = 20;
  ctx.strokeStyle = "#3a4a63";
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();
  ctx.fillStyle = "#8fa3c0";
  ctx.font = "20px system-ui";
  ctx.fillText(fmtMoney(max), 4, padT + 16);
  const xw = (W - padL - padR) / (vals.length - 1);
  ctx.strokeStyle = "#4da3ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  vals.forEach((v, i) => {
    const x = padL + i * xw;
    const yv = H - padB - (v / max) * (H - padB - padT);
    if (i === 0) ctx.moveTo(x, yv); else ctx.lineTo(x, yv);
  });
  ctx.stroke();
  ctx.fillStyle = "#8fa3c0";
  for (let i = 0; i < labels.length; i += 5){ ctx.fillText(labels[i], padL + i * xw - 20, H - 10); }
}

function renderVia(today){
  const tb = $("viaBody");
  tb.innerHTML = "";
  for (const s of sites){
    let t = 0, o = 0, pa = 0, rp = 0, ad = 0;
    for (let i = 0; i < 7; i++){
      const d = new Date(today); d.setDate(d.getDate() - i);
      const r = (hist[s.id] || {})[ds(d)];
      if (r){ t += r.viaTrig || 0; o += r.viaOops || 0; pa += r.viaPay || 0; rp += r.viaRep || 0; ad += r.viaAdd || 0; }
    }
    const un = Math.max(0, t - (o + pa + rp + ad));
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + s.name + "</td><td>" + t + "</td><td>" + o + "</td><td>" + pa + "</td><td>" + rp + "</td><td>" + ad + "</td><td class=\"" + (un > 0 ? "flag" : "") + "\">" + un + "</td>";
    tb.appendChild(tr);
  }
}

function renderAnomalies(today){
  const ul = $("anomalies");
  ul.innerHTML = "";
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const yStr = ds(yest);
  const items = [];
  for (const s of sites){
    const r = (hist[s.id] || {})[yStr];
    if (!r) continue;
    const avg = siteAvgWeekday(s.id, yest);
    if (avg > 0){
      const pct = Math.round((r.revenue - avg) / avg * 100);
      if (pct <= -40) items.push(s.name + ": yesterday revenue " + pct + "% vs 4wk avg (" + fmtMoney(r.revenue) + " vs " + fmtMoney(avg) + ")");
      if (pct >= 80) items.push(s.name + ": yesterday revenue +" + pct + "% vs 4wk avg");
    }
    if ((r.declined || 0) >= 5) items.push(s.name + ": " + r.declined + " declined transactions yesterday");
    if ((r.renewFailure || 0) >= 3) items.push(s.name + ": " + r.renewFailure + " renew failures yesterday");
    if ((r.passCancelled || 0) >= 3) items.push(s.name + ": " + r.passCancelled + " passes cancelled yesterday");
  }
  if (!items.length){
    const li = document.createElement("li");
    li.textContent = "No anomalies detected";
    li.className = "ok";
    ul.appendChild(li);
    return;
  }
  for (const it of items){
    const li = document.createElement("li");
    li.textContent = it;
    ul.appendChild(li);
  }
}

async function init(){
  await load();
  render();
  $("syncBtn").addEventListener("click", sync);
}
document.addEventListener("DOMContentLoaded", init);
