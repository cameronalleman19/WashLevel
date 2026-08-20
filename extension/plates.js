/* plates.js – License plate tracking & return-visit analysis
 * Loaded by dashboard page; used by site detail modal + retail tab.
 *
 * Storage format (chrome.storage.local):
 *   plateVisits:  { "ABC1234": { v: [["2026-07-15",0], ...], conv: "2026-08-01" }, ... }
 *   plateSiteMap: ["Mermaid - Lancaster", "Mermaid - York", ...]
 *
 * Each v entry is [dateString, siteIndex].  Deduplicated per plate+date+site
 * during sync.  conv is the date string when a New Pass was purchased (optional).
 */

let plateData = {}, plateSiteMap = [];

async function platesLoad(){
  const st = (await chrome.storage.local.get(["plateVisits", "plateSiteMap"])) || {};
  plateData = st.plateVisits || {};
  plateSiteMap = st.plateSiteMap || [];
}

/* ── helpers ─────────────────────────────────────────────── */

function pFilterVisits(visits, siteIdx, from, to){
  return visits.filter(function(v){
    if (siteIdx !== null && siteIdx !== undefined && v[1] !== siteIdx) return false;
    if (from && v[0] < from) return false;
    if (to && v[0] > to) return false;
    return true;
  });
}

function pUniqueDays(visits){
  var seen = {}, out = [];
  for (var i = 0; i < visits.length; i++){
    if (!seen[visits[i][0]]){ seen[visits[i][0]] = 1; out.push(visits[i]); }
  }
  return out;
}

function pFmtDate(s){
  if (!s) return "--";
  var p = s.split("-");
  return p[1] + "/" + p[2] + "/" + p[0];
}

function pSiteName(idx){
  return plateSiteMap[idx] || ("Site " + idx);
}

/* Find the siteIdx that matches a site id from the sites array.
 * plateSiteMap stores device-prefix names like "Mermaid - Lancaster",
 * while sites[] has {id, name} from the dropdown.  We match by checking
 * if the plateSiteMap entry starts with the site name (case-insensitive). */
function pNormAddr(s){
  return s.toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\bstreet\b/g, "st").replace(/\broad\b/g, "rd")
    .replace(/\bavenue\b/g, "ave").replace(/\bdrive\b/g, "dr")
    .replace(/\bboulevard\b/g, "blvd").replace(/\bparkway\b/g, "pkwy")
    .replace(/\blane\b/g, "ln").replace(/\bcourt\b/g, "ct")
    .replace(/\bnorth\b/g, "").replace(/\bsouth\b/g, "")
    .replace(/\beast\b/g, "").replace(/\bwest\b/g, "")
    .replace(/\s+/g, " ").trim();
}
function pSiteIdx(siteId, sites){
  var site = null;
  for (var i = 0; i < (sites || []).length; i++){
    if (sites[i].id === siteId){ site = sites[i]; break; }
  }
  if (!site) return null;
  var sn = site.name.toLowerCase();
  /* 1. name prefix match (skip junk prefixes < 3 chars) */
  for (var j = 0; j < plateSiteMap.length; j++){
    var pj = plateSiteMap[j].toLowerCase().trim();
    if (pj.length < 3) continue;
    if (pj.indexOf(sn) === 0 || sn.indexOf(pj) === 0) return j;
  }
  /* 2. name substring match (skip junk prefixes < 3 chars) */
  for (var k = 0; k < plateSiteMap.length; k++){
    var pk = plateSiteMap[k].toLowerCase().trim();
    if (pk.length < 3) continue;
    if (pk.indexOf(sn) >= 0 || sn.indexOf(pk) >= 0) return k;
  }
  /* 3. address match: score ALL candidates, pick best */
  var addr = (site.address || "").replace(/[\n\r,]+/g, " ");
  if (!addr) return null;
  var aNorm = pNormAddr(addr);
  var aWords = aNorm.split(" ").filter(function(w){ return w.length > 0; });
  if (!aWords.length) return null;
  /* extract leading street number from address if present */
  var aNum = /^(\d+) /.exec(aNorm);
  var bestIdx = null, bestScore = 0;
  for (var m = 0; m < plateSiteMap.length; m++){
    var dp = plateSiteMap[m].trim();
    if (dp.length < 2) continue;
    var dNorm = pNormAddr(dp);
    var dWords = dNorm.split(" ").filter(function(w){ return w.length > 0; });
    if (!dWords.length) continue;
    /* extract leading number from device prefix */
    var dNum = /^(\d+) /.exec(dNorm);
    /* if both have leading numbers, they MUST match — strong discriminator */
    if (dNum && aNum && dNum[1] !== aNum[1]) continue;
    /* count word matches */
    var matched = 0;
    for (var wi = 0; wi < dWords.length; wi++){
      for (var ai = 0; ai < aWords.length; ai++){
        if (dWords[wi] === aWords[ai] ||
            (dWords[wi].length > 2 && aWords[ai].indexOf(dWords[wi]) === 0) ||
            (aWords[ai].length > 2 && dWords[wi].indexOf(aWords[ai]) === 0)){
          matched++; break;
        }
      }
    }
    /* score: ratio of matched words, weighted by total matched (prefer more specific) */
    var score = dWords.length > 0 ? (matched / dWords.length) + (matched * 0.01) : 0;
    /* bonus for matching street number */
    if (dNum && aNum && dNum[1] === aNum[1]) score += 1;
    if (score > bestScore){ bestScore = score; bestIdx = m; }
  }
  /* require at least 50% of device prefix words matched */
  return (bestScore >= 0.5) ? bestIdx : null;
}

/* ── core stats ──────────────────────────────────────────── */

function plateStats(siteIdx, from, to){
  var plates = {};
  for (var plate in plateData){
    if (!plateData.hasOwnProperty(plate)) continue;
    var rec = plateData[plate];
    var filtered = pFilterVisits(rec.v || [], siteIdx, from, to);
    var days = pUniqueDays(filtered);
    if (days.length > 0){
      var first = days[0][0], last = days[0][0];
      for (var i = 1; i < days.length; i++){
        if (days[i][0] < first) first = days[i][0];
        if (days[i][0] > last) last = days[i][0];
      }
      plates[plate] = {visits: days.length, first: first, last: last, conv: rec.conv || null};
    }
  }

  var total = Object.keys(plates).length;
  var returning = 0, sumVisits = 0;
  var freq = {};

  for (var p in plates){
    if (!plates.hasOwnProperty(p)) continue;
    var vis = plates[p].visits;
    sumVisits += vis;
    if (vis >= 2) returning++;
    var bucket;
    if (vis >= 10) bucket = "10+";
    else if (vis >= 6) bucket = "6-9";
    else if (vis >= 3) bucket = "3-5";
    else bucket = String(vis);
    freq[bucket] = (freq[bucket] || 0) + 1;
  }

  /* top repeaters sorted by visit count desc, then last-seen desc */
  var repeaters = [];
  for (var rp in plates){
    if (!plates.hasOwnProperty(rp)) continue;
    if (plates[rp].visits >= 2) repeaters.push({plate: rp, visits: plates[rp].visits, first: plates[rp].first, last: plates[rp].last});
  }
  repeaters.sort(function(a, b){ return b.visits - a.visits || b.last.localeCompare(a.last); });
  repeaters = repeaters.slice(0, 20);

  return {
    total: total,
    returning: returning,
    returnPct: total ? (returning / total * 100) : 0,
    freq: freq,
    repeaters: repeaters,
    avgVisits: total ? (sumVisits / total) : 0
  };
}

/* ── cross-site bleedover ────────────────────────────────── */

function pIsJunkSite(idx){ var n = pSiteName(parseInt(idx)); return !n || n.length < 2 || n === "-"; }

function plateCrossOver(from, to){
  /* returns { siteIdx: { otherSiteIdx: {count, plates[]}, ... }, ... } */
  var bySite = {};
  for (var plate in plateData){
    if (!plateData.hasOwnProperty(plate)) continue;
    var rec = plateData[plate];
    var filtered = from || to ? pFilterVisits(rec.v || [], null, from, to) : (rec.v || []);
    var siteSet = {};
    for (var i = 0; i < filtered.length; i++){
      if (!pIsJunkSite(filtered[i][1])) siteSet[filtered[i][1]] = 1;
    }
    var siteKeys = Object.keys(siteSet);
    if (siteKeys.length < 2) continue;
    for (var a = 0; a < siteKeys.length; a++){
      var sa = siteKeys[a];
      bySite[sa] = bySite[sa] || {};
      for (var b = 0; b < siteKeys.length; b++){
        if (a === b) continue;
        var sb = siteKeys[b];
        var entry = bySite[sa][sb] = bySite[sa][sb] || {count: 0, plates: []};
        entry.count++;
        if (entry.plates.length < 50) entry.plates.push(plate);
      }
    }
  }
  return bySite;
}

/* total unique plates that visited 2+ sites */
function plateCrossOverTotal(from, to){
  var count = 0;
  for (var plate in plateData){
    if (!plateData.hasOwnProperty(plate)) continue;
    var rec = plateData[plate];
    var filtered = from || to ? pFilterVisits(rec.v || [], null, from, to) : (rec.v || []);
    var siteSet = {};
    for (var i = 0; i < filtered.length; i++){
      if (!pIsJunkSite(filtered[i][1])) siteSet[filtered[i][1]] = 1;
    }
    if (Object.keys(siteSet).length >= 2) count++;
  }
  return count;
}

/* ── conversion analysis ─────────────────────────────────── */

function plateConversions(siteIdx, from, to){
  var conversions = [];
  for (var plate in plateData){
    if (!plateData.hasOwnProperty(plate)) continue;
    var rec = plateData[plate];
    if (!rec.conv) continue;
    if (from && rec.conv < from) continue;
    if (to && rec.conv > to) continue;
    var allVisits = rec.v || [];
    if (siteIdx !== null && siteIdx !== undefined){
      var hasSiteVisit = allVisits.some(function(v){ return v[1] === siteIdx; });
      if (!hasSiteVisit) continue;
    }
    var priorVisits = pFilterVisits(allVisits, siteIdx, null, null).filter(function(v){ return v[0] < rec.conv; });
    var uniquePrior = pUniqueDays(priorVisits).length;
    conversions.push({plate: plate, convDate: rec.conv, priorVisits: uniquePrior});
  }
  conversions.sort(function(a, b){ return b.convDate.localeCompare(a.convDate); });

  var total = conversions.length;
  var withPrior = 0, sumPrior = 0;
  for (var i = 0; i < conversions.length; i++){
    sumPrior += conversions[i].priorVisits;
    if (conversions[i].priorVisits > 0) withPrior++;
  }

  return {conversions: conversions.slice(0, 30), total: total, withPrior: withPrior, avgPrior: total ? (sumPrior / total) : 0};
}

/* ── HTML rendering helpers ──────────────────────────────── */

function pRenderStatsHtml(stats, showTitle){
  var h = "";
  if (showTitle) h += "<h3>License Plate Insights</h3>";
  h += "<div class=\"stat-row\" style=\"display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;\">";
  h += "<div class=\"stat\"><label>Unique plates</label><div>" + stats.total.toLocaleString() + "</div></div>";
  h += "<div class=\"stat\"><label>Returned (2+ visits)</label><div>" + stats.returning.toLocaleString() + " (" + stats.returnPct.toFixed(1) + "%)</div></div>";
  h += "<div class=\"stat\"><label>Avg visits/plate</label><div>" + stats.avgVisits.toFixed(2) + "</div></div>";
  h += "</div>";

  /* frequency distribution */
  var buckets = ["1", "2", "3-5", "6-9", "10+"];
  h += "<table class=\"via\"><thead><tr><th>Visit count</th><th>Plates</th><th>% of total</th></tr></thead><tbody>";
  for (var i = 0; i < buckets.length; i++){
    var cnt = stats.freq[buckets[i]] || 0;
    var pct = stats.total ? (cnt / stats.total * 100).toFixed(1) : "0.0";
    h += "<tr><td>" + buckets[i] + "</td><td>" + cnt.toLocaleString() + "</td><td>" + pct + "%</td></tr>";
  }
  h += "</tbody></table>";

  /* top repeaters */
  if (stats.repeaters.length){
    h += "<details style=\"margin-top:8px;\"><summary style=\"cursor:pointer;font-weight:600;\">Top repeaters (" + stats.repeaters.length + ")</summary>";
    h += "<table class=\"via\" style=\"margin-top:4px;\"><thead><tr><th>Plate</th><th>Visits</th><th>First seen</th><th>Last seen</th></tr></thead><tbody>";
    for (var j = 0; j < stats.repeaters.length; j++){
      var rp = stats.repeaters[j];
      h += "<tr><td>" + rp.plate + "</td><td>" + rp.visits + "</td><td>" + pFmtDate(rp.first) + "</td><td>" + pFmtDate(rp.last) + "</td></tr>";
    }
    h += "</tbody></table></details>";
  }

  return h;
}

function pRenderCrossOverHtml(crossOver, from, to){
  var h = "<h3>Cross-site plate overlap</h3>";
  var crossTotal = plateCrossOverTotal(from, to);
  h += "<p style=\"margin:4px 0 8px;\">" + crossTotal.toLocaleString() + " plates visited 2+ locations</p>";
  var siteKeys = Object.keys(crossOver).sort(function(a, b){ return parseInt(a) - parseInt(b); });
  if (!siteKeys.length) return h + "<p>No cross-site activity found in this period.</p>";
  for (var i = 0; i < siteKeys.length; i++){
    var si = siteKeys[i];
    if (pIsJunkSite(si)) continue;
    var others = crossOver[si];
    var otherKeys = Object.keys(others).filter(function(k){ return !pIsJunkSite(k); }).sort(function(a, b){ return others[b].count - others[a].count; });
    if (!otherKeys.length) continue;
    h += "<details style=\"margin-bottom:6px;\"><summary style=\"cursor:pointer;font-weight:600;\">" + pSiteName(parseInt(si)) + "</summary>";
    h += "<table class=\"via\" style=\"margin-top:4px;\"><thead><tr><th>Also seen at</th><th>Shared plates</th><th></th></tr></thead><tbody>";
    for (var j = 0; j < otherKeys.length; j++){
      var entry = others[otherKeys[j]];
      var plateList = (entry.plates || []).join(", ");
      h += "<tr><td>" + pSiteName(parseInt(otherKeys[j])) + "</td><td>" + entry.count.toLocaleString() + "</td>";
      h += "<td><details style=\"display:inline;\"><summary style=\"cursor:pointer;font-size:.85em;\">view plates</summary>";
      h += "<div style=\"font-size:.8em;max-height:200px;overflow-y:auto;padding:4px;\">" + plateList + (entry.plates.length >= 50 ? "\u2026" : "") + "</div></details></td></tr>";
    }
    h += "</tbody></table></details>";
  }
  return h;
}

function pRenderConversionsHtml(conv){
  var h = "<h3>New Pass conversion — prior retail visits</h3>";
  h += "<div class=\"stat-row\" style=\"display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;\">";
  h += "<div class=\"stat\"><label>Signups with plate</label><div>" + conv.total + "</div></div>";
  h += "<div class=\"stat\"><label>Had prior retail visit</label><div>" + conv.withPrior + " (" + (conv.total ? (conv.withPrior / conv.total * 100).toFixed(0) : 0) + "%)</div></div>";
  h += "<div class=\"stat\"><label>Avg prior visits</label><div>" + conv.avgPrior.toFixed(1) + "</div></div>";
  h += "</div>";
  if (conv.conversions.length){
    h += "<details style=\"margin-top:4px;\"><summary style=\"cursor:pointer;font-weight:600;\">Recent conversions (" + conv.conversions.length + ")</summary>";
    h += "<table class=\"via\" style=\"margin-top:4px;\"><thead><tr><th>Plate</th><th>Signup date</th><th>Prior retail visits</th></tr></thead><tbody>";
    for (var i = 0; i < conv.conversions.length; i++){
      var c = conv.conversions[i];
      h += "<tr><td>" + c.plate + "</td><td>" + pFmtDate(c.convDate) + "</td><td>" + c.priorVisits + "</td></tr>";
    }
    h += "</tbody></table></details>";
  }
  return h;
}
