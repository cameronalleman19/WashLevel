const M$ = (id) => document.getElementById(id);

function mEsc(s){ const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
function mMoney(n){ return "$" + (n || 0).toFixed(2); }
function mDate(t){ if (!t) return "--"; const d = new Date(t); return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear(); }
function mMonthKey(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function mAddMonths(d, n){ return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function mMonthLabel(key){ const p = key.split("-"); return new Date(p[0], p[1] - 1, 1).toLocaleString("en-US", {month: "short", year: "numeric"}); }

let mConsumers = {}, mHist = {}, mSites = [], mViaSeen = {}, mCohortBase = {};
let mSelectedSite = null;
function mFilteredSites(){ return mSelectedSite ? mSites.filter(s => s.id === mSelectedSite) : mSites; }

async function memLoad(){
  const st = (await chrome.storage.local.get(["consumers", "hist", "sites", "viaSeen", "memCohortBase"])) || {};
  mConsumers = st.consumers || {};
  mHist = st.hist || {};
  mSites = st.sites || [];
  mViaSeen = st.viaSeen || {};
  mCohortBase = st.memCohortBase || {};
}

function mHasBuckets(){
  return Object.values(mConsumers).some(c => c.months && Object.keys(c.months).length);
}

function mRecentRate(c){
  const now = new Date();
  const months = c.months || {};
  const curKey = mMonthKey(now);
  const prevD = mAddMonths(now, -1);
  const prevKey = mMonthKey(prevD);
  const dim = new Date(prevD.getFullYear(), prevD.getMonth() + 1, 0).getDate();
  const days = now.getDate() + dim;
  const n = (months[curKey] || 0) + (months[prevKey] || 0);
  return n / days * 30;
}

function mBaseline(c){
  const now = new Date();
  const months = c.months || {};
  let n = 0, tot = 0;
  for (let i = 2; i <= 13; i++){
    const d = mAddMonths(now, -i);
    if (c.signup && d < mAddMonths(new Date(c.signup), 0)) break;
    tot += months[mMonthKey(d)] || 0;
    n++;
  }
  return n >= 2 ? tot / n : null;
}

function mViaRecent(c){
  const cut = Date.now() - 45 * 86400000;
  const nameKey = (c.name || "").toLowerCase().replace(/[^a-z]/g, "");
  for (const k of Object.keys(mViaSeen || {})){
    const nk = String(k).toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (nk !== c.id.toLowerCase() && nk !== nameKey) continue;
    const v = mViaSeen[k];
    if (Array.isArray(v)){
      for (const x of v){
        const t = (x && typeof x === "object") ? (x.t || x.time || 0) : x;
        if (typeof t === "number" && t > cut) return true;
      }
    } else if (typeof v === "number"){
      if (v > cut) return true;
    } else if (v){
      return true;
    }
  }
  return false;
}

function mIsCancelled(c){
  return !!(c.cancelled && c.cancelled > (c.lastNew || 0));
}

function mScore(c){
  const reasons = [];
  let score = 0;
  const now = Date.now();
  const tenure = c.signup ? (now - c.signup) / 86400000 : 9999;
  const dormant = c.lastWash ? (now - c.lastWash) / 86400000 : tenure;
  const recent = mRecentRate(c);
  const base = mBaseline(c);
  if (dormant > 21 && dormant < 9000){ score += 40; reasons.push("No wash in " + Math.round(dormant) + "d"); }
  if (base !== null && base >= 2 && recent < base * 0.5){ score += 30; reasons.push("Usage down " + Math.round((1 - recent / base) * 100) + "%"); }
  if (tenure < 60 && consPerMonth(c) < 2){ score += 20; reasons.push("New member, low usage"); }
  if (mViaRecent(c)){ score += 15; reasons.push("Recent VIA exception"); }
  return {score: score, reasons: reasons, recent: recent, base: base};
}

function mRenderChart(){
  const cv = M$("memChart");
  if (!cv || typeof wlLineChart !== "function") return;
  const today = new Date();
  const labels = [], vals = [];
  for (let i = 29; i >= 0; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = mDs(d);
    labels.push(k);
    vals.push(mMemberDay(k).rev);
  }
  wlLineChart(cv, labels, vals);
}

function mInitCollapsible(){
  const page = document.getElementById("page-members");
  if (!page) return;
  const prefs = JSON.parse(localStorage.getItem("memCollapsed") || "{}");
  page.querySelectorAll("h2").forEach(h => {
    const key = h.textContent.trim().replace(/\s*[\u25B6\u25BC]\s*$/, "").trim();
    // Wrap following siblings until next h2 in a container div
    let wrap = h.nextElementSibling;
    if (wrap && wrap.classList.contains("mem-collapse-wrap")) return; // already initialized
    const div = document.createElement("div");
    div.className = "mem-collapse-wrap";
    let sib = h.nextSibling;
    while (sib && !(sib.nodeType === 1 && sib.tagName === "H2")){
      const next = sib.nextSibling;
      div.appendChild(sib);
      sib = next;
    }
    h.parentNode.insertBefore(div, sib);
    // Add arrow
    const arrow = document.createElement("span");
    arrow.className = "collapse-arrow";
    arrow.style.cssText = "margin-left:8px;font-size:12px";
    h.appendChild(arrow);
    // Apply saved state
    const collapsed = prefs[key] || false;
    div.style.display = collapsed ? "none" : "";
    arrow.textContent = collapsed ? "\u25B6" : "\u25BC";
    // Click handler
    h.style.cursor = "pointer";
    h.addEventListener("click", () => {
      const isHidden = div.style.display === "none";
      div.style.display = isHidden ? "" : "none";
      arrow.textContent = isHidden ? "\u25BC" : "\u25B6";
      const p = JSON.parse(localStorage.getItem("memCollapsed") || "{}");
      p[key] = !isHidden;
      localStorage.setItem("memCollapsed", JSON.stringify(p));
    });
  });
}

function mRenderLostMembers(){
  const tb = M$("memLostBody");
  if (!tb) return;
  const sel = M$("memLostPeriod");
  const days = sel ? parseInt(sel.value) || 30 : 30;
  const cut = Date.now() - days * 86400000;
  const lost = Object.values(mConsumers).filter(c => {
    if (!c.signup) return false;
    const lastBill = Math.max(c.lastNew || 0, c.lastRenew || 0);
    if (!lastBill) return false;
    // Cancelled after cutoff
    if (c.cancelled && c.cancelled > (c.lastNew || 0) && c.cancelled > cut) return true;
    // Expired: last billing > 45 days ago but not actively cancelled, and was active before
    if (!c.cancelled || c.cancelled <= (c.lastNew || 0)){
      if (lastBill < Date.now() - 45 * 86400000 && lastBill > cut) return true;
    }
    return false;
  });
  if (!lost.length){
    tb.innerHTML = "<tr><td colspan=\"6\">No recently lost members in this period.</td></tr>";
    return;
  }
  lost.sort((a, b) => {
    const aT = a.cancelled && a.cancelled > (a.lastNew || 0) ? a.cancelled : Math.max(a.lastNew || 0, a.lastRenew || 0);
    const bT = b.cancelled && b.cancelled > (b.lastNew || 0) ? b.cancelled : Math.max(b.lastNew || 0, b.lastRenew || 0);
    return bT - aT;
  });
  tb.innerHTML = "";
  for (const c of lost){
    const wasCancelled = c.cancelled && c.cancelled > (c.lastNew || 0);
    const reason = wasCancelled ? "Cancelled" : "Expired / Declined";
    const reasonStyle = wasCancelled ? "color:#f87171" : "color:#ffd166";
    const lostDate = wasCancelled ? c.cancelled : Math.max(c.lastNew || 0, c.lastRenew || 0);
    const phone = c.phone || "";
    const phoneClean = phone.replace(/[^0-9+]/g, "");
    const phoneLinks = phoneClean
      ? "<a href=\"tel:" + phoneClean + "\" class=\"via-open\">" + mEsc(phone) + "</a> <a href=\"sms:" + phoneClean + "\" class=\"via-open\" title=\"Text\">SMS</a>"
      : "--";
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + mEsc(c.name || "(no name)") + "</td>" +
      "<td>" + phoneLinks + "</td>" +
      "<td style=\"" + reasonStyle + "\">" + reason + "</td>" +
      "<td>" + mDate(lostDate) + "</td>" +
      "<td>" + mEsc(c.washPlan || "--") + "</td>" +
      "<td><a class=\"via-open\" target=\"_blank\" href=\"" + CBASE + "/consumer/" + c.id + "/\">Open</a></td>";
    tb.appendChild(tr);
  }
}

function mRenderIncomplete(){
  const tb = M$("memIncBody");
  if (!tb) return;
  const now = Date.now();
  const incomplete = Object.values(mConsumers).filter(c => {
    if (c.name && c.name !== "(no name)") return false;
    if (!c.signup) return false;
    const renew = new Date(c.signup);
    renew.setMonth(renew.getMonth() + 1);
    return renew.getTime() > now;
  });
  if (!incomplete.length){
    tb.innerHTML = "<tr><td colspan=\"5\">No incomplete signups " + String.fromCharCode(127881) + "</td></tr>";
    return;
  }
  incomplete.sort((a, b) => {
    const ra = new Date(a.signup); ra.setMonth(ra.getMonth() + 1);
    const rb = new Date(b.signup); rb.setMonth(rb.getMonth() + 1);
    return ra.getTime() - rb.getTime();
  });
  tb.innerHTML = "";
  for (const c of incomplete){
    const renew = new Date(c.signup);
    renew.setMonth(renew.getMonth() + 1);
    const daysLeft = Math.ceil((renew.getTime() - now) / 86400000);
    const phone = c.phone || "--";
    const phoneClean = phone.replace(/[^0-9+]/g, "");
    const phoneLinks = phoneClean
      ? "<a href=\"tel:" + phoneClean + "\" class=\"via-open\">" + mEsc(phone) + "</a> <a href=\"sms:" + phoneClean + "\" class=\"via-open\" title=\"Text\">SMS</a>"
      : mEsc(phone);
    const daysStyle = daysLeft <= 3
      ? " style=\"color:#f87171;font-weight:600\""
      : daysLeft <= 7
        ? " style=\"color:#ffd166;font-weight:600\""
        : "";
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + phoneLinks + "</td>" +
      "<td>" + mDate(c.signup) + "</td>" +
      "<td" + daysStyle + ">" + daysLeft + "d</td>" +
      "<td>" + mEsc(c.favSite || "--") + "</td>" +
      "<td><a class=\"via-open\" target=\"_blank\" href=\"" + CBASE + "/consumer/" + c.id + "/\">Open</a></td>";
    tb.appendChild(tr);
  }
}

function mRenderRisk(){
  const tb = M$("memRiskBody");
  tb.innerHTML = "";
  if (!mHasBuckets()){
    tb.innerHTML = "<tr><td colspan=\"6\">Monthly usage data not built yet. Go to Consumers and press Sync Consumers once, then Recalculate here.</td></tr>";
    return;
  }
  const scored = [];
  for (const c of Object.values(mConsumers)){
    if (mIsCancelled(c)) continue;
    const lastBill = Math.max(c.lastNew || 0, c.lastRenew || 0);
    if (!lastBill || Date.now() - lastBill > 45 * 86400000) continue;
    const r = mScore(c);
    if (r.score >= 25) scored.push({c: c, r: r});
  }
  scored.sort((a, b) => b.r.score - a.r.score);
  if (!scored.length){ tb.innerHTML = "<tr><td colspan=\"6\">No at-risk members flagged.</td></tr>"; return; }
  for (const x of scored.slice(0, 75)){
    const lvl = x.r.score >= 50 ? "HIGH" : "MED";
    const tr = document.createElement("tr");
    tr.innerHTML = "<td><a class=\"via-open\" target=\"_blank\" href=\"" + CBASE + "/consumer/" + x.c.id + "/\">" + mEsc(x.c.name) + "</a></td>" +
      "<td>" + lvl + " (" + x.r.score + ")</td>" +
      "<td>" + mEsc(x.r.reasons.join("; ")) + "</td>" +
      "<td>" + x.r.recent.toFixed(1) + "</td>" +
      "<td>" + (x.r.base === null ? "--" : x.r.base.toFixed(1)) + "</td>" +
      "<td>" + mDate(x.c.lastWash) + "</td>";
    tb.appendChild(tr);
  }
}

async function mRenderCohorts(){
  const tb = M$("memCohortBody");
  tb.innerHTML = "";
  const now = new Date();
  const byCohort = {};
  for (const c of Object.values(mConsumers)){
    if (!c.signup) continue;
    const key = mMonthKey(new Date(c.signup));
    (byCohort[key] = byCohort[key] || []).push(c);
  }
  let changed = false;
  for (const key of Object.keys(byCohort)){
    if (!mCohortBase[key] || byCohort[key].length > mCohortBase[key]){ mCohortBase[key] = byCohort[key].length; changed = true; }
  }
  if (changed) await chrome.storage.local.set({memCohortBase: mCohortBase});
  const keys = Object.keys(byCohort).sort().slice(-13);
  let any = false;
  for (const key of keys){
    const p = key.split("-");
    const cohortStart = new Date(p[0], p[1] - 1, 1);
    if (mMonthKey(cohortStart) === mMonthKey(now)) continue;
    const base = mCohortBase[key] || byCohort[key].length;
    let cells = "";
    for (const n of [1, 3, 6, 12]){
      const target = mAddMonths(cohortStart, n);
      if (target >= mAddMonths(now, 0)){ cells += "<td>--</td>"; continue; }
      const end = mAddMonths(cohortStart, n + 1).getTime();
      const paying = byCohort[key].filter(c => !(c.cancelled && c.cancelled < end && c.cancelled > (c.lastNew || 0))).length;
      cells += "<td>" + Math.round(paying / base * 100) + "%</td>";
    }
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + mMonthLabel(key) + "</td><td>" + base + "</td>" + cells;
    tb.appendChild(tr);
    any = true;
  }
  if (!any) tb.innerHTML = "<tr><td colspan=\"6\">No cohort data yet.</td></tr>";
}

function mDs(d){ return d.toLocaleDateString("en-CA"); }

function mMemberDay(dateStr){
  const out = {rev: 0, passUse: 0};
  for (const s of mFilteredSites()){
    const rec = (mHist[s.id] || {})[dateStr];
    if (!rec) continue;
    out.rev += (rec.newPassAmt || 0) + (rec.passRenewAmt || 0) + (rec.newPassOnlineAmt || 0) + (rec.onlineGiftAmt || 0) + (rec.viaAddAmt || 0);
    out.passUse += rec.passUse || 0;
  }
  return out;
}

function mMemberRange(from, to){
  const out = {rev: 0, passUse: 0};
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end){
    const t = mMemberDay(mDs(d));
    out.rev += t.rev; out.passUse += t.passUse;
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function mMoney0(n){ return "$" + Math.round(n || 0).toLocaleString("en-US"); }

function mTile(label, val){
  return "<div class=\"stat\"><label>" + label + "</label><div>" + val + "</div></div>";
}

function mAllTimeHigh(){
  const daySums = {};
  for (const s of mFilteredSites()){
    for (const dt of Object.keys(mHist[s.id] || {})){
      const v = mHist[s.id][dt].consumerVehicles || 0;
      if (v) daySums[dt] = (daySums[dt] || 0) + v;
    }
  }
  let max = 0;
  for (const dt of Object.keys(daySums)){ if (daySums[dt] > max) max = daySums[dt]; }
  return max;
}

function mTimeRange(){
  const sel = M$("memTimeFrame");
  const v = sel ? sel.value : "mtd";
  const today = new Date();
  const todayStr = mDs(today);
  if (v === "today") return {from: todayStr, to: todayStr, label: "Today"};
  if (v === "7d"){ const d = new Date(today); d.setDate(d.getDate() - 6); return {from: mDs(d), to: todayStr, label: "Last 7 days"}; }
  if (v === "30d"){ const d = new Date(today); d.setDate(d.getDate() - 29); return {from: mDs(d), to: todayStr, label: "Last 30 days"}; }
  if (v === "mtd") return {from: todayStr.slice(0, 8) + "01", to: todayStr, label: "Month to date"};
  if (v === "ytd") return {from: today.getFullYear() + "-01-01", to: todayStr, label: "Year to date"};
  if (/^\d{4}-\d{2}$/.test(v)){
    const p = v.split("-"); const y = parseInt(p[0]), m = parseInt(p[1]) - 1;
    const start = new Date(y, m, 1); const end = new Date(y, m + 1, 0);
    return {from: mDs(start), to: end > today ? todayStr : mDs(end), label: start.toLocaleString("en-US", {month: "long", year: "numeric"})};
  }
  if (/^\d{4}$/.test(v)){
    const y = parseInt(v);
    return {from: y + "-01-01", to: y === today.getFullYear() ? todayStr : y + "-12-31", label: v};
  }
  return {from: todayStr.slice(0, 8) + "01", to: todayStr, label: "Month to date"};
}

function mPopulateTimeFrame(){
  const sel = M$("memTimeFrame");
  if (!sel) return;
  const cur = sel.value || "mtd";
  const today = new Date();
  let html = '<option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="mtd">Month to date</option>';
  html += '<optgroup label="Months">';
  for (let i = 1; i <= 24; i++){
    const d = mAddMonths(today, -i); const k = mMonthKey(d);
    html += '<option value="' + k + '">' + d.toLocaleString("en-US", {month: "long", year: "numeric"}) + '</option>';
  }
  html += '</optgroup><option value="ytd">Year to date</option><optgroup label="Years">';
  for (let y = today.getFullYear(); y >= today.getFullYear() - 5; y--) html += '<option value="' + y + '">' + y + '</option>';
  html += '</optgroup>';
  sel.innerHTML = html;
  sel.value = cur;
}

function mRenderTiles(){
  const el = M$("memTiles");
  if (!el) return;
  const tr = mTimeRange();
  const r = mMemberRange(tr.from, tr.to);
  const fromD = new Date(tr.from + "T00:00:00");
  const toD = new Date(tr.to + "T00:00:00");
  const days = Math.max(1, Math.round((toD - fromD) / 86400000) + 1);
  const members = mLatestVehicles() || Object.keys(mConsumers).length;
  const ath = mAllTimeHigh();
  el.innerHTML =
    mTile("Active members (vehicles)", members) +
    mTile("All-time high", ath || "--") +
    mTile("Member sales (" + tr.label + ")", mMoney0(r.rev)) +
    mTile("Pass uses", r.passUse.toLocaleString("en-US")) +
    mTile("Member $/wash", r.passUse ? "$" + (r.rev / r.passUse).toFixed(2) : "--") +
    mTile("Avg daily revenue", mMoney0(r.rev / days));
}

function mLatestVehicles(){
  let tot = 0;
  for (const s of mFilteredSites()){
    const days = Object.keys(mHist[s.id] || {}).sort();
    for (let i = days.length - 1; i >= 0; i--){
      const v = mHist[s.id][days[i]].consumerVehicles || 0;
      if (v){ tot += v; break; }
    }
  }
  return tot;
}

function mMonthAgg(){
  const out = {};
  for (const s of mFilteredSites()){
    for (const dt of Object.keys(mHist[s.id] || {})){
      const mk = dt.slice(0, 7);
      const r = mHist[s.id][dt];
      const o = out[mk] = out[mk] || {news: 0, cancels: 0, declines: 0, renewAmt: 0, renews: 0};
      o.news += (r.newPass || 0) + (r.newPassOnline || 0);
      o.cancels += r.passCancelled || 0;
      o.declines += r.declined || 0;
      o.renewAmt += r.passRenewAmt || 0;
      o.renews += r.passRenew || 0;
    }
  }
  return out;
}

function mRenderEconomics(){
  const el = M$("memLtv");
  const agg = mMonthAgg();
  const now = new Date();
  const full = [];
  for (let i = 1; i <= 3; i++){
    const k = mMonthKey(mAddMonths(now, -i));
    if (agg[k]) full.push(agg[k]);
  }
  const members = mLatestVehicles() || Object.keys(mConsumers).length;
  if (!full.length || !members){ el.innerHTML = "<div class=\"stat\"><label>Economics</label><div>Need consumer sync + report history</div></div>"; return; }
  const cancels = full.reduce((a, x) => a + x.cancels, 0) / full.length;
  const renewAmt = full.reduce((a, x) => a + x.renewAmt, 0);
  const renews = full.reduce((a, x) => a + x.renews, 0);
  const churn = cancels / members;
  const avgPrice = renews ? renewAmt / renews : 0;
  const lifeMo = churn > 0 ? 1 / churn : null;
  const ltv = lifeMo && avgPrice ? avgPrice * lifeMo : null;
  el.innerHTML =
    "<div class=\"stat\"><label>Active members (vehicles)</label><div>" + members + "</div></div>" +
    "<div class=\"stat\"><label>Monthly churn</label><div>" + (churn * 100).toFixed(1) + "%</div></div>" +
    "<div class=\"stat\"><label>Avg renewal price</label><div>" + mMoney(avgPrice) + "</div></div>" +
    "<div class=\"stat\"><label>Est. avg lifetime</label><div>" + (lifeMo ? lifeMo.toFixed(1) + " mo" : "--") + "</div></div>" +
    "<div class=\"stat\"><label>Est. LTV</label><div>" + (ltv ? mMoney(ltv) : "--") + "</div></div>";
}

function mRenderNet(){
  const tb = M$("memNetBody");
  tb.innerHTML = "";
  const agg = mMonthAgg();
  const keys = Object.keys(agg).sort().slice(-13);
  if (!keys.length){ tb.innerHTML = "<tr><td colspan=\"5\">No report history. Press Sync on Overview.</td></tr>"; return; }
  for (const k of keys.reverse()){
    const o = agg[k];
    const net = o.news - o.cancels;
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + mMonthLabel(k) + "</td><td>" + o.news + "</td><td>" + o.cancels + "</td><td>" + (net >= 0 ? "+" : "") + net + "</td><td>" + o.declines + "</td>";
    tb.appendChild(tr);
  }
}

async function mRenderConversions(){
  await platesLoad();
  const el = M$("memConversions");
  if (!el) return;
  const si = mSelectedSite ? pSiteIdx(mSelectedSite, mSites) : null;
  const conv = plateConversions(si, null, null);
  el.innerHTML = "<h2>New Pass Conversion \u2014 Prior Retail Visits</h2>" + pRenderConversionsHtml(conv);
}

function mTenureRate(c){
  const mo = c.signup ? Math.min(12, Math.max((Date.now() - c.signup) / 2592000000, 1)) : 12;
  return c.washes / (mo * (c.veh || 1));
}
function mRecentRateVeh(c){
  return mRecentRate(c) / (c.veh || 1);
}

function mBarChart(buckets, labels, color){
  const max = Math.max.apply(null, buckets.map(b => b)) || 1;
  let html = '<div style="display:flex;align-items:flex-end;gap:4px;height:130px;margin:8px 0 4px">';
  for (let i = 0; i < buckets.length; i++){
    const pct = buckets[i] / max * 100;
    const h = Math.max(pct, buckets[i] ? 3 : 0);
    html += '<div style="flex:1;text-align:center;display:flex;flex-direction:column;justify-content:flex-end;height:100%">' +
      '<div style="font-size:11px;color:#b9c6da;margin-bottom:2px">' + (buckets[i] || '') + '</div>' +
      '<div style="background:' + color + ';height:' + h + '%;min-height:' + (buckets[i] ? 2 : 0) + 'px;border-radius:3px 3px 0 0"></div>' +
      '<div style="font-size:11px;color:#8fa3c0;margin-top:3px">' + labels[i] + '</div></div>';
  }
  html += '</div>';
  return html;
}

function mRenderFrequency(){
  const el = M$("memFrequency");
  if (!el) return;
  const active = Object.values(mConsumers).filter(c => {
    if (mIsCancelled(c)) return false;
    const lastBill = Math.max(c.lastNew || 0, c.lastRenew || 0);
    return lastBill && Date.now() - lastBill <= 45 * 86400000;
  });
  if (!active.length){ el.innerHTML = "<p>No active members with usage data.</p>"; return; }
  const labels = ["0x","1x","2x","3x","4x","5x","6x","7x","8x+"];
  const recentBuckets = new Array(9).fill(0);
  for (const c of active){
    const r = Math.round(mRecentRateVeh(c));
    recentBuckets[Math.min(r, 8)]++;
  }
  el.innerHTML = mBarChart(recentBuckets, labels, "#4f8ef7");
}

function mRenderTierBreakdown(){
  const el = M$("memTiers");
  if (!el) return;
  const active = Object.values(mConsumers).filter(c => {
    if (mIsCancelled(c)) return false;
    const lastBill = Math.max(c.lastNew || 0, c.lastRenew || 0);
    return lastBill && Date.now() - lastBill <= 45 * 86400000;
  });
  const tiers = {};
  for (const c of active){
    const plan = c.washPlan || "Unknown";
    tiers[plan] = (tiers[plan] || 0) + 1;
  }
  const sorted = Object.entries(tiers).sort((a, b) => b[1] - a[1]);
  if (!sorted.length){ el.innerHTML = "<p>No tier data. Run a consumer sync to populate.</p>"; return; }
  const total = active.length;
  let html = "";
  for (const [plan, count] of sorted){
    const pct = (count / total * 100).toFixed(1);
    html += mTile(plan, count + " (" + pct + "%)");
  }
  el.innerHTML = html;
}

function mRenderCancelTiming(){
  const el = M$("memCancelChart");
  const tb = M$("memCancelBody");
  if (!el || !tb) return;
  const cancelled = Object.values(mConsumers).filter(c => {
    return c.cancelled && c.signup && c.cancelled > (c.lastNew || 0);
  });
  if (!cancelled.length){
    el.innerHTML = "<p>No cancellation data yet.</p>";
    tb.innerHTML = "";
    return;
  }
  const bucketLabels = ["Mo 1","Mo 2","Mo 3","Mo 4","Mo 5","Mo 6","Mo 7-12","12+"];
  const buckets = new Array(8).fill(0);
  for (const c of cancelled){
    const months = (c.cancelled - c.signup) / (30.44 * 86400000);
    if (months < 1) buckets[0]++;
    else if (months < 2) buckets[1]++;
    else if (months < 3) buckets[2]++;
    else if (months < 4) buckets[3]++;
    else if (months < 5) buckets[4]++;
    else if (months < 6) buckets[5]++;
    else if (months < 12) buckets[6]++;
    else buckets[7]++;
  }
  el.innerHTML = mBarChart(buckets, bucketLabels, "#f87171");
  tb.innerHTML = "";
  const total = cancelled.length;
  for (let i = 0; i < bucketLabels.length; i++){
    if (!buckets[i]) continue;
    const tr = document.createElement("tr");
    const pct = (buckets[i] / total * 100).toFixed(1);
    tr.innerHTML = "<td>" + bucketLabels[i] + "</td><td>" + buckets[i] + "</td><td>" + pct + "%</td>";
    tb.appendChild(tr);
  }
}

function mRenderVehicles(){
  const el = M$("memVehicles");
  if (!el) return;
  const active = Object.values(mConsumers).filter(c => {
    if (mIsCancelled(c)) return false;
    const lastBill = Math.max(c.lastNew || 0, c.lastRenew || 0);
    return lastBill && Date.now() - lastBill <= 45 * 86400000;
  });
  const multi = active.filter(c => (c.veh || 1) >= 2);
  const breakdown = {};
  for (const c of multi){
    const v = c.veh || 1;
    const key = v >= 4 ? "4+" : String(v);
    breakdown[key] = (breakdown[key] || 0) + 1;
  }
  let brkHtml = "";
  for (const k of ["2", "3", "4+"]){
    if (breakdown[k]) brkHtml += mTile(k + "-vehicle plans", breakdown[k]);
  }
  el.innerHTML =
    mTile("Multi-vehicle plans", multi.length) +
    mTile("% of active members", active.length
      ? (multi.length / active.length * 100).toFixed(1) + "%"
      : "--") +
    mTile("Avg vehicles (multi)", multi.length
      ? (multi.reduce((a, c) => a + (c.veh || 1), 0) / multi.length).toFixed(1)
      : "--") +
    brkHtml;
}

function mMemberRangeFull(from, to){
  var out = {rev: 0, passUse: 0, news: 0, cancels: 0, declined: 0};
  for (var s of mFilteredSites()){
    for (var dt of Object.keys(mHist[s.id] || {})){
      if (dt < from || dt > to) continue;
      var r = mHist[s.id][dt];
      out.rev += (r.newPassAmt || 0) + (r.passRenewAmt || 0) + (r.newPassOnlineAmt || 0) + (r.onlineGiftAmt || 0) + (r.viaAddAmt || 0);
      out.passUse += r.passUse || 0;
      out.news += (r.newPass || 0) + (r.newPassOnline || 0);
      out.cancels += r.passCancelled || 0;
      out.declined += r.declined || 0;
    }
  }
  out.net = out.news - out.cancels;
  return out;
}

function mMemberSiteRange(sid, from, to){
  var out = {rev: 0, passUse: 0, news: 0, cancels: 0, declined: 0};
  for (var dt of Object.keys(mHist[sid] || {})){
    if (dt < from || dt > to) continue;
    var r = mHist[sid][dt];
    out.rev += (r.newPassAmt || 0) + (r.passRenewAmt || 0) + (r.newPassOnlineAmt || 0) + (r.onlineGiftAmt || 0) + (r.viaAddAmt || 0);
    out.passUse += r.passUse || 0;
    out.news += (r.newPass || 0) + (r.newPassOnline || 0);
    out.cancels += r.passCancelled || 0;
    out.declined += r.declined || 0;
  }
  out.net = out.news - out.cancels;
  return out;
}

function mYoyPc(cur, ly){ return ly ? Math.round((cur - ly) / Math.abs(ly) * 100) : null; }
function mYoySpan(pct){ if (pct === null) return ""; return " <span class=\"delta " + (pct >= 0 ? "up" : "down") + "\">" + (pct >= 0 ? "+" : "") + pct + "%</span>"; }

function mRenderYoY(){
  var el = M$("memYoY");
  if (!el) return;
  var today = new Date();
  var todayStr = mDs(today);
  var moStart = todayStr.slice(0,8) + "01";
  var ytdStart = todayStr.slice(0,4) + "-01-01";
  var lyRef = new Date(today); lyRef.setFullYear(lyRef.getFullYear() - 1);
  var lyMoStart = mDs(lyRef).slice(0,8) + "01", lyMoEnd = mDs(lyRef);
  var lyYtdStart = mDs(lyRef).slice(0,4) + "-01-01", lyYtdEnd = mDs(lyRef);

  var mtd = mMemberRangeFull(moStart, todayStr);
  var lyMtd = mMemberRangeFull(lyMoStart, lyMoEnd);
  var ytd = mMemberRangeFull(ytdStart, todayStr);
  var lyYtd = mMemberRangeFull(lyYtdStart, lyYtdEnd);

  var html = "";
  html += mTile("Revenue vs LY (MTD)", mMoney0(mtd.rev) + mYoySpan(mYoyPc(mtd.rev, lyMtd.rev)) + "<br><small>LY: " + mMoney0(lyMtd.rev) + "</small>");
  html += mTile("Revenue vs LY (YTD)", mMoney0(ytd.rev) + mYoySpan(mYoyPc(ytd.rev, lyYtd.rev)) + "<br><small>LY: " + mMoney0(lyYtd.rev) + "</small>");
  html += mTile("New passes vs LY (MTD)", mtd.news + mYoySpan(mYoyPc(mtd.news, lyMtd.news)) + "<br><small>LY: " + lyMtd.news + "</small>");
  html += mTile("New passes vs LY (YTD)", ytd.news + mYoySpan(mYoyPc(ytd.news, lyYtd.news)) + "<br><small>LY: " + lyYtd.news + "</small>");
  html += mTile("Cancels vs LY (MTD)", mtd.cancels + mYoySpan(mYoyPc(mtd.cancels, lyMtd.cancels)) + "<br><small>LY: " + lyMtd.cancels + "</small>");
  html += mTile("Cancels vs LY (YTD)", ytd.cancels + mYoySpan(mYoyPc(ytd.cancels, lyYtd.cancels)) + "<br><small>LY: " + lyYtd.cancels + "</small>");
  var netPcMtd = lyMtd.net ? mYoyPc(mtd.net, lyMtd.net) : null;
  var netPcYtd = lyYtd.net ? mYoyPc(ytd.net, lyYtd.net) : null;
  html += mTile("Net vs LY (MTD)", (mtd.net >= 0 ? "+" : "") + mtd.net + mYoySpan(netPcMtd) + "<br><small>LY: " + (lyMtd.net >= 0 ? "+" : "") + lyMtd.net + "</small>");
  html += mTile("Net vs LY (YTD)", (ytd.net >= 0 ? "+" : "") + ytd.net + mYoySpan(netPcYtd) + "<br><small>LY: " + (lyYtd.net >= 0 ? "+" : "") + lyYtd.net + "</small>");

  html += '<div style="margin-top:14px"><div id="memYoYToggles" style="margin-bottom:6px"></div><div id="memYoYView" style="margin-bottom:10px"></div><canvas id="memYoYChart" style="width:100%"></canvas></div>';
  // Per-site table
  if (mSites.length > 1){
    html += "<table class=\"via\" style=\"margin-top:12px\"><thead><tr><th>Site</th><th>Rev MTD</th><th>LY</th><th>YoY</th><th>Rev YTD</th><th>LY</th><th>YoY</th><th>New MTD</th><th>LY</th><th>Cancel MTD</th><th>LY</th></tr></thead><tbody>";
    for (var si of mFilteredSites()){
      var sm = mMemberSiteRange(si.id, moStart, todayStr);
      var slm = mMemberSiteRange(si.id, lyMoStart, lyMoEnd);
      var sy = mMemberSiteRange(si.id, ytdStart, todayStr);
      var sly = mMemberSiteRange(si.id, lyYtdStart, lyYtdEnd);
      var smPc = mYoyPc(sm.rev, slm.rev);
      var syPc = mYoyPc(sy.rev, sly.rev);
      html += "<tr><td>" + si.name + "</td>" +
        "<td>" + mMoney0(sm.rev) + "</td><td>" + mMoney0(slm.rev) + "</td><td>" + (smPc !== null ? (smPc >= 0 ? "+" : "") + smPc + "%" : "--") + "</td>" +
        "<td>" + mMoney0(sy.rev) + "</td><td>" + mMoney0(sly.rev) + "</td><td>" + (syPc !== null ? (syPc >= 0 ? "+" : "") + syPc + "%" : "--") + "</td>" +
        "<td>" + sm.news + "</td><td>" + slm.news + "</td>" +
        "<td>" + sm.cancels + "</td><td>" + slm.cancels + "</td></tr>";
    }
    html += "</tbody></table>";
  }
  el.innerHTML = html;
  // Render YoY chart
  setTimeout(function(){
    var cv = M$("memYoYChart");
    if (!cv || typeof wlYoYChart !== "function") return;
    var metrics = [
      {key: "rev", label: "Revenue", extract: function(r){ return r.rev; }, fmt: mMoney0},
      {key: "news", label: "New Passes", extract: function(r){ return r.news; }, fmt: function(v){ return Math.round(v).toLocaleString(); }},
      {key: "cancels", label: "Cancels", extract: function(r){ return r.cancels; }, fmt: function(v){ return Math.round(v).toLocaleString(); }},
      {key: "net", label: "Net", extract: function(r){ return r.net; }, fmt: function(v){ return (v >= 0 ? "+" : "") + Math.round(v).toLocaleString(); }}
    ];
    var curM = "rev", curV = "mtd";
    function memByDay(extractFn){
      var out = {};
      for (var si of mFilteredSites()){
        for (var dt of Object.keys(mHist[si.id] || {})){
          var r = mHist[si.id][dt];
          var val = extractFn({
            rev: (r.newPassAmt||0)+(r.passRenewAmt||0)+(r.newPassOnlineAmt||0)+(r.onlineGiftAmt||0)+(r.viaAddAmt||0),
            news: (r.newPass||0)+(r.newPassOnline||0),
            cancels: r.passCancelled||0,
            net: (r.newPass||0)+(r.newPassOnline||0)-(r.passCancelled||0)
          });
          out[dt] = (out[dt]||0) + val;
        }
      }
      return out;
    }
    function mtdData(byDay){
      var today = new Date(), yr = today.getFullYear(), mo = today.getMonth(), dn = today.getDate();
      var ty = [], ly = [], lb = [];
      for (var d = 1; d <= dn; d++){
        ty.push(byDay[mDs(new Date(yr, mo, d))]||0);
        ly.push(byDay[mDs(new Date(yr-1, mo, d))]||0);
        lb.push(String(d));
      }
      return {tyVals: ty, lyVals: ly, labels: lb};
    }
    function mo12Data(byDay){
      var today = new Date(), ty = [], ly = [], lb = [];
      for (var i = 11; i >= 0; i--){
        var mr = new Date(today.getFullYear(), today.getMonth()-i, 1);
        var me = new Date(mr.getFullYear(), mr.getMonth()+1, 0);
        var lr = new Date(mr.getFullYear()-1, mr.getMonth(), 1);
        var le = new Date(lr.getFullYear(), lr.getMonth()+1, 0);
        if (mr.getFullYear()===today.getFullYear() && mr.getMonth()===today.getMonth()){ me=today; le=new Date(today.getFullYear()-1,today.getMonth(),today.getDate()); }
        var t=0, l=0;
        for (var dt of Object.keys(byDay)){ if (dt>=mDs(mr)&&dt<=mDs(me)) t+=byDay[dt]; if (dt>=mDs(lr)&&dt<=mDs(le)) l+=byDay[dt]; }
        ty.push(t); ly.push(l); lb.push(mr.toLocaleString("en-US",{month:"short"}));
      }
      return {tyVals: ty, lyVals: ly, labels: lb};
    }
    function draw(){
      var mf = metrics.find(function(m){ return m.key === curM; });
      var byDay = memByDay(mf.extract);
      var data = curV === "mtd" ? mtdData(byDay) : mo12Data(byDay);
      wlYoYChart(cv, data.tyVals, data.lyVals, data.labels, {fmtFn: mf.fmt});
    }
    function btn(l,a){ return '<button style="padding:5px 12px;border-radius:6px;border:1px solid #3a4a63;background:'+(a?'#4da3ff':'#1a2233')+';color:#eaeef5;cursor:pointer;margin-right:5px;font-size:12px">'+l+'</button>'; }
    function renderT(){
      var te = M$("memYoYToggles"), ve = M$("memYoYView");
      if (!te||!ve) return;
      var mH = ""; for (var m of metrics) mH += btn(m.label, m.key === curM);
      te.innerHTML = mH; ve.innerHTML = btn("This Month", curV==="mtd") + btn("Last 12 Months", curV==="12mo");
      var mBs = te.querySelectorAll("button"); for (var i=0;i<mBs.length;i++)(function(idx){mBs[idx].addEventListener("click",function(){curM=metrics[idx].key;renderT();draw();});})(i);
      var vBs = ve.querySelectorAll("button"); vBs[0].addEventListener("click",function(){curV="mtd";renderT();draw();}); vBs[1].addEventListener("click",function(){curV="12mo";renderT();draw();});
    }
    renderT(); draw();
  }, 50);
}

async function memRender(){
  M$("memStatus").textContent = "Calculating...";
  await memLoad();
  mRenderTiles();
  mRenderYoY();
  mRenderEconomics();
  mRenderVehicles();
  mRenderTierBreakdown();
  mRenderChart();
  if (typeof wlTips === "function"){ wlTips("memTiles", WL_TIP_MEM_TILES); }
  mRenderIncomplete();
  mRenderLostMembers();
  mRenderRisk();
  await mRenderCohorts();
  mRenderFrequency();
  mRenderCancelTiming();
  if (typeof wlTips === "function"){ wlTips("memLtv", WL_TIP_MEM_ECON); }
  mRenderNet();
  await mRenderConversions();
  M$("memStatus").textContent = "";
}

function mPopulateSiteFilter(){
  const sel = M$("memSiteFilter");
  if (!sel || !mSites.length) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Sites</option>' +
    mSites.filter(s => !s.name.includes("COMING SOON")).map(s =>
      '<option value="' + s.id + '"' + (s.id === cur ? ' selected' : '') + '>' + s.name + '</option>'
    ).join("");
}

onReady( () => {
  M$("memRefreshBtn").addEventListener("click", memRender);
  const mSiteFilter = M$("memSiteFilter");
  if (mSiteFilter) mSiteFilter.addEventListener("change", () => {
    mSelectedSite = mSiteFilter.value || null;
    memRender();
  });
  mInitCollapsible();
  const memLP = M$("memLostPeriod");
  if (memLP) memLP.addEventListener("change", mRenderLostMembers);
  const memTF = M$("memTimeFrame");
  if (memTF) memTF.addEventListener("change", () => { mRenderTiles(); });
  memRender().then(() => { mPopulateSiteFilter(); mPopulateTimeFrame(); });
});
