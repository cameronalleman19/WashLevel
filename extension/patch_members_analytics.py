#!/usr/bin/env python3
"""Patch members.js: add wash frequency distribution, tier breakdown, cancellation timing."""

FILE = "/workspaces/WashLevel/extension/members.js"
with open(FILE, "r") as f:
    src = f.read()

# 1. Add all three render functions before mRenderVehicles
old1 = "function mRenderVehicles(){"
assert src.count(old1) == 1, "A1: " + str(src.count(old1))

FUNCTIONS = r'''function mTenureRate(c){
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
  const tenureBuckets = new Array(9).fill(0);
  for (const c of active){
    const r = Math.round(mRecentRateVeh(c));
    recentBuckets[Math.min(r, 8)]++;
    const t = Math.round(mTenureRate(c));
    tenureBuckets[Math.min(t, 8)]++;
  }
  el.innerHTML =
    '<div style="display:flex;gap:24px;flex-wrap:wrap">' +
    '<div style="flex:1;min-width:280px"><h3 style="margin:0 0 4px;font-size:14px;color:#b9c6da">Recent (last 2 months)</h3>' +
    mBarChart(recentBuckets, labels, "#4f8ef7") + '</div>' +
    '<div style="flex:1;min-width:280px"><h3 style="margin:0 0 4px;font-size:14px;color:#b9c6da">Tenure average (up to 12mo)</h3>' +
    mBarChart(tenureBuckets, labels, "#7c5cbf") + '</div>' +
    '</div>';
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

'''
src = src.replace(old1, FUNCTIONS + old1)

# 2. Call all three in memRender — insert before mRenderVehicles()
old2 = "  mRenderVehicles();\n"
assert src.count(old2) == 1, "A2: " + str(src.count(old2))
src = src.replace(old2, "  mRenderFrequency();\n  mRenderTierBreakdown();\n  mRenderCancelTiming();\n  mRenderVehicles();\n")

with open(FILE, "w") as f:
    f.write(src)
print("OK members.js patched — frequency, tiers, cancel timing added")
