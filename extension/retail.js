const R$ = (id) => document.getElementById(id);

function rMoney(n){ return "$" + (n || 0).toFixed(2); }
function rMoney0(n){ return "$" + Math.round(n || 0).toLocaleString("en-US"); }
function rDs(d){ return d.toLocaleDateString("en-CA"); }
function rFmtDate(k){ const p = k.split("-"); return p[1] + "/" + p[2]; }

let rHist = {}, rSites = [];
let rSelectedSite = null;
function rFilteredSites(){ return rSelectedSite ? rSites.filter(s => s.id === rSelectedSite) : rSites; }

async function retLoad(){
  const st = (await chrome.storage.local.get(["hist", "sites"])) || {};
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

function rSumRangeSite(sid, from, to){
  var out = {washes: 0, revenue: 0, totalRev: 0, newPasses: 0};
  var d = new Date(from + "T00:00:00");
  var end = new Date(to + "T00:00:00");
  while (d <= end){
    var dt = rDs(d);
    var rec = (rHist[sid] || {})[dt];
    if (rec){
      var rt = rRetail(rec);
      out.washes += rt.washes;
      out.revenue += rt.revenue;
      out.totalRev += rec.revenue || 0;
      out.newPasses += (rec.newPass || 0) + (rec.newPassOnline || 0);
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function rYoyPc(cur, ly){ return ly ? Math.round((cur - ly) / Math.abs(ly) * 100) : null; }
function rYoySpan(pct){ if (pct === null) return ""; return " <span class=\"delta " + (pct >= 0 ? "up" : "down") + "\">" + (pct >= 0 ? "+" : "") + pct + "%</span>"; }

function rRenderYoY(){
  var el = R$("retYoY");
  if (!el) return;
  var today = new Date();
  var todayStr = rDs(today);
  var moStart = todayStr.slice(0,8) + "01";
  var ytdStart = todayStr.slice(0,4) + "-01-01";
  var lyRef = new Date(today); lyRef.setFullYear(lyRef.getFullYear() - 1);
  var lyMoStart = rDs(lyRef).slice(0,8) + "01", lyMoEnd = rDs(lyRef);
  var lyYtdStart = rDs(lyRef).slice(0,4) + "-01-01", lyYtdEnd = rDs(lyRef);

  var mtd = rSumRange(moStart, todayStr);
  var lyMtd = rSumRange(lyMoStart, lyMoEnd);
  var ytd = rSumRange(ytdStart, todayStr);
  var lyYtd = rSumRange(lyYtdStart, lyYtdEnd);

  var mtdPer = mtd.washes ? mtd.revenue / mtd.washes : 0;
  var lyMtdPer = lyMtd.washes ? lyMtd.revenue / lyMtd.washes : 0;
  var ytdPer = ytd.washes ? ytd.revenue / ytd.washes : 0;
  var lyYtdPer = lyYtd.washes ? lyYtd.revenue / lyYtd.washes : 0;

  var html = "";
  html += rTile("Revenue vs LY (MTD)", rMoney0(mtd.revenue) + rYoySpan(rYoyPc(mtd.revenue, lyMtd.revenue)) + "<br><small>LY: " + rMoney0(lyMtd.revenue) + "</small>");
  html += rTile("Revenue vs LY (YTD)", rMoney0(ytd.revenue) + rYoySpan(rYoyPc(ytd.revenue, lyYtd.revenue)) + "<br><small>LY: " + rMoney0(lyYtd.revenue) + "</small>");
  html += rTile("Washes vs LY (MTD)", mtd.washes + rYoySpan(rYoyPc(mtd.washes, lyMtd.washes)) + "<br><small>LY: " + lyMtd.washes + "</small>");
  html += rTile("Washes vs LY (YTD)", ytd.washes + rYoySpan(rYoyPc(ytd.washes, lyYtd.washes)) + "<br><small>LY: " + lyYtd.washes + "</small>");
  html += rTile("$/wash vs LY (MTD)", rMoney(mtdPer) + rYoySpan(rYoyPc(mtdPer, lyMtdPer)) + "<br><small>LY: " + rMoney(lyMtdPer) + "</small>");
  html += rTile("$/wash vs LY (YTD)", rMoney(ytdPer) + rYoySpan(rYoyPc(ytdPer, lyYtdPer)) + "<br><small>LY: " + rMoney(lyYtdPer) + "</small>");
  el.innerHTML = html;

  html += '<div style="margin-top:14px"><div id="retYoYToggles" style="margin-bottom:6px"></div><div id="retYoYView" style="margin-bottom:10px"></div><canvas id="retYoYChart" style="width:100%"></canvas></div>';
  el.innerHTML = html;
  // Render YoY chart
  setTimeout(function(){
    var cv = R$("retYoYChart");
    if (!cv || typeof wlYoYChart !== "function") return;
    var metrics = [
      {key: "rev", label: "Revenue", extract: function(r){ return r.revenue; }, fmt: rMoney0},
      {key: "washes", label: "Washes", extract: function(r){ return r.washes; }, fmt: function(v){ return Math.round(v).toLocaleString(); }},
      {key: "per", label: "$/wash", extract: function(r){ return r.washes ? r.revenue / r.washes : 0; }, perDay: true, fmt: rMoney}
    ];
    var curM = "rev", curV = "mtd";
    function retByDay(extractFn, perDay){
      var revOut = {}, washOut = {};
      for (var si of rFilteredSites()){
        for (var dt of Object.keys(rHist[si.id] || {})){
          var rec = rHist[si.id][dt];
          var rt = rRetail(rec);
          revOut[dt] = (revOut[dt]||0) + rt.revenue;
          washOut[dt] = (washOut[dt]||0) + rt.washes;
        }
      }
      if (perDay){
        var out = {};
        for (var dt of Object.keys(revOut)){ out[dt] = washOut[dt] ? revOut[dt]/washOut[dt] : 0; }
        return out;
      }
      var out = {};
      for (var dt of Object.keys(revOut)){ out[dt] = extractFn({revenue: revOut[dt], washes: washOut[dt]}); }
      return out;
    }
    function mtdData(byDay){
      var today = new Date(), yr = today.getFullYear(), mo = today.getMonth(), dn = today.getDate();
      var ty = [], ly = [], lb = [];
      for (var d = 1; d <= dn; d++){
        ty.push(byDay[rDs(new Date(yr, mo, d))]||0);
        ly.push(byDay[rDs(new Date(yr-1, mo, d))]||0);
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
        var t=0, l=0, tw=0, lw=0;
        for (var dt of Object.keys(byDay)){
          if (dt>=rDs(mr)&&dt<=rDs(me)) t+=byDay[dt];
          if (dt>=rDs(lr)&&dt<=rDs(le)) l+=byDay[dt];
        }
        ty.push(t); ly.push(l); lb.push(mr.toLocaleString("en-US",{month:"short"}));
      }
      return {tyVals: ty, lyVals: ly, labels: lb};
    }
    function draw(){
      var mf = metrics.find(function(m){ return m.key === curM; });
      var byDay = retByDay(mf.extract, mf.perDay);
      var data = curV === "mtd" ? mtdData(byDay) : mo12Data(byDay);
      wlYoYChart(cv, data.tyVals, data.lyVals, data.labels, {fmtFn: mf.fmt});
    }
    function btn(l,a){ return '<button style="padding:5px 12px;border-radius:6px;border:1px solid #3a4a63;background:'+(a?'#4da3ff':'#1a2233')+';color:#eaeef5;cursor:pointer;margin-right:5px;font-size:12px">'+l+'</button>'; }
    function renderT(){
      var te = R$("retYoYToggles"), ve = R$("retYoYView");
      if (!te||!ve) return;
      var mH = ""; for (var m of metrics) mH += btn(m.label, m.key === curM);
      te.innerHTML = mH; ve.innerHTML = btn("This Month", curV==="mtd") + btn("Last 12 Months", curV==="12mo");
      var mBs = te.querySelectorAll("button"); for (var i=0;i<mBs.length;i++)(function(idx){mBs[idx].addEventListener("click",function(){curM=metrics[idx].key;renderT();draw();});})(i);
      var vBs = ve.querySelectorAll("button"); vBs[0].addEventListener("click",function(){curV="mtd";renderT();draw();}); vBs[1].addEventListener("click",function(){curV="12mo";renderT();draw();});
    }
    renderT(); draw();
  }, 50);
  // Per-site table
  var siteEl = R$("retYoYSites");
  if (!siteEl) return;
  var siteList = rFilteredSites();
  if (siteList.length <= 1){ siteEl.innerHTML = ""; return; }
  var thtml = "<table class=\"via\"><thead><tr><th>Site</th><th>Rev MTD</th><th>LY</th><th>YoY</th><th>Rev YTD</th><th>LY</th><th>YoY</th><th>Washes MTD</th><th>LY</th><th>$/wash MTD</th><th>LY</th></tr></thead><tbody>";
  for (var si of siteList){
    var sm = rSumRangeSite(si.id, moStart, todayStr);
    var slm = rSumRangeSite(si.id, lyMoStart, lyMoEnd);
    var sy = rSumRangeSite(si.id, ytdStart, todayStr);
    var sly = rSumRangeSite(si.id, lyYtdStart, lyYtdEnd);
    var smPc = rYoyPc(sm.revenue, slm.revenue);
    var syPc = rYoyPc(sy.revenue, sly.revenue);
    var smPer = sm.washes ? rMoney(sm.revenue / sm.washes) : "--";
    var slmPer = slm.washes ? rMoney(slm.revenue / slm.washes) : "--";
    thtml += "<tr><td>" + si.name + "</td>" +
      "<td>" + rMoney0(sm.revenue) + "</td><td>" + rMoney0(slm.revenue) + "</td><td>" + (smPc !== null ? (smPc >= 0 ? "+" : "") + smPc + "%" : "--") + "</td>" +
      "<td>" + rMoney0(sy.revenue) + "</td><td>" + rMoney0(sly.revenue) + "</td><td>" + (syPc !== null ? (syPc >= 0 ? "+" : "") + syPc + "%" : "--") + "</td>" +
      "<td>" + sm.washes + "</td><td>" + slm.washes + "</td>" +
      "<td>" + smPer + "</td><td>" + slmPer + "</td></tr>";
  }
  thtml += "</tbody></table>";
  siteEl.innerHTML = thtml;
}

async function retRender(){
  R$("retStatus").textContent = "Calculating...";
  await retLoad();
  rRenderTiles();
  rRenderYoY();
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

onReady( () => {
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
  const st = (await chrome.storage.local.get(["washTiers"])) || {};
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

onReady( () => {
  const sel = document.getElementById("retPkgPeriod");
  if (sel) sel.addEventListener("change", () => rRenderPackages());
});
