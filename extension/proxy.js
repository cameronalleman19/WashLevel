// Content script injected into Dencar/CryptoPay pages.
// Proxies fetch requests using the page's session cookies.
// Uses browser.runtime.onMessage with Promise return for Safari compatibility.

const handler = (msg, sender) => {
  if (msg.type !== 'SIDECAR_FETCH') return;

  return (async () => {
    try {
      const opts = { method: msg.method || 'GET', credentials: 'include' };
      if (msg.headers) opts.headers = msg.headers;
      if (msg.body) opts.body = msg.body;
      const res = await fetch(msg.url, opts);
      const text = await res.text();
      return { ok: res.ok, status: res.status, url: res.url, text: text };
    } catch (e) {
      return { ok: false, status: 0, url: msg.url, text: '', error: e.message };
    }
  })();
};

if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener(handler);
} else {
  chrome.runtime.onMessage.addListener(handler);
}
