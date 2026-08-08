const CBASE = "https://admin.dencar.sancsoft.net";
const C$ = (id) => document.getElementById(id);
let consumers = {};

function cEsc(s){ const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
function cNorm(s){ return (s || "").toLowerCase().replace(/[^a-z]/g, ""); }
function cFmtDate(t){ if (!t) return "--"; const d = new Date(t); return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear(); }

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
  for (const r of rows){
    Array.from(r.children).forEach((c, i) => {
      const t = c.textContent.trim().toLowerCase();
      if (c.tagName !== "TH") return;
      if (tsIdx === -1 && /timestamp/.test(t)) tsIdx = i;
      if (lpIdx === -1 && /license|plate/.test(t) && !/confidence/.test(t)) lpIdx = i;
      if (mIdx === -1 && t === "method") mIdx = i;
      if (nIdx === -1 && t === "name") nIdx = i;
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
      name: nIdx >= 0 && cells[nIdx] ? cells[nIdx].textContent.replace(/\s+/g, " ").trim() : ""
    });
  }
  return out;
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
      await new Promise(r => setTimeout(r, 150));
    }
    if (!list.length){ C$("consStatus").textContent = "No consumers found - are you logged into Dencar?"; C$("consSyncBtn").disabled = false; return; }
    const byName = {};
    const fresh = {};
    for (const c of list){
      fresh[c.id] = {id: c.id, name: c.name, signup: c.signup, washes: 0, others: 0, lastWash: 0};
      const k = cNorm(c.name);
      if (k) byName[k] = fresh[c.id];
    }
    const end = new Date();
    const start = new Date(end); start.setMonth(start.getMonth() - 12);
    const startStr = start.toLocaleDateString("en-CA");
    const endStr = end.toLocaleDateString("en-CA");
    for (let page = 1; page <= 40; page++){
      C$("consStatus").textContent = "Loading payments page " + page + "...";
      const batch = await fetchPaymentsPage(page, startStr, endStr);
      for (const row of batch){
        const c = byName[cNorm(row.name)];
        if (!c) continue;
        if (row.lp && row.lp !== "N/A" && row.lp !== "-"){
          c.washes++;
          if (row.t > c.lastWash) c.lastWash = row.t;
        } else if (/vac|self serve/i.test(row.method)){
          c.others++;
        }
      }
      if (batch.length < 500) break;
      await new Promise(r => setTimeout(r, 150));
    }
    consumers = fresh;
    await consSave();
    C$("consStatus").textContent = "Synced " + list.length + " consumers.";
    renderConsumers();
  } catch(e){
    C$("consStatus").textContent = "Consumer sync failed: " + e.message;
  }
  C$("consSyncBtn").disabled = false;
}

function consPerMonth(c){ const mo = c.signup ? Math.min(12, Math.max((Date.now() - c.signup) / 2592000000, 1)) : 12; return c.washes / mo; }

function renderConsumers(){
  const tb = C$("consBody");
  tb.innerHTML = "";
  const mode = C$("consSort").value;
  const arr = Object.values(consumers);
  if (!arr.length){ tb.innerHTML = "<tr><td colspan=\"7\">No consumers loaded. Press Sync Consumers.</td></tr>"; return; }
  arr.sort((a, b) => {
    if (mode === "recent") return (b.signup || 0) - (a.signup || 0);
    if (mode === "usageHigh") return consPerMonth(b) - consPerMonth(a);
    return consPerMonth(a) - consPerMonth(b);
  });
  for (const c of arr){
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + cEsc(c.name) + "</td><td>" + cFmtDate(c.signup) + "</td><td>" + c.washes + "</td><td>" + consPerMonth(c).toFixed(1) + "</td><td>" + c.others + "</td><td>" + cFmtDate(c.lastWash) + "</td><td><a class=\"via-open\" target=\"_blank\" href=\"" + CBASE + "/consumer/" + c.id + "/\">Open</a></td>";
    tb.appendChild(tr);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await consLoad();
  renderConsumers();
  C$("consSyncBtn").addEventListener("click", consSync);
  C$("consSort").addEventListener("change", renderConsumers);
});
