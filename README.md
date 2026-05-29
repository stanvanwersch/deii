# DEII — Dynamische Energie-intensiteit Indicator

WEii-analyse dashboard op basis van het WEii-protocol v3.1 (TVVL/DGBC jan 2026).

## Structuur

```
deii-framework/
├── index.html          # Hoofd HTML-pagina
├── css/
│   └── style.css       # Alle stijlen
├── js/
│   ├── utils.js        # Hulpfuncties (fmt, clamp, etc.)
│   ├── upload.js       # Excel-upload en kolomherkenning
│   ├── compute.js      # WEii, CO2, scores berekeningen
│   ├── render.js       # Dashboard, grafieken, Energiekompas
│   ├── analysis.js     # Orkestratie: upload → berekening → weergave
│   └── api-connector.js # API-koppelingen (NED, PDOK, EP-Online)
├── data/
│   └── ef-data.js      # NED CO2-emissiefactoren 2021-2026
└── .nojekyll           # GitHub Pages: Jekyll uitschakelen
```

## API-koppelingen toevoegen

Alle API-connectors staan in `js/api-connector.js`. Elke connector implementeert:

```javascript
class MijnConnector {
  constructor(apiKey) { ... }
  async test()                    // Verbinding testen → {ok, message}
  async fetchEFData(from, to)     // CO2-data → {'YYYY-MM-DDTHH': g/kWh}
}

// Registreer
ApiRegistry.register('mijn-api', new MijnConnector(apiKey));
```

### Beschikbare connectors

| Connector | API | Endpoint |
|-----------|-----|----------|
| `NedConnector` | NED ElectricityMix | `api.ned.nl/v1/utilizations` |
| `PdokConnector` | PDOK / BAG | `api.pdok.nl` |
| `EpOnlineConnector` | RVO EP-Online | `public.ep-online.nl/api/v4` |

### NED API activeren

```javascript
// In de browser console of via een instellingenpaneel:
const ned = new NedConnector('jouw-api-sleutel');
ApiRegistry.register('ned', ned);

// Test
const result = await ned.test();
console.log(result.message);
```

## GitHub Pages deployen

1. Push alle bestanden naar de `main` branch
2. Ga naar Settings → Pages
3. Source: **Deploy from a branch** → `main` → `/ (root)`
4. Wacht 2 minuten → beschikbaar op `https://[gebruiker].github.io/[repo]/`

## WEii-protocol

Grenzen conform Tabel 4, WEii-protocol v3.1 (TVVL/DGBC, januari 2026).
CO2-emissiefactoren: NED ElectricityMix, maandgemiddelden 2021–2026.
