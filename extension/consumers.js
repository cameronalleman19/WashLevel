const CBASE = "https://admin.dencar.sancsoft.net";
const C$ = (id) => document.getElementById(id);
let consumers = {};
let consSortCol = "signup";
let consSortAsc = false;

function cEsc(s){ const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
function cNorm(s){ return (s || "").toLowerCase().replace(/[^a-z]/g, ""); }
function consFmtDate(t){ if (!t) return "--"; try { const d = new Date(t); if (isNaN(d.getTime())) return "--"; return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear(); } catch(e){ return "--"; } }

async function consLoad(){
  const st = await chrome.storage.local.get(["consumers"]);
  consumers = st.consumers || {};
}
async function consSave(){ await chrome.storage.local.set({consumers: consumers}); }

async function fetchConsumerPage(page){
  const body = "ConsumerFirstName=&ConsumerLastName=&MobileNumber=&Email=&RFIDCode=&ConsumerCode=0&CreditCardStatus=&HasMultiplePasses=false&CurrentPage=" + page + "&ItemsPerPage=500";
  const res = await fetch(CBASE + "/consumer/indexfiltertable/", {method: "POST", credentials: "include", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: body});
  if (!res.ok) return [];
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  const out = [];
  doc.querySelectorAll("div.card[id]").forEach(card => {
    const id = (card.getAttribute("id") || "").trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return;
    const h = card.querySelector("h5");
    let name = "", signup = 0;
    if (h){
      const small = h.querySelector("small");
      const dTxt = small ? small.textContent.trim() : "";
      const dm = dTxt.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dm) signup = new Date(dm[3], dm[1] - 1, dm[2]).getTime();
      const hClone = h.cloneNode(true);
      const sm = hClone.querySelector("small");
      if (sm) sm.remove();
      name = hClone.textContent.replace(/\s+/g, " ").trim();
    }
    out.push({id: id, name: name || "(no name)", signup: signup});
  });
  return out;
}

async function fetchPaymentsPage(page, startStr, endStr){
  const body = "currentPage=" + page + "&itemsPerPage=500&PaymentType=&SiteId=&DeviceId=&StartDate=" + startStr + "&EndDate=" + endStr + "&LicensePlateNum=&Code=&MaskedCardNumber=&ConsumerFirstName=&ConsumerLastName=&ConsumerId=";
  const res = await fetch(CBASE + "/Payment/IndexFilterTable", {method: "POST", credentials: "include", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: body});
  if (!res.ok) return [];
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  const rows = Array.from(doc.querySelectorAll("tr"));
  let tsIdx = -1, lpIdx = -1, mIdx = -1, nIdx = -1;
  let aIdx = -1, taxIdx = -1, dIdx = -1;
  for (const r of rows){
    Array.from(r.children).forEach((c, i) => {
      const t = c.textContent.trim().toLowerCase();
      if (c.tagName !== "TH") return;
      if (tsIdx === -1 && /timestamp/.test(t)) tsIdx = i;
      if (lpIdx === -1 && /license|plate/.test(t) && !/confidence/.test(t)) lpIdx = i;
      if (mIdx === -1 && t === "method") mIdx = i;
      if (nIdx === -1 && t === "name") nIdx = i;
      if (aIdx === -1 && t === "amount") aIdx = i;
      if (taxIdx === -1 && t === "tax") taxIdx = i;
      if (dIdx === -1 && t === "device") dIdx = i;
    });
    if (tsIdx >= 0 && lpIdx >= 0 && mIdx >= 0 && nIdx >= 0) break;
  }
  const out = [];
  for (const r of rows){
    const cells = Array.from(r.children);
    if (!cells.length || cells[0].tagName === "TH") continue;
    let ts = tsIdx >= 0 && cells[tsIdx] ? cells[tsIdx].textContent.trim() : "";
    if (!/^\d{2}\/\d{2}\/\d{4}/.test(ts)){
      const alt = cells.map(c => c.textContent.trim()).find(x => /^\d{2}\/\d{2}\/\d{4}/.test(x));
      if (alt) ts = alt; else continue;
    }
    const p = ts.split(/[\/ :]/);
    const t = new Date(p[2], p[0] - 1, p[1], p[3] || 0, p[4] || 0, p[5] || 0).getTime();
    out.push({
      t: t,
      lp: (lpIdx >= 0 && cells[lpIdx] ? cells[lpIdx].textContent.trim() : "").toUpperCase(),
      method: mIdx >= 0 && cells[mIdx] ? cells[mIdx].textContent.trim() : "",
      name: nIdx >= 0 && cells[nIdx] ? cells[nIdx].textContent.replace(/\s+/g, " ").trim() : "",
      amt: aIdx >= 0 && cells[aIdx] ? (parseFloat(cells[aIdx].textContent.replace(/[^0-9.-]/g, "")) || 0) : 0,
      tax: taxIdx >= 0 && cells[taxIdx] ? (parseFloat(cells[taxIdx].textContent.replace(/[^0-9.-]/g, "")) || 0) : 0,
      device: dIdx >= 0 && cells[dIdx] ? cells[dIdx].textContent.replace(/\s+/g, " ").trim() : ""
    });
  }
  return out;
}

async function fetchVehicleCount(id){
  try {
    // Step 1: fetch consumer page to find their pass link
    const cRes = await fetch(CBASE + "/consumer/" + id + "/", {credentials: "include", redirect: "manual"});
    if (!cRes.ok || cRes.type === "opaqueredirect" || cRes.status === 0) return -1;
    const cDoc = new DOMParser().parseFromString(await cRes.text(), "text/html");
    let passUrl = "";
    cDoc.querySelectorAll('a[href*="/consumerpass/"]').forEach(a => {
      const m = (a.getAttribute("href") || "").match(/\/consumerpass\/([0-9a-fA-F-]{36})\//);
      if (m) passUrl = "/consumerpass/" + m[1] + "/";
    });
    if (!passUrl) return 1;
    // Step 2: fetch pass page, read Vehicle Count <strong> + <p>
    const res = await fetch(CBASE + passUrl, {credentials: "include", redirect: "manual"});
    if (!res.ok || res.type === "opaqueredirect" || res.status === 0) return -1;
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    for (const s of doc.querySelectorAll("strong")){
      if (/^vehicle\s*count$/i.test(s.textContent.trim())){
        const p = s.nextElementSibling;
        if (p){ const n = parseInt(p.textContent); if (n > 0) return n; }
      }
    }
    return 1;
  } catch(e){ return 1; }
}

async function fetchConsumerPhone(id){
  try {
    const res = await fetch(CBASE + "/consumer/" + id + "/", {credentials: "include", redirect: "manual"});
    if (!res.ok || res.type === "opaqueredirect" || res.status === 0) return null;
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    let phone = "", site = "";
    for (const s of doc.querySelectorAll("strong")){
      const t = s.textContent.trim();
      if (/^phone\s*#?$/i.test(t)){
        const p = s.nextElementSibling;
        if (p) phone = p.textContent.trim();
      }
      if (/^favorite\s*site$/i.test(t)){
        const p = s.nextElementSibling;
        if (p) site = p.textContent.trim().split("\n")[0].trim();
      }
    }
    return {phone: phone, favSite: site};
  } catch(e){ return null; }
}

async function fetchIncompletePhones(fresh){
  const cut = Date.now() - 35 * 86400000;
  const ids = Object.keys(fresh).filter(id => {
    const c = fresh[id];
    return c.name === "(no name)" && c.signup > cut && !c.phone;
  });
  for (let i = 0; i < ids.length; i++){
    C$("consStatus").textContent = "Fetching incomplete signup " + (i + 1) + "/" + ids.length + "...";
    const info = await fetchConsumerPhone(ids[i]);
    if (info === null) break;
    fresh[ids[i]].phone = info.phone;
    fresh[ids[i]].favSite = info.favSite;
    await new Promise(r => setTimeout(r, 200));
  }
}

async function fetchVehBatch(ids, fresh){
  for (let i = 0; i < ids.length; i++){
    C$("consStatus").textContent = "Fetching vehicle count " + (i + 1) + "/" + ids.length + "...";
    const v = await fetchVehicleCount(ids[i]);
    if (v === -1){ C$("consStatus").textContent = "Dencar session expired at " + (i + 1) + "/" + ids.length + ". Log in to Dencar and re-sync."; consumers = fresh; await consSave(); renderConsumers(); C$("consSyncBtn").disabled = false; throw new Error("SESSION_EXPIRED"); }
    fresh[ids[i]].veh = v;
    if (i % 10 === 9){ consumers = fresh; await consSave(); }
    await new Promise(r => setTimeout(r, 200));
  }
}

async function consSync(){
  C$("consSyncBtn").disabled = true;
  C$("consStatus").textContent = "Loading consumer list...";
  try {
    const list = [];
    for (let page = 1; page <= 10; page++){
      C$("consStatus").textContent = "Loading consumer list page " + page + "...";
      const batch = await fetchConsumerPage(page);
      list.push.apply(list, batch);
      if (batch.length < 500) break;
      await new Promise(r => setTimeout(r, 20));
    }
    if (!list.length){ C$("consStatus").textContent = "No consumers found - are you logged into Dencar?"; C$("consSyncBtn").disabled = false; return; }
    const stored = await chrome.storage.local.get(["washTiers", "plateVisits", "plateSiteMap", "lastPaymentSync"]);
    const tiers = stored.washTiers || {};
    const pv = stored.plateVisits || {};
    const psm = stored.plateSiteMap || [];
    const isIncr = !!stored.lastPaymentSync;
    const byName = {};
    const fresh = {};
    for (const c of list){
      const ex = isIncr ? consumers[c.id] : null;
      fresh[c.id] = ex
        ? {id: c.id, name: c.name, signup: c.signup, washes: ex.washes || 0, others: ex.others || 0, lastWash: ex.lastWash || 0, months: Object.assign({}, ex.months), cancelled: ex.cancelled || 0, lastNew: ex.lastNew || 0, lastRenew: ex.lastRenew || 0, veh: ex.veh || 1, phone: ex.phone || "", favSite: ex.favSite || ""}
        : {id: c.id, name: c.name, signup: c.signup, washes: 0, others: 0, lastWash: 0, months: {}, cancelled: 0, lastNew: 0, lastRenew: 0, veh: 1, phone: "", favSite: ""};
      const k = cNorm(c.name);
      if (k) byName[k] = fresh[c.id];
    }
    const endStr = new Date().toLocaleDateString("en-CA");
    let startStr;
    if (isIncr){
      const lpd = new Date(stored.lastPaymentSync + "T12:00:00");
      lpd.setDate(lpd.getDate() + 1);
      startStr = lpd.toLocaleDateString("en-CA");
      if (startStr > endStr){
        const vehCut2 = Date.now() - 45 * 86400000;
        const vehIds2 = Object.keys(fresh).filter(id => {
          const c = fresh[id];
          return (c.veh || 1) === 1 && ((c.lastWash > vehCut2) || (c.lastRenew > vehCut2) || (c.lastNew > vehCut2));
        });
        if (vehIds2.length){
          await fetchVehBatch(vehIds2, fresh);
        }
        await fetchIncompletePhones(fresh);
        consumers = fresh;
        await consSave();
        C$("consStatus").textContent = "Up to date. " + list.length + " consumers.";
        renderConsumers();
        C$("consSyncBtn").disabled = false;
        return;
      }
      C$("consStatus").textContent = "Incremental sync from " + startStr + "...";
    } else {
      startStr = "2015-01-01";
    }
    for (let page = 1; page <= 500; page++){
      C$("consStatus").textContent = "Loading payments page " + page + "...";
      const batch = await fetchPaymentsPage(page, startStr, endStr);
      for (const row of batch){
        if (/^(credit card|cash)$/i.test(row.method) && row.amt > 0){
          const site = (row.device || "").split(" - ")[0].trim() || "Unknown";
          const base = Math.round((row.amt - row.tax) * 100) / 100;
          const key = (Math.abs(base - Math.round(base)) < 0.02 && base > 0) ? String(Math.round(base)) : "other";
          const dk = new Date(row.t).toLocaleDateString("en-CA");
          const sObj = tiers[site] = tiers[site] || {};
          const dObj = sObj[dk] = sObj[dk] || {};
          const cur = dObj[key] = dObj[key] || [0, 0];
          cur[0] += 1;
          cur[1] += base;
        }
        if (row.lp && row.lp !== "N/A" && row.lp !== "-"){
          const pSite = (row.device || "").split(" - ")[0].trim() || "Unknown";
          let psi = psm.indexOf(pSite);
          if (psi === -1){ psi = psm.length; psm.push(pSite); }
          const pdk = new Date(row.t).toLocaleDateString("en-CA");
          if (/^(credit card|cash)$/i.test(row.method)){
            const pr = pv[row.lp] = pv[row.lp] || {v: []};
            if (!pr.v.some(function(e){ return e[0] === pdk && e[1] === psi; })) pr.v.push([pdk, psi]);
          }
          if (/new pass/i.test(row.method)){
            const pr = pv[row.lp] = pv[row.lp] || {v: []};
            pr.conv = pdk;
          }
        }
        const c = byName[cNorm(row.name)];
        if (!c) continue;
        if (/pass cancelled/i.test(row.method)){ if (row.t > c.cancelled) c.cancelled = row.t; }
        if (/new pass/i.test(row.method)){ if (row.t > c.lastNew) c.lastNew = row.t; }
        if (/pass renew/i.test(row.method)){ if (row.t > c.lastRenew) c.lastRenew = row.t; }
        if (/wash pass/i.test(row.method)){
          c.washes++;
          const md = new Date(row.t);
          const mk = md.getFullYear() + "-" + String(md.getMonth() + 1).padStart(2, "0");
          c.months[mk] = (c.months[mk] || 0) + 1;
          if (row.t > c.lastWash) c.lastWash = row.t;
        } else if (/vac|self serve/i.test(row.method)){
          c.others++;
        }
      }
      /* Checkpoint every 25 pages to survive failures */
      if (page % 25 === 0){
        consumers = fresh;
        await chrome.storage.local.set({consumers: consumers, washTiers: tiers, plateVisits: pv, plateSiteMap: psm});
        C$("consStatus").textContent = "Checkpoint saved at page " + page + "...";
      }
      if (batch.length < 500) break;
      await new Promise(r => setTimeout(r, 20));
    }
    const vehCut = Date.now() - 45 * 86400000;
    const vehIds = Object.keys(fresh).filter(id => {
      const c = fresh[id];
      return (c.veh || 1) === 1 && ((c.lastWash > vehCut) || (c.lastRenew > vehCut) || (c.lastNew > vehCut));
    });
    if (vehIds.length){
      await fetchVehBatch(vehIds, fresh);
    }
    await fetchIncompletePhones(fresh);
    consumers = fresh;
    await chrome.storage.local.set({washTiers: tiers, plateVisits: pv, plateSiteMap: psm, lastPaymentSync: endStr});
    await consSave();
    C$("consStatus").textContent = "Synced " + list.length + " consumers" + (isIncr ? " (incremental from " + startStr + ")" : " (full history)") + ".";
    renderConsumers();
  } catch(e){
    C$("consStatus").textContent = "Consumer sync failed: " + e.message;
  }
  C$("consSyncBtn").disabled = false;
}

function consPerMonth(c){ const mo = c.signup ? Math.min(12, Math.max((Date.now() - c.signup) / 2592000000, 1)) : 12; return c.washes / (mo * (c.veh || 1)); }

function renderConsumers(){
  const tb = C$("consBody");
  tb.innerHTML = "";
  const sq = (C$("consSearch") ? C$("consSearch").value : "").toLowerCase().replace(/[^a-z0-9+]/g, "");
  const arr = Object.values(consumers).filter(c => {
    if (!sq) return true;
    const n = (c.name || "").toLowerCase();
    const p = (c.phone || "").toLowerCase();
    return n.indexOf(sq) >= 0 || p.indexOf(sq) >= 0;
  });
  if (!arr.length){ tb.innerHTML = "<tr><td colspan=\"8\">No consumers loaded. Press Sync Consumers.</td></tr>"; return; }
  const colVal = (c, col) => {
    if (col === "name") return (c.name || "").toLowerCase();
    if (col === "signup") return c.signup || 0;
    if (col === "cars") return c.veh || 1;
    if (col === "washes") return c.washes || 0;
    if (col === "perMonth") return consPerMonth(c);
    if (col === "others") return c.others || 0;
    if (col === "lastWash") return c.lastWash || 0;
    return 0;
  };
  arr.sort((a, b) => {
    const av = colVal(a, consSortCol), bv = colVal(b, consSortCol);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return consSortAsc ? cmp : -cmp;
  });
  document.querySelectorAll("#consHead th[data-col]").forEach(th => {
    const arrow = th.dataset.col === consSortCol ? (consSortAsc ? " \u25B2" : " \u25BC") : "";
    th.textContent = th.dataset.label + arrow;
  });
  for (const c of arr){
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + cEsc(c.name) + "</td><td>" + consFmtDate(c.signup) + "</td><td>" + (c.veh || 1) + "</td><td>" + c.washes + "</td><td>" + consPerMonth(c).toFixed(1) + "/car</td><td>" + c.others + "</td><td>" + consFmtDate(c.lastWash) + "</td><td><a class=\"via-open\" target=\"_blank\" href=\"" + CBASE + "/consumer/" + c.id + "/\">Open</a></td>";
    tb.appendChild(tr);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  C$("consSyncBtn").addEventListener("click", consSync);
  if (C$("consSearch")) C$("consSearch").addEventListener("input", renderConsumers);
  document.querySelectorAll("#consHead th[data-col]").forEach(th => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      if (consSortCol === th.dataset.col) consSortAsc = !consSortAsc;
      else { consSortCol = th.dataset.col; consSortAsc = th.dataset.col === "name"; }
      renderConsumers();
    });
  });
  await consLoad();
  try { renderConsumers(); } catch(e){ console.warn("renderConsumers failed:", e); }
});
