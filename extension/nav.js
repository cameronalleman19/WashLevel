document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      const pg = document.getElementById("page-" + b.dataset.page);
      if (pg) pg.classList.add("active");
    });
  });
});
