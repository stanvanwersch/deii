/**
 * upload.js — bestandsupload en Excel-parsing
 * Vervang parseExcel() door een andere parser voor CSV of API-data.
 */

let rawData = [], columnHeaders = [], lastFileName = '';

function handleFile(file) {
  showLoading(true);
  lastFileName = file ? file.name : '';
  const reader = new FileReader();
  reader.onload = e => {
    try { parseExcel(e.target.result); }
    catch(err) { alert('Fout bij inlezen: ' + err.message); console.error(err); }
    finally { showLoading(false); }
  };
  reader.readAsArrayBuffer(file);
}

function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type:'array', cellDates:true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { raw:false, defval:'', dateNF:'yyyy-mm-dd hh:mm:ss' });
  if (!data.length) throw new Error('Excel-sheet is leeg.');
  columnHeaders = Object.keys(data[0]);
  rawData = data;
  populateMappingDropdowns(columnHeaders);
  autoDetectColumns(columnHeaders);
  renderPreviewTable(data.slice(0,20), columnHeaders);
  // Compact de upload zone na laden
  const dz = document.getElementById('dropZone');
  if (dz) {
    dz.style.padding = '10px 16px';
    dz.style.minHeight = '0';
    const dzT = dz.querySelector('.upload-zone-title'); if(dzT) dzT.textContent = lastFileName || 'Bestand geladen';
    const dzS = dz.querySelector('.upload-zone-sub'); if(dzS) dzS.textContent = rawData.length + ' rijen \u00b7 ' + columnHeaders.length + ' kolommen';
  }
  document.getElementById('mappingSection').scrollIntoView({behavior:'smooth', block:'start'});
}

function populateMappingDropdowns(headers) {
  const reqIds  = ['colTimestamp','colElektra'];
  const optIds  = ['colWarmte','colGas','colOpwek','colPrice','colSignal','colTemp'];
  reqIds.forEach(id => {
    const sel = document.getElementById(id); if(!sel) return;
    sel.innerHTML = '<option value="">\u2014 kies kolom \u2014</option>';
    headers.forEach(h => sel.insertAdjacentHTML('beforeend',`<option value="${h}">${h}</option>`));
  });
  optIds.forEach(id => {
    const sel = document.getElementById(id); if(!sel) return;
    sel.innerHTML = '<option value="">(geen)</option>';
    headers.forEach(h => sel.insertAdjacentHTML('beforeend',`<option value="${h}">${h}</option>`));
  });
}

function autoDetectColumns(headers) {
  const patterns = {
    colTimestamp: /time|timestamp|datum|date|tijd|datetime/i,
    colElektra:   /elektra|electr|kwh|verbruik|consump|usage|energie/i,
    colWarmte:    /warmte|heat|therm/i,
    colGas:       /gas/i,
    colOpwek:     /opwek|solar|pv|generat|opbrengst/i,
    colPrice:     /prijs|price|tarief|eur/i,
    colSignal:    /signal|signaal|grid|flex/i,
    colTemp:      /temp|\u00b0c|celsius|binnentemp|indoor/i,
  };
  Object.entries(patterns).forEach(([id, re]) => {
    const sel = document.getElementById(id); if(!sel) return;
    const match = headers.find(h => re.test(h));
    if (match) sel.value = match;
  });
}

function renderPreviewTable(rows, headers) {
  const tbl = document.getElementById('previewTable');
  if (!tbl) return;
  tbl.innerHTML = '<thead><tr>' + headers.map(h=>`<th>${h}</th>`).join('') + '</tr></thead>'
    + '<tbody>' + rows.map(r=>'<tr>'+headers.map(h=>`<td>${r[h]??''}</td>`).join('')+'</tr>').join('') + '</tbody>';
}

