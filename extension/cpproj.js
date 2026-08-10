// WashLevel Sidecar - CryptoPay projections
// Baseline model only (no weather yet): level x weekday index x month index,
// fitted per site from stored daily history.

const CPJ_DOW_WINDOW = 365;   // days of history used for weekday indices
const CPJ_LEVEL_WINDOW = 28;  // days used to set the current level
const CPJ_SIGMA_WINDOW = 90;  // days used to size the prediction interval
const CPJ_SEASON_MIN_DAYS = 400; // need >13 months before trusting month-of-year
const CPJ_BACKTEST_DAYS = 30;
const CPJ_LOG_AHEAD = 10;

let cpjHist = {};
let cpjSites = [];
let cpjStatus = {};
let cpjPredLog = {};

function cpjDs(d){ return d.toLocaleDateString("en-CA"); }
function cpjMoney(n){ return "$" + (n || 0).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
function cpjMoney0(n){ return "$" + Math.round(n || 0).toLocaleString("en-US"); }
function cpjMean(a){ return a.length ? a.reduce(function(x, y){ return x + y; }, 0) / a.length : 0; }

function cpjParseDate(k){
  const p = k.split("-");
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
}

// Flat, date-sorted series for one site. Only days that actually have a record
// are included, so closed or offline days do not read as zero-revenue days.
function cpjSeries(sid, cutoff){
  const hist = cpjHist[sid] || {};
  const out = [];
  for (const k of Object.keys(hist).sort()){
    if (cutoff && k >= cutoff) continue;
    const d = cpjParseDate(k);
    out.push({key: k, d: d, dow: d.getDay(), mon: d.getMonth(), rev: hist[k].revenue || 0});
  }
  return out;
}

// Fit the model. Indices are shrunk toward 1 so thin buckets cannot swing the
// forecast; the month index is only used once there is more than a year of data.
function cpjFit(sid, cutoff){
  const s = cpjSeries(sid, cutoff);
  const model = {days: s.length, dow: [1,1,1,1,1,1,1], mon: [1,1,1,1,1,1,1,1,1,1,1,1], level: 0, sigma: 0, seasonal: false};
  if (!s.length) return model;

  const last = s[s.length - 1].d;

  const dowCut = new Date(last); dowCut.setDate(dowCut.getDate() - CPJ_DOW_WINDOW);
  const recent = s.filter(function(r){ return r.d >= dowCut; });
  const baseSet = recent.length >= 14 ? recent : s;
  const allMean = cpjMean(baseSet.map(function(r){ return r.rev; }));

  if (allMean > 0){
    for (let k = 0; k < 7; k++){
      const vals = baseSet.filter(function(r){ return r.dow === k; }).map(function(r){ return r.rev; });
      const raw = vals.length ? cpjMean(vals) / allMean : 1;
      const K = 4;
      model.dow[k] = (vals.length * raw + K * 1) / (vals.length + K);
    }
  }

  if (s.length >= CPJ_SEASON_MIN_DAYS && allMean > 0){
    const allMeanFull = cpjMean(s.map(function(r){ return r.rev; }));
    if (allMeanFull > 0){
      model.seasonal = true;
      for (let m = 0; m < 12; m++){
        const vals = s.filter(function(r){ return r.mon === m; }).map(function(r){ return r.rev; });
        const raw = vals.length ? cpjMean(vals) / allMeanFull : 1;
        const K = 10;
        model.mon[m] = (vals.length * raw + K * 1) / (vals.length + K);
      }
    }
  }

  // Current level, from deseasonalised recent days.
  const lvlCut = new Date(last); lvlCut.setDate(lvlCut.getDate() - CPJ_LEVEL_WINDOW);
  let lvlSet = s.filter(function(r){ return r.d >= lvlCut; });
  if (lvlSet.length < 7) lvlSet = s.slice(-14);
  const des = lvlSet.map(function(r){
    const f = model.dow[r.dow] * model.mon[r.mon];
    return f > 0 ? r.rev / f : r.rev;
  });
  model.level = cpjMean(des);

  // Relative residual spread, for the interval.
  const sigCut = new Date(last); sigCut.setDate(sigCut.getDate() - CPJ_SIGMA_WINDOW);
  const sigSet = s.filter(function(r){ return r.d >= sigCut; });
  const ratios = [];
  for (const r of sigSet){
    const pred = model.level * model.dow[r.dow] * model.mon[r.mon];
    if (pred > 0) ratios.push(r.rev / pred);
  }
  if (ratios.length >= 5){
    const m = cpjMean(ratios);
    const varr = cpjMean(ratios.map(function(x){ return (x - m) * (x - m); }));
    model.sigma = Math.sqrt(varr);
  } else {
    model.sigma = 0.35;
  }
  return model;
}

function cpjPredictDay(model, dateObj){
  if (!model || !model.level) return 0;
  return model.level * model.dow[dateObj.getDay()] * model.mon[dateObj.getMonth()];
}

// Month-end forecast for one site: actual month-to-date plus predicted
// remaining days, with an 80% interval from the residual spread.
function cpjSiteForecast(sid){
  const today = new Date();
  const todayStr = cpjDs(today);
  const y = today.getFullYear(), m = today.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const hist = cpjHist[sid] || {};
  const model = cpjFit(sid);

  let mtd = 0;
  for (const k of Object.keys(hist)){
    if (k.slice(0, 7) === todayStr.slice(0, 7) && k <= todayStr) mtd += hist[k].revenue || 0;
  }

  let rest = 0;
  let sumSq = 0;
  for (let day = today.getDate() + 1; day <= daysInMonth; day++){
    const p = cpjPredictDay(model, new Date(y, m, day));
    rest += p;
    sumSq += p * p;
  }
  const todayPred = cpjPredictDay(model, today);
  const todayActual = (hist[todayStr] || {}).revenue || 0;
  const todayRemain = Math.max(0, todayPred - todayActual);
  rest += todayRemain;
  sumSq += todayRemain * todayRemain;

  const sd = model.sigma * Math.sqrt(sumSq);
  const point = mtd + rest;
  return {
    mtd: mtd,
    projected: point,
    lo: Math.max(mtd, point - 1.28 * sd),
    hi: point + 1.28 * sd,
    model: model
  };
}

// Walk the model forward over recent history it was not fitted on.
function cpjBacktest(sid){
  const today = new Date();
  const hist = cpjHist[sid] || {};
  const errs = [];
  const signed = [];
  for (let i = CPJ_BACKTEST_DAYS; i >= 1; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = cpjDs(d);
    const rec = hist[k];
    if (!rec) continue;
    const model = cpjFit(sid, k);
    if (!model.level) continue;
    const pred = cpjPredictDay(model, d);
    const act = rec.revenue || 0;
    if (act <= 0) continue;
    errs.push(Math.abs(pred - act) / act);
    signed.push((pred - act) / act);
  }
  return {
    n: errs.length,
    mape: errs.length ? cpjMean(errs) * 100 : null,
    bias: signed.length ? cpjMean(signed) * 100 : null
  };
}

function cpjSiteList(){
  if (cpjSites.length) return cpjSites;
  return Object.keys(cpjHist).map(function(id){
    return {id: id, name: (cpjStatus[id] && cpjStatus[id].name) || id};
  });
}

// Confidence blends how much history a site has with how well the projection has
// actually performed there. A long-running site whose daily revenue is genuinely
// erratic should not read "good" just because the data is old.
function cpjConfidence(days, seasonal, mape){
  if (days < 90) return "limited";
  if (mape === null || mape === undefined){
    return (days >= CPJ_SEASON_MIN_DAYS && seasonal) ? "good" : "fair";
  }
  if (days >= 365 && mape <= 15) return "good";
  if (mape <= 25) return "fair";
  return "limited";
}

function cpjConfidenceNote(conf, mape){
  const acc = (mape === null || mape === undefined) ? "not measured yet" : "typically within " + mape.toFixed(0) + "% per day";
  if (conf === "good") return "Plenty of history and the projection has tracked this site closely (" + acc + ").";
  if (conf === "fair") return "Reasonable history, but day-to-day revenue moves around a fair bit here (" + acc + ").";
  return "Either limited history or revenue here swings too much to project tightly (" + acc + "). Treat the number as a rough guide.";
}

// Record today's forward predictions once, so accuracy can be measured later
// against what was actually predicted at the time.
async function cpjLogPredictions(){
  const today = new Date();
  let changed = false;
  for (let i = 0; i <= CPJ_LOG_AHEAD; i++){
    const d = new Date(today); d.setDate(d.getDate() + i);
    const k = cpjDs(d);
    cpjPredLog[k] = cpjPredLog[k] || {};
    for (const s of cpjSiteList()){
      if (cpjPredLog[k][s.id] === undefined){
        const model = cpjFit(s.id);
        if (!model.level) continue;
        cpjPredLog[k][s.id] = Math.round(cpjPredictDay(model, d) * 100) / 100;
        changed = true;
      }
    }
  }
  // Trim anything older than a year to keep storage small.
  const cut = new Date(today); cut.setDate(cut.getDate() - 365);
  const cutStr = cpjDs(cut);
  for (const k of Object.keys(cpjPredLog)){
    if (k < cutStr){ delete cpjPredLog[k]; changed = true; }
  }
  if (changed) await chrome.storage.local.set({cpPredLog: cpjPredLog});
}

function cpjLiveAccuracy(){
  const today = new Date();
  const todayStr = cpjDs(today);
  const errs = [];
  const signed = [];
  let days = 0;
  for (const k of Object.keys(cpjPredLog)){
    if (k >= todayStr) continue;
    let pred = 0, act = 0, any = false;
    for (const sid of Object.keys(cpjPredLog[k])){
      const a = ((cpjHist[sid] || {})[k] || {}).revenue;
      if (a === undefined) continue;
      pred += cpjPredLog[k][sid];
      act += a;
      any = true;
    }
    if (!any || act <= 0) continue;
    days++;
    errs.push(Math.abs(pred - act) / act);
    signed.push((pred - act) / act);
  }
  return {
    days: days,
    mape: errs.length ? cpjMean(errs) * 100 : null,
    bias: signed.length ? cpjMean(signed) * 100 : null
  };
}

async function cpjLoad(){
  const st = await chrome.storage.local.get(["cpHist", "cpSites", "cpStatus", "cpPredLog"]);
  cpjHist = st.cpHist || {};
  cpjSites = st.cpSites || [];
  cpjStatus = st.cpStatus || {};
  cpjPredLog = st.cpPredLog || {};
}

function cpjEl(id){ return document.getElementById(id); }

async function cpjRender(){
  await cpjLoad();
  const wrap = cpjEl("cpjBody");
  if (!wrap) return;

  const list = cpjSiteList();
  if (!list.length || !Object.keys(cpjHist).length){
    wrap.innerHTML = "<p>No CryptoPay history yet. Go to Cryptopay &rarr; Overview and press Sync first.</p>";
    return;
  }

  await cpjLogPredictions();

  let totMtd = 0, totProj = 0, totVar = 0;
  let rows = "";
  const perSite = [];
  for (const s of list){
    const f = cpjSiteForecast(s.id);
    const bt = cpjBacktest(s.id);
    perSite.push({s: s, f: f, bt: bt});
    totMtd += f.mtd;
    totProj += f.projected;
    const half = (f.hi - f.projected);
    totVar += half * half;
  }
  perSite.sort(function(a, b){ return b.f.projected - a.f.projected; });

  for (const p of perSite){
    const conf = cpjConfidence(p.f.model.days, p.f.model.seasonal, p.bt.mape);
    const note = cpjConfidenceNote(conf, p.bt.mape).replace(/"/g, "&quot;");
    rows += "<tr>" +
      "<td>" + p.s.name + "</td>" +
      "<td>" + cpjMoney0(p.f.mtd) + "</td>" +
      "<td><strong>" + cpjMoney0(p.f.projected) + "</strong></td>" +
      "<td>" + cpjMoney0(p.f.lo) + " - " + cpjMoney0(p.f.hi) + "</td>" +
      "<td>" + p.f.model.days + "</td>" +
      "<td class=\"cpj-" + conf + "\" title=\"" + note + "\">" + conf + "</td>" +
      "</tr>";
  }

  const totHalf = 1.0 * Math.sqrt(totVar);
  const live = cpjLiveAccuracy();
  const seasonalCount = perSite.filter(function(p){ return p.f.model.seasonal; }).length;

  const allBt = perSite.filter(function(p){ return p.bt.mape !== null; });
  const wMape = allBt.length ? cpjMean(allBt.map(function(p){ return p.bt.mape; })) : null;
  const wBias = allBt.length ? cpjMean(allBt.map(function(p){ return p.bt.bias; })) : null;

  cpjEl("cpjTotProj").textContent = cpjMoney0(totProj);
  cpjEl("cpjTotRange").textContent = cpjMoney0(totProj - totHalf) + " - " + cpjMoney0(totProj + totHalf);
  cpjEl("cpjTotMtd").textContent = cpjMoney0(totMtd);
  cpjEl("cpjSeasonal").textContent = seasonalCount + " / " + perSite.length;

  wrap.innerHTML =
    "<h2>By site</h2>" +
    "<table class=\"via\"><thead><tr>" +
    "<th>Site</th><th>Month to date</th><th>Projected</th><th>80% range</th>" +
    "<th>Days of history</th><th title=\"How much to trust this site's number. Combines how much history it has with how closely projections have actually matched what happened. Hover a value for detail.\">Confidence</th>" +
    "</tr></thead><tbody>" + rows + "</tbody></table>" +

    "<h2>How the projection works</h2>" +
    "<ul class=\"cpj-notes\">" +
      "<li>Each site gets its own model: a current revenue level, a factor for each day of the week, and - once there is more than about 13 months of history - a factor for each month of the year.</li>" +
      "<li>Day-of-week and month factors are pulled toward 1 when there are few observations, so a couple of unusual days cannot distort the forecast.</li>" +
      "<li>The projection is actual month-to-date plus a predicted value for every remaining day. The range is an 80% interval built from how much daily revenue has actually scattered around the model over the last 90 days.</li>" +
      "<li><strong>Backtest error</strong> re-fits the model using only data from before each of the last 30 days and compares its prediction with what really happened - so it is a fair test, not the model grading its own homework.</li>" +
      "<li><strong>Live tracking</strong> scores the predictions this page actually recorded on earlier visits. It stays empty until predictions have been logged and those days have passed.</li>" +
      "<li>Checked against itself: re-running the model on the last 30 days, using only data from before each day, its daily predictions landed " + (wMape === null ? "within an unmeasured margin" : "within about " + wMape.toFixed(0) + "% on average") + " across sites" + (live.days ? ", and " + live.days + " day" + (live.days === 1 ? "" : "s") + " of live predictions have been scored so far" : "") + ". That measurement is what drives the confidence column.</li>" +
      "<li>Weather is <em>not</em> part of this yet. That comes next, and this page will then show both numbers side by side so the weather-adjusted version has to prove it is better.</li>" +
    "</ul>";
}

async function cpjInit(){
  const navBtn = document.querySelector('.nav-btn[data-page="cp-projections"]');
  if (navBtn) navBtn.addEventListener("click", function(){ setTimeout(cpjRender, 0); });
  const refresh = cpjEl("cpjRefreshBtn");
  if (refresh) refresh.addEventListener("click", cpjRender);
  await cpjRender();
}
document.addEventListener("DOMContentLoaded", cpjInit);
