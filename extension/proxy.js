chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'SIDECAR_FETCH') return false;
  (async () => {
    try {
      const opts = { method: msg.method || 'GET', credentials: 'include' };
      if (msg.headers) opts.headers = msg.headers;
      if (msg.body) opts.body = msg.body;
      const res = await fetch(msg.url, opts);
      const text = await res.text();
      sendResponse({ ok: res.ok, status: res.status, url: res.url, text: text });
    } catch (e) {
      sendResponse({ ok: false, status: 0, url: msg.url, text: '', error: e.message });
    }
  })();
  return true;
});
