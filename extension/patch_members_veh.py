#!/usr/bin/env python3
"""Patch members.js: multi-vehicle plan stats."""

FILE = "/workspaces/WashLevel/extension/members.js"

with open(FILE, "r") as f:
    src = f.read()

# 1. Add mRenderVehicles before memRender
old = "async function memRender(){"
assert src.count(old) == 1, "A1: " + str(src.count(old))
fn = '''function mRenderVehicles(){
  const el = M$("memVehicles");
  if (!el) return;
  const active = Object.values(mConsumers).filter(c => {
    if (mIsCancelled(c)) return false;
    const lastBill = Math.max(c.lastNew || 0, c.lastRenew || 0);
    return lastBill && Date.now() - lastBill <= 45 * 86400000;
  });
  const multi = active.filter(c => (c.veh || 1) >= 2);
  const breakdown = {};
  for (const c of multi){
    const v = c.veh || 1;
    const key = v >= 4 ? "4+" : String(v);
    breakdown[key] = (breakdown[key] || 0) + 1;
  }
  let brkHtml = "";
  for (const k of ["2", "3", "4+"]){
    if (breakdown[k]) brkHtml += mTile(k + "-vehicle plans", breakdown[k]);
  }
  el.innerHTML =
    mTile("Multi-vehicle plans", multi.length) +
    mTile("% of active members", active.length
      ? (multi.length / active.length * 100).toFixed(1) + "%"
      : "--") +
    mTile("Avg vehicles (multi)", multi.length
      ? (multi.reduce((a, c) => a + (c.veh || 1), 0) / multi.length).toFixed(1)
      : "--") +
    brkHtml;
}

'''
src = src.replace(old, fn + old)

# 2. Call mRenderVehicles in memRender
old = "  mRenderEconomics();\n"
assert src.count(old) == 1, "A2: " + str(src.count(old))
src = src.replace(old, old + "  mRenderVehicles();\n")

with open(FILE, "w") as f:
    f.write(src)
print("OK members.js patched")
