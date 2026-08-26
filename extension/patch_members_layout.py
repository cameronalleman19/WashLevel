#!/usr/bin/env python3
"""Patch members.js: time frame dropdown, layout reorder, active members tiles."""

FILE = "/workspaces/WashLevel/extension/members.js"
with open(FILE, "r") as f:
    src = f.read()

# 1. Drop tenure chart from mRenderFrequency — keep only recent
old1 = r"""  el.innerHTML =
    '<div style="display:flex;gap:24px;flex-wrap:wrap">' +
    '<div style="flex:1;min-width:280px"><h3 style="margin:0 0 4px;font-size:14px;color:#b9c6da">Recent (last 2 months)</h3>' +
    mBarChart(recentBuckets, labels, "#4f8ef7") + '</div>' +
    '<div style="flex:1;min-width:280px"><h3 style="margin:0 0 4px;font-size:14px;color:#b9c6da">Tenure average (up to 12mo)</h3>' +
    mBarChart(tenureBuckets, labels, "#7c5cbf") + '</div>' +
    '</div>';"""
new1 = """  el.innerHTML = mBarChart(recentBuckets, labels, "#4f8ef7");"""
assert src.count(old1) == 1, "A1: " + str(src.count(old1))
src = src.replace(old1, new1)

# Remove tenure bucket computation too
old1b = """  const tenureBuckets = new Array(9).fill(0);
  for (const c of active){
    const r = Math.round(mRecentRateVeh(c));
    recentBuckets[Math.min(r, 8)]++;
    const t = Math.round(mTenureRate(c));
    tenureBuckets[Math.min(t, 8)]++;
  }"""
new1b = """  for (const c of active){
    const r = Math.round(mRecentRateVeh(c));
    recentBuckets[Math.min(r, 8)]++;
  }"""
assert src.count(old1b) == 1, "A1b: " + str(src.count(old1b))
src = src.replace(old1b, new1b)

# 2. Add mAllTimeHigh function and mPopulateTimeFrame before mRenderTiles
old2 = "function mRenderTiles(){"
assert src.count(old2) == 1, "A2: " + str(src.count(old2))
pre = r'''function mAllTimeHigh(){
  const daySums = {};
  for (const s of mFilteredSites()){
    for (const dt of Object.keys(mHist[s.id] || {})){
      const v = mHist[s.id][dt].consumerVehicles || 0;
      if (v) daySums[dt] = (daySums[dt] || 0) + v;
    }
  }
  let max = 0;
  for (const dt of Object.keys(daySums)){
    if (daySums[dt] > max) max = daySums[dt];
  }
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
    const p = v.split("-");
    const y = parseInt(p[0]), m = parseInt(p[1]) - 1;
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    const endStr = end > today ? todayStr : mDs(end);
    return {from: mDs(start), to: endStr, label: start.toLocaleString("en-US", {month: "long", year: "numeric"})};
  }
  if (/^\d{4}$/.test(v)){
    const y = parseInt(v);
    const endStr = y === today.getFullYear() ? todayStr : y + "-12-31";
    return {from: y + "-01-01", to: endStr, label: v};
  }
  return {from: todayStr.slice(0, 8) + "01", to: todayStr, label: "Month to date"};
}

function mPopulateTimeFrame(){
  const sel = M$("memTimeFrame");
  if (!sel) return;
  const cur = sel.value || "mtd";
  const today = new Date();
  let html = '<option value="today">Today</option>';
  html += '<option value="7d">Last 7 days</option>';
  html += '<option value="30d">Last 30 days</option>';
  html += '<option value="mtd">Month to date</option>';
  html += '<optgroup label="Months">';
  for (let i = 1; i <= 24; i++){
    const d = mAddMonths(today, -i);
    const k = mMonthKey(d);
    html += '<option value="' + k + '">' + d.toLocaleString("en-US", {month: "long", year: "numeric"}) + '</option>';
  }
  html += '</optgroup>';
  html += '<option value="ytd">Year to date</option>';
  html += '<optgroup label="Years">';
  for (let y = today.getFullYear(); y >= today.getFullYear() - 5; y--){
    html += '<option value="' + y + '">' + y + '</option>';
  }
  html += '</optgroup>';
  sel.innerHTML = html;
  sel.value = cur;
}

'''
src = src.replace(old2, pre + old2)

# 3. Replace mRenderTiles to use time frame + add active members and all-time high
old3 = """function mRenderTiles(){
  const el = M$("memTiles");
  if (!el) return;
  const today = new Date();
  const todayStr = mDs(today);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const wkStart = new Date(today); wkStart.setDate(wkStart.getDate() - today.getDay());
  const moStart = todayStr.slice(0, 8) + "01";
  const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const lmStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const d30 = new Date(today); d30.setDate(d30.getDate() - 29);

  const t = mMemberRange(todayStr, todayStr);
  const y = mMemberRange(mDs(yest), mDs(yest));
  const w = mMemberRange(mDs(wkStart), todayStr);
  const m = mMemberRange(moStart, todayStr);
  const lm = mMemberRange(mDs(lmStart), mDs(lmEnd));
  const r30 = mMemberRange(mDs(d30), todayStr);

  el.innerHTML =
    mTile("Member sales today", mMoney0(t.rev)) +
    mTile("Member sales yesterday", mMoney0(y.rev)) +
    mTile("Week to date", mMoney0(w.rev)) +
    mTile("Month to date", mMoney0(m.rev)) +
    mTile("Last month", mMoney0(lm.rev)) +
    mTile("Member $/wash MTD", m.passUse ? "$" + (m.rev / m.passUse).toFixed(2) : "--") +
    mTile("Member $/wash 30d", r30.passUse ? "$" + (r30.rev / r30.passUse).toFixed(2) : "--") +
    mTile("Pass uses 30d", r30.passUse.toLocaleString("en-US"));
}"""

new3 = """function mRenderTiles(){
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
}"""
assert src.count(old3) == 1, "A3: " + str(src.count(old3))
src = src.replace(old3, new3)

# 4. Move mRenderEconomics call right after mRenderTiles in memRender
# First remove it from its current position
old4 = "  mRenderEconomics();\n  mRenderVehicles();\n"
new4 = "  mRenderVehicles();\n"
assert src.count(old4) == 1, "A4: " + str(src.count(old4))
src = src.replace(old4, new4)

# Then insert it after mRenderTiles + tips
old5 = "  mRenderTiles();\n  mRenderChart();\n"
new5 = "  mRenderTiles();\n  mRenderEconomics();\n  mRenderChart();\n"
assert src.count(old5) == 1, "A5: " + str(src.count(old5))
src = src.replace(old5, new5)

# 5. Add time frame dropdown listener and populate in DOMContentLoaded
old6 = "  memRender().then(mPopulateSiteFilter);"
new6 = """  const memTF = M$("memTimeFrame");
  if (memTF) memTF.addEventListener("change", () => { mRenderTiles(); });
  memRender().then(() => { mPopulateSiteFilter(); mPopulateTimeFrame(); });"""
assert src.count(old6) == 1, "A6: " + str(src.count(old6))
src = src.replace(old6, new6)

with open(FILE, "w") as f:
    f.write(src)
print("OK members.js patched")
