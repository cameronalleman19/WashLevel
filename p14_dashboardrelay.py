import io, sys

PATH = "paystation/src/App.jsx"
src = io.open(PATH, encoding="utf-8").read()
lines = src.split("\n")

def find_one(needle, label):
    hits = [i for i, l in enumerate(lines) if needle in l]
    assert len(hits) == 1, "p14: %s matched %d lines, expected 1" % (label, len(hits))
    return hits[0]

def indent_of(i):
    l = lines[i]
    return l[:len(l) - len(l.lstrip())]

# "relayDown" already appears in the Alerts settings, so key idempotency
# on something this patch alone introduces.
if "function statusLabel" in src:
    print("p14: already applied, nothing to do")
    sys.exit(0)

# 1. icon for the new state
i = find_one("Pipette, Eraser, Fan, Car, Hexagon", "lucide import tail")
ind = indent_of(i)
lines[i] = ind + "Pipette, Eraser, Fan, Car, Hexagon, ZapOff"

# 2. status derivation. Placed after the offline check: a bay whose iPad is
#    not reporting cannot tell us anything about its relay.
i = find_one('if (staleMs > 90000) return "offline"', "effectiveStatus offline check")
ind = indent_of(i)
lines[i+1:i+1] = [
    ind + '// The iPad is reporting and says its relay is unreachable. This is',
    ind + '// separate from outOfService, which is the operator\'s own switch.',
    ind + 'if (bay.relayConnected === false) return "relayDown"',
]

# 3. readable badge text — __label was computed here and never read
i = find_one("function effectiveStatus(bay) {", "effectiveStatus decl")
ind = indent_of(i)
lines[i:i] = [
    ind + "function statusLabel(st) {",
    ind + '  if (st === "outOfService") return "Out of service"',
    ind + '  if (st === "relayDown") return "Relay down"',
    ind + "  return st",
    ind + "}",
    "",
]

# 4. card + badge styling
i = find_one('if (st === "outOfService") return { background: T.bgPanel, border: `1px dashed', "bayCard outOfService")
ind = indent_of(i)
lines[i+1:i+1] = [
    ind + 'if (st === "relayDown") return { background: "rgba(245,158,11,0.06)", border: `2px solid ${T.amber}`, borderRadius: "12px", overflow: "hidden", transition: "all 0.2s", cursor: "pointer", boxShadow: `0 0 24px rgba(245,158,11,0.2)` }',
]

i = find_one("bayBadge: (st) => {", "bayBadge")
ind = indent_of(i)
old = lines[i]
old = old.replace(
    'outOfService: { bg: "rgba(107,114,128,0.15)", c: "#9ca3af", b: "rgba(107,114,128,0.35)" } }',
    'outOfService: { bg: "rgba(107,114,128,0.15)", c: "#9ca3af", b: "rgba(107,114,128,0.35)" }, relayDown: { bg: T.amberDim, c: T.amber, b: "rgba(245,158,11,0.4)" } }'
)
old = old.replace(
    '; const label = st === "outOfService" ? "OUT OF SERVICE" : st; return {',
    '; return {'
)
old = old.replace(', __label: label } },', ' } },')
assert "relayDown" in old and "__label" not in old, "p14: bayBadge rewrite failed"
lines[i] = old

# 5. render the label instead of the raw key — the bay card and the detail
#    modal both show this badge, and both had the same bug
n = 0
for idx, l in enumerate(lines):
    if "<div style={S.bayBadge(status)}>{status}</div>" in l:
        lines[idx] = l.replace("{status}</div>", "{statusLabel(status)}</div>")
        n += 1
assert n == 2, "p14: expected 2 badge render sites, found %d" % n

# 6. card body for a downed relay
i = find_one(') : status === "outOfService" ? (', "BayCard outOfService branch")
ind = indent_of(i)
lines[i:i] = [
    ind + ') : status === "relayDown" ? (',
    ind + '  <div style={{ ...S.bayIdle, color: T.amber, padding: "24px 12px" }}>',
    ind + '    <ZapOff size={30} strokeWidth={2} style={{ marginBottom: 8 }} />',
    ind + '    <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "2px", color: T.amber }}>RELAY DOWN</div>',
    ind + '    <div style={{ fontSize: "10px", marginTop: 4, color: T.textDim }}>iPad online, relay unreachable</div>',
    ind + '  </div>',
]

# 7. device health alert
i = find_one('if (d.thermalState === "critical") out.push("Device overheating - check bay cooling")', "healthAlerts thermal")
ind = indent_of(i)
lines[i:i] = [
    ind + 'if (d.relayConnected === false) out.push("Relay unreachable - bay cannot run washes")',
]

# 8. RELAY tile on the device card, beside RELAY HOST
i = find_one('>RELAY HOST</div><div style={{ fontFamily: T.fontMono, fontSize: "11px", color: T.accent }}>{d.relayHost || "--"}</div></div>', "relay host tile")
ind = indent_of(i)
lines[i+1:i+1] = [
    ind + '<div><div style={{ color: T.textDim, fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>RELAY</div><div style={{ fontFamily: T.fontMono, fontSize: "11px", color: !d.isOnline ? T.textDim : d.relayConnected === false ? T.amber : d.relayConnected === true ? T.green : T.textDim }}>{!d.isOnline ? "--" : d.relayConnected === false ? "Unreachable" : d.relayConnected === true ? "Connected" : "Unknown"}</div></div>',
]

io.open(PATH, "w", encoding="utf-8").write("\n".join(lines))
print("p14: App.jsx patched")
