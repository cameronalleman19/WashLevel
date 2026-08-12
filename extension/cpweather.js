// WashLevel Sidecar - CryptoPay weather layer
//
// Fits each site's own response to rain and temperature, separately for
// weather-exposed equipment (self-serve bays, vacs, pet wash) and the
// sheltered automatic tunnel, from that site's own stored history. Nothing
// here is a hardcoded assumption about what weather does to car washes -
// every factor below is learned per site per category group. Falls back to
// the plain baseline (cpSiteProjection / cpAllProjection in cryptopay.js)
// wherever there isn't enough weather history yet, or beyond the ~10-day
// forecast horizon.
//
// Endpoints are Open-Meteo's free, keyless APIs. Field names below follow
// Open-Meteo's documented daily-variable API as of this build; if a response
// shape has drifted, cpwFetchHistory/cpwFetchForecast fail closed (empty
// array) rather than throwing, so the rest of the page still renders.

const CP_WEATHER_SCHEMA = 1;
const CPW_GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const CPW_HIST_URL = "https://archive-api.open-meteo.com/v1/archive";
const CPW_FCST_URL = "https://api.open-meteo.com/v1/forecast";
const CPW_ARCHIVE_LAG_DAYS = 3;
const CPW_MIN_DAYS_FOR_FACTORS = 90;
const CPW_GROUPS = {
  selfserve: {label: "Self-serve (bays, vac, pet wash)", types: ["Wash Bay", "Vac", "Pet Wash", "Vend"]},
  automatic: {label: "Automatic tunnel", types: ["Automatic"]}
};
const CPW_PRECIP_BUCKETS = ["dry", "light", "rain", "heavy"];
const CPW_PRECIP_LABELS = {dry: "Dry", light: "Light rain", rain: "Rain", heavy: "Heavy rain"};
const CPW_TEMP_BUCKETS = ["cold", "cool", "mild", "hot"];
const CPW_TEMP_LABELS = {cold: "Cold (under 40\u00b0F)", cool: "Cool (40-59\u00b0F)", mild: "Mild (60-84\u00b0F)", hot: "Hot (85\u00b0F+)"};

let cpwHist = {};
let cpwSites = [];
let cpwStatus = {};
let cpWeather = {};
let cpwSyncedThrough = {};
let cpwForecastCache = {};
let cpwSelectedSite = null;

function cpwDs(d){ return d.toLocaleDateString("en-CA"); }
function cpwMoney(n){ return "$" + Math.round(n || 0).toLocaleString("en-US"); }
function cpwEl(id){ return document.getElementById(id); }

function cpwDateFromKey(k){
  const p = k.split("-");
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
}

function cpwNextDay(k){
  const d = cpwDateFromKey(k);
  d.setDate(d.getDate() + 1);
  return cpwDs(d);
}

async function cpwLoad(){
  const st = await chrome.storage.local.get([
    "cpHist", "cpSites", "cpStatus",
    "cpWeather", "cpWeatherSchema", "cpWeatherSyncedThrough", "cpWeatherForecast"
  ]);
  cpwHist = st.cpHist || {};
  cpwSites = st.cpSites || [];
  cpwStatus = st.cpStatus || {};
  cpwForecastCache = st.cpWeatherForecast || {};
  if (st.cpWeatherSchema !== CP_WEATHER_SCHEMA){
    cpWeather = {};
    cpwSyncedThrough = {};
    await chrome.storage.local.set({cpWeather: {}, cpWeatherSyncedThrough: {}, cpWeatherSchema: CP_WEATHER_SCHEMA});
  } else {
    cpWeather = st.cpWeather || {};
    cpwSyncedThrough = st.cpWeatherSyncedThrough || {};
  }
}

async function cpwSave(){
  await chrome.storage.local.set({
    cpWeather: cpWeather,
    cpWeatherSyncedThrough: cpwSyncedThrough,
    cpWeatherSchema: CP_WEATHER_SCHEMA
  });
}

function cpwSiteList(){
  if (cpwSites.length) return cpwSites;
  return Object.keys(cpwStatus).map(function(id){ return {id: id, name: cpwStatus[id].name || id}; });
}

// ---------------------------------------------------------------- geocoding
// Weather doesn't vary at street-address resolution, so this only needs the
// city/state, extracted from the "Street, City, ST ZIP" string cpParseAddress
// already produces during a Site Status sync (in cryptopay.js).
function cpwCityStateFromAddress(addr){
  if (!addr) return null;
  const parts = addr.split(",").map(function(s){ return s.trim(); });
  if (parts.length < 2) return null;
  const city = parts[parts.length - 2];
  const stateMatch = parts[parts.length - 1].match(/[A-Z]{2}/);
  return {city: city, state: stateMatch ? stateMatch[0] : ""};
}

async function cpwGeocode(address){
  const cs = cpwCityStateFromAddress(address);
  if (!cs || !cs.city) return null;
  try {
    const url = CPW_GEO_URL + "?name=" + encodeURIComponent(cs.city) + "&count=10&language=en&format=json";
    const res = await fetch(url);
    const data = await res.json();
    const results = (data && data.results) || [];
    if (!results.length) return null;
    const us = results.filter(function(r){ return r.country_code === "US"; });
    const pick = us.length ? us[0] : results[0];
    return {lat: pick.latitude, lon: pick.longitude};
  } catch(e){
    return null;
  }
}

// Reads-merges-writes cpStatus so this never clobbers the name/devices/address
// fields that cryptopay.js's own Site Status sync owns.
async function cpwSaveSiteCoords(siteId, lat, lon){
  const st = await chrome.storage.local.get(["cpStatus"]);
  const fresh = st.cpStatus || {};
  fresh[siteId] = Object.assign({}, fresh[siteId], {lat: lat, lon: lon});
  await chrome.storage.local.set({cpStatus: fresh});
  cpwStatus = fresh;
}

// ------------------------------------------------------- historical/forecast
async function cpwFetchHistory(lat, lon, startDate, endDate){
  try {
    const url = CPW_HIST_URL + "?latitude=" + lat + "&longitude=" + lon +
      "&start_date=" + startDate + "&end_date=" + endDate +
      "&daily=precipitation_sum,temperature_2m_max,temperature_2m_min" +
      "&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FNew_York";
    const res = await fetch(url);
    const data = await res.json();
    if (!data || !data.daily || !data.daily.time) return [];
    const out = [];
    for (let i = 0; i < data.daily.time.length; i++){
      out.push({
        date: data.daily.time[i],
        precip: data.daily.precipitation_sum[i],
        tmax: data.daily.temperature_2m_max[i],
        tmin: data.daily.temperature_2m_min[i]
      });
    }
    return out;
  } catch(e){
    return [];
  }
}

async function cpwFetchForecast(lat, lon){
  try {
    const url = CPW_FCST_URL + "?latitude=" + lat + "&longitude=" + lon +
      "&daily=precipitation_sum,temperature_2m_max,temperature_2m_min" +
      "&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FNew_York&forecast_days=10";
    const res = await fetch(url);
    const data = await res.json();
    if (!data || !data.daily || !data.daily.time) return [];
    const out = [];
    for (let i = 0; i < data.daily.time.length; i++){
      out.push({
        date: data.daily.time[i],
        precip: data.daily.precipitation_sum[i],
        tmax: data.daily.temperature_2m_max[i],
        tmin: data.daily.temperature_2m_min[i]
      });
    }
    return out;
  } catch(e){
    return [];
  }
}

function cpwGetForecastCached(siteId){
  const c = cpwForecastCache[siteId];
  return c ? c.days : [];
}

// ------------------------------------------------------------------- sync
async function cpwSync(){
  const btn = cpwEl("cpwSyncBtn");
  const statusEl = cpwEl("cpwStatus");
  if (btn) btn.disabled = true;
  await cpwLoad();
  const sites = cpwSiteList();
  if (!sites.length){
    if (statusEl) statusEl.textContent = "No sites found yet. Sync Cryptopay Site Status first.";
    if (btn) btn.disabled = false;
    return;
  }

  let geocoded = 0, historyFetched = 0, forecastFetched = 0;
  const today = new Date();
  const lagCutoff = new Date(today); lagCutoff.setDate(lagCutoff.getDate() - CPW_ARCHIVE_LAG_DAYS);
  const lagCutoffStr = cpwDs(lagCutoff);

  for (const s of sites){
    const info = cpwStatus[s.id] || {};
    let lat = info.lat, lon = info.lon;

    if ((lat === undefined || lon === undefined) && info.address){
      if (statusEl) statusEl.textContent = "Looking up location for " + s.name + "...";
      const geo = await cpwGeocode(info.address);
      if (geo){
        lat = geo.lat; lon = geo.lon;
        await cpwSaveSiteCoords(s.id, lat, lon);
        geocoded++;
      }
      await new Promise(function(r){ setTimeout(r, 300); });
    }
    if (lat === undefined || lon === undefined) continue;

    const revDates = Object.keys(cpwHist[s.id] || {}).sort();
    if (revDates.length){
      const earliest = revDates[0];
      const already = cpwSyncedThrough[s.id];
      const startDate = (already && already >= earliest) ? cpwNextDay(already) : earliest;
      if (startDate <= lagCutoffStr){
        if (statusEl) statusEl.textContent = "Fetching weather history for " + s.name + "...";
        const days = await cpwFetchHistory(lat, lon, startDate, lagCutoffStr);
        if (days.length){
          cpWeather[s.id] = cpWeather[s.id] || {};
          for (const d of days) cpWeather[s.id][d.date] = {precip: d.precip, tmax: d.tmax, tmin: d.tmin};
          cpwSyncedThrough[s.id] = lagCutoffStr;
          historyFetched++;
          await cpwSave();
        }
        await new Promise(function(r){ setTimeout(r, 300); });
      }
    }

    if (statusEl) statusEl.textContent = "Fetching forecast for " + s.name + "...";
    const fc = await cpwFetchForecast(lat, lon);
    if (fc.length){
      cpwForecastCache[s.id] = {fetchedAt: Date.now(), days: fc};
      forecastFetched++;
    }
    await new Promise(function(r){ setTimeout(r, 300); });
  }

  await chrome.storage.local.set({cpWeatherForecast: cpwForecastCache});

  if (statusEl){
    statusEl.textContent = "Done. " + geocoded + " site" + (geocoded === 1 ? "" : "s") + " located, " +
      historyFetched + " history update" + (historyFetched === 1 ? "" : "s") + ", " +
      forecastFetched + " forecast" + (forecastFetched === 1 ? "" : "s") + " refreshed.";
  }
  if (btn) btn.disabled = false;
  cpwRenderStatsPage();
  cpwRenderOverviewTile();
}

// ----------------------------------------------------------- factor fitting
function cpwPrecipBucket(inches){
  if (inches === undefined || inches === null) return "dry";
  if (inches <= 0.01) return "dry";
  if (inches <= 0.1) return "light";
  if (inches <= 0.5) return "rain";
  return "heavy";
}
function cpwTempBucket(tmaxF){
  if (tmaxF === undefined || tmaxF === null) return "mild";
  if (tmaxF < 40) return "cold";
  if (tmaxF < 60) return "cool";
  if (tmaxF < 85) return "mild";
  return "hot";
}

function cpwGroupSeries(siteId, group){
  const types = CPW_GROUPS[group].types;
  const hist = cpwHist[siteId] || {};
  const out = {};
  for (const dt of Object.keys(hist)){
    const bt = hist[dt].byType || {};
    let rev = 0;
    for (const t of types){ if (bt[t]) rev += bt[t].revenue || 0; }
    out[dt] = rev;
  }
  return out;
}

// Weekday-only baseline for a plain {date: revenue} series - the weather
// factors below are fit against deviation from THIS, not the whole-site model
// in cpproj.js, since each category group has its own weekday shape.
function cpwFitBaseline(series){
  const keys = Object.keys(series).sort();
  const model = {dow: [1, 1, 1, 1, 1, 1, 1], level: 0, days: keys.length};
  if (!keys.length) return model;
  const rows = keys.map(function(k){ return {d: cpwDateFromKey(k), rev: series[k]}; });
  const mean = rows.reduce(function(a, r){ return a + r.rev; }, 0) / rows.length;
  if (mean > 0){
    for (let k = 0; k < 7; k++){
      const vals = rows.filter(function(r){ return r.d.getDay() === k; }).map(function(r){ return r.rev; });
      const raw = vals.length ? (vals.reduce(function(a, b){ return a + b; }, 0) / vals.length) / mean : 1;
      const K = 4;
      model.dow[k] = (vals.length * raw + K * 1) / (vals.length + K);
    }
  }
  model.level = mean;
  return model;
}

// Learns precip/temp multipliers for one site+group from its own history:
// for each day with both revenue and weather on record, compares actual
// revenue to the weekday-expected amount, then averages that ratio within
// each weather bucket. Buckets with few days are shrunk toward "no effect".
function cpwFitWeatherFactors(siteId, group){
  const series = cpwGroupSeries(siteId, group);
  const baseline = cpwFitBaseline(series);
  const weather = cpWeather[siteId] || {};
  const precipBuckets = {}; CPW_PRECIP_BUCKETS.forEach(function(b){ precipBuckets[b] = []; });
  const tempBuckets = {}; CPW_TEMP_BUCKETS.forEach(function(b){ tempBuckets[b] = []; });

  let matched = 0;
  for (const dt of Object.keys(series)){
    const w = weather[dt];
    if (!w || w.precip === undefined || w.precip === null) continue;
    if (baseline.level <= 0) continue;
    const d = cpwDateFromKey(dt);
    const expected = baseline.level * baseline.dow[d.getDay()];
    if (expected <= 0) continue;
    const resid = series[dt] / expected;
    precipBuckets[cpwPrecipBucket(w.precip)].push(resid);
    if (w.tmax !== undefined && w.tmax !== null) tempBuckets[cpwTempBucket(w.tmax)].push(resid);
    matched++;
  }

  function factorsFor(buckets, K){
    const f = {};
    for (const b of Object.keys(buckets)){
      const vals = buckets[b];
      const raw = vals.length ? vals.reduce(function(a, x){ return a + x; }, 0) / vals.length : 1;
      f[b] = {factor: (vals.length * raw + K * 1) / (vals.length + K), n: vals.length};
    }
    return f;
  }

  return {
    days: matched,
    reliable: matched >= CPW_MIN_DAYS_FOR_FACTORS,
    baseline: baseline,
    precip: factorsFor(precipBuckets, 8),
    temp: factorsFor(tempBuckets, 8)
  };
}

function cpwFactorText(factor){
  const pct = Math.round((factor - 1) * 100);
  if (Math.abs(pct) < 3) return "about normal";
  return (pct >= 0 ? "+" : "") + pct + "% vs normal";
}

// --------------------------------------------------------------- projection
function cpwExpectedDayTotal(d, groupFits, otherBaseline, fmap, applyWeather){
  const dk = cpwDs(d);
  let total = 0;
  const flags = [];
  for (const g of Object.keys(CPW_GROUPS)){
    const fit = groupFits[g];
    let mult = 1;
    const w = fmap[dk];
    if (applyWeather && fit.reliable && w){
      const pf = fit.precip[cpwPrecipBucket(w.precip)];
      const tf = fit.temp[cpwTempBucket(w.tmax)];
      mult = (pf ? pf.factor : 1) * (tf ? tf.factor : 1);
    }
    const base = fit.baseline.level * fit.baseline.dow[d.getDay()];
    total += base * mult;
    if (applyWeather && w && fit.reliable && Math.abs(mult - 1) >= 0.15){
      flags.push({date: dk, group: g, mult: mult, delta: base * mult - base});
    }
  }
  total += otherBaseline.level * otherBaseline.dow[d.getDay()];
  return {total: total, flags: flags};
}

// Weather-adjusted month projection for one site. Days beyond the ~10-day
// forecast, or for a group without enough history yet, fall back to the same
// weekday-only baseline cpSiteProjection (cryptopay.js) already uses.
function cpwSiteWeatherProjection(siteId){
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = cpwDs(today);
  const hist = cpwHist[siteId] || {};

  let mtd = 0;
  for (const dt of Object.keys(hist)){
    if (dt.slice(0, 7) === todayStr.slice(0, 7) && dt <= todayStr) mtd += hist[dt].revenue || 0;
  }

  const forecast = cpwGetForecastCached(siteId);
  const fmap = {};
  for (const f of forecast) fmap[f.date] = f;

  const groupFits = {};
  for (const g of Object.keys(CPW_GROUPS)) groupFits[g] = cpwFitWeatherFactors(siteId, g);

  const otherSeries = {};
  for (const dt of Object.keys(hist)){
    const bt = hist[dt].byType || {};
    let known = 0;
    for (const g of Object.keys(CPW_GROUPS)){
      for (const t of CPW_GROUPS[g].types){ if (bt[t]) known += bt[t].revenue || 0; }
    }
    otherSeries[dt] = (hist[dt].revenue || 0) - known;
  }
  const otherBaseline = cpwFitBaseline(otherSeries);

  const todayExp = cpwExpectedDayTotal(today, groupFits, otherBaseline, fmap, true);
  let rest = Math.max(0, todayExp.total - (hist[todayStr] ? (hist[todayStr].revenue || 0) : 0));
  let flagged = todayExp.flags.slice();

  for (let day = today.getDate() + 1; day <= daysInMonth; day++){
    const d = new Date(y, m, day);
    const r = cpwExpectedDayTotal(d, groupFits, otherBaseline, fmap, true);
    rest += r.total;
    flagged = flagged.concat(r.flags);
  }

  return {
    mtd: mtd,
    projected: mtd + rest,
    hasForecast: forecast.length > 0,
    anyReliable: Object.keys(groupFits).some(function(g){ return groupFits[g].reliable; }),
    flagged: flagged,
    groupFits: groupFits,
    otherBaseline: otherBaseline
  };
}

function cpwAllWeatherProjection(){
  const out = {mtd: 0, projected: 0, sitesWithForecast: 0, totalSites: 0};
  for (const s of cpwSiteList()){
    const p = cpwSiteWeatherProjection(s.id);
    out.mtd += p.mtd;
    out.projected += p.projected;
    out.totalSites++;
    if (p.hasForecast) out.sitesWithForecast++;
  }
  return out;
}

// ------------------------------------------------------------------ render
function cpwRenderOverviewTile(){
  const el = cpwEl("cpOvWeatherProj");
  if (!el) return;
  const note = cpwEl("cpOvWeatherNote");
  if (!Object.keys(cpwHist).length){
    el.textContent = "--";
    if (note) note.textContent = "";
    return;
  }
  const p = cpwAllWeatherProjection();
  el.textContent = cpwMoney(p.projected);
  if (note){
    if (!p.sitesWithForecast){
      note.textContent = "No forecast synced yet - matches baseline. Sync on the Statistics page.";
    } else {
      const baseline = (typeof cpAllProjection === "function") ? cpAllProjection() : null;
      if (baseline){
        const delta = p.projected - baseline.projected;
        note.textContent = (delta >= 0 ? "+" : "") + cpwMoney(delta) + " vs the plain baseline, from a synced forecast covering " + p.sitesWithForecast + " of " + p.totalSites + " sites.";
      } else {
        note.textContent = p.sitesWithForecast + " of " + p.totalSites + " sites have a synced forecast.";
      }
    }
  }
}

async function cpwRenderStatsPage(){
  await cpwLoad();
  const wrap = cpwEl("cpwBody");
  const selEl = cpwEl("cpwSiteSelect");
  if (!wrap) return;
  const sites = cpwSiteList();
  if (!sites.length){
    wrap.innerHTML = "<p>No Cryptopay sites yet. Sync Site Status first.</p>";
    if (selEl) selEl.innerHTML = "";
    return;
  }
  if (!cpwSelectedSite || !sites.some(function(s){ return s.id === cpwSelectedSite; })) cpwSelectedSite = sites[0].id;

  if (selEl){
    let opts = "";
    for (const s of sites) opts += "<option value=\"" + s.id + "\"" + (s.id === cpwSelectedSite ? " selected" : "") + ">" + s.name + "</option>";
    selEl.innerHTML = opts;
  }

  const info = cpwStatus[cpwSelectedSite] || {};
  const hasCoords = info.lat !== undefined && info.lon !== undefined;
  const forecast = cpwGetForecastCached(cpwSelectedSite);
  const weatherDays = Object.keys(cpWeather[cpwSelectedSite] || {}).length;

  let fcRows = "";
  for (const f of forecast){
    const d = cpwDateFromKey(f.date);
    fcRows += "<tr><td>" + d.toLocaleDateString("en-US", {weekday: "short", month: "short", day: "numeric"}) + "</td><td>" +
      (f.tmax !== undefined ? Math.round(f.tmax) + "\u00b0F" : "-") + "</td><td>" +
      (f.tmin !== undefined ? Math.round(f.tmin) + "\u00b0F" : "-") + "</td><td>" +
      (f.precip !== undefined ? f.precip.toFixed(2) + "\"" : "-") + "</td></tr>";
  }
  if (!fcRows) fcRows = "<tr><td colspan=\"4\">No forecast synced yet.</td></tr>";

  let factorRows = "";
  const groupFitsForTable = {};
  for (const g of Object.keys(CPW_GROUPS)){
    const fit = cpwFitWeatherFactors(cpwSelectedSite, g);
    groupFitsForTable[g] = fit;
    factorRows += "<tr class=\"cp-devgroup\"><td colspan=\"3\"><strong>" + CPW_GROUPS[g].label + "</strong> (" + fit.days + " matched day" + (fit.days === 1 ? "" : "s") + (fit.reliable ? "" : " - not enough yet") + ")</td></tr>";
    for (const b of CPW_PRECIP_BUCKETS){
      const f = fit.precip[b];
      factorRows += "<tr><td>" + CPW_PRECIP_LABELS[b] + "</td><td>" + f.n + " day" + (f.n === 1 ? "" : "s") + "</td><td>" + cpwFactorText(f.factor) + "</td></tr>";
    }
    for (const b of CPW_TEMP_BUCKETS){
      const f = fit.temp[b];
      factorRows += "<tr><td>" + CPW_TEMP_LABELS[b] + "</td><td>" + f.n + " day" + (f.n === 1 ? "" : "s") + "</td><td>" + cpwFactorText(f.factor) + "</td></tr>";
    }
  }

  const baseline = (typeof cpSiteProjection === "function") ? cpSiteProjection(cpwSelectedSite) : {projected: 0};
  const wproj = cpwSiteWeatherProjection(cpwSelectedSite);
  const delta = wproj.projected - baseline.projected;

  const byDate = {};
  for (const fl of wproj.flagged){
    byDate[fl.date] = byDate[fl.date] || {date: fl.date, delta: 0, parts: []};
    byDate[fl.date].delta += fl.delta;
    byDate[fl.date].parts.push(CPW_GROUPS[fl.group].label.split(" ")[0] + " " + (fl.mult >= 1 ? "+" : "") + Math.round((fl.mult - 1) * 100) + "%");
  }
  const flagList = Object.keys(byDate).map(function(k){ return byDate[k]; }).sort(function(a, b){ return a.date < b.date ? -1 : 1; });
  let flagRows = "";
  for (const fl of flagList){
    const d = cpwDateFromKey(fl.date);
    flagRows += "<li>" + d.toLocaleDateString("en-US", {weekday: "long", month: "short", day: "numeric"}) + ": " + fl.parts.join(", ") + " (" + (fl.delta >= 0 ? "+" : "") + cpwMoney(fl.delta) + ")</li>";
  }
  if (!flagRows) flagRows = "<li class=\"ok\">No day in the forecast moves either group's revenue by more than 15%.</li>";

  wrap.innerHTML =
    "<section class=\"summary\">" +
      "<div class=\"stat\" title=\"This site's plain weekday-based projection, with no weather adjustment.\"><label>Baseline projection</label><div>" + cpwMoney(baseline.projected) + "</div></div>" +
      "<div class=\"stat\" title=\"Same projection, with each forecasted day adjusted by this site's learned response to that day's rain and temperature.\"><label>Weather-adjusted</label><div>" + cpwMoney(wproj.projected) + "</div></div>" +
      "<div class=\"stat\"><label>Difference</label><div class=\"" + (delta >= 0 ? "cpj-good" : "cpj-limited") + "\">" + (delta >= 0 ? "+" : "") + cpwMoney(delta) + "</div></div>" +
    "</section>" +
    (hasCoords ? "" : "<p class=\"cp-periodnote\">No location found for this site yet - press Sync Weather below.</p>") +
    "<h2>Days worth watching in the forecast</h2>" +
    "<ul class=\"cpj-notes\">" + flagRows + "</ul>" +
    "<h2>10-day forecast</h2>" +
    "<table class=\"via\"><thead><tr><th>Day</th><th>High</th><th>Low</th><th>Precipitation</th></tr></thead><tbody>" + fcRows + "</tbody></table>" +
    "<h2>This site's learned weather response</h2>" +
    "<table class=\"via\"><thead><tr><th>Condition</th><th>Days observed</th><th>Effect on revenue</th></tr></thead><tbody>" + factorRows + "</tbody></table>" +
    "<ul class=\"cpj-notes\">" +
      "<li>Effects are learned separately for self-serve equipment (exposed to weather) and the automatic tunnel (sheltered, usually far less weather-sensitive), then applied only to each group's own forecasted days.</li>" +
      "<li>A condition needs a real sample of matching days before its effect is trusted; thin buckets are pulled toward \"about normal\" rather than swinging on one unusual day.</li>" +
      "<li>The forecast only reaches about 10 days out. Days beyond that use the plain baseline, same as the regular Projections page.</li>" +
      "<li>" + weatherDays + " day" + (weatherDays === 1 ? "" : "s") + " of historical weather stored for this site.</li>" +
    "</ul>";
}

async function cpwInit(){
  await cpwLoad();
  cpwRenderOverviewTile();
  const navBtn = document.querySelector('.nav-btn[data-page="cp-statistics"]');
  if (navBtn) navBtn.addEventListener("click", function(){ setTimeout(cpwRenderStatsPage, 0); });
  const syncBtn = cpwEl("cpwSyncBtn");
  if (syncBtn) syncBtn.addEventListener("click", cpwSync);
  const sel = cpwEl("cpwSiteSelect");
  if (sel){
    sel.addEventListener("change", function(){
      cpwSelectedSite = sel.value;
      cpwRenderStatsPage();
    });
  }
}
document.addEventListener("DOMContentLoaded", cpwInit);
