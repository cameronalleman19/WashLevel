const SIDECAR_API_BASE = "https://washlevel.com/api/sidecar";
const SIDECAR_OWNER_KEY = "WLSC-OWNER-CAM1-2026";
const SIDECAR_CACHE_MS = 24 * 60 * 60 * 1000;
const SIDECAR_SYNC_BTN_IDS = ["syncBtn", "consSyncBtn", "viaSyncBtn"];

let sidecarLicenseState = null;

document.addEventListener("click", function (e) {
  const btn = e.target.closest && e.target.closest("#syncBtn, #consSyncBtn, #viaSyncBtn");
  if (!btn) return;
  if (sidecarLicenseState && !sidecarLicenseState.valid) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const banner = document.getElementById("licenseBanner");
    if (banner) {
      banner.hidden = false;
      banner.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}, true);

async function licGetKey() {
  const st = await chrome.storage.local.get(["sidecarLicenseKey"]);
  return (st.sidecarLicenseKey || "").trim().toUpperCase();
}

async function licSetKey(key) {
  const clean = (key || "").trim().toUpperCase();
  await chrome.storage.local.set({ sidecarLicenseKey: clean, sidecarLicenseState: null });
  return clean;
}

async function licGetCachedState() {
  const st = await chrome.storage.local.get(["sidecarLicenseState"]);
  return st.sidecarLicenseState || null;
}

async function licSaveState(state) {
  await chrome.storage.local.set({ sidecarLicenseState: state });
}

async function licFetchValidate(key) {
  const url = SIDECAR_API_BASE + "/validate?key=" + encodeURIComponent(key);
  const res = await fetch(url);
  const json = await res.json();
  return {
    key: key,
    valid: !!json.valid,
    plan: json.plan || null,
    status: json.status || null,
    reason: json.reason || null,
    checkedAt: Date.now(),
  };
}

async function licValidate(key, opts) {
  opts = opts || {};
  if (!key) {
    return { key: "", valid: false, plan: null, status: null, reason: "no-key", checkedAt: Date.now() };
  }
  if (key === SIDECAR_OWNER_KEY) {
    const state = { key: key, valid: true, plan: "owner", status: "owner", reason: null, checkedAt: Date.now() };
    await licSaveState(state);
    return state;
  }
  const cached = await licGetCachedState();
  const fresh = cached && cached.key === key && Date.now() - cached.checkedAt < SIDECAR_CACHE_MS;
  if (fresh && !opts.force) return cached;

  try {
    const state = await licFetchValidate(key);
    await licSaveState(state);
    return state;
  } catch (e) {
    if (cached && cached.key === key) return Object.assign({}, cached, { stale: true });
    return { key: key, valid: false, plan: null, status: null, reason: "network-error", checkedAt: Date.now() };
  }
}

function licApplyGate(state) {
  sidecarLicenseState = state;
  const banner = document.getElementById("licenseBanner");
  if (banner) banner.hidden = !!(state && state.valid);
  SIDECAR_SYNC_BTN_IDS.forEach(function (id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (state && state.valid) {
      btn.style.opacity = "";
      btn.style.cursor = "";
      btn.title = "";
    } else {
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
      btn.title = "Sidecar license required — see Settings";
    }
  });
}

function licRenderSettings(state) {
  const statusEl = document.getElementById("licStatus");
  if (!statusEl) return;
  const keyInput = document.getElementById("licKeyInput");
  const planEl = document.getElementById("licPlan");
  const portalBtn = document.getElementById("licPortalBtn");

  if (keyInput && !keyInput.value && state && state.key) keyInput.value = state.key;

  if (!state || !state.key) {
    statusEl.textContent = "No license key";
    if (planEl) planEl.textContent = "--";
  } else if (state.valid) {
    statusEl.textContent = state.plan === "owner" ? "Owner access" : "Active" + (state.status ? " (" + state.status + ")" : "");
    if (planEl) planEl.textContent = state.plan || "--";
  } else {
    statusEl.textContent = "Not active" + (state.reason ? " (" + state.reason + ")" : "");
    if (planEl) planEl.textContent = state.plan || "--";
  }

  if (portalBtn) {
    const showPortal = !!(state && state.key && state.plan !== "owner" && state.reason !== "not-found" && state.reason !== "no-key");
    portalBtn.hidden = !showPortal;
  }
}

async function ensureLicense(opts) {
  const key = await licGetKey();
  const state = await licValidate(key, opts || {});
  licRenderSettings(state);
  licApplyGate(state);
  return state;
}

async function licOpenPortal() {
  const msgEl = document.getElementById("licPortalMsg");
  const key = await licGetKey();
  if (!key || key === SIDECAR_OWNER_KEY) return;
  if (msgEl) msgEl.textContent = "Opening billing portal...";
  try {
    const res = await fetch(SIDECAR_API_BASE + "/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key }),
    });
    const json = await res.json();
    if (json.url) {
      window.open(json.url, "_blank");
      if (msgEl) msgEl.textContent = "";
    } else {
      if (msgEl) msgEl.textContent = "Couldn't open billing portal. Call (717) 966-1794 for help.";
    }
  } catch (e) {
    if (msgEl) msgEl.textContent = "Couldn't open billing portal. Call (717) 966-1794 for help.";
  }
}

const licSaveBtnEl = document.getElementById("licSaveBtn");
if (licSaveBtnEl) {
  licSaveBtnEl.addEventListener("click", async function () {
    const input = document.getElementById("licKeyInput");
    const msgEl = document.getElementById("licMsg");
    const key = input ? input.value : "";
    await licSetKey(key);
    if (msgEl) msgEl.textContent = "Checking...";
    const state = await ensureLicense({ force: true });
    if (msgEl) {
      msgEl.textContent = state.valid
        ? "License active."
        : "Key not active" + (state.reason ? " (" + state.reason + ")" : "") + ". Check the key or call (717) 966-1794.";
    }
  });
}

const licPortalBtnEl = document.getElementById("licPortalBtn");
if (licPortalBtnEl) licPortalBtnEl.addEventListener("click", licOpenPortal);

ensureLicense();
