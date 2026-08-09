const M$ = (id) => document.getElementById(id);

function mEsc(s){ const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
function mMoney(n){ return "$" + (n || 0).toFixed(2); }
function mDate(t){ if (!t) return "--"; const d = new Date(t); return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear(); }
function mMonthKey(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function mAddMonths(d, n){ return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function mMonthLabel(key){ const p = key.split("-"); return new Date(p[0], p[1] - 1, 1).toLocaleString("en-US", {month: "short", year: "numeric"}); }

let mConsumers = {}, mHist = {}, mSites = [], mViaSeen = {}, mCohortBase = {};

async function memLoad(){
  const st = await chrome.storage.local.get(["consumers", "hist", "sites", "viaSeen", "memCohortBase"]);
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

function mLatestVehicles(){
  let tot = 0;
  for (const s of mSites){
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
  for (const s of mSites){
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

async function memRender(){
  M$("memStatus").textContent = "Calculating...";
  await memLoad();
  mRenderRisk();
  await mRenderCohorts();
  mRenderEconomics();
  mRenderNet();
  M$("memStatus").textContent = "";
}

document.addEventListener("DOMContentLoaded", () => {
  M$("memRefreshBtn").addEventListener("click", memRender);
  memRender();
});
