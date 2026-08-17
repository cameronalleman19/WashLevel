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

let codesCache = [];
let codesLoaded = false;

/* ── helpers ── */
function cFmtDate(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'),
        dd=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+dd;
}
function cParseDate(s){
  if(!s || s==='N/A') return null;
  if(s.includes('/')){
    const p=s.split('/'); return new Date(+p[2],+p[0]-1,+p[1]);
  }
  return new Date(s);
}
function cAddMonths(d,n){ const r=new Date(d); r.setMonth(r.getMonth()+n); return r; }

/* ── fetch CSRF + CustomerId from Dencar page ── */
async function cGetFormTokens(){
  const resp = await fetch('https://admin.dencar.sancsoft.net/bulkwashcodes/?nonAdmin=true',
    {credentials:'include'});
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html,'text/html');
  const createForm = doc.querySelector('form[action*="create"]');
  const token = createForm ?
    createForm.querySelector('input[name="__RequestVerificationToken"]')?.value : null;
  const custId = doc.querySelector('input[name="CustomerId"]')?.value;
  return {token, custId};
}

/* ── create a code on Dencar ── */
async function cCreateCode(opts){
  const {token, custId} = await cGetFormTokens();
  if(!token||!custId) throw new Error('Could not get form tokens — are you logged in to Dencar?');

  let bottom, top;
  if(opts.code != null){
    bottom = String(opts.code);
    top = String(Number(opts.code)+1);
  } else {
    bottom = '1000000'; top = '99999999';
  }

  const fd = new URLSearchParams();
  fd.append('CustomerId', custId);
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
  fd.append('__RequestVerificationToken', token);

  const resp = await fetch('https://admin.dencar.sancsoft.net/bulkwashcodes/create/', {
    method:'POST', credentials:'include',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: fd.toString()
  });

  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html,'text/html');
  const codes = cParseCodesFromDoc(doc);

  if(opts.code != null){
    return codes.find(c => c.passCode === String(opts.code)) || codes[0];
  }
  const match = codes.filter(c => c.groupName === opts.groupName);
  return match[0] || codes[0];
}

/* ── parse codes from a Dencar HTML document ── */
function cParseCodesFromDoc(doc){
  const codes = [];
  doc.querySelectorAll('[id^="BulkWashCodes-"]').forEach(panel => {
    const code = {};
    panel.querySelectorAll('strong').forEach(s => {
      const lbl = s.textContent.trim();
      const val = s.nextElementSibling ? s.nextElementSibling.textContent.trim() : '';
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
    const uuid = panel.id.replace('BulkWashCodes-','');
    const hdr = doc.querySelector('[data-bs-target="#BulkWashCodes-'+uuid+'"] span');
    if(hdr){
      const parts = hdr.textContent.trim().split(' - ');
      code.groupName = parts[0] ? parts[0].trim() : '';
    }
    if(code.passCode) codes.push(code);
  });
  return codes;
}

/* ── fetch ALL codes with pagination ── */
async function cFetchAllCodes(statusCb){
  const allCodes = [];
  let page = 1, totalPages = 1;

  while(page <= totalPages){
    if(statusCb) statusCb('Loading page '+page+(totalPages>1?' of '+totalPages:'')+'...');
    const url = 'https://admin.dencar.sancsoft.net/bulkwashcodes/?nonAdmin=true&CurrentPage='+page;
    const resp = await fetch(url, {credentials:'include'});
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html,'text/html');

    allCodes.push(...cParseCodesFromDoc(doc));

    doc.querySelectorAll('.pagination .pagination-page-btn').forEach(btn => {
      const n = parseInt(btn.textContent.trim());
      if(!isNaN(n) && n > totalPages) totalPages = n;
    });
    page++;
  }
  codesCache = allCodes;
  codesLoaded = true;
  return allCodes;
}

/* ── main render ── */
async function codesRender(){
  const body = document.getElementById('codesBody');
  if(!body) return;
  body.innerHTML = '<p style="padding:12px">Loading codes...</p>';

  try {
    const codes = await cFetchAllCodes(function(msg){
      const p = body.querySelector('p');
      if(p) p.textContent = msg;
    });

    let h = '';
    h += cRenderCreateForm();
    h += cRenderMetrics(codes);
    h += cRenderTimeToRedeem(codes);
    h += cRenderTierBreakdown(codes);
    h += cRenderList(codes);
    body.innerHTML = h;
    cBindEvents();
  } catch(e){
    body.innerHTML = '<p style="padding:12px;color:#f66">Error loading codes: '+e.message+'</p>';
  }
}

/* ── create form ── */
function cRenderCreateForm(){
  const tierOpts = WASH_TIERS.map(function(t){
    return '<option value="'+t.id+'">'+t.name+'</option>';
  }).join('');
  const moreOpts = WASH_TIERS_MORE.map(function(t){
    return '<option value="'+t.id+'">'+t.name+'</option>';
  }).join('');
  const defExp = cFmtDate(cAddMonths(new Date(),3));

  return '<section class="summary" style="margin-bottom:16px">'
  +'<h3>Generate Code</h3>'
  +'<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end">'
  /* code type */
  +'<div>'
  +'<label style="display:block;font-size:.85em;margin-bottom:4px">Code Type</label>'
  +'<div style="display:flex;gap:4px">'
  +'<button class="cTypeBtn active" data-type="random" style="padding:6px 14px;border:1px solid #555;border-radius:4px;cursor:pointer;background:#335;color:#fff">Random</button>'
  +'<button class="cTypeBtn" data-type="custom" style="padding:6px 14px;border:1px solid #555;border-radius:4px;cursor:pointer;background:transparent;color:#fff">Custom</button>'
  +'</div></div>'
  /* custom code input */
  +'<div id="cCustomWrap" style="display:none">'
  +'<label style="display:block;font-size:.85em;margin-bottom:4px">Code Number</label>'
  +'<input id="cCustomCode" type="number" min="1000000" max="99999998" placeholder="e.g. 5551234" style="padding:6px;width:140px;border:1px solid #555;border-radius:4px;background:#1a1a2e;color:#fff">'
  +'</div>'
  /* label */
  +'<div>'
  +'<label style="display:block;font-size:.85em;margin-bottom:4px">Label</label>'
  +'<input id="cLabel" type="text" placeholder="e.g. John Smith" style="padding:6px;width:160px;border:1px solid #555;border-radius:4px;background:#1a1a2e;color:#fff">'
  +'</div>'
  /* tier */
  +'<div>'
  +'<label style="display:block;font-size:.85em;margin-bottom:4px">Wash Tier</label>'
  +'<select id="cTier" style="padding:6px;border:1px solid #555;border-radius:4px;background:#1a1a2e;color:#fff">'
  +tierOpts
  +'<optgroup label="Other">'+moreOpts+'</optgroup>'
  +'</select></div>'
  /* expiration */
  +'<div>'
  +'<label style="display:block;font-size:.85em;margin-bottom:4px">Expiration</label>'
  +'<div style="display:flex;gap:4px;flex-wrap:wrap">'
  +'<button class="cExpBtn" data-months="1" style="padding:4px 10px;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:.85em;background:transparent;color:#fff">1 mo</button>'
  +'<button class="cExpBtn" data-months="2" style="padding:4px 10px;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:.85em;background:transparent;color:#fff">2 mo</button>'
  +'<button class="cExpBtn active" data-months="3" style="padding:4px 10px;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:.85em;background:#335;color:#fff">3 mo</button>'
  +'<button class="cExpBtn" data-months="12" style="padding:4px 10px;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:.85em;background:transparent;color:#fff">1 yr</button>'
  +'<button class="cExpBtn" data-months="120" style="padding:4px 10px;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:.85em;background:transparent;color:#fff">No Exp</button>'
  +'</div>'
  +'<input id="cExpDate" type="date" value="'+defExp+'" style="margin-top:4px;padding:4px;border:1px solid #555;border-radius:4px;background:#1a1a2e;color:#fff">'
  +'</div>'
  /* generate button */
  +'<button id="cGenBtn" style="padding:8px 20px;background:#4a6;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;align-self:flex-end">Generate</button>'
  +'</div>'
  +'<div id="cResult" style="margin-top:8px;display:none;padding:8px 12px;border-radius:4px"></div>'
  +'</section>';
}

/* ── metric tiles ── */
function cRenderMetrics(codes){
  const total = codes.length;
  const active = codes.filter(function(c){return c.state==='Active'}).length;
  const redeemed = codes.filter(function(c){return c.state==='Used'}).length;
  const expired = codes.filter(function(c){return c.state==='Expired'}).length;
  const rate = total>0 ? (redeemed/total*100).toFixed(1) : '0.0';

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
    (redeemDays.reduce(function(a,b){return a+b},0)/redeemDays.length).toFixed(0) : '--';

  return '<section class="summary">'
    +'<div class="tile"><strong>'+total+'</strong><span>Total Codes</span></div>'
    +'<div class="tile"><strong>'+active+'</strong><span>Active</span></div>'
    +'<div class="tile"><strong>'+redeemed+'</strong><span>Redeemed</span></div>'
    +'<div class="tile"><strong>'+expired+'</strong><span>Expired</span></div>'
    +'<div class="tile"><strong>'+rate+'%</strong><span>Redemption Rate</span></div>'
    +'<div class="tile"><strong>'+avgDays+'</strong><span>Avg Days to Redeem</span></div>'
    +'</section>';
}

/* ── time-to-redemption bars ── */
function cRenderTimeToRedeem(codes){
  var buckets = [
    {label:'< 1 week', max:7, count:0},
    {label:'1-2 weeks', max:14, count:0},
    {label:'2-4 weeks', max:28, count:0},
    {label:'1-3 months', max:90, count:0},
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
    var pct = (b.count/total*100).toFixed(0);
    var w = Math.max(b.count/total*100, 2);
    bars += '<div style="display:flex;align-items:center;gap:8px;margin:3px 0">'
      +'<span style="width:90px;font-size:.85em;text-align:right">'+b.label+'</span>'
      +'<div style="flex:1;background:#222;border-radius:3px;height:18px">'
      +'<div style="width:'+w+'%;background:#4a8;border-radius:3px;height:100%;min-width:24px;'
      +'display:flex;align-items:center;padding-left:6px;font-size:.75em;color:#fff">'
      +b.count+' ('+pct+'%)</div></div></div>';
  });

  return '<section style="margin:12px 0">'
    +'<h3>Time to Redemption</h3>'+bars+'</section>';
}

/* ── tier breakdown ── */
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
    rows += '<tr>'
      +'<td style="padding:4px 8px;border-bottom:1px solid #333">'+k+'</td>'
      +'<td style="padding:4px 8px;border-bottom:1px solid #333;text-align:center">'+d.total+'</td>'
      +'<td style="padding:4px 8px;border-bottom:1px solid #333;text-align:center">'+d.redeemed+'</td>'
      +'<td style="padding:4px 8px;border-bottom:1px solid #333;text-align:center">'+rate+'</td>'
      +'</tr>';
  });

  return '<section style="margin:12px 0">'
    +'<h3>Codes by Wash Tier</h3>'
    +'<table style="border-collapse:collapse;font-size:.9em">'
    +'<thead><tr>'
    +'<th style="padding:4px 8px;border-bottom:1px solid #555;text-align:left">Tier</th>'
    +'<th style="padding:4px 8px;border-bottom:1px solid #555;text-align:center">Total</th>'
    +'<th style="padding:4px 8px;border-bottom:1px solid #555;text-align:center">Redeemed</th>'
    +'<th style="padding:4px 8px;border-bottom:1px solid #555;text-align:center">Rate</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></section>';
}

/* ── code list with filters ── */
function cRenderList(codes){
  var ac = codes.filter(function(c){return c.state==='Active'}).length;
  var uc = codes.filter(function(c){return c.state==='Used'}).length;
  var ec = codes.filter(function(c){return c.state==='Expired'}).length;

  return '<section style="margin:12px 0">'
    +'<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap">'
    +'<h3 style="margin:0">All Codes</h3>'
    +'<button class="cFilterBtn active" data-filter="" style="padding:4px 12px;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:.85em;background:#335;color:#fff">All ('+codes.length+')</button>'
    +'<button class="cFilterBtn" data-filter="Active" style="padding:4px 12px;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:.85em;background:transparent;color:#fff">Active ('+ac+')</button>'
    +'<button class="cFilterBtn" data-filter="Used" style="padding:4px 12px;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:.85em;background:transparent;color:#fff">Redeemed ('+uc+')</button>'
    +'<button class="cFilterBtn" data-filter="Expired" style="padding:4px 12px;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:.85em;background:transparent;color:#fff">Expired ('+ec+')</button>'
    +'<button id="cRefreshBtn" style="padding:4px 12px;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:.85em;margin-left:auto;background:transparent;color:#fff">'
    +String.fromCharCode(8635)+' Refresh</button>'
    +'</div>'
    +'<div id="cListWrap">'+cBuildTable(codesCache, null)+'</div>'
    +'</section>';
}

function cBuildTable(codes, filter){
  var list = filter ? codes.filter(function(c){return c.state===filter}) : codes.slice();
  if(list.length===0) return '<p style="color:#888;padding:8px">No codes found.</p>';

  list.sort(function(a,b){
    var da=cParseDate(a.created), db=cParseDate(b.created);
    if(!da||!db) return 0;
    return db-da;
  });

  var t = '<table style="width:100%;border-collapse:collapse;font-size:.9em"><thead><tr>'
    +'<th style="text-align:left;padding:6px;border-bottom:1px solid #444">Code #</th>'
    +'<th style="text-align:left;padding:6px;border-bottom:1px solid #444">Label</th>'
    +'<th style="text-align:left;padding:6px;border-bottom:1px solid #444">Wash Tier</th>'
    +'<th style="text-align:left;padding:6px;border-bottom:1px solid #444">Status</th>'
    +'<th style="text-align:left;padding:6px;border-bottom:1px solid #444">Created</th>'
    +'<th style="text-align:left;padding:6px;border-bottom:1px solid #444">Expires</th>'
    +'<th style="text-align:left;padding:6px;border-bottom:1px solid #444">Redeemed</th>'
    +'</tr></thead><tbody>';

  list.forEach(function(c){
    var col = c.state==='Active'?'#4a8' : c.state==='Used'?'#48a' : '#a44';
    var lbl = c.state==='Used'?'Redeemed':c.state;
    var rd = (c.redeemDate && c.redeemDate!=='N/A') ? c.redeemDate : '';
    t += '<tr>'
      +'<td style="padding:6px;border-bottom:1px solid #333;font-family:monospace">'+c.passCode+'</td>'
      +'<td style="padding:6px;border-bottom:1px solid #333">'+(c.groupName||'')+'</td>'
      +'<td style="padding:6px;border-bottom:1px solid #333">'+(c.template||'')+'</td>'
      +'<td style="padding:6px;border-bottom:1px solid #333"><span style="color:'+col+';font-weight:bold">'+lbl+'</span></td>'
      +'<td style="padding:6px;border-bottom:1px solid #333">'+(c.created||'')+'</td>'
      +'<td style="padding:6px;border-bottom:1px solid #333">'+(c.expDate||'')+'</td>'
      +'<td style="padding:6px;border-bottom:1px solid #333">'+rd+'</td>'
      +'</tr>';
  });

  t += '</tbody></table>';
  return t;
}

/* ── bind UI events ── */
function cBindEvents(){
  /* code type toggle */
  document.querySelectorAll('.cTypeBtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.cTypeBtn').forEach(function(b){
        b.classList.remove('active'); b.style.background='transparent';
      });
      btn.classList.add('active'); btn.style.background='#335';
      document.getElementById('cCustomWrap').style.display =
        btn.dataset.type==='custom' ? '' : 'none';
    });
  });

  /* expiration quick-picks */
  document.querySelectorAll('.cExpBtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.cExpBtn').forEach(function(b){
        b.classList.remove('active'); b.style.background='transparent';
      });
      btn.classList.add('active'); btn.style.background='#335';
      var months = parseInt(btn.dataset.months);
      document.getElementById('cExpDate').value = cFmtDate(cAddMonths(new Date(), months));
    });
  });

  /* generate */
  var genBtn = document.getElementById('cGenBtn');
  if(genBtn) genBtn.addEventListener('click', async function(){
    var result = document.getElementById('cResult');
    var isCustom = (document.querySelector('.cTypeBtn.active')||{}).dataset;
    isCustom = isCustom && isCustom.type === 'custom';
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
        result.style.background = '#1a3a1a';
        result.innerHTML = String.fromCharCode(9989)+' Code generated: '
          +'<strong style="font-size:1.3em;font-family:monospace;letter-spacing:1px">'
          +newCode.passCode+'</strong> '+String.fromCharCode(8212)+' '
          +(newCode.template||'')+' '+String.fromCharCode(8212)+' Expires '
          +(newCode.expDate||expDate);
      } else {
        result.style.background = '#1a3a1a';
        result.innerHTML = String.fromCharCode(9989)+' Code created. Refreshing list...';
      }
      document.getElementById('cLabel').value = '';
      codesLoaded = false;
      setTimeout(codesRender, 800);
    } catch(e){
      result.style.display = '';
      result.style.background = '#3a1a1a';
      result.innerHTML = String.fromCharCode(10060)+' Error: '+e.message;
    }
    genBtn.disabled = false; genBtn.textContent = 'Generate';
  });

  /* filter buttons */
  document.querySelectorAll('.cFilterBtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.cFilterBtn').forEach(function(b){
        b.classList.remove('active'); b.style.background='transparent';
      });
      btn.classList.add('active'); btn.style.background='#335';
      document.getElementById('cListWrap').innerHTML =
        cBuildTable(codesCache, btn.dataset.filter || null);
    });
  });

  /* refresh */
  var refBtn = document.getElementById('cRefreshBtn');
  if(refBtn) refBtn.addEventListener('click', function(){
    codesLoaded = false; codesRender();
  });
}

/* ── auto-init when Codes page becomes visible ── */
(function(){
  var pg = document.getElementById('page-codes');
  if(!pg) return;
  var obs = new MutationObserver(function(){
    if(pg.classList.contains('active') && !codesLoaded) codesRender();
  });
  obs.observe(pg, {attributes:true, attributeFilter:['class']});
})();
