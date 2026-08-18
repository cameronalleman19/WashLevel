const VBASE = "https://admin.dencar.sancsoft.net";
const V$ = (id) => document.getElementById(id);
let viaData = {};
let viaNotes = {};
let viaSeen = {};
let viaAutoSettings = {};
let viaAutoClosed = [];
let viaActiveTab = "open"; // "open" or "auto"

function vEsc(s){ const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
function vDays(ts){ return (Date.now() - ts) / 86400000; }

function htmlToLines(html){
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .split("\n").map(x => x.trim()).filter(Boolean);
}

function fieldAfter(lines, label){
  const i = lines.findIndex(l => l.toLowerCase() === label.toLowerCase());
  return i >= 0 && i + 1 < lines.length ? lines[i + 1] : "";
}

function parseDetail(html, id){
  const lines = htmlToLines(html);
  const plates = [];
  let pi = lines.findIndex(l => l === "Plates");
  if (pi >= 0){
    for (let i = pi + 1; i < lines.length; i++){
      const l = lines[i];
      if (["Last Name", "Vehicle Nicknames", "Customer Pass Id", "Payment Trigger", "Average Wash Usage", "Use Count", "Customer Response"].includes(l)) break;
      if (/^[A-Z0-9 -]{2,10}$/i.test(l)) plates.push(l.toUpperCase());
    }
  }
  const history = [];
  for (let i = 0; i < lines.length - 1; i++){
    if (lines[i] === "Timestamp" && /^\d{2}\/\d{2}\/\d{4}/.test(lines[i + 1] || "")){
      const ts = lines[i + 1];
      let lp = "";
      for (let j = i + 2; j < Math.min(i + 6, lines.length); j++){
        if (lines[j] === "LP Number"){ lp = (lines[j + 1] && !/^Timestamp$/.test(lines[j + 1])) ? lines[j + 1] : ""; break; }
      }
      const p = ts.split(/[\/ :]/);
      const t = new Date(p[2], p[0] - 1, p[1], p[3] || 0, p[4] || 0, p[5] || 0).getTime();
      history.push({ts: ts, t: t, lp: (lp || "").toUpperCase()});
    }
  }
  history.sort((a, b) => b.t - a.t);
  const trigM = html.match(/consumerpassexceptions\/trigger\/([0-9a-fA-F-]{36})/);
  const closeM = html.match(/consumerpassexceptions\/closeexception\/([0-9a-fA-F-]{36})/);
  const imgs = [];
  const imre = /https:\/\/s3[^"'\s]*payments_(driver|license)\/([0-9a-fA-F-]{36})[^"'\s]*/g;
  let m;
  while ((m = imre.exec(html))){ if (!imgs.some(x => x.kind === m[1] && x.pid === m[2])) imgs.push({kind: m[1], pid: m[2], url: m[0].replace(/&amp;/g, "&")}); }
  /* Keep only 1 driver + 1 license per exception */
  const driverImg = imgs.find(x => x.kind === "driver");
  const plateImg = imgs.find(x => x.kind === "license");
  imgs.length = 0;
  if (driverImg) imgs.push(driverImg);
  if (plateImg) imgs.push(plateImg);
  return {
    id: id,
    firstName: fieldAfter(lines, "First Name"),
    lastName: fieldAfter(lines, "Last Name"),
    passName: fieldAfter(lines, "Pass Name"),
    rating: fieldAfter(lines, "Exception Rating"),
    vehicleCount: parseInt(fieldAfter(lines, "Vehicle Count")) || 0,
    avgUsage: parseFloat(fieldAfter(lines, "Average Wash Usage")) || 0,
    useCount: fieldAfter(lines, "Use Count"),
    consumerPassId: fieldAfter(lines, "Consumer Pass Id"),
    plates: plates,
    history: history,
    imgs: imgs,
    triggerId: trigM ? trigM[1] : null,
    closeId: closeM ? closeM[1] : null,
    consumerId: (html.match(/\/consumer\/([0-9a-fA-F-]{36})/) || [null, null])[1],
    fetched: Date.now()
  };
}

function normPlate(p){ return (p||"").toUpperCase().replace(/[^A-Z0-9]/g,"").replace(/0/g,"O").replace(/8/g,"B").replace(/1/g,"I").replace(/5/g,"S").replace(/2/g,"Z"); }
function editDist(a,b){ if(Math.abs(a.length-b.length)>2) return 9; const m=[]; for(let i=0;i<=a.length;i++){m[i]=[i];} for(let j=0;j<=b.length;j++){m[0][j]=j;} for(let i=1;i<=a.length;i++){for(let j=1;j<=b.length;j++){m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));}} return m[a.length][b.length]; }

/* Raw edit distance (no OCR normalization) for plate closeness checks */
function rawEditDist(a, b){ return editDist((a||"").toUpperCase().replace(/[^A-Z0-9]/g,""), (b||"").toUpperCase().replace(/[^A-Z0-9]/g,"")); }

function calcPerMonth(e){ const h = (e.washHistory && e.washHistory.length) ? e.washHistory : e.history.filter(x => x.lp && x.lp !== "N/A"); if(!h.length) return 0; const spanMs = h.length > 1 ? (h[0].t - h[h.length - 1].t) : 0; return h.length / Math.max(spanMs / 2592000000, 1); }

/* Plate matching helpers */
function plateOnPlan(lp, plates){
  return plates.some(p => lp && (lp === p || editDist(normPlate(lp), normPlate(p)) <= 1));
}
function plateNearPlan(lp, plates){
  /* Near = within 2 chars (normalized) OR within 2 chars (raw) but NOT on-plan */
  if (plateOnPlan(lp, plates)) return false;
  return plates.some(p => lp && (editDist(normPlate(lp), normPlate(p)) <= 2 || rawEditDist(lp, p) <= 2));
}
function plateBestDist(lp, plates){
  /* Returns the best edit distance (normalized) between lp and any plan plate */
  let best = 99;
  for (const p of plates){
    const d = editDist(normPlate(lp), normPlate(p));
    if (d < best) best = d;
  }
  return best;
}

function recommend(e){
  const onPlan = (lp) => plateOnPlan(lp, e.plates);
  const nearPlan = (lp) => plateNearPlan(lp, e.plates);
  const lastUse = e.history.length ? e.history[0].t : 0;
  const offPlan = e.history.filter(h => h.lp && !onPlan(h.lp));
  const onPlanUses = e.history.filter(h => h.lp && onPlan(h.lp));
  if (!lastUse) return {verdict: "REVIEW", cls: "rec-mid", why: "No payment history parsed - review manually"};
  if (vDays(lastUse) > 21) return {verdict: "DO NOT TRIGGER", cls: "rec-no", why: "No pass use in over 3 weeks (dormant)"};
  const perMonth = calcPerMonth(e);
  if (perMonth < 3) return {verdict: "DO NOT TRIGGER", cls: "rec-no", why: "Low usage - about " + perMonth.toFixed(1) + " washes/month on average"};
  if (e.vehicleCount === 1 && offPlan.length && onPlanUses.length){
    const gap = Math.abs(offPlan[0].t - onPlanUses[0].t) / 86400000;
    if (gap <= 1.5) return {verdict: "TRIGGER", cls: "rec-yes", why: "Single-vehicle plan; off-plan wash within a day of on-plan wash (likely sharing)"};
  }
  if (e.vehicleCount >= 2 && e.avgUsage < 4) return {verdict: "LET SLIDE", cls: "rec-mid", why: e.vehicleCount + " vehicles on plan, low usage - good repeat customer"};
  /* Check for near-plan plates (1-2 chars off) before triggering */
  if (offPlan.length){
    const nearMisses = offPlan.filter(h => nearPlan(h.lp));
    if (nearMisses.length > 0 && nearMisses.length === offPlan.length){
      const bestD = plateBestDist(nearMisses[0].lp, e.plates);
      return {verdict: "LET SLIDE", cls: "rec-mid", why: "Off-plan plate " + vEsc(nearMisses[0].lp) + " is only " + bestD + " char" + (bestD > 1 ? "s" : "") + " off from plan plate - likely OCR misread"};
    }
  }
  if (offPlan.length) return {verdict: "TRIGGER", cls: "rec-yes", why: "Active user washing off-plan vehicle (" + vEsc(offPlan[0].lp) + ")"};
  return {verdict: "REVIEW", cls: "rec-mid", why: "No off-plan plate detected in recent history"};
}

/* ===== Auto-dismiss rule evaluation ===== */
function autoCloseReason(e){
  /* Returns {reason, rule} if this exception should be auto-closed, or null */
  if (!viaAutoSettings || !e.closeId) return null;
  const onPlan = (lp) => plateOnPlan(lp, e.plates);
  const offPlan = e.history.filter(h => h.lp && !onPlan(h.lp));
  const perMonth = calcPerMonth(e);

  /* Low usage rules */
  if (viaAutoSettings.lowUsage2 && perMonth > 0 && perMonth < 2){
    return {reason: "Auto: < 2 washes/month (" + perMonth.toFixed(1) + "/mo)", rule: "lowUsage2"};
  }
  if (viaAutoSettings.lowUsage3 && perMonth > 0 && perMonth < 3){
    return {reason: "Auto: < 3 washes/month (" + perMonth.toFixed(1) + "/mo)", rule: "lowUsage3"};
  }

  /* Plate distance rules - check off-plan plates */
  if (offPlan.length){
    const allNear = offPlan.every(h => {
      const d = plateBestDist(h.lp, e.plates);
      if (viaAutoSettings.ocrOneChar && d <= 1) return true;
      if (viaAutoSettings.ocrTwoChar && d <= 2) return true;
      return false;
    });
    if (allNear){
      const bestD = plateBestDist(offPlan[0].lp, e.plates);
      if (bestD <= 1 && viaAutoSettings.ocrOneChar){
        return {reason: "Auto: plate " + offPlan[0].lp + " is 1 char off plan plate", rule: "ocrOneChar"};
      }
      if (bestD <= 2 && viaAutoSettings.ocrTwoChar){
        return {reason: "Auto: plate " + offPlan[0].lp + " is 2 chars off plan plate", rule: "ocrTwoChar"};
      }
    }
  }

  /* Dormant */
  if (viaAutoSettings.dormant){
    const lastUse = e.history.length ? e.history[0].t : 0;
    if (lastUse && vDays(lastUse) > 21){
      return {reason: "Auto: dormant (no use in 3+ weeks)", rule: "dormant"};
    }
  }

  return null;
}

async function viaLoad(){
  const st = await chrome.storage.local.get(["viaData", "viaNotes", "viaSeen", "viaAutoSettings", "viaAutoClosed"]);
  viaData = st.viaData || {};
  viaNotes = st.viaNotes || {};
  viaSeen = st.viaSeen || {};
  viaAutoSettings = st.viaAutoSettings || {};
  viaAutoClosed = st.viaAutoClosed || [];
}
async function viaSave(){ await chrome.storage.local.set({viaData, viaNotes, viaSeen, viaAutoSettings, viaAutoClosed}); }

async function viaSync(){
  V$("viaSyncBtn").disabled = true;
  V$("viaStatus").textContent = "Loading exception list...";
  try {
    const res = await fetch(VBASE + "/consumerpassexceptions/", {credentials: "include"});
    const html = await res.text();
    if (/type="password"/i.test(html)){ V$("viaStatus").textContent = "Not logged into Dencar."; V$("viaSyncBtn").disabled = false; return; }
    const ids = [];
    const re = /consumerpassexceptions\/([0-9a-fA-F-]{36})/g;
    let m;
    while ((m = re.exec(html))){ if (!ids.includes(m[1])) ids.push(m[1]); }
    if (!ids.length){ V$("viaStatus").textContent = "No open exceptions found."; viaData = {}; await viaSave(); renderViaList(); V$("viaSyncBtn").disabled = false; return; }
    const fresh = {};
    for (let i = 0; i < ids.length; i++){
      V$("viaStatus").textContent = "Loading exception " + (i + 1) + " / " + ids.length;
      const r2 = await fetch(VBASE + "/consumerpassexceptions/" + ids[i] + "/", {credentials: "include"});
      const d = parseDetail(await r2.text(), ids[i]);
      await enrichConsumer(d);
      fresh[ids[i]] = d;
      const key = d.consumerPassId || ids[i];
      viaSeen[key] = viaSeen[key] || {};
      viaSeen[key][ids[i]] = Date.now();
      await new Promise(r => setTimeout(r, 150));
    }
    viaData = fresh;
    await viaSave();

    /* Run auto-dismiss on freshly synced data */
    const autoCt = await runAutoDismiss();
    const remain = Object.keys(viaData).length;
    V$("viaStatus").textContent = "Loaded " + ids.length + " exceptions." + (autoCt ? " Auto-closed " + autoCt + "." : "") + (remain ? " " + remain + " remaining." : "");
    renderViaList();
  } catch(e){
    V$("viaStatus").textContent = "VIA sync failed: " + e.message;
  }
  V$("viaSyncBtn").disabled = false;
}

/* ===== Auto-dismiss engine ===== */
async function runAutoDismiss(){
  const anyEnabled = viaAutoSettings.ocrOneChar || viaAutoSettings.ocrTwoChar ||
    viaAutoSettings.lowUsage2 || viaAutoSettings.lowUsage3 || viaAutoSettings.dormant;
  if (!anyEnabled) return 0;
  let closed = 0;
  const ids = Object.keys(viaData);
  for (const id of ids){
    const e = viaData[id];
    const ar = autoCloseReason(e);
    if (!ar || !e.closeId) continue;
    try {
      const res = await fetch(VBASE + "/consumerpassexceptions/closeexception/" + e.closeId + "/", {method: "DELETE", credentials: "include"});
      if (res.ok){
        viaAutoClosed.push({
          ts: Date.now(),
          id: id,
          name: (e.firstName + " " + e.lastName).trim(),
          passName: e.passName || "",
          plates: e.plates.join(", "),
          reason: ar.reason,
          rule: ar.rule,
          perMonth: calcPerMonth(e).toFixed(1),
          offPlate: (e.history.find(h => h.lp && !plateOnPlan(h.lp, e.plates)) || {}).lp || ""
        });
        try { await viaHistLog(e, "close", ar.reason); } catch(_){}
        delete viaData[id];
        closed++;
        await new Promise(r => setTimeout(r, 200));
      }
    } catch(_){}
  }
  /* Cap auto-closed history at 2000 */
  if (viaAutoClosed.length > 2000) viaAutoClosed.splice(0, viaAutoClosed.length - 2000);
  if (closed) await viaSave();
  return closed;
}

/* ===== Grouping logic ===== */
function groupExceptions(){
  const groups = {};
  for (const id of Object.keys(viaData)){
    const e = viaData[id];
    const key = e.consumerPassId || id;
    if (!groups[key]) groups[key] = [];
    groups[key].push({id, e});
  }
  return groups;
}

/* ===== Render ===== */
function renderViaList(){
  const wrap = V$("viaCards");
  wrap.innerHTML = "";

  /* Tab bar */
  renderViaTabs();

  if (viaActiveTab === "auto"){
    renderAutoClosedList(wrap);
    return;
  }
  if (viaActiveTab === "settings"){
    renderAutoSettings(wrap);
    return;
  }

  const groups = groupExceptions();
  const gKeys = Object.keys(groups);
  if (!gKeys.length){ wrap.innerHTML = "<div class=\"via-empty\">No open exceptions loaded. Press Sync VIA.</div>"; return; }

  for (const gk of gKeys){
    const entries = groups[gk];
    const primary = entries[0].e;
    const rec = recommend(primary);
    const seenCount = Object.keys(viaSeen[primary.consumerPassId || entries[0].id] || {}).length;
    const lastUse = primary.history.length ? primary.history[0].ts : "unknown";

    /* Collect all images from all entries in this group */
    const allImgs = [];
    for (const {e} of entries){
      for (const img of e.imgs){
        if (!allImgs.some(x => x.url === img.url)) allImgs.push(img);
      }
    }
    const drivers = allImgs.filter(x => x.kind === "driver");
    const plateImgs = allImgs.filter(x => x.kind === "license");

    const div = document.createElement("div");
    div.className = "via-card";

    let photosHtml = "<div class=\"via-photos\">";
    if (drivers.length) photosHtml += drivers.map(d => "<img src=\"" + d.url + "\" loading=\"lazy\">").join("");
    else photosHtml += "<div class=\"noimg\">no photo</div>";
    if (plateImgs.length) photosHtml += plateImgs.map(p => "<img src=\"" + p.url + "\" loading=\"lazy\">").join("");
    else photosHtml += "<div class=\"noimg\">no plate</div>";
    photosHtml += "</div>";

    /* Instance count badge */
    const instanceBadge = entries.length > 1
      ? " <span class=\"via-instance-badge\">" + entries.length + " instances</span>"
      : "";

    let infoHtml = "<div class=\"via-info\">" +
      "<div class=\"via-name\">" + vEsc(primary.firstName + " " + primary.lastName) + " <span class=\"via-pass\">(" + vEsc(primary.passName) + ")</span>" + instanceBadge + "</div>" +
      "<div class=\"via-row\">Plates on plan: <strong>" + vEsc(primary.plates.join(", ") || "none parsed") + "</strong> | Vehicles: " + primary.vehicleCount + "</div>" +
      "<div class=\"via-row\">Last pass use: " + vEsc(lastUse) + " | Washes/month (computed): " + calcPerMonth(primary).toFixed(1) + " | Vac/self-serve uses 12mo: " + (primary.otherUses || 0) + " | Use count: " + vEsc(primary.useCount) + "</div>" +
      "<div class=\"via-row\">Exceptions seen for this member: " + seenCount + "</div>" +
      "<div class=\"via-rec " + rec.cls + "\">" + rec.verdict + "</div>" +
      "<div class=\"via-why\">" + rec.why + "</div>" +
      "<div class=\"via-history\">" + primary.history.slice(0, 5).map(h => vEsc(h.ts) + " - " + vEsc(h.lp || "?")).join("<br>") + "</div>" +
      "<textarea class=\"via-note\" data-id=\"" + entries[0].id + "\" placeholder=\"Notes for this exception...\">" + vEsc(viaNotes[entries[0].id] || "") + "</textarea>" +
      "<div class=\"via-actions\">";

    /* Trigger button — use first entry that has a triggerId */
    const trigEntry = entries.find(x => x.e.triggerId);
    if (trigEntry){
      infoHtml += "<button class=\"via-trigger\" data-id=\"" + trigEntry.id + "\">Trigger Exception</button>";
    }
    /* Close button — if grouped, label says Close All */
    const closeEntries = entries.filter(x => x.e.closeId);
    if (closeEntries.length > 1){
      infoHtml += "<button class=\"via-close-ex\" data-ids=\"" + closeEntries.map(x => x.id).join(",") + "\">Close All (" + closeEntries.length + ")</button>";
    } else if (closeEntries.length === 1){
      infoHtml += "<button class=\"via-close-ex\" data-ids=\"" + closeEntries[0].id + "\">Close Exception</button>";
    }

    /* Dencar links for each instance */
    for (const {id: eid} of entries){
      infoHtml += "<a class=\"via-open\" href=\"" + VBASE + "/consumerpassexceptions/" + eid + "/\" target=\"_blank\">Open in Dencar" + (entries.length > 1 ? " (" + eid.slice(0,6) + ")" : "") + "</a>";
    }

    infoHtml += "</div></div>";
    div.innerHTML = photosHtml + infoHtml;
    wrap.appendChild(div);
  }

  bindZoom();

  wrap.querySelectorAll(".via-note").forEach(t => {
    t.addEventListener("change", async () => { viaNotes[t.dataset.id] = t.value; await viaSave(); });
  });
  wrap.querySelectorAll(".via-trigger").forEach(b => {
    b.addEventListener("click", () => viaAction(b.dataset.id, "trigger", b));
  });
  wrap.querySelectorAll(".via-close-ex").forEach(b => {
    b.addEventListener("click", () => {
      const ids = b.dataset.ids.split(",");
      viaCloseGroup(ids, b);
    });
  });
}

/* ===== Tab rendering ===== */
function renderViaTabs(){
  let bar = V$("viaTabBar");
  if (!bar){
    bar = document.createElement("div");
    bar.id = "viaTabBar";
    bar.className = "via-tab-bar";
    const parent = V$("viaCards").parentNode;
    parent.insertBefore(bar, V$("viaCards"));
  }
  const openCt = Object.keys(viaData).length;
  const autoCt = viaAutoClosed.length;
  bar.innerHTML =
    "<button class=\"via-tab" + (viaActiveTab === "open" ? " active" : "") + "\" data-tab=\"open\">Open (" + openCt + ")</button>" +
    "<button class=\"via-tab" + (viaActiveTab === "auto" ? " active" : "") + "\" data-tab=\"auto\">Auto-Closed (" + autoCt + ")</button>" +
    "<button class=\"via-tab" + (viaActiveTab === "settings" ? " active" : "") + "\" data-tab=\"settings\">" + String.fromCharCode(9881) + " Auto Rules</button>";
  bar.querySelectorAll(".via-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      viaActiveTab = btn.dataset.tab;
      renderViaList();
    });
  });
}

/* ===== Auto-closed list ===== */
function renderAutoClosedList(wrap){
  if (!viaAutoClosed.length){
    wrap.innerHTML = "<div class=\"via-empty\">No auto-closed exceptions yet. Enable auto rules and sync to get started.</div>";
    return;
  }
  /* Group by rule */
  const groups = {};
  const ruleLabels = {
    ocrOneChar: "Plate 1 character off",
    ocrTwoChar: "Plate 2 characters off",
    lowUsage2: "Less than 2 washes/month",
    lowUsage3: "Less than 3 washes/month",
    dormant: "Dormant (3+ weeks inactive)"
  };
  const ruleBadge = {
    ocrOneChar: "ac-badge-ocr",
    ocrTwoChar: "ac-badge-ocr",
    lowUsage2: "ac-badge-low",
    lowUsage3: "ac-badge-low",
    dormant: "ac-badge-dormant"
  };
  viaAutoClosed.forEach(r => {
    const k = r.rule || "other";
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  });
  /* Summary bar */
  let html = "<div class=\"ac-summary\">" +
    "<span class=\"ac-total\">" + viaAutoClosed.length + " auto-closed</span>";
  for (const k of Object.keys(groups)){
    html += "<span class=\"ac-pill " + (ruleBadge[k] || "ac-badge-other") + "\">" + (ruleLabels[k] || k) + ": " + groups[k].length + "</span>";
  }
  html += "</div>";
  /* Render each group */
  const order = ["ocrOneChar", "ocrTwoChar", "lowUsage2", "lowUsage3", "dormant"];
  const allKeys = order.filter(k => groups[k]).concat(Object.keys(groups).filter(k => order.indexOf(k) === -1));
  for (const k of allKeys){
    const items = groups[k].slice().reverse();
    html += "<div class=\"ac-group\">" +
      "<div class=\"ac-group-header\"><span class=\"ac-pill " + (ruleBadge[k] || "ac-badge-other") + "\">" + (ruleLabels[k] || k) + "</span> <span class=\"ac-group-ct\">" + items.length + " closed</span></div>" +
      "<table class=\"ac-table\"><tr><th>When</th><th>Member</th><th>Pass</th><th>Plan Plate</th><th>Off Plate</th><th>Washes/mo</th></tr>";
    items.slice(0, 100).forEach(r => {
      html += "<tr>" +
        "<td>" + new Date(r.ts).toLocaleDateString() + "</td>" +
        "<td class=\"ac-name\">" + vEsc(r.name) + "</td>" +
        "<td>" + vEsc(r.passName) + "</td>" +
        "<td class=\"ac-plate\">" + vEsc(r.plates || "") + "</td>" +
        "<td class=\"ac-plate ac-off\">" + vEsc(r.offPlate || "") + "</td>" +
        "<td>" + vEsc(r.perMonth) + "</td>" +
        "</tr>";
    });
    html += "</table></div>";
  }
  wrap.innerHTML = html;
}

/* ===== Auto-dismiss settings ===== */
function renderAutoSettings(wrap){
  const s = viaAutoSettings;
  let html = "<div class=\"via-auto-settings\">" +
    "<h3>Auto-Close Rules</h3>" +
    "<p class=\"via-auto-desc\">Exceptions matching enabled rules will be automatically closed during sync. Review the Auto-Closed tab to verify.</p>" +
    "<label class=\"via-auto-rule\"><input type=\"checkbox\" data-rule=\"ocrOneChar\"" + (s.ocrOneChar ? " checked" : "") + "> Close if plate is <strong>1 character</strong> off from plan plate</label>" +
    "<label class=\"via-auto-rule\"><input type=\"checkbox\" data-rule=\"ocrTwoChar\"" + (s.ocrTwoChar ? " checked" : "") + "> Close if plate is <strong>2 characters</strong> off from plan plate</label>" +
    "<label class=\"via-auto-rule\"><input type=\"checkbox\" data-rule=\"lowUsage2\"" + (s.lowUsage2 ? " checked" : "") + "> Close if member washes <strong>less than 2x/month</strong></label>" +
    "<label class=\"via-auto-rule\"><input type=\"checkbox\" data-rule=\"lowUsage3\"" + (s.lowUsage3 ? " checked" : "") + "> Close if member washes <strong>less than 3x/month</strong></label>" +
    "<label class=\"via-auto-rule\"><input type=\"checkbox\" data-rule=\"dormant\"" + (s.dormant ? " checked" : "") + "> Close if member is <strong>dormant (3+ weeks inactive)</strong></label>" +
    "<div style=\"margin-top:12px\"><button id=\"viaClearAuto\" class=\"via-sync\" style=\"background:#7f1d1d\">Clear Auto-Closed History</button></div>" +
    "</div>";
  wrap.innerHTML = html;
  wrap.querySelectorAll("input[data-rule]").forEach(cb => {
    cb.addEventListener("change", async () => {
      viaAutoSettings[cb.dataset.rule] = cb.checked;
      await viaSave();
    });
  });
  const clearBtn = V$("viaClearAuto");
  if (clearBtn){
    clearBtn.addEventListener("click", async () => {
      if (!confirm("Clear all auto-closed history?")) return;
      viaAutoClosed = [];
      await viaSave();
      renderViaList();
    });
  }
}

/* ===== Override reason modal ===== */
const VIA_OVERRIDE_REASONS = [
  "OCR mismatch",
  "Friend / Family",
  "Employee",
  "Customer called ahead",
  "Low usage - not suspicious",
  "Known abuser",
  "Cancelled member",
  "Stolen plate",
  "Other"
];

function isOverride(e, actionKind){
  const rec = recommend(e);
  if (actionKind === "trigger" && (rec.verdict === "DO NOT TRIGGER" || rec.verdict === "LET SLIDE")) return true;
  if (actionKind === "close" && rec.verdict === "TRIGGER") return true;
  return false;
}

function showReasonModal(e, actionKind){
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "via-overlay";
    const rec = recommend(e);
    let html = "<div class=\"via-reason-modal\">" +
      "<h3>Override: Sidecar said " + vEsc(rec.verdict) + "</h3>" +
      "<p>You chose to <strong>" + (actionKind === "trigger" ? "Trigger" : "Close") + "</strong>. Why?</p>";
    VIA_OVERRIDE_REASONS.forEach((r, i) => {
      html += "<label class=\"via-reason-opt\"><input type=\"radio\" name=\"viaReason\" value=\"" + vEsc(r) + "\"" + (i === 0 ? " checked" : "") + "> " + vEsc(r) + "</label>";
    });
    html += "<div class=\"via-reason-actions\">" +
      "<button class=\"via-trigger\" id=\"viaReasonOk\">Confirm</button>" +
      "<button class=\"via-close-ex\" id=\"viaReasonCancel\" style=\"background:#334155\">Cancel</button>" +
      "</div></div>";
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    V$("viaReasonOk").addEventListener("click", () => {
      const sel = overlay.querySelector("input[name='viaReason']:checked");
      document.body.removeChild(overlay);
      resolve(sel ? sel.value : "Other");
    });
    V$("viaReasonCancel").addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve(null);
    });
  });
}

/* ===== Actions ===== */
async function viaAction(id, kind, btn){
  const e = viaData[id];
  if (!e) return;
  const actionId = kind === "trigger" ? e.triggerId : e.closeId;
  if (!actionId) return;

  /* Check for override — show reason modal instead of plain confirm */
  let overrideReason = null;
  if (isOverride(e, kind)){
    overrideReason = await showReasonModal(e, kind);
    if (overrideReason === null) return; /* cancelled */
  } else {
    const label = kind === "trigger" ? "TRIGGER the exception" : "CLOSE the exception";
    if (!confirm("Are you sure you want to " + label + " for " + e.firstName + " " + e.lastName + "? This happens on Dencar immediately.")) return;
  }

  btn.disabled = true;
  btn.textContent = "Working...";
  try {
    const path = kind === "trigger" ? "trigger" : "closeexception";
    const method = kind === "trigger" ? "POST" : "DELETE";
    const res = await fetch(VBASE + "/consumerpassexceptions/" + path + "/" + actionId + "/", {method: method, credentials: "include"});
    if (res.ok){
      viaNotes[id] = ((viaNotes[id] || "") + "\n[" + new Date().toLocaleString() + "] " + (kind === "trigger" ? "Triggered" : "Closed") + " via Sidecar" + (overrideReason ? " (reason: " + overrideReason + ")" : "")).trim();
      try { await viaHistLog(e, kind === "trigger" ? "trigger" : "close", overrideReason); } catch(_){}
      delete viaData[id];
      await viaSave();
      renderViaList();
      V$("viaStatus").textContent = (kind === "trigger" ? "Exception triggered." : "Exception closed.");
      /* Re-sync to pick up any new exceptions */
      setTimeout(() => viaSync(), 600);
    } else {
      btn.disabled = false;
      btn.textContent = kind === "trigger" ? "Trigger Exception" : "Close Exception";
      V$("viaStatus").textContent = "Action failed (" + res.status + ") - use Open in Dencar.";
    }
  } catch(err){
    btn.disabled = false;
    btn.textContent = kind === "trigger" ? "Trigger Exception" : "Close Exception";
    V$("viaStatus").textContent = "Action failed: " + err.message;
  }
}

/* Close multiple grouped exceptions sequentially */
async function viaCloseGroup(ids, btn){
  if (!ids.length) return;
  const first = viaData[ids[0]];
  if (!first) return;

  /* Check for override on the primary entry */
  let overrideReason = null;
  if (isOverride(first, "close")){
    overrideReason = await showReasonModal(first, "close");
    if (overrideReason === null) return;
  } else {
    const label = ids.length > 1
      ? "CLOSE " + ids.length + " exceptions"
      : "CLOSE the exception";
    if (!confirm("Are you sure you want to " + label + " for " + first.firstName + " " + first.lastName + "? This happens on Dencar immediately.")) return;
  }

  btn.disabled = true;
  btn.textContent = "Closing...";
  let ok = 0;
  let fail = 0;
  for (const id of ids){
    const e = viaData[id];
    if (!e || !e.closeId) continue;
    try {
      const res = await fetch(VBASE + "/consumerpassexceptions/closeexception/" + e.closeId + "/", {method: "DELETE", credentials: "include"});
      if (res.ok){
        viaNotes[id] = ((viaNotes[id] || "") + "\n[" + new Date().toLocaleString() + "] Closed via Sidecar" + (overrideReason ? " (reason: " + overrideReason + ")" : "")).trim();
        try { await viaHistLog(e, "close", overrideReason); } catch(_){}
        delete viaData[id];
        ok++;
      } else { fail++; }
    } catch(_){ fail++; }
    await new Promise(r => setTimeout(r, 200));
  }
  await viaSave();
  renderViaList();
  V$("viaStatus").textContent = "Closed " + ok + " exception" + (ok !== 1 ? "s" : "") + (fail ? ", " + fail + " failed" : "") + ".";
  /* Re-sync */
  setTimeout(() => viaSync(), 600);
}

function bindZoom(){
  let z = document.getElementById("viaZoom");
  if (!z){ z = document.createElement("img"); z.id = "viaZoom"; z.style.display = "none"; z.style.maxHeight = "85vh"; z.style.objectFit = "contain"; document.body.appendChild(z); }
  document.querySelectorAll(".via-photos img").forEach(img => {
    img.addEventListener("mouseenter", () => { z.src = img.src; z.style.display = "block"; });
    img.addEventListener("mousemove", (ev) => {
      z.style.left = Math.min(ev.pageX + 24, window.scrollX + window.innerWidth - 1220) + "px";
      /* Keep zoom within viewport */
      const zh = z.offsetHeight || z.naturalHeight || 400;
      let top = ev.pageY - 100;
      if (ev.clientY - 100 + zh > window.innerHeight){
        top = ev.pageY - zh + 50;
      }
      /* Clamp so it never goes above viewport */
      const minTop = window.scrollY + 10;
      const maxTop = window.scrollY + window.innerHeight - zh - 10;
      z.style.top = Math.max(minTop, Math.min(top, maxTop)) + "px";
    });
    img.addEventListener("mouseleave", () => { z.style.display = "none"; });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await viaLoad();
  renderViaList();
  V$("viaSyncBtn").addEventListener("click", viaSync);
});

async function enrichConsumer(d){
  if (!d.consumerId) return;
  try {
    const end = new Date();
    const body = "currentPage=1&itemsPerPage=500&PaymentType=&SiteId=&DeviceId=&StartDate=2015-01-01&EndDate=" + end.toLocaleDateString("en-CA") + "&LicensePlateNum=&Code=&MaskedCardNumber=&ConsumerFirstName=&ConsumerLastName=&ConsumerId=" + d.consumerId;
    const res = await fetch(VBASE + "/Payment/IndexFilterTable", {method: "POST", credentials: "include", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: body});
    if (!res.ok) return;
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const rows = Array.from(doc.querySelectorAll("tr"));
    let tsIdx = -1, lpIdx = -1, mIdx = -1;
    for (const r of rows){
      const cells = Array.from(r.children);
      cells.forEach((c, i) => {
        const t = c.textContent.trim().toLowerCase();
        if (c.tagName === "TH" && tsIdx === -1 && /timestamp|date/.test(t)) tsIdx = i;
        if (c.tagName === "TH" && lpIdx === -1 && /license|lp\b|plate/.test(t)) lpIdx = i;
        if (c.tagName === "TH" && mIdx === -1 && t === "method") mIdx = i;
      });
      if (tsIdx >= 0 && lpIdx >= 0) break;
    }
    const washes = [];
    let others = 0;
    for (const r of rows){
      const cells = Array.from(r.children);
      if (!cells.length || cells[0].tagName === "TH") continue;
      let ts = "";
      if (tsIdx >= 0 && cells[tsIdx]) ts = cells[tsIdx].textContent.trim();
      if (!/^\d{2}\/\d{2}\/\d{4}/.test(ts)){
        const alt = cells.map(c => c.textContent.trim()).find(x => /^\d{2}\/\d{2}\/\d{4}/.test(x));
        if (alt) ts = alt; else continue;
      }
      let lp = "";
      if (lpIdx >= 0 && cells[lpIdx]) lp = cells[lpIdx].textContent.trim();
      const p = ts.split(/[\/ :]/);
      const t = new Date(p[2], p[0] - 1, p[1], p[3] || 0, p[4] || 0, p[5] || 0).getTime();
      const plate = (lp || "").toUpperCase();
      const method = (mIdx >= 0 && cells[mIdx]) ? cells[mIdx].textContent.trim() : "";
      if (plate && plate !== "N/A" && plate !== "-") washes.push({t: t, lp: plate});
      else if (/vac|self serve/i.test(method)) others++;
    }
    washes.sort((a, b) => b.t - a.t);
    if (washes.length || others){ d.washHistory = washes; d.otherUses = others; }
  } catch(err){}
}

/* ===== VIA Decision History (Sidecar) ===== */
const VIA_HIST_KEY = "viaHistory";

async function viaHistAll(){
  const o = await chrome.storage.local.get(VIA_HIST_KEY);
  return o[VIA_HIST_KEY] || [];
}

async function viaHistLog(e, action, overrideReason){
  const rec = { ts: Date.now(), action: action };
  if (overrideReason) rec.overrideReason = overrideReason;
  for (const k in e){
    const v = e[k];
    if (v == null) continue;
    if (typeof v === "object" || typeof v === "function") continue;
    if (typeof v === "string" && (k.toLowerCase().indexOf("photo") >= 0 || k.toLowerCase().indexOf("image") >= 0 || v.length > 300)) continue;
    rec[k] = v;
  }
  try {
    if (typeof recommend === "function"){
      var r = recommend(e);
      rec.rec = (typeof r === "string") ? r : (r && r.verdict ? r.verdict + " - " + (r.why || "") : (r ? JSON.stringify(r) : ""));
    }
  } catch(_){}
  const hist = await viaHistAll();
  hist.push(rec);
  if (hist.length > 2000) hist.splice(0, hist.length - 2000);
  await chrome.storage.local.set({ [VIA_HIST_KEY]: hist });
  try { renderViaHistory(); } catch(_){}
}

function viaHistEsc(s){
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function renderViaHistory(){
  const anchor = document.getElementById("viaCards");
  if (!anchor) return;
  if (!document.getElementById("viaHistCss")){
    const st = document.createElement("style");
    st.id = "viaHistCss";
    st.textContent = ".via-hist{border-collapse:collapse;width:100%;margin-top:8px}" +
      ".via-hist th,.via-hist td{border-bottom:1px solid #e3e3e3;padding:6px 10px;text-align:left;font-size:13px;color:inherit}" +
      ".via-hist th{background:rgba(127,127,127,.18);color:inherit;font-weight:700}" +
      ".via-hist-trigger{color:#ff6b6b;font-weight:600}" +
      ".via-hist-close{color:#4ade80;font-weight:600}" +
      ".via-hist-summary{margin:6px 0;opacity:.75;font-size:13px}" +
      ".via-hist-empty{opacity:.7;font-size:13px;margin:8px 0}" +
      /* Tab bar styles */
      ".via-tab-bar{display:flex;gap:4px;margin-bottom:12px}" +
      ".via-tab{padding:6px 16px;border:none;border-radius:6px 6px 0 0;background:#1e293b;color:#8fa3c0;cursor:pointer;font-size:13px;font-weight:600}" +
      ".via-tab.active{background:#182640;color:#fff}" +
      ".via-instance-badge{background:#3b82f6;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px;font-weight:700}" +
      /* Decision history styles */
      ".dh-wrap{background:#0f172a;border-radius:10px;padding:16px;margin-top:8px}" +
      ".dh-summary{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}" +
      ".dh-stat{padding:4px 12px;border-radius:8px;font-size:13px;font-weight:600}" +
      ".dh-stat-total{background:#1e293b;color:#fff}" +
      ".dh-stat-trig{background:#7f1d1d;color:#fca5a5}" +
      ".dh-stat-close{background:#14532d;color:#4ade80}" +
      ".dh-stat-override{background:#78350f;color:#fbbf24}" +
      ".dh-table{border-collapse:collapse;width:100%}" +
      ".dh-table th{text-align:left;padding:6px 10px;font-size:12px;color:#64748b;border-bottom:1px solid #1e293b;font-weight:600;text-transform:uppercase;letter-spacing:.5px}" +
      ".dh-table td{padding:8px 10px;font-size:13px;border-bottom:1px solid #1e293b;color:#cbd5e1}" +
      ".dh-name{color:#fff;font-weight:600}" +
      ".dh-act-trigger{color:#f87171;font-weight:600}" +
      ".dh-act-close{color:#4ade80;font-weight:600}" +
      ".dh-reason{color:#fbbf24;font-size:12px}" +
      ".dh-rec{color:#94a3b8;font-size:12px;max-width:200px}" +
      ".dh-seen{color:#64748b;text-align:center}" +
      ".dh-empty{color:#475569;font-size:13px;padding:20px 0;text-align:center}" +
      ".dh-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}" +
      ".dh-title{font-size:16px;font-weight:700;color:#fff}" +
      /* Auto-closed list styles */
      ".ac-summary{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px}" +
      ".ac-total{font-size:15px;font-weight:700;color:#fff}" +
      ".ac-pill{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600}" +
      ".ac-badge-ocr{background:#1e3a5f;color:#60a5fa}" +
      ".ac-badge-low{background:#14532d;color:#4ade80}" +
      ".ac-badge-dormant{background:#3f3f00;color:#facc15}" +
      ".ac-badge-other{background:#334155;color:#94a3b8}" +
      ".ac-group{background:#0f172a;border-radius:10px;padding:14px;margin-bottom:12px}" +
      ".ac-group-header{margin-bottom:10px;display:flex;align-items:center;gap:8px}" +
      ".ac-group-ct{font-size:12px;color:#64748b}" +
      ".ac-table{border-collapse:collapse;width:100%}" +
      ".ac-table th{text-align:left;padding:6px 10px;font-size:12px;color:#64748b;border-bottom:1px solid #1e293b;font-weight:600;text-transform:uppercase;letter-spacing:.5px}" +
      ".ac-table td{padding:8px 10px;font-size:13px;border-bottom:1px solid #1e293b;color:#cbd5e1}" +
      ".ac-name{color:#fff;font-weight:600}" +
      ".ac-plate{font-family:monospace;letter-spacing:1px;font-size:13px;color:#94a3b8}" +
      ".ac-off{color:#fb923c}" +
      /* Auto settings styles */
      ".via-auto-settings{background:#182640;border-radius:10px;padding:20px}" +
      ".via-auto-settings h3{margin:0 0 8px;font-size:16px}" +
      ".via-auto-desc{color:#8fa3c0;font-size:13px;margin-bottom:14px}" +
      ".via-auto-rule{display:block;padding:8px 0;font-size:14px;cursor:pointer}" +
      ".via-auto-rule input{margin-right:10px}" +
      /* Override reason modal */
      ".via-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center}" +
      ".via-reason-modal{background:#1e293b;border-radius:12px;padding:24px;max-width:400px;width:90%}" +
      ".via-reason-modal h3{margin:0 0 8px;font-size:16px}" +
      ".via-reason-modal p{color:#8fa3c0;font-size:13px;margin-bottom:12px}" +
      ".via-reason-opt{display:block;padding:6px 0;font-size:14px;cursor:pointer}" +
      ".via-reason-opt input{margin-right:10px}" +
      ".via-reason-actions{display:flex;gap:8px;margin-top:16px}";
    document.head.appendChild(st);
  }
  let box = document.getElementById("viaHistBox");
  if (!box){
    box = document.createElement("div");
    box.id = "viaHistBox";
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
  }
  const hist = (await viaHistAll()).slice().reverse();
  const trig = hist.filter(h => h.action === "trigger").length;
  const closed = hist.length - trig;
  const overrides = hist.filter(h => h.overrideReason).length;
  const byName = {};
  hist.forEach(h => {
    const n = ((h.firstName || "") + " " + (h.lastName || "")).trim() || "Unknown";
    byName[n] = (byName[n] || 0) + 1;
  });
  let html = "<div class=\"dh-wrap\">";
  html += "<div class=\"dh-header\"><span class=\"dh-title\">Decision History</span></div>";
  html += "<div class=\"dh-summary\">" +
    "<span class=\"dh-stat dh-stat-total\">" + hist.length + " decisions</span>" +
    "<span class=\"dh-stat dh-stat-trig\">" + trig + " triggered</span>" +
    "<span class=\"dh-stat dh-stat-close\">" + closed + " closed</span>" +
    (overrides ? "<span class=\"dh-stat dh-stat-override\">" + overrides + " overrides</span>" : "") +
    "</div>";
  if (!hist.length){
    html += "<div class=\"dh-empty\">No decisions logged yet. The next trigger or close will appear here.</div>";
  } else {
    html += "<table class=\"dh-table\"><tr><th>When</th><th>Member</th><th>Action</th><th>Sidecar Said</th><th>Override Reason</th><th style=\"text-align:center\">Seen</th></tr>";
    hist.slice(0, 150).forEach(h => {
      const n = ((h.firstName || "") + " " + (h.lastName || "")).trim() || "Unknown";
      html += "<tr><td>" + new Date(h.ts).toLocaleDateString() + " " + new Date(h.ts).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}) + "</td>" +
        "<td class=\"dh-name\">" + viaHistEsc(n) + "</td>" +
        "<td class=\"dh-act-" + h.action + "\">" + (h.action === "trigger" ? "Triggered" : "Closed") + "</td>" +
        "<td class=\"dh-rec\">" + (h.rec ? viaHistEsc(h.rec) : "&ndash;") + "</td>" +
        "<td class=\"dh-reason\">" + (h.overrideReason ? viaHistEsc(h.overrideReason) : "&ndash;") + "</td>" +
        "<td class=\"dh-seen\">" + byName[n] + "</td></tr>";
    });
    html += "</table>";
  }
  html += "</div>";
  box.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => { renderViaHistory(); });
