/**
 * compute.js — berekeningen
 * WEii-protocol v3.1 (TVVL/DGBC jan 2026)
 * CO2: NED EmissionFactor data (ef-data.js)
 */

const EF_ELEKTRA = 229;
const EF_WARMTE  = 65;
const EF_GAS     = 1884;
const WEII_GRENZEN = {
  kantoor:         [46,  70, 105, 160, 240],
  restaurant:      [175,270, 415, 695,1075],
  cafe:            [ 70, 90, 140, 250, 450],
  kinderopvang:    [ 50, 80, 130, 195, 285],
  sauna:           [160,200, 300, 500,1330],
  bijeenkomst:     [ 70, 90, 130, 245, 415],
  ziekenhuis:      [100,135, 185, 315, 500],
  tehuis:          [ 80,115, 160, 285, 455],
  praktijk:        [ 80,110, 150, 270, 420],
  bedrijfshal:     [-10, 20,  70, 115, 170],
  hotel:           [110,140, 210, 375, 640],
  onderwijs_basis: [ 60, 85, 120, 165, 290],
  onderwijs_ho:    [ 70, 90, 125, 225, 380],
  sport_binnen:    [ 70, 90, 140, 245, 435],
  zwembad:         [210,300, 430, 765,1365],
  winkel_koel:     [150,175, 300, 525, 925],
  winkel:          [ 80,100, 165, 290, 520],
  appartement:     [ 45, 65, 100, 150, 180],
  woning:          [ 35, 55,  90, 140, 170],
};
const KLASSE_NAMEN = ['WENG','Paris Proof','Zeer Zuinig','Zuinig','Gemiddeld','Onzuinig','Zeer Onzuinig'];
const KLASSE_CSS   = ['cls-weng','cls-paris','cls-zzuinig','cls-zuinig','cls-gemiddeld','cls-onzuinig','cls-zonzuinig'];
const ZOOM_CFG = {
  zoom: { wheel:{enabled:true}, pinch:{enabled:true}, mode:'x' },
  pan:  { enabled:true, mode:'x' }
};

function buildTypedRows(rows, mapping) {
  return rows.map((r,i) => {
    const tsRaw = r[mapping.timestamp];
    let ts = tsRaw instanceof Date ? tsRaw : new Date(tsRaw);
    if (isNaN(ts)) ts = null;
    return {
      _i: i, ts,
      elektra: parseFloatSafe(r[mapping.elektra]),
      warmte:  mapping.warmte  ? parseFloatSafe(r[mapping.warmte])  : NaN,
      gas:     mapping.gas     ? parseFloatSafe(r[mapping.gas])     : NaN,
      opwek:   mapping.opwek   ? parseFloatSafe(r[mapping.opwek])   : NaN,
      price:   mapping.price   ? parseFloatSafe(r[mapping.price])   : NaN,
      signal:  mapping.signal  ? parseFloatSafe(r[mapping.signal])  : NaN,
      temp:    mapping.temp    ? parseFloatSafe(r[mapping.temp])    : NaN,
    };
  });
}

function validateAndClean(rows) {
  const warnings = [];
  let nullTs = 0, nullKwh = 0;
  const clean = rows.filter(r => {
    if (!r.ts || isNaN(r.ts)) { nullTs++; return false; }
    if (isNaN(r.elektra) || r.elektra < 0) { nullKwh++; return false; }
    return true;
  }).sort((a,b) => a.ts - b.ts);
  if (nullTs)  warnings.push(`${nullTs} rijen zonder geldig tijdstempel verwijderd.`);
  if (nullKwh) warnings.push(`${nullKwh} rijen zonder geldig elektraverbruik verwijderd.`);
  return { cleanRows: clean, warnings };
}

function detectInterval(rows) {
  if (rows.length < 2) return 60;
  const diffs = [];
  for (let i=1; i<Math.min(rows.length,20); i++) {
    const d = (rows[i].ts - rows[i-1].ts) / 60000;
    if (d > 0) diffs.push(d);
  }
  if (!diffs.length) return 60;
  diffs.sort((a,b)=>a-b);
  return diffs[Math.floor(diffs.length/2)];
}

function computeCO2Extended(rows, efData) {
  let totElektra=0, totWarmte=0, totGas=0, totOpwek=0, totalCO2_g=0;
  rows.forEach(r => {
    const e = r.elektra||0, w = r.warmte||0, g = r.gas||0, op = isNaN(r.opwek)?0:r.opwek;
    totElektra += e; totWarmte += w; totGas += g; totOpwek += op;
    const ef = r.ts ? getElektraEF(r.ts) : EF_ELEKTRA; // g CO\u2082/kWh uit NED maanddata
    totalCO2_g += e * ef + w * EF_WARMTE + g * EF_GAS; // warmte: 65 gCO\u2082/kWh, GEEN weegfactor (die geldt alleen voor primaire energie)
  });
  return {
    totElektra: Math.round(totElektra*10)/10,
    totWarmte:  Math.round(totWarmte*10)/10,
    totGas:     Math.round(totGas*10)/10,
    totOpwek:   Math.round(totOpwek*10)/10,
    totalCO2_kg: Math.round(totalCO2_g/1000),
    co2PerKwh: totElektra>0 ? Math.round(totalCO2_g/totElektra) : 0,
    nedEfUsed: !!window.NED_EF, // true als ned_ef_data.js geladen is
  };
}

function computeScores(rows, peakPct, offpeakPct) {
  if (!rows.length) return {};
  const vals = rows.map(r=>r.elektra).filter(v=>!isNaN(v)&&v>=0).sort((a,b)=>a-b);
  const avg = vals.reduce((s,v)=>s+v,0)/vals.length;
  const mx  = vals[vals.length-1];
  const PAR = avg>0 ? mx/avg : 1;
  const PAR_best=1.2, PAR_worst=4.0;
  const scoreFlatness = Math.round(clamp(100*(PAR_worst-PAR)/(PAR_worst-PAR_best),0,100));

  const n = vals.length;
  const peakThreshold    = vals[Math.floor(n*(1-peakPct))] ?? vals[n-1];
  const offpeakThreshold = vals[Math.floor(n*offpeakPct)]  ?? vals[0];
  const peakRows = rows.filter(r=>r.elektra>=peakThreshold);
  const peakKwh  = peakRows.reduce((s,r)=>s+r.elektra,0);
  const totKwh   = rows.reduce((s,r)=>s+(r.elektra||0),0);
  const peakShare = totKwh>0 ? peakKwh/totKwh : 0;
  const scoreFlex = Math.round(clamp(100*peakShare*2,0,100));

  // TOU: gebruik signaal, prijs of EF
  let scoreTOU = null;
  const hasSig = rows.some(r=>!isNaN(r.signal));
  const hasPrc = rows.some(r=>!isNaN(r.price));
  if (hasSig||hasPrc) {
    let wSum=0, kSum=0;
    rows.forEach(r => {
      const k = r.elektra||0;
      let s = hasSig&&!isNaN(r.signal) ? r.signal
            : hasPrc&&!isNaN(r.price)  ? (1-clamp(r.price/0.4,0,1))
            : 0.5;
      wSum+=k*s; kSum+=k;
    });
    scoreTOU = kSum>0 ? Math.round(clamp(wSum/kSum*100,0,100)) : null;
  }

  return { scoreFlatness, scoreFlex, scoreTOU, PAR:Math.round(PAR*100)/100, peakThreshold, peakShare:Math.round(peakShare*1000)/10 };
}

function computeWeii(co2Result, rows) {
  const ag   = parseFloat(document.getElementById('weiiAg')?.value);
  const type = document.getElementById('weiiGebruikstype')?.value||'';
  const grenzen = WEII_GRENZEN[type] || WEII_GRENZEN['kantoor'];
  if (!ag||ag<=0) return { score:null, klasse:null, grenzen, ag:null };

  const { totElektra, totWarmte, totGas, totOpwek } = co2Result;
  const teruglevering = totOpwek * 0.4;
  const eigenGebruik  = totOpwek - teruglevering;
  const eIn  = totElektra + totWarmte*0.33 + totGas*9.77;
  const eTot = eIn - teruglevering;

  const tsArr = rows.map(r=>r.ts).filter(Boolean).sort((a,b)=>a-b);
  let factor=1, nDagen=0;
  if (tsArr.length>1) { nDagen=(tsArr[tsArr.length-1]-tsArr[0])/86400000; if(nDagen>0&&nDagen<350) factor=365/nDagen; }

  const weiiScore = Math.round(eTot*factor/ag);
  let klasse = 6;
  if (weiiScore <= 0)           klasse = 0; // WENG
  else if (weiiScore <= grenzen[0]) klasse = 1; // Paris Proof
  else if (weiiScore <= grenzen[1]) klasse = 2; // Zeer Zuinig
  else if (weiiScore <= grenzen[2]) klasse = 3; // Zuinig
  else if (weiiScore <= grenzen[3]) klasse = 4; // Gemiddeld
  else if (weiiScore <= grenzen[4]) klasse = 5; // Onzuinig
  else klasse = 6; // Zeer Onzuinig

  const weiiFinaal       = Math.round((eIn+eigenGebruik)*factor/ag);
  const weiiGas          = totGas>0  ? Math.round(totGas*9.77*factor/ag) : null;
  const weiiCO2          = ag>0      ? Math.round(co2Result.totalCO2_kg*factor/ag*10)/10 : null;
  const finaal           = eIn+eigenGebruik-teruglevering;
  const dekkingsgraad    = totOpwek>0 ? Math.round(eigenGebruik/Math.max(finaal,1)*1000)/10 : null;
  const benuttingsfactor = totOpwek>0 ? Math.round(eigenGebruik/totOpwek*1000)/10 : null;

  return { score:weiiScore, klasse, grenzen, ag, factor, nDagen, weiiFinaal, weiiGas, weiiCO2, dekkingsgraad, benuttingsfactor, eigenGebruik };
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

function heatColor(v, mx) { const a=mx>0?v/mx:0; return `rgba(224,122,47,${.1+.9*a})`; }

