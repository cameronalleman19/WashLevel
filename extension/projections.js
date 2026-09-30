/* projections.js - Dencar Projections tab (Phase 1)
 *
 * Model, per site and per metric:
 *   projected(day) = base(same weekday last year, weather-normalized, smoothed)
 *                    x growth trend (last 90 days vs same days last year, capped +/-25%)
 *                    x weather factor (forecast for the next 10 days, typical weather after that)
 *
 * Retail $, retail cars, new-member sales and new-member counts use the site's
 * learned retail weather response. Member washes use a separate member-usage
 * response. Renewals and VIA Pay are treated as weather-proof.
 *
 * Split used everywhere (matches retail.js rRetail() and the members.js revenue formula):
 *   retail  = revenue - (new pass + renew + VIA pay + VIA add + online pass + gift)
 *   renew   = pass renew + VIA add
 *   newMem  = new pass + online pass + gift
 *   other   = VIA pay
 *   retail + renew + newMem + other = Dencar daily total
 */

const PJ$ = function (id) { return document.getElementById(id); };
const PJ_TREND_DAYS = 90;
const PJ_TREND_CAP = 0.25;
const PJ_TREND_MIN_PAIRS = 45;
const PJ_WX_MIN_DAYS = 90;
const PJ_ARCHIVE_LAG = 3;
const PJ_BACKTEST_MONTHS = 12;
const PJ_SNAP_KEEP = 400;
const PJ_METRICS = ["retail", "renew", "newMem", "other", "retailCars", "memberCars", "newCount"];
const PJ_REV_METRICS = ["retail", "renew", "newMem", "other"];
const PJ_WX_GROUP = { retail: "retail", retailCars: "retail", newMem: "retail", newCount: "retail", memberCars: "member", renew: null, other: null };

let pjHist = {}, pjSites = [], pjSelected = null, pjLastSync = 0;
let pjLoc = {}, pjWx = {}, pjWxThrough = {}, pjFc = {}, pjSnaps = {};
let pjCache = {};
let pjRendering = false;

/* ---------------------------------------------------------------- helpers */
function pjDs(d) { return d.toLocaleDateString("en-CA"); }
function pjDate(s) { return new Date(s + "T00:00:00"); }
function pjAdd(s, n) { const d = pjDate(s); d.setDate(d.getDate() + n); return pjDs(d); }
function pjMonthEnd(mStart) { const d = pjDate(mStart); return pjDs(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
function pjPrevMonth(mStart) { const d = pjDate(mStart); return pjDs(new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
function pjLyMonth(mStart) { const d = pjDate(mStart); return pjDs(new Date(d.getFullYear() - 1, d.getMonth(), 1)); }
function pjMonthLabel(mStart) { return pjDate(mStart).toLocaleDateString("en-US", { month: "short", year: "numeric" }); }
function pjEsc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
function pjMoney(n) { return "$" + Math.round(n || 0).toLocaleString("en-US"); }
function pjInt(n) { return Math.round(n || 0).toLocaleString("en-US"); }
function pjPct(x) {
  if (x === null || x === undefined || !isFinite(x)) return "--";
  const p = Math.round(x * 100);
  return (p > 0 ? "+" : "") + p + "%";
}
function pjPctSpan(x) {
  if (x === null || x === undefined || !isFinite(x)) return "<span>--</span>";
  const c = x > 0.005 ? "#4ade80" : (x < -0.005 ? "#f87171" : "#8fa3c0");
  return "<span style=\"color:" + c + "\">" + pjPct(x) + "</span>";
}
function pjChange(cur, ly) { return ly > 0 ? (cur - ly) / ly : null; }
function pjLocKey(lat, lon) { return Number(lat).toFixed(2) + "," + Number(lon).toFixed(2); }
function pjSum(obj, keys) { let t = 0; for (const k of keys) t += obj[k] || 0; return t; }

function pjSplit(r) {
  const excl = (r.newPassAmt || 0) + (r.passRenewAmt || 0) + (r.viaPayAmt || 0) + (r.viaAddAmt || 0) + (r.newPassOnlineAmt || 0) + (r.onlineGiftAmt || 0);
  return {
    retail: Math.max(0, (r.revenue || 0) - excl),
    renew: (r.passRenewAmt || 0) + (r.viaAddAmt || 0),
    newMem: (r.newPassAmt || 0) + (r.newPassOnlineAmt || 0) + (r.onlineGiftAmt || 0),
    other: r.viaPayAmt || 0,
    retailCars: Math.max(0, (r.washes || 0) - (r.passUse || 0)),
    memberCars: r.passUse || 0,
    newCount: (r.newPass || 0) + (r.newPassOnline || 0)
  };
}

function pjWxIcon(w) {
  if (!w) return "";
  const c = w.code;
  if (c === undefined || c === null) return "";
  if (c <= 1) return "\u2600\uFE0F";
  if (c <= 3) return "\u26C5";
  if (c === 45 || c === 48) return "\uD83C\uDF2B\uFE0F";
  if (c >= 95) return "\u26C8\uFE0F";
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "\u2744\uFE0F";
  if (c >= 80 && c <= 82) return "\uD83C\uDF26\uFE0F";
  if (c >= 51 && c <= 67) return "\uD83C\uDF27\uFE0F";
  return "";
}

/* ---------------------------------------------------------------- storage */
async function pjLoad() {
  const st = (await chrome.storage.local.get(["hist", "sites", "lastSync", "dxSiteLoc", "dxWeather", "dxWeatherThrough", "dxForecast", "projSnapshots"])) || {};
  pjHist = st.hist || {};
  pjSites = (st.sites || []).filter(function (s) { return pjHist[s.id] && Object.keys(pjHist[s.id]).length; });
  pjLastSync = st.lastSync || 0;
  pjLoc = st.dxSiteLoc || {};
  pjWx = st.dxWeather || {};
  pjWxThrough = st.dxWeatherThrough || {};
  pjFc = st.dxForecast || {};
  pjSnaps = st.projSnapshots || {};
}
async function pjSaveWx() {
  await chrome.storage.local.set({ dxSiteLoc: pjLoc, dxWeather: pjWx, dxWeatherThrough: pjWxThrough, dxForecast: pjFc });
}
function pjFilteredSites() { return pjSelected ? pjSites.filter(function (s) { return s.id === pjSelected; }) : pjSites; }

/* ---------------------------------------------------------------- weather model */
function pjRecencyMap(key) {
  const wx = pjWx[key] || {};
  const fc = (pjFc[key] && pjFc[key].days) || [];
  const all = {};
  for (const dt of Object.keys(wx)) all[dt] = wx[dt];
  for (const f of fc) if (!all[f.date]) all[f.date] = f;
  const keys = Object.keys(all).sort();
  const map = {};
  let since = null;
  for (const k of keys) {
    if (cpwHadSnow(all[k])) { map[k] = "day0"; since = 0; }
    else if (since !== null) {
      since++;
      map[k] = since === 1 ? "day1" : since === 2 ? "day2" : (since <= 5 ? "day3to5" : "none");
    } else map[k] = "none";
  }
  return map;
}

function pjFitWx(series, wx, rmap) {
  const B = { p: {}, t: {}, s: {}, r: {} };
  const push = function (tbl, b, v) { (tbl[b] = tbl[b] || []).push(v); };
  let n = 0;
  for (const dt of Object.keys(series)) {
    const w = wx[dt];
    if (!w || w.precip === undefined || w.precip === null) continue;
    let sum = 0, c = 0;
    for (const k of [-21, -14, -7, 7, 14, 21]) {
      const x = series[pjAdd(dt, k)];
      if (x !== undefined) { sum += x; c++; }
    }
    if (c < 3) continue;
    const exp = sum / c;
    if (exp <= 0) continue;
    const resid = Math.min(3, series[dt] / exp);
    const snow = cpwHadSnow(w);
    push(B.s, snow ? "yes" : "no", resid);
    const pb = cpwPrecipBucket(w.precip);
    if (!snow) push(B.p, pb, resid);
    if (!snow && pb === "dry" && w.tmax !== undefined && w.tmax !== null) push(B.t, cpwTempBucket(w.tmax), resid);
    const rb = rmap[dt];
    if (rb === "day1" || rb === "day2" || rb === "day3to5") push(B.r, rb, resid);
    n++;
  }
  const shrink = function (tbl, K) {
    const out = {};
    for (const b of Object.keys(tbl)) {
      const vals = tbl[b];
      const raw = vals.reduce(function (a, x) { return a + x; }, 0) / vals.length;
      out[b] = { f: (vals.length * raw + K) / (vals.length + K), n: vals.length };
    }
    return out;
  };
  return { n: n, reliable: n >= PJ_WX_MIN_DAYS, p: shrink(B.p, 10), t: shrink(B.t, 10), s: shrink(B.s, 10), r: shrink(B.r, 10) };
}

function pjWxFactor(fit, w, rb) {
  if (!fit || !fit.reliable || !w) return 1;
  const g = function (tbl, b) { return tbl[b] ? tbl[b].f : 1; };
  let f = 1;
  const snow = cpwHadSnow(w);
  if (snow) f *= g(fit.s, "yes");
  else {
    const pb = (w.pop !== undefined && w.pop !== null) ? cpwPrecipBucketForecast(w.precip, w.pop) : cpwPrecipBucket(w.precip);
    f *= g(fit.p, pb);
  }
  if (w.tmax !== undefined && w.tmax !== null) f *= g(fit.t, cpwTempBucket(w.tmax));
  if (rb === "day1" || rb === "day2" || rb === "day3to5") f *= g(fit.r, rb);
  return Math.max(0.25, Math.min(2, f));
}

/* ---------------------------------------------------------------- per-site context */
function pjCtx(sid) {
  if (pjCache[sid]) return pjCache[sid];
  const series = {};
  PJ_METRICS.forEach(function (m) { series[m] = {}; });
  const h = pjHist[sid] || {};
  for (const dt of Object.keys(h)) {
    const sp = pjSplit(h[dt]);
    for (const m of PJ_METRICS) series[m][dt] = sp[m];
  }
  const loc = pjLoc[sid];
  const key = loc ? loc.key : null;
  const wx = key ? (pjWx[key] || {}) : {};
  const fc = {};
  if (key && pjFc[key]) for (const f of (pjFc[key].days || [])) fc[f.date] = f;
  const rmap = key ? pjRecencyMap(key) : {};
  const fits = { retail: pjFitWx(series.retail, wx, rmap), member: pjFitWx(series.memberCars, wx, rmap) };
  const ctx = { sid: sid, series: series, wx: wx, fc: fc, rmap: rmap, fits: fits, hasLoc: !!loc, wxDays: Object.keys(wx).length, trend: {}, norm: {} };
  pjCache[sid] = ctx;
  return ctx;
}

function pjNorm(ctx, m, dt) {
  const v = ctx.series[m][dt];
  if (v === undefined) return undefined;
  const g = PJ_WX_GROUP[m];
  if (!g) return v;
  const k = m + "|" + dt;
  if (ctx.norm[k] !== undefined) return ctx.norm[k];
  const out = v / pjWxFactor(ctx.fits[g], ctx.wx[dt], ctx.rmap[dt]);
  ctx.norm[k] = out;
  return out;
}

function pjTrend(ctx, m, asOf) {
  const k = m + "|" + asOf;
  if (ctx.trend[k]) return ctx.trend[k];
  let cur = 0, ly = 0, pairs = 0;
  for (let i = 1; i <= PJ_TREND_DAYS; i++) {
    const dt = pjAdd(asOf, -i);
    const a = pjNorm(ctx, m, dt);
    const b = pjNorm(ctx, m, pjAdd(dt, -364));
    if (a === undefined || b === undefined) continue;
    cur += a; ly += b; pairs++;
  }
  let t = 1, raw = null;
  if (pairs >= PJ_TREND_MIN_PAIRS && ly > 0) {
    raw = cur / ly;
    t = 1 + (raw - 1) * pairs / (pairs + 10);
    t = Math.max(1 - PJ_TREND_CAP, Math.min(1 + PJ_TREND_CAP, t));
  }
  ctx.trend[k] = { t: t, raw: raw, pairs: pairs };
  return ctx.trend[k];
}

function pjBase(ctx, m, D, asOf) {
  const ly = pjAdd(D, -364);
  let s = 0, w = 0;
  const pts = [[-7, 1], [0, 2], [7, 1]];
  for (const p of pts) {
    const v = pjNorm(ctx, m, pjAdd(ly, p[0]));
    if (v !== undefined) { s += v * p[1]; w += p[1]; }
  }
  if (w >= 2) return { v: (s / w) * pjTrend(ctx, m, asOf).t, src: "ly" };
  const dow = pjDate(D).getDay();
  let d = pjAdd(asOf, -1);
  while (pjDate(d).getDay() !== dow) d = pjAdd(d, -1);
  s = 0;
  let c = 0;
  for (let i = 0; i < 8; i++) {
    const v = pjNorm(ctx, m, pjAdd(d, -7 * i));
    if (v !== undefined) { s += v; c++; }
  }
  return { v: c ? s / c : 0, src: c ? "recent" : "none" };
}

function pjProjectDay(ctx, m, D, asOf, useActualWx) {
  const b = pjBase(ctx, m, D, asOf).v;
  const g = PJ_WX_GROUP[m];
  if (!g) return b;
  const w = useActualWx ? ctx.wx[D] : ctx.fc[D];
  return b * pjWxFactor(ctx.fits[g], w, ctx.rmap[D]);
}

/* ---------------------------------------------------------------- aggregations */
function pjEmpty() { const o = {}; PJ_METRICS.forEach(function (m) { o[m] = 0; }); return o; }
function pjAddInto(a, b) { PJ_METRICS.forEach(function (m) { a[m] += b[m] || 0; }); }

function pjActualRange(ctx, from, to) {
  const out = pjEmpty();
  for (const m of PJ_METRICS) {
    const s = ctx.series[m];
    for (const dt of Object.keys(s)) if (dt >= from && dt <= to) out[m] += s[dt];
  }
  return out;
}

// Current month for one site: actual through yesterday + projection from today to month end.
function pjMonthSite(sid, today) {
  const ctx = pjCtx(sid);
  const mStart = today.slice(0, 8) + "01";
  const mEnd = pjMonthEnd(mStart);
  const actual = pjEmpty(), rest = pjEmpty();
  const h = pjHist[sid] || {};
  for (let d = mStart; d <= mEnd; d = pjAdd(d, 1)) {
    if (d < today && h[d]) {
      for (const m of PJ_METRICS) actual[m] += ctx.series[m][d] || 0;
    } else {
      for (const m of PJ_METRICS) rest[m] += pjProjectDay(ctx, m, d, today, false);
    }
  }
  const total = pjEmpty(); pjAddInto(total, actual); pjAddInto(total, rest);
  const lyStart = pjLyMonth(mStart);
  const ly = pjActualRange(ctx, lyStart, pjMonthEnd(lyStart));
  const trail = pjActualRange(ctx, pjAdd(today, -30), pjAdd(today, -1));
  return { sid: sid, ctx: ctx, actual: actual, rest: rest, total: total, ly: ly, trail: trail };
}

function pjBacktest(sitesArr, today) {
  const rows = [];
  let mStart = today.slice(0, 8) + "01";
  for (let i = 0; i < PJ_BACKTEST_MONTHS; i++) {
    mStart = pjPrevMonth(mStart);
    const mEnd = pjMonthEnd(mStart);
    let proj = 0, act = 0, ok = true;
    for (const s of sitesArr) {
      const ctx = pjCtx(s.id);
      const h = pjHist[s.id] || {};
      let days = 0;
      for (let d = mStart; d <= mEnd; d = pjAdd(d, 1)) if (h[d]) days++;
      const tr = pjTrend(ctx, "retail", mStart);
      if (days < 25 || tr.pairs < PJ_TREND_MIN_PAIRS) { ok = false; break; }
      for (let d = mStart; d <= mEnd; d = pjAdd(d, 1)) {
        for (const m of PJ_REV_METRICS) {
          proj += pjProjectDay(ctx, m, d, mStart, true);
          if (h[d]) act += ctx.series[m][d] || 0;
        }
      }
    }
    if (!ok || act <= 0) continue;
    rows.push({ m: mStart, proj: proj, act: act, err: (proj - act) / act });
  }
  const errs = rows.map(function (r) { return Math.abs(r.err); }).sort(function (a, b) { return a - b; });
  let typical = null;
  if (errs.length >= 3) typical = errs[Math.floor(errs.length / 2)];
  return { rows: rows, typical: typical };
}

/* ---------------------------------------------------------------- geocoding */
const PJ_STATES = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"};

// Dencar addresses can arrive with line breaks and no commas between street and city.
// Tries several city guesses and only accepts a match in the right state (and ZIP when known).
async function pjGeocode(address) {
  const flat = String(address || "").replace(/[\r\n\t]+/g, ", ").replace(/\s{2,}/g, " ").replace(/(,\s*)+/g, ", ").trim();
  const zipM = flat.match(/\b(\d{5})(?:-\d{4})?\b(?!.*\b\d{5}\b)/);
  const zip = zipM ? zipM[1] : null;
  let st = null, stIdx = -1;
  const re = /\b([A-Z]{2})\b/g;
  let m;
  while ((m = re.exec(flat))) if (PJ_STATES[m[1]]) { st = m[1]; stIdx = m.index; }
  const before = (stIdx >= 0 ? flat.slice(0, stIdx) : flat.replace(/\b\d{5}(-\d{4})?\b.*$/, "")).replace(/[,\s]+$/, "");
  const cands = [];
  const parts = before.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  if (parts.length > 1) cands.push(parts[parts.length - 1]);
  const words = before.replace(/,/g, " ").split(/\s+/).filter(Boolean);
  for (let n = 1; n <= 3 && n <= words.length; n++) cands.push(words.slice(words.length - n).join(" "));
  const seen = {};
  for (const c of cands) {
    const name = c.replace(/[^A-Za-z .'-]/g, "").trim();
    if (name.length < 3 || seen[name.toLowerCase()]) continue;
    seen[name.toLowerCase()] = true;
    try {
      const res = await fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(name) + "&count=20&language=en&format=json&countryCode=US");
      const data = await res.json();
      let rs = (data && data.results) || [];
      if (st) rs = rs.filter(function (r) { return r.admin1 === PJ_STATES[st]; });
      if (!rs.length) continue;
      const byZip = zip ? rs.filter(function (r) { return (r.postcodes || []).indexOf(zip) >= 0; }) : [];
      const pick = byZip[0] || rs[0];
      return { lat: pick.latitude, lon: pick.longitude, label: pick.name + (st ? ", " + st : "") };
    } catch (e) {}
  }
  return null;
}

/* ---------------------------------------------------------------- weather sync */
async function pjWxSync(statusFn) {
  const say = typeof statusFn === "function" ? statusFn : function (t) { const el = PJ$("projStatus"); if (el) el.textContent = t; };
  const btn = PJ$("pjWxSyncBtn");
  if (btn) btn.disabled = true;
  let resultMsg = "";
  try {
    await pjLoad();
    if (!pjSites.length) { say("No Dencar history yet. Sync Overview first, then Sync Weather."); return; }
    const st = (await chrome.storage.local.get(["cpStatus", "cpWeather"])) || {};
    const cpStatus = st.cpStatus || {}, cpWx = st.cpWeather || {};
    const lagCut = pjAdd(pjDs(new Date()), -PJ_ARCHIVE_LAG);
    let located = 0, fetched = 0, reused = 0, fcN = 0;
    const failed = [];
    const fcDone = {};
    for (const s of pjSites) {
      let loc = pjLoc[s.id];
      if (!loc) {
        if (!s.address) { failed.push(s.name + " (no address on file - press Overview Sync once)"); continue; }
        say("Weather: locating " + s.name + "...");
        const g = await pjGeocode(s.address);
        if (!g) { failed.push(s.name + " (couldn't locate \"" + s.address + "\")"); continue; }
        loc = { lat: g.lat, lon: g.lon, key: pjLocKey(g.lat, g.lon), label: g.label };
        pjLoc[s.id] = loc;
        located++;
        await pjSaveWx();
        await new Promise(function (r) { setTimeout(r, 300); });
      }
      const key = loc.key;
      pjWx[key] = pjWx[key] || {};
      for (const cid of Object.keys(cpStatus)) {
        const c = cpStatus[cid];
        if (!c || c.lat === undefined || c.lon === undefined || !cpWx[cid]) continue;
        if (pjLocKey(c.lat, c.lon) !== key) continue;
        for (const dt of Object.keys(cpWx[cid])) if (!pjWx[key][dt]) { pjWx[key][dt] = cpWx[cid][dt]; reused++; }
      }
      const dates = Object.keys(pjHist[s.id] || {}).sort();
      if (dates.length) {
        let start = (pjWxThrough[key] && pjWxThrough[key] >= dates[0]) ? pjAdd(pjWxThrough[key], 1) : dates[0];
        while (start <= lagCut && pjWx[key][start]) start = pjAdd(start, 1);
        while (start <= lagCut) {
          let end = pjAdd(start, 365);
          if (end > lagCut) end = lagCut;
          say("Weather: history for " + s.name + " " + start.slice(0, 7) + " to " + end.slice(0, 7) + "...");
          const days = await cpwFetchHistory(loc.lat, loc.lon, start, end);
          if (!days.length) break;
          for (const d of days) pjWx[key][d.date] = { precip: d.precip, snow: d.snow, code: d.code, tmax: d.tmax, tmin: d.tmin };
          fetched += days.length;
          pjWxThrough[key] = end;
          await pjSaveWx();
          start = pjAdd(end, 1);
          await new Promise(function (r) { setTimeout(r, 300); });
        }
      }
      if (!fcDone[key]) {
        say("Weather: forecast for " + s.name + "...");
        const fc = await cpwFetchForecast(loc.lat, loc.lon);
        if (fc.length) { pjFc[key] = { fetchedAt: Date.now(), days: fc }; fcN++; }
        fcDone[key] = true;
        await new Promise(function (r) { setTimeout(r, 300); });
      }
    }
    await pjSaveWx();
    resultMsg = "Weather done: " + located + " located, " + fetched + " days fetched, " + reused + " reused from CryptoPay, " + fcN + " forecast" + (fcN === 1 ? "" : "s") + "." +
      (failed.length ? " Not located: " + failed.join("; ") : "");
    await chrome.storage.local.set({ dxWeatherLastMsg: { at: Date.now(), msg: resultMsg, failed: failed.length } });
  } catch (e) {
    console.error("[Sidecar] Weather sync failed", e);
    resultMsg = "Weather sync failed: " + (e && e.message ? e.message : e);
  } finally {
    if (btn) btn.disabled = false;
  }
  const pg = PJ$("page-projections");
  if (pg && pg.classList.contains("active")) await pjRender();
  if (resultMsg) say(resultMsg);
}

/* ---------------------------------------------------------------- snapshots */
async function pjSaveSnapshot(key, snap) {
  const st = (await chrome.storage.local.get(["projSnapshots"])) || {};
  const all = st.projSnapshots || {};
  const list = (all[key] || []).filter(function (x) { return x.d !== snap.d; });
  list.push(snap);
  list.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  all[key] = list.slice(-PJ_SNAP_KEEP);
  await chrome.storage.local.set({ projSnapshots: all });
  pjSnaps = all;
}

/* ---------------------------------------------------------------- rendering */
function pjTile(label, val, sub) {
  return "<div class=\"stat\"><label>" + label + "</label><div>" + val + "</div>" +
    (sub ? "<small style=\"display:block;color:#8fa3c0;font-size:12px;margin-top:4px\">" + sub + "</small>" : "") + "</div>";
}
function pjNote(t) { return "<p style=\"color:#8fa3c0;font-size:13px;margin:8px 0 0\">" + t + "</p>"; }
function pjTable(head, rows) {
  return "<div style=\"overflow-x:auto\"><table class=\"via\"><thead><tr>" + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") +
    "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>";
}
function pjTr(cells, bold) {
  return "<tr" + (bold ? " style=\"font-weight:700\"" : "") + ">" + cells.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>";
}
function pjSafe(name, fn) {
  try { return fn(); }
  catch (e) { console.error("[Sidecar] Projections section failed: " + name, e); return "<p style=\"color:#f87171\">" + name + " couldn't be calculated (see console).</p>"; }
}

function pjPopulateSites() {
  const sel = PJ$("projSiteFilter");
  if (!sel) return;
  const cur = pjSelected || "";
  sel.innerHTML = "<option value=\"\">All Sites</option>" + pjSites.map(function (s) {
    return "<option value=\"" + pjEsc(s.id) + "\"" + (s.id === cur ? " selected" : "") + ">" + pjEsc(s.name) + "</option>";
  }).join("");
  if (pjSelected && !pjSites.some(function (s) { return s.id === pjSelected; })) { pjSelected = null; sel.value = ""; }
}

function pjWxStatusLine(results, last) {
  const extra = (last && last.failed) ? pjNote("<span style=\"color:#ffd166\">Last weather sync: " + pjEsc(last.msg) + "</span>") : "";
  const where = results.map(function (r) { const s = pjSites.find(function (x) { return x.id === r.sid; }); const l = pjLoc[r.sid];
    return pjEsc(s ? s.name : r.sid) + ": " + (l ? pjEsc(l.label || (l.lat.toFixed(2) + ", " + l.lon.toFixed(2))) + " (" + r.ctx.wxDays + " days)" : "not located"); }).join(" &middot; ");
  return pjWxStatusLineInner(results) + pjNote("Locations: " + where) + extra;
}
function pjWxStatusLineInner(results) {
  let located = 0, reliable = 0, learning = [];
  for (const r of results) {
    if (r.ctx.hasLoc && r.ctx.wxDays) located++;
    if (r.ctx.fits.retail.reliable) reliable++;
    else if (r.ctx.hasLoc && r.ctx.wxDays) learning.push(r.ctx.fits.retail.n);
  }
  if (!located) return pjNote("No weather data yet for these sites - press <b>Sync Weather</b>. Until then, projections assume typical weather.");
  let t = "Weather: " + located + "/" + results.length + " site" + (results.length === 1 ? "" : "s") + " located, weather model active for " + reliable + ".";
  if (learning.length) t += " Still learning at " + learning.length + " (needs " + PJ_WX_MIN_DAYS + " days with sales and weather).";
  return pjNote(t);
}

function pjRenderTiles(results, bt) {
  const T = pjEmpty(), A = pjEmpty(), R = pjEmpty(), L = pjEmpty();
  for (const r of results) { pjAddInto(T, r.total); pjAddInto(A, r.actual); pjAddInto(R, r.rest); pjAddInto(L, r.ly); }
  const tot = pjSum(T, PJ_REV_METRICS), lyTot = pjSum(L, PJ_REV_METRICS);
  const act = pjSum(A, PJ_REV_METRICS), rest = pjSum(R, PJ_REV_METRICS);
  const typ = bt.typical !== null ? Math.max(0.03, bt.typical) : 0.10;
  const band = rest * typ;
  const mem = T.renew + T.newMem, lyMem = L.renew + L.newMem;
  const cars = T.retailCars + T.memberCars, lyCars = L.retailCars + L.memberCars;
  const lyTxt = function (v, cur, fmt) { return v > 0 ? "LY " + fmt(v) + " " + pjPctSpan(pjChange(cur, v)) : "no data for this month last year"; };
  let html = "<section class=\"summary\">";
  html += pjTile("Projected month total", pjMoney(tot),
    pjMoney(tot - band) + " - " + pjMoney(tot + band) + " &middot; " + lyTxt(lyTot, tot, pjMoney));
  html += pjTile("Actual so far", pjMoney(act), "through yesterday &middot; " + pjMoney(rest) + " still to come");
  html += pjTile("Retail", pjMoney(T.retail), lyTxt(L.retail, T.retail, pjMoney));
  html += pjTile("Membership", pjMoney(mem), "renewals " + pjMoney(T.renew) + " + new " + pjMoney(T.newMem) + " &middot; " + lyTxt(lyMem, mem, pjMoney));
  html += pjTile("Other (VIA Pay)", pjMoney(T.other), lyTxt(L.other, T.other, pjMoney));
  html += pjTile("Cars this month", pjInt(cars), "retail " + pjInt(T.retailCars) + " + member " + pjInt(T.memberCars) + " &middot; " + lyTxt(lyCars, cars, pjInt));
  html += pjTile("New members", pjInt(T.newCount), lyTxt(L.newCount, T.newCount, pjInt));
  html += "</section>";
  html += pjNote("Range is the typical backtest miss (" + Math.round(typ * 100) + "%) applied to the days still to come." +
    (bt.typical === null ? " Not enough history to backtest yet, so a 10% default is used." : ""));
  return html;
}

function pjRenderOutlook(results, today) {
  const rows = [];
  let wxSite = null;
  for (const r of results) if (Object.keys(r.ctx.fc).length) { wxSite = r.ctx; break; }
  for (let i = 0; i < 10; i++) {
    const d = pjAdd(today, i);
    const t = pjEmpty();
    for (const r of results) for (const m of PJ_METRICS) t[m] += pjProjectDay(r.ctx, m, d, today, false);
    const w = wxSite ? wxSite.fc[d] : null;
    const wxCell = w ? (pjWxIcon(w) + " " + Math.round(w.tmax) + "&deg;" + (w.pop !== undefined && w.pop !== null ? " &middot; " + w.pop + "%" : "")) : "--";
    const lbl = pjDate(d).toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
    rows.push(pjTr([i === 0 ? lbl + " (today)" : lbl, wxCell, pjInt(t.retailCars + t.memberCars), pjMoney(t.retail),
      pjMoney(t.renew + t.newMem), t.newCount.toFixed(1), pjMoney(pjSum(t, PJ_REV_METRICS))]));
  }
  let html = pjTable(["Day", "Weather", "Cars", "Retail", "Membership", "New members", "Total"], rows);
  if (results.length > 1 && wxSite) html += pjNote("Weather column shows the first site's forecast; each site's projection uses its own forecast.");
  html += pjNote("Membership by day reflects typical renewal timing. Phase 2 replaces it with each member's actual billing date.");
  return html;
}

function pjFitCell(fit) {
  if (!fit.reliable) return "learning (" + fit.n + "/" + PJ_WX_MIN_DAYS + " days)";
  const rain = fit.p.rain ? fit.p.rain.f - 1 : null;
  const heavy = fit.p.heavy ? fit.p.heavy.f - 1 : null;
  return "rain " + pjPct(rain) + ", heavy " + pjPct(heavy);
}

function pjRenderRetail(results, today) {
  const rows = [];
  const T = { a: 0, r: 0, t: 0, ly: 0, c: 0, lyc: 0 };
  for (const r of results) {
    const s = pjSites.find(function (x) { return x.id === r.sid; });
    const tr = pjTrend(r.ctx, "retail", today), tc = pjTrend(r.ctx, "retailCars", today);
    rows.push(pjTr([pjEsc(s ? s.name : r.sid), pjMoney(r.actual.retail), pjMoney(r.rest.retail), pjMoney(r.total.retail),
      pjMoney(r.ly.retail) + " " + pjPctSpan(pjChange(r.total.retail, r.ly.retail)),
      pjInt(r.total.retailCars) + " " + pjPctSpan(pjChange(r.total.retailCars, r.ly.retailCars)),
      tr.raw === null ? "--" : pjPct(tr.t - 1), tc.raw === null ? "--" : pjPct(tc.t - 1), pjFitCell(r.ctx.fits.retail)]));
    T.a += r.actual.retail; T.r += r.rest.retail; T.t += r.total.retail; T.ly += r.ly.retail; T.c += r.total.retailCars; T.lyc += r.ly.retailCars;
  }
  if (results.length > 1) rows.push(pjTr(["All sites", pjMoney(T.a), pjMoney(T.r), pjMoney(T.t), pjMoney(T.ly) + " " + pjPctSpan(pjChange(T.t, T.ly)),
    pjInt(T.c) + " " + pjPctSpan(pjChange(T.c, T.lyc)), "", "", ""], true));
  let html = pjTable(["Site", "Actual MTD", "Still to come", "Month", "LY month", "Retail cars", "$ trend", "Car trend", "Weather effect"], rows);
  html += pjNote("Trend = last " + PJ_TREND_DAYS + " days vs the same days last year, weather-adjusted and capped at &plusmn;" + Math.round(PJ_TREND_CAP * 100) +
    "%. Weather effect = how retail revenue on rain and heavy-rain days compares to a normal day at that site.");
  return html;
}

function pjRenderMembership(results, today) {
  const rows = [];
  const T = { ren: 0, nm: 0, tot: 0, ly: 0, nc: 0, lync: 0, mc: 0 };
  for (const r of results) {
    const s = pjSites.find(function (x) { return x.id === r.sid; });
    const mem = r.total.renew + r.total.newMem, ly = r.ly.renew + r.ly.newMem;
    const cap = r.trail.retailCars > 0 ? r.trail.newCount / r.trail.retailCars : null;
    const trn = pjTrend(r.ctx, "renew", today);
    rows.push(pjTr([pjEsc(s ? s.name : r.sid), pjMoney(r.total.renew), pjMoney(r.total.newMem), pjMoney(mem) + " " + pjPctSpan(pjChange(mem, ly)),
      pjInt(r.total.newCount) + " <small style=\"color:#8fa3c0\">(LY " + pjInt(r.ly.newCount) + ")</small>",
      cap === null ? "--" : (cap * 100).toFixed(1) + "%", pjInt(r.total.memberCars), trn.raw === null ? "--" : pjPct(trn.t - 1)]));
    T.ren += r.total.renew; T.nm += r.total.newMem; T.tot += mem; T.ly += ly; T.nc += r.total.newCount; T.lync += r.ly.newCount; T.mc += r.total.memberCars;
  }
  if (results.length > 1) rows.push(pjTr(["All sites", pjMoney(T.ren), pjMoney(T.nm), pjMoney(T.tot) + " " + pjPctSpan(pjChange(T.tot, T.ly)),
    pjInt(T.nc) + " <small style=\"color:#8fa3c0\">(LY " + pjInt(T.lync) + ")</small>", "", pjInt(T.mc), ""], true));
  let html = pjTable(["Site", "Renewals", "New member $", "Membership total", "New members", "Capture rate (30d)", "Member washes", "Renewal trend"], rows);
  html += pjNote("Renewals are treated as weather-proof. New member sales follow projected retail traffic, so they move with the weather. Capture rate = new members / retail cars over the last 30 days.");
  html += pjNote("Coming in Phase 2: renewals from each member's billing date, expected declines, cancellations by membership age, and a 3/6/12-month member count outlook.");
  return html;
}

function pjRenderAccuracy(bt, key, today) {
  let html = "<h3 style=\"font-size:14px;margin:4px 0 8px\">Backtest</h3>";
  if (!bt.rows.length) {
    html += pjNote("Not enough history to backtest yet. Each month needs a full month of data plus the same period last year.");
  } else {
    html += pjTable(["Month", "Projected on the 1st", "Actual", "Miss"], bt.rows.map(function (r) {
      return pjTr([pjMonthLabel(r.m), pjMoney(r.proj), pjMoney(r.act), pjPctSpan(r.err)]);
    }));
    html += pjNote("Each past month projected as of its 1st, using only data from before that date. It uses the weather that actually happened, so it reads a little better than a live forecast will." +
      (bt.typical !== null ? " Typical miss: &plusmn;" + (bt.typical * 100).toFixed(1) + "%." : ""));
  }
  html += "<h3 style=\"font-size:14px;margin:18px 0 8px\">Live projection history</h3>";
  const list = (pjSnaps[key] || []).slice().reverse();
  if (!list.length) {
    html += pjNote("Starting today. A snapshot is saved each day you open Projections, then compared to the final month total once the month closes.");
    return html;
  }
  const curMonth = today.slice(0, 8) + "01";
  const finals = {};
  const monthActual = function (m) {
    if (finals[m] !== undefined) return finals[m];
    let t = 0;
    for (const s of pjFilteredSites()) {
      const a = pjActualRange(pjCtx(s.id), m, pjMonthEnd(m));
      t += pjSum(a, PJ_REV_METRICS);
    }
    finals[m] = t;
    return t;
  };
  const rows = list.slice(0, 60).map(function (x) {
    const done = x.m < curMonth;
    const fin = done ? monthActual(x.m) : null;
    return pjTr([pjDate(x.d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), pjMonthLabel(x.m),
      pjMoney(x.total), pjMoney(x.actual),
      done ? pjMoney(fin) : "in progress", done && fin > 0 ? pjPctSpan((x.total - fin) / fin) : "--",
      x.sync ? new Date(x.sync).toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "--"]);
  });
  html += pjTable(["Snapshot", "Month", "Projected", "Actual at the time", "Final", "Miss", "Data synced"], rows);
  return html;
}

function pjInitCollapsible() {
  const body = PJ$("projBody");
  if (!body) return;
  const prefs = JSON.parse(localStorage.getItem("projCollapsed") || "{}");
  body.querySelectorAll("h2").forEach(function (h) {
    const key = h.getAttribute("data-key") || h.textContent.trim();
    const div = document.createElement("div");
    let sib = h.nextSibling;
    while (sib && !(sib.nodeType === 1 && sib.tagName === "H2")) { const next = sib.nextSibling; div.appendChild(sib); sib = next; }
    h.parentNode.insertBefore(div, sib);
    const arrow = document.createElement("span");
    arrow.style.cssText = "margin-left:8px;font-size:12px";
    h.appendChild(arrow);
    const collapsed = prefs[key] !== undefined ? prefs[key] : h.getAttribute("data-default") === "collapsed";
    div.style.display = collapsed ? "none" : "";
    arrow.textContent = collapsed ? "\u25B6" : "\u25BC";
    h.style.cursor = "pointer";
    h.addEventListener("click", function () {
      const hidden = div.style.display === "none";
      div.style.display = hidden ? "" : "none";
      arrow.textContent = hidden ? "\u25BC" : "\u25B6";
      const p = JSON.parse(localStorage.getItem("projCollapsed") || "{}");
      p[key] = !hidden;
      localStorage.setItem("projCollapsed", JSON.stringify(p));
    });
  });
}

async function pjRender() {
  if (pjRendering) return;
  pjRendering = true;
  const st = PJ$("projStatus");
  const body = PJ$("projBody");
  try {
    if (st) st.textContent = "Calculating...";
    await pjLoad();
    pjCache = {};
    pjPopulateSites();
    if (!body) return;
    const sitesArr = pjFilteredSites();
    if (!sitesArr.length) {
      body.innerHTML = pjNote("No Dencar history yet. Go to Overview and press Sync, then come back.");
      if (st) st.textContent = "";
      return;
    }
    const today = pjDs(new Date());
    const results = sitesArr.map(function (s) { return pjMonthSite(s.id, today); });
    const bt = pjSafe("Backtest", function () { return pjBacktest(sitesArr, today); });
    const btOk = bt && bt.rows ? bt : { rows: [], typical: null };
    const key = pjSelected || "all";

    const lastWx = ((await chrome.storage.local.get(["dxWeatherLastMsg"])) || {}).dxWeatherLastMsg || null;
    let html = pjWxStatusLine(results, lastWx);
    html += pjSafe("Summary", function () { return pjRenderTiles(results, btOk); });
    html += "<h2 data-key=\"outlook\">Next 10 days</h2>" + pjSafe("Next 10 days", function () { return pjRenderOutlook(results, today); });
    html += "<h2 data-key=\"retail\">Retail projection</h2>" + pjSafe("Retail projection", function () { return pjRenderRetail(results, today); });
    html += "<h2 data-key=\"membership\">Membership projection</h2>" + pjSafe("Membership projection", function () { return pjRenderMembership(results, today); });

    const T = pjEmpty(), A = pjEmpty();
    for (const r of results) { pjAddInto(T, r.total); pjAddInto(A, r.actual); }
    await pjSaveSnapshot(key, {
      d: today, m: today.slice(0, 8) + "01",
      total: Math.round(pjSum(T, PJ_REV_METRICS)), retail: Math.round(T.retail), member: Math.round(T.renew + T.newMem), other: Math.round(T.other),
      actual: Math.round(pjSum(A, PJ_REV_METRICS)), sync: pjLastSync
    });
    html += "<h2 data-key=\"accuracy\" data-default=\"collapsed\">Accuracy</h2>" + pjSafe("Accuracy", function () { return pjRenderAccuracy(btOk, key, today); });

    body.innerHTML = html;
    pjInitCollapsible();
    if (st) st.textContent = "";
  } catch (e) {
    console.error("[Sidecar] Projections render failed", e);
    if (st) st.textContent = "Projections failed - see console";
  } finally {
    pjRendering = false;
  }
}

/* ---------------------------------------------------------------- init */
(function () {
  function init() {
    const sel = PJ$("projSiteFilter");
    if (sel) sel.addEventListener("change", function () { pjSelected = sel.value || null; pjRender(); });
    const wb = PJ$("pjWxSyncBtn");
    if (wb) wb.addEventListener("click", function () { pjWxSync(); });
    const pg = PJ$("page-projections");
    if (!pg) return;
    // Render whenever the page becomes visible (nav click or restored tab).
    let wasActive = false;
    const check = function () {
      const on = pg.classList.contains("active");
      if (on && !wasActive) setTimeout(pjRender, 0);
      wasActive = on;
    };
    new MutationObserver(check).observe(pg, { attributes: true, attributeFilter: ["class"] });
    check();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
