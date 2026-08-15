const R$ = (id) => document.getElementById(id);

function rMoney(n){ return "$" + (n || 0).toFixed(2); }
function rMoney0(n){ return "$" + Math.round(n || 0).toLocaleString("en-US"); }
function rDs(d){ return d.toLocaleDateString("en-CA"); }
function rFmtDate(k){ const p = k.split("-"); return p[1] + "/" + p[2]; }

let rHist = {}, rSites = [];
let rSelectedSite = null;
function rFilteredSites(){ return rSelectedSite ? rSites.filter(s => s.id === rSelectedSite) : rSites; }

async function retLoad(){
  const st = await chrome.storage.local.get(["hist", "sites"]);
  rHist = st.hist || {};
  rSites = st.sites || [];
}

function rRetail(r){
  const rw = Math.max(0, (r.washes || 0) - (r.passUse || 0));
  const excl = (r.newPassAmt || 0) + (r.passRenewAmt || 0) + (r.viaPayAmt || 0) + (r.viaAddAmt || 0) + (r.newPassOnlineAmt || 0) + (r.onlineGiftAmt || 0);
  const rr = Math.max(0, (r.revenue || 0) - excl);
  return {washes: rw, revenue: rr, per: rw ? rr / rw : 0};
}

function rDayTotals(dateStr){
  const out = {washes: 0, revenue: 0, totalRev: 0, newPasses: 0};
  for (const s of rFilteredSites()){
    const rec = (rHist[s.id] || {})[dateStr];
    if (!rec) continue;
    const rt = rRetail(rec);
    out.washes += rt.washes;
    out.revenue += rt.revenue;
    out.totalRev += rec.revenue || 0;
    out.newPasses += (rec.newPass || 0) + (rec.newPassOnline || 0);
  }
  return out;
}

function rSumRange(from, to){
  const out = {washes: 0, revenue: 0, totalRev: 0, newPasses: 0, days: 0};
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end){
    const t = rDayTotals(rDs(d));
    out.washes += t.washes; out.revenue += t.revenue; out.totalRev += t.totalRev; out.newPasses += t.newPasses;
    if (t.totalRev || t.washes) out.days++;
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function rTile(label, val){
  return "<div class=\"stat\"><label>" + label + "</label><div>" + val + "</div></div>";
}

function rRenderTiles(){
  const today = new Date();
  const todayStr = rDs(today);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const wkStart = new Date(today); wkStart.setDate(wkStart.getDate() - today.getDay());
  const moStart = todayStr.slice(0, 8) + "01";
  const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const lmStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const d30 = new Date(today); d30.setDate(d30.getDate() - 29);

  const t = rSumRange(todayStr, todayStr);
  const y = rSumRange(rDs(yest), rDs(yest));
  const w = rSumRange(rDs(wkStart), todayStr);
  const m = rSumRange(moStart, todayStr);
  const lm = rSumRange(rDs(lmStart), rDs(lmEnd));
  const r30 = rSumRange(rDs(d30), todayStr);

  const mix = r30.totalRev ? (r30.revenue / r30.totalRev * 100).toFixed(0) + "%" : "--";
  const per = r30.washes ? rMoney(r30.revenue / r30.washes) : "--";
  const cap = r30.washes ? (r30.newPasses / r30.washes * 100).toFixed(1) + "%" : "--";

  R$("retTiles").innerHTML =
    rTile("Retail today", rMoney0(t.revenue) + " / " + t.washes + "w") +
    rTile("Retail yesterday", rMoney0(y.revenue) + " / " + y.washes + "w") +
    rTile("Week to date", rMoney0(w.revenue)) +
    rTile("Month to date", rMoney0(m.revenue)) +
    rTile("Last month", rMoney0(lm.revenue)) +
    rTile("Retail mix 30d", mix) +
    rTile("Retail $/wash 30d", per) +
    rTile("Capture rate 30d", cap);
}

function rRenderChart(){
  const cv = R$("retChart");
  if (!cv || typeof wlLineChart !== "function") return;
  const today = new Date();
  const labels = [], vals = [];
  for (let i = 29; i >= 0; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = rDs(d);
    labels.push(k);
    vals.push(rDayTotals(k).revenue);
  }
  wlLineChart(cv, labels, vals);
}

function rRenderDow(){
  const tb = R$("retDowBody");
  tb.innerHTML = "";
  const today = new Date();
  const agg = {};
  for (let i = 1; i <= 56; i++){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const t = rDayTotals(rDs(d));
    if (!t.totalRev && !t.washes) continue;
    const dow = d.getDay();
    const o = agg[dow] = agg[dow] || {washes: 0, revenue: 0, n: 0};
    o.washes += t.washes; o.revenue += t.revenue; o.n++;
  }
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let any = false;
  for (let dow = 0; dow < 7; dow++){
    const o = agg[dow];
    if (!o || !o.n) continue;
    const aw = o.washes / o.n;
    const ar = o.revenue / o.n;
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + names[dow] + "</td><td>" + aw.toFixed(0) + "</td><td>" + rMoney0(ar) + "</td><td>" + (aw ? rMoney(ar / aw) : "--") + "</td>";
    tb.appendChild(tr);
    any = true;
  }
  if (!any) tb.innerHTML = "<tr><td colspan=\"4\">No report history. Press Sync on Overview.</td></tr>";
}

function rRenderCapture(){
  const tb = R$("retCapBody");
  tb.innerHTML = "";
  const today = new Date();
  const todayStr = rDs(today);
  const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
  const from = rDs(d30);
  let any = false;
  for (const s of rFilteredSites()){
    let washes = 0, news = 0;
    for (const dt of Object.keys(rHist[s.id] || {})){
      if (dt < from || dt > todayStr) continue;
      const rec = rHist[s.id][dt];
      washes += rRetail(rec).washes;
      news += (rec.newPass || 0) + (rec.newPassOnline || 0);
    }
    if (!washes && !news) continue;
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + s.name + "</td><td>" + washes + "</td><td>" + news + "</td><td>" + (washes ? (news / washes * 100).toFixed(1) + "%" : "--") + "</td>";
    tb.appendChild(tr);
    any = true;
  }
  if (!any) tb.innerHTML = "<tr><td colspan=\"4\">No report history. Press Sync on Overview.</td></tr>";
}

function rRenderAnoms(){
  const ul = R$("retAnoms");
  ul.innerHTML = "";
  const today = new Date();
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const yk = rDs(yest);
  const items = [];
  for (const s of rSites){
    const rec = (rHist[s.id] || {})[yk];
    if (!rec) continue;
    const yr = rRetail(rec);
    const baseVals = [], perVals = [];
    for (let w = 1; w <= 4; w++){
      const d = new Date(yest); d.setDate(d.getDate() - 7 * w);
      const r2 = (rHist[s.id] || {})[rDs(d)];
      if (r2){ const rt = rRetail(r2); baseVals.push(rt.revenue); if (rt.washes >= 5) perVals.push(rt.per); }
    }
    if (baseVals.length >= 2){
      const avg = baseVals.reduce((a, b) => a + b, 0) / baseVals.length;
      if (avg > 50){
        const pct = Math.round((yr.revenue - avg) / avg * 100);
        if (pct <= -40) items.push(s.name + ": yesterday retail " + pct + "% vs same-weekday 4wk avg (" + rMoney0(yr.revenue) + " vs " + rMoney0(avg) + ")");
        if (pct >= 80) items.push(s.name + ": yesterday retail +" + pct + "% vs same-weekday 4wk avg");
      }
    }
    if (perVals.length >= 2 && yr.washes >= 5){
      const pavg = perVals.reduce((a, b) => a + b, 0) / perVals.length;
      const ppct = Math.round((yr.per - pavg) / pavg * 100);
      if (ppct <= -25) items.push(s.name + ": retail $/wash " + ppct + "% vs norm (" + rMoney(yr.per) + " vs " + rMoney(pavg) + ") - check pricing/discounts");
      if (ppct >= 25) items.push(s.name + ": retail $/wash +" + ppct + "% vs norm (" + rMoney(yr.per) + ")");
    }
    if (yr.washes === 0 && (rec.washes || 0) > 0){
      items.push(s.name + ": zero retail washes yesterday but " + rec.washes + " total washes - check counts");
    }
  }
  if (!items.length){ ul.innerHTML = "<li>No retail anomalies detected.</li>"; return; }
  for (const it of items){
    const li = document.createElement("li");
    li.textContent = it;
    ul.appendChild(li);
  }
}

async function retRender(){
  R$("retStatus").textContent = "Calculating...";
  await retLoad();
  rRenderTiles();
  if (typeof wlTips === "function") wlTips("retTiles", WL_TIP_RETAIL);
  rRenderChart();
  rRenderDow();
  rRenderCapture();
  await rRenderPackages();
  rRenderAnoms();
  await rRenderPlates();
  R$("retStatus").textContent = "";
}

function rPlatePeriodRange(){
  const sel = R$("retPlatePeriod");
  const mode = sel ? sel.value : "30d";
  const today = new Date();
  const to = rDs(today);
  let from;
  if (mode === "90d"){ const d = new Date(today); d.setDate(d.getDate() - 89); from = rDs(d); }
  else if (mode === "6mo"){ const d = new Date(today); d.setMonth(d.getMonth() - 6); from = rDs(d); }
  else if (mode === "12mo"){ const d = new Date(today); d.setFullYear(d.getFullYear() - 1); from = rDs(d); }
  else if (mode === "ytd"){ from = to.slice(0, 4) + "-01-01"; }
  else if (mode === "all"){ from = "2020-01-01"; }
  else { const d = new Date(today); d.setDate(d.getDate() - 29); from = rDs(d); }
  return {from: from, to: to};
}

async function rRenderPlates(){
  await platesLoad();
  const el = R$("retPlateInsights");
  if (!el) return;
  const r = rPlatePeriodRange();
  const si = rSelectedSite ? pSiteIdx(rSelectedSite, rSites) : null;
  const stats = plateStats(si, r.from, r.to);
  const crossOver = plateCrossOver(r.from, r.to);
  const conv = plateConversions(si, r.from, r.to);
  el.innerHTML = pRenderStatsHtml(stats, false) +
    pRenderCrossOverHtml(crossOver, r.from, r.to) +
    pRenderConversionsHtml(conv);
}

function rPopulateSiteFilter(){
  const sel = R$("retSiteFilter");
  if (!sel || !rSites.length) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Sites</option>' +
    rSites.filter(s => !s.name.includes("COMING SOON")).map(s =>
      '<option value="' + s.id + '"' + (s.id === cur ? ' selected' : '') + '>' + s.name + '</option>'
    ).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const rSiteFilter = R$("retSiteFilter");
  if (rSiteFilter) rSiteFilter.addEventListener("change", () => {
    rSelectedSite = rSiteFilter.value || null;
    retRender();
  });
  retRender().then(rPopulateSiteFilter);
  const plateSel = R$("retPlatePeriod");
  if (plateSel) plateSel.addEventListener("change", () => rRenderPlates());
  const btn = document.querySelector('[data-page="retail"]');
  if (btn) btn.addEventListener("click", () => retRender());
});

let rTiers = {};

async function rPkgLoad(){
  const st = await chrome.storage.local.get(["washTiers"]);
  rTiers = st.washTiers || {};
}

function rPkgRange(){
  const sel = R$("retPkgPeriod");
  const mode = sel ? sel.value : "30d";
  const today = new Date();
  const to = rDs(today);
  let from;
  if (mode === "today"){ from = to; }
  else if (mode === "7d"){ const d = new Date(today); d.setDate(d.getDate() - 6); from = rDs(d); }
  else if (mode === "mtd"){ from = to.slice(0, 8) + "01"; }
  else if (mode === "ytd"){ from = to.slice(0, 4) + "-01-01"; }
  else if (mode === "12mo"){ const d = new Date(today); d.setFullYear(d.getFullYear() - 1); from = rDs(d); }
  else { const d = new Date(today); d.setDate(d.getDate() - 29); from = rDs(d); }
  return {from: from, to: to};
}

function rPkgAgg(from, to){
  const out = {};
  for (const site of Object.keys(rTiers)){
    const days = rTiers[site] || {};
    for (const dt of Object.keys(days)){
      if (dt < from || dt > to) continue;
      const o = out[site] = out[site] || {};
      for (const k of Object.keys(days[dt])){
        const v = days[dt][k];
        const cur = o[k] = o[k] || {n: 0, rev: 0};
        cur.n += v[0] || 0;
        cur.rev += v[1] || 0;
      }
    }
  }
  return out;
}

function rPkgSortKeys(obj){
  return Object.keys(obj).sort((a, b) => {
    if (a === "other") return 1;
    if (b === "other") return -1;
    return parseFloat(b) - parseFloat(a);
  });
}

function rRenderPkgTable(agg){
  const tb = R$("retPkgBody");
  if (!tb) return;
  tb.innerHTML = "";
  const sites = Object.keys(agg).sort();
  if (!sites.length){ tb.innerHTML = "<tr><td colspan=\"5\">No wash sales found. Run Sync Payment History on the Consumers tab.</td></tr>"; return; }
  for (const site of sites){
    const o = agg[site];
    let totN = 0, totR = 0;
    for (const k of Object.keys(o)){ totN += o[k].n; totR += o[k].rev; }
    if (!totN) continue;
    const hdr = document.createElement("tr");
    hdr.innerHTML = "<td colspan=\"5\"><strong>" + site + "</strong> - " + totN + " washes, " + rMoney0(totR) + "</td>";
    tb.appendChild(hdr);
    for (const k of rPkgSortKeys(o)){
      const v = o[k];
      if (!v.n) continue;
      const label = k === "other" ? "Other / promo" : "$" + parseFloat(k).toFixed(0) + " wash";
      const tr = document.createElement("tr");
      tr.innerHTML = "<td style=\"padding-left:18px\">" + label + "</td>" +
        "<td>" + v.n + "</td>" +
        "<td>" + (totN ? (v.n / totN * 100).toFixed(1) + "%" : "--") + "</td>" +
        "<td>" + rMoney0(v.rev) + "</td>" +
        "<td>" + (totR ? (v.rev / totR * 100).toFixed(1) + "%" : "--") + "</td>";
      tb.appendChild(tr);
    }
  }
}

function rRenderPkgMix(agg){
  const el = document.getElementById("ovPkgMix");
  if (!el) return;
  const comb = {};
  let totN = 0, totR = 0;
  for (const site of Object.keys(agg)){
    for (const k of Object.keys(agg[site])){
      const v = agg[site][k];
      const c = comb[k] = comb[k] || {n: 0, rev: 0};
      c.n += v.n; c.rev += v.rev;
      totN += v.n; totR += v.rev;
    }
  }
  if (!totN){ el.innerHTML = ""; return; }
  let html = "<table class=\"via\"><thead><tr><th>Package</th><th>Washes</th><th>% of washes</th><th>Revenue</th><th>% of revenue</th></tr></thead><tbody>";
  for (const k of rPkgSortKeys(comb)){
    const v = comb[k];
    if (!v.n) continue;
    const label = k === "other" ? "Other / promo" : "$" + parseFloat(k).toFixed(0) + " wash";
    html += "<tr><td>" + label + "</td><td>" + v.n + "</td><td>" + (v.n / totN * 100).toFixed(1) + "%</td><td>" + rMoney0(v.rev) + "</td><td>" + (v.rev / totR * 100).toFixed(1) + "%</td></tr>";
  }
  html += "</tbody></table>";
  el.innerHTML = html;
}

async function rRenderPackages(){
  await rPkgLoad();
  const rng = rPkgRange();
  const agg = rPkgAgg(rng.from, rng.to);
  rRenderPkgTable(agg);
  const today = new Date();
  const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
  rRenderPkgMix(rPkgAgg(rDs(d30), rDs(today)));
}

document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("retPkgPeriod");
  if (sel) sel.addEventListener("change", () => rRenderPackages());
});
