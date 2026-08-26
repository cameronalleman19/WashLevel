#!/usr/bin/env python3
"""Patch dashboard.html: add time frame dropdown, move membership economics up."""

FILE = "/workspaces/WashLevel/extension/dashboard.html"
with open(FILE, "r") as f:
    html = f.read()

# 1. Add time frame dropdown after memConversions, before memTiles
old1 = '<div id="memConversions"></div>\n<section class="summary" id="memTiles"></section>'
new1 = '<div id="memConversions"></div>\n<select id="memTimeFrame" style="margin:10px 0"><option value="mtd">Month to date</option></select>\n<section class="summary" id="memTiles"></section>'
assert html.count(old1) == 1, "A1: " + str(html.count(old1))
html = html.replace(old1, new1)

# 2. Remove economics from its current location
old2 = '\n<h2>Membership economics</h2>\n<div id="memLtv" class="cards"></div>'
assert html.count(old2) == 1, "A2: " + str(html.count(old2))
html = html.replace(old2, '')

# 3. Insert economics after memTiles
old3 = '<section class="summary" id="memTiles"></section>\n<h2>Member sales - last 30 days</h2>'
new3 = '<section class="summary" id="memTiles"></section>\n<h2>Membership economics</h2>\n<div id="memLtv" class="cards"></div>\n<h2>Member sales - last 30 days</h2>'
assert html.count(old3) == 1, "A3: " + str(html.count(old3))
html = html.replace(old3, new3)

with open(FILE, "w") as f:
    f.write(html)
print("OK dashboard.html patched")
