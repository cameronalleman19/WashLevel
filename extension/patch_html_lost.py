#!/usr/bin/env python3
"""Patch dashboard.html: collapsible sections, lost members, move vehicle plans."""

FILE = "/workspaces/WashLevel/extension/dashboard.html"
with open(FILE, "r") as f:
    html = f.read()

# 1. Make Incomplete signups collapsible
old1 = '''<h2>Incomplete signups</h2>
<p style="color:#8fa3c0;font-size:13px;margin:-6px 0 10px">New members without a name or email. Reach out before their renewal date or the pass won't auto-renew.</p>
<table class="via"><thead><tr><th>Phone</th><th>Signed up</th><th>Days left</th><th>Site</th><th></th></tr></thead><tbody id="memIncBody"></tbody></table>
<h2>Wash frequency distribution</h2>'''

new1 = '''<h2 class="collapsible" data-target="secIncomplete">Incomplete signups <span class="collapse-arrow">\u25BC</span></h2>
<div id="secIncomplete">
<p style="color:#8fa3c0;font-size:13px;margin:4px 0 10px">New members without a name or email. Reach out before their renewal date or the pass won't auto-renew.</p>
<table class="via"><thead><tr><th>Phone</th><th>Signed up</th><th>Days left</th><th>Site</th><th></th></tr></thead><tbody id="memIncBody"></tbody></table>
</div>
<h2 class="collapsible" data-target="secLost">Recently lost members <span class="collapse-arrow">\u25BC</span></h2>
<div id="secLost">
<div style="display:flex;align-items:center;gap:10px;margin:4px 0 10px">
<p style="color:#8fa3c0;font-size:13px;margin:0">Members who cancelled or whose card expired.</p>
<select id="memLostPeriod">
<option value="30">Last 30 days</option>
<option value="60">Last 60 days</option>
<option value="90" selected>Last 90 days</option>
<option value="180">Last 6 months</option>
<option value="365">Last year</option>
</select>
</div>
<table class="via"><thead><tr><th>Name</th><th>Phone</th><th>Reason</th><th>Date</th><th>Plan</th><th></th></tr></thead><tbody id="memLostBody"></tbody></table>
</div>
<h2>Wash frequency distribution</h2>'''

assert html.count(old1) == 1, "A1: " + str(html.count(old1))
html = html.replace(old1, new1)

# 2. Move Vehicle plans above At-risk members
# First remove Vehicle plans from current location
old2 = '\n<h2>Vehicle plans</h2>\n<section class="summary" id="memVehicles"></section>'
assert html.count(old2) == 1, "A2: " + str(html.count(old2))
html = html.replace(old2, '')

# Insert before At-risk
old3 = '<h2>At-risk members</h2>'
new3 = '<h2>Vehicle plans</h2>\n<section class="summary" id="memVehicles"></section>\n<h2>At-risk members</h2>'
assert html.count(old3) == 1, "A3: " + str(html.count(old3))
html = html.replace(old3, new3)

# 3. Make At-risk members collapsible (collapsed by default)
old4 = '''<h2>At-risk members</h2>
<table class="via members"><thead><tr><th>Name</th><th>Risk</th><th>Why</th><th>Washes/mo (recent)</th><th>Baseline</th><th>Last wash</th></tr></thead><tbody id="memRiskBody"></tbody></table>'''

new4 = '''<h2 class="collapsible" data-target="secRisk">At-risk members <span class="collapse-arrow">\u25B6</span></h2>
<div id="secRisk" style="display:none">
<table class="via members"><thead><tr><th>Name</th><th>Risk</th><th>Why</th><th>Washes/mo (recent)</th><th>Baseline</th><th>Last wash</th></tr></thead><tbody id="memRiskBody"></tbody></table>
</div>'''

assert html.count(old4) == 1, "A4: " + str(html.count(old4))
html = html.replace(old4, new4)

with open(FILE, "w") as f:
    f.write(html)
print("OK dashboard.html — layout restructured")
