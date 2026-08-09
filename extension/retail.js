const R$ = (id) => document.getElementById(id);

function rMoney(n){ return "$" + (n || 0).toFixed(2); }
function rMoney0(n){ return "$" + Math.round(n || 0).toLocaleString("en-US"); }
function rDs(d){ return d.toLocaleDateString("en-CA"); }
function rFmtDate(k){ const p = k.split("-"); return p[1] + "/" + p[2]; }

let rHist = {}, rSites = [];

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
  for (const s of rSites){
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
  for (const s of rSites){
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
  rRenderAnoms();
  R$("retStatus").textContent = "";
}

document.addEventListener("DOMContentLoaded", () => {
  retRender();
  const btn = document.querySelector('[data-page="retail"]');
  if (btn) btn.addEventListener("click", () => retRender());
});
