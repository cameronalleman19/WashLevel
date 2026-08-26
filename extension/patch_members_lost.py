#!/usr/bin/env python3
"""Patch members.js: add recently lost members, collapsible sections."""

FILE = "/workspaces/WashLevel/extension/members.js"
with open(FILE, "r") as f:
    src = f.read()

# 1. Add mRenderLostMembers + mInitCollapsible before mRenderIncomplete
old1 = "function mRenderIncomplete(){"
assert src.count(old1) == 1, "A1"
fn = r'''function mInitCollapsible(){
  document.querySelectorAll(".collapsible").forEach(h => {
    h.style.cursor = "pointer";
    h.addEventListener("click", () => {
      const t = document.getElementById(h.dataset.target);
      if (!t) return;
      const arrow = h.querySelector(".collapse-arrow");
      if (t.style.display === "none"){ t.style.display = ""; if (arrow) arrow.textContent = "\u25BC"; }
      else { t.style.display = "none"; if (arrow) arrow.textContent = "\u25B6"; }
    });
  });
}

function mRenderLostMembers(){
  const tb = M$("memLostBody");
  if (!tb) return;
  const sel = M$("memLostPeriod");
  const days = sel ? parseInt(sel.value) || 30 : 30;
  const cut = Date.now() - days * 86400000;
  const lost = Object.values(mConsumers).filter(c => {
    if (!c.signup) return false;
    const lastBill = Math.max(c.lastNew || 0, c.lastRenew || 0);
    if (!lastBill) return false;
    // Cancelled after cutoff
    if (c.cancelled && c.cancelled > (c.lastNew || 0) && c.cancelled > cut) return true;
    // Expired: last billing > 45 days ago but not actively cancelled, and was active before
    if (!c.cancelled || c.cancelled <= (c.lastNew || 0)){
      if (lastBill < Date.now() - 45 * 86400000 && lastBill > cut) return true;
    }
    return false;
  });
  if (!lost.length){
    tb.innerHTML = "<tr><td colspan=\"6\">No recently lost members in this period.</td></tr>";
    return;
  }
  lost.sort((a, b) => {
    const aT = a.cancelled && a.cancelled > (a.lastNew || 0) ? a.cancelled : Math.max(a.lastNew || 0, a.lastRenew || 0);
    const bT = b.cancelled && b.cancelled > (b.lastNew || 0) ? b.cancelled : Math.max(b.lastNew || 0, b.lastRenew || 0);
    return bT - aT;
  });
  tb.innerHTML = "";
  for (const c of lost){
    const wasCancelled = c.cancelled && c.cancelled > (c.lastNew || 0);
    const reason = wasCancelled ? "Cancelled" : "Expired / Declined";
    const reasonStyle = wasCancelled ? "color:#f87171" : "color:#ffd166";
    const lostDate = wasCancelled ? c.cancelled : Math.max(c.lastNew || 0, c.lastRenew || 0);
    const phone = c.phone || "";
    const phoneClean = phone.replace(/[^0-9+]/g, "");
    const phoneLinks = phoneClean
      ? "<a href=\"tel:" + phoneClean + "\" class=\"via-open\">" + mEsc(phone) + "</a> <a href=\"sms:" + phoneClean + "\" class=\"via-open\" title=\"Text\">SMS</a>"
      : "--";
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + mEsc(c.name || "(no name)") + "</td>" +
      "<td>" + phoneLinks + "</td>" +
      "<td style=\"" + reasonStyle + "\">" + reason + "</td>" +
      "<td>" + mDate(lostDate) + "</td>" +
      "<td>" + mEsc(c.washPlan || "--") + "</td>" +
      "<td><a class=\"via-open\" target=\"_blank\" href=\"" + CBASE + "/consumer/" + c.id + "/\">Open</a></td>";
    tb.appendChild(tr);
  }
}

'''
src = src.replace(old1, fn + old1)

# 2. Call mRenderLostMembers and mInitCollapsible in memRender
# Insert after mRenderIncomplete
old2 = "  mRenderIncomplete();\n  mRenderRisk();"
new2 = "  mRenderIncomplete();\n  mRenderLostMembers();\n  mRenderRisk();"
assert src.count(old2) == 1, "A2"
src = src.replace(old2, new2)

# Add mInitCollapsible at the end of memRender
old3 = '  M$("memStatus").textContent = "";\n}'
# Find the last occurrence (memRender's closing)
idx = src.rfind(old3)
assert idx >= 0, "A3: could not find memRender closing"
src = src[:idx] + '  M$("memStatus").textContent = "";\n  mInitCollapsible();\n}' + src[idx + len(old3):]

# 3. Add lost members period dropdown listener
old4 = '  const memTF = M$("memTimeFrame");'
new4 = '''  const memLP = M$("memLostPeriod");
  if (memLP) memLP.addEventListener("change", mRenderLostMembers);
  const memTF = M$("memTimeFrame");'''
assert src.count(old4) == 1, "A4"
src = src.replace(old4, new4)

with open(FILE, "w") as f:
    f.write(src)
print("OK members.js — lost members + collapsible")
