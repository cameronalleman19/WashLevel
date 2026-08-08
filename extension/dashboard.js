const BASE = "https://admin.dencar.sancsoft.net";
const SCHEMA = 3;
const REPORT_PATHS = ["/", "/Home", "/Home/Index", "/DailyReports", "/Home/DailyReports", "/Reports/DailyReports", "/DailyReport"];
const $ = (id) => document.getElementById(id);

let hist = {};
let sites = [];

function backfillStart(){ const n = new Date(); return new Date(n.getFullYear(), 0, 1); }
function fmtMoney(n){ return "$" + (n || 0).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
function ds(d){ return d.toLocaleDateString("en-CA"); }
function fmtDate(k){ const p = k.split("-"); return parseInt(p[1], 10) + "/" + parseInt(p[2], 10) + "/" + p[0]; }
function num(s){ const m = String(s).replace(/[$,]/g, "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; }
function setStatus(msg){ $("status").textContent = msg; }
function dedupe(arr){ const seen = {}; const out = []; for (const s of arr){ if (!seen[s.id]){ seen[s.id] = 1; out.push(s); } } return out; }

function retail(r){
  const rw = Math.max(0, (r.washes || 0) - (r.passUse || 0));
  const excl = (r.newPassAmt || 0) + (r.passRenewAmt || 0) + (r.viaPayAmt || 0) + (r.viaAddAmt || 0) + (r.newPassOnlineAmt || 0) + (r.onlineGiftAmt || 0);
  const rr = Math.max(0, (r.revenue || 0) - excl);
  return {washes: rw, revenue: rr, per: rw ? rr / rw : 0};
}

function latestMembers(sid){
  const days = Object.keys(hist[sid] || {}).sort();
  for (let i = days.length - 1; i >= 0; i--){
    const v = hist[sid][days[i]].consumerVehicles || 0;
    if (v > 0) return v;
  }
  return 0;
}

function passUseRange(sid, from, to){
  let n = 0;
  for (const dt of Object.keys(hist[sid] || {})){ if (dt >= from && dt <= to) n += hist[sid][dt].passUse || 0; }
  return n;
}

async function load(){
  const st = await chrome.storage.local.get(["hist", "sites", "lastSync", "schema"]);
  if (st.schema !== SCHEMA){
    hist = {};
    await chrome.storage.local.set({hist: {}, schema: SCHEMA});
    setStatus("Data format updated - press Sync to rebuild history.");
  } else {
    hist = st.hist || {};
  }
  sites = st.sites || [];
  if (st.lastSync) $("lastSync").textContent = "Last sync: " + new Date(st.lastSync).toLocaleString();
}
async function save(){ await chrome.storage.local.set({hist: hist, sites: sites, lastSync: Date.now(), schema: SCHEMA}); }

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
  const hourly = [];
  for (const row of rows){
    if (row === headRow || row === sumRow || row === countRow) continue;
    const cells = Array.from(row.children);
    let ti = -1;
    for (let i = 0; i < cells.length; i++){
      if (/^\d{1,2}:\d{2}/.test(cells[i].textContent.trim())){ ti = i; break; }
    }
    if (ti === -1) continue;
    hourly.push({
      h: parseInt(cells[ti].textContent.trim(), 10),
      sales: num(cells[ti + 1] && cells[ti + 1].textContent),
      washes: num(cells[ti + 2] && cells[ti + 2].textContent),
      cash: num(cells[ti + 4] && cells[ti + 4].textContent),
      credit: num(cells[ti + 5] && cells[ti + 5].textContent)
    });
  }
  hourly.sort((a, b) => a.h - b.h);
  return {
    date: date, siteId: siteId,
    revenue: sumRow ? num(sumRow.children[0].textContent) : 0,
    cash: num(sums["Cash"]), credit: num(sums["Credit Card"]),
    passRenewAmt: num(sums["Pass Renew"]), newPassAmt: num(sums["New Pass"]),
    viaPayAmt: num(sums["VIA Pay"]), viaAddAmt: num(sums["VIA Add"]),
    newPassOnlineAmt: num(sums["New Pass Online"]), onlineGiftAmt: num(sums["Online Gift Pass"]),
    sales: num(counts["Sales"]), washes: num(counts["Washes"]), perWash: num(counts["$/ Wash"]),
    passUse: num(counts["Pass Use"]), vacPassUse: num(counts["Vac Pass Use"]),
    passRenew: num(counts["Pass Renew"]), newPass: num(counts["New Pass"]),
    declined: num(counts["Declined"]), passCancelled: num(counts["Pass Cancelled"]),
    renewFailure: num(counts["Renew Failure"]),
    consumerVehicles: num(counts["Consumer Vehicles"]),
    viaTrig: num(counts["VIA Trig"]), viaOops: num(counts["VIA Oops"]),
    viaPay: num(counts["VIA Pay"]), viaRep: num(counts["VIA Rep"]), viaAdd: num(counts["VIA Add"]),
    hourly: hourly
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
  for (let d = backfillStart(); ds(d) <= todayStr; d.setDate(d.getDate() + 1)){ dates.push(ds(d)); }
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
  const yestD = new Date(today); yestD.setDate(yestD.getDate() - 1);
  const lwStart = new Date(wkStart); lwStart.setDate(lwStart.getDate() - 7);
  const lwEnd = new Date(wkStart); lwEnd.setDate(lwEnd.getDate() - 1);
  const lmFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lmLast = new Date(today.getFullYear(), today.getMonth(), 0);
  let lastWk = 0, lastMo = 0;
  for (const dt of Object.keys(byDate)){
    if (dt >= ds(lwStart) && dt <= ds(lwEnd)) lastWk += byDate[dt];
    if (dt >= ds(lmFirst) && dt <= ds(lmLast)) lastMo += byDate[dt];
  }
  $("sumYest").textContent = fmtMoney(byDate[ds(yestD)] || 0);
  $("sumLastWk").textContent = fmtMoney(lastWk);
  $("sumLastMo").textContent = fmtMoney(lastMo);
  $("sumToday").textContent = fmtMoney(byDate[todayStr] || 0);
  $("sumWtd").textContent = fmtMoney(wtd);
  $("sumMtd").textContent = fmtMoney(p.mtd);
  $("sumProj").textContent = fmtMoney(p.projected);
  const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
  let totUse = 0, totMembers = 0;
  for (const s of sites){
    totUse += passUseRange(s.id, ds(d30), todayStr);
    totMembers += latestMembers(s.id);
  }
  $("sumMemberUse").textContent = totMembers ? (totUse / totMembers).toFixed(1) + "x" : "--";
  renderSiteCards(todayStr, today);
  renderChart(byDate, today);
  renderVia(today);
  renderAnomalies(today);
}

function renderSiteCards(todayStr, today){
  const wrap = $("siteCards");
  wrap.innerHTML = "";
  const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
  for (const s of sites){
    const r = (hist[s.id] || {})[todayStr] || {};
    const rt = retail(r);
    const avg = siteAvgWeekday(s.id, today);
    const rev = r.revenue || 0;
    const delta = avg ? Math.round((rev - avg) / avg * 100) : 0;
    const members = latestMembers(s.id);
    const use30 = passUseRange(s.id, ds(d30), todayStr);
    const memberUse = members ? (use30 / members).toFixed(1) + "x" : "--";
    const div = document.createElement("div");
    div.className = "card clickable";
    div.innerHTML = "<h3>" + s.name + "</h3>" +
      "<div class=\"big\">" + fmtMoney(rev) + "</div>" +
      "<div class=\"row\"><span>Washes: " + (r.washes || 0) + "</span><span>Overall $/wash: " + fmtMoney(r.perWash || 0) + "</span></div>" +
      "<div class=\"row\"><span>Retail washes: " + rt.washes + "</span><span>Retail $/wash: " + fmtMoney(rt.per) + "</span></div>" +
      "<div class=\"row\"><span>Members: " + members + "</span><span>Use/member 30d: " + memberUse + "</span></div>" +
      "<div class=\"row\"><span>Renews: " + (r.passRenew || 0) + "</span><span>New: " + (r.newPass || 0) + "</span><span>Declined: " + (r.declined || 0) + "</span></div>" +
      "<div class=\"delta " + (delta >= 0 ? "up" : "down") + "\">" + (avg ? (delta >= 0 ? "+" : "") + delta + "% vs 4wk avg" : "no history yet") + "</div>";
    div.addEventListener("click", () => openDetail(s));
    wrap.appendChild(div);
  }
}

function sumRange(sid, from, to){
  const out = {revenue: 0, washes: 0, passUse: 0, newPassAmt: 0, passRenewAmt: 0, viaPayAmt: 0, viaAddAmt: 0, newPassOnlineAmt: 0, onlineGiftAmt: 0, sales: 0, days: 0};
  for (const dt of Object.keys(hist[sid] || {})){
    if (dt >= from && dt <= to){
      const r = hist[sid][dt];
      out.revenue += r.revenue || 0; out.washes += r.washes || 0; out.passUse += r.passUse || 0;
      out.newPassAmt += r.newPassAmt || 0; out.passRenewAmt += r.passRenewAmt || 0;
      out.viaPayAmt += r.viaPayAmt || 0; out.viaAddAmt += r.viaAddAmt || 0;
      out.newPassOnlineAmt += r.newPassOnlineAmt || 0; out.onlineGiftAmt += r.onlineGiftAmt || 0;
      out.sales += r.sales || 0; out.days++;
    }
  }
  return out;
}

function periodRow(label, t, members){
  const rt = retail(t);
  const overall = t.washes ? t.revenue / t.washes : 0;
  const mu = members ? (t.passUse / members).toFixed(1) + "x" : "--";
  return "<tr><td>" + label + "</td><td>" + fmtMoney(t.revenue) + "</td><td>" + t.washes + "</td><td>" + fmtMoney(overall) + "</td><td>" + rt.washes + "</td><td>" + fmtMoney(rt.per) + "</td><td>" + t.passUse + "</td><td>" + mu + "</td></tr>";
}

function openDetail(site){
  const today = new Date();
  const todayStr = ds(today);
  const modal = $("detailModal");
  const r = (hist[site.id] || {})[todayStr];
  const members = latestMembers(site.id);
  const wkStart = new Date(today); wkStart.setDate(wkStart.getDate() - today.getDay());
  const moStart = todayStr.slice(0, 8) + "01";
  let rows = "";
  rows += periodRow("Today", sumRange(site.id, todayStr, todayStr), members);
  rows += periodRow("This week", sumRange(site.id, ds(wkStart), todayStr), members);
  rows += periodRow("This month", sumRange(site.id, moStart, todayStr), members);
  const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
  rows += periodRow("Last 30 days", sumRange(site.id, ds(d30), todayStr), members);
  const d90 = new Date(today); d90.setDate(d90.getDate() - 89);
  rows += periodRow("Last 90 days", sumRange(site.id, ds(d90), todayStr), members);
  let hourlyRows = "";
  if (r && r.hourly && r.hourly.length){
    for (const h of r.hourly){
      if (h.washes){
        hourlyRows += "<tr><td>" + String(h.h).padStart(2, "0") + ":00</td><td>" + h.washes + "</td></tr>";
      }
    }
  }
  if (!hourlyRows) hourlyRows = "<tr><td colspan=\"2\">No hourly activity recorded today</td></tr>";
  let monthRows = "";
  const yr = today.getFullYear();
  let ytdUse = 0;
  const moCount = today.getMonth() + 1;
  for (let mo = 0; mo <= today.getMonth(); mo++){
    const from = ds(new Date(yr, mo, 1));
    const to = mo === today.getMonth() ? todayStr : ds(new Date(yr, mo + 1, 0));
    const use = passUseRange(site.id, from, to);
    ytdUse += use;
    const label = new Date(yr, mo, 1).toLocaleString("en-US", {month: "long"});
    monthRows += "<tr><td>" + label + "</td><td>" + use + "</td><td>" + (members ? (use / members).toFixed(1) + "x" : "--") + "</td></tr>";
  }
  monthRows += "<tr><td><strong>YTD monthly avg</strong></td><td><strong>" + ytdUse + " total</strong></td><td><strong>" + (members ? (ytdUse / moCount / members).toFixed(1) + "x" : "--") + "</strong></td></tr>";
  let dailyRows = "";
  for (let i = 13; i >= 0; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = ds(d);
    const rec = (hist[site.id] || {})[k];
    if (rec){
      const rt = retail(rec);
      dailyRows += "<tr><td>" + fmtDate(k) + "</td><td>" + fmtMoney(rec.revenue) + "</td><td>" + rec.washes + "</td><td>" + fmtMoney(rec.perWash) + "</td><td>" + rt.washes + "</td><td>" + fmtMoney(rt.per) + "</td><td>" + (rec.passUse || 0) + "</td></tr>";
    }
  }
  $("detailBody").innerHTML =
    "<h2>" + site.name + " <span class=\"members\">(" + members + " members)</span></h2>" +
    "<h3>Period totals</h3>" +
    "<table class=\"via\"><thead><tr><th>Period</th><th>Revenue</th><th>Washes</th><th>Overall $/wash</th><th>Retail washes</th><th>Retail $/wash</th><th>Pass uses</th><th>Use/member</th></tr></thead><tbody>" + rows + "</tbody></table>" +
    "<h3>Today by hour</h3>" +
    "<table class=\"via\"><thead><tr><th>Hour</th><th>Washes</th></tr></thead><tbody>" + hourlyRows + "</tbody></table>" +
    "<h3>Member usage by month</h3>" +
    "<table class=\"via\"><thead><tr><th>Month</th><th>Pass uses</th><th>Use/member</th></tr></thead><tbody>" + monthRows + "</tbody></table>" +
    "<h3>Revenue - last 30 days</h3>" +
    "<canvas id=\"siteChart\"></canvas>" +
    "<h3>Last 14 days</h3>" +
    "<table class=\"via\"><thead><tr><th>Date</th><th>Revenue</th><th>Washes</th><th>Overall $/wash</th><th>Retail washes</th><th>Retail $/wash</th><th>Member washes</th></tr></thead><tbody>" + dailyRows + "</tbody></table>";
  modal.style.display = "flex";
  const chartDates = [], vals = [];
  for (let i = 29; i >= 0; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = ds(d);
    chartDates.push(k);
    vals.push(((hist[site.id] || {})[k] || {}).revenue || 0);
  }
  drawLine($("siteChart"), vals, chartDates);
}

function drawLine(c, vals, dates){
  const ctx = c.getContext("2d");
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
  const pts = [];
  vals.forEach((v, i) => {
    const x = padL + i * xw;
    const yv = H - padB - (v / max) * (H - padB - padT);
    pts.push(x);
    if (i === 0) ctx.moveTo(x, yv); else ctx.lineTo(x, yv);
  });
  ctx.stroke();
  ctx.fillStyle = "#8fa3c0";
  for (let i = 0; i < dates.length; i += 5){
    const p = dates[i].split("-");
    ctx.fillText(parseInt(p[1], 10) + "/" + parseInt(p[2], 10), padL + i * xw - 20, H - 10);
  }
  c.__data = {vals: vals, dates: dates, pts: pts};
  if (!c.__hoverBound){
    c.__hoverBound = true;
    const tip = document.createElement("div");
    tip.className = "chart-tip";
    tip.style.display = "none";
    document.body.appendChild(tip);
    c.addEventListener("mousemove", (e) => {
      const d = c.__data;
      if (!d) return;
      const rect = c.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (c.width / rect.width);
      let best = 0, bd = 1e9;
      d.pts.forEach((px, i) => { const dist = Math.abs(px - mx); if (dist < bd){ bd = dist; best = i; } });
      tip.textContent = fmtDate(d.dates[best]) + ": " + fmtMoney(d.vals[best]);
      tip.style.display = "block";
      tip.style.left = (e.pageX + 14) + "px";
      tip.style.top = (e.pageY - 34) + "px";
    });
    c.addEventListener("mouseleave", () => { tip.style.display = "none"; });
  }
}

function renderChart(byDate, today){
  const dates = [], vals = [];
  for (let i = 29; i >= 0; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = ds(d);
    dates.push(k);
    vals.push(byDate[k] || 0);
  }
  drawLine($("chart"), vals, dates);
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
  $("detailClose").addEventListener("click", () => { $("detailModal").style.display = "none"; });
  $("detailModal").addEventListener("click", (e) => { if (e.target === $("detailModal")) $("detailModal").style.display = "none"; });
}
document.addEventListener("DOMContentLoaded", init);
