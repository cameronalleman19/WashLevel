import sys

# ── Part 1: dashboard.html – add plate insights section after anomalies ──

path_html = "/workspaces/WashLevel/extension/dashboard.html"
with open(path_html, "r", encoding="utf-8") as f:
    html = f.read()

anchor_html = '<ul id="retAnoms"></ul>'
assert anchor_html in html, "HTML ANCHOR NOT FOUND (retAnoms)"
assert html.count(anchor_html) == 1, "HTML ANCHOR NOT UNIQUE"
assert 'retPlateInsights' not in html, "retPlateInsights already in HTML"

html = html.replace(anchor_html, anchor_html + '\n'
    '<h2>License Plate Insights <select id="retPlatePeriod">'
    '<option value="30d">Last 30 days</option>'
    '<option value="90d">Last 90 days</option>'
    '<option value="6mo">Last 6 months</option>'
    '<option value="12mo">Last 12 months</option>'
    '<option value="ytd">Year to date</option>'
    '<option value="all">All time</option>'
    '</select></h2>\n'
    '<div id="retPlateInsights"></div>', 1)

with open(path_html, "w", encoding="utf-8") as f:
    f.write(html)
print("dashboard.html patched: plate insights section added to Retail page")

# ── Part 2: retail.js – add rendering functions + wiring ──

path_js = "/workspaces/WashLevel/extension/retail.js"
with open(path_js, "r", encoding="utf-8") as f:
    content = f.read()

def rep(old, new, label):
    global content
    assert old in content, "JS ANCHOR NOT FOUND (" + label + ") - aborting"
    assert content.count(old) == 1, "JS ANCHOR NOT UNIQUE (" + label + ") - check file"
    content = content.replace(old, new, 1)

# 1. Add rPlatePeriodRange + rRenderPlates functions before DOMContentLoaded
rep(
    'document.addEventListener("DOMContentLoaded", () => {',

    'function rPlatePeriodRange(){\n'
    '  const sel = R$("retPlatePeriod");\n'
    '  const mode = sel ? sel.value : "30d";\n'
    '  const today = new Date();\n'
    '  const to = rDs(today);\n'
    '  let from;\n'
    '  if (mode === "90d"){ const d = new Date(today); d.setDate(d.getDate() - 89); from = rDs(d); }\n'
    '  else if (mode === "6mo"){ const d = new Date(today); d.setMonth(d.getMonth() - 6); from = rDs(d); }\n'
    '  else if (mode === "12mo"){ const d = new Date(today); d.setFullYear(d.getFullYear() - 1); from = rDs(d); }\n'
    '  else if (mode === "ytd"){ from = to.slice(0, 4) + "-01-01"; }\n'
    '  else if (mode === "all"){ from = "2020-01-01"; }\n'
    '  else { const d = new Date(today); d.setDate(d.getDate() - 29); from = rDs(d); }\n'
    '  return {from: from, to: to};\n'
    '}\n'
    '\n'
    'async function rRenderPlates(){\n'
    '  await platesLoad();\n'
    '  const el = R$("retPlateInsights");\n'
    '  if (!el) return;\n'
    '  const r = rPlatePeriodRange();\n'
    '  const stats = plateStats(null, r.from, r.to);\n'
    '  const crossOver = plateCrossOver(r.from, r.to);\n'
    '  const conv = plateConversions(r.from, r.to);\n'
    '  el.innerHTML = pRenderStatsHtml(stats, false) +\n'
    '    pRenderCrossOverHtml(crossOver, r.from, r.to) +\n'
    '    pRenderConversionsHtml(conv);\n'
    '}\n'
    '\n'
    'document.addEventListener("DOMContentLoaded", () => {',
    "plate functions before DOMContentLoaded"
)

# 2. Call rRenderPlates from retRender, after rRenderAnoms
rep(
    '  rRenderAnoms();\n'
    '  R$("retStatus").textContent = "";',

    '  rRenderAnoms();\n'
    '  await rRenderPlates();\n'
    '  R$("retStatus").textContent = "";',
    "rRenderPlates call in retRender"
)

# 3. Add plate period dropdown listener in DOMContentLoaded
rep(
    '  const btn = document.querySelector(\'[data-page="retail"]\');',

    '  const plateSel = R$("retPlatePeriod");\n'
    '  if (plateSel) plateSel.addEventListener("change", () => rRenderPlates());\n'
    '  const btn = document.querySelector(\'[data-page="retail"]\');',
    "plate dropdown listener"
)

with open(path_js, "w", encoding="utf-8") as f:
    f.write(content)
print("retail.js patched: plate insights with cross-site bleedover + conversions")
