/**
 * render.js — dashboard weergave
 * Chart.js grafieken, WEii-tabel, Energiekompas
 */

let chartInstances = {};

function destroyCharts() {
  Object.values(chartInstances).forEach(c=>c?.destroy?.());
  chartInstances = {};
}

function renderKpis(co2, scores, weii) {
  const sv = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  sv('kpiElektra', fmt(co2.totElektra,0));
  sv('kpiWarmte',  fmt(co2.totWarmte,0));
  sv('kpiGas',     fmt(co2.totGas,0));
  sv('kpiOpwek',   fmt(co2.totOpwek,0));
  sv('kpiCO2',     fmt(co2.totalCO2_kg,0));
  sv('kpiCO2pkwh', co2.co2PerKwh);

  const setBar = (barId, val) => { const b=document.getElementById(barId); if(b) requestAnimationFrame(()=>b.style.width=clamp(val,0,100)+'%'); };
  if (scores.scoreFlatness!=null) { sv('kpiFlatness',scores.scoreFlatness); sv('kpiPAR',scores.PAR); setBar('flatnessBar',scores.scoreFlatness); }
  if (scores.scoreFlex!=null)     { sv('kpiFlex',scores.scoreFlex); setBar('flexBar',scores.scoreFlex); }
  if (scores.scoreTOU!=null)      { sv('kpiTOU',scores.scoreTOU); setBar('touBar',scores.scoreTOU); }
  else sv('kpiTOU','N/A');

  if (weii?.score!=null) {
    sv('kpiWeii', weii.score);
    const kEl = document.getElementById('kpiWeiiClass');
    if (kEl) kEl.innerHTML = `<span class="class-badge ${KLASSE_CSS[weii.klasse]}">${KLASSE_NAMEN[weii.klasse]}</span>`;
  }
}

function renderIntervalKpi(intervalMin, rows) {
  const hLabel = intervalMin<=1?'Minuut':intervalMin<=15?'Kwartier':intervalMin<=60?'Uur':intervalMin<=1440?'Dag':intervalMin<=10080?'Week':'Jaar';
  const sv = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  sv('kpiInterval', hLabel);
  const n = rows.length;
  if (n<2) { sv('kpiIntervalSub', n+' meetpunt'); return; }
  const spanMin = (rows[n-1].ts-rows[0].ts)/60000;
  const sl = spanMin<60?`${spanMin.toFixed(0)} min`:spanMin<1440?`${(spanMin/60).toFixed(1)} uur`:spanMin<10080?`${(spanMin/1440).toFixed(1)} dagen`:`${(spanMin/10080).toFixed(1)} weken`;
  sv('kpiIntervalSub', `${n.toLocaleString('nl-NL')} punten \u00b7 ${sl}`);
}

function renderWeiiDetails(weii, co2, rows, mapping) {
  const sv = (id,v) => { const e=document.getElementById(id); if(e) e.innerHTML=v; };
  if (weii?.score!=null) {
    sv('weiiValScore', weii.score);
    sv('weiiDetails', `<span class="class-badge ${KLASSE_CSS[weii.klasse]}">${KLASSE_NAMEN[weii.klasse]}</span>${weii.nDagen>0?` <span style="font-size:11px;color:var(--text3)">(${weii.nDagen.toFixed(0)} dgn)</span>`:''}`);
  } else { sv('weiiValScore','\u2014'); sv('weiiDetails','<span class="wi-na">Stel gebruikstype + Ag in</span>'); }

  if (weii?.weiiFinaal!=null) {
    sv('weiiValFinaal', weii.weiiFinaal);
    sv('weiiFinaalDetails', `<span style="font-size:11.5px;color:var(--text2)">+${Math.round((weii.weiiFinaal-weii.score)*10)/10} kWh/m\u00b2 (PV eigengebruik)</span>`);
  } else { sv('weiiValFinaal','\u2014'); sv('weiiFinaalDetails','<span class="wi-na">Vereist opwekkolom + Ag</span>'); }

  if (weii?.weiiGas!=null) {
    sv('weiiValGas', weii.weiiGas);
    sv('weiiGasDetails', `<span style="font-size:11.5px;color:var(--text2)">${fmt(co2.totGas,0)} m\u00b3 \u2192 ${fmt(co2.totGas*9.77,0)} kWh/jaar</span>`);
  } else { sv('weiiValGas','\u2014'); sv('weiiGasDetails','<span class="wi-na">Vereist gaskolom + Ag</span>'); }

  sv('weiiValCO2', weii?.weiiCO2??'\u2014');
  sv('weiiCO2Details', weii?.weiiCO2!=null ? `<span style="font-size:11.5px;color:var(--text2)">Totaal: ${fmt(co2.totalCO2_kg,0)} kg CO\u2082/jaar</span>` : '<span class="wi-na">Vereist Ag</span>');
  sv('weiiValCO2abs', fmt(co2.totalCO2_kg,0));
  sv('weiiEFDetails', `<span style="font-size:11.5px;color:var(--text2)">Elektra: ${fmt(co2.co2PerKwh,0)} g\u00a0CO\u2082/kWh gem. \u00b7 Warmte: 65\u00a0g/kWh \u00b7 Gas: 1.884\u00a0g/m\u00b3 \u00b7 bron: ${co2.nedEfUsed?'NED uur-data':'NED maandgemiddelden'}</span>`);
  sv('weiiCO2absDetails', `<span style="font-size:11.5px;color:var(--text2)">${fmt(co2.co2PerKwh,0)}\u00a0gCO\u2082/kWh gem.\u00a0\u00b7\u00a0${co2.nedEfUsed?'NED uur-data (2021-2026)':'NED maandgemiddelden (2021-2026)'}</span>`);

  if (weii?.dekkingsgraad!=null) {
    sv('weiiValDek', weii.dekkingsgraad+'%');
    sv('weiiDekkingDetails', `<span style="font-size:11.5px;color:var(--text2)">${fmt(weii.eigenGebruik,0)} kWh eigen gebruik</span>`);
  } else { sv('weiiValDek','\u2014'); sv('weiiDekkingDetails','<span class="wi-na">Vereist opwekkolom</span>'); }

  if (weii?.benuttingsfactor!=null) {
    sv('weiiValBen', weii.benuttingsfactor+'%');
    sv('weiiBenuttingDetails', `<span style="font-size:11.5px;color:var(--text2)">${fmt(co2.totOpwek,0)} kWh totale opwek</span>`);
  } else { sv('weiiValBen','\u2014'); sv('weiiBenuttingDetails','<span class="wi-na">Vereist opwekkolom</span>'); }
}

function calcBesparing() {
  const ref = parseFloat(document.getElementById('weiiRef')?.value);
  if (!analysisResult?.weiiResult) { alert('Voer eerst een analyse uit.'); return; }
  const score = analysisResult.weiiResult.score;
  if (score==null) { alert('Geen WEii-score beschikbaar.'); return; }
  if (isNaN(ref)||ref<=0) { alert('Voer een geldige referentie-WEii in.'); return; }
  const besp = Math.round((1-score/ref)*1000)/10;
  const sv = (id,v) => { const e=document.getElementById(id); if(e) e.innerHTML=v; };
  sv('weiiValBesp', besp+'%');
  const col = besp>0?'var(--green)':besp<0?'var(--red)':'var(--text2)';
  sv('weiiBesparingDetails', `<span style="font-size:11.5px;color:${col}">${besp>0?'\u25bc':'\u25b2'} ${Math.abs(besp)}% t.o.v. ${fmt(ref,0)} kWh/m\u00b2</span>`);
}

function renderEnergiekompas(weiiResult) {
  const label  = document.getElementById('energielabel')?.value;
  const wrap   = document.getElementById('energiekompasWrap');
  const notice = document.getElementById('energiekompasNotice');
  const legend = document.getElementById('energiekompasLegend');
  if (!wrap) return;

  if (!label || weiiResult?.klasse == null) {
    if (notice) notice.classList.remove('hidden');
    wrap.innerHTML = '';
    if (legend) legend.classList.add('hidden');
    return;
  }
  if (notice) notice.classList.add('hidden');
  if (legend) legend.classList.remove('hidden');

  // WEii-klasse kleuren conform afbeelding (boven=ZeerOnzuinig, onder=WENG)
  const RIJEN = [
    { naam: 'Zeer onzuinig', kleur: '#e8192c', tekst: '#fff', klasse: 6 },
    { naam: 'Onzuinig',      kleur: '#d42230', tekst: '#fff', klasse: 5 },
    { naam: 'Gemiddeld',     kleur: '#a0204e', tekst: '#fff', klasse: 4 },
    { naam: 'Zuinig',        kleur: '#6b2d8b', tekst: '#fff', klasse: 3 },
    { naam: 'Zeer zuinig',   kleur: '#4b2d82', tekst: '#fff', klasse: 2 },
    { naam: 'Paris Proof',   kleur: '#2d3177', tekst: '#fff', klasse: 1 },
    { naam: 'WENG',          kleur: '#1a1f5e', tekst: '#fff', klasse: 0 },
  ];

  // Energielabels X-as conform afbeelding
  const LABELS = [
    { naam: 'G',    kleur: '#e8192c' },
    { naam: 'F',    kleur: '#e8461a' },
    { naam: 'E',    kleur: '#e87a1a' },
    { naam: 'D',    kleur: '#e8c21a' },
    { naam: 'C',    kleur: '#9ac41a' },
    { naam: 'B',    kleur: '#4caf50' },
    { naam: 'A',    kleur: '#1b8a3e' },
    { naam: 'A+',   kleur: '#1b8a3e' },
    { naam: 'A++',  kleur: '#1b8a3e' },
    { naam: 'A+++', kleur: '#1b8a3e' },
    { naam: 'A++++',kleur: '#1b8a3e' },
  ];

  const labelIdx = LABELS.findIndex(l => l.naam === label);
  const weiiIdx  = RIJEN.findIndex(r => r.klasse === weiiResult.klasse);

  // SVG afmetingen
  const labelW = 112, cellW = 68, cellH = 52;
  const headerH = 56, footerH = 28;
  const svgW = labelW + LABELS.length * cellW;
  const svgH = headerH + RIJEN.length * cellH + footerH;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:${svgW}px;display:block;font-family:'Poppins',sans-serif;">`;

  // Achtergrond
  svg += `<rect width="${svgW}" height="${svgH}" fill="#fff"/>`;

  // \u2500\u2500 Rijen (WEii-klasse blokken + raster cellen) \u2500\u2500
  RIJEN.forEach((rij, ri) => {
    const y = headerH + ri * cellH;
    const isActief = ri === weiiIdx;

    // Gekleurde WEii-label blok links
    const bx = 4, by = y + 4, bw = labelW - 8, bh = cellH - 8;
    svg += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8" fill="${rij.kleur}"/>`;
    // Tekst in het blok (twee regels als nodig)
    const woorden = rij.naam.split(' ');
    if (woorden.length === 1) {
      svg += `<text x="${bx + bw/2}" y="${by + bh/2 + 5}" text-anchor="middle" font-size="13" font-weight="600" fill="${rij.tekst}">${rij.naam}</text>`;
    } else {
      svg += `<text x="${bx + bw/2}" y="${by + bh/2 - 4}" text-anchor="middle" font-size="12" font-weight="600" fill="${rij.tekst}">${woorden[0]}</text>`;
      svg += `<text x="${bx + bw/2}" y="${by + bh/2 + 11}" text-anchor="middle" font-size="12" font-weight="600" fill="${rij.tekst}">${woorden.slice(1).join(' ')}</text>`;
    }

    // Raster cellen
    LABELS.forEach((lbl, li) => {
      const x = labelW + li * cellW;
      const isCel = ri === weiiIdx && li === labelIdx;
      svg += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${isCel ? '#fff7ed' : '#fafafa'}" stroke="#e0ddd8" stroke-width="0.5"/>`;
      // Gestippelde horizontale lijn (conform afbeelding)
      if (ri < RIJEN.length - 1) {
        svg += `<line x1="${labelW}" y1="${y + cellH}" x2="${svgW}" y2="${y + cellH}" stroke="#ccc" stroke-width="0.8" stroke-dasharray="4,4"/>`;
      }
    });
  });

  // \u2500\u2500 Gebouwpunt als oranje cirkel \u2500\u2500
  if (weiiIdx >= 0 && labelIdx >= 0) {
    const cx = labelW + labelIdx * cellW + cellW / 2;
    const cy = headerH + weiiIdx * cellH + cellH / 2;
    svg += `<circle cx="${cx}" cy="${cy}" r="16" fill="#e07a2f" stroke="#fff" stroke-width="2.5"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="6" fill="#fff"/>`;
    // Tooltip-achtige label
    const lx = cx + 20, ly = cy - 8;
    svg += `<rect x="${lx}" y="${ly}" width="80" height="22" rx="4" fill="#1c1a17" opacity=".85"/>`;
    svg += `<text x="${lx + 40}" y="${ly + 15}" text-anchor="middle" font-size="11" font-weight="600" fill="#fff">${label} \u00b7 ${RIJEN[weiiIdx].naam.split(' ')[0]}</text>`;
  }

  // \u2500\u2500 X-as labels (energielabel badges) \u2500\u2500
  LABELS.forEach((lbl, li) => {
    const x = labelW + li * cellW + cellW / 2;
    const y = headerH + RIJEN.length * cellH + 8;
    // Badge cirkel
    svg += `<rect x="${x - 18}" y="${y}" width="36" height="20" rx="4" fill="${lbl.kleur}"/>`;
    const tekst = lbl.naam.replace(/\+/g, '\u207a');
    svg += `<text x="${x}" y="${y + 14}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${lbl.naam}</text>`;
  });

  // X-as titel
  svg += `<text x="${labelW + LABELS.length * cellW / 2}" y="${svgH - 3}" text-anchor="middle" font-size="10" font-weight="600" fill="#2d5fa0">Energielabel</text>`;

  svg += '</svg>';
  wrap.innerHTML = svg;

  // Tekstuele duiding
  const diff = (weiiIdx / 6) - (1 - labelIdx / 10);
  const wNaam = RIJEN[weiiIdx]?.naam || '';
  let duiding = Math.abs(diff) <= 0.15
    ? `<strong>Consistent</strong>: WEii-klasse ${wNaam} sluit goed aan bij energielabel ${label}.`
    : diff > 0.35
    ? `<strong>Groot prestatiegat</strong>: label ${label} suggereert een energiezuinig gebouw, maar het werkelijk gebruik correspondeert met WEii-klasse ${wNaam}. Nader onderzoek aanbevolen.`
    : diff > 0.15
    ? `<strong>Licht prestatiegat</strong>: werkelijk gebruik (${wNaam}) is iets hoger dan label ${label} verwacht.`
    : `<strong>Beter dan label</strong>: WEii-klasse ${wNaam} is gunstiger dan label ${label} suggereert.`;

  const duidingEl = document.getElementById('energiekompasduiding');
  if (duidingEl) { duidingEl.innerHTML = duiding; duidingEl.style.display = 'block'; }
}

function renderCharts(rows, mapping, scores, co2, efData) {
  destroyCharts();
  const maxPts=2000, step=rows.length>maxPts?Math.ceil(rows.length/maxPts):1;
  const sampled = rows.filter((_,i)=>i%step===0);
  const labels  = sampled.map(r=>formatDate(r.ts));

  // \u2500\u2500 Tijdreeks elektra (+ opwek + temperatuur als beschikbaar) \u2500\u2500
  const datasets = [{
    label:'Elektra (kWh)', data:sampled.map(r=>r.elektra),
    borderColor:'#e07a2f', borderWidth:1.5, pointRadius:0, fill:false, tension:.3,
  }];
  if (sampled.some(r=>!isNaN(r.opwek)&&r.opwek>0)) datasets.push({
    label:'Opwek (kWh)', data:sampled.map(r=>isNaN(r.opwek)?null:r.opwek),
    borderColor:'#1a6e3c', borderWidth:1.5, pointRadius:0, fill:false, tension:.3,
  });
  if (sampled.some(r=>!isNaN(r.warmte)&&r.warmte>0)) datasets.push({
    label:'Warmte (kWh)', data:sampled.map(r=>isNaN(r.warmte)?null:r.warmte),
    borderColor:'#1d5fa8', borderWidth:1.2, pointRadius:0, fill:false, tension:.3,
  });
  // Basisbelasting: minimum rollend venster (gemiddelde laagste 10% per uur)
  const sortedVals = [...sampled.map(r=>r.elektra||0)].sort((a,b)=>a-b);
  const baseVal = sortedVals[Math.floor(sortedVals.length*0.1)] || 0;
  datasets.push({
    label:'Basisbelasting (kWh)', data:sampled.map(()=>Math.round(baseVal*1000)/1000),
    borderColor:'#9333ea', borderWidth:1, pointRadius:0,
    fill:false, tension:0, borderDash:[4,3], hidden:true,
  });
  // Netbelasting: elektra minus opwek (netto netafname)
  if (sampled.some(r=>!isNaN(r.opwek)&&r.opwek>0)) datasets.push({
    label:'Netbelasting (kWh)', data:sampled.map(r=>Math.round(((r.elektra||0)-(isNaN(r.opwek)?0:r.opwek))*1000)/1000),
    borderColor:'#b45309', borderWidth:1.2, pointRadius:0, fill:false, tension:.3, hidden:true,
  });

  const hasTemp = sampled.some(r=>!isNaN(r.temp));
  if (hasTemp) datasets.push({
    label:'Temperatuur (\u00b0C)', data:sampled.map(r=>isNaN(r.temp)?null:r.temp),
    borderColor:'#9333ea', borderWidth:1.2, pointRadius:0, fill:false, tension:.3,
    yAxisID:'yTemp',
  });

  chartInstances.timeseries = new Chart(document.getElementById('chartTimeseries'), {
    type:'line',
    data:{ labels, datasets },
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      interaction:{ mode:'index', intersect:false },
      scales:{
        x:{ ticks:{maxTicksLimit:10,maxRotation:0}, grid:{color:'rgba(0,0,0,.04)'} },
        y:{ title:{display:true,text:'kWh',font:{size:10}}, grid:{color:'rgba(0,0,0,.04)'} },
        ...(hasTemp?{yTemp:{position:'right',title:{display:true,text:'\u00b0C',font:{size:10}},grid:{drawOnChartArea:false}}}:{}),
      },
      plugins:{
        legend:{labels:{boxWidth:10,font:{size:11}}},
        zoom: ZOOM_CFG,
        tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${fmt(ctx.raw,2)}`}},
      }
    }
  });

  // \u2500\u2500 CO2 tijdreeks \u2500\u2500
  const EF = EF_ELEKTRA;
  chartInstances.co2 = new Chart(document.getElementById('chartCO2TS'), {
    type:'line',
    data:{ labels, datasets:[{
      label:'CO\u2082 (g)', data:sampled.map(r=>{ const tsKey=r.ts?r.ts.toISOString().slice(0,13):''; return Math.round(r.elektra*((efData&&efData[tsKey])||EF)); }),
      borderColor:'#b91c1c', borderWidth:1.2, pointRadius:0, fill:true,
      backgroundColor:'rgba(185,28,28,.07)', tension:.3,
    }]},
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      scales:{ x:{ticks:{maxTicksLimit:8,maxRotation:0},grid:{color:'rgba(0,0,0,.04)'}}, y:{grid:{color:'rgba(0,0,0,.04)'}} },
      plugins:{ legend:{display:false}, zoom: ZOOM_CFG },
    }
  });

  // \u2500\u2500 Uurgemiddelde \u2500\u2500
  const hourAvg = computeHourlyAvg(rows);
  chartInstances.hourly = new Chart(document.getElementById('chartHourly'), {
    type:'bar',
    data:{ labels:Array.from({length:24},(_,i)=>i+'u'), datasets:[{
      label:'Gem. kWh/uur', data:hourAvg.map(v=>Math.round(v*1000)/1000),
      backgroundColor:'rgba(224,122,47,.7)', borderRadius:2,
    }]},
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      plugins:{ legend:{display:false} },
      scales:{ x:{grid:{display:false}}, y:{grid:{color:'rgba(0,0,0,.04)'}} }
    }
  });

  // \u2500\u2500 Temperatuur grafiek (apart, alleen indien beschikbaar) \u2500\u2500
  const tempCard = document.getElementById('tempChartCard');
  if (hasTemp && tempCard) {
    tempCard.classList.remove('hidden');
    const hourTempAvg = computeHourlyAvgField(rows, 'temp');
    chartInstances.temp = new Chart(document.getElementById('chartTemp'), {
      type:'line',
      data:{ labels:Array.from({length:24},(_,i)=>i+'u'), datasets:[{
        label:'Gem. temp (\u00b0C)', data:hourTempAvg.map(v=>Math.round(v*10)/10),
        borderColor:'#9333ea', borderWidth:2, pointRadius:3, fill:true,
        backgroundColor:'rgba(147,51,234,.07)', tension:.4,
      }]},
      options:{
        responsive:true, maintainAspectRatio:false, animation:false,
        plugins:{ legend:{display:false} },
        scales:{ x:{grid:{display:false}}, y:{title:{display:true,text:'\u00b0C',font:{size:10}},grid:{color:'rgba(0,0,0,.04)'}} }
      }
    });
  } else if (tempCard) tempCard.classList.add('hidden');

  // \u2500\u2500 Heatmap dag\u00d7uur \u2500\u2500
  renderHeatmap(rows);
}

function renderHeatmap(rows) {
  const wrap = document.getElementById('heatmapWrap'); if(!wrap) return;
  const days=['Ma','Di','Wo','Do','Vr','Za','Zo'];
  const grid=Array.from({length:7},()=>new Array(24).fill(0));
  const cnt =Array.from({length:7},()=>new Array(24).fill(0));
  rows.forEach(r=>{ if(!r.ts) return; const d=(r.ts.getDay()+6)%7,h=r.ts.getHours(); grid[d][h]+=r.elektra||0; cnt[d][h]++; });
  const avgs=grid.map((row,d)=>row.map((s,h)=>cnt[d][h]?s/cnt[d][h]:0));
  const flat=avgs.flat().filter(v=>v>0);
  const mx=flat.length?Math.max(...flat):1;

  let html='<div style="display:grid;grid-template-columns:32px repeat(24,1fr);gap:1px;font-size:9px;">';
  html+='<div></div>'+Array.from({length:24},(_,i)=>`<div style="text-align:center;color:var(--text3);padding:1px 0">${i}</div>`).join('');
  avgs.forEach((row,d)=>{
    html+=`<div style="color:var(--text2);font-weight:500;line-height:18px;text-align:right;padding-right:4px">${days[d]}</div>`;
    row.forEach(v=>{ const a=mx>0?v/mx:0,r=Math.round(217+38*a),g=Math.round(119-40*a),b=Math.round(47-20*a);
      html+=`<div title="${fmt(v,3)} kWh" style="height:18px;background:rgba(${r},${g},${b},${0.15+0.85*a});border-radius:1px"></div>`;
    });
  });
  html+='</div>';
  wrap.innerHTML=html;
}

function computeHourlyAvg(rows) {
  const sums=new Array(24).fill(0), counts=new Array(24).fill(0);
  rows.forEach(r=>{ if(!r.ts) return; const h=r.ts.getHours(); sums[h]+=r.elektra||0; counts[h]++; });
  return sums.map((s,i)=>counts[i]?s/counts[i]:0);
}

function computeHourlyAvgField(rows, field) {
  const sums=new Array(24).fill(0), counts=new Array(24).fill(0);
  rows.forEach(r=>{ if(!r.ts||isNaN(r[field])) return; const h=r.ts.getHours(); sums[h]+=r[field]; counts[h]++; });
  return sums.map((s,i)=>counts[i]?s/counts[i]:0);
}

