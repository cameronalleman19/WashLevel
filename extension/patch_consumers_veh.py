#!/usr/bin/env python3
"""Patch consumers.js: vehicle count support."""

FILE = "/workspaces/WashLevel/extension/consumers.js"

with open(FILE, "r") as f:
    src = f.read()

# 1. Preserve veh on incremental sync (ex branch)
old = "lastRenew: ex.lastRenew || 0}"
new = "lastRenew: ex.lastRenew || 0, veh: ex.veh || 1}"
assert src.count(old) == 1, "A1: " + str(src.count(old))
src = src.replace(old, new)

# 2. Default veh=1 on new consumer record
old = "lastNew: 0, lastRenew: 0};"
new = "lastNew: 0, lastRenew: 0, veh: 1};"
assert src.count(old) == 1, "A2: " + str(src.count(old))
src = src.replace(old, new)

# 3. Insert fetchVehicleCount before consSync
old = "async function consSync(){"
assert src.count(old) == 1, "A3: " + str(src.count(old))
fn = '''async function fetchVehicleCount(id){
  try {
    const res = await fetch(CBASE + "/consumerpass/" + id + "/", {credentials: "include"});
    if (!res.ok) return 1;
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()){
      const el = walker.currentNode;
      const txt = el.textContent.trim();
      if (!/^vehicle\\s*count$/i.test(txt)) continue;
      if (el.children.length > 2) continue;
      let sib = el.nextSibling;
      while (sib && sib.nodeType === 3 && !sib.textContent.trim()) sib = sib.nextSibling;
      if (sib){ const n = parseInt(sib.textContent); if (n > 0) return n; }
      if (el.nextElementSibling){ const n = parseInt(el.nextElementSibling.textContent); if (n > 0) return n; }
      if (el.parentElement && el.parentElement.nextElementSibling){
        const n = parseInt(el.parentElement.nextElementSibling.textContent);
        if (n > 0) return n;
      }
    }
    return 1;
  } catch(e){ return 1; }
}

'''
src = src.replace(old, fn + old)

# 4. Insert vehicle fetch loop before consumers = fresh
old = ("    consumers = fresh;\n"
       "    await chrome.storage.local.set("
       "{washTiers: tiers, plateVisits: pv, "
       "plateSiteMap: psm, lastPaymentSync: endStr});")
assert src.count(old) == 1, "A4: " + str(src.count(old))
ins = '''    const vehCut = Date.now() - 45 * 86400000;
    const vehIds = Object.keys(fresh).filter(id => {
      const c = fresh[id];
      return (c.lastWash > vehCut) || (c.lastRenew > vehCut) || (c.lastNew > vehCut);
    });
    if (vehIds.length){
      for (let vi = 0; vi < vehIds.length; vi++){
        C$("consStatus").textContent = "Fetching vehicle count " + (vi + 1) + "/" + vehIds.length + "...";
        fresh[vehIds[vi]].veh = await fetchVehicleCount(vehIds[vi]);
        await new Promise(r => setTimeout(r, 60));
      }
    }
'''
src = src.replace(old, ins + old)

# 5. Update consPerMonth to factor in vehicles
old = "return c.washes / mo; }"
new = "return c.washes / (mo * (c.veh || 1)); }"
assert src.count(old) == 1, "A5: " + str(src.count(old))
src = src.replace(old, new)

# 6. Colspan 7 -> 8
old = 'colspan=\\"7\\"'
new = 'colspan=\\"8\\"'
assert src.count(old) == 1, "A6: " + str(src.count(old))
src = src.replace(old, new)

# 7. Add Veh column to rows
old = ('+ cFmtDate(c.signup) + "</td><td>" '
       '+ c.washes + "</td><td>"')
new = ('+ cFmtDate(c.signup) + "</td><td>" '
       '+ (c.veh || 1) + "</td><td>" '
       '+ c.washes + "</td><td>"')
assert src.count(old) == 1, "A7: " + str(src.count(old))
src = src.replace(old, new)

# 8. Label avg column /veh
old = '+ consPerMonth(c).toFixed(1) + "</td>'
new = '+ consPerMonth(c).toFixed(1) + "/veh</td>'
assert src.count(old) == 1, "A8: " + str(src.count(old))
src = src.replace(old, new)

with open(FILE, "w") as f:
    f.write(src)
print("OK consumers.js patched")
