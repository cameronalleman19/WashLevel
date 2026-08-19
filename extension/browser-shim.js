// ============================================================
// WashLevel Sidecar — Browser Compatibility Shim
// Prepend to common.js (or load as first script)
// Provides unified API across Chrome and Safari
// ============================================================

(() => {
  'use strict';

  // Detect environment
  const isSafari = typeof browser !== 'undefined' &&
    typeof browser.runtime !== 'undefined' &&
    /Safari/.test(navigator.userAgent) &&
    !/Chrome/.test(navigator.userAgent);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isMobileViewport = window.innerWidth <= 500;

  // Expose environment flags globally
  window.__sidecar = {
    isSafari,
    isIOS,
    isMobile: isIOS && isMobileViewport,
    isIPad: isIOS && !isMobileViewport,
    platform: isSafari ? (isIOS ? 'ios' : 'macos') : 'chrome'
  };

  // ── chrome.* ↔ browser.* polyfill ──────────────────────────
  // Safari supports both namespaces but browser.* returns Promises
  // (WebExtension standard) while chrome.* uses callbacks.
  // We normalize to chrome.* with callback style since that's
  // what the entire codebase uses, but wrap browser.* where needed.

  if (typeof globalThis.chrome === 'undefined' && typeof globalThis.browser !== 'undefined') {
    // Running in pure browser.* environment — alias chrome to browser
    globalThis.chrome = globalThis.browser;
  }

  // ── Storage wrapper with iOS quota awareness ───────────────
  // iOS Safari enforces ~10MB per extension for storage.local.
  // This wrapper adds quota checking and a fallback to IndexedDB
  // for large payloads if storage.local is full.

  const STORAGE_QUOTA_MB = 10;
  const STORAGE_QUOTA_BYTES = STORAGE_QUOTA_MB * 1024 * 1024;

  // IndexedDB fallback for iOS overflow
  const IDB_NAME = 'SidecarOverflow';
  const IDB_STORE = 'kv';
  let _idb = null;

  function openIDB() {
    if (_idb) return Promise.resolve(_idb);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => {
        _idb = req.result;
        resolve(_idb);
      };
      req.onerror = () => reject(req.error);
    });
  }

  function idbGet(key) {
    return openIDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  function idbSet(key, value) {
    return openIDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }

  function idbRemove(keys) {
    return openIDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      (Array.isArray(keys) ? keys : [keys]).forEach(k => store.delete(k));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }

  // Keys that hold large datasets — candidates for IDB overflow on iOS
  const LARGE_KEYS = new Set([
    'consumers', 'hist', 'viaSeen', 'plateConversions',
    'cpSyncedMonths', 'viaAutoHistory'
  ]);

  if (isIOS && chrome.storage && chrome.storage.local) {
    const originalGet = chrome.storage.local.get.bind(chrome.storage.local);
    const originalSet = chrome.storage.local.set.bind(chrome.storage.local);
    const originalRemove = chrome.storage.local.remove.bind(chrome.storage.local);

    // Wrapped get: try chrome.storage.local first, fall back to IDB
    chrome.storage.local.get = function(keys, callback) {
      originalGet(keys, (result) => {
        if (chrome.runtime.lastError) {
          console.warn('[Sidecar] storage.local.get error:', chrome.runtime.lastError);
        }
        // Check if any requested large keys are missing — try IDB
        const requested = typeof keys === 'string' ? [keys] :
          Array.isArray(keys) ? keys : (keys ? Object.keys(keys) : []);
        const missingLargeKeys = requested.filter(k =>
          LARGE_KEYS.has(k) && result[k] === undefined
        );

        if (missingLargeKeys.length === 0) {
          if (callback) callback(result);
          return;
        }

        // Fetch missing large keys from IDB
        Promise.all(missingLargeKeys.map(k =>
          idbGet(k).then(v => [k, v]).catch(() => [k, undefined])
        )).then(pairs => {
          pairs.forEach(([k, v]) => {
            if (v !== undefined) result[k] = v;
          });
          if (callback) callback(result);
        });
      });
    };

    // Wrapped set: try chrome.storage.local, overflow large keys to IDB
    chrome.storage.local.set = function(items, callback) {
      originalSet(items, () => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message || '';
          if (errMsg.includes('QUOTA') || errMsg.includes('quota') ||
              errMsg.includes('exceeded') || errMsg.includes('full')) {
            console.warn('[Sidecar] storage.local quota hit, overflowing to IndexedDB');
            // Move large keys to IDB
            const largeEntries = Object.entries(items).filter(([k]) => LARGE_KEYS.has(k));
            if (largeEntries.length > 0) {
              Promise.all(largeEntries.map(([k, v]) => idbSet(k, v)))
                .then(() => {
                  // Retry set without the large keys
                  const small = {};
                  Object.entries(items).forEach(([k, v]) => {
                    if (!LARGE_KEYS.has(k)) small[k] = v;
                  });
                  if (Object.keys(small).length > 0) {
                    originalSet(small, callback);
                  } else {
                    if (callback) callback();
                  }
                })
                .catch(err => {
                  console.error('[Sidecar] IDB overflow failed:', err);
                  if (callback) callback();
                });
              return;
            }
          }
        }
        if (callback) callback();
      });
    };

    // Wrapped remove: remove from both storage.local and IDB
    chrome.storage.local.remove = function(keys, callback) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      originalRemove(keys, () => {
        const largeToRemove = keyList.filter(k => LARGE_KEYS.has(k));
        if (largeToRemove.length > 0) {
          idbRemove(largeToRemove).then(() => {
            if (callback) callback();
          }).catch(() => {
            if (callback) callback();
          });
        } else {
          if (callback) callback();
        }
      });
    };
  }

  // ── Tabs API compatibility ─────────────────────────────────
  // Safari iOS doesn't support chrome.tabs.create in popup context
  // the same way — window.open is more reliable for opening URLs
  if (isIOS && chrome.tabs) {
    const originalCreate = chrome.tabs.create;
    chrome.tabs.create = function(opts, callback) {
      try {
        originalCreate.call(chrome.tabs, opts, callback);
      } catch (e) {
        // Fallback: open in new window
        window.open(opts.url, '_blank');
        if (callback) callback(null);
      }
    };
  }

  // ── Service worker keep-alive for iOS ──────────────────────
  // Safari terminates service workers aggressively (~30s idle).
  // This utility lets long-running operations ping to stay alive.
  if (typeof ServiceWorkerGlobalScope !== 'undefined' &&
      self instanceof ServiceWorkerGlobalScope && isSafari) {
    let _keepAliveInterval = null;

    self.__keepAlive = () => {
      if (_keepAliveInterval) return;
      _keepAliveInterval = setInterval(() => {
        // Accessing storage keeps the SW alive
        chrome.storage.local.get('__ping', () => {});
      }, 20000); // Every 20s
    };

    self.__releaseKeepAlive = () => {
      if (_keepAliveInterval) {
        clearInterval(_keepAliveInterval);
        _keepAliveInterval = null;
      }
    };
  }

  // ── Responsive helpers for iOS viewport ────────────────────
  if (isIOS) {
    // Add platform class to body when DOM is ready
    const addPlatformClasses = () => {
      const body = document.body;
      if (!body) return;
      body.classList.add('sidecar-ios');
      if (isMobileViewport) body.classList.add('sidecar-iphone');
      else body.classList.add('sidecar-ipad');
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addPlatformClasses);
    } else {
      addPlatformClasses();
    }
  }

  console.log(`[Sidecar] Platform: ${window.__sidecar.platform}, iOS: ${isIOS}, Mobile: ${isMobileViewport}`);
})();

// ── Safari-safe fetch via content script proxy ───────────────
// On Chrome: regular fetch with credentials.
// On Safari: routes through content script on the target domain's
// tab so the page's session cookies are used.
async function safeFetch(url, opts = {}) {
  if (!window.__sidecar || !window.__sidecar.isSafari) {
    if (!opts.credentials) opts.credentials = 'include';
    return fetch(url, opts);
  }

  const domain = new URL(url).hostname;
  const tabs = await browser.tabs.query({ url: 'https://' + domain + '/*' });
  if (!tabs || tabs.length === 0) {
    throw new Error('Open ' + domain + ' in Safari and log in, then try again.');
  }

  const fetchOpts = {
    method: opts.method || 'GET',
    headers: opts.headers || null,
    body: opts.body || null
  };

  const results = await browser.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: async (fetchUrl, fOpts) => {
      try {
        const r = await fetch(fetchUrl, {
          method: fOpts.method || 'GET',
          credentials: 'include',
          headers: fOpts.headers || undefined,
          body: fOpts.body || undefined
        });
        const text = await r.text();
        return { ok: r.ok, status: r.status, url: r.url, text: text };
      } catch (e) {
        return { ok: false, status: 0, url: fetchUrl, text: '', error: e.message };
      }
    },
    args: [url, fetchOpts]
  });

  const response = results[0].result;
  if (!response) throw new Error('No response from ' + domain + ' tab. Reload it and try again.');
  if (response.error) throw new Error(response.error);

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    text: () => Promise.resolve(response.text),
    json: () => Promise.resolve(JSON.parse(response.text))
  };
}) {
  if (!window.__sidecar || !window.__sidecar.isSafari) {
    if (!opts.credentials) opts.credentials = 'include';
    return fetch(url, opts);
  }

  const domain = new URL(url).hostname;
  let tabs;
  try {
    tabs = await chrome.tabs.query({ url: 'https://' + domain + '/*' });
  } catch (e) {
    tabs = [];
  }
  if (!tabs || tabs.length === 0) {
    throw new Error('Open ' + domain + ' in Safari and log in, then try again.');
  }

  const msg = {
    type: 'SIDECAR_FETCH',
    url: url,
    method: opts.method || 'GET',
    headers: opts.headers || null,
    body: opts.body || null
  };

  try {
    const sendMsg = (typeof browser !== 'undefined' && browser.tabs)
      ? browser.tabs.sendMessage(tabs[0].id, msg)
      : new Promise((res, rej) => chrome.tabs.sendMessage(tabs[0].id, msg, r => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(r)));
    const response = await sendMsg;
    if (!response) {
      throw new Error('No response from ' + domain + ' tab. Reload it and try again.');
    }
    if (response.error) {
      throw new Error(response.error);
    }
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      text: () => Promise.resolve(response.text),
      json: () => Promise.resolve(JSON.parse(response.text))
    };
  } catch (e) {
    throw new Error('Proxy error: ' + e.message + '. Reload the ' + domain + ' tab and try again.');
  }
}
