/**
 * ef-data.js — NED CO2-emissiefactoren (g CO2/kWh)
 * Bron: NED ElectricityMix 2021-2026, maandgemiddelden
 * Vervang door API-koppeling voor live data:
 *   GET https://api.ned.nl/v1/utilizations?type=11&granularity=5&...
 *   Veld: emissionfactor (kg CO2/kWh) * 1000 = g CO2/kWh
 */

const NED_EF_MONTHLY = {"2020-12":361,"2021-01":310,"2021-02":280,"2021-03":277,"2021-04":248,"2021-05":242,"2021-06":281,"2021-07":290,"2021-08":261,"2021-09":306,"2021-10":298,"2021-11":330,"2021-12":341,"2022-01":239,"2022-12":142,"2023-01":249,"2023-02":284,"2023-03":245,"2023-04":243,"2023-05":190,"2023-06":189,"2023-07":165,"2023-08":210,"2023-09":224,"2023-10":212,"2023-11":215,"2023-12":206,"2024-01":220,"2024-02":200,"2024-03":197,"2024-04":155,"2024-05":189,"2024-06":167,"2024-07":162,"2024-08":185,"2024-09":201,"2024-10":246,"2024-11":270,"2024-12":225,"2025-01":271,"2025-02":272,"2025-03":253,"2025-04":234,"2025-05":133,"2025-06":137,"2025-07":199,"2025-08":213,"2025-09":176,"2025-10":207,"2025-11":236,"2025-12":214,"2026-01":264,"2026-02":236,"2026-03":213,"2026-04":192,"2026-05":193};

function getElektraEF(ts) {
  // Geeft g CO\u2082/kWh voor een gegeven tijdstip
  // 1. Uur-data via window.NED_EF (uit ned_ef_data.js indien geladen)
  if (window.NED_EF) {
    const eh = Math.floor(ts.getTime() / 3600000);
    // Binair zoeken in gesorteerde epochs
    const epochs = window.NED_EF.e;
    let lo = 0, hi = epochs.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (epochs[mid] === eh) return window.NED_EF.v[mid];
      else if (epochs[mid] < eh) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  // 2. Maandgemiddelde
  const mk = ts.getUTCFullYear() + '-' + String(ts.getUTCMonth()+1).padStart(2,'0');
  if (NED_EF_MONTHLY[mk]) return NED_EF_MONTHLY[mk];
  // 3. Standaard
  return 229; // langjarig gemiddelde uit NED data
}
