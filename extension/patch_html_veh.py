#!/usr/bin/env python3
"""Patch dashboard.html: Veh column + Vehicle plans section."""

FILE = "/workspaces/WashLevel/extension/dashboard.html"

with open(FILE, "r") as f:
    src = f.read()

# 1. Add Veh header, rename Washes/month
old = ("<th>Name</th><th>Signed up</th>"
       "<th>Washes 12mo</th><th>Washes/month</th>")
new = ("<th>Name</th><th>Signed up</th><th>Veh</th>"
       "<th>Washes 12mo</th><th>Washes/mo/veh</th>")
assert src.count(old) == 1, "A1: " + str(src.count(old))
src = src.replace(old, new)

# 2. Add Vehicle Plans section before Net members
old = "<h2>Net members by month</h2>"
new = ('<h2>Vehicle plans</h2>\n'
       '<section class="summary" id="memVehicles"></section>\n'
       '<h2>Net members by month</h2>')
assert src.count(old) == 1, "A2: " + str(src.count(old))
src = src.replace(old, new)

with open(FILE, "w") as f:
    f.write(src)
print("OK dashboard.html patched")
