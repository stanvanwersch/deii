/**
 * api-connector.js — API-koppelingen
 * ==========================================================
 * Voeg hier nieuwe API-integraties toe als aparte klassen.
 * Elk connector implementeert dezelfde interface:
 *
 *   class MijnConnector {
 *     constructor(apiKey) { this.key = apiKey; }
 *     async test()              // verbinding testen, returns {ok, message}
 *     async fetchEFData(from, to) // returns { 'YYYY-MM-DDTHH': gCO2_kWh }
 *   }
 *
 * Registreer een connector via:
 *   ApiRegistry.register('ned', new NedConnector(apiKey));
 *
 * In analysis.js kun je dan ophalen:
 *   const efData = await ApiRegistry.get('ned')?.fetchEFData(d1, d2) ?? {};
 * ==========================================================
 */

// ── Centrale registry ──────────────────────────────────────────────────────
const ApiRegistry = {
  _connectors: {},
  register(name, connector) { this._connectors[name] = connector; },
  get(name) { return this._connectors[name] ?? null; },
  list() { return Object.keys(this._connectors); }
};

// ── NED API Connector (voorbeeld) ──────────────────────────────────────────
class NedConnector {
  constructor(apiKey) {
    this.key     = apiKey;
    this.baseUrl = 'https://api.ned.nl/v1';
    this.workingType = null;
  }

  /** Test verbinding en bepaal het juiste type-nummer. */
  async test() {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    for (const t of [11, 2, 1, 3, 4, 5, 6, 7, 8, 9, 10]) {
      try {
        const url = `${this.baseUrl}/utilizations?granularity=5&type=${t}&activity=1`
          + `&validfrom%5Bafter%5D=${yesterday}T00%3A00%3A00%2B02%3A00&itemsPerPage=1`;
        const res = await this._fetch(url);
        if (res.ok) {
          const d = await res.json();
          this.workingType = t;
          const n = d['hydra:totalItems'] ?? '?';
          return { ok: true, message: `Verbonden — type ${t} (${n} records)` };
        }
      } catch (e) { /* volgende type */ }
    }
    return { ok: false, message: 'Geen enkel type werkt. Controleer uw sleutel.' };
  }

  /** Haal uurlijkse CO2-emissiefactoren op als { 'YYYY-MM-DDTHH': gCO2/kWh } */
  async fetchEFData(dateFrom, dateTo) {
    if (!this.workingType) await this.test();
    const result = {};
    const toISO = d => d.toISOString().replace('Z', '+00:00');
    const params = new URLSearchParams({
      granularity: '5',
      granularitytimezone: 'Europe/Amsterdam',
      classification: '2',
      activity: '1',
      type: String(this.workingType ?? 11),
      point: '0',
      'validfrom[after]':  toISO(dateFrom),
      'validfrom[before]': toISO(dateTo),
      itemsPerPage: '200'
    });
    let url = `${this.baseUrl}/utilizations?${params}`, pages = 0;
    while (url && pages < 50) {
      const res = await this._fetch(url);
      if (!res.ok) break;
      const data = await res.json();
      for (const item of (data['hydra:member'] ?? [])) {
        const vf = item.validfrom ?? item.validFrom ?? '';
        if (!vf) continue;
        const key = new Date(vf).toISOString().slice(0, 13);
        // emissionfactor = gCO2/kWh (per OpenAPI spec)
        const ef = item.emissionfactor != null && parseFloat(item.emissionfactor) > 0
          ? parseFloat(item.emissionfactor)
          : (item.emission != null && item.volume != null && parseFloat(item.volume) > 0
              ? parseFloat(item.emission) * 1e6 / parseFloat(item.volume)
              : null);
        if (ef != null && ef > 0 && ef < 2000) result[key] = ef;
      }
      const next = data['hydra:view']?.['hydra:next'];
      url = next ? (next.startsWith('http') ? next : this.baseUrl.replace('/v1','') + next) : null;
      pages++;
    }
    return result;
  }

  /** Interne fetch met CORS-proxy fallback */
  async _fetch(url) {
    try {
      const r = await fetch(url, { headers: { 'X-AUTH-TOKEN': this.key, 'Accept': 'application/json' } });
      if (r.status !== 0) return r;
    } catch (e) {}
    // CORS-proxy fallback
    return fetch('https://corsproxy.io/?' + encodeURIComponent(url), {
      headers: { 'X-AUTH-TOKEN': this.key, 'Accept': 'application/json' }
    });
  }
}

// ── PDOK / BAG Connector (voorbeeld voor gebouwdata) ──────────────────────
class PdokConnector {
  constructor() { this.baseUrl = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1'; }

  /** Zoek BAG-pand op adres, returns { pandId, gebruiksoppervlakte, bouwjaar } */
  async searchAddress(query) {
    const url = `${this.baseUrl}/suggest?q=${encodeURIComponent(query)}&fq=type:adres&rows=5`;
    const res = await fetch(url);
    const data = await res.json();
    return data.response?.docs ?? [];
  }
}

// ── RVO EP-Online Connector (voorbeeld voor energielabels) ────────────────
class EpOnlineConnector {
  constructor(apiKey) { this.key = apiKey; }

  /** Haal energielabel op voor een adres (EP-Online API) */
  async fetchLabel(postcode, huisnummer) {
    // https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/{id}
    // Vereist API-sleutel via RVO
    const url = `https://public.ep-online.nl/api/v4/PandEnergielabel/Adres`
      + `?postcode=${encodeURIComponent(postcode)}&huisnummer=${huisnummer}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.key}`, 'Accept': 'application/json' }
    });
    return res.ok ? await res.json() : null;
  }
}
