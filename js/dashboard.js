(function () {
  let DATA = [];
  const charts = {};

  const filters = { yearFrom: 2000, yearTo: 2019, state: '', county: '', region: '', urbanicity: '' };

  const MEASURES = [
    { key: 'total', label: 'Total' },
    { key: 'median', label: 'Median' },
    { key: 'rate', label: 'Rate per 100,000' },
    { key: 'count', label: 'Count of county-years' },
  ];

  const ROW_BREAKDOWNS = {
    region: { label: 'Region', column: 'region' },
    division: { label: 'Division', column: 'division' },
    urbanicity: { label: 'Urbanicity', column: 'urbanicity' },
  };

  const COLSET_BREAKDOWNS = {
    race: {
      label: 'Race',
      defs: [
        { label: 'Black', jailCol: 'black_jail_pop', popCol: 'black_pop_15to64' },
        { label: 'White', jailCol: 'white_jail_pop', popCol: 'white_pop_15to64' },
        { label: 'Latinx', jailCol: 'latinx_jail_pop', popCol: 'latinx_pop_15to64' },
        { label: 'Native American', jailCol: 'native_jail_pop', popCol: 'native_pop_15to64' },
        { label: 'AAPI', jailCol: 'aapi_jail_pop', popCol: 'aapi_pop_15to64' },
      ],
    },
    gender: {
      label: 'Gender',
      defs: [
        { label: 'Male', jailCol: 'male_jail_pop', popCol: 'male_pop_15to64' },
        { label: 'Female', jailCol: 'female_jail_pop', popCol: 'female_pop_15to64' },
      ],
    },
  };

  const CHART_ACCENT_SLOT = { 'chart-trend': 0, 'chart-category': 2, 'chart-rank': 3 };

  function isRowBreakdown(key) { return Object.prototype.hasOwnProperty.call(ROW_BREAKDOWNS, key); }
  function isColsetBreakdown(key) { return Object.prototype.hasOwnProperty.call(COLSET_BREAKDOWNS, key); }
  function breakdownLabel(key) {
    if (isRowBreakdown(key)) return ROW_BREAKDOWNS[key].label;
    if (isColsetBreakdown(key)) return COLSET_BREAKDOWNS[key].label;
    return key;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function colors() {
    return {
      series: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => cssVar(`--series-${n}`)),
      grid: cssVar('--gridline'),
      baseline: cssVar('--baseline'),
      text: cssVar('--text-secondary'),
      muted: cssVar('--text-muted'),
    };
  }

  function median(values) {
    if (!values.length) return 0;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
  function round(n) { return Math.round(n * 10) / 10; }

  function aggregateRows(rows, jailCol, popCol) {
    let jailSum = 0, popSum = 0, n = 0;
    const values = [];
    for (const row of rows) {
      const jail = row[jailCol];
      if (jail === null || jail === undefined || Number.isNaN(jail)) continue;
      jailSum += jail;
      popSum += row[popCol] || 0;
      values.push(jail);
      n += 1;
    }
    return { jailSum, popSum, values, n };
  }

  function measureValue(stat, measureKey) {
    switch (measureKey) {
      case 'total': return stat.jailSum;
      case 'median': return median(stat.values);
      case 'rate': return stat.popSum > 0 ? (stat.jailSum / stat.popSum) * 100000 : 0;
      case 'count': return stat.n;
      default: return 0;
    }
  }

  function groupStats(rows, breakdownKey) {
    const map = new Map();
    if (isRowBreakdown(breakdownKey)) {
      const col = ROW_BREAKDOWNS[breakdownKey].column;
      const buckets = new Map();
      for (const row of rows) {
        const key = row[col] || 'Unknown';
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(row);
      }
      for (const [key, groupRows] of buckets) {
        map.set(key, aggregateRows(groupRows, 'total_jail_pop', 'total_pop_15to64'));
      }
    } else if (isColsetBreakdown(breakdownKey)) {
      for (const def of COLSET_BREAKDOWNS[breakdownKey].defs) {
        map.set(def.label, aggregateRows(rows, def.jailCol, def.popCol));
      }
    }
    return map;
  }

  function uniqueSorted(rows, col) {
    return [...new Set(rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && v !== ''))].sort();
  }

  function applyFilters(rows) {
    return rows.filter((r) =>
      r.year >= filters.yearFrom && r.year <= filters.yearTo &&
      (!filters.state || r.state_abbr === filters.state) &&
      (!filters.county || r.county_fips === filters.county) &&
      (!filters.region || r.region === filters.region) &&
      (!filters.urbanicity || r.urbanicity === filters.urbanicity)
    );
  }

  // ---------- Chart.js rendering ----------
  Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', sans-serif";

  function baseOptions(showLegend) {
    const c = colors();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          display: showLegend,
          position: 'top',
          align: 'start',
          labels: { color: c.text, boxWidth: 10, boxHeight: 10, usePointStyle: true },
        },
        tooltip: {
          backgroundColor: cssVar('--surface-1'),
          titleColor: cssVar('--text-primary'),
          bodyColor: c.text,
          borderColor: cssVar('--border'),
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: c.muted }, border: { color: c.baseline } },
        y: { grid: { color: c.grid, drawTicks: false }, ticks: { color: c.muted }, border: { display: false }, beginAtZero: true },
      },
    };
  }

  function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  function renderLineChart(canvasId, labels, datasets) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((ds) => ({
          ...ds,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBorderColor: cssVar('--surface-1'),
          pointHoverBorderWidth: 2,
          tension: 0.15,
        })),
      },
      options: baseOptions(datasets.length > 1),
    });
  }

  function renderBarChart(canvasId, labels, datasets, opts = {}) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    const options = baseOptions(false);
    if (opts.horizontal) {
      const c = colors();
      options.indexAxis = 'y';
      options.scales = {
        y: { grid: { display: false }, ticks: { color: c.muted }, border: { color: c.baseline } },
        x: { grid: { color: c.grid }, ticks: { color: c.muted }, border: { display: false }, beginAtZero: true },
      };
    }
    const c = colors();
    const accent = c.series[CHART_ACCENT_SLOT[canvasId] ?? 0];
    charts[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: datasets.map((ds) => ({
          ...ds,
          backgroundColor: ds.backgroundColor || accent,
          borderRadius: 4,
          maxBarThickness: 24,
        })),
      },
      options,
    });
  }

  function renderStackedBar(canvasId, groupsList) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    const c = colors();
    const datasets = groupsList.map((g, i) => ({
      label: g.label,
      data: [round(g.value)],
      backgroundColor: c.series[i % c.series.length],
      borderRadius: 4,
      maxBarThickness: 40,
    }));
    const options = baseOptions(true);
    options.indexAxis = 'y';
    options.scales = {
      x: { stacked: true, grid: { color: c.grid }, ticks: { color: c.muted }, border: { display: false }, beginAtZero: true },
      y: { stacked: true, grid: { display: false }, ticks: { color: c.muted }, border: { color: c.baseline } },
    };
    charts[canvasId] = new Chart(canvas, { type: 'bar', data: { labels: ['Selected view'], datasets }, options });
  }

  // ---------- Render each panel ----------
  function renderSummary() {
    const rows = applyFilters(DATA);
    let jailSum = 0, popSum = 0, pretrialSum = 0;
    for (const r of rows) {
      jailSum += r.total_jail_pop || 0;
      popSum += r.total_pop_15to64 || 0;
      pretrialSum += r.total_pretrial_custody || 0;
    }
    document.getElementById('stat-rows').textContent = rows.length.toLocaleString();
    document.getElementById('stat-total-jail').textContent = Math.round(jailSum).toLocaleString();
    document.getElementById('stat-rate').textContent = popSum > 0 ? Math.round((jailSum / popSum) * 100000).toLocaleString() : '—';
    document.getElementById('stat-pretrial').textContent = jailSum > 0 ? (pretrialSum / jailSum * 100).toFixed(1) + '%' : '—';
  }

  function renderTrend() {
    const rows = applyFilters(DATA);
    const measureKey = document.getElementById('trend-measure').value;
    const breakdownKey = document.getElementById('trend-breakdown').value;
    const years = [];
    for (let y = filters.yearFrom; y <= filters.yearTo; y++) years.push(y);

    let seriesDefs;
    if (breakdownKey === 'none') {
      seriesDefs = [{ label: 'Total', jailCol: 'total_jail_pop', popCol: 'total_pop_15to64', rowFilter: () => true }];
    } else if (isRowBreakdown(breakdownKey)) {
      const col = ROW_BREAKDOWNS[breakdownKey].column;
      seriesDefs = uniqueSorted(rows, col).map((cat) => ({
        label: String(cat), jailCol: 'total_jail_pop', popCol: 'total_pop_15to64', rowFilter: (r) => r[col] === cat,
      }));
    } else {
      seriesDefs = COLSET_BREAKDOWNS[breakdownKey].defs.map((d) => ({
        label: d.label, jailCol: d.jailCol, popCol: d.popCol, rowFilter: () => true,
      }));
    }

    const c = colors();
    const rowsByYear = new Map(years.map((y) => [y, rows.filter((r) => r.year === y)]));
    const datasets = seriesDefs.map((sd, i) => ({
      label: sd.label,
      data: years.map((y) => {
        const yearRows = rowsByYear.get(y).filter(sd.rowFilter);
        return round(measureValue(aggregateRows(yearRows, sd.jailCol, sd.popCol), measureKey));
      }),
      borderColor: c.series[i % c.series.length],
      backgroundColor: c.series[i % c.series.length],
    }));

    renderLineChart('chart-trend', years, datasets);
  }

  function renderCategory() {
    const rows = applyFilters(DATA);
    const measureKey = document.getElementById('category-measure').value;
    const breakdownKey = document.getElementById('category-breakdown').value;
    const map = groupStats(rows, breakdownKey);
    const entries = [...map.entries()].map(([label, stat]) => [label, measureValue(stat, measureKey)]);
    entries.sort((a, b) => b[1] - a[1]);
    const measureLabel = MEASURES.find((m) => m.key === measureKey).label;
    renderBarChart('chart-category', entries.map((e) => e[0]), [{ label: measureLabel, data: entries.map((e) => round(e[1])) }]);
  }

  function renderRank() {
    const rows = applyFilters(DATA);
    const measureKey = document.getElementById('rank-measure').value;
    const unit = document.getElementById('rank-unit').value;
    const keyCol = unit === 'county' ? 'county_fips' : 'state_abbr';
    const buckets = new Map();
    for (const r of rows) {
      if (!buckets.has(r[keyCol])) buckets.set(r[keyCol], []);
      buckets.get(r[keyCol]).push(r);
    }
    const results = [];
    for (const groupRows of buckets.values()) {
      const stat = aggregateRows(groupRows, 'total_jail_pop', 'total_pop_15to64');
      const label = unit === 'county' ? `${groupRows[0].county_name}, ${groupRows[0].state_abbr}` : groupRows[0].state_abbr;
      results.push([label, measureValue(stat, measureKey)]);
    }
    results.sort((a, b) => b[1] - a[1]);
    const top = results.slice(0, 10);
    const measureLabel = MEASURES.find((m) => m.key === measureKey).label;
    renderBarChart('chart-rank', top.map((e) => e[0]), [{ label: measureLabel, data: top.map((e) => round(e[1])) }], { horizontal: true });
  }

  function renderComposition() {
    const rows = applyFilters(DATA);
    const measureKey = document.getElementById('composition-measure').value;
    const breakdownKey = document.getElementById('composition-breakdown').value;
    let groupsList;
    if (breakdownKey === 'custody') {
      let jailSum = 0, pretrialSum = 0;
      for (const r of rows) { jailSum += r.total_jail_pop || 0; pretrialSum += r.total_pretrial_custody || 0; }
      groupsList = [
        { label: 'Pretrial', value: pretrialSum },
        { label: 'Other custody', value: Math.max(jailSum - pretrialSum, 0) },
      ];
    } else {
      groupsList = COLSET_BREAKDOWNS[breakdownKey].defs.map((d) => {
        let jailSum = 0;
        for (const r of rows) jailSum += r[d.jailCol] || 0;
        return { label: d.label, value: jailSum };
      });
    }
    if (measureKey === 'share') {
      const total = groupsList.reduce((s, g) => s + g.value, 0) || 1;
      groupsList = groupsList.map((g) => ({ label: g.label, value: (g.value / total) * 100 }));
    }
    renderStackedBar('chart-composition', groupsList);
  }

  function renderTable() {
    const rows = applyFilters(DATA);
    const breakdownKey = document.getElementById('category-breakdown').value;
    const map = groupStats(rows, breakdownKey);
    const entries = [...map.entries()].map(([label, stat]) => ({
      label,
      count: stat.n,
      total: stat.jailSum,
      median: median(stat.values),
      rate: stat.popSum > 0 ? (stat.jailSum / stat.popSum) * 100000 : 0,
    }));
    entries.sort((a, b) => b.total - a.total);

    document.querySelector('#data-table thead tr').innerHTML =
      `<th>${breakdownLabel(breakdownKey)}</th><th>County-years</th><th>Total jail pop.</th><th>Median jail pop.</th><th>Rate per 100k</th>`;
    document.querySelector('#data-table tbody').innerHTML = entries.map((e) => `<tr>
      <td>${e.label}</td>
      <td>${e.count.toLocaleString()}</td>
      <td>${Math.round(e.total).toLocaleString()}</td>
      <td>${Math.round(e.median).toLocaleString()}</td>
      <td>${Math.round(e.rate).toLocaleString()}</td>
    </tr>`).join('');
  }

  function renderChips() {
    const container = document.getElementById('filter-chips');
    if (!container) return;
    const chips = [];
    if (filters.yearFrom !== 2000 || filters.yearTo !== 2019) {
      chips.push({
        label: `${filters.yearFrom}–${filters.yearTo}`,
        clear: () => {
          filters.yearFrom = 2000; filters.yearTo = 2019;
          document.getElementById('filter-year-from').value = '2000';
          document.getElementById('filter-year-to').value = '2019';
        },
      });
    }
    if (filters.state) {
      chips.push({
        label: `State: ${filters.state}`,
        clear: () => {
          filters.state = ''; filters.county = '';
          document.getElementById('filter-state').value = '';
          populateCountyOptions();
          document.getElementById('filter-county').value = '';
        },
      });
    }
    if (filters.county) {
      const opt = [...document.getElementById('filter-county').options].find((o) => Number(o.value) === filters.county);
      chips.push({
        label: `County: ${opt ? opt.textContent : filters.county}`,
        clear: () => { filters.county = ''; document.getElementById('filter-county').value = ''; },
      });
    }
    if (filters.region) {
      chips.push({ label: `Region: ${filters.region}`, clear: () => { filters.region = ''; document.getElementById('filter-region').value = ''; } });
    }
    if (filters.urbanicity) {
      chips.push({ label: `Urbanicity: ${filters.urbanicity}`, clear: () => { filters.urbanicity = ''; document.getElementById('filter-urbanicity').value = ''; } });
    }
    container.innerHTML = '';
    chips.forEach((chip) => {
      const el = document.createElement('span');
      el.className = 'filter-chip';
      const text = document.createElement('span');
      text.textContent = chip.label;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', `Remove filter: ${chip.label}`);
      btn.textContent = '×';
      btn.addEventListener('click', () => { chip.clear(); renderAll(); });
      el.appendChild(text);
      el.appendChild(btn);
      container.appendChild(el);
    });
  }

  function renderAll() {
    renderChips();
    renderSummary();
    renderTrend();
    renderCategory();
    renderRank();
    renderComposition();
    renderTable();
  }

  // ---------- Filters UI ----------
  function populateYearSelects() {
    const from = document.getElementById('filter-year-from');
    const to = document.getElementById('filter-year-to');
    from.innerHTML = '';
    to.innerHTML = '';
    for (let y = 2000; y <= 2019; y++) {
      from.appendChild(new Option(String(y), String(y)));
      to.appendChild(new Option(String(y), String(y)));
    }
    from.value = '2000';
    to.value = '2019';
  }

  function populateStaticFilterSelect(id, values, allLabel) {
    const sel = document.getElementById(id);
    sel.innerHTML = `<option value="">${allLabel}</option>` + values.map((v) => `<option value="${v}">${v}</option>`).join('');
  }

  function populateCountyOptions() {
    const sel = document.getElementById('filter-county');
    sel.innerHTML = '<option value="">All counties</option>';
    const pool = filters.state ? DATA.filter((r) => r.state_abbr === filters.state) : DATA;
    const seen = new Map();
    for (const r of pool) {
      if (!seen.has(r.county_fips)) seen.set(r.county_fips, `${r.county_name}, ${r.state_abbr}`);
    }
    const entries = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    for (const [fips, label] of entries) {
      sel.appendChild(new Option(label, String(fips)));
    }
  }

  function fillSelect(id, options) {
    document.getElementById(id).innerHTML = options.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
  }

  function resetFilters() {
    filters.yearFrom = 2000; filters.yearTo = 2019;
    filters.state = ''; filters.county = ''; filters.region = ''; filters.urbanicity = '';
    document.getElementById('filter-year-from').value = '2000';
    document.getElementById('filter-year-to').value = '2019';
    document.getElementById('filter-state').value = '';
    document.getElementById('filter-region').value = '';
    document.getElementById('filter-urbanicity').value = '';
    populateCountyOptions();
    document.getElementById('filter-county').value = '';

    document.getElementById('trend-measure').value = 'total';
    document.getElementById('trend-breakdown').value = 'none';
    document.getElementById('category-measure').value = 'total';
    document.getElementById('category-breakdown').value = 'region';
    document.getElementById('rank-measure').value = 'rate';
    document.getElementById('rank-unit').value = 'county';
    document.getElementById('composition-measure').value = 'share';
    document.getElementById('composition-breakdown').value = 'race';

    renderAll();
  }

  function wireEvents() {
    document.getElementById('filter-year-from').addEventListener('change', (e) => {
      filters.yearFrom = Number(e.target.value);
      if (filters.yearFrom > filters.yearTo) {
        filters.yearTo = filters.yearFrom;
        document.getElementById('filter-year-to').value = String(filters.yearTo);
      }
      renderAll();
    });
    document.getElementById('filter-year-to').addEventListener('change', (e) => {
      filters.yearTo = Number(e.target.value);
      if (filters.yearTo < filters.yearFrom) {
        filters.yearFrom = filters.yearTo;
        document.getElementById('filter-year-from').value = String(filters.yearFrom);
      }
      renderAll();
    });
    document.getElementById('filter-state').addEventListener('change', (e) => {
      filters.state = e.target.value;
      filters.county = '';
      populateCountyOptions();
      renderAll();
    });
    document.getElementById('filter-county').addEventListener('change', (e) => {
      filters.county = e.target.value ? Number(e.target.value) : '';
      renderAll();
    });
    document.getElementById('filter-region').addEventListener('change', (e) => { filters.region = e.target.value; renderAll(); });
    document.getElementById('filter-urbanicity').addEventListener('change', (e) => { filters.urbanicity = e.target.value; renderAll(); });
    document.getElementById('reset-filters').addEventListener('click', resetFilters);

    ['trend-measure', 'trend-breakdown'].forEach((id) => document.getElementById(id).addEventListener('change', renderTrend));
    ['category-measure', 'category-breakdown'].forEach((id) => document.getElementById(id).addEventListener('change', () => { renderCategory(); renderTable(); }));
    ['rank-measure', 'rank-unit'].forEach((id) => document.getElementById(id).addEventListener('change', renderRank));
    ['composition-measure', 'composition-breakdown'].forEach((id) => document.getElementById(id).addEventListener('change', renderComposition));
  }

  function init() {
    populateYearSelects();
    populateStaticFilterSelect('filter-state', uniqueSorted(DATA, 'state_abbr'), 'All states');
    populateStaticFilterSelect('filter-region', uniqueSorted(DATA, 'region'), 'All regions');
    populateStaticFilterSelect('filter-urbanicity', uniqueSorted(DATA, 'urbanicity'), 'All');
    populateCountyOptions();

    fillSelect('trend-measure', MEASURES.map((m) => ({ value: m.key, label: m.label })));
    fillSelect('trend-breakdown', [
      { value: 'none', label: 'Total (no breakdown)' },
      { value: 'region', label: 'Region' },
      { value: 'urbanicity', label: 'Urbanicity' },
      { value: 'race', label: 'Race' },
      { value: 'gender', label: 'Gender' },
    ]);
    fillSelect('category-measure', MEASURES.map((m) => ({ value: m.key, label: m.label })));
    fillSelect('category-breakdown', [
      { value: 'region', label: 'Region' },
      { value: 'division', label: 'Division' },
      { value: 'urbanicity', label: 'Urbanicity' },
      { value: 'race', label: 'Race' },
      { value: 'gender', label: 'Gender' },
    ]);
    document.getElementById('category-breakdown').value = 'region';

    fillSelect('rank-measure', MEASURES.map((m) => ({ value: m.key, label: m.label })));
    document.getElementById('rank-measure').value = 'rate';
    fillSelect('rank-unit', [{ value: 'county', label: 'County' }, { value: 'state', label: 'State' }]);

    fillSelect('composition-measure', [{ value: 'share', label: 'Share (%)' }, { value: 'total', label: 'Total' }]);
    fillSelect('composition-breakdown', [
      { value: 'race', label: 'Race' },
      { value: 'gender', label: 'Gender' },
      { value: 'custody', label: 'Custody status (pretrial vs. other)' },
    ]);

    wireEvents();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', () => {
    Papa.parse('data/incarceration_trends.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        DATA = results.data;
        init();
      },
      error: (err) => console.error('Failed to load dashboard data', err),
    });
  });
})();
