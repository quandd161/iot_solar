/* =============================================================
   app.js — Tab router, UI updater matching firmware data model
   ============================================================= */

/* ── TAB ROUTER ──────────────────────────────────────────── */
function showTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const panel = document.getElementById('tab-' + tabId);
  const nav   = document.querySelector(`[data-tab="${tabId}"]`);
  if (panel) panel.classList.add('active');
  if (nav)   nav.classList.add('active');

  const titles = {
    overview: 'Tổng quan hệ thống',
    analytics:'Phân tích & Biểu đồ',
    control:  'Điều khiển tải',
    alerts:   'Nhật ký cảnh báo',
    device:   'Thông tin thiết bị',
  };
  const el = document.getElementById('page-title');
  if (el) el.textContent = titles[tabId] || '';

  if (tabId === 'alerts') Alerts.clearUnread();
}

/* ── HELPERS ──────────────────────────────────────────────── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setClass(id, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('ok', 'warn', 'crit');
  el.classList.add(cls);
}

function tempClass(v) {
  if (v < -100) return 'crit';
  return v >= sim.tempOff ? 'crit' : v >= sim.tempOff - 3 ? 'warn' : 'ok';
}

function statusClass(s) {
  if (s === 'SENSOR_ERROR') return 'crit';
  if (s === 'OVER_TEMP')    return 'crit';
  return 'ok';
}

/* ── MAIN UI UPDATE ──────────────────────────────────────── */
function updateUI(d) {
  updateGaugeTargets(d);
  pushChartData(d);

  /* ── Header bar ── */
  setText('hdr-ts',      new Date().toLocaleTimeString('vi-VN'));
  setText('hdr-n',       d.sampleN);
  setText('hdr-power',   (d.power_mW / 1000).toFixed(2) + ' W');
  setText('hdr-status',  d.status);

  const hdrStatus = document.getElementById('hdr-status');
  if (hdrStatus) {
    hdrStatus.className = 'status-badge ' + statusClass(d.status);
  }

  /* ── Tab: Overview — KPI cards ── */
  const tempDisplay = d.temp < -100 ? 'ERR' : d.temp.toFixed(1);
  setText('kpi-temp',    tempDisplay);
  setText('kpi-voltage', d.voltage.toFixed(2));
  setText('kpi-current', d.current_mA.toFixed(0));
  setText('kpi-power',   d.power_mW.toFixed(0));

  setClass('kpi-card-temp',    tempClass(d.temp));

  /* Gauges readout already handled by gauge.js */

  /* ── Live feed table ── */
  setText('lf-temp',       d.temp < -100 ? 'ERROR' : d.temp.toFixed(1));
  setText('lf-voltage',    d.voltage.toFixed(3));
  setText('lf-current',    d.current_mA.toFixed(1));
  setText('lf-power',      d.power_mW.toFixed(1));
  setText('lf-load',       d.load ? 'BẬT' : 'TẮT');
  setText('lf-auto',       d.auto ? 'TỰ ĐỘNG' : 'THỦ CÔNG');
  setText('lf-status',     d.status);
  setText('lf-tempOff',    d.tempOff.toFixed(1));
  setText('lf-tempOn',     d.tempOn.toFixed(1));

  /* ── Tab: Analytics summary ── */
  setText('an-power-cur',   d.power_mW.toFixed(0));
  setText('an-voltage-cur', d.voltage.toFixed(2));
  setText('an-current-cur', d.current_mA.toFixed(0));
  setText('an-temp-cur',    d.temp < -100 ? 'ERR' : d.temp.toFixed(1));

  /* ── Tab: Control ── */
  _updateControlPanel(d);
}

function _updateControlPanel(d) {
  /* Load toggle button */
  document.querySelectorAll('.load-toggle-btn').forEach(btn => {
    btn.className = 'ctrl-big-btn' + (d.load ? ' active' : '');
    btn.innerHTML = d.load ? 'TẮT TẢI' : 'BẬT TẢI';
  });

  /* Auto/Manual toggle button */
  document.querySelectorAll('.auto-toggle-btn').forEach(btn => {
    btn.className = 'ctrl-big-btn' + (d.auto ? ' active' : '') + ' auto-btn';
    btn.innerHTML = d.auto ? 'CHE DO: TU DONG' : 'CHE DO: THU CONG';
  });

  /* Status display */
  const statusEl = document.getElementById('ctrl-status');
  if (statusEl) {
    statusEl.className = 'tag ' + statusClass(d.status);
    statusEl.textContent = d.status === 'SENSOR_ERROR' ? 'LOI CAM BIEN'
                         : d.status === 'OVER_TEMP'    ? 'QUA NHIET'
                         : 'BINH THUONG';
  }

  /* Load status indicator */
  const dot = document.getElementById('load-indicator');
  if (dot) {
    dot.style.background = d.load ? 'var(--ok)' : 'var(--crit)';
    dot.style.boxShadow  = d.load ? '0 0 7px var(--ok)' : '0 0 7px var(--crit)';
  }

  /* Mode indicator */
  const modeDot = document.getElementById('mode-indicator');
  if (modeDot) {
    modeDot.style.background = d.auto ? 'var(--sky)' : 'var(--amber)';
    modeDot.style.boxShadow  = d.auto ? '0 0 7px var(--sky)' : '0 0 7px var(--amber)';
  }

  /* Temperature vs thresholds */
  setText('ctrl-temp',    d.temp < -100 ? 'ERROR' : d.temp.toFixed(1));
  setText('ctrl-tempOff', d.tempOff.toFixed(1));
  setText('ctrl-tempOn',  d.tempOn.toFixed(1));

  /* Threshold input placeholders */
  const offInput = document.getElementById('thresh-tempOff');
  const onInput  = document.getElementById('thresh-tempOn');
  if (offInput && !offInput.matches(':focus')) offInput.value = d.tempOff;
  if (onInput  && !onInput.matches(':focus'))  onInput.value  = d.tempOn;
}

/* ── LOAD TOGGLE (manual) ────────────────────────────────── */
function toggleLoad() {
  if (typeof mqttSetLoad === 'function' && typeof mqttConnected !== 'undefined' && mqttConnected) {
    mqttSetLoad(!sim.load);
    return;
  }
  sim.auto = false;
  sim.load = !sim.load;
  if (!sim.load) {
    sim.current_mA = 0;
    sim.power_mW   = 0;
  }
  Alerts.push(sim.load ? 'LOAD_ON' : 'LOAD_OFF');
  _updateControlPanel(sim);
}

/* ── AUTO MODE TOGGLE ────────────────────────────────────── */
function toggleAuto() {
  if (typeof mqttSetAuto === 'function' && typeof mqttConnected !== 'undefined' && mqttConnected) {
    mqttSetAuto(!sim.auto);
    return;
  }
  sim.auto = !sim.auto;
  _updateControlPanel(sim);
}

/* ── APPLY THRESHOLDS ────────────────────────────────────── */
function applyThresholds() {
  const offInput = document.getElementById('thresh-tempOff');
  const onInput  = document.getElementById('thresh-tempOn');
  if (!offInput || !onInput) return;

  const newOff = parseFloat(offInput.value);
  const newOn  = parseFloat(onInput.value);

  if (isNaN(newOff) || isNaN(newOn)) return;

  /* Guard: tempOn must be < tempOff (mirrors firmware logic) */
  if (newOn >= newOff) {
    offInput.style.borderColor = 'var(--crit)';
    onInput.style.borderColor  = 'var(--crit)';
    offInput.style.boxShadow   = '0 0 0 3px rgba(248,113,113,0.15)';
    onInput.style.boxShadow    = '0 0 0 3px rgba(248,113,113,0.15)';
    setTimeout(() => {
      offInput.style.borderColor = '';
      onInput.style.borderColor  = '';
      offInput.style.boxShadow   = '';
      onInput.style.boxShadow    = '';
    }, 1500);
    return;
  }

  sim.tempOff = newOff;
  sim.tempOn  = newOn;
  if (typeof mqttSetThresholds === 'function' && typeof mqttConnected !== 'undefined' && mqttConnected) {
    mqttSetThresholds(newOff, newOn);
  }

  offInput.style.borderColor = 'var(--ok)';
  onInput.style.borderColor  = 'var(--ok)';
  offInput.style.boxShadow   = '0 0 0 3px rgba(34,197,94,0.15)';
  onInput.style.boxShadow    = '0 0 0 3px rgba(34,197,94,0.15)';
  setTimeout(() => {
    offInput.style.borderColor = '';
    onInput.style.borderColor  = '';
    offInput.style.boxShadow   = '';
    onInput.style.boxShadow    = '';
  }, 1500);

  setText('ctrl-tempOff', newOff.toFixed(1));
  setText('ctrl-tempOn',  newOn.toFixed(1));
}

/* ── BOOT ─────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  initGauges();
  initAllCharts();

  showTab('overview');

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) showTab(tab);
    });
  });

  const startSim = () => startSimulation(updateUI);
  if (typeof connectMqtt === 'function') {
    connectMqtt(
      data => {
        Object.assign(sim, data);
        updateUI(sim);
      },
      alert => {
        if (alert && alert.type) Alerts.push(alert.type, alert.message);
      },
      status => {
        if (status) console.log('[MQTT] Status:', status);
      },
      startSim
    );
  } else {
    startSim();
  }
});
