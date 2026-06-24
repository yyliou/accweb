# Taiwan Crash Atlas · 台灣車禍視覺化地圖

An interactive, bilingual (Chinese/English) visualization of Taiwan's road traffic accidents (A1 fatal and A2 injury) built on [deck.gl](https://deck.gl) WebGL rendering and [MapLibre GL](https://maplibre.org) with a CARTO dark basemap. Designed for researchers, journalists, and the general public.

**Live site →** [yyliou.github.io](https://yyliou.github.io)  
**Data source →** [Taiwan National Police Agency — Road Traffic Accident Records (政府資料開放平臺)](https://data.gov.tw/datasets/search?p=1&size=10&s=_score_desc&rft=年傷亡道路交通事故資料)  
**Contact / Bug reports →** d10627008@ntu.edu.tw

---

## Overview

This project provides a three-panel dashboard for exploring Taiwan's road safety data:

| Panel | Description |
|---|---|
| **Trends** | Year-over-year quarterly line chart (deaths vs. injuries, dual Y-axis), monthly and hourly distributions, top vehicle types, and top counties |
| **Map** | GPU-rendered glowing point cloud (scatter / heatmap / hexbin); zoom-adaptive point size and opacity; filters by year, severity, county, and vehicle type; animated day-by-day playback |
| **Research** | Selected peer-reviewed publications using this dataset |

---

## Data & Preprocessing

Raw data from the National Police Agency is released as per-party CSV files (one row per crash participant). The preprocessing pipeline:

1. **De-duplication** — multiple parties per crash → one crash record, keyed on date × time × coordinates
2. **Coordinate normalization** — corrects lat/lon transposition; filters non-Taiwan coordinates
3. **Era-year conversion** — Republic of China year (民國) → Common Era
4. **Field harmonization** — handles column name changes across annual releases (e.g., vehicle type field renamed in 2024)
5. **Party pool** — all parties (vehicle, gender, age) stored in a columnar pool appended to each binary file; the detail card reads them on demand without unpacking all records
6. **Binary columnar output** — ~30 bytes/record + 3 bytes/party; 300 M records ≈ 90 MB raw, ≈ 30 MB gzip

### Run the preprocessor

Requires Python 3 (standard library only — no dependencies):

```bash
cd /path/to/your/acc/folder
python3 preprocess.py . --out data
```

| Argument | Description |
|---|---|
| `.` | Input path: folder (recursively finds all `*.csv`) or individual CSV files |
| `--out data` | Output folder for `meta.json` and `accidents-YYYY.bin` |

The script prints column-mapping diagnostics so you can verify that each year's CSV was parsed with the correct field names.

### Binary format

Each year produces one `accidents-YYYY.bin` file. Layout (little-endian):

```
Fixed section (30 bytes × N accidents):
  lon       f32 × N   — WGS-84 longitude
  lat       f32 × N   — WGS-84 latitude
  day       u16 × N   — day-of-year (1–366), sorted ascending for O(log N) animation slicing
  sev       u8  × N   — 0 = A1 fatal, 1 = A2 injury
  deaths    u8  × N
  inj       u8  × N
  county    u8  × N   — index → meta.codebooks.county
  veh       u8  × N   — index → meta.codebooks.veh
  weather   u8  × N
  cause     u8  × N
  hr        u8  × N   — hour 0–23
  mo        u8  × N   — month 1–12
  dd        u8  × N   — day of month 1–31
  road      u16 × N   — index → meta.codebooks.road (u16 because road names are numerous)
  age       u8  × N   — party age; 255 = unknown
  loc       u8  × N   — index → meta.codebooks.locType
  gender    u8  × N   — index → meta.codebooks.gender
  pcount    u8  × N   — number of parties in this crash
  poff      u32 × N   — byte offset into party pool

Party pool (3 bytes × P parties, columnar):
  veh    u8 × P
  gender u8 × P
  age    u8 × P
```

`meta.json` carries codebooks, file list, and the full layout spec.

---

## Deployment (GitHub Pages)

```
your-repo/
├── index.html      ← main app (from dist/)
├── support.js      ← DC runtime (from dist/)
└── data/
    ├── meta.json
    ├── accidents-2018.bin
    ├── accidents-2019.bin
    └── ...
```

1. Run `preprocess.py` to generate `data/`
2. Copy `dist/index.html` and `dist/support.js` into the repo root alongside `data/`
3. Push to GitHub; enable **Settings → Pages → Deploy from branch (main, root)**

For local preview (required — `file://` blocks `fetch()`):

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

---

## Performance Design

| Strategy | Effect |
|---|---|
| Binary columnar format (~30 B/record) | ~8× smaller than JSON; large datasets transfer and parse fast |
| Per-year file sharding | Load only the selected year; multi-year trend computed once at startup from all records |
| Day-sorted records + binary prefix search | Animation frame is O(log N) slice, not O(N) scan |
| deck.gl WebGL rendering | GPU-accelerated scatter/heatmap/hexbin; millions of points at 60 fps |
| `radiusUnits: 'meters'` | Point size auto-scales with map zoom; no JS-side zoom event needed for geometry |
| Zoom-adaptive alpha × density-adaptive alpha | Prevents bloom at low zoom / high point density; adjusts automatically on interaction |
| Party pool (lazy read) | Detail card reads parties on click; zero overhead for the main render loop |

For datasets beyond ~5 M records, consider upgrading to deck.gl binary attributes (`DataFilterExtension`) to eliminate object allocation entirely — the `meta.json` layout field maps directly to typed array views.

---

## Related Research

This dataset underlies the following peer-reviewed publications:

**Liou, Y.-Y., & Chang, H.-H. (2026).** The causal effects of removing hook-turn regulation on road safety. *Transportation Research Part A: Policy and Practice*, 205, 104860. [https://doi.org/10.1016/j.tra.2026.104860](https://doi.org/10.1016/j.tra.2026.104860)

**Liou, Y.-Y., & Chang, H.-H. (2026).** Traffic accidents of religious tourism. *Annals of Tourism Research Empirical Insights*, 7(1), 100209. [https://doi.org/10.1016/j.annale.2026.100209](https://doi.org/10.1016/j.annale.2026.100209)

---

## Acknowledgements

Traffic accident data provided by the **Taiwan National Police Agency (內政部警政署)** through the Government Open Data Platform. Map tiles by **CARTO**; © **OpenStreetMap** contributors. Visualization built with [deck.gl](https://deck.gl) and [MapLibre GL JS](https://maplibre.org).

---

## License

Source code: MIT.  
Data: subject to the original [Government Open Data License](https://data.gov.tw/license).
