/* =============================================================
   gauge.js — Canvas arc gauges for INA219 + DS18B20 readings
   ============================================================= */

const GAUGE_CONFIGS = [
  { id:'g-voltage',    valId:'v-voltage',    key:'voltage',    min:0, max:16,    color:'#f6a623', unit:'V',  decimals:2 },
  { id:'g-current',    valId:'v-current',    key:'current_mA', min:0, max:1000,  color:'#38bdf8', unit:'mA', decimals:0 },
  { id:'g-power',      valId:'v-power',      key:'power_mW',   min:0, max:15000, color:'#fb923c', unit:'mW', decimals:0 },
];

const gTarget  = { voltage:0, current_mA:0, power_mW:0 };
const gCurrent = { voltage:0, current_mA:0, power_mW:0 };

function drawGauge(canvasId, value, min, max, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth  || canvas.width;
  const H = canvas.clientHeight || canvas.height;

  if (canvas.width !== W * dpr) {
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const cx   = W / 2;
  const cy   = H - 12;
  const R    = Math.min(cx - 10, cy - 8);
  const LW   = Math.max(8, R * 0.14);

  const START = Math.PI * 225 / 180;
  const SWEEP = Math.PI * 270 / 180;
  const frac  = Math.max(0, Math.min(1, (value - min) / (max - min)));

  /* Background track */
  ctx.beginPath();
  ctx.arc(cx, cy, R, START, START + SWEEP, false);
  ctx.strokeStyle = '#212d40';
  ctx.lineWidth   = LW;
  ctx.lineCap     = 'round';
  ctx.stroke();

  /* Gradient fill arc */
  if (frac > 0.005) {
    const grad = ctx.createLinearGradient(
      cx + R * Math.cos(START),
      cy + R * Math.sin(START),
      cx + R * Math.cos(START + frac * SWEEP),
      cy + R * Math.sin(START + frac * SWEEP)
    );
    grad.addColorStop(0, color + 'aa');
    grad.addColorStop(1, color);

    ctx.beginPath();
    ctx.arc(cx, cy, R, START, START + frac * SWEEP, false);
    ctx.strokeStyle  = grad;
    ctx.lineWidth    = LW;
    ctx.lineCap      = 'round';
    ctx.shadowColor  = color;
    ctx.shadowBlur   = 12;
    ctx.stroke();
    ctx.shadowBlur   = 0;
  }

  /* Tick marks */
  for (let i = 0; i <= 4; i++) {
    const a  = START + (i / 4) * SWEEP;
    const r1 = R - LW - 4;
    const r2 = R - LW + 3;
    ctx.beginPath();
    ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
    ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
    ctx.strokeStyle = '#4a6280';
    ctx.lineWidth   = 1.5;
    ctx.lineCap     = 'butt';
    ctx.stroke();
  }

  /* Needle */
  const na = START + frac * SWEEP;
  const nl = R - 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + nl * Math.cos(na), cy + nl * Math.sin(na));
  ctx.strokeStyle = 'rgba(240,244,248,0.85)';
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
  ctx.stroke();

  /* Center dot */
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#6b829a';
  ctx.fill();
}

function gaugeAnimLoop() {
  const LERP = 0.1;
  let dirty = false;
  for (const k of ['voltage', 'current_mA', 'power_mW']) {
    const diff = gTarget[k] - gCurrent[k];
    if (Math.abs(diff) > 0.05) {
      gCurrent[k] += diff * LERP;
      dirty = true;
    }
  }
  if (dirty) {
    GAUGE_CONFIGS.forEach(g =>
      drawGauge(g.id, gCurrent[g.key], g.min, g.max, g.color)
    );
  }
  requestAnimationFrame(gaugeAnimLoop);
}

function updateGaugeTargets(data) {
  gTarget.voltage    = data.voltage;
  gTarget.current_mA = data.current_mA;
  gTarget.power_mW   = data.power_mW;

  GAUGE_CONFIGS.forEach(g => {
    const el = document.getElementById(g.valId);
    if (el) el.textContent = data[g.key].toFixed(g.decimals);
  });
}

function initGauges() {
  requestAnimationFrame(gaugeAnimLoop);
}
