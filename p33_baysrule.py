import io, sys

PATH = "firestore.rules"
src = io.open(PATH, encoding="utf-8").read()
lines = src.split("\n")

if "wbTelemetryOnly" in src:
    print("p33: already applied, nothing to do")
    sys.exit(0)

start = [i for i, l in enumerate(lines) if l.strip() == "match /bays/{bayId} {"]
assert len(start) == 1, "p33: bays match block matched %d lines, expected 1" % len(start)
i = start[0]
assert lines[i+1].strip() == "allow read, update: if true;", "p33: bays rule is not the expected open version"
end = None
for k in range(i, len(lines)):
    if lines[k].strip() == "}":
        end = k
        break
assert end is not None, "p33: could not find end of bays block"

ind = lines[i][:len(lines[i]) - len(lines[i].lstrip())]

block = '''match /bays/{bayId} {
  // The kiosk signs in anonymously and claims its bay at pairing by writing
  // its uid to deviceUid. After that it may write telemetry only — never
  // pricing, functions, or anything else the operator controls. The bay is
  // strictly a display for dashboard config.

  // A bay with no deviceUid is unclaimed and can be paired. Bay ids are random,
  // and the window closes the moment a device claims it.
  function wbUnclaimed() {
    return !("deviceUid" in resource.data) || resource.data.deviceUid == null;
  }
  function wbIsDevice() {
    return request.auth != null
      && "deviceUid" in resource.data
      && resource.data.deviceUid == request.auth.uid;
  }
  function wbTelemetryOnly() {
    return request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      "lastHeartbeat", "thermalState", "powerState", "batteryLevel",
      "heartbeatInterval", "relayConnected", "status", "currentFunction",
      "currentSessionStartedAt", "streamUrl", "lastSession", "healthUpdatedAt",
      "remoteCommand", "deviceId", "deviceUid", "deviceName"
    ]);
  }

  allow read: if request.auth != null
    && (isOwner(resource.data.ownerId) || wbIsDevice() || wbUnclaimed());

  allow update: if request.auth != null
    && (isOwner(resource.data.ownerId)
        || ((wbIsDevice() || wbUnclaimed()) && wbTelemetryOnly()));

  allow create: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
  allow delete: if request.auth != null && resource.data.ownerId == request.auth.uid;
}'''

lines[i:end+1] = [ind + l if l else "" for l in block.split("\n")]

# the stale TODO above the block
for k in range(max(0, i - 6), i):
    if "TODO: tighten with custom auth tokens" in lines[k]:
        lines[k] = ind + "// Kiosk identity is the anonymous uid stored as deviceUid at pairing."
    elif "Read/update open for iPad kiosk access" in lines[k]:
        lines[k] = ind + "// Owner has full access; the paired device has telemetry-only access."
    elif "Create/delete restricted to authenticated owner" in lines[k]:
        lines[k] = ind + "// Create/delete remain owner-only."

io.open(PATH, "w", encoding="utf-8").write("\n".join(lines))
print("p33: firestore.rules patched")
