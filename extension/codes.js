/* codes.js – Wash Codes tab */

const WASH_TIERS = [
  {name:'Platinum Wash', id:'bace3dcf-4f01-44f7-96dd-cd1e80c2952c'},
  {name:'Gold Wash',     id:'227316fa-af47-4811-8992-949be9c35fe3'},
  {name:'Silver Wash',   id:'170c2796-cb17-4fcb-87e5-d9f778df1cc0'},
  {name:'Bronze Wash',   id:'6db6b50e-f031-4fa8-b706-08df3ad5cd9f'}
];
const WASH_TIERS_MORE = [
  {name:'Pet Wash',       id:'c45c20e0-86c6-4e54-8e76-c44fa1b153e8'},
  {name:'Self Serve',     id:'47c094b6-7c08-4551-b961-d7cda52eadf4'},
  {name:'Vacuum',         id:'fbe4d05c-3857-4465-8f45-b1df38fa08f1'},
  {name:'Vending Machine',id:'ed45d953-2ac0-4fc3-bb77-577e0504b46d'},
  {name:'Door Lock',      id:'d0f62307-ae9b-4156-8638-4def14d2b3f2'},
  {name:'Laundry',        id:'8b95cce2-36e2-4905-ba24-69fb03e4d700'},
  {name:'Tire Air',       id:'29978005-938f-4a88-9b66-15befe423cb3'},
  {name:'Towel',          id:'abfe53c9-2bb6-4b9a-a797-34b85132ee54'},
  {name:'Other',          id:'f8fd63c6-c869-444f-bc91-b0e30e5ff29e'},
  {name:'Other 2',        id:'98112523-6820-4528-a6be-89cb8fc195f9'}
];

var codesCache = [];
var codesInited = false;

/* ── helpers ── */
function cFmtDate(d){
  var y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'),
      dd=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+dd;
}
function cParseDate(s){
  if(!s || s==='N/A') return null;
  if(s.includes('/')){
    var p=s.split('/'); return new Date(+p[2],+p[0]-1,+p[1]);
  }
  return new Date(s);
}
function cAddMonths(d,n){ var r=new Date(d); r.setMonth(r.getMonth()+n); return r; }

/* ── fetch CSRF + CustomerId from Dencar page ── */
async function cGetFormTokens(){
  var resp = await fetch('https://admin.dencar.sancsoft.net/bulkwashcodes/?nonAdmin=true',
    {credentials:'include'});
  var html = await resp.text();
  var doc = new DOMParser().parseFromString(html,'text/html');
  var createForm = doc.querySelector('form[action*="create"]');
  var token = createForm ?
    createForm.querySelector('input[name="__RequestVerificationToken"]')?.value : null;
  var custId = '';
  doc.querySelectorAll('input[name="CustomerId"]').forEach(function(el){ if(el.value) custId = el.value; });
  return {token:token, custId:custId};
}

/* ── create a code on Dencar ── */
async function cCreateCode(opts){
  var tokens = await cGetFormTokens();
  if(!tokens.token||!tokens.custId) throw new Error('Could not get form tokens \u2014 are you logged in to Dencar?');

  var bottom, top;
  if(opts.code != null){
    bottom = String(opts.code);
    top = String(Number(opts.code)+1);
  } else {
    bottom = '1000000'; top = '99999999';
  }

  var fd = new URLSearchParams();
  fd.append('CustomerId', tokens.custId);
  fd.append('BottomRange', bottom);
  fd.append('TopRange', top);
  fd.append('Count', '1');
  fd.append('GroupName', opts.groupName);
  fd.append('WashDiscount', '0.00');
  fd.append('ExpDate', opts.expDate);
  fd.append('WashCodeState', '0');
  fd.append('ProductTemplateId', opts.tierId);
  fd.append('UpgradePrompt', 'false');
  fd.append('UpgradeAmount', '0');
  fd.append('__RequestVerificationToken', tokens.token);

  var resp = await fetch('https://admin.dencar.sancsoft.net/bulkwashcodes/create/', {
    method:'POST', credentials:'include',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: fd.toString()
  });

  var html = await resp.text();
  var doc = new DOMParser().parseFromString(html,'text/html');
  var codes = cParseCodesFromDoc(doc);

  if(opts.code != null){
    return codes.find(function(c){return c.passCode === String(opts.code)}) || codes[0];
  }
  var gn = opts.groupName;
  var match = codes.filter(function(c){return c.groupName === gn});
  return match[0] || codes[0];
}

/* ── parse codes from a Dencar HTML document ── */
function cParseCodesFromDoc(doc){
  var codes = [];
  doc.querySelectorAll('[id^="BulkWashCodes-"]').forEach(function(panel){
    var code = {};
    panel.querySelectorAll('strong').forEach(function(s){
      var lbl = s.textContent.trim();
      var val = s.nextElementSibling ? s.nextElementSibling.textContent.trim() : '';
      switch(lbl){
        case 'Id': code.id=val; break;
        case 'State': code.state=val; break;
        case 'Pass Code': code.passCode=val; break;
        case 'Timestamp': code.created=val; break;
        case 'Exp. Date': code.expDate=val; break;
        case 'Redeem Date': code.redeemDate=val; break;
        case 'Product Template': code.template=val; break;
      }
    });
    var uuid = panel.id.replace('BulkWashCodes-','');
    var hdr = doc.querySelector('[data-bs-target="#BulkWashCodes-'+uuid+'"] span');
    if(hdr){
      var parts = hdr.textContent.trim().split(' - ');
      code.groupName = parts[0] ? parts[0].trim() : '';
    }
    if(code.passCode) codes.push(code);
  });
  return codes;
}

/* ── fetch ALL codes with pagination ── */
async function cFetchAllCodes(statusCb){
  var allCodes = [];
  var page = 1, totalPages = 1;

  while(page <= totalPages){
    if(statusCb) statusCb('Loading page '+page+(totalPages>1?' of '+totalPages:'')+'...');
    var url = 'https://admin.dencar.sancsoft.net/bulkwashcodes/?nonAdmin=true&CurrentPage='+page;
    var resp = await fetch(url, {credentials:'include'});
    var html = await resp.text();
    var doc = new DOMParser().parseFromString(html,'text/html');

    allCodes.push.apply(allCodes, cParseCodesFromDoc(doc));

    doc.querySelectorAll('.pagination .pagination-page-btn').forEach(function(btn){
      var n = parseInt(btn.textContent.trim());
      if(!isNaN(n) && n > totalPages) totalPages = n;
    });
    page++;
  }
  /* deduplicate by UUID */
  var seen = {};
  allCodes = allCodes.filter(function(c){
    var key = c.id || c.passCode;
    if(seen[key]) return false;
    seen[key] = true;
    return true;
  });
  codesCache = allCodes;
  return allCodes;
}

/* ══════════════════════════════════════════════
   INIT — runs once, builds static shell + events
   ══════════════════════════════════════════════ */
function codesInit(){
  if(codesInited) return;
  codesInited = true;

  var body = document.getElementById('codesBody');
  if(!body) return;

  var tierOpts = WASH_TIERS.map(function(t){
    return '<option value="'+t.id+'">'+t.name+'</option>';
  }).join('');
  var moreOpts = WASH_TIERS_MORE.map(function(t){
    return '<option value="'+t.id+'">'+t.name+'</option>';
  }).join('');
  var defExp = cFmtDate(cAddMonths(new Date(),3));

  body.innerHTML =
  /* ── create form ── */
  '<h2>Generate Code</h2>'
  +'<div class="card" style="margin-bottom:14px">'
  +'<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end">'
  +'<div>'
  +'<label class="stat"><label>Code Type</label></label>'
  +'<div style="display:flex;gap:6px;margin-top:6px">'
  +'<button class="cTypeBtn active" data-type="random">Random</button>'
  +'<button class="cTypeBtn" data-type="custom" style="background:#182640">Custom</button>'
  +'</div></div>'
  +'<div id="cCustomWrap" style="display:none">'
  +'<label class="stat"><label>Code Number</label></label>'
  +'<input id="cCustomCode" type="number" min="1000000" max="99999998" placeholder="e.g. 5551234" class="c-input" style="margin-top:6px">'
  +'</div>'
  +'<div>'
  +'<label class="stat"><label>Label</label></label>'
  +'<input id="cLabel" type="text" placeholder="e.g. John Smith" class="c-input" style="margin-top:6px;width:170px">'
  +'</div>'
  +'<div>'
  +'<label class="stat"><label>Wash Tier</label></label>'
  +'<select id="cTier" class="c-input" style="margin-top:6px">'
  +tierOpts+'<optgroup label="Other">'+moreOpts+'</optgroup>'
  +'</select></div>'
  +'<div>'
  +'<label class="stat"><label>Expiration</label></label>'
  +'<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">'
  +'<button class="cExpBtn" data-months="1" style="background:#182640;padding:6px 10px;font-size:13px">1 mo</button>'
  +'<button class="cExpBtn" data-months="2" style="background:#182640;padding:6px 10px;font-size:13px">2 mo</button>'
  +'<button class="cExpBtn active" data-months="3" style="padding:6px 10px;font-size:13px">3 mo</button>'
  +'<button class="cExpBtn" data-months="12" style="background:#182640;padding:6px 10px;font-size:13px">1 yr</button>'
  +'<button class="cExpBtn" data-months="120" style="background:#182640;padding:6px 10px;font-size:13px">No Exp</button>'
  +'</div>'
  +'<input id="cExpDate" type="date" value="'+defExp+'" class="c-input" style="margin-top:6px">'
  +'</div>'
  +'<div><button id="cGenBtn" style="background:#16a34a;padding:10px 24px;font-size:15px;font-weight:600">Generate</button></div>'
  +'</div>'
  +'<div id="cResult" style="display:none;margin-top:12px;border-radius:8px;padding:10px 14px;font-size:14px"></div>'
  +'</div>'

  /* ── data containers (updated without touching the form) ── */
  +'<div id="cTilesWrap"></div>'
  +'<div id="cRedeemWrap"></div>'
  +'<div id="cTierWrap"></div>'

  +'<h2>All Codes</h2>'
  +'<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap">'
  +'<button class="cFilterBtn active" data-filter="">All</button>'
  +'<button class="cFilterBtn" data-filter="Active" style="background:#182640">Active</button>'
  +'<button class="cFilterBtn" data-filter="Used" style="background:#182640">Redeemed</button>'
  +'<button class="cFilterBtn" data-filter="Expired" style="background:#182640">Expired</button>'
  +'<button id="cRefreshBtn" style="background:#182640;margin-left:auto">\u21BB Refresh</button>'
  +'</div>'
  +'<div id="cListWrap"></div>';

  /* ── bind events once ── */
  cBindEvents();

  /* ── initial data load ── */
  codesRefreshData();
}

/* ══════════════════════════════════════════════
   REFRESH DATA — fetches codes, updates data containers only
   ══════════════════════════════════════════════ */
async function codesRefreshData(){
  var status = document.getElementById('cListWrap');
  if(status) status.innerHTML = '<div style="color:#ffd166;padding:8px">Loading codes...</div>';

  try {
    var codes = await cFetchAllCodes(function(msg){
      if(status) status.innerHTML = '<div style="color:#ffd166;padding:8px">'+msg+'</div>';
    });

    /* update tiles */
    var tw = document.getElementById('cTilesWrap');
    if(tw) tw.innerHTML = cRenderMetrics(codes);

    /* update time-to-redeem */
    var rw = document.getElementById('cRedeemWrap');
    if(rw) rw.innerHTML = cRenderTimeToRedeem(codes);

    /* update tier breakdown */
    var trw = document.getElementById('cTierWrap');
    if(trw) trw.innerHTML = cRenderTierBreakdown(codes);

    /* update filter button counts */
    var ac = codes.filter(function(c){return c.state==='Active'}).length;
    var uc = codes.filter(function(c){return c.state==='Used'}).length;
    var ec = codes.filter(function(c){return c.state==='Expired'}).length;
    document.querySelectorAll('.cFilterBtn').forEach(function(btn){
      var f = btn.dataset.filter;
      if(f==='') btn.textContent = 'All ('+codes.length+')';
      else if(f==='Active') btn.textContent = 'Active ('+ac+')';
      else if(f==='Used') btn.textContent = 'Redeemed ('+uc+')';
      else if(f==='Expired') btn.textContent = 'Expired ('+ec+')';
    });

    /* update list with current filter */
    var activeFilter = document.querySelector('.cFilterBtn.active');
    var filter = activeFilter ? (activeFilter.dataset.filter || null) : null;
    var lw = document.getElementById('cListWrap');
    if(lw) lw.innerHTML = cBuildTable(codesCache, filter);

  } catch(e){
    if(status) status.innerHTML = '<div style="color:#f87171;padding:8px">Error: '+e.message+'</div>';
  }
}

/* ── render helpers (return HTML strings) ── */

function cRenderMetrics(codes){
  var total = codes.length;
  var active = codes.filter(function(c){return c.state==='Active'}).length;
  var redeemed = codes.filter(function(c){return c.state==='Used'}).length;
  var expired = codes.filter(function(c){return c.state==='Expired'}).length;
  var rate = total>0 ? (redeemed/total*100).toFixed(1) : '0.0';

  var redeemDays = [];
  codes.forEach(function(c){
    if(c.state==='Used' && c.redeemDate && c.redeemDate!=='N/A' && c.created){
      var cr = cParseDate(c.created), rd = cParseDate(c.redeemDate);
      if(cr && rd){
        var days = Math.round((rd-cr)/86400000);
        if(days>=0) redeemDays.push(days);
      }
    }
  });
  var avgDays = redeemDays.length>0 ?
    (redeemDays.reduce(function(a,b){return a+b},0)/redeemDays.length).toFixed(0) : '\u2014';

  return '<div class="summary">'
    +'<div class="stat"><label>Total Codes</label><div>'+total+'</div></div>'
    +'<div class="stat"><label>Active</label><div style="color:#4ade80">'+active+'</div></div>'
    +'<div class="stat"><label>Redeemed</label><div style="color:#60a5fa">'+redeemed+'</div></div>'
    +'<div class="stat"><label>Expired</label><div style="color:#f87171">'+expired+'</div></div>'
    +'<div class="stat"><label>Redemption Rate</label><div>'+rate+'%</div></div>'
    +'<div class="stat"><label>Avg Days to Redeem</label><div>'+avgDays+'</div></div>'
    +'</div>';
}

function cRenderTimeToRedeem(codes){
  var buckets = [
    {label:'< 1 week', max:7, count:0},
    {label:'1\u20132 weeks', max:14, count:0},
    {label:'2\u20134 weeks', max:28, count:0},
    {label:'1\u20133 months', max:90, count:0},
    {label:'3+ months', max:Infinity, count:0}
  ];
  var total = 0;
  codes.forEach(function(c){
    if(c.state!=='Used' || !c.redeemDate || c.redeemDate==='N/A' || !c.created) return;
    var cr=cParseDate(c.created), rd=cParseDate(c.redeemDate);
    if(!cr||!rd) return;
    var days = Math.round((rd-cr)/86400000);
    if(days<0) return;
    total++;
    for(var i=0;i<buckets.length;i++){
      if(days<buckets[i].max){ buckets[i].count++; break; }
    }
  });
  if(total===0) return '';

  var bars = '';
  buckets.forEach(function(b){
    var pct = total>0 ? (b.count/total*100).toFixed(0) : '0';
    var w = Math.max(b.count/total*100, 1);
    bars += '<div style="display:flex;align-items:center;gap:10px;margin:6px 0">'
      +'<span style="width:100px;font-size:13px;color:#8fa3c0;text-align:right">'+b.label+'</span>'
      +'<div style="flex:1;background:#10192b;border-radius:6px;height:22px">'
      +'<div style="width:'+w+'%;background:#1f4393;border-radius:6px;height:100%;min-width:30px;'
      +'display:flex;align-items:center;padding-left:8px;font-size:12px;color:#eaeef5;font-weight:600">'
      +b.count+' ('+pct+'%)</div></div></div>';
  });

  return '<h2>Time to Redemption</h2><div class="card">'+bars+'</div>';
}

function cRenderTierBreakdown(codes){
  var tierMap = {};
  codes.forEach(function(c){
    var t = c.template || 'Unknown';
    if(!tierMap[t]) tierMap[t] = {total:0, redeemed:0};
    tierMap[t].total++;
    if(c.state==='Used') tierMap[t].redeemed++;
  });
  var keys = Object.keys(tierMap);
  if(keys.length===0) return '';

  keys.sort(function(a,b){ return tierMap[b].total - tierMap[a].total; });

  var rows = '';
  keys.forEach(function(k){
    var d = tierMap[k];
    var rate = d.total>0 ? (d.redeemed/d.total*100).toFixed(0)+'%' : '0%';
    rows += '<tr><td>'+k+'</td>'
      +'<td style="text-align:center">'+d.total+'</td>'
      +'<td style="text-align:center">'+d.redeemed+'</td>'
      +'<td style="text-align:center">'+rate+'</td></tr>';
  });

  return '<h2>Codes by Wash Tier</h2>'
    +'<table class="via"><thead><tr>'
    +'<th>Tier</th><th style="text-align:center">Total</th>'
    +'<th style="text-align:center">Redeemed</th><th style="text-align:center">Rate</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>';
}

function cBuildTable(codes, filter){
  var list = filter ? codes.filter(function(c){return c.state===filter}) : codes.slice();
  if(list.length===0) return '<div class="card" style="color:#8fa3c0">No codes found.</div>';

  list.sort(function(a,b){
    var da=cParseDate(a.created), db=cParseDate(b.created);
    if(!da||!db) return 0;
    return db-da;
  });

  var t = '<table class="via"><thead><tr>'
    +'<th>Code #</th><th>Label</th><th>Wash Tier</th><th>Status</th>'
    +'<th>Created</th><th>Expires</th><th>Redeemed</th>'
    +'</tr></thead><tbody>';

  list.forEach(function(c){
    var lbl = c.state==='Used' ? 'Redeemed' : c.state;
    var cls = c.state==='Used' ? 'style="color:#60a5fa;font-weight:700"' :
              c.state==='Active' ? 'style="color:#4ade80;font-weight:700"' :
              'style="color:#f87171;font-weight:700"';
    var rd = (c.redeemDate && c.redeemDate!=='N/A') ? c.redeemDate : '';
    t += '<tr>'
      +'<td style="font-family:monospace;font-size:14px;letter-spacing:.5px">'+c.passCode+'</td>'
      +'<td>'+(c.groupName||'')+'</td>'
      +'<td>'+(c.template||'')+'</td>'
      +'<td><span '+cls+'>'+lbl+'</span></td>'
      +'<td>'+(c.created||'')+'</td>'
      +'<td>'+(c.expDate||'')+'</td>'
      +'<td>'+rd+'</td></tr>';
  });

  return t+'</tbody></table>';
}

/* ── bind UI events (called once) ── */
function cBindEvents(){
  /* code type toggle */
  document.querySelectorAll('.cTypeBtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.cTypeBtn').forEach(function(b){
        b.classList.remove('active'); b.style.background='#182640';
      });
      btn.classList.add('active'); btn.style.background='';
      document.getElementById('cCustomWrap').style.display =
        btn.dataset.type==='custom' ? '' : 'none';
    });
  });

  /* expiration quick-picks */
  document.querySelectorAll('.cExpBtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.cExpBtn').forEach(function(b){
        b.classList.remove('active'); b.style.background='#182640';
      });
      btn.classList.add('active'); btn.style.background='';
      var months = parseInt(btn.dataset.months);
      document.getElementById('cExpDate').value = cFmtDate(cAddMonths(new Date(), months));
    });
  });

  /* generate */
  document.getElementById('cGenBtn').addEventListener('click', async function(){
    var genBtn = document.getElementById('cGenBtn');
    var result = document.getElementById('cResult');
    var activeType = document.querySelector('.cTypeBtn.active');
    var isCustom = activeType && activeType.dataset.type === 'custom';
    var label = document.getElementById('cLabel').value.trim();
    var tierId = document.getElementById('cTier').value;
    var expDate = document.getElementById('cExpDate').value;

    if(!label){ alert('Please enter a label for the code.'); return; }
    if(!expDate){ alert('Please select an expiration date.'); return; }

    var customCode = null;
    if(isCustom){
      customCode = parseInt(document.getElementById('cCustomCode').value);
      if(isNaN(customCode)||customCode<1000000||customCode>99999998){
        alert('Custom code must be between 1,000,000 and 99,999,998.'); return;
      }
    }

    genBtn.disabled = true; genBtn.textContent = 'Generating...';
    result.style.display = 'none';

    try {
      var newCode = await cCreateCode({
        code:customCode, groupName:label, tierId:tierId, expDate:expDate
      });
      result.style.display = '';
      if(newCode && newCode.passCode){
        result.style.background = '#14532d';
        result.innerHTML = '\u2705 Code generated: '
          +'<strong style="font-size:20px;font-family:monospace;letter-spacing:1px">'
          +newCode.passCode+'</strong> \u2014 '
          +(newCode.template||'')+' \u2014 Expires '
          +(newCode.expDate||expDate);
      } else {
        result.style.background = '#14532d';
        result.innerHTML = '\u2705 Code created successfully.';
      }
      document.getElementById('cLabel').value = '';
      codesRefreshData();
    } catch(e){
      result.style.display = '';
      result.style.background = '#7f1d1d';
      result.innerHTML = '\u274C Error: '+e.message;
    }
    genBtn.disabled = false; genBtn.textContent = 'Generate';
  });

  /* filter buttons */
  document.querySelectorAll('.cFilterBtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.cFilterBtn').forEach(function(b){
        b.classList.remove('active'); b.style.background='#182640';
      });
      btn.classList.add('active'); btn.style.background='';
      document.getElementById('cListWrap').innerHTML =
        cBuildTable(codesCache, btn.dataset.filter || null);
    });
  });

  /* refresh */
  document.getElementById('cRefreshBtn').addEventListener('click', function(){
    codesRefreshData();
  });
}

/* ── auto-init when Codes page first becomes visible ── */
(function(){
  var pg = document.getElementById('page-codes');
  if(!pg) return;
  var obs = new MutationObserver(function(){
    if(pg.classList.contains('active') && !codesInited) codesInit();
  });
  obs.observe(pg, {attributes:true, attributeFilter:['class']});
})();
