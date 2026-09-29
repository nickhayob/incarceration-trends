# Incarceration Trends

A two-page site exploring U.S. county jail and prison data, 2000&ndash;2019:

- **Report** (`index.html`): nine findings, each backed by numbers and a chart.
- **Dashboard** (`dashboard.html`): filter the data live in the browser and watch summary
  numbers, an interactive county map, four charts, and a table update.

## Data sources

- [Vera Institute of Justice, Incarceration Trends](https://github.com/vera-institute/incarceration-trends),
  compiled from the U.S. Department of Justice's Bureau of Justice Statistics and state/local
  agencies. One row in the source file is one U.S. county in one year. See the report's closing
  "About this data" section for exactly which rows were dropped and how every rate/ratio/share is
  computed.
- County boundaries for the dashboard map: U.S. Census Bureau 2014 cartographic boundary files,
  as a FIPS-keyed GeoJSON via the [plotly/datasets](https://github.com/plotly/datasets) repo.

## Files

| File | What it does |
|---|---|
| `index.html` | The report page. Static narrative content (title, headline numbers, nine findings, methodology) with `<canvas>` elements that `js/report.js` fills in with charts. |
| `dashboard.html` | The interactive dashboard page: filter controls, summary stat tiles, an interactive county map, four chart cards, and a data table. |
| `css/style.css` | Shared stylesheet for both pages &mdash; nav bar, color palette (light/dark theme toggle), stat tiles, chart card, map, and filter styling. |
| `js/theme.js` | Wires the light/dark theme toggle button and persists the choice in `localStorage`. |
| `js/report.js` | Fetches `data/report_findings.json` and renders each report chart with Chart.js, plus the count-up numbers, scroll-reveal, and scrollspy nav. |
| `js/dashboard.js` | Loads `data/incarceration_trends.csv` with Papa Parse and `data/us-counties.geojson` with Leaflet, filters/aggregates everything in the browser, and renders the dashboard's stats, map, charts, and table. |
| `data/incarceration_trends.csv` | The cleaned dataset the dashboard loads: 2000&ndash;2019, rows with no reported jail population dropped, trimmed to the ~30 columns the site uses. Produced by `scripts/prepare_data.py`. |
| `data/report_findings.json` | Pre-computed numbers and chart data for the report page, produced by `scripts/compute_findings.py` from the cleaned CSV so every figure in the report is reproducible. |
| `data/us-counties.geojson` | U.S. county boundary polygons (FIPS-keyed) that `js/dashboard.js` colors by the current filters/year for the county map. |
| `scripts/prepare_data.py` | Downloads the raw Vera Institute county-level file and produces `data/incarceration_trends.csv` (year filter, null-drop, column trim). |
| `scripts/compute_findings.py` | Reads `data/incarceration_trends.csv` and writes `data/report_findings.json`. |
| `pyproject.toml`, `uv.lock`, `.python-version` | Python environment (managed with `uv`) for the two data-prep scripts. |

## Reproducing the data

```
uv run python scripts/prepare_data.py     # downloads raw data, writes data/incarceration_trends.csv
uv run python scripts/compute_findings.py # writes data/report_findings.json
```

The raw downloaded file (`data/raw_incarceration_trends_county.csv`, ~62MB) is not committed;
`prepare_data.py` re-downloads it if missing.

## Running locally

Both pages fetch data over HTTP, so open them through a local server rather than as `file://`:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000/index.html` and `http://localhost:8000/dashboard.html`.
