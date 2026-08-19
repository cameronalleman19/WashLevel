/* codes.js – Wash Codes tab (v4: storage, search, sort, incremental sync) */

var WASH_TIERS = [
  {name:'Platinum Wash', id:'bace3dcf-4f01-44f7-96dd-cd1e80c2952c'},
  {name:'Gold Wash',     id:'227316fa-af47-4811-8992-949be9c35fe3'},
  {name:'Silver Wash',   id:'170c2796-cb17-4fcb-87e5-d9f778df1cc0'},
  {name:'Bronze Wash',   id:'6db6b50e-f031-4fa8-b706-08df3ad5cd9f'}
];
var WASH_TIERS_MORE = [
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
var CUST_ID = null;
var codesCache = [];
var codesInited = false;
var codesSortCol = 'created';
var codesSortAsc = false;
var codesSelected = new Set();
var codePrintLog = {};
var printLogoData = null;

/* ── helpers ── */
function cFmtDate(d){
  var y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'),
      dd=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+dd;
}
function cParseDate(s){
  if(!s||s==='N/A') return null;
  if(s.includes('/')){ var p=s.split('/'); return new Date(+p[2],+p[0]-1,+p[1]); }
  return new Date(s);
}
function cAddMonths(d,n){ var r=new Date(d); r.setMonth(r.getMonth()+n); return r; }
function cDateSortVal(s){ var d=cParseDate(s); return d?d.getTime():0; }
function cCopyCode(code,btn){
  var ta=document.createElement('textarea');
  ta.value=code; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select(); document.execCommand('copy');
  document.body.removeChild(ta);
  if(btn){btn.textContent='\u2713';setTimeout(function(){btn.textContent='\u2398'},1000);}
}

/* ── resolve CustomerId from Dencar session ── */
async function cEnsureCustId(){
  if(CUST_ID) return CUST_ID;
  var resp = await fetch('https://admin.dencar.sancsoft.net/bulkwashcodes/?nonAdmin=true',{credentials:'include'});
  var html = await resp.text();
  var doc = new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('input[name="CustomerId"]').forEach(function(el){ if(el.value) CUST_ID = el.value; });
  if(!CUST_ID) throw new Error('Could not resolve CustomerId — are you logged in to Dencar?');
  return CUST_ID;
}

/* ── storage ── */
async function cSave(){ await chrome.storage.local.set({washCodes:codesCache,codePrintLog:codePrintLog}); }
async function cLoad(){
  var r = await chrome.storage.local.get(['washCodes','codePrintLog','printLogo']);
  codePrintLog = r.codePrintLog || {};
  printLogoData = r.printLogo || null;
  return r.washCodes || [];
}

/* ── parse codes from Dencar HTML ── */
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

/* ── fetch a single page of codes ── */
async function cFetchPage(page, extraParams){
  var filters = {
    currentPage: page, itemsPerPage: '10',
    CustomerId: CUST_ID, GroupName: '', WashCodeState: '',
    PassCode: '', StartExpDate: '', EndExpDate: '',
    StartRedeemDate: '', EndRedeemDate: '', ShowRedeemed: 'false'
  };
  if(extraParams && extraParams.GroupName) filters.GroupName = extraParams.GroupName;
  if(extraParams && extraParams.PassCode) filters.PassCode = extraParams.PassCode;
  var resp = await safeFetch('https://admin.dencar.sancsoft.net/BulkWashCodes/IndexFilterTable', {
    method: 'POST', credentials: 'include',
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body: Object.keys(filters).map(function(k){return k+'='+encodeURIComponent(filters[k])}).join('&')
  });
  var html = await resp.text();
  var doc = new DOMParser().parseFromString(html,'text/html');
  var codes = cParseCodesFromDoc(doc);
  var maxPage = 1;
  doc.querySelectorAll('.pagination .pagination-page-btn').forEach(function(btn){
    var n = parseInt(btn.textContent.trim());
    if(!isNaN(n) && n > maxPage) maxPage = n;
  });
  return {codes:codes, totalPages:maxPage};
}

/* ── full sync: all pages ── */
async function cFullSync(statusCb){
  await cEnsureCustId();
  var all = [];
  var page = 1, totalPages = 1;
  while(page <= totalPages){
    if(statusCb) statusCb('Syncing codes page '+page+(totalPages>1?' of '+totalPages:'')+'...');
    var result = await cFetchPage(page);
    all.push.apply(all, result.codes);
    totalPages = result.totalPages;
    page++;
  }
  /* dedup by UUID */
  var seen = {};
  all = all.filter(function(c){ var k=c.id; if(seen[k]) return false; seen[k]=true; return true; });
  codesCache = all;
  await cSave();
  return all;
}

/* ── get CSRF token ── */
async function cGetCsrf(){
  var resp = await safeFetch('https://admin.dencar.sancsoft.net/bulkwashcodes/?nonAdmin=true', {credentials:'include'});
  var html = await resp.text();
  var doc = new DOMParser().parseFromString(html,'text/html');
  var createForm = doc.querySelector('form[action*="create"]');
  var token = createForm ? createForm.querySelector('input[name="__RequestVerificationToken"]')?.value : null;
  return token;
}

/* ── create a code ── */
async function cCreateCode(opts){
  await cEnsureCustId();
  var token = await cGetCsrf();
  if(!token) throw new Error('Could not get CSRF token \u2014 are you logged in to Dencar?');
  var bottom, top;
  if(opts.code != null){
    bottom = String(opts.code); top = String(Number(opts.code)+1);
  } else {
    bottom = '1000000'; top = '99999999';
  }
  var params = 'CustomerId='+encodeURIComponent(CUST_ID)
    +'&BottomRange='+bottom+'&TopRange='+top+'&Count=1'
    +'&GroupName='+encodeURIComponent(opts.groupName)
    +'&WashDiscount=0.00&ExpDate='+encodeURIComponent(opts.expDate)
    +'&WashCodeState=0&ProductTemplateId='+encodeURIComponent(opts.tierId)
    +'&UpgradePrompt=false&UpgradeAmount=0'
    +'&__RequestVerificationToken='+encodeURIComponent(token);
  await safeFetch('https://admin.dencar.sancsoft.net/bulkwashcodes/create/', {
    method:'POST', credentials:'include',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: params
  });
  /* Quick lookup by GroupName to find new code */
  var result = await cFetchPage(1, {GroupName: opts.groupName});
  var oldIds = {};
  codesCache.forEach(function(c){ oldIds[c.id] = true; });
  var newCode = null;
  /* Try to find by diff */
  for(var i=0;i<result.codes.length;i++){
    if(!oldIds[result.codes[i].id]){ newCode = result.codes[i]; break; }
  }
  /* Fallback: match by code number or first result */
  if(!newCode && opts.code != null){
    newCode = result.codes.find(function(c){return c.passCode===String(opts.code)});
  }
  if(!newCode && result.codes.length > 0) newCode = result.codes[0];
  /* Add to cache + storage */
  if(newCode && !oldIds[newCode.id]){
    codesCache.unshift(newCode);
    await cSave();
  }
  return newCode;
}

/* ════════════════════════════════
   INIT — runs once
   ════════════════════════════════ */
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
  '<h2>Generate Code</h2>'
  +'<div class="card" style="margin-bottom:14px">'
  +'<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end">'
  +'<div><label class="stat"><label>Code Type</label></label>'
  +'<div style="display:flex;gap:6px;margin-top:6px">'
  +'<button class="cTypeBtn active" data-type="random">Random</button>'
  +'<button class="cTypeBtn" data-type="custom" style="background:#182640">Custom</button>'
  +'</div></div>'
  +'<div id="cQtyWrap">'
  +'<label class="stat"><label>Qty</label></label>'
  +'<input id="cQty" type="number" min="1" value="1" class="c-input" style="margin-top:6px;width:60px"></div>'
  +'<div id="cCustomWrap" style="display:none">'
  +'<label class="stat"><label>Code Number</label></label>'
  +'<input id="cCustomCode" type="number" min="1000000" max="99999998" placeholder="e.g. 5551234" class="c-input" style="margin-top:6px"></div>'
  +'<div><label class="stat"><label>Label</label></label>'
  +'<input id="cLabel" type="text" placeholder="e.g. John Smith" class="c-input" style="margin-top:6px;width:170px"></div>'
  +'<div><label class="stat"><label>Wash Tier</label></label>'
  +'<select id="cTier" class="c-input" style="margin-top:6px">'+tierOpts
  +'<optgroup label="Other">'+moreOpts+'</optgroup></select></div>'
  +'<div><label class="stat"><label>Expiration</label></label>'
  +'<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">'
  +'<button class="cExpBtn" data-months="1" style="background:#182640;padding:6px 10px;font-size:13px">1 mo</button>'
  +'<button class="cExpBtn" data-months="2" style="background:#182640;padding:6px 10px;font-size:13px">2 mo</button>'
  +'<button class="cExpBtn active" data-months="3" style="padding:6px 10px;font-size:13px">3 mo</button>'
  +'<button class="cExpBtn" data-months="12" style="background:#182640;padding:6px 10px;font-size:13px">1 yr</button>'
  +'<button class="cExpBtn" data-months="120" style="background:#182640;padding:6px 10px;font-size:13px">No Exp</button>'
  +'</div><input id="cExpDate" type="date" value="'+defExp+'" class="c-input" style="margin-top:6px"></div>'
  +'<div><button id="cGenBtn" style="background:#16a34a;padding:10px 24px;font-size:15px;font-weight:600">Generate</button></div>'
  +'</div>'
  +'<div id="cResult" style="display:none;margin-top:12px;border-radius:8px;padding:10px 14px;font-size:14px"></div>'
  +'</div>'
  +'<div id="cTilesWrap"></div>'
  +'<div id="cRedeemWrap"></div>'
  +'<div id="cTierWrap"></div>'
  +'<h2>All Codes</h2>'
  +'<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap">'
  +'<button class="cFilterBtn active" data-filter="">All</button>'
  +'<button class="cFilterBtn" data-filter="Active" style="background:#182640">Active</button>'
  +'<button class="cFilterBtn" data-filter="Used" style="background:#182640">Redeemed</button>'
  +'<button class="cFilterBtn" data-filter="Expired" style="background:#182640">Expired</button>'
  +'<input id="cSearch" type="text" placeholder="Search label or code\u2026" class="c-input" style="margin-left:auto;width:200px">'
  +'<button id="cPrintBtn" disabled style="background:#182640;opacity:.5">\u2399 Print Selected</button>'
  +'<button id="cSyncBtn" style="background:#182640">\u21BB Sync</button>'
  +'</div>'
  +'<div id="cListWrap"></div>'
  +'<div id="cSyncStatus" style="color:#8fa3c0;font-size:12px;margin-top:6px"></div>';

  cBindEvents();

  /* Load from storage first, then full sync */
  cLoad().then(function(stored){
    if(stored.length > 0){
      codesCache = stored;
      cUpdateDisplay();
      document.getElementById('cSyncStatus').textContent = stored.length+' codes from cache. Syncing...';
    }
    cFullSync(function(msg){
      var el = document.getElementById('cSyncStatus');
      if(el) el.textContent = msg;
    }).then(function(){
      cUpdateDisplay();
      document.getElementById('cSyncStatus').textContent =
        codesCache.length+' codes synced \u2014 '+new Date().toLocaleTimeString();
    });
  });
}

/* ════════════════════════════════
   UPDATE DISPLAY — refreshes all data sections
   ════════════════════════════════ */
function cUpdateDisplay(){
  var codes = codesCache;
  document.getElementById('cTilesWrap').innerHTML = cRenderMetrics(codes);
  document.getElementById('cRedeemWrap').innerHTML = cRenderTimeToRedeem(codes);
  document.getElementById('cTierWrap').innerHTML = cRenderTierBreakdown(codes);
  cUpdateFilterCounts(codes);
  cUpdateList();
}

function cUpdateFilterCounts(codes){
  var ac=0, uc=0, ec=0;
  codes.forEach(function(c){
    if(c.state==='Active') ac++;
    else if(c.state==='Used') uc++;
    else if(c.state==='Expired') ec++;
  });
  document.querySelectorAll('.cFilterBtn').forEach(function(btn){
    var f=btn.dataset.filter;
    if(f==='') btn.textContent='All ('+codes.length+')';
    else if(f==='Active') btn.textContent='Active ('+ac+')';
    else if(f==='Used') btn.textContent='Redeemed ('+uc+')';
    else if(f==='Expired') btn.textContent='Expired ('+ec+')';
  });
}

function cUpdateList(){
  var activeFilter = document.querySelector('.cFilterBtn.active');
  var filter = activeFilter ? (activeFilter.dataset.filter||null) : null;
  var search = (document.getElementById('cSearch')?.value||'').trim().toLowerCase();
  document.getElementById('cListWrap').innerHTML = cBuildTable(filter, search);
}

/* ── metric tiles ── */
function cRenderMetrics(codes){
  var total=codes.length, active=0, redeemed=0, expired=0, redeemDays=[];
  codes.forEach(function(c){
    if(c.state==='Active') active++;
    else if(c.state==='Used'){
      redeemed++;
      if(c.redeemDate&&c.redeemDate!=='N/A'&&c.created){
        var cr=cParseDate(c.created), rd=cParseDate(c.redeemDate);
        if(cr&&rd){ var d=Math.round((rd-cr)/86400000); if(d>=0) redeemDays.push(d); }
      }
    } else if(c.state==='Expired') expired++;
  });
  var rate = total>0?(redeemed/total*100).toFixed(1):'0.0';
  var avg = redeemDays.length>0?(redeemDays.reduce(function(a,b){return a+b},0)/redeemDays.length).toFixed(0):'\u2014';
  return '<div class="summary">'
    +'<div class="stat"><label>Total Codes</label><div>'+total+'</div></div>'
    +'<div class="stat"><label>Active</label><div style="color:#4ade80">'+active+'</div></div>'
    +'<div class="stat"><label>Redeemed</label><div style="color:#60a5fa">'+redeemed+'</div></div>'
    +'<div class="stat"><label>Expired</label><div style="color:#f87171">'+expired+'</div></div>'
    +'<div class="stat"><label>Redemption Rate</label><div>'+rate+'%</div></div>'
    +'<div class="stat"><label>Avg Days to Redeem</label><div>'+avg+'</div></div></div>';
}

/* ── time-to-redemption ── */
function cRenderTimeToRedeem(codes){
  var bk=[{l:'< 1 week',m:7,c:0},{l:'1\u20132 weeks',m:14,c:0},{l:'2\u20134 weeks',m:28,c:0},
          {l:'1\u20133 months',m:90,c:0},{l:'3+ months',m:Infinity,c:0}];
  var tot=0;
  codes.forEach(function(c){
    if(c.state!=='Used'||!c.redeemDate||c.redeemDate==='N/A'||!c.created) return;
    var cr=cParseDate(c.created),rd=cParseDate(c.redeemDate);
    if(!cr||!rd) return;
    var d=Math.round((rd-cr)/86400000); if(d<0) return; tot++;
    for(var i=0;i<bk.length;i++){ if(d<bk[i].m){bk[i].c++;break;} }
  });
  if(tot===0) return '';
  var bars='';
  bk.forEach(function(b){
    var pct=(b.c/tot*100).toFixed(0), w=Math.max(b.c/tot*100,1);
    bars+='<div style="display:flex;align-items:center;gap:10px;margin:6px 0">'
      +'<span style="width:100px;font-size:13px;color:#8fa3c0;text-align:right">'+b.l+'</span>'
      +'<div style="flex:1;background:#10192b;border-radius:6px;height:22px">'
      +'<div style="width:'+w+'%;background:#1f4393;border-radius:6px;height:100%;min-width:30px;'
      +'display:flex;align-items:center;padding-left:8px;font-size:12px;color:#eaeef5;font-weight:600">'
      +b.c+' ('+pct+'%)</div></div></div>';
  });
  return '<h2>Time to Redemption</h2><div class="card">'+bars+'</div>';
}

/* ── tier breakdown ── */
function cRenderTierBreakdown(codes){
  var tm={};
  codes.forEach(function(c){
    var t=c.template||'Unknown';
    if(!tm[t]) tm[t]={t:0,r:0}; tm[t].t++;
    if(c.state==='Used') tm[t].r++;
  });
  var keys=Object.keys(tm); if(!keys.length) return '';
  keys.sort(function(a,b){return tm[b].t-tm[a].t});
  var rows='';
  keys.forEach(function(k){
    var d=tm[k], rate=d.t>0?(d.r/d.t*100).toFixed(0)+'%':'0%';
    rows+='<tr><td>'+k+'</td><td style="text-align:center">'+d.t+'</td>'
      +'<td style="text-align:center">'+d.r+'</td><td style="text-align:center">'+rate+'</td></tr>';
  });
  return '<h2>Codes by Wash Tier</h2><table class="via"><thead><tr>'
    +'<th>Tier</th><th style="text-align:center">Total</th>'
    +'<th style="text-align:center">Redeemed</th><th style="text-align:center">Rate</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>';
}

/* ── sortable code table ── */
function cBuildTable(filter, search){
  var list = codesCache.slice();
  if(filter) list = list.filter(function(c){return c.state===filter});
  if(search) list = list.filter(function(c){
    return (c.groupName||'').toLowerCase().indexOf(search)>=0 ||
           (c.passCode||'').indexOf(search)>=0;
  });
  if(!list.length) return '<div class="card" style="color:#8fa3c0">No codes found.</div>';

  /* sort */
  var col=codesSortCol, asc=codesSortAsc;
  list.sort(function(a,b){
    var va,vb;
    if(col==='passCode'){ va=a.passCode||''; vb=b.passCode||''; }
    else if(col==='groupName'){ va=(a.groupName||'').toLowerCase(); vb=(b.groupName||'').toLowerCase(); }
    else if(col==='template'){ va=a.template||''; vb=b.template||''; }
    else if(col==='state'){ va=a.state||''; vb=b.state||''; }
    else if(col==='created'){ va=cDateSortVal(a.created); vb=cDateSortVal(b.created); }
    else if(col==='expDate'){ va=cDateSortVal(a.expDate); vb=cDateSortVal(b.expDate); }
    else if(col==='redeemDate'){ va=cDateSortVal(a.redeemDate); vb=cDateSortVal(b.redeemDate); }
    else if(col==='printed'){ var pa=codePrintLog[a.id],pb=codePrintLog[b.id]; va=pa?pa.last:0; vb=pb?pb.last:0; }
    else { va=0; vb=0; }
    if(va<vb) return asc?-1:1;
    if(va>vb) return asc?1:-1;
    return 0;
  });

  var arrow = function(c){ return c===col?(asc?' \u25B2':' \u25BC'):''; };
  var th = function(c,label){
    return '<th class="cSortTh" data-col="'+c+'" style="cursor:pointer;user-select:none">'+label+arrow(c)+'</th>';
  };

  var t = '<table class="via"><thead><tr>'
    +'<th style="width:36px"><input type="checkbox" id="cSelectAll" title="Select all"></th>'
    +th('passCode','Code #')+th('groupName','Label')+th('template','Wash Tier')
    +th('state','Status')+th('created','Created')+th('expDate','Expires')
    +th('redeemDate','Redeemed')+th('printed','Printed')+'</tr></thead><tbody>';

  list.forEach(function(c){
    var lbl=c.state==='Used'?'Redeemed':c.state;
    var cls=c.state==='Used'?'color:#60a5fa':c.state==='Active'?'color:#4ade80':'color:#f87171';
    var rd=(c.redeemDate&&c.redeemDate!=='N/A')?c.redeemDate:'';
    var chk=codesSelected.has(c.id)?' checked':'';
    var pl=codePrintLog[c.id],ptxt=pl?(pl.count+String.fromCharCode(215)+' '+String.fromCharCode(183)+' '+new Date(pl.last).toLocaleDateString()):'';
    t+='<tr><td><input type="checkbox" class="cCodeChk" data-id="'+c.id+'"'+chk+'></td>'
      +'<td style="font-family:monospace;font-size:14px;letter-spacing:.5px">'+c.passCode+' <button class="cCopyBtn" data-code="'+c.passCode+'" style="background:#233453;border:none;color:#8fa3c0;cursor:pointer;padding:2px 6px;border-radius:4px;font-size:12px">\u2398</button></td>'
      +'<td>'+(c.groupName||'')+'</td><td>'+(c.template||'')+'</td>'
      +'<td><span style="'+cls+';font-weight:700">'+lbl+'</span></td>'
      +'<td>'+(c.created||'')+'</td><td>'+(c.expDate||'')+'</td>'
      +'<td>'+rd+'</td>'
      +'<td style="font-size:12px;color:#8fa3c0;white-space:nowrap">'+ptxt+'</td></tr>';
  });
  return t+'</tbody></table>';
}


/* ── print helpers ── */
function cUpdatePrintBtn(){
  var btn=document.getElementById('cPrintBtn');
  if(!btn) return;
  var n=codesSelected.size;
  btn.disabled=n===0;
  btn.style.opacity=n===0?'.5':'1';
  btn.textContent=n>0?'\u2399 Print Selected ('+n+')':'\u2399 Print Selected';
}

function cShowPrintModal(){
  if(codesSelected.size===0) return;
  var existing=document.getElementById('cPrintModal');
  if(existing) existing.remove();

  var sel=Array.from(codesSelected);
  var codes=codesCache.filter(function(c){return sel.indexOf(c.id)>=0});
  var n=codes.length;

  var logoHtml=printLogoData
    ?'<img src="'+printLogoData+'" style="max-width:120px;max-height:80px;object-fit:contain;border-radius:6px;border:1px solid #2a3a58">'
    :'<span style="color:#8fa3c0;font-size:13px">No logo uploaded</span>';

  var m=document.createElement('div');
  m.id='cPrintModal';
  m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100';
  m.innerHTML=
    '<div style="background:#10192b;border:1px solid #2a3a58;border-radius:12px;max-width:480px;width:92%;padding:24px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    +'<h2 style="margin:0;font-size:18px;color:#eaeef5;text-transform:none;letter-spacing:0">Print Codes</h2>'
    +'<button id="cPrintModalClose" style="background:#233453;padding:6px 12px;font-size:13px">Close</button></div>'
    +'<div style="margin-bottom:14px"><label style="color:#8fa3c0;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Card Size</label>'
    +'<div style="display:flex;gap:8px;margin-top:6px">'
    +'<button class="cSizeBtn active" data-size="small" style="padding:8px 16px;font-size:13px">Small (10/page)</button>'
    +'<button class="cSizeBtn" data-size="large" style="background:#182640;padding:8px 16px;font-size:13px">Large (3/page)</button>'
    +'</div></div>'
    +'<div id="cPrintInfo" style="background:#182640;border-radius:8px;padding:12px;margin-bottom:14px;font-size:14px;color:#eaeef5"></div>'
    +'<div style="margin-bottom:14px"><label style="color:#8fa3c0;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Your Logo</label>'
    +'<div style="display:flex;align-items:center;gap:12px;margin-top:6px">'
    +'<div id="cLogoPreview">'+logoHtml+'</div>'
    +'<label style="background:#233453;color:#fff;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer">Upload Logo'
    +'<input type="file" id="cLogoInput" accept="image/*" style="display:none"></label></div></div>'
    +'<button id="cPrintGo" style="background:#16a34a;padding:10px 24px;font-size:15px;font-weight:600;width:100%">Print</button>'
    +'</div>';
  document.body.appendChild(m);
  cUpdatePrintInfo();

  /* modal events */
  document.getElementById('cPrintModalClose').onclick=function(){ m.remove(); };
  m.addEventListener('click',function(e){ if(e.target===m) m.remove(); });
  document.querySelectorAll('.cSizeBtn').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.querySelectorAll('.cSizeBtn').forEach(function(b){b.classList.remove('active');b.style.background='#182640'});
      btn.classList.add('active');btn.style.background='';
      cUpdatePrintInfo();
    });
  });
  document.getElementById('cLogoInput').addEventListener('change',function(e){
    var file=e.target.files[0]; if(!file) return;
    var reader=new FileReader();
    reader.onload=function(ev){
      printLogoData=ev.target.result;
      chrome.storage.local.set({printLogo:printLogoData});
      document.getElementById('cLogoPreview').innerHTML=
        '<img src="'+printLogoData+'" style="max-width:120px;max-height:80px;object-fit:contain;border-radius:6px;border:1px solid #2a3a58">';
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('cPrintGo').onclick=function(){ cDoPrint(); };
}

function cUpdatePrintInfo(){
  var el=document.getElementById('cPrintInfo'); if(!el) return;
  var sizeBtn=document.querySelector('.cSizeBtn.active');
  var size=sizeBtn?sizeBtn.dataset.size:'small';
  var perPage=size==='small'?10:3;
  var n=codesSelected.size;
  var pages=Math.ceil(n/perPage);
  var remaining=pages*perPage-n;
  el.innerHTML='<strong>'+n+'</strong> code'+(n!==1?'s':'')+' selected &middot; <strong>'+pages+'</strong> page'+(pages!==1?'s':'')
    +(remaining>0?' &middot; <span style="color:#4ade80">'+remaining+' more fit on last page</span>':'');
}

function cDoPrint(){
  var sizeBtn=document.querySelector('.cSizeBtn.active');
  var size=sizeBtn?sizeBtn.dataset.size:'small';
  var sel=Array.from(codesSelected);
  var codes=codesCache.filter(function(c){return sel.indexOf(c.id)>=0});
  if(!codes.length) return;

  var perPage=size==='small'?10:3;
  var pages=[];
  for(var i=0;i<codes.length;i+=perPage){
    pages.push(codes.slice(i,i+perPage));
  }

  var logoTag=printLogoData?'<img src="'+printLogoData+'" class="logo-img">':'';

  var cardHtml='';
  pages.forEach(function(pg,pi){
    var cls=size==='small'?'grid-small':'grid-large';
    cardHtml+='<div class="page"><div class="'+cls+'">';
    pg.forEach(function(c){
      var cardCls=size==='small'?'card-small':'card-large';
      var exp=c.expDate||'N/A';
      cardHtml+='<div class="'+cardCls+'">'
        +'<div class="logo-area">'+logoTag+'</div>'
        +'<div class="info-area">'
        +'<div class="code-num">'+c.passCode+'</div>'
        +'<div class="instructions">Press <b>&ldquo;I have a wash code&rdquo;</b> on the screen. Enter the number above and press enter. This will activate the car wash.</div>'
        +'<div class="fine-print">Not redeemable for cash. One-time use only. &nbsp; <span class="exp-date">Expires: '+exp+'</span></div>'
        +'</div></div>';
    });
    cardHtml+='</div></div>';
  });

  var landscape=size==='large';
  var pageRule=landscape
    ?'@page{size:11in 8.5in;margin:.4in .5in}'
    :'@page{size:8.5in 11in;margin:.5in .75in}';

  var html='<!DOCTYPE html><html><head><title>Print Wash Codes</title><style>'
    +pageRule
    +'*{box-sizing:border-box;margin:0;padding:0}'
    +'body{font-family:Arial,Helvetica,sans-serif}'
    +'.page{page-break-after:always}.page:last-child{page-break-after:avoid}'
    +'.grid-small{display:grid;grid-template-columns:3.5in 3.5in;grid-template-rows:repeat(5,2in);gap:0;width:7in;height:10in}'
    +'.grid-large{display:flex;flex-direction:column;gap:.25in;width:10in;height:7.5in}'
    +'.card-small{width:3.5in;height:2in;border:1.5px solid #1f4393;border-radius:4px;display:flex;padding:6px;overflow:hidden}'
    +'.card-small .logo-area{width:1in;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
    +'.card-small .logo-img{max-width:.9in;max-height:1.6in;object-fit:contain}'
    +'.card-small .info-area{flex:1;padding-left:6px;display:flex;flex-direction:column;justify-content:center}'
    +'.card-small .code-num{font-size:22px;font-weight:700;font-family:monospace;letter-spacing:1px}'
    +'.card-small .instructions{font-size:7.5px;color:#222;margin-top:3px;line-height:1.3}'
    +'.card-small .fine-print{font-size:6.5px;color:#555;margin-top:auto;line-height:1.3}'
    +'.card-small .exp-date{font-weight:600}'
    +'.card-large{width:10in;height:2.3in;border:2px solid #1f4393;border-radius:6px;display:flex;padding:14px;overflow:hidden}'
    +'.card-large .logo-area{width:2.5in;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
    +'.card-large .logo-img{max-width:2.3in;max-height:2in;object-fit:contain}'
    +'.card-large .info-area{flex:1;padding-left:16px;display:flex;flex-direction:column;justify-content:center}'
    +'.card-large .code-num{font-size:48px;font-weight:700;font-family:monospace;letter-spacing:2px}'
    +'.card-large .instructions{font-size:13px;color:#222;margin-top:6px;line-height:1.4}'
    +'.card-large .fine-print{font-size:9px;color:#555;margin-top:auto;line-height:1.4}'
    +'.card-large .exp-date{font-weight:600}'
    +'@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
    +'</style></head><body>'+cardHtml
    +'<script>window.onload=function(){window.print()}<\/script>'
    +'</body></html>';

  var w=window.open('','_blank');
  w.document.write(html);
  w.document.close();

  /* stamp printed */
  var now=Date.now();
  codes.forEach(function(c){
    if(!codePrintLog[c.id]) codePrintLog[c.id]={count:0,last:0};
    codePrintLog[c.id].count++;
    codePrintLog[c.id].last=now;
  });
  cSave().then(function(){
    cUpdateDisplay();
    codesSelected.clear();
    cUpdatePrintBtn();
  });

  /* close modal */
  var modal=document.getElementById('cPrintModal');
  if(modal) modal.remove();
}

/* ── bind events (once) ── */
function cBindEvents(){
  document.querySelectorAll('.cTypeBtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.cTypeBtn').forEach(function(b){b.classList.remove('active');b.style.background='#182640'});
      btn.classList.add('active'); btn.style.background='';
      document.getElementById('cCustomWrap').style.display=btn.dataset.type==='custom'?'':'none';
      document.getElementById('cQtyWrap').style.display=btn.dataset.type==='custom'?'none':'';
      if(btn.dataset.type==='custom') document.getElementById('cQty').value='1';
    });
  });
  document.querySelectorAll('.cExpBtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.cExpBtn').forEach(function(b){b.classList.remove('active');b.style.background='#182640'});
      btn.classList.add('active'); btn.style.background='';
      document.getElementById('cExpDate').value=cFmtDate(cAddMonths(new Date(),parseInt(btn.dataset.months)));
    });
  });

  /* generate */
  document.getElementById('cGenBtn').addEventListener('click', async function(){
    var genBtn=document.getElementById('cGenBtn'), result=document.getElementById('cResult');
    var activeType=document.querySelector('.cTypeBtn.active');
    var isCustom=activeType&&activeType.dataset.type==='custom';
    var label=document.getElementById('cLabel').value.trim();
    var tierId=document.getElementById('cTier').value;
    var expDate=document.getElementById('cExpDate').value;
    if(!label){alert('Please enter a label.');return;}
    if(!expDate){alert('Please select an expiration date.');return;}
    var customCode=null;
    if(isCustom){
      customCode=parseInt(document.getElementById('cCustomCode').value);
      if(isNaN(customCode)||customCode<1000000||customCode>99999998){
        alert('Custom code must be between 1,000,000 and 99,999,998.');return;
      }
    }
    var qty = isCustom ? 1 : Math.max(1, parseInt(document.getElementById('cQty').value)||1);
    genBtn.disabled=true; result.style.display='none';
    try {
      var created = [];
      for(var i=0;i<qty;i++){
        var batchLabel = qty>1 ? label+' ('+(i+1)+')' : label;
        genBtn.textContent='Generating '+(i+1)+'/'+qty+'...';
        var nc = await cCreateCode({code:customCode,groupName:batchLabel,tierId:tierId,expDate:expDate});
        if(nc&&nc.passCode) created.push(nc);
        if(i<qty-1) await new Promise(function(r){setTimeout(r,300)});
      }
      result.style.display='';
      if(created.length>0){
        result.style.background='#14532d';
        if(created.length<=10){
          var codeHtml=created.map(function(c){
            return '<span style="display:inline-flex;align-items:center;gap:4px;margin:2px 4px">'
              +'<strong style="font-family:monospace;font-size:16px;letter-spacing:.5px">'+c.passCode+'</strong>'
              +'<button class="cCopyBtn" data-code="'+c.passCode+'" '
              +'style="background:#233453;border:none;color:#8fa3c0;cursor:pointer;padding:2px 6px;border-radius:4px;font-size:13px">\u2398</button></span>';
          }).join('');
          result.innerHTML='\u2705 '+created.length+' code'+(created.length>1?'s':'')+' generated: '+codeHtml
            +' \u2014 '+(created[0].template||'')+' \u2014 Expires '+(created[0].expDate||expDate);
        } else {
          result.innerHTML='\u2705 '+created.length+' codes generated ('+(created[0].template||'')+', expires '
            +(created[0].expDate||expDate)+'). Find them in the table below.';
        }
      } else {
        result.style.background='#14532d';
        result.innerHTML='\u2705 Code'+(qty>1?'s':'')+' created. Click Sync to see.';
      }
      document.getElementById('cLabel').value='';
      cUpdateDisplay();
    } catch(e){
      result.style.display=''; result.style.background='#7f1d1d';
      result.innerHTML='\u274C Error: '+e.message;
    }
    genBtn.disabled=false; genBtn.textContent='Generate';
  });

  /* filters */
  document.querySelectorAll('.cFilterBtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.cFilterBtn').forEach(function(b){b.classList.remove('active');b.style.background='#182640'});
      btn.classList.add('active'); btn.style.background='';
      cUpdateList();
    });
  });

  /* search */
  document.getElementById('cSearch').addEventListener('input', function(){ cUpdateList(); });

  /* column sort (delegated) */
  document.getElementById('cListWrap').addEventListener('click', function(e){
    var th = e.target.closest('.cSortTh');
    if(!th) return;
    var col = th.dataset.col;
    if(codesSortCol===col) codesSortAsc=!codesSortAsc;
    else { codesSortCol=col; codesSortAsc=true; }
    cUpdateList();
  });

  /* copy buttons (delegated) */
  document.addEventListener('click', function(e){
    var btn = e.target.closest('.cCopyBtn');
    if(!btn) return;
    cCopyCode(btn.dataset.code, btn);
  });

  /* checkbox selection (delegated) */
  document.getElementById('cListWrap').addEventListener('change', function(e){
    if(e.target.id==='cSelectAll'){
      var chks=document.querySelectorAll('.cCodeChk');
      chks.forEach(function(cb){cb.checked=e.target.checked;if(e.target.checked)codesSelected.add(cb.dataset.id);else codesSelected.delete(cb.dataset.id)});
      cUpdatePrintBtn(); return;
    }
    var cb=e.target.closest('.cCodeChk');
    if(!cb) return;
    if(cb.checked) codesSelected.add(cb.dataset.id); else codesSelected.delete(cb.dataset.id);
    var all=document.getElementById('cSelectAll');
    if(all){var chks=document.querySelectorAll('.cCodeChk');all.checked=chks.length>0&&Array.from(chks).every(function(x){return x.checked})}
    cUpdatePrintBtn();
  });

  /* print button */
  document.getElementById('cPrintBtn').addEventListener('click', function(){ cShowPrintModal(); });

  /* sync */
  document.getElementById('cSyncBtn').addEventListener('click', function(){
    var ss=document.getElementById('cSyncStatus');
    ss.textContent='Syncing...';
    cFullSync(function(msg){ss.textContent=msg}).then(function(){
      cUpdateDisplay();
      ss.textContent=codesCache.length+' codes synced \u2014 '+new Date().toLocaleTimeString();
    });
  });
}

/* ── auto-init ── */
(function(){
  var pg=document.getElementById('page-codes');
  if(!pg) return;
  new MutationObserver(function(){
    if(pg.classList.contains('active')&&!codesInited) codesInit();
  }).observe(pg,{attributes:true,attributeFilter:['class']});
})();
