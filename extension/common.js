const safeFetch = window.safeFetch || fetch;
function wlMoney0(n){ return "$" + Math.round(n || 0).toLocaleString("en-US"); }

function wlDrawChart(cv, hoverIdx){
  const st = cv._wl;
  if (!st) return;
  const vals = st.vals, labels = st.labels;
  const ctx = cv.getContext("2d");
  const W = cv.width = cv.clientWidth || 800;
  const H = cv.height = 220;
  ctx.clearRect(0, 0, W, H);
  const max = Math.max.apply(null, vals.concat([1]));
  const padL = 50, padB = 22, padT = 10;
  ctx.strokeStyle = "#444"; ctx.beginPath();
  ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - 8, H - padB); ctx.stroke();
  ctx.fillStyle = "#888"; ctx.font = "11px sans-serif";
  ctx.fillText(wlMoney0(max), 4, padT + 10);
  ctx.fillText("$0", 4, H - padB);
  const fd = (k) => { const p = k.split("-"); return p.length === 3 ? p[1] + "/" + p[2] : k; };
  ctx.fillText(fd(labels[0]), padL, H - 6);
  ctx.fillText(fd(labels[labels.length - 1]), W - 44, H - 6);
  const xw = (W - padL - 12) / (vals.length - 1);
  const yOf = (v) => H - padB - (v / max) * (H - padB - padT);
  ctx.beginPath();
  for (let i = 0; i < vals.length; i++){
    const x = padL + i * xw;
    if (i === 0) ctx.moveTo(x, yOf(vals[i])); else ctx.lineTo(x, yOf(vals[i]));
  }
  ctx.strokeStyle = "#4da3ff"; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineTo(padL + (vals.length - 1) * xw, H - padB);
  ctx.lineTo(padL, H - padB);
  ctx.closePath();
  ctx.fillStyle = "rgba(77,163,255,0.15)"; ctx.fill();
  if (hoverIdx >= 0 && hoverIdx < vals.length){
    const hx = padL + hoverIdx * xw;
    const hy = yOf(vals[hoverIdx]);
    ctx.strokeStyle = "#999"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx, padT); ctx.lineTo(hx, H - padB); ctx.stroke();
    ctx.fillStyle = "#4da3ff";
    ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
    const txt = fd(labels[hoverIdx]) + "  " + (st.fmt ? st.fmt(vals[hoverIdx]) : wlMoney0(vals[hoverIdx]));
    ctx.font = "12px sans-serif";
    const tw = ctx.measureText(txt).width + 14;
    let bx = hx - tw / 2;
    if (bx < padL) bx = padL;
    if (bx + tw > W - 8) bx = W - 8 - tw;
    const by = padT + 2;
    ctx.fillStyle = "rgba(20,20,20,0.9)";
    ctx.fillRect(bx, by, tw, 20);
    ctx.strokeStyle = "#4da3ff"; ctx.strokeRect(bx, by, tw, 20);
    ctx.fillStyle = "#fff";
    ctx.fillText(txt, bx + 7, by + 14);
  }
}

function wlLineChart(cv, labels, vals, fmt){
  if (!cv || !vals || vals.length < 2) return;
  cv._wl = {labels: labels, vals: vals, fmt: fmt || null};
  wlDrawChart(cv, -1);
  if (!cv._wlBound){
    cv._wlBound = true;
    cv.addEventListener("mousemove", (e) => {
      const st = cv._wl;
      if (!st) return;
      const rect = cv.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (cv.width / rect.width);
      const padL = 50;
      const xw = (cv.width - padL - 12) / (st.vals.length - 1);
      let idx = Math.round((x - padL) / xw);
      if (idx < 0) idx = 0;
      if (idx > st.vals.length - 1) idx = st.vals.length - 1;
      wlDrawChart(cv, idx);
    });
    cv.addEventListener("mouseleave", () => wlDrawChart(cv, -1));
  }
}

function wlTips(containerId, tips){
  const el = document.getElementById(containerId);
  if (!el) return;
  el.querySelectorAll(".stat").forEach(d => {
    const l = d.querySelector("label");
    if (l && tips[l.textContent.trim()]) d.title = tips[l.textContent.trim()];
  });
}

const WL_TIP_MEM_TILES = {
  "Member sales today": "Membership revenue today: New Pass + Pass Renew + New Pass Online + Online Gift Pass + VIA Add.",
  "Member sales yesterday": "Membership revenue yesterday: New Pass + Pass Renew + New Pass Online + Online Gift Pass + VIA Add.",
  "Week to date": "Membership revenue since Sunday (New Pass, Pass Renew, Online Pass, Gift Pass, VIA Add).",
  "Month to date": "Membership revenue since the 1st of this month.",
  "Last month": "Total membership revenue for the previous calendar month.",
  "Member $/wash MTD": "Membership revenue this month divided by member wash uses (Pass Use). What each member wash earns you.",
  "Member $/wash 30d": "Membership revenue over the last 30 days divided by Pass Use washes in the same window.",
  "Pass uses 30d": "Total member washes redeemed across all sites in the last 30 days."
};

const WL_TIP_MEM_ECON = {
  "Active members (vehicles)": "Latest Consumer Vehicles count from each site's daily report, summed. Counts vehicles on plans, so multi-car memberships count more than once.",
  "Monthly churn": "Average Pass Cancelled per month (up to last 3 full months) divided by active member vehicles. Lower is better.",
  "Avg renewal price": "Pass Renew dollars divided by renew count - the average monthly price members actually pay.",
  "Est. avg lifetime": "1 divided by monthly churn. If churn is 5%/month, a typical member stays about 20 months.",
  "Est. LTV": "Lifetime value: avg renewal price x est. lifetime. Expected total revenue from one membership - a guide for how much a new member is worth (e.g. for promos)."
};

const WL_TIP_RETAIL = {
  "Retail today": "Non-member business today: revenue excluding pass/membership sales, and washes excluding Pass Use.",
  "Retail yesterday": "Non-member revenue and washes yesterday.",
  "Week to date": "Retail (non-member) revenue since Sunday.",
  "Month to date": "Retail revenue since the 1st of this month.",
  "Last month": "Total retail revenue for the previous calendar month.",
  "Retail mix 30d": "Retail's share of total revenue over the last 30 days. Shows how dependent you are on retail vs membership.",
  "Retail $/wash 30d": "Retail revenue divided by retail washes over 30d - the average ticket per non-member wash.",
  "Capture rate 30d": "New passes sold divided by retail washes - how well retail traffic converts into members."
};

const WL_TIP_OVERVIEW = {
  "Today": "Total revenue across all Dencar sites for today, from each site's daily report.",
  "Yesterday": "Total revenue across all sites for yesterday - the last full day of data.",
  "Week to date": "Total revenue across all sites since Sunday, through today.",
  "Last week": "Total revenue across all sites for the previous full week, Sunday through Saturday.",
  "Month to date": "Total revenue across all sites since the 1st of this month.",
  "Last month": "Total revenue across all sites for the previous calendar month.",
  "Month projection": "Month to date plus an estimate of the rest of the month. Each remaining day is estimated from the average revenue for that same weekday over the last 8 weeks.",
  "vs last year (MTD)": "Last year's revenue for the same month through the same day of month. The percentage shows how this year's MTD compares.",
  "vs last year (YTD)": "Last year's revenue from Jan 1 through the same day of year. The percentage shows how this year's YTD compares.",
  "Avg use/member 30d": "Pass Use washes over the last 30 days divided by active member vehicles. How often the average member washes per month."
};

const WL_TIP_CP_OVERVIEW = {
  "Today": "Sum of every CryptoPay transaction total (sales tax included) across all sites, for today.",
  "Yesterday": "Same as Today, but for yesterday - the last full day of data.",
  "Week to date": "All-site CryptoPay totals since Sunday, through today.",
  "Last week": "All-site CryptoPay totals for the previous full week, Sunday through Saturday.",
  "Month to date": "All-site CryptoPay totals since the 1st of this month.",
  "Last month": "All-site CryptoPay totals for the previous calendar month.",
  "Month projection": "Month to date plus an estimate of the rest of the month, using the average for each weekday over the last 8 weeks.",
  "vs last year (MTD)": "Last year's CryptoPay revenue for the same month through the same day of month. The percentage shows how this year's MTD compares.",
  "vs last year (YTD)": "Last year's CryptoPay revenue from Jan 1 through the same day of year. The percentage shows how this year's YTD compares.",
  "Avg ticket (30d)": "Revenue divided by transaction count across all sites over the last 30 days. Each swipe is one transaction, even if it covers several items."
};
