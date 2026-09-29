import io, sys

PATH = "Services/SessionTimer.swift"
src = io.open(PATH, encoding="utf-8").read()
lines = src.split("\n")

def find_one(needle, label):
    hits = [i for i, l in enumerate(lines) if l.strip() == needle]
    assert len(hits) == 1, "p37: %s matched %d lines, expected 1" % (label, len(hits))
    return hits[0]

if "incrementTriggerBuffer: Double = 1.00" in src:
    print("p37: already applied, nothing to do")
    sys.exit(0)

i = find_one("private let incrementTriggerBuffer: Double = 2.00", "trigger buffer")
ind = lines[i][:len(lines[i]) - len(lines[i].lstrip())]
lines[i:i+1] = [
    ind + "// $1 of headroom is 60 seconds at $1/min — ample for a Stripe round trip,",
    ind + "// and it delays each new hold appearing on the customer's statement.",
    ind + "private let incrementTriggerBuffer: Double = 1.00",
]

io.open(PATH, "w", encoding="utf-8").write("\n".join(lines))
print("p37: SessionTimer patched (buffer 2.00 -> 1.00; step left at 5.00)")
