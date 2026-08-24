#!/usr/bin/env python3
"""Patch consumers.js: scrape washPlan from consumer pass page during vehicle count fetch."""

FILE = "/workspaces/WashLevel/extension/consumers.js"
with open(FILE, "r") as f:
    src = f.read()

# 1. Add washPlan to incremental sync preservation
old1 = "lastRenew: ex.lastRenew || 0, veh: ex.veh || 1, phone: ex.phone || \"\", favSite: ex.favSite || \"\""
new1 = "lastRenew: ex.lastRenew || 0, veh: ex.veh || 1, phone: ex.phone || \"\", favSite: ex.favSite || \"\", washPlan: ex.washPlan || \"\""
assert src.count(old1) == 1, "A1: " + str(src.count(old1))
src = src.replace(old1, new1)

# 2. Add washPlan to new consumer records
old2 = "lastNew: 0, lastRenew: 0, veh: 1, phone: \"\", favSite: \"\"};"
new2 = "lastNew: 0, lastRenew: 0, veh: 1, phone: \"\", favSite: \"\", washPlan: \"\"};"
assert src.count(old2) == 1, "A2: " + str(src.count(old2))
src = src.replace(old2, new2)

# 3. Modify fetchVehicleCount to also grab wash pass name and return object
old3 = """    for (const s of doc.querySelectorAll("strong")){
      if (/^vehicle\\s*count$/i.test(s.textContent.trim())){
        const p = s.nextElementSibling;
        if (p){ const n = parseInt(p.textContent); if (n > 0) return n; }
      }
    }
    return 1;
  } catch(e){ return 1; }
}"""
new3 = """    let veh = 1, washPlan = "";
    for (const s of doc.querySelectorAll("strong")){
      const t = s.textContent.trim();
      if (/^vehicle\\s*count$/i.test(t)){
        const p = s.nextElementSibling;
        if (p){ const n = parseInt(p.textContent); if (n > 0) veh = n; }
      }
      if (/^wash\\s*pass$/i.test(t)){
        const p = s.nextElementSibling;
        if (p) washPlan = p.textContent.trim();
      }
    }
    return {veh: veh, washPlan: washPlan};
  } catch(e){ return {veh: 1, washPlan: ""}; }
}"""
assert src.count(old3) == 1, "A3: " + str(src.count(old3))
src = src.replace(old3, new3)

# 4. Update fetchVehBatch to handle object return
old4 = "    fresh[ids[i]].veh = v; fresh[ids[i]].vehChecked = true;"
new4 = "    fresh[ids[i]].veh = v.veh; fresh[ids[i]].vehChecked = true; if (v.washPlan) fresh[ids[i]].washPlan = v.washPlan;"
assert src.count(old4) == 1, "A4: " + str(src.count(old4))
src = src.replace(old4, new4)

# 5. Update the -1 check to handle object (session expiry now returns -1 not object)
# The current check is: if (v === -1)
# fetchVehicleCount returns -1 on session expiry, object otherwise — no change needed

with open(FILE, "w") as f:
    f.write(src)
print("OK consumers.js patched — washPlan scraping added")
