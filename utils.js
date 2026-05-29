// utils.js — hulpfuncties

function fmt(v,n=2) { if(v==null||isNaN(v)) return '\u2014'; return Number(v).toLocaleString('nl-NL',{minimumFractionDigits:n,maximumFractionDigits:n}); }

function clamp(v,mn,mx) { return Math.max(mn,Math.min(mx,v)); }

function formatDate(d) { if(!d) return ''; return d.toLocaleDateString('nl-NL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }

function parseFloatSafe(v) { if(v==null||v==='') return NaN; if(typeof v==='number') return v; return parseFloat(String(v).replace(',','.')); }

function toggleAcc(head) {
  head.classList.toggle('open');
  const body = head.nextElementSibling;
  if (body) body.classList.toggle('open');
  const icon = head.querySelector('.acc-icon');
  if (icon) icon.style.transform = head.classList.contains('open') ? 'rotate(180deg)' : '';
}

function showLoading(show) { document.getElementById('loadingOverlay').classList.toggle('hidden',!show); }

function setLoadingMsg(msg) { const e=document.getElementById('loadingMsg'); if(e) e.textContent=msg; }

function downloadBlob(content, name, type) {
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click();
}

function renderWarnings(warnings) {
  const el = document.getElementById('validationWarnings'); if(!el) return;
  if (!warnings?.length) { el.classList.add('hidden'); return; }
  el.innerHTML = warnings.map(w=>`<div>\u26a0\ufe0f ${w}</div>`).join('');
  el.classList.remove('hidden');
}

