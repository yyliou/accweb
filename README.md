# Taiwan Crash Atlas · 臺灣車禍視覺化地圖

An interactive, bilingual (Chinese / English) visualization of Taiwan's road traffic accidents — both A1 (fatal) and A2 (injury) — built on [deck.gl](https://deck.gl) WebGL rendering and [MapLibre GL](https://maplibre.org) with a CARTO dark basemap. Designed for researchers, journalists, and the general public.

**Live site →** [yyliou.github.io](https://yyliou.github.io)  
**Data source →** [Taiwan National Police Agency — Road Traffic Accident Records (政府資料開放平臺)](https://data.gov.tw/datasets/search?p=1&size=10&s=_score_desc&rft=年傷亡道路交通事故資料)  
**Contact / Bug reports →** d10627008@ntu.edu.tw

---

## Features

### Three-panel dashboard

| Panel | Description |
|---|---|
| **Trends** | Dual Y-axis quarterly line chart (deaths vs. injuries on independent scales); monthly and hourly bar distributions; top vehicle types and counties; narrative summary auto-generated from loaded data |
| **Map** | GPU-rendered glowing point cloud; zoom-adaptive point size (`radiusUnits: 'meters'`) and opacity; click any point for a full detail card (all crash parties, cause, weather, road name, location type) |
| **Research** | Peer-reviewed publications using this dataset, with journal covers, abstracts, and DOI links |

### Filters (Map panel)
Year · Severity (A1 / A2 / All) · County · Vehicle type · Time range (hour) · Animated day-by-day playback

### Dynamic statistics
All six stat tiles (peak day, peak hour, top weather, top age band, top location, top gender) recompute instantly on every filter change.

### Bilingual UI
One-click toggle between Traditional Chinese (臺灣正體) and English. All labels, stat tiles, detail cards, and narrative text switch together.

### Mobile-responsive
Fluid layout adapts to phones: map fills the top half, sidebar scrolls below; Trend page switches to single-column; journal covers scale down; animation controls repositioned to avoid overlap.

---

## Data & Preprocessing

Raw data from the National Police Agency is released as per-party CSV files (one row per crash participant). The preprocessing pipeline:

1. **De-duplication** — multiple parties per crash → one crash record, keyed on date × time × coordinates
2. **Coordinate normalization** — corrects lat/lon transposition; filters non-Taiwan bounding-box outliers
3. **Era-year conversion** — Republic of China year (民國) → Common Era
4. **Field harmonization** — handles column-name changes across annual releases (e.g., vehicle type field renamed in 2024: `小客車` → `小客車(含客、貨兩用)`)
5. **Party pool** — all parties (vehicle, gender, age; `255` = unknown) stored in a columnar pool appended to each binary file; the detail card reads them on demand with zero overhead for the main render loop
6. **Binary columnar output** — ~30 bytes/record + 3 bytes/party; 3 M records ≈ 90 MB raw, ≈ 30 MB gzip

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

The script prints column-mapping diagnostics so you can verify each year's CSV was parsed with the correct field names.

### Binary format

Each year produces one `accidents-YYYY.bin` file. Layout (little-endian):

```
Fixed section (~30 bytes × N accidents):
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
  road      u16 × N   — index → meta.codebooks.road (u16; road names are numerous)
  age       u8  × N   — primary party age; 255 = unknown / non-person
  loc       u8  × N   — index → meta.codebooks.locType
  gender    u8  × N   — index → meta.codebooks.gender
  pcount    u8  × N   — number of parties in this crash
  poff      u32 × N   — byte offset into party pool

Party pool (3 bytes × P parties, columnar):
  veh    u8 × P
  gender u8 × P
  age    u8 × P       — 255 = unknown
```

`meta.json` carries codebooks, file list, record counts, and the full layout spec.

---

## Deployment (GitHub Pages)

```
your-repo/
├── index.html        ← main app (copy from dist/index.html)
├── support.js        ← DC runtime (copy from dist/support.js)
├── sw.js             ← Service Worker for cache-first binary loading
└── data/
    ├── meta.json
    ├── accidents-2018.bin
    ├── accidents-2019.bin
    └── ...
```

1. Run `preprocess.py` to populate `data/`
2. Copy `dist/index.html`, `dist/support.js`, and `sw.js` into the repo root
3. Push to GitHub; enable **Settings → Pages → Deploy from branch (main / root)**

> **Local preview** — required because `file://` blocks `fetch()`:
> ```bash
> python3 -m http.server 8000
> # open http://localhost:8000/
> ```

---

## Performance Design

| Strategy | Effect |
|---|---|
| Binary columnar format (~30 B/record) | ~8× smaller than JSON; transfers and parses fast |
| Per-year file sharding | Browser loads only the selected year for the map; all years loaded once at startup for Trends |
| Parallel `Promise.all` fetch | All binary files downloaded simultaneously; load time = slowest file, not sum of all |
| Day-sorted records + binary search | Animation frame is O(log N) slice, not O(N) scan |
| Service Worker (`sw.js`) | `.bin` files cached after first visit — repeat loads are instant, fully offline |
| Map init before data load | Basemap renders immediately; deck.gl overlay added only after WebGL context is confirmed ready |
| deck.gl WebGL rendering | GPU-accelerated point cloud; millions of points at 60 fps |
| `radiusUnits: 'meters'` | Point size auto-scales with zoom level — no JS-side resize loop needed |
| Zoom-adaptive alpha | Opacity scales from 35% (zoom out, high overlap) to 100% (zoom in, sparse) |
| Party pool (lazy read) | Detail card reads parties on click; zero cost for the render loop |

For datasets beyond ~5 M records, consider `deck.gl`'s `DataFilterExtension` to move filter evaluation to the GPU — the `meta.json` layout maps directly to typed array views, making this upgrade straightforward.

---

## Related Research

This dataset underlies the following peer-reviewed publications:

**Liou, Y.-Y., & Chang, H.-H. (2026).** The causal effects of removing hook-turn regulation on road safety. *Transportation Research Part A: Policy and Practice*, 205, 104860.  
→ [10.1016/j.tra.2026.104860](https://doi.org/10.1016/j.tra.2026.104860)

> Uses a difference-in-discontinuity design exploiting Tainan City's removal of the hook-turn (待轉) requirement as a quasi-natural experiment. Finds a 21% reduction in accidents and 19% reduction in victims; motorcycle crashes fell 26%, car crashes 18%.

**Liou, Y.-Y., & Chang, H.-H. (2026).** Traffic accidents of religious tourism. *Annals of Tourism Research Empirical Insights*, 7(1), 100209.  
→ [10.1016/j.annale.2026.100209](https://doi.org/10.1016/j.annale.2026.100209)

> Uses a difference-in-differences design with the Dajia Mazu Pilgrimage as the treatment event. Finds a significant increase in non-fatal injury accidents during the pilgrimage; combined productivity loss and medical costs account for 6.3% of Taiwan's total annual traffic accident costs.

---

## Acknowledgements

Traffic accident microdata provided by the **Taiwan National Police Agency (內政部警政署)** through the Government Open Data Platform. Map tiles by **CARTO**; © **OpenStreetMap** contributors. Visualization built with [deck.gl](https://deck.gl) and [MapLibre GL JS](https://maplibre.org).

---

## License

Source code: MIT.  
Data: subject to the [Government Open Data License](https://data.gov.tw/license).
