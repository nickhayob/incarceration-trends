(function () {
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function colors() {
    return {
      series1: cssVar('--series-1'),
      series2: cssVar('--series-2'),
      grid: cssVar('--gridline'),
      baseline: cssVar('--baseline'),
      text: cssVar('--text-secondary'),
      muted: cssVar('--text-muted'),
    };
  }

  Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', sans-serif";

  function baseOptions(showLegend) {
    const c = colors();
    return {
      responsive: true,
      maintainAspectRatio: false,
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
        x: {
          grid: { display: false },
          ticks: { color: c.muted },
          border: { color: c.baseline },
        },
        y: {
          grid: { color: c.grid, drawTicks: false },
          ticks: { color: c.muted },
          border: { display: false },
          beginAtZero: true,
        },
      },
    };
  }

  function renderLine(canvas, section) {
    const c = colors();
    const palette = [c.series1, c.series2];
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: section.chart.labels,
        datasets: section.chart.datasets.map((ds, i) => ({
          label: ds.label,
          data: ds.data,
          borderColor: palette[i % palette.length],
          backgroundColor: palette[i % palette.length],
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: palette[i % palette.length],
          pointHoverBorderColor: cssVar('--surface-1'),
          pointHoverBorderWidth: 2,
          tension: 0.15,
        })),
      },
      options: baseOptions(section.chart.datasets.length > 1),
    });
  }

  function renderBar(canvas, section) {
    const c = colors();
    const horizontal = !!section.chart.horizontal;
    const opts = baseOptions(false);
    if (horizontal) {
      opts.indexAxis = 'y';
      opts.scales = {
        y: { grid: { display: false }, ticks: { color: c.muted }, border: { color: c.baseline } },
        x: { grid: { color: c.grid }, ticks: { color: c.muted }, border: { display: false }, beginAtZero: true },
      };
    }
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: section.chart.labels,
        datasets: section.chart.datasets.map((ds) => ({
          label: ds.label,
          data: ds.data,
          backgroundColor: c.series1,
          borderRadius: 4,
          maxBarThickness: 24,
        })),
      },
      options: opts,
    });
  }

  fetch('data/report_findings.json')
    .then((r) => r.json())
    .then((findings) => {
      findings.sections.forEach((section) => {
        const canvas = document.querySelector(`canvas[data-chart="${section.id}"]`);
        if (!canvas) return;
        if (section.chart.type === 'line') renderLine(canvas, section);
        else renderBar(canvas, section);
      });
    })
    .catch((err) => {
      console.error('Failed to load report data', err);
    });
})();
