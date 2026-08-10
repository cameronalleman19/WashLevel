const CP_BASE = "https://www.mycryptopay.com";
const CP_SCHEMA = 1;

let cpSites = [];
let cpStatus = {};

function cpSetStatus(msg){ $("cryptoStatus").textContent = msg; }

function cpShowSessionBanner(show){
  const b = $("cpSessionBanner");
  if (b) b.hidden = !show;
}

async function cpLoad(){
  const st = await chrome.storage.local.get(["cpSites", "cpStatus", "cpLastSync", "cpSchema"]);
  if (st.cpSchema !== CP_SCHEMA){
    cpStatus = {};
    await chrome.storage.local.set({cpStatus: {}, cpSchema: CP_SCHEMA});
  } else {
    cpStatus = st.cpStatus || {};
  }
  cpSites = st.cpSites || [];
  if (st.cpLastSync) $("cpLastSync").textContent = "Last sync: " + new Date(st.cpLastSync).toLocaleString();
}

async function cpSave(){
  await chrome.storage.local.set({cpSites: cpSites, cpStatus: cpStatus, cpLastSync: Date.now(), cpSchema: CP_SCHEMA});
}

async function cpDiscoverSites(){
  try {
    const res = await fetch(CP_BASE + "/login/index.php?page=sitestatus", {credentials: "include"});
    const html = await res.text();
    if (/type="password"/i.test(html) || !/selection-entry/.test(html)) return {sites: [], loggedOut: true};
    const re = /id="siteselect_([A-Za-z0-9]+)"[^>]*>.*?<span class="site-name">([^<]+)<\/span>/gs;
    const found = [];
    let m;
    while ((m = re.exec(html))) found.push({id: m[1], name: m[2].trim()});
    return {sites: found, loggedOut: false};
  } catch(e){
    return {sites: [], loggedOut: false, error: true};
  }
}

function cpParseDevices(html){
  const doc = new DOMParser().parseFromString(html, "text/html");
  const headers = Array.from(doc.querySelectorAll("h3"));
  const statusHeader = headers.find(h => /CryptoPay Device Status/i.test(h.textContent));
  if (!statusHeader) return [];
  let el = statusHeader.nextElementSibling;
  while (el && el.tagName !== "BLOCKQUOTE") el = el.nextElementSibling;
  if (!el) return [];
  const table = el.querySelector("table");
  if (!table) return [];
  const rows = Array.from(table.querySelectorAll("tr")).slice(1);
  const devices = [];
  for (const row of rows){
    const cells = Array.from(row.children);
    if (cells.length < 4) continue;
    const name = cells[0].textContent.trim();
    const idMatch = cells[1].textContent.match(/ID:\s*([A-Za-z0-9]+)/);
    const deviceId = idMatch ? idMatch[1] : "";
    const status = cells[3].textContent.trim() || "Unknown";
    let activatable = false;
    if (cells.length >= 5){
      const span = cells[4].querySelector('span[onclick*="showRemoteStartConfirm"]');
      if (span) activatable = true;
    }
    if (deviceId) devices.push({name: name, id: deviceId, status: status, activatable: activatable});
  }
  return devices;
}

async function cpFetchStatus(siteId){
  try {
    const res = await fetch(CP_BASE + "/login/api.php?page=sitestatus_inner&siteid=" + siteId, {credentials: "include"});
    const html = await res.text();
    if (/type="password"/i.test(html)) return {devices: [], loggedOut: true};
    return {devices: cpParseDevices(html), loggedOut: false};
  } catch(e){
    return {devices: [], loggedOut: false, error: true};
  }
}

async function cpSync(){
  $("cpSyncBtn").disabled = true;
  cpShowSessionBanner(false);
  cpSetStatus("Discovering sites...");
  const disc = await cpDiscoverSites();
  if (disc.loggedOut){
    cpShowSessionBanner(true);
    cpSetStatus("Not logged in. Log into MyCryptoPay in this browser, then press Sync again.");
    $("cpSyncBtn").disabled = false;
    return;
  }
  if (disc.sites.length) cpSites = disc.sites;
  if (!cpSites.length){
    cpSetStatus("No sites found.");
    $("cpSyncBtn").disabled = false;
    return;
  }
  let done = 0;
  let loggedOutMidSync = false;
  for (const s of cpSites){
    cpSetStatus("Syncing " + (done + 1) + " / " + cpSites.length + " - " + s.name);
    const r = await cpFetchStatus(s.id);
    if (r.loggedOut){ loggedOutMidSync = true; break; }
    cpStatus[s.id] = {name: s.name, devices: r.devices || [], lastUpdated: Date.now()};
    done++;
    await new Promise(res => setTimeout(res, 150));
  }
  await cpSave();
  if (loggedOutMidSync){
    cpShowSessionBanner(true);
    cpSetStatus("Session expired mid-sync. Log in and press Sync again.");
  } else {
    cpSetStatus("Done. Synced " + done + " site" + (done === 1 ? "" : "s") + ".");
  }
  $("cpSyncBtn").disabled = false;
  cpRender();
}

function cpRender(){
  const wrap = $("cpSites");
  if (!wrap) return;
  wrap.innerHTML = "";
  const siteIds = Object.keys(cpStatus);
  if (!siteIds.length){
    wrap.innerHTML = "<p>No data yet. Press Sync.</p>";
    return;
  }
  for (const sid of siteIds){
    const site = cpStatus[sid];
    const div = document.createElement("div");
    div.className = "card";
    let rows = "";
    for (const d of site.devices){
      const statusClass = /connected/i.test(d.status) ? "cp-ok" : "cp-down";
      const actBtn = d.activatable
        ? "<button class=\"cp-activate\" data-site=\"" + sid + "\" data-device=\"" + d.id + "\" data-name=\"" + d.name.replace(/"/g, "&quot;") + "\">Activate</button>"
        : "";
      rows += "<tr><td>" + d.name + "</td><td class=\"" + statusClass + "\">" + d.status + "</td><td>" + actBtn + "</td></tr>";
    }
    div.innerHTML = "<h3>" + site.name + "</h3>" +
      "<table class=\"via\"><thead><tr><th>Device</th><th>Status</th><th></th></tr></thead><tbody>" + rows + "</tbody></table>";
    wrap.appendChild(div);
  }
  Array.from(document.querySelectorAll(".cp-activate")).forEach(btn => {
    btn.addEventListener("click", () => cpActivate(btn.dataset.site, btn.dataset.device, btn.dataset.name));
  });
}

async function cpActivate(siteId, deviceId, deviceName){
  const site = cpStatus[siteId];
  const siteName = site ? site.name : siteId;
  const ok = confirm("Activate " + deviceName + " at " + siteName + "?\n\nThis will immediately start a wash cycle.");
  if (!ok) return;
  cpSetStatus("Activating " + deviceName + "...");
  try {
    const res = await fetch(CP_BASE + "/login/api.php?page=remotestart&siteid=" + siteId + "&deviceid=" + deviceId, {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/x-www-form-urlencoded"}
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch(e){ data = null; }
    if (!data){
      cpShowSessionBanner(true);
      cpSetStatus("Session expired - could not activate. Log in and try again.");
      return;
    }
    if (data.response === "success"){
      cpSetStatus(deviceName + " activated: " + ((data.return && data.return.message) || "Success"));
    } else {
      cpSetStatus(deviceName + " activation failed: " + ((data.return && data.return.message) || JSON.stringify(data)));
    }
  } catch(e){
    cpSetStatus("Network error activating " + deviceName + ".");
  }
}

async function cpInit(){
  await cpLoad();
  cpRender();
  const btn = $("cpSyncBtn");
  if (btn) btn.addEventListener("click", cpSync);
}
document.addEventListener("DOMContentLoaded", cpInit);
