onReady( () => {
  document.querySelectorAll(".nav-group-toggle").forEach(g => {
    g.addEventListener("click", () => {
      g.closest(".nav-group").classList.toggle("open");
      const firstItem = g.closest(".nav-group").querySelector(".nav-subgroup .nav-btn[data-page]");
      if (firstItem) firstItem.click();
    });
  });

  document.querySelectorAll(".nav-btn[data-page]").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn[data-page]").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      const pg = document.getElementById("page-" + b.dataset.page);
      if (pg) pg.classList.add("active");
    });
  });

  document.querySelectorAll(".nav-subgroup .nav-btn.active").forEach(b => {
    b.closest(".nav-group").classList.add("open");
  });

  /* ── Platform toggles ── */
  const PLAT_MAP = {
    dencar:    { groupLabel: 'Dencar',    pages: ['overview','consumers','via','members','retail','codes'] },
    cryptopay: { groupLabel: 'Cryptopay', pages: ['cp-overview','cryptopay','cp-purchases','cp-projections','cp-statistics'] }
  };

  function applyPlatformToggles(toggles) {
    Object.entries(PLAT_MAP).forEach(([key, cfg]) => {
      const grpBtn = [...document.querySelectorAll('.nav-group-toggle')].find(b => b.textContent.trim() === cfg.groupLabel);
      const grp = grpBtn ? grpBtn.closest('.nav-group') : null;
      if (grp) grp.style.display = toggles[key] ? '' : 'none';
    });
    const hiddenPages = Object.entries(PLAT_MAP)
      .flatMap(([, cfg]) => cfg.pages);
    const activeBtn = document.querySelector('.nav-btn[data-page].active');
    if (activeBtn && hiddenPages.includes(activeBtn.dataset.page)) {
      const fallback = document.querySelector('.nav-btn[data-page="settings"]');
      if (fallback) fallback.click();
    }
  }

  function loadToggles(cb) {
    chrome.storage.local.get('platformToggles', r => {
      cb(Object.assign({ dencar: true, cryptopay: true }, r.platformToggles || {}));
    });
  }

  function saveToggles(t) { chrome.storage.local.set({ platformToggles: t }); }

  loadToggles(t => {
    const dEl = document.getElementById('tog-dencar');
    const cEl = document.getElementById('tog-cryptopay');
    dEl.checked = t.dencar;
    cEl.checked = t.cryptopay;
    applyPlatformToggles(t);

    const onChange = () => {
      const cur = { dencar: dEl.checked, cryptopay: cEl.checked };
      saveToggles(cur);
      applyPlatformToggles(cur);
    };
    dEl.addEventListener('change', onChange);
    cEl.addEventListener('change', onChange);
  });
});
