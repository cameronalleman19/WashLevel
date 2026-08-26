#!/usr/bin/env python3
"""Patch consumers.js: scrape phone from consumer page during vehicle count fetch."""

FILE = "/workspaces/WashLevel/extension/consumers.js"
with open(FILE, "r") as f:
    src = f.read()

# Add phone+favSite scraping from consumer page (step 1 of fetchVehicleCount)
old1 = """    let passUrl = "";
    cDoc.querySelectorAll('a[href*="/consumerpass/"]').forEach(a => {"""
new1 = """    let cPhone = "", cFavSite = "";
    for (const s of cDoc.querySelectorAll("strong")){
      const t = s.textContent.trim();
      if (/^phone\\s*#?$/i.test(t)){ const p = s.nextElementSibling; if (p) cPhone = p.textContent.trim(); }
      if (/^favorite\\s*site$/i.test(t)){ const p = s.nextElementSibling; if (p) cFavSite = p.textContent.trim().split("\\n")[0].trim(); }
    }
    let passUrl = "";
    cDoc.querySelectorAll('a[href*="/consumerpass/"]').forEach(a => {"""
assert src.count(old1) == 1, "A1: " + str(src.count(old1))
src = src.replace(old1, new1)

# Update the no-pass early return to include phone
old2 = '    if (!passUrl) return {veh: 1, washPlan: ""};'
new2 = '    if (!passUrl) return {veh: 1, washPlan: "", phone: cPhone, favSite: cFavSite};'
assert src.count(old2) == 1, "A2: " + str(src.count(old2))
src = src.replace(old2, new2)

# Update the normal return
old3 = '    return {veh: veh, washPlan: washPlan};'
new3 = '    return {veh: veh, washPlan: washPlan, phone: cPhone, favSite: cFavSite};'
assert src.count(old3) == 1, "A3: " + str(src.count(old3))
src = src.replace(old3, new3)

# Update catch return
old4 = '  } catch(e){ return {veh: 1, washPlan: ""}; }'
new4 = '  } catch(e){ return {veh: 1, washPlan: "", phone: "", favSite: ""}; }'
assert src.count(old4) == 1, "A4: " + str(src.count(old4))
src = src.replace(old4, new4)

# Update fetchVehBatch to save phone+favSite
old5 = '    fresh[ids[i]].veh = v.veh; fresh[ids[i]].vehChecked = true; if (v.washPlan) fresh[ids[i]].washPlan = v.washPlan;'
new5 = '    fresh[ids[i]].veh = v.veh; fresh[ids[i]].vehChecked = true; if (v.washPlan) fresh[ids[i]].washPlan = v.washPlan; if (v.phone) fresh[ids[i]].phone = v.phone; if (v.favSite) fresh[ids[i]].favSite = v.favSite;'
assert src.count(old5) == 1, "A5: " + str(src.count(old5))
src = src.replace(old5, new5)

with open(FILE, "w") as f:
    f.write(src)
print("OK consumers.js — phone scraping in vehicle fetch")
