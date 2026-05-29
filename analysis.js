/**
 * analysis.js — hoofdorkestratie
 * Verbindt upload → compute → render
 * Hier voeg je API-koppelingen toe als extra datastappen.
 */

let analysisResult = null;

async function runAnalysis() {
  const mapping = {
    timestamp: document.getElementById('colTimestamp').value,
    elektra:   document.getElementById('colElektra').value,
    warmte:    document.getElementById('colWarmte')?.value  || '',
    gas:       document.getElementById('colGas')?.value     || '',
    opwek:     document.getElementById('colOpwek')?.value   || '',
    price:     document.getElementById('colPrice')?.value   || '',
    signal:    document.getElementById('colSignal')?.value  || '',
    temp:      document.getElementById('colTemp')?.value    || '',
  };
  if (!mapping.timestamp || !mapping.elektra) {
    alert('Selecteer minimaal een tijdstempel- en elektrakolom.'); return;
  }
  const peakPct    = parseFloat(document.getElementById('peakPct')?.value||10) / 100;
  const offpeakPct = peakPct;

  showLoading(true);
  setLoadingMsg('Data inlezen...');

  // EF-data via ingebouwde NED maandgemiddelden (getElektraEF functie)
  const efData = {}; // leeg - getElektraEF() wordt per rij aangeroepen

  setTimeout(() => {
    try {
      setLoadingMsg('Rijen bouwen...');
      const typedRows = buildTypedRows(rawData, mapping);
      const { cleanRows, warnings } = validateAndClean(typedRows);
      const intervalMin = detectInterval(cleanRows);

      setLoadingMsg('CO\u2082 berekenen...');
      const co2Result = computeCO2Extended(cleanRows, efData);

      setLoadingMsg('Scores berekenen...');
      const scores = computeScores(cleanRows, peakPct, offpeakPct);

      setLoadingMsg('WEii berekenen...');
      const weiiResult = computeWeii(co2Result, cleanRows);

      analysisResult = { mapping, cleanRows, intervalMin, co2Result, scores, weiiResult, warnings };

      setLoadingMsg('Dashboard opbouwen...');
      renderWarnings(warnings);
      renderKpis(co2Result, scores, weiiResult);
      renderIntervalKpi(intervalMin, cleanRows);
      renderCharts(cleanRows, mapping, scores, co2Result, efData);
      renderWeiiDetails(weiiResult, co2Result, cleanRows, mapping);
      renderEnergiekompas(weiiResult);

      document.getElementById('dashboard').classList.remove('hidden');
      document.getElementById('dashboard').scrollIntoView({ behavior:'smooth' });
    } catch(err) {
      alert('Analysefout: ' + err.message); console.error(err);
    } finally { showLoading(false); }
  }, 60);
}

function downloadJSON() {
  if (!analysisResult) return;
  const out={co2:analysisResult.co2Result,scores:analysisResult.scores,weii:analysisResult.weiiResult,intervalMin:analysisResult.intervalMin,rows:analysisResult.cleanRows.length};
  downloadBlob(JSON.stringify(out,null,2),'energieprofiel.json','application/json');
}

function downloadCSV() {
  if (!analysisResult) return;
  const {co2,scores,weiiResult:w,intervalMin}=analysisResult;
  const rows=[['Indicator','Waarde','Eenheid'],
    ['Interval',intervalMin,'min'],['Elektra',co2.totElektra,'kWh'],['Warmte',co2.totWarmte,'kWh'],
    ['Gas',co2.totGas,'m3'],['Opwek',co2.totOpwek,'kWh'],['CO2',co2.totalCO2_kg,'kg'],
    ['CO2/kWh',co2.co2PerKwh,'g/kWh'],['Vlakheid',scores.scoreFlatness,'0-100'],
    ['TOU',scores.scoreTOU??'N/A','0-100'],['Flex',scores.scoreFlex,'0-100'],
    ['WEii',w?.score??'','kWh/m2'],['WEii-klasse',w?.klasse!=null?KLASSE_NAMEN[w.klasse]:'',''],
    ['WEii-CO2',w?.weiiCO2??'','kg/m2'],['Dekkingsgraad',w?.dekkingsgraad??'','%'],
  ];
  downloadBlob(rows.map(r=>r.join(';')).join('\n'),'energieprofiel.csv','text/csv');
}

function resetDashboard() {
  rawData=[]; columnHeaders=[];
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('mappingSection').classList.add('hidden');
  // Herstel dropzone
  const dz2 = document.getElementById('dropZone');
  if (dz2) {
    dz2.style.padding = '';
    dz2.style.minHeight = '';
    const dz2T = dz2.querySelector('.upload-zone-title'); if(dz2T) dz2T.textContent = 'Sleep een Excel-bestand hierheen';
    const dz2S = dz2.querySelector('.upload-zone-sub'); if(dz2S) dz2S.textContent = 'of klik om te bladeren \u2014 .xlsx, .xls';
  }
  document.getElementById('fileInput').value='';
  destroyCharts();
}

