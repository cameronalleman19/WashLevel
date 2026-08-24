#!/usr/bin/env python3
"""Patch dashboard.html: add sections for frequency distribution, tier breakdown, cancellation timing."""

FILE = "/workspaces/WashLevel/extension/dashboard.html"
with open(FILE, "r") as f:
    html = f.read()

# Insert all three sections before "At-risk members" (after incomplete signups)
old1 = '<h2>At-risk members</h2>'
new1 = '''<h2>Wash frequency distribution</h2>
<p style="color:#8fa3c0;font-size:13px;margin:-6px 0 10px">Average washes per month per vehicle across active members.</p>
<div id="memFrequency"></div>
<h2>Membership tier breakdown</h2>
<section class="summary" id="memTiers"></section>
<h2>Cancellation timing</h2>
<p style="color:#8fa3c0;font-size:13px;margin:-6px 0 10px">When members cancel relative to their signup month.</p>
<div id="memCancelChart"></div>
<table class="via"><thead><tr><th>Period</th><th>Cancellations</th><th>% of total</th></tr></thead><tbody id="memCancelBody"></tbody></table>
<h2>At-risk members</h2>'''

assert html.count(old1) == 1, "A1: " + str(html.count(old1))
html = html.replace(old1, new1)

with open(FILE, "w") as f:
    f.write(html)
print("OK dashboard.html patched — analytics sections added")
