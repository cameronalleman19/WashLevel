#!/usr/bin/env python3
"""
Safari compatibility patches for manifest.json and dashboard.html
Run from repo root: python3 patch-safari.py
"""
import json, os

EXT = "extension"

# ── 1. Patch manifest.json ────────────────────────────────────
mpath = os.path.join(EXT, "manifest.json")
with open(mpath, "r") as f:
    m = json.load(f)

# Add default_popup so Safari knows to open dashboard.html
m["action"]["default_popup"] = "dashboard.html"

# Add icon entries (we'll create the actual files separately)
m["icons"] = {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "96": "icons/icon-96.png",
    "128": "icons/icon-128.png",
    "256": "icons/icon-256.png",
    "512": "icons/icon-512.png"
}

# Also set action icons
m["action"]["default_icon"] = {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png"
}

with open(mpath, "w") as f:
    json.dump(m, f, indent=2)
    f.write("\n")

print(f"[OK] Patched {mpath}")
print(f"     - Added default_popup: dashboard.html")
print(f"     - Added icons entries")
print(f"     - Added action default_icon")

# ── 2. Patch dashboard.html ───────────────────────────────────
hpath = os.path.join(EXT, "dashboard.html")
with open(hpath, "r") as f:
    html = f.read()

# 2a. Add viewport meta tag after charset meta
old_meta = '<meta charset="utf-8">'
new_meta = '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">'
assert html.count(old_meta) == 1, f"Expected 1 occurrence of charset meta, found {html.count(old_meta)}"
html = html.replace(old_meta, new_meta)

# 2b. Add ios-responsive.css after dashboard.css
old_css = '<link rel="stylesheet" href="dashboard.css">'
new_css = '<link rel="stylesheet" href="dashboard.css">\n<link rel="stylesheet" href="ios-responsive.css">'
assert html.count(old_css) == 1, f"Expected 1 occurrence of dashboard.css link, found {html.count(old_css)}"
html = html.replace(old_css, new_css)

# 2c. Add browser-shim.js as FIRST script (before nav.js)
old_scripts = '<script src="nav.js"></script>'
new_scripts = '<script src="browser-shim.js"></script>\n<script src="nav.js"></script>'
assert html.count(old_scripts) == 1, f"Expected 1 occurrence of nav.js script, found {html.count(old_scripts)}"
html = html.replace(old_scripts, new_scripts)

with open(hpath, "w") as f:
    f.write(html)

print(f"[OK] Patched {hpath}")
print(f"     - Added viewport meta tag")
print(f"     - Added ios-responsive.css link")
print(f"     - Added browser-shim.js as first script")

# ── 3. Create icons directory ─────────────────────────────────
icons_dir = os.path.join(EXT, "icons")
os.makedirs(icons_dir, exist_ok=True)
print(f"[OK] Created {icons_dir}/")
print()
print("REMAINING: Drop your Sidecar logo PNG/SVG into extension/icons/")
print("           and generate sizes: 16, 32, 48, 96, 128, 256, 512")
print("           Also need 1024x1024 for the iOS app icon (goes in Xcode project)")
