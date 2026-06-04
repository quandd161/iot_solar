/* =============================================================
   charts.js — Charts matching firmware sensor data fields
   ============================================================= */

const MAX_PTS = 60;

/* Shared rolling buffer — fields match firmware payload */
const chartBuf = {
  labels:     [],
  voltage:    [],   // INA219 bus voltage V
  current_mA: [],   // INA219 current mA
  power_mW:   [],   // INA219 power mW
  temp:       [],   // DS18B20 temperature °C
};

/* ── COMMON DARK OPTIONS ──────────────────────────────────── */
function darkScales(yLabel, yMin, yMax) {
  return {
    x: {
      grid:  { color:'rgba(48,64,79,0.6)', drawBorder:false },
      ticks: { color:'#6b829a', maxTicksLimit:8, maxRotation:0, font:{ size:10 } },
      border: { display: false },
    },
    y: {
      min: yMin !== undefined ? yMin : 0,
      suggestedMax: yMax,
      grid:  { color:'rgba(48,64,79,0.6)', drawBorder:false },
      ticks: { color:'#6b829a', callback: v => v + ' ' + yLabel, font:{ size:10 } },
      border: { display: false },
    },
  };
}

function darkTooltip(unit) {
  return {
    backgroundColor: '#1c2333',
    borderColor:     '#30404f',
    borderWidth:     1,
    titleColor:      '#a8b8cc',
    bodyColor:       '#f0f4f8',
    padding:         10,
    cornerRadius:    8,
    callbacks: {
      label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} ${unit}`
    },
  };
}

function darkLegend() {
  return {
    labels: {
      color: '#a8b8cc',
      usePointStyle: true,
      pointStyleWidth: 10,
      font: { size:12 },
      padding: 16,
    },
  };
}

function lineDataset(label, data, color, bgAlpha) {
  const hex = color.replace('#','');
  const r = parseInt(hex.substr(0,2),16);
  const g = parseInt(hex.substr(2,2),16);
  const b = parseInt(hex.substr(4,2),16);
  return {
    label, data,
    borderColor:     color,
    backgroundColor: `rgba(${r},${g},${b},${bgAlpha || 0.08})`,
    borderWidth:     2,
    pointRadius:     0,
    pointHoverRadius:4,
    tension:         0.4,
    fill:            true,
  };
}

/* ── POWER CHART (mW) ─────────────────────────────────────── */
let powerChart;

function initPowerChart() {
  const el = document.getElementById('chart-power');
  if (!el) return;
  powerChart = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels: chartBuf.labels,
      datasets: [
        { ...lineDataset('Công suất (mW)', chartBuf.power_mW, '#f6a623', 0.12) },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode:'index', intersect:false },
      plugins: { legend: darkLegend(), tooltip: darkTooltip('mW') },
      scales:  darkScales('mW', 0, 15000),
    },
  });
}

/* ── VOLTAGE + CURRENT CHART ──────────────────────────────── */
let voltChart;

function initVoltChart() {
  const el = document.getElementById('chart-volt');
  if (!el) return;
  voltChart = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels: chartBuf.labels,
      datasets: [
        { ...lineDataset('Điện áp (V)', chartBuf.voltage, '#f6a623', 0.10) },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode:'index', intersect:false },
      plugins: { legend: darkLegend(), tooltip: darkTooltip('V') },
      scales:  darkScales('V', 0, 16),
    },
  });
}

/* ── CURRENT CHART ────────────────────────────────────────── */
let currentChart;

function initCurrentChart() {
  const el = document.getElementById('chart-current');
  if (!el) return;
  currentChart = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels: chartBuf.labels,
      datasets: [
        { ...lineDataset('Dòng điện (mA)', chartBuf.current_mA, '#38bdf8', 0.10) },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode:'index', intersect:false },
      plugins: { legend: darkLegend(), tooltip: darkTooltip('mA') },
      scales:  darkScales('mA', 0, 1000),
    },
  });
}

/* ── TEMPERATURE CHART ────────────────────────────────────── */
let tempChart;

function initTempChart() {
  const el = document.getElementById('chart-temp');
  if (!el) return;
  tempChart = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels: chartBuf.labels,
      datasets: [
        { ...lineDataset('Nhiệt độ (°C)', chartBuf.temp, '#f87171', 0.10) },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode:'index', intersect:false },
      plugins: { legend: darkLegend(), tooltip: darkTooltip('°C') },
      scales:  darkScales('°C', 0, 70),
    },
  });
}

/* ── PUSH DATA TO ALL CHARTS ──────────────────────────────── */
function pushChartData(d) {
  const label = new Date().toLocaleTimeString('vi-VN');

  const push = (arr, val) => { arr.push(val); if (arr.length > MAX_PTS) arr.shift(); };

  push(chartBuf.labels,     label);
  push(chartBuf.voltage,    d.voltage);
  push(chartBuf.current_mA, d.current_mA);
  push(chartBuf.power_mW,   d.power_mW);
  push(chartBuf.temp,       d.temp < -100 ? null : d.temp);

  powerChart   && powerChart.update('none');
  voltChart    && voltChart.update('none');
  currentChart && currentChart.update('none');
  tempChart    && tempChart.update('none');
}

/* ── SEED INITIAL HISTORICAL POINTS ──────────────────────── */
function seedCharts() {
  for (let i = 8; i >= 1; i--) {
    const t = new Date(Date.now() - i * SIM_INTERVAL);
    chartBuf.labels.push(t.toLocaleTimeString('vi-VN'));
    chartBuf.voltage.push(   +(12 + Math.random() * 2).toFixed(2));
    chartBuf.current_mA.push(+(300 + Math.random() * 100).toFixed(1));
    chartBuf.power_mW.push(  +(3600 + Math.random() * 1500).toFixed(1));
    chartBuf.temp.push(      +(38 + Math.random() * 8).toFixed(1));
  }
}

function initAllCharts() {
  seedCharts();
  initPowerChart();
  initVoltChart();
  initCurrentChart();
  initTempChart();
}
