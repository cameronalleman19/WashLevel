document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-group-toggle").forEach(g => {
    g.addEventListener("click", () => {
      g.closest(".nav-group").classList.toggle("open");
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
});
