(function () {
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

  // Matches the --accent cycling assigned inline in index.html for each section.
  const ACCENT_SLOT = {
    'jail-vs-prison': 0,
    'racial-gap': 1,
    'narrowing-gap': 2,
    'rural-rate': 3,
    'regional-gap': 4,
    'pretrial-share': 5,
    'gender-share': 6,
    'overcrowding': 7,
    'outlier-counties': 0,
  };

  Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', sans-serif";

  function baseOptions(showLegend) {
    const c = colors();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
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
    const multi = section.chart.datasets.length > 1;
    const palette = multi ? [c.series[0], c.series[1]] : [c.series[ACCENT_SLOT[section.id] ?? 0]];
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
      options: baseOptions(multi),
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
    const accent = c.series[ACCENT_SLOT[section.id] ?? 0];
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: section.chart.labels,
        datasets: section.chart.datasets.map((ds) => ({
          label: ds.label,
          data: ds.data,
          backgroundColor: accent,
          borderRadius: 4,
          maxBarThickness: 24,
        })),
      },
      options: opts,
    });
  }

  // ---------- Animated count-up for headline stat tiles ----------
  function animateCount(el) {
    const target = parseFloat(el.dataset.countTo);
    if (Number.isNaN(target)) return;
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const suffix = el.dataset.suffix || '';
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = target * eased;
      el.textContent = value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function initCountUps() {
    const els = document.querySelectorAll('[data-count-to]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(animateCount);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
  }

  // ---------- Scroll-reveal for finding sections ----------
  function initReveal() {
    const sections = document.querySelectorAll('.finding');
    if (!sections.length) return;
    if (!('IntersectionObserver' in window)) {
      sections.forEach((s) => s.classList.add('visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    sections.forEach((s) => io.observe(s));
  }

  // ---------- Scrollspy for the section-nav pill bar ----------
  function initScrollspy() {
    const links = document.querySelectorAll('.section-nav a');
    if (!links.length) return;
    const map = new Map();
    links.forEach((a) => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) map.set(target, a);
    });
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const link = map.get(entry.target);
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    map.forEach((_link, target) => io.observe(target));
  }

  initCountUps();
  initReveal();
  initScrollspy();

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
