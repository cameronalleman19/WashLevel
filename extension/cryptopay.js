const CP_BASE = "https://www.mycryptopay.com";
const CP_SCHEMA = 1;
const CP_HIST_SCHEMA = 1;

let cpSites = [];
let cpStatus = {};
let cpHist = {};

function cpSetStatus(msg){ $("cryptoStatus").textContent = msg; }

function cpShowSessionBanner(show){
  const b = $("cpSessionBanner");
  if (b) b.hidden = !show;
}

function cpDs(d){ return d.toLocaleDateString("en-CA"); }

function cpFmtCpDate(d){
  return String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getDate()).padStart(2, "0") + "/" + d.getFullYear();
}

function cpMoney(n){ return "$" + (n || 0).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2}); }

function cpMoneyNum(s){ const m = String(s).replace(/[$,]/g, "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; }

function cpBackfillStart(){ const n = new Date(); return new Date(n.getFullYear(), 0, 1); }

async function cpLoad(){
  const st = await chrome.storage.local.get(["cpSites", "cpStatus", "cpLastSync", "cpSchema"]);
  if (st.cpSchema !== CP_SCHEMA){
    cpStatus = {};
    await chrome.storage.local.set({cpStatus: {}, cpSchema: CP_SCHEMA});
  } else {
    cpStatus = st.cpStatus || {};
  }
  cpSites = st.cpSites || [];
  if (st.cpLastSync) $("cpLastSync").textContent = "Last sync: " + new Date(st.cpLastSync).toLocaleString();
}

async function cpSave(){
  await chrome.storage.local.set({cpSites: cpSites, cpStatus: cpStatus, cpLastSync: Date.now(), cpSchema: CP_SCHEMA});
}

async function cpDiscoverSites(){
  try {
    const res = await fetch(CP_BASE + "/login/index.php?page=sitestatus", {credentials: "include"});
    const html = await res.text();
    if (/type="password"/i.test(html) || !/selection-entry/.test(html)) return {sites: [], loggedOut: true};
    const re = /id="siteselect_([A-Za-z0-9]+)"[^>]*>.*?<span class="site-name">([^<]+)<\/span>/gs;
    const found = [];
    let m;
    while ((m = re.exec(html))) found.push({id: m[1], name: m[2].trim()});
    return {sites: found, loggedOut: false};
  } catch(e){
    return {sites: [], loggedOut: false, error: true};
  }
}

function cpParseDevices(html){
  const doc = new DOMParser().parseFromString(html, "text/html");
  const headers = Array.from(doc.querySelectorAll("h3"));
  const statusHeader = headers.find(h => /CryptoPay Device Status/i.test(h.textContent));
  if (!statusHeader) return [];
  let el = statusHeader.nextElementSibling;
  while (el && el.tagName !== "BLOCKQUOTE") el = el.nextElementSibling;
  if (!el) return [];
  const table = el.querySelector("table");
  if (!table) return [];
  const rows = Array.from(table.querySelectorAll("tr")).slice(1);
  const devices = [];
  for (const row of rows){
    const cells = Array.from(row.children);
    if (cells.length < 4) continue;
    const name = cells[0].textContent.trim();
    const idMatch = cells[1].textContent.match(/ID:\s*([A-Za-z0-9]+)/);
    const deviceId = idMatch ? idMatch[1] : "";
    const status = cells[3].textContent.trim() || "Unknown";
    let activatable = false;
    if (cells.length >= 5){
      const span = cells[4].querySelector('span[onclick*="showRemoteStartConfirm"]');
      if (span) activatable = true;
    }
    if (deviceId) devices.push({name: name, id: deviceId, status: status, activatable: activatable});
  }
  return devices;
}

async function cpFetchStatus(siteId){
  try {
    const res = await fetch(CP_BASE + "/login/api.php?page=sitestatus_inner&siteid=" + siteId, {credentials: "include"});
    const html = await res.text();
    if (/type="password"/i.test(html)) return {devices: [], loggedOut: true};
    return {devices: cpParseDevices(html), loggedOut: false};
  } catch(e){
    return {devices: [], loggedOut: false, error: true};
  }
}

async function cpSync(){
  $("cpSyncBtn").disabled = true;
  cpShowSessionBanner(false);
  cpSetStatus("Discovering sites...");
  const disc = await cpDiscoverSites();
  if (disc.loggedOut){
    cpShowSessionBanner(true);
    cpSetStatus("Not logged in. Log into MyCryptoPay in this browser, then press Sync again.");
    $("cpSyncBtn").disabled = false;
    return;
  }
  if (disc.sites.length) cpSites = disc.sites;
  if (!cpSites.length){
    cpSetStatus("No sites found.");
    $("cpSyncBtn").disabled = false;
    return;
  }
  let done = 0;
  let loggedOutMidSync = false;
  for (const s of cpSites){
    cpSetStatus("Syncing " + (done + 1) + " / " + cpSites.length + " - " + s.name);
    const r = await cpFetchStatus(s.id);
    if (r.loggedOut){ loggedOutMidSync = true; break; }
    cpStatus[s.id] = {name: s.name, devices: r.devices || [], lastUpdated: Date.now()};
    done++;
    await new Promise(res => setTimeout(res, 150));
  }
  await cpSave();
  if (loggedOutMidSync){
    cpShowSessionBanner(true);
    cpSetStatus("Session expired mid-sync. Log in and press Sync again.");
  } else {
    cpSetStatus("Done. Synced " + done + " site" + (done === 1 ? "" : "s") + ".");
  }
  $("cpSyncBtn").disabled = false;
  cpRender();
}

function cpRender(){
  const wrap = $("cpSites");
  if (!wrap) return;
  wrap.innerHTML = "";
  const siteIds = Object.keys(cpStatus);
  if (!siteIds.length){
    wrap.innerHTML = "<p>No data yet. Press Sync.</p>";
    return;
  }
  for (const sid of siteIds){
    const site = cpStatus[sid];
    const div = document.createElement("div");
    div.className = "card";
    let rows = "";
    for (const d of site.devices){
      const statusClass = /connected/i.test(d.status) ? "cp-ok" : "cp-down";
      const actBtn = d.activatable
        ? "<button class=\"cp-activate\" data-site=\"" + sid + "\" data-device=\"" + d.id + "\" data-name=\"" + d.name.replace(/"/g, "&quot;") + "\">Activate</button>"
        : "";
      rows += "<tr><td>" + d.name + "</td><td class=\"" + statusClass + "\">" + d.status + "</td><td>" + actBtn + "</td></tr>";
    }
    div.innerHTML = "<h3>" + site.name + "</h3>" +
      "<table class=\"via\"><thead><tr><th>Device</th><th>Status</th><th></th></tr></thead><tbody>" + rows + "</tbody></table>";
    wrap.appendChild(div);
  }
  Array.from(document.querySelectorAll(".cp-activate")).forEach(btn => {
    btn.addEventListener("click", () => cpActivate(btn.dataset.site, btn.dataset.device, btn.dataset.name));
  });
}

async function cpActivate(siteId, deviceId, deviceName){
  const site = cpStatus[siteId];
  const siteName = site ? site.name : siteId;
  const ok = confirm("Activate " + deviceName + " at " + siteName + "?\n\nThis will immediately start a wash cycle.");
  if (!ok) return;
  cpSetStatus("Activating " + deviceName + "...");
  try {
    const res = await fetch(CP_BASE + "/login/api.php?page=remotestart&siteid=" + siteId + "&deviceid=" + deviceId, {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/x-www-form-urlencoded"}
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch(e){ data = null; }
    if (!data){
      cpShowSessionBanner(true);
      cpSetStatus("Session expired - could not activate. Log in and try again.");
      return;
    }
    if (data.response === "success"){
      cpSetStatus(deviceName + " activated: " + ((data.return && data.return.message) || "Success"));
    } else {
      cpSetStatus(deviceName + " activation failed: " + ((data.return && data.return.message) || JSON.stringify(data)));
    }
  } catch(e){
    cpSetStatus("Network error activating " + deviceName + ".");
  }
}

function cpParseCsvLine(line){
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++){
    const c = line[i];
    if (inQuotes){
      if (c === '"'){
        if (line[i + 1] === '"'){ cur += '"'; i++; } else { inQuotes = false; }
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ","){ out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function cpParseCsv(text){
  const lines = text.split(/\r\n|\n/).filter(l => l.length);
  if (!lines.length) return [];
  const headers = cpParseCsvLine(lines[0]);
  const out = [];
  for (let i = 1; i < lines.length; i++){
    const vals = cpParseCsvLine(lines[i]);
    if (vals.length < headers.length) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = vals[j];
    out.push(row);
  }
  return out;
}

async function cpFetchCsvRange(startDate, endDate){
  try {
    const url = CP_BASE + "/login/index.php?page=report_data&siteid=all&startdate=" + encodeURIComponent(startDate) + "&enddate=" + encodeURIComponent(endDate);
    const res = await fetch(url, {credentials: "include"});
    const text = await res.text();
    if (/type="password"/i.test(text) || !/TransactionID/.test(text)) return {rows: [], loggedOut: true};
    return {rows: cpParseCsv(text), loggedOut: false};
  } catch(e){
    return {rows: [], loggedOut: false, error: true};
  }
}

function cpAggregateCsv(rows){
  const seen = {};
  const bySiteDate = {};
  for (const r of rows){
    const tid = r.TransactionID;
    if (seen[tid]) continue;
    seen[tid] = 1;
    const siteId = r.SiteID;
    const date = (r.Time || "").slice(0, 10);
    if (!date || !siteId) continue;
    const amt = cpMoneyNum(r.TotalCharge);
    bySiteDate[siteId] = bySiteDate[siteId] || {};
    bySiteDate[siteId][date] = bySiteDate[siteId][date] || {revenue: 0, count: 0};
    bySiteDate[siteId][date].revenue += amt;
    bySiteDate[siteId][date].count += 1;
  }
  return bySiteDate;
}

function cpMonthRanges(start, end){
  const out = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end){
    const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const monthEndCandidate = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const monthEnd = monthEndCandidate < end ? monthEndCandidate : end;
    const mKey = cur.getFullYear() + "-" + String(cur.getMonth() + 1).padStart(2, "0");
    out.push([monthStart, monthEnd, mKey]);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}

function cpSumRange(sid, from, to){
  const out = {revenue: 0, count: 0};
  for (const dt of Object.keys(cpHist[sid] || {})){
    if (dt >= from && dt <= to){
      const r = cpHist[sid][dt];
      out.revenue += r.revenue || 0;
      out.count += r.count || 0;
    }
  }
  return out;
}

function cpAllSitesRange(from, to){
  const out = {revenue: 0, count: 0};
  for (const sid of Object.keys(cpHist)){
    const t = cpSumRange(sid, from, to);
    out.revenue += t.revenue;
    out.count += t.count;
  }
  return out;
}

function cpAvgTicket(t){ return t.count ? t.revenue / t.count : 0; }

function cpPeriodRow(label, t){
  return "<tr><td>" + label + "</td><td>" + cpMoney(t.revenue) + "</td><td>" + t.count + "</td><td>" + cpMoney(cpAvgTicket(t)) + "</td></tr>";
}

async function cpOvLoad(){
  const st = await chrome.storage.local.get(["cpHist", "cpHistLastSync", "cpHistSchema"]);
  if (st.cpHistSchema !== CP_HIST_SCHEMA){
    cpHist = {};
    await chrome.storage.local.set({cpHist: {}, cpHistSchema: CP_HIST_SCHEMA});
  } else {
    cpHist = st.cpHist || {};
  }
  if (st.cpHistLastSync){
    const el = $("cpOvLastSync");
    if (el) el.textContent = "Last sync: " + new Date(st.cpHistLastSync).toLocaleString();
  }
}

async function cpOvSave(){
  await chrome.storage.local.set({cpHist: cpHist, cpHistLastSync: Date.now(), cpHistSchema: CP_HIST_SCHEMA});
}

async function cpOvSync(){
  $("cpOvSyncBtn").disabled = true;
  cpShowSessionBanner(false);
  $("cpOvStatus").textContent = "Discovering sites...";
  const disc = await cpDiscoverSites();
  if (disc.loggedOut){
    cpShowSessionBanner(true);
    $("cpOvStatus").textContent = "Not logged in. Log into MyCryptoPay in this browser, then press Sync again.";
    $("cpOvSyncBtn").disabled = false;
    return;
  }
  if (disc.sites.length) cpSites = disc.sites;
  await cpSave();

  const today = new Date();
  const start = cpBackfillStart();
  const months = cpMonthRanges(start, today);
  const curMonthKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");

  let loggedOutMidSync = false;
  let monthsFetched = 0;
  for (const rng of months){
    const mStart = rng[0], mEnd = rng[1], mKey = rng[2];
    const alreadyHave = mKey !== curMonthKey && cpSites.length && cpSites.every(function(s){
      const siteHist = cpHist[s.id] || {};
      return Object.keys(siteHist).some(function(d){ return d.indexOf(mKey) === 0; });
    });
    if (alreadyHave) continue;

    $("cpOvStatus").textContent = "Syncing " + mStart.toLocaleDateString("en-US", {month: "short", year: "numeric"}) + "...";
    const r = await cpFetchCsvRange(cpFmtCpDate(mStart), cpFmtCpDate(mEnd));
    if (r.loggedOut){ loggedOutMidSync = true; break; }
    const agg = cpAggregateCsv(r.rows);
    for (const siteId of Object.keys(agg)){
      cpHist[siteId] = cpHist[siteId] || {};
      Object.assign(cpHist[siteId], agg[siteId]);
    }
    monthsFetched++;
    await cpOvSave();
    cpOvRender();
    await new Promise(res => setTimeout(res, 200));
  }

  if (loggedOutMidSync){
    cpShowSessionBanner(true);
    $("cpOvStatus").textContent = "Session expired mid-sync. Log in and press Sync again.";
  } else {
    $("cpOvStatus").textContent = "Done. Synced " + monthsFetched + " month" + (monthsFetched === 1 ? "" : "s") + " of data.";
  }
  $("cpOvSyncBtn").disabled = false;
  cpOvRender();
}

function cpTotalsByDate(){
  const out = {};
  for (const sid of Object.keys(cpHist)){
    for (const dt of Object.keys(cpHist[sid])){
      out[dt] = (out[dt] || 0) + (cpHist[sid][dt].revenue || 0);
    }
  }
  return out;
}

function cpSiteAvgWeekday(sid, refDate){
  const vals = [];
  for (let i = 7; i <= 35; i += 7){
    const d = new Date(refDate); d.setDate(d.getDate() - i);
    const r = (cpHist[sid] || {})[cpDs(d)];
    if (r) vals.push(r.revenue || 0);
  }
  return vals.length ? vals.reduce(function(a, b){ return a + b; }, 0) / vals.length : 0;
}

function cpProjection(byDate){
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = cpDs(today);
  let mtd = 0;
  for (const dt of Object.keys(byDate)){ if (dt.slice(0, 7) === todayStr.slice(0, 7) && dt <= todayStr) mtd += byDate[dt]; }
  const wk = [[], [], [], [], [], [], []];
  for (let i = 1; i <= 56; i++){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const v = byDate[cpDs(d)];
    if (v !== undefined) wk[d.getDay()].push(v);
  }
  const avg = wk.map(function(a){ return a.length ? a.reduce(function(x, b){ return x + b; }, 0) / a.length : 0; });
  let rest = 0;
  for (let day = today.getDate() + 1; day <= daysInMonth; day++){ rest += avg[new Date(y, m, day).getDay()]; }
  const todayRemain = Math.max(0, avg[today.getDay()] - (byDate[todayStr] || 0));
  return {mtd: mtd, projected: mtd + todayRemain + rest};
}

function cpOvRender(){
  const today = new Date();
  const todayStr = cpDs(today);
  const byDate = cpTotalsByDate();
  const wkStart = new Date(today); wkStart.setDate(wkStart.getDate() - today.getDay());
  let wtd = 0;
  for (const dt of Object.keys(byDate)){ if (dt >= cpDs(wkStart) && dt <= todayStr) wtd += byDate[dt]; }
  const p = cpProjection(byDate);
  const yestD = new Date(today); yestD.setDate(yestD.getDate() - 1);
  const lwStart = new Date(wkStart); lwStart.setDate(lwStart.getDate() - 7);
  const lwEnd = new Date(wkStart); lwEnd.setDate(lwEnd.getDate() - 1);
  const lmFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lmLast = new Date(today.getFullYear(), today.getMonth(), 0);
  let lastWk = 0, lastMo = 0;
  for (const dt of Object.keys(byDate)){
    if (dt >= cpDs(lwStart) && dt <= cpDs(lwEnd)) lastWk += byDate[dt];
    if (dt >= cpDs(lmFirst) && dt <= cpDs(lmLast)) lastMo += byDate[dt];
  }
  if (!$("cpOvToday")) return;
  $("cpOvYest").textContent = cpMoney(byDate[cpDs(yestD)] || 0);
  $("cpOvLastWk").textContent = cpMoney(lastWk);
  $("cpOvLastMo").textContent = cpMoney(lastMo);
  $("cpOvToday").textContent = cpMoney(byDate[todayStr] || 0);
  $("cpOvWtd").textContent = cpMoney(wtd);
  $("cpOvMtd").textContent = cpMoney(p.mtd);
  $("cpOvProj").textContent = cpMoney(p.projected);
  const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
  const allTicket = cpAllSitesRange(cpDs(d30), todayStr);
  const avgTicketEl = $("cpOvAvgTicket");
  if (avgTicketEl) avgTicketEl.textContent = cpMoney(cpAvgTicket(allTicket));
  if (typeof wlTips === "function") wlTips("cpOvTiles", WL_TIP_CP_OVERVIEW);
  cpOvRenderSiteCards(todayStr, today);
  cpOvRenderChart(byDate, today);
  cpOvRenderAnomalies(today);
}

function cpOvSiteList(){
  if (cpSites.length) return cpSites;
  return Object.keys(cpHist).map(function(id){ return {id: id, name: (cpStatus[id] && cpStatus[id].name) || id}; });
}

function cpOvRenderSiteCards(todayStr){
  const wrap = $("cpOvSiteCards");
  if (!wrap) return;
  wrap.innerHTML = "";
  const today = new Date();
  const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
  const siteList = cpOvSiteList();
  for (const s of siteList){
    const r = (cpHist[s.id] || {})[todayStr] || {revenue: 0, count: 0};
    const t30 = cpSumRange(s.id, cpDs(d30), todayStr);
    const avg = cpSiteAvgWeekday(s.id, today);
    const delta = avg ? Math.round((r.revenue - avg) / avg * 100) : 0;
    const bigHelp = "Sum of this site's CryptoPay transaction totals (sales tax included) for today.";
    const txHelp = "Transactions: number of separate purchases today. Avg ticket: this site's revenue divided by its transaction count over the last 30 days.";
    const deltaHelp = avg
      ? "Today's revenue compared with this site's average for the same weekday over the previous 4 weeks (" + cpMoney(avg) + ")."
      : "Not enough history yet for this site to compare against the same weekday in previous weeks.";
    const div = document.createElement("div");
    div.className = "card clickable";
    div.innerHTML = "<h3>" + s.name + "</h3>" +
      "<div class=\"big\" title=\"" + bigHelp + "\">" + cpMoney(r.revenue) + "</div>" +
      "<div class=\"row\" title=\"" + txHelp + "\"><span>Transactions: " + r.count + "</span><span>Avg ticket (30d): " + cpMoney(cpAvgTicket(t30)) + "</span></div>" +
      "<div class=\"delta " + (delta >= 0 ? "up" : "down") + "\" title=\"" + deltaHelp + "\">" + (avg ? (delta >= 0 ? "+" : "") + delta + "% vs 4wk avg" : "no history yet") + "</div>";
    div.addEventListener("click", () => cpOpenDetail(s));
    wrap.appendChild(div);
  }
}

function cpOpenDetail(site){
  const today = new Date();
  const todayStr = cpDs(today);
  const modal = $("detailModal");
  if (!modal) return;
  const wkStart = new Date(today); wkStart.setDate(wkStart.getDate() - today.getDay());
  const moStart = todayStr.slice(0, 8) + "01";
  let rows = "";
  rows += cpPeriodRow("Today", cpSumRange(site.id, todayStr, todayStr));
  rows += cpPeriodRow("This week", cpSumRange(site.id, cpDs(wkStart), todayStr));
  rows += cpPeriodRow("This month", cpSumRange(site.id, moStart, todayStr));
  const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
  rows += cpPeriodRow("Last 30 days", cpSumRange(site.id, cpDs(d30), todayStr));
  const d90 = new Date(today); d90.setDate(d90.getDate() - 89);
  rows += cpPeriodRow("Last 90 days", cpSumRange(site.id, cpDs(d90), todayStr));

  let dailyRows = "";
  for (let i = 13; i >= 0; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = cpDs(d);
    const rec = (cpHist[site.id] || {})[k];
    if (rec){
      dailyRows += "<tr><td>" + fmtDate(k) + "</td><td>" + cpMoney(rec.revenue) + "</td><td>" + rec.count + "</td><td>" + cpMoney(cpAvgTicket(rec)) + "</td></tr>";
    }
  }
  if (!dailyRows) dailyRows = "<tr><td colspan=\"4\">No activity recorded</td></tr>";

  $("detailBody").innerHTML =
    "<h2>" + site.name + "</h2>" +
    "<h3>Period totals</h3>" +
    "<table class=\"via\"><thead><tr><th>Period</th><th>Revenue</th><th>Transactions</th><th>Avg ticket</th></tr></thead><tbody>" + rows + "</tbody></table>" +
    "<h3>Revenue - last 30 days</h3>" +
    "<canvas id=\"cpSiteChart\"></canvas>" +
    "<h3>Last 14 days</h3>" +
    "<table class=\"via\"><thead><tr><th>Date</th><th>Revenue</th><th>Transactions</th><th>Avg ticket</th></tr></thead><tbody>" + dailyRows + "</tbody></table>";
  modal.style.display = "flex";

  const chartDates = [], vals = [];
  for (let i = 29; i >= 0; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = cpDs(d);
    chartDates.push(k);
    vals.push(((cpHist[site.id] || {})[k] || {}).revenue || 0);
  }
  const chartCanvas = $("cpSiteChart");
  if (chartCanvas && typeof drawLine === "function") drawLine(chartCanvas, vals, chartDates);
}

function cpOvRenderChart(byDate, today){
  const dates = [], vals = [];
  for (let i = 29; i >= 0; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = cpDs(d);
    dates.push(k);
    vals.push(byDate[k] || 0);
  }
  const canvas = $("cpOvChart");
  if (canvas && typeof drawLine === "function") drawLine(canvas, vals, dates);
}

function cpOvRenderAnomalies(today){
  const ul = $("cpOvAnomalies");
  if (!ul) return;
  ul.innerHTML = "";
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const yStr = cpDs(yest);
  const items = [];
  const siteList = cpOvSiteList();
  for (const s of siteList){
    const r = (cpHist[s.id] || {})[yStr];
    if (!r) continue;
    const avg = cpSiteAvgWeekday(s.id, yest);
    if (avg > 0){
      const pct = Math.round((r.revenue - avg) / avg * 100);
      if (pct <= -40) items.push(s.name + ": yesterday revenue " + pct + "% vs 4wk avg (" + cpMoney(r.revenue) + " vs " + cpMoney(avg) + ")");
      if (pct >= 80) items.push(s.name + ": yesterday revenue +" + pct + "% vs 4wk avg");
    }
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

async function cpInit(){
  await cpLoad();
  cpRender();
  await cpOvLoad();
  cpOvRender();
  const btn = $("cpSyncBtn");
  if (btn) btn.addEventListener("click", cpSync);
  const ovBtn = $("cpOvSyncBtn");
  if (ovBtn) ovBtn.addEventListener("click", cpOvSync);
}
document.addEventListener("DOMContentLoaded", cpInit);
