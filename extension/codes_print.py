#!/usr/bin/env python3
"""codes_print.py – Add print feature to Codes tab
   Adds: checkbox selection, Print Selected button, print modal (small/large),
   logo upload + persist, print page in new tab, print count/date tracking.
"""
import sys, os

path = 'extension/codes.js'
with open(path, 'r') as f:
    s = f.read()

# ═══════════════════════════════════════════
# P1: Add globals
# ═══════════════════════════════════════════
old = "var codesSortAsc = false;"
rep = """var codesSortAsc = false;
var codesSelected = new Set();
var codePrintLog = {};
var printLogoData = null;"""
assert s.count(old) == 1, 'P1 fail: codesSortAsc anchor'
s = s.replace(old, rep)

# ═══════════════════════════════════════════
# P2: cSave – also persist print log
# ═══════════════════════════════════════════
old = "async function cSave(){ await chrome.storage.local.set({washCodes:codesCache}); }"
rep = "async function cSave(){ await chrome.storage.local.set({washCodes:codesCache,codePrintLog:codePrintLog}); }"
assert s.count(old) == 1, 'P2 fail: cSave anchor'
s = s.replace(old, rep)

# ═══════════════════════════════════════════
# P3: cLoad – also load print log + logo
# ═══════════════════════════════════════════
old = (
    "async function cLoad(){\n"
    "  var r = await chrome.storage.local.get('washCodes');\n"
    "  return r.washCodes || [];\n"
    "}"
)
rep = (
    "async function cLoad(){\n"
    "  var r = await chrome.storage.local.get(['washCodes','codePrintLog','printLogo']);\n"
    "  codePrintLog = r.codePrintLog || {};\n"
    "  printLogoData = r.printLogo || null;\n"
    "  return r.washCodes || [];\n"
    "}"
)
assert s.count(old) == 1, 'P3 fail: cLoad anchor'
s = s.replace(old, rep)

# ═══════════════════════════════════════════
# P4: Add 'printed' sort case
# ═══════════════════════════════════════════
old = "else { va=0; vb=0; }"
rep = (
    "else if(col==='printed'){ var pa=codePrintLog[a.id],pb=codePrintLog[b.id];"
    " va=pa?pa.last:0; vb=pb?pb.last:0; }\n"
    "    else { va=0; vb=0; }"
)
assert s.count(old) == 1, 'P4 fail: sort fallback anchor'
s = s.replace(old, rep)

# ═══════════════════════════════════════════
# P5: Table header – add checkbox + printed cols
# ═══════════════════════════════════════════
old = (
    "var t = '<table class=\"via\"><thead><tr>'\n"
    "    +th('passCode','Code #')+th('groupName','Label')+th('template','Wash Tier')\n"
    "    +th('state','Status')+th('created','Created')+th('expDate','Expires')\n"
    "    +th('redeemDate','Redeemed')+'</tr></thead><tbody>';"
)
rep = (
    "var t = '<table class=\"via\"><thead><tr>'\n"
    "    +'<th style=\"width:36px\"><input type=\"checkbox\" id=\"cSelectAll\" title=\"Select all\"></th>'\n"
    "    +th('passCode','Code #')+th('groupName','Label')+th('template','Wash Tier')\n"
    "    +th('state','Status')+th('created','Created')+th('expDate','Expires')\n"
    "    +th('redeemDate','Redeemed')+th('printed','Printed')+'</tr></thead><tbody>';"
)
assert s.count(old) == 1, 'P5 fail: thead anchor'
s = s.replace(old, rep)

# ═══════════════════════════════════════════
# P6: Table rows – add checkbox + printed columns
# ═══════════════════════════════════════════
old = (
    "    var lbl=c.state==='Used'?'Redeemed':c.state;\n"
    "    var cls=c.state==='Used'?'color:#60a5fa':c.state==='Active'?'color:#4ade80':'color:#f87171';\n"
    "    var rd=(c.redeemDate&&c.redeemDate!=='N/A')?c.redeemDate:'';\n"
    "    t+='<tr><td style=\"font-family:monospace;font-size:14px;letter-spacing:.5px\">'+c.passCode+' <button class=\"cCopyBtn\" data-code=\"'+c.passCode+'\" style=\"background:#233453;border:none;color:#8fa3c0;cursor:pointer;padding:2px 6px;border-radius:4px;font-size:12px\">\\u2398</button></td>'\n"
    "      +'<td>'+(c.groupName||'')+'</td><td>'+(c.template||'')+'</td>'\n"
    "      +'<td><span style=\"'+cls+';font-weight:700\">'+lbl+'</span></td>'\n"
    "      +'<td>'+(c.created||'')+'</td><td>'+(c.expDate||'')+'</td>'\n"
    "      +'<td>'+rd+'</td></tr>';"
)
rep = (
    "    var lbl=c.state==='Used'?'Redeemed':c.state;\n"
    "    var cls=c.state==='Used'?'color:#60a5fa':c.state==='Active'?'color:#4ade80':'color:#f87171';\n"
    "    var rd=(c.redeemDate&&c.redeemDate!=='N/A')?c.redeemDate:'';\n"
    "    var chk=codesSelected.has(c.id)?' checked':'';\n"
    "    var pl=codePrintLog[c.id],ptxt=pl?(pl.count+String.fromCharCode(215)+' '+String.fromCharCode(183)+' '+new Date(pl.last).toLocaleDateString()):'';\n"
    "    t+='<tr><td><input type=\"checkbox\" class=\"cCodeChk\" data-id=\"'+c.id+'\"'+chk+'></td>'\n"
    "      +'<td style=\"font-family:monospace;font-size:14px;letter-spacing:.5px\">'+c.passCode+' <button class=\"cCopyBtn\" data-code=\"'+c.passCode+'\" style=\"background:#233453;border:none;color:#8fa3c0;cursor:pointer;padding:2px 6px;border-radius:4px;font-size:12px\">\\u2398</button></td>'\n"
    "      +'<td>'+(c.groupName||'')+'</td><td>'+(c.template||'')+'</td>'\n"
    "      +'<td><span style=\"'+cls+';font-weight:700\">'+lbl+'</span></td>'\n"
    "      +'<td>'+(c.created||'')+'</td><td>'+(c.expDate||'')+'</td>'\n"
    "      +'<td>'+rd+'</td>'\n"
    "      +'<td style=\"font-size:12px;color:#8fa3c0;white-space:nowrap\">'+ptxt+'</td></tr>';"
)
assert s.count(old) == 1, 'P6 fail: table row anchor'
s = s.replace(old, rep)

# ═══════════════════════════════════════════
# P7: Add Print Selected button to toolbar
# ═══════════════════════════════════════════
old = "+'<button id=\"cSyncBtn\" style=\"background:#182640\">\\u21BB Sync</button>'"
rep = (
    "+'<button id=\"cPrintBtn\" disabled style=\"background:#182640;opacity:.5\">\\u2399 Print Selected</button>'\n"
    "  +'<button id=\"cSyncBtn\" style=\"background:#182640\">\\u21BB Sync</button>'"
)
assert s.count(old) == 1, 'P7 fail: sync btn anchor'
s = s.replace(old, rep)

# ═══════════════════════════════════════════
# P8: Add print functions before /* ── bind events ── */
# ═══════════════════════════════════════════
old = "/* ── bind events (once) ── */"
PRINT_FUNCS = r'''
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

''' + '/* \u2500\u2500 bind events (once) \u2500\u2500 */'
assert s.count(old) == 1, 'P8 fail: bind events anchor'
s = s.replace(old, rep)

# ═══════════════════════════════════════════
# P9: Add event bindings for checkboxes + print btn
# ═══════════════════════════════════════════
old = (
    "  /* sync */\n"
    "  document.getElementById('cSyncBtn').addEventListener('click', function(){"
)
rep = (
    "  /* checkbox selection (delegated) */\n"
    "  document.getElementById('cListWrap').addEventListener('change', function(e){\n"
    "    if(e.target.id==='cSelectAll'){\n"
    "      var chks=document.querySelectorAll('.cCodeChk');\n"
    "      chks.forEach(function(cb){cb.checked=e.target.checked;if(e.target.checked)codesSelected.add(cb.dataset.id);else codesSelected.delete(cb.dataset.id)});\n"
    "      cUpdatePrintBtn(); return;\n"
    "    }\n"
    "    var cb=e.target.closest('.cCodeChk');\n"
    "    if(!cb) return;\n"
    "    if(cb.checked) codesSelected.add(cb.dataset.id); else codesSelected.delete(cb.dataset.id);\n"
    "    var all=document.getElementById('cSelectAll');\n"
    "    if(all){var chks=document.querySelectorAll('.cCodeChk');all.checked=chks.length>0&&Array.from(chks).every(function(x){return x.checked})}\n"
    "    cUpdatePrintBtn();\n"
    "  });\n"
    "\n"
    "  /* print button */\n"
    "  document.getElementById('cPrintBtn').addEventListener('click', function(){ cShowPrintModal(); });\n"
    "\n"
    "  /* sync */\n"
    "  document.getElementById('cSyncBtn').addEventListener('click', function(){"
)
assert s.count(old) == 1, 'P9 fail: sync event anchor'
s = s.replace(old, rep)

# ═══════════════════════════════════════════
# Write + validate
# ═══════════════════════════════════════════
with open(path, 'w') as f:
    f.write(s)
print('codes_print.py: All patches applied successfully.')
