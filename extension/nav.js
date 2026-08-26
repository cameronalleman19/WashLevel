document.addEventListener("DOMContentLoaded", () => {
  /* Hamburger toggle */
  const hBtn = document.getElementById("hamburgerBtn");
  const sNav = document.getElementById("sideNav");
  const nOvl = document.getElementById("navOverlay");
  if (hBtn && sNav && nOvl) {
    hBtn.addEventListener("click", () => {
      sNav.classList.toggle("open");
      nOvl.classList.toggle("open");
    });
    nOvl.addEventListener("click", () => {
      sNav.classList.remove("open");
      nOvl.classList.remove("open");
    });
  }

  /* group toggles — just expand/collapse, no navigation */
  document.querySelectorAll(".nav-group-toggle").forEach(g => {
    g.addEventListener("click", () => {
      g.closest(".nav-group").classList.toggle("open");
    });
  });

  /* tab buttons — switch page + persist choice */
  document.querySelectorAll(".nav-btn[data-page]").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn[data-page]").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      const pg = document.getElementById("page-" + b.dataset.page);
      if (pg) pg.classList.add("active");
      chrome.storage.local.set({ sidecarActiveTab: b.dataset.page });
      if (sNav) sNav.classList.remove("open");
      if (nOvl) nOvl.classList.remove("open");
    });
  });

  /* restore last active tab on load */
  chrome.storage.local.get("sidecarActiveTab", res => {
    const tab = res.sidecarActiveTab;
    if (!tab) {
      /* no saved tab — just open the group that has the default active button */
      document.querySelectorAll(".nav-subgroup .nav-btn.active").forEach(b => {
        b.closest(".nav-group").classList.add("open");
      });
      return;
    }
    const btn = document.querySelector('.nav-btn[data-page="' + tab + '"]');
    if (btn) {
      /* clear defaults set in HTML */
      document.querySelectorAll(".nav-btn[data-page]").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      const pg = document.getElementById("page-" + tab);
      if (pg) pg.classList.add("active");
    }
    /* open the group containing the restored tab */
    document.querySelectorAll(".nav-subgroup .nav-btn.active").forEach(b => {
      b.closest(".nav-group").classList.add("open");
    });
  });
});
